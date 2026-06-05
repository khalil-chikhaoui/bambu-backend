import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { v2 as cloudinary } from 'cloudinary';

// 1. Mock Audit Service
jest.unstable_mockModule('../../../src/middlewares/audit.service.js', () => ({
  logAudit: jest.fn(),
}));

const { confirmOrganizationLogo, deleteOrganizationLogo } = await import('../../../src/controllers/organizations/branding.controller.js');
const { logAudit } = await import('../../../src/middlewares/audit.service.js');
import Organization from '../../../src/models/Organization.js';

// Setup Fake App
const app = express();
app.use(express.json());

const testUserId = new mongoose.Types.ObjectId();
const fakeAuth = (req, res, next) => {
  req.user = { _id: testUserId };
  next();
};

app.post('/api/organizations/:id/logo/confirm', fakeAuth, confirmOrganizationLogo);
app.delete('/api/organizations/:id/logo', fakeAuth, deleteOrganizationLogo);

app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({ message: err.message });
});

describe('Organization Branding Controller Tests', () => {
  let mongoServer;
  let testOrg;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    process.env.BACKEND_URL = 'http://localhost:5000';
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    testOrg = await Organization.create({
      name: 'Bambu Branding Test',
      maxMembers: 5
    });
    
    // Mock Cloudinary destroy function
    jest.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' });
  });

  afterEach(async () => {
    await Organization.deleteMany({});
    jest.clearAllMocks();
  });

  describe('POST /api/organizations/:id/logo/confirm', () => {
    it('should confirm a logo and log the audit event', async () => {
      const response = await request(app)
        .post(`/api/organizations/${testOrg._id}/logo/confirm`)
        .send({
          secureUrl: 'https://res.cloudinary.com/test-cloud/image/upload/logo.png',
          publicId: 'logo-public-id'
        });

      expect(response.status).toBe(200);
      expect(response.body.logo).toBe('https://res.cloudinary.com/test-cloud/image/upload/logo.png');

      const updatedOrg = await Organization.findById(testOrg._id);
      expect(updatedOrg.logoPublicId).toBe('logo-public-id');

      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
        action: 'ORG_LOGO_UPLOADED',
        module: 'SETTINGS',
        organizationId: testOrg._id
      }));
    });

    it('should delete the old logo from Cloudinary if a new one is confirmed', async () => {
      await Organization.findByIdAndUpdate(testOrg._id, { 
        logo: 'https://res.cloudinary.com/test-cloud/image/upload/old.png',
        logoPublicId: 'old-logo-public-id'
      });

      await request(app)
        .post(`/api/organizations/${testOrg._id}/logo/confirm`)
        .send({
          secureUrl: 'https://res.cloudinary.com/test-cloud/image/upload/new.png',
          publicId: 'new-logo-public-id'
        });

      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('old-logo-public-id');
    });

    it('should fail if organization does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/organizations/${fakeId}/logo/confirm`)
        .send({
          secureUrl: 'https://res.cloudinary.com/test-cloud/image/upload/logo.png',
          publicId: 'logo-public-id'
        });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/organizations/:id/logo', () => {
    it('should remove logo from Cloudinary and log the event', async () => {
      await Organization.findByIdAndUpdate(testOrg._id, { 
        logo: 'https://res.cloudinary.com/test-cloud/image/upload/logo.png',
        logoPublicId: 'logo-public-id'
      });

      const response = await request(app).delete(`/api/organizations/${testOrg._id}/logo`);

      expect(response.status).toBe(200);
      expect(response.body.logo).toBe('');
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('logo-public-id');
      
      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
        action: 'ORG_LOGO_DELETED'
      }));
    });
  });
});