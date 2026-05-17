import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'fs';

import { 
  getProfile, 
  updateProfile, 
  uploadUserAvatar, 
  deleteUserAvatar 
} from '../../../src/controllers/users/profile.controller.js';
import User from '../../../src/models/User.js';
import Organization from '../../../src/models/Organization.js';

// ==========================================
// FAKE MIDDLEWARES FOR TESTING
// ==========================================
let testUserId; // We will update this before every test

// 1. Fake Auth Middleware (Pretends we passed the JWT protect check)
const fakeProtect = (req, res, next) => {
  req.user = { _id: testUserId };
  next();
};

// 2. Fake Multer Middleware (Pretends a file was uploaded)
const fakeUpload = (req, res, next) => {
  req.file = {
    filename: 'test-avatar-123.jpg',
    path: '/fake/temp/path/test-avatar-123.jpg'
  };
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
// We inject the fakeUpload middleware only for the upload route
app.post('/api/profile/avatar', fakeProtect, fakeUpload, uploadUserAvatar);
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

    // Spy on fs to prevent actual file deletion during tests
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {}); // Does nothing!
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
    it('should upload an avatar and return the new image URL', async () => {
      const response = await request(app).post('/api/profile/avatar');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('AVATAR_UPLOADED');
      expect(response.body.user.profileImage).toBe('http://localhost:5000/api/images/users/test-avatar-123.jpg');
    });

    it('should delete the old avatar if uploading a new one', async () => {
      // 1. Manually give the user an existing old avatar
      await User.findByIdAndUpdate(testUserId, { 
        profileImage: 'http://localhost:5000/api/images/users/old-avatar.jpg' 
      });

      // 2. Upload a new one
      await request(app).post('/api/profile/avatar');

      // 3. Verify that our system tried to delete the old file
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('should delete the avatar and clear the profileImage field', async () => {
      await User.findByIdAndUpdate(testUserId, { 
        profileImage: 'http://localhost:5000/api/images/users/to-delete.jpg' 
      });

      const response = await request(app).delete('/api/profile/avatar');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('AVATAR_DELETED');
      expect(response.body.user.profileImage).toBe('');
      expect(fs.unlinkSync).toHaveBeenCalled();
    });
  });
});