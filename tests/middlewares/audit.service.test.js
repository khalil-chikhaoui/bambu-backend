import { jest } from '@jest/globals'; // This fixes the 'jest is not defined' error
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { logAudit } from '../../src/middlewares/audit.service.js';
import AuditLog from '../../src/models/AuditLog.js';

describe('Audit Service Unit Tests', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await AuditLog.deleteMany({});
  });

  it('should create a complete audit log entry with metadata and diff', async () => {
    const mockData = {
      organizationId: new mongoose.Types.ObjectId(),
      actor: new mongoose.Types.ObjectId(),
      module: 'SETTINGS',
      action: 'ORG_ADDRESS_UPDATED',
      targetModel: 'Organization',
      targetId: new mongoose.Types.ObjectId(),
      metadata: { city: 'Passau' },
      diff: {
        before: { address: 'Old St' },
        after: { address: 'New St' }
      }
    };

    // Act
    await logAudit(mockData);

    // Assert
    const savedLog = await AuditLog.findOne({ organizationId: mockData.organizationId });
    
    expect(savedLog).not.toBeNull();
    expect(savedLog.module).toBe('SETTINGS');
    expect(savedLog.metadata.city).toBe('Passau');
    expect(savedLog.diff.after.address).toBe('New St');
    expect(savedLog.action).toBe('ORG_ADDRESS_UPDATED');
  });

  
});
