import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// 1. Mock Audit Logger
jest.unstable_mockModule('../../../src/middlewares/audit.service.js', () => ({
  logAudit: jest.fn(),
}));

// 2. Dynamic Imports (Must happen AFTER mocking)
const { 
  getEmployees, 
  getEmployeeById, 
  createEmployee, 
  updateEmployee, 
  updateAssurances 
} = await import('../../../src/controllers/hr/employees.controller.js');
const { logAudit } = await import('../../../src/middlewares/audit.service.js');

import User from '../../../src/models/User.js';
import EmployeeRecord from '../../../src/models/hr/EmployeeRecord.js';
import Organization from '../../../src/models/Organization.js';

// ==========================================
// EXPRESS APP SETUP
// ==========================================
const app = express();
app.use(express.json());

let testUserId;
const fakeAuth = (req, res, next) => {
  req.user = { _id: testUserId };
  next();
};

app.get('/api/organizations/:orgId/employees', fakeAuth, getEmployees);
app.get('/api/organizations/:orgId/employees/:employeeId', fakeAuth, getEmployeeById);
app.post('/api/organizations/:orgId/employees', fakeAuth, createEmployee);
app.put('/api/organizations/:orgId/employees/:employeeId', fakeAuth, updateEmployee);
app.put('/api/organizations/:orgId/employees/:employeeId/assurances', fakeAuth, updateAssurances);

// Standard Error Handler
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({ message: err.message });
});

