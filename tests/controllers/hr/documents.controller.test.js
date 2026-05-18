import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'fs';

// 1. Mock Audit Logger (Must happen BEFORE importing the controller)
jest.unstable_mockModule('../../../src/middlewares/audit.service.js', () => ({
  logAudit: jest.fn(),
}));

// 2. Dynamic Imports (Must happen AFTER mocking)
const { 
  getEmployeeDocuments, 
  uploadDocument, 
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

// 2. Fake Multer Middleware 
const fakeUpload = (req, res, next) => {
  if (req.headers['x-no-file']) {
    return next();
  }
  
  req.file = {
    filename: 'test-hr-doc-123.pdf',
    path: '/fake/temp/path/test-hr-doc-123.pdf'
  };
  next();
};

// ==========================================
// EXPRESS APP SETUP
// ==========================================
const app = express();
app.use(express.json());

// Mount the routes with fake middlewares
app.get('/api/organizations/:orgId/hr/employees/:employeeId/documents', fakeProtect, getEmployeeDocuments);
app.post('/api/organizations/:orgId/hr/employees/:employeeId/documents', fakeProtect, fakeUpload, uploadDocument);
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

    // Spy on fs to prevent actual file deletions during tests
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
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
          fileUrl: 'http://localhost:5000/api/images/hr/old.pdf',
          createdAt: new Date('2023-01-01')
        },
        {
          employeeRecordId: testEmployeeId,
          organizationId: testOrganizationId,
          uploadedBy: testUserId,
          title: 'New Contract',
          type: 'CONTRAT_SIGNE',
          fileUrl: 'http://localhost:5000/api/images/hr/new.pdf',
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
  // POST /api/organizations/:orgId/hr/employees/:employeeId/documents
  // ------------------------------------------
  describe('POST Upload Document', () => {
    it('should upload a document successfully and trigger audit log', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 5);

      const response = await request(app)
        .post(`/api/organizations/${testOrganizationId}/hr/employees/${testEmployeeId}/documents`)
        .send({
          title: 'Identity Card',
          description: 'Valid until 2029',
          type: 'PIECE_IDENTITE',
          expirationDate: futureDate.toISOString()
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Identity Card');
      expect(response.body.fileUrl).toBe('http://localhost:5000/api/images/hr/test-hr-doc-123.pdf');

      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
        organizationId: testOrganizationId.toString(),
        actor: testUserId,
        module: 'HR',
        action: 'HR_DOCUMENT_UPLOADED',
        targetModel: 'EmployeeRecord',
        targetId: testEmployeeId.toString(),
      }));
    });

    it('should fail if no file is provided', async () => {
      const response = await request(app)
        .post(`/api/organizations/${testOrganizationId}/hr/employees/${testEmployeeId}/documents`)
        .set('x-no-file', 'true') 
        .send({ title: 'Missing File Doc', type: 'RIB' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('UPLOAD_NO_FILE');
    });
  });

  // ------------------------------------------
  // DELETE /api/organizations/:orgId/hr/employees/:employeeId/documents/:documentId
  // ------------------------------------------
  describe('DELETE HR Document', () => {
    it('should delete a document, remove the physical file, and log the audit', async () => {
      const doc = await HRDocument.create({
        employeeRecordId: testEmployeeId,
        organizationId: testOrganizationId,
        uploadedBy: testUserId,
        title: 'Old Medical Certificate',
        type: 'VISITE_MEDICALE',
        fileUrl: 'http://localhost:5000/api/images/hr/medical-2023.pdf'
      });

      const response = await request(app)
        .delete(`/api/organizations/${testOrganizationId}/hr/employees/${testEmployeeId}/documents/${doc._id}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('DOCUMENT_DELETED');

      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.unlinkSync).toHaveBeenCalled();

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