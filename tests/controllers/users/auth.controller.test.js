import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import Organization from '../../../src/models/Organization.js'; 

// Import your code
import User from '../../../src/models/User.js';
import { resetPassword, signIn, validateResetToken } from '../../../src/controllers/users/auth.controller.js';

// Setup a Mini Express App just for testing these controllers
const app = express();
app.use(express.json());

// Mount the controllers to fake routes
app.post('/api/signin', signIn);
app.get('/api/validate-reset/:token', validateResetToken);
app.post('/api/reset-password', resetPassword); 

// Add a simple error handler to catch your Express-Async-Handler errors
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({ message: err.message });
});

describe('Auth Controller Integration Tests', () => {
  let mongoServer;

  // Database Setup (Runs once before all tests)
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    
    process.env.JWT_SECRET = 'super_secret_test_key';
  });

  // Database Teardown (Runs once after all tests)
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  // Cleanup (Runs after EACH test so they don't interfere with each other)
  afterEach(async () => {
    await User.deleteMany({});
  });

  // ==========================================
  // SIGN IN TESTS
  // ==========================================
  describe('POST /api/signin', () => {
    it('should authenticate a valid user and return a token', async () => {
      // 1. Arrange: Create a user in the fake DB
      await User.create({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@bambu.com',
        password: 'Password123!',
      });

      // 2. Act: Send request
      const response = await request(app)
        .post('/api/signin')
        .send({
          email: 'test@bambu.com',
          password: 'Password123!',
          rememberMe: false
        });

      // 3. Assert: Check results
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('email', 'test@bambu.com');
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should fail with 400 if password is wrong', async () => {
      await User.create({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@bambu.com',
        password: 'Password123!',
      });

      const response = await request(app)
        .post('/api/signin')
        .send({
          email: 'test@bambu.com',
          password: 'WrongPassword!'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('should fail with 400 if user does not exist', async () => {
      const response = await request(app)
        .post('/api/signin')
        .send({
          email: 'ghost@bambu.com',
          password: 'Password123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('AUTH_INVALID_CREDENTIALS');
    });
  });

  // ==========================================
  // VALIDATE RESET TOKEN TESTS
  // ==========================================
  describe('GET /api/validate-reset/:token', () => {
    it('should return 200 if token is valid and user exists', async () => {
      // 1. Create a user
      const user = await User.create({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@bambu.com',
        password: 'Password123!',
      });

      // 2. Manually generate a valid reset token for this user
      const validToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: '15m',
      });

      // 3. Send request to the route with the token in the URL params
      const response = await request(app).get(`/api/validate-reset/${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('TOKEN_VALID');
    });

    it('should return 400 if token is invalid or expired', async () => {
      const invalidToken = 'this.is.not.a.real.token';

      const response = await request(app).get(`/api/validate-reset/${invalidToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('AUTH_TOKEN_INVALID');
    });

    it('should return 404 if token is valid but user was deleted', async () => {
      // We generate a valid token using a fake, non-existent MongoDB ID
      const fakeId = new mongoose.Types.ObjectId();
      const validTokenForGhost = jwt.sign({ id: fakeId }, process.env.JWT_SECRET);

      const response = await request(app).get(`/api/validate-reset/${validTokenForGhost}`);
    
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('AUTH_USER_NOT_FOUND');
    });
  });

// ==========================================
  // RESET PASSWORD TESTS
  // ==========================================
  describe('POST /api/reset-password', () => {
    it('should reset the password and return a new session token', async () => {
      // 1. Create a user with an old password
      const user = await User.create({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@bambu.com',
        password: 'OldPassword123!',
      });

      // 2. Generate a valid token
      const validToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: '15m',
      });

      // 3. Send request with new password
      const response = await request(app)
        .post('/api/reset-password')
        .send({
          token: validToken,
          password: 'NewPassword456!'
        });

      // 4. Assert success and check for new token
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('PASSWORD_RESET_SUCCESS');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('email', 'test@bambu.com');
    });

    it('should return 400 if token is invalid or expired', async () => {
      const response = await request(app)
        .post('/api/reset-password')
        .send({
          token: 'this.is.a.bad.token',
          password: 'NewPassword456!'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('AUTH_TOKEN_INVALID');
    });

    it('should return 404 if token is valid but user was deleted', async () => {
      // Generate a valid token using a fake MongoDB ID
      const fakeId = new mongoose.Types.ObjectId();
      const validTokenForGhost = jwt.sign({ id: fakeId }, process.env.JWT_SECRET);

      const response = await request(app)
        .post('/api/reset-password')
        .send({
          token: validTokenForGhost,
          password: 'NewPassword456!'
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('AUTH_USER_NOT_FOUND');
    });
  });

  // ==========================================
  // TODO: OTHER ROUTES NOT YET IMPLEMENTED
  // ==========================================
  // Tests for forgotPassword is omitted for now
  // to avoid complex nodemailer ES module mocking.
});