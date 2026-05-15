import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// 1. Mock Audit Service (3 levels up)
jest.unstable_mockModule('../../../src/middlewares/audit.service.js', () => ({
  logAudit: jest.fn(),
}));

const { 
  getOrganizationById, 
  updateOrganization, 
  deleteOrganization 
} = await import('../../../src/controllers/organizations/organization.controller.js');
const { logAudit } = await import('../../../src/middlewares/audit.service.js');

import Organization from '../../../src/models/Organization.js';
import User from '../../../src/models/User.js';
import Invitation from '../../../src/models/Invitation.js';

const app = express();
app.use(express.json());

const testUserId = new mongoose.Types.ObjectId();
const fakeAuth = (req, res, next) => {
  req.user = { _id: testUserId };
  next();
};

app.get('/api/organizations/:id', getOrganizationById);
app.put('/api/organizations/:id', fakeAuth, updateOrganization);
app.delete('/api/organizations/:id', fakeAuth, deleteOrganization);

app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({ message: err.message });
});

describe('Organization Core Controller Tests', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Organization.deleteMany({});
    await User.deleteMany({});
    await Invitation.deleteMany({});
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------
  // UPDATE ORGANIZATION
  // ---------------------------------------------------------
  describe('PUT /api/organizations/:id', () => {
    it('should update organization and log specific diffs for profile and address', async () => {
      const org = await Organization.create({
        name: 'Old Name',
        maxMembers: 10,
        address: { city: 'Old City', country: 'Germany' }
      });

      const response = await request(app)
        .put(`/api/organizations/${org._id}`)
        .send({
          name: 'New Name',
          address: { city: 'New City' }
        });

      expect(response.status).toBe(200);
      expect(response.body.organization.name).toBe('New Name');
      expect(response.body.organization.address.city).toBe('New City');

      // Verify Audit Logs - Expecting TWO calls (Address and Profile)
      expect(logAudit).toHaveBeenCalledTimes(2);
      
      // Check Address Diff
      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
        action: 'ORG_ADDRESS_UPDATED',
        diff: expect.objectContaining({
          after: expect.objectContaining({ city: 'New City' })
        })
      }));
    });

    it('should fail if maxMembers is set lower than current member count', async () => {
      const org = await Organization.create({ name: 'Limit Test', maxMembers: 10 });
      
      // Seed 2 active members
      await User.create([
        { firstName: 'U1', lastName: 'L', email: '1@b.com', password: 'p', memberships: [{ organizationId: org._id }] },
        { firstName: 'U2', lastName: 'L', email: '2@b.com', password: 'p', memberships: [{ organizationId: org._id }] }
      ]);

      const response = await request(app)
        .put(`/api/organizations/${org._id}`)
        .send({ maxMembers: 1 }); // Conflict! (1 < 2)

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('ORG_LIMIT_CONFLICT');
    });
  });

  // ---------------------------------------------------------
  // DELETE ORGANIZATION
  // ---------------------------------------------------------
  describe('DELETE /api/organizations/:id', () => {
    it('should delete organization and cleanup users memberships and invitations', async () => {
      const org = await Organization.create({ name: 'To Delete', maxMembers: 5 });
      
      const user = await User.create({
        firstName: 'Member', lastName: 'L', email: 'm@b.com', password: 'p',
        memberships: [{ organizationId: org._id, role: 'employee' }]
      });

      await Invitation.create({
        email: 'invited@b.com', token: 'tok', organizationId: org._id, 
        firstName: 'I', lastName: 'N', role: 'employee'
      });

      const response = await request(app).delete(`/api/organizations/${org._id}`);

      expect(response.status).toBe(200);

      // Verify Cleanup
      const orgCheck = await Organization.findById(org._id);
      expect(orgCheck).toBeNull();

      const userCheck = await User.findById(user._id);
      expect(userCheck.memberships).toHaveLength(0);

      const inviteCheck = await Invitation.findOne({ organizationId: org._id });
      expect(inviteCheck).toBeNull();
    });
  });
});