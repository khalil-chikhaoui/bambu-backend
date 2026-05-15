import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Import your code
import { getOrganizationHistory } from '../../../src/controllers/organizations/history.controller.js';
import AuditLog from '../../../src/models/AuditLog.js';
import User from '../../../src/models/User.js';

const app = express();
app.use(express.json());
app.get('/api/organizations/:id/history', getOrganizationHistory);

app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({ message: err.message });
});

describe('Organization History Controller Tests', () => {
  let mongoServer;
  let testOrgId;
  let actor;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    testOrgId = new mongoose.Types.ObjectId();
    
    // Create a user to act as the "actor" in the logs
    actor = await User.create({
      firstName: 'Khalil',
      lastName: 'C',
      email: 'khalil@bambu.com',
      password: 'password123'
    });
  });

  afterEach(async () => {
    await AuditLog.deleteMany({});
    await User.deleteMany({});
  });

  it('should fetch paginated history for an organization', async () => {
    // 1. Seed some logs
    await AuditLog.create([
      { organizationId: testOrgId, actor: actor._id, module: 'TEAM', action: 'INVITE_SENT' },
      { organizationId: testOrgId, actor: actor._id, module: 'SETTINGS', action: 'ORG_LOGO_UPDATED' }
    ]);

    // 2. Act
    const response = await request(app)
      .get(`/api/organizations/${testOrgId}/history`)
      .query({ limit: 1 });

    // 3. Assert
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.pagination.totalItems).toBe(2);
    expect(response.body.pagination.totalPages).toBe(2);
    
    // Verify population
    expect(response.body.data[0].actor.firstName).toBe('Khalil');
  });

  it('should filter logs by module', async () => {
    await AuditLog.create([
      { organizationId: testOrgId, actor: actor._id, module: 'TEAM', action: 'MEMBER_REMOVED' },
      { organizationId: testOrgId, actor: actor._id, module: 'FINANCE', action: 'INVOICE_CREATED' }
    ]);

    const response = await request(app)
      .get(`/api/organizations/${testOrgId}/history`)
      .query({ module: 'FINANCE' });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].module).toBe('FINANCE');
  });

  it('should filter logs by targetId', async () => {
    const targetUserId = new mongoose.Types.ObjectId();
    
    await AuditLog.create([
      { organizationId: testOrgId, actor: actor._id, module: 'TEAM', action: 'ROLE_UPDATED', targetId: targetUserId },
      { organizationId: testOrgId, actor: actor._id, module: 'TEAM', action: 'INVITE_SENT' } // No targetId
    ]);

    const response = await request(app)
      .get(`/api/organizations/${testOrgId}/history`)
      .query({ targetId: targetUserId.toString() });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].targetId).toBe(targetUserId.toString());
  });

  it('should return empty data array if organization has no history', async () => {
    const emptyOrgId = new mongoose.Types.ObjectId();
    const response = await request(app).get(`/api/organizations/${emptyOrgId}/history`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(0);
    expect(response.body.pagination.totalItems).toBe(0);
  });
});