// ==========================================
// TEST SUITE
// ==========================================
describe('HR Employees Controller Tests', () => {
  let mongoServer;
  let testOrgId;
  let linkedUserId;
  let unlinkedUserId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // 1. Create a dummy organization
    const org = await Organization.create({ name: 'Bambu Corp', maxMembers: 10 });
    testOrgId = org._id;

    // 2. Create the acting user (Admin doing the requests)
    const admin = await User.create({
      firstName: 'Admin', lastName: 'User', email: 'admin@test.com', password: 'password123',
    });
    testUserId = admin._id;

    // 3. Create a user linked to the organization
    const linkedUser = await User.create({
      firstName: 'John', lastName: 'Doe', email: 'john@test.com', password: 'password123',
      memberships: [{ organizationId: testOrgId, role: 'employee' }]
    });
    linkedUserId = linkedUser._id;

    // 4. Create a user NOT linked to the organization
    const unlinkedUser = await User.create({
      firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com', password: 'password123',
      memberships: [] // No orgs
    });
    unlinkedUserId = unlinkedUser._id;
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Organization.deleteMany({});
    await EmployeeRecord.deleteMany({});
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------
  // CREATE EMPLOYEE
  // ---------------------------------------------------------
  describe('POST /employees', () => {
    it('should successfully create an employee record and log audit', async () => {
      const response = await request(app)
        .post(`/api/organizations/${testOrgId}/employees`)
        .send({
          userId: linkedUserId,
          socialSecurityNumber: '123456789',
          nationality: 'French'
        });

      expect(response.status).toBe(201);
      expect(response.body.socialSecurityNumber).toBe('123456789');
      expect(response.body.organizationId).toBe(testOrgId.toString());
      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
        action: 'EMPLOYEE_RECORD_CREATED',
        targetModel: 'EmployeeRecord'
      }));
    });

    it('should fail if user is not in the organization', async () => {
      const response = await request(app)
        .post(`/api/organizations/${testOrgId}/employees`)
        .send({
          userId: unlinkedUserId,
          socialSecurityNumber: '987654321'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('USER_NOT_IN_ORGANIZATION');
    });

    it('should fail if user already has an employee record in this org', async () => {
      // Pre-create the record
      await EmployeeRecord.create({ userId: linkedUserId, organizationId: testOrgId });

      const response = await request(app)
        .post(`/api/organizations/${testOrgId}/employees`)
        .send({ userId: linkedUserId });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('EMPLOYEE_RECORD_ALREADY_EXISTS');
    });
  });

  // ---------------------------------------------------------
  // GET EMPLOYEES
  // ---------------------------------------------------------
  describe('GET /employees', () => {
    it('should fetch all employee records for the organization populated with user data', async () => {
      await EmployeeRecord.create({ userId: linkedUserId, organizationId: testOrgId });

      const response = await request(app).get(`/api/organizations/${testOrgId}/employees`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      // Validate population
      expect(response.body[0].userId.firstName).toBe('John');
      expect(response.body[0].userId.email).toBe('john@test.com');
      expect(response.body[0]).not.toHaveProperty('userId.password'); // Ensure sensitive data isn't exposed
    });
  });

  // ---------------------------------------------------------
  // GET EMPLOYEE BY ID
  // ---------------------------------------------------------
  describe('GET /employees/:employeeId', () => {
    it('should fetch a single employee record by ID', async () => {
      const record = await EmployeeRecord.create({ userId: linkedUserId, organizationId: testOrgId });

      const response = await request(app).get(`/api/organizations/${testOrgId}/employees/${record._id}`);

      expect(response.status).toBe(200);
      expect(response.body._id).toBe(record._id.toString());
      expect(response.body.userId.firstName).toBe('John');
    });

    it('should return 404 if record does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app).get(`/api/organizations/${testOrgId}/employees/${fakeId}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('EMPLOYEE_RECORD_NOT_FOUND');
    });
  });

  // ---------------------------------------------------------
  // UPDATE EMPLOYEE
  // ---------------------------------------------------------
  describe('PUT /employees/:employeeId', () => {
    let record;

    beforeEach(async () => {
      record = await EmployeeRecord.create({ 
        userId: linkedUserId, 
        organizationId: testOrgId,
        nationality: 'French',
        address: { city: 'Paris', country: 'France' } 
      });
    });

    it('should successfully deep merge nested objects without destroying existing keys', async () => {
      const response = await request(app)
        .put(`/api/organizations/${testOrgId}/employees/${record._id}`)
        .send({
          address: { zipCode: '75001' } // Only updating zipCode, leaving city/country intact
        });

      expect(response.status).toBe(200);
      // Deep merge checks:
      expect(response.body.address.zipCode).toBe('75001');
      expect(response.body.address.city).toBe('Paris'); 
      expect(response.body.address.country).toBe('France');
      
      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'EMPLOYEE_RECORD_UPDATED' }));
    });

    it('should update primitive fields cleanly', async () => {
      const response = await request(app)
        .put(`/api/organizations/${testOrgId}/employees/${record._id}`)
        .send({ nationality: 'Canadian' });

      expect(response.status).toBe(200);
      expect(response.body.nationality).toBe('Canadian');
    });

    it('should return 404 if employee record not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .put(`/api/organizations/${testOrgId}/employees/${fakeId}`)
        .send({ nationality: 'Canadian' });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('EMPLOYEE_RECORD_NOT_FOUND');
    });
  });

  // ---------------------------------------------------------
  // UPDATE ASSURANCES
  // ---------------------------------------------------------
  describe('PUT /employees/:employeeId/assurances', () => {
    it('should update the assurances block', async () => {
      const record = await EmployeeRecord.create({ userId: linkedUserId, organizationId: testOrgId });

      const response = await request(app)
        .put(`/api/organizations/${testOrgId}/employees/${record._id}/assurances`)
        .send({
          mutuelleStatus: 'AFFILIE',
          mutuelleType: 'ISOLE'
        });

      expect(response.status).toBe(200);
      // Assert against fields that actually exist in your schema!
      expect(response.body.assurances.mutuelleStatus).toBe('AFFILIE');
      expect(response.body.assurances.mutuelleType).toBe('ISOLE');
    });

    it('should return 404 if updating assurances on non-existent record', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .put(`/api/organizations/${testOrgId}/employees/${fakeId}/assurances`)
        .send({
          mutuelleStatus: 'AFFILIE'
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('EMPLOYEE_RECORD_NOT_FOUND');
    });
  });
});