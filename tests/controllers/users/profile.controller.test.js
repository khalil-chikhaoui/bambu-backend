import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { v2 as cloudinary } from 'cloudinary';

import { 
  getProfile, 
  updateProfile, 
  confirmUserAvatar, 
  deleteUserAvatar 
} from '../../../src/controllers/users/profile.controller.js';
import User from '../../../src/models/User.js';
import Organization from '../../../src/models/Organization.js';

// ==========================================
// FAKE MIDDLEWARES FOR TESTING
// ==========================================
let testUserId; // We will update this before every test

// Fake Auth Middleware (Pretends we passed the JWT protect check)
const fakeProtect = (req, res, next) => {
  req.user = { _id: testUserId };
  next();
};

// ==========================================
// EXPRESS APP SETUP
// ==========================================
const app = express();
app.use(express.json());

// Mount the routes with our fake middlewares
app.get('/api/profile', fakeProtect, getProfile);
app.put('/api/profile', fakeProtect, updateProfile);
app.post('/api/profile/avatar/confirm', fakeProtect, confirmUserAvatar);
app.delete('/api/profile/avatar', fakeProtect, deleteUserAvatar);

app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({ message: err.message });
});

// ==========================================
// TEST SUITE
// ==========================================
describe('Profile Controller Integration Tests', () => {
  let mongoServer;
  let testOrganizationId;

  // Setup Database
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    process.env.BACKEND_URL = 'http://localhost:5000';
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
  });

  // Teardown Database
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  // Seed the database before EACH test
  beforeEach(async () => {
    // 1. Create an Organization
    const org = await Organization.create({
      name: 'Bambu Corp',
      maxMembers: 10
    });
    testOrganizationId = org._id;

    // 2. Create a User belonging to that Organization
    const user = await User.create({
      firstName: 'Khalil',
      lastName: 'Chikhaoui',
      email: 'khalil@bambu.com',
      password: 'Password123!',
      memberships: [{
        organizationId: testOrganizationId,
        role: 'admin',
        title: 'Developer'
      }]
    });
    
    // Set the global ID so our fakeProtect middleware knows who is logged in
    testUserId = user._id;

    // Mock Cloudinary destroy function
    jest.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' });
  });

  // Cleanup after EACH test
  afterEach(async () => {
    await User.deleteMany({});
    await Organization.deleteMany({});
    jest.clearAllMocks();
  });

  // ------------------------------------------
  // GET PROFILE
  // ------------------------------------------
  describe('GET /api/profile', () => {
    it('should return the logged in users profile', async () => {
      const response = await request(app).get('/api/profile');

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('khalil@bambu.com');
      expect(response.body).not.toHaveProperty('password');
      // Check if populate worked
      expect(response.body.memberships[0].organizationId.name).toBe('Bambu Corp');
    });
  });

  // ------------------------------------------
  // UPDATE PROFILE
  // ------------------------------------------
  describe('PUT /api/profile', () => {
    it('should update basic info (firstName, lastName)', async () => {
      const response = await request(app)
        .put('/api/profile')
        .send({
          firstName: 'Khalil Updated',
          lastName: 'Chikhaoui Updated'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('PROFILE_UPDATED');
      expect(response.body.user.firstName).toBe('Khalil Updated');
      expect(response.body.user.lastName).toBe('Chikhaoui Updated');
    });

    it('should update membership title if organizationId is provided', async () => {
      const response = await request(app)
        .put('/api/profile')
        .send({
          organizationId: testOrganizationId.toString(),
          title: 'CTO'
        });

      expect(response.status).toBe(200);
      expect(response.body.user.memberships[0].title).toBe('CTO');
    });
  });

  // ------------------------------------------
  // AVATAR UPLOAD & DELETE
  // ------------------------------------------
  describe('Avatar Management', () => {
    it('should confirm a Cloudinary avatar and return the user details', async () => {
      const response = await request(app)
        .post('/api/profile/avatar/confirm')
        .send({
          secureUrl: 'https://res.cloudinary.com/test/image/upload/avatar.jpg',
          publicId: 'test-public-id'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('AVATAR_CONFIRMED');
      expect(response.body.user.profileImage).toBe('https://res.cloudinary.com/test/image/upload/avatar.jpg');
      expect(response.body.user.profileImagePublicId).toBe('test-public-id');
    });

    it('should delete the old avatar from Cloudinary if confirming a new one', async () => {
      // 1. Manually give the user an existing old avatar with a public ID
      await User.findByIdAndUpdate(testUserId, { 
        profileImage: 'https://res.cloudinary.com/test/image/upload/old.jpg',
        profileImagePublicId: 'old-public-id'
      });

      // 2. Confirm a new one
      await request(app)
        .post('/api/profile/avatar/confirm')
        .send({
          secureUrl: 'https://res.cloudinary.com/test/image/upload/new.jpg',
          publicId: 'new-public-id'
        });

      // 3. Verify that cloudinary.uploader.destroy was called with the old public ID
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('old-public-id');
    });

    it('should delete the avatar from Cloudinary and clear the database fields', async () => {
      await User.findByIdAndUpdate(testUserId, { 
        profileImage: 'https://res.cloudinary.com/test/image/upload/to-delete.jpg',
        profileImagePublicId: 'to-delete-public-id'
      });

      const response = await request(app).delete('/api/profile/avatar');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('AVATAR_DELETED');
      expect(response.body.user.profileImage).toBe('');
      expect(response.body.user.profileImagePublicId).toBe('');
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('to-delete-public-id');
    });
  });
});