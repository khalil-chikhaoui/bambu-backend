import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// 1. Mock the mail config BEFORE importing the controller
const sendMailMock = jest.fn().mockResolvedValue(true);
jest.unstable_mockModule('../../src/config/mail.js', () => ({
  getTransporter: jest.fn().mockReturnValue({
    sendMail: sendMailMock,
  }),
  getContactTemplates: jest.fn().mockReturnValue({
    user: { subject: 'User Subj', html: '<p>User</p>' },
    admin: { subject: 'Admin Subj', html: '<p>Admin</p>' }
  })
}));

// Now import everything else
const { createContactMessage } = await import('../../src/controllers/general.controller.js');
import ContactMessage from '../../src/models/ContactMessage.js';

const app = express();
app.use(express.json());
app.post('/api/contact', createContactMessage);

// Error handler
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({ message: err.message });
});

describe('General Controller (Contact) Integration Tests', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    process.env.SMTP_EMAIL = 'admin@bambu.com';
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await ContactMessage.deleteMany({});
    jest.clearAllMocks();
  });

  it('should save a valid contact message and return 201', async () => {
    const payload = {
      subject: 'Inquiry',
      firstName: 'Khalil',
      lastName: 'Chikhaoui',
      email: 'khalil@test.com',
      message: 'Hello Bambu!',
      language: 'fr'
    };

    const response = await request(app).post('/api/contact').send(payload);

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('MESSAGE_SENT_SUCCESSFULLY');

    // Verify database entry
    const saved = await ContactMessage.findOne({ email: 'khalil@test.com' });
    expect(saved).not.toBeNull();
    expect(saved.firstName).toBe('Khalil');
  });

  it('should block a bot via Honeypot (return 201 but NOT save to DB)', async () => {
    const payload = {
      subject: 'Spam',
      firstName: 'Bot',
      lastName: 'Robot',
      email: 'bot@spam.com',
      message: 'Buy this!',
      hp_address: 'I am a bot' // The Honeypot field!
    };

    const response = await request(app).post('/api/contact').send(payload);

    // We expect 201 to trick the bot into thinking it succeeded
    expect(response.status).toBe(201);
    expect(response.body.message).toBe('MESSAGE_SENT_SUCCESSFULLY');

    // CRITICAL: Ensure it is NOT in the database
    const saved = await ContactMessage.findOne({ email: 'bot@spam.com' });
    expect(saved).toBeNull();
    
    // Ensure no emails were triggered
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('should fail with 400 if required fields are missing', async () => {
    const payload = {
      firstName: 'Khalil'
      // Missing subject, email, message, etc.
    };

    const response = await request(app).post('/api/contact').send(payload);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('MISSING_FIELDS');
  });
});