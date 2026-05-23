import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// 1. Mock Audit Service
jest.unstable_mockModule('../../../src/middlewares/audit.service.js', () => ({
  logAudit: jest.fn(),
}));

const {
  createReservation,
  getReservations,
  getReservationById,
  updateReservationStatus,
  getPendingReservationsCount
} = await import('../../../src/controllers/reservations/reservations.controller.js');
const { logAudit } = await import('../../../src/middlewares/audit.service.js');

import Reservation from '../../../src/models/Reservation.js';
import Resource from '../../../src/models/Resource.js';
import User from '../../../src/models/User.js';

// Setup Fake App & Middleware
const app = express();
app.use(express.json());

const testUserId = new mongoose.Types.ObjectId();
const fakeAuth = (req, res, next) => {
  req.user = { _id: testUserId };
  next();
};

app.post('/api/reservations', fakeAuth, createReservation);
app.get('/api/reservations', getReservations);
app.get('/api/reservations/pending-count', getPendingReservationsCount); 
app.get('/api/reservations/:id', getReservationById);
app.patch('/api/reservations/:id/status', fakeAuth, updateReservationStatus);

app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({ message: err.message });
});

describe('Reservations Controller Tests', () => {
  let mongoServer;
  const testOrgId = new mongoose.Types.ObjectId();
  let testResource;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    testResource = await Resource.create({
      organizationId: testOrgId,
      name: 'Main Conference Room',
      type: 'ROOM'
    });
  });

  afterEach(async () => {
    await Reservation.deleteMany({});
    await Resource.deleteMany({});
    await User.deleteMany({});
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------
  // CREATE RESERVATION (OVERLAP LOGIC)
  // ---------------------------------------------------------
  describe('POST /api/reservations', () => {
    it('should create a reservation and trigger audit log if dates are free', async () => {
      const payload = {
        organizationId: testOrgId,
        resourceId: testResource._id,
        startTime: new Date('2026-10-10T10:00:00Z'),
        endTime: new Date('2026-10-10T12:00:00Z'),
        purpose: 'Team Meeting'
      };

      const response = await request(app).post('/api/reservations').send(payload);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('PENDING');
      
      expect(logAudit).toHaveBeenCalledTimes(1);
      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
        action: 'RESERVATION_REQUESTED',
        targetModel: 'Reservation',
        metadata: expect.objectContaining({ resourceName: 'Main Conference Room' })
      }));
    });

    it('should block creation if dates overlap with an APPROVED reservation', async () => {
      await Reservation.create({
        organizationId: testOrgId,
        resourceId: testResource._id,
        userId: testUserId,
        startTime: new Date('2026-10-10T10:00:00Z'),
        endTime: new Date('2026-10-10T12:00:00Z'),
        status: 'APPROVED',
        purpose: 'Existing Meeting'
      });

      const response = await request(app).post('/api/reservations').send({
        organizationId: testOrgId,
        resourceId: testResource._id,
        startTime: new Date('2026-10-10T11:00:00Z'),
        endTime: new Date('2026-10-10T13:00:00Z'),
        purpose: 'Overlap Meeting'
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('RESOURCE_ALREADY_BOOKED_FOR_THESE_DATES');
    });

    it('should ALLOW creation if dates overlap with a REJECTED or CANCELLED reservation', async () => {
      await Reservation.create({
        organizationId: testOrgId,
        resourceId: testResource._id,
        userId: testUserId,
        startTime: new Date('2026-10-10T10:00:00Z'),
        endTime: new Date('2026-10-10T12:00:00Z'),
        status: 'REJECTED', 
        purpose: 'Rejected Meeting'
      });

      const response = await request(app).post('/api/reservations').send({
        organizationId: testOrgId,
        resourceId: testResource._id,
        startTime: new Date('2026-10-10T10:00:00Z'),
        endTime: new Date('2026-10-10T12:00:00Z'),
        purpose: 'New Meeting'
      });

      expect(response.status).toBe(201); 
    });
  });

  // ---------------------------------------------------------
  // GET RESERVATIONS & FILTERS
  // ---------------------------------------------------------
  describe('GET /api/reservations', () => {
    let user2Id;

    beforeEach(async () => {
      user2Id = new mongoose.Types.ObjectId();

      await User.create([
        { _id: testUserId, firstName: 'User', lastName: 'One', email: 'u1@b.com', password: 'p' },
        { _id: user2Id, firstName: 'User', lastName: 'Two', email: 'u2@b.com', password: 'p' }
      ]);

      await Reservation.create([
        {
          organizationId: testOrgId, resourceId: testResource._id, userId: testUserId,
          startTime: new Date('2026-05-01T10:00:00Z'), endTime: new Date('2026-05-01T12:00:00Z'),
          status: 'PENDING', purpose: 'A'
        },
        {
          organizationId: testOrgId, resourceId: testResource._id, userId: user2Id,
          startTime: new Date('2026-06-01T10:00:00Z'), endTime: new Date('2026-06-01T12:00:00Z'),
          status: 'APPROVED', purpose: 'B'
        }
      ]);
    });

    it('should filter reservations by userId (My Reservations)', async () => {
      const response = await request(app)
        .get('/api/reservations')
        .query({ organizationId: testOrgId.toString(), userId: testUserId.toString() });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('PENDING');
    });

    it('should filter reservations by status', async () => {
      const response = await request(app)
        .get('/api/reservations')
        .query({ organizationId: testOrgId.toString(), status: 'APPROVED' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      
      expect(response.body.data[0].userId._id).toBe(user2Id.toString());
    });

    it('should filter reservations by start date bounds', async () => {
      const response = await request(app)
        .get('/api/reservations')
        .query({ 
          organizationId: testOrgId.toString(), 
          startDate: '2026-05-15T00:00:00Z' 
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('APPROVED');
    });
  });

  // ---------------------------------------------------------
  // GET SINGLE RESERVATION BY ID
  // ---------------------------------------------------------
  describe('GET /api/reservations/:id', () => {
    it('should get a single reservation by ID with populated fields', async () => {
      await User.create({ _id: testUserId, firstName: 'Test', lastName: 'User', email: 'test@b.com', password: 'p' });
      
      const reservation = await Reservation.create({
        organizationId: testOrgId,
        resourceId: testResource._id,
        userId: testUserId,
        startTime: new Date('2026-10-10T10:00:00Z'),
        endTime: new Date('2026-10-10T12:00:00Z'),
        status: 'PENDING',
        purpose: 'Test Fetch'
      });

      const response = await request(app).get(`/api/reservations/${reservation._id}`);

      expect(response.status).toBe(200);
      expect(response.body.purpose).toBe('Test Fetch');
      expect(response.body.resourceId.name).toBe('Main Conference Room');
      expect(response.body.userId.firstName).toBe('Test');
    });

    it('should return 404 if reservation does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app).get(`/api/reservations/${fakeId}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('RESERVATION_NOT_FOUND');
    });
  });

  // ---------------------------------------------------------
  // UPDATE RESERVATION STATUS
  // ---------------------------------------------------------
  describe('PATCH /api/reservations/:id/status', () => {
    let pendingReservation;

    beforeEach(async () => {
      pendingReservation = await Reservation.create({
        organizationId: testOrgId,
        resourceId: testResource._id,
        userId: testUserId,
        startTime: new Date('2026-10-10T10:00:00Z'),
        endTime: new Date('2026-10-10T12:00:00Z'),
        status: 'PENDING',
        purpose: 'Need a room'
      });
    });

    it('should successfully update status, add admin notes, and log audit diff', async () => {
      const response = await request(app)
        .patch(`/api/reservations/${pendingReservation._id}/status`)
        .send({
          status: 'REJECTED',
          adminNotes: 'Room is undergoing maintenance'
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('REJECTED');
      expect(response.body.adminNotes).toBe('Room is undergoing maintenance');

      expect(logAudit).toHaveBeenCalledTimes(1);
      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
        action: 'RESERVATION_REJECTED',
        diff: expect.objectContaining({
          before: { status: 'PENDING' },
          after: { status: 'REJECTED' }
        }),
        metadata: { 
          adminNotes: 'Room is undergoing maintenance',
          resourceName: 'Main Conference Room'
        }
      }));
    });
  });


  // ---------------------------------------------------------
  // GET PENDING COUNT
  // ---------------------------------------------------------
  describe('GET /api/reservations/pending-count', () => {
    it('should return the correct count of pending reservations', async () => {
      // Create 2 PENDING and 1 APPROVED
      await Reservation.create([
        { organizationId: testOrgId, resourceId: testResource._id, userId: testUserId, startTime: new Date(), endTime: new Date(), status: 'PENDING', purpose: '1' },
        { organizationId: testOrgId, resourceId: testResource._id, userId: testUserId, startTime: new Date(), endTime: new Date(), status: 'PENDING', purpose: '2' },
        { organizationId: testOrgId, resourceId: testResource._id, userId: testUserId, startTime: new Date(), endTime: new Date(), status: 'APPROVED', purpose: '3' }
      ]);

      const response = await request(app)
        .get('/api/reservations/pending-count')
        .query({ organizationId: testOrgId.toString() });

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(2); // Should only count the 2 PENDING
    });
  });

});