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
  getResources,
  createResource,
  updateResource
} = await import('../../../src/controllers/reservations/resources.controller.js');
const { logAudit } = await import('../../../src/middlewares/audit.service.js');

import Resource from '../../../src/models/Resource.js';

// Setup Fake App & Middleware
const app = express();
app.use(express.json());

const testUserId = new mongoose.Types.ObjectId();
const fakeAuth = (req, res, next) => {
  req.user = { _id: testUserId };
  next();
};

app.get('/api/resources', getResources);
app.post('/api/resources', fakeAuth, createResource);
app.put('/api/resources/:id', fakeAuth, updateResource);

app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({ message: err.message });
});

describe('Resources Controller Tests', () => {
  let mongoServer;
  const testOrgId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Resource.deleteMany({});
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------
  // CREATE RESOURCE
  // ---------------------------------------------------------
  describe('POST /api/resources', () => {
    it('should create a resource and trigger the audit log', async () => {
      const payload = {
        organizationId: testOrgId,
        name: 'Conference Room A',
        type: 'ROOM',
        details: { capacity: 20 }
      };

      const response = await request(app).post('/api/resources').send(payload);

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Conference Room A');
      expect(response.body.type).toBe('ROOM');
      
      // Verify Audit Log
      expect(logAudit).toHaveBeenCalledTimes(1);
      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
        action: 'RESOURCE_CREATED',
        targetModel: 'Resource',
        metadata: expect.objectContaining({ name: 'Conference Room A', type: 'ROOM' })
      }));
    });
  });

  // ---------------------------------------------------------
  // GET RESOURCES & SEARCH
  // ---------------------------------------------------------
  describe('GET /api/resources', () => {
    beforeEach(async () => {
      await Resource.create([
        { name: 'Ford Transit', type: 'VEHICLE', organizationId: testOrgId },
        { name: 'Meeting Room 1', type: 'ROOM', organizationId: testOrgId },
        { name: 'Projector', type: 'EQUIPMENT', organizationId: testOrgId }
      ]);
    });

    it('should return all resources for the specific organization', async () => {
      const response = await request(app)
        .get('/api/resources')
        .query({ organizationId: testOrgId.toString() });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
    });

    it('should filter resources by search string (case-insensitive)', async () => {
      const response = await request(app)
        .get('/api/resources')
        .query({ organizationId: testOrgId.toString(), search: 'ford' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Ford Transit');
    });

    it('should filter resources by type', async () => {
      const response = await request(app)
        .get('/api/resources')
        .query({ organizationId: testOrgId.toString(), type: 'ROOM' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Meeting Room 1');
    });
  });

  // ---------------------------------------------------------
  // UPDATE RESOURCE
  // ---------------------------------------------------------
  describe('PUT /api/resources/:id', () => {
    let existingResource;

    beforeEach(async () => {
      existingResource = await Resource.create({
        name: 'Old Van',
        type: 'VEHICLE',
        isActive: true,
        organizationId: testOrgId
      });
    });

    it('should update fields and record a precise diff in AuditLog', async () => {
      const response = await request(app)
        .put(`/api/resources/${existingResource._id}`)
        .send({
          name: 'New Van',
          isActive: false
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('New Van');
      expect(response.body.isActive).toBe(false);

      // Verify Audit Log
      expect(logAudit).toHaveBeenCalledTimes(1);
      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
        action: 'RESOURCE_UPDATED',
        targetModel: 'Resource',
        diff: expect.objectContaining({
          before: expect.objectContaining({ name: 'Old Van', isActive: true }),
          after: expect.objectContaining({ name: 'New Van', isActive: false })
        })
      }));
    });

    it('should NOT trigger audit log if no data actually changed', async () => {
      await request(app)
        .put(`/api/resources/${existingResource._id}`)
        .send({ name: 'Old Van', isActive: true }); 

      expect(logAudit).not.toHaveBeenCalled();
    });
  });
});