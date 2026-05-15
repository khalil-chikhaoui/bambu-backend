import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// 1. Mock the Audit Service 
// Note: Ensure this path matches where your audit.service.js is located
jest.unstable_mockModule('../../../src/middlewares/audit.service.js', () => ({
  logAudit: jest.fn(),
}));

const { acceptInviteLogin, acceptInviteRegister } = await import('../../../src/controllers/invitations/acceptance.controller.js');
import Invitation from '../../../src/models/Invitation.js';
import User from '../../../src/models/User.js';
import Organization from '../../../src/models/Organization.js';

const app = express();
app.use(express.json());
app.post('/api/invite/login', acceptInviteLogin);
app.post('/api/invite/register', acceptInviteRegister);

app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({ message: err.message });
});

describe('Invitation Acceptance Controller Tests', () => {
  let mongoServer;
  let testOrg;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    process.env.JWT_SECRET = 'test_secret';
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    testOrg = await Organization.create({
      name: 'Bambu Test Org',
      maxMembers: 2 
    });
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Organization.deleteMany({});
    await Invitation.deleteMany({});
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------
  // REGISTER (NEW USER)
  // ---------------------------------------------------------
  describe('POST /api/invite/register', () => {
    it('should register a new user and delete the invitation', async () => {
      await Invitation.create({
        email: 'newbie@bambu.com',
        token: 'token123',
        organizationId: testOrg._id,
        role: 'employee',
        firstName: 'New', // Fixed: Added required field
        lastName: 'User'   // Fixed: Added required field
      });

      const response = await request(app)
        .post('/api/invite/register')
        .send({
          token: 'token123',
          password: 'Password123!',
          firstName: 'New',
          lastName: 'User'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('INVITATION_ACCEPTED');
      
      const user = await User.findOne({ email: 'newbie@bambu.com' });
      expect(user).not.toBeNull();
      expect(user.memberships[0].organizationId.toString()).toBe(testOrg._id.toString());

      const inviteCheck = await Invitation.findOne({ token: 'token123' });
      expect(inviteCheck).toBeNull();
    });

    it('should fail if organization has reached max members', async () => {
      // Fill the organization (max is 2)
      await User.create({ firstName: 'U1', lastName: 'L', email: '1@a.com', password: 'p', memberships: [{ organizationId: testOrg._id }] });
      await User.create({ firstName: 'U2', lastName: 'L', email: '2@a.com', password: 'p', memberships: [{ organizationId: testOrg._id }] });

      await Invitation.create({
        email: 'blocked@bambu.com',
        token: 'fulltoken',
        organizationId: testOrg._id,
        role: 'employee',
        firstName: 'John', // Fixed: Added required field
        lastName: 'Doe'    // Fixed: Added required field
      });

      const response = await request(app)
        .post('/api/invite/register')
        .send({ token: 'fulltoken', password: 'p' });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('ORG_MAX_MEMBERS_EXCEEDED');
    });
  });

  // ---------------------------------------------------------
  // LOGIN (EXISTING USER)
  // ---------------------------------------------------------
  describe('POST /api/invite/login', () => {
    it('should add membership to existing user and return 200', async () => {
      await User.create({
        firstName: 'Khalil',
        lastName: 'C',
        email: 'existing@bambu.com',
        password: 'Password123!'
      });

      await Invitation.create({
        email: 'existing@bambu.com',
        token: 'logintoken',
        organizationId: testOrg._id,
        role: 'admin',
        firstName: 'Khalil', // Fixed: Added required field
        lastName: 'C'        // Fixed: Added required field
      });

      const response = await request(app)
        .post('/api/invite/login')
        .send({ token: 'logintoken', password: 'Password123!' });

      expect(response.status).toBe(200);
      const updatedUser = await User.findOne({ email: 'existing@bambu.com' });
      expect(updatedUser.memberships).toHaveLength(1);
      expect(updatedUser.memberships[0].role).toBe('admin');
    });

    it('should fail if password for existing user is incorrect', async () => {
      await User.create({
        firstName: 'Khalil',
        lastName: 'C',
        email: 'existing@bambu.com',
        password: 'RightPassword'
      });

      await Invitation.create({
        email: 'existing@bambu.com',
        token: 'badpasstoken',
        organizationId: testOrg._id,
        firstName: 'Khalil', // Fixed: Added required field
        lastName: 'C'        // Fixed: Added required field
      });

      const response = await request(app)
        .post('/api/invite/login')
        .send({ token: 'badpasstoken', password: 'WrongPassword' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('AUTH_INVALID_CREDENTIALS');
    });
  });
});