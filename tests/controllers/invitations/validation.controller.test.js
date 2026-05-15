import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Import your code
import { validateInvitation } from '../../../src/controllers/invitations/validation.controller.js';
import Invitation from '../../../src/models/Invitation.js';
import User from '../../../src/models/User.js';
import Organization from '../../../src/models/Organization.js';

const app = express();
app.use(express.json());
app.get('/api/invite/validate/:token', validateInvitation);

app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({ message: err.message });
});

describe('Invitation Validation Controller Tests', () => {
  let mongoServer;
  let testOrg;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    testOrg = await Organization.create({
      name: 'Bambu Corp',
      logo: 'bambu-logo.png',
      maxMembers: 10
    });
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Organization.deleteMany({});
    await Invitation.deleteMany({});
  });

  it('should return invitation details and userExists: false for new users', async () => {
    // 1. Arrange: Create invite for email that doesn't exist in User model
    await Invitation.create({
      email: 'new-user@test.com',
      token: 'valid-token-123',
      organizationId: testOrg._id,
      role: 'employee',
      firstName: 'New',
      lastName: 'Person'
    });

    // 2. Act
    const response = await request(app).get('/api/invite/validate/valid-token-123');

    // 3. Assert
    expect(response.status).toBe(200);
    expect(response.body.isValid).toBe(true);
    expect(response.body.userExists).toBe(false);
    expect(response.body.organization.name).toBe('Bambu Corp');
    expect(response.body.email).toBe('new-user@test.com');
  });

  it('should return userExists: true if the invited email is already registered', async () => {
    const existingEmail = 'khalil@bambu.com';
    
    // Create the User
    await User.create({
      firstName: 'Khalil',
      lastName: 'C',
      email: existingEmail,
      password: 'password123'
    });

    // Create the Invite
    await Invitation.create({
      email: existingEmail,
      token: 'login-token-456',
      organizationId: testOrg._id,
      role: 'admin',
      firstName: 'Khalil',
      lastName: 'C'
    });

    const response = await request(app).get('/api/invite/validate/login-token-456');

    expect(response.status).toBe(200);
    expect(response.body.userExists).toBe(true);
    expect(response.body.role).toBe('admin');
  });

  it('should return 404 if the token is invalid', async () => {
    const response = await request(app).get('/api/invite/validate/fake-token');

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('INVITATION_INVALID');
  });
});