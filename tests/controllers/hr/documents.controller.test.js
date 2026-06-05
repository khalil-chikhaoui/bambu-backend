import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { v2 as cloudinary } from 'cloudinary';

// 1. Mock Audit Logger (Must happen BEFORE importing the controller)
jest.unstable_mockModule('../../../src/middlewares/audit.service.js', () => ({
  logAudit: jest.fn(),
}));

// 2. Dynamic Imports (Must happen AFTER mocking)
const { 
  getEmployeeDocuments, 
  confirmDocument, 
  deleteDocument 
} = await import('../../../src/controllers/hr/documents.controller.js');
const { logAudit } = await import('../../../src/middlewares/audit.service.js');

import HRDocument from '../../../src/models/hr/HRDocument.js';
import User from '../../../src/models/User.js';

// ==========================================
// FAKE MIDDLEWARES FOR TESTING
// ==========================================
let testUserId; 

// 1. Fake Auth Middleware
const fakeProtect = (req, res, next) => {
  req.user = { _id: testUserId };
  next();
};

// ==========================================
// EXPRESS APP SETUP
// ==========================================
const app = express();
app.use(express.json());

// Mount the routes with fake middlewares
app.get('/api/organizations/:orgId/hr/employees/:employeeId/documents', fakeProtect, getEmployeeDocuments);
app.post('/api/organizations/:orgId/hr/employees/:employeeId/documents/confirm', fakeProtect, confirmDocument);
app.delete('/api/organizations/:orgId/hr/employees/:employeeId/documents/:documentId', fakeProtect, deleteDocument);

// Global Error Handler 
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({ message: err.message });
});

// ==========================================
// TEST SUITE
// ==========================================
describe('HR Documents Controller Integration Tests', () => {
  let mongoServer;
  let testOrganizationId;
  let testEmployeeId;

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

  // Seed data before EACH test
  beforeEach(async () => {
    testOrganizationId = new mongoose.Types.ObjectId();
    testEmployeeId = new mongoose.Types.ObjectId();

    // Create a User to act as the "uploadedBy"
    const user = await User.create({
      firstName: 'Admin',
      lastName: 'HR',
      email: 'hr@bambu.com',
      password: 'Password123!',
    });
    
    testUserId = user._id;

    // Mock Cloudinary destroy function
    jest.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' });
  });

  // Cleanup after EACH test
  afterEach(async () => {
    await User.deleteMany({});
    await HRDocument.deleteMany({});
    jest.clearAllMocks();
  });

  // ------------------------------------------
  // GET /api/organizations/:orgId/hr/employees/:employeeId/documents
  // ------------------------------------------
  describe('GET Employee Documents', () => {
    it('should return a list of documents for a specific employee sorted by newest', async () => {
      await HRDocument.create([
        {
          employeeRecordId: testEmployeeId,
          organizationId: testOrganizationId,
          uploadedBy: testUserId,
          title: 'Old Contract',
          type: 'CONTRAT_SIGNE',
          fileUrl: 'https://res.cloudinary.com/test-cloud/raw/upload/old.pdf',
          filePublicId: 'old-doc-id',
          createdAt: new Date('2023-01-01')
        },
        {
          employeeRecordId: testEmployeeId,
          organizationId: testOrganizationId,
          uploadedBy: testUserId,
          title: 'New Contract',
          type: 'CONTRAT_SIGNE',
          fileUrl: 'https://res.cloudinary.com/test-cloud/raw/upload/new.pdf',
          filePublicId: 'new-doc-id',
          createdAt: new Date('2024-01-01')
        }
      ]);

      const response = await request(app)
        .get(`/api/organizations/${testOrganizationId}/hr/employees/${testEmployeeId}/documents`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].title).toBe('New Contract');
      expect(response.body[1].title).toBe('Old Contract');
      expect(response.body[0].uploadedBy.firstName).toBe('Admin');
    });

    it('should return an empty array if employee has no documents', async () => {
      const response = await request(app)
        .get(`/api/organizations/${testOrganizationId}/hr/employees/${testEmployeeId}/documents`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  // ------------------------------------------
  // POST /api/organizations/:orgId/hr/employees/:employeeId/documents/confirm
  // ------------------------------------------
  describe('POST Confirm Document', () => {
    it('should confirm a document successfully and trigger audit log', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 5);

      const response = await request(app)
        .post(`/api/organizations/${testOrganizationId}/hr/employees/${testEmployeeId}/documents/confirm`)
        .send({
          title: 'Identity Card',
          description: 'Valid until 2029',
          type: 'PIECE_IDENTITE',
          expirationDate: futureDate.toISOString(),
          secureUrl: 'https://res.cloudinary.com/test-cloud/image/upload/id-card.jpg',
          publicId: 'id-card-public-id'
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Identity Card');
      expect(response.body.fileUrl).toBe('https://res.cloudinary.com/test-cloud/image/upload/id-card.jpg');
      expect(response.body.filePublicId).toBe('id-card-public-id');

      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
        organizationId: testOrganizationId.toString(),
        actor: testUserId,
        module: 'HR',
        action: 'HR_DOCUMENT_UPLOADED',
        targetModel: 'EmployeeRecord',
        targetId: testEmployeeId.toString(),
      }));
    });

    it('should fail if secureUrl is missing', async () => {
      const response = await request(app)
        .post(`/api/organizations/${testOrganizationId}/hr/employees/${testEmployeeId}/documents/confirm`)
        .send({ title: 'Missing File Doc', type: 'RIB', publicId: 'some-id' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('UPLOAD_MISSING_DATA');
    });
  });

  // ------------------------------------------
  // DELETE /api/organizations/:orgId/hr/employees/:employeeId/documents/:documentId
  // ------------------------------------------
  describe('DELETE HR Document', () => {
    it('should delete a document, remove the Cloudinary file, and log the audit', async () => {
      const doc = await HRDocument.create({
        employeeRecordId: testEmployeeId,
        organizationId: testOrganizationId,
        uploadedBy: testUserId,
        title: 'Old Medical Certificate',
        type: 'VISITE_MEDICALE',
        fileUrl: 'https://res.cloudinary.com/test-cloud/raw/upload/medical-2023.pdf',
        filePublicId: 'medical-2023-public-id'
      });

      const response = await request(app)
        .delete(`/api/organizations/${testOrganizationId}/hr/employees/${testEmployeeId}/documents/${doc._id}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('DOCUMENT_DELETED');

      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('medical-2023-public-id', { resource_type: 'raw' });

      const deletedDoc = await HRDocument.findById(doc._id);
      expect(deletedDoc).toBeNull();

      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
        action: 'HR_DOCUMENT_DELETED',
        targetModel: 'EmployeeRecord',
        targetId: testEmployeeId.toString(),
      }));
    });

    it('should return a 404 if the document does not exist', async () => {
      const fakeDocId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/organizations/${testOrganizationId}/hr/employees/${testEmployeeId}/documents/${fakeDocId}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('DOCUMENT_NOT_FOUND');
    });
  });
});