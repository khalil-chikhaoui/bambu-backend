import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'fs';

// 1. Mock Audit Service - FIXED PATH (3 levels up to reach src)
jest.unstable_mockModule('../../../src/middlewares/audit.service.js', () => ({
  logAudit: jest.fn(),
}));

// FIXED PATHS for imports
const { uploadOrganizationLogo, deleteOrganizationLogo } = await import('../../../src/controllers/organizations/branding.controller.js');
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

const fakeUpload = (req, res, next) => {
  req.file = {
    filename: 'new-logo.png',
    path: '/fake/path/new-logo.png'
  };
  next();
};

app.post('/api/organizations/:id/logo', fakeAuth, fakeUpload, uploadOrganizationLogo);
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
    
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
  });

  afterEach(async () => {
    await Organization.deleteMany({});
    jest.clearAllMocks();
  });

  describe('POST /api/organizations/:id/logo', () => {
    it('should upload a logo and log the audit event', async () => {
      const response = await request(app)
        .post(`/api/organizations/${testOrg._id}/logo`);

      expect(response.status).toBe(200);
      expect(response.body.logo).toContain('new-logo.png');

      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
        action: 'ORG_LOGO_UPLOADED',
        module: 'SETTINGS',
        organizationId: testOrg._id
      }));
    });

    it('should delete the old logo file if a new one is uploaded', async () => {
      await Organization.findByIdAndUpdate(testOrg._id, { 
        logo: 'http://localhost:5000/api/images/organizations/old-logo.png' 
      });

      await request(app).post(`/api/organizations/${testOrg._id}/logo`);
      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('should fail if organization does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app).post(`/api/organizations/${fakeId}/logo`);

      expect(response.status).toBe(404);
      expect(fs.unlinkSync).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/organizations/:id/logo', () => {
    it('should remove logo and log the event', async () => {
      await Organization.findByIdAndUpdate(testOrg._id, { 
        logo: 'http://localhost:5000/api/images/organizations/to-delete.png' 
      });

      const response = await request(app).delete(`/api/organizations/${testOrg._id}/logo`);

      expect(response.status).toBe(200);
      expect(response.body.logo).toBe('');
      expect(fs.unlinkSync).toHaveBeenCalled();
      
      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
        action: 'ORG_LOGO_DELETED'
      }));
    });
  });
});