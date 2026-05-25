import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// 1. Mock the audit service BEFORE importing the controller
const logAuditMock = jest.fn().mockResolvedValue(true);
jest.unstable_mockModule('../../../src/middlewares/audit.service.js', () => ({
  logAudit: logAuditMock
}));

// 2. Import controller
const { 
  createTeam, 
  getTeams, 
  getTeamById, 
  updateTeam, 
  deleteTeam,
  addMembersToTeam,
  removeMemberFromTeam,
  leaveTeam,
  uploadTeamLogo,
  deleteTeamLogo
} = await import('../../../src/controllers/teams.controller.js');

import Team from '../../../src/models/Team.js';

const app = express();
app.use(express.json());

// Mock auth middleware to inject req.user
app.use((req, res, next) => {
  req.user = { _id: new mongoose.Types.ObjectId() };
  next();
});

// Mount routes manually for testing
app.post('/api/organizations/:orgId/teams', createTeam);
app.get('/api/organizations/:orgId/teams', getTeams);
app.get('/api/organizations/:orgId/teams/:teamId', getTeamById);
app.put('/api/organizations/:orgId/teams/:teamId', updateTeam);
app.delete('/api/organizations/:orgId/teams/:teamId', deleteTeam);
app.post('/api/organizations/:orgId/teams/:teamId/members', addMembersToTeam);
app.delete('/api/organizations/:orgId/teams/:teamId/members/:memberId', removeMemberFromTeam);
app.post('/api/organizations/:orgId/teams/:teamId/leave', leaveTeam);

// Mock multer middleware for testing upload
app.post('/api/organizations/:orgId/teams/:teamId/upload-logo', (req, res, next) => {
  req.file = { filename: 'test-logo.png', path: '/tmp/test-logo.png' };
  next();
}, uploadTeamLogo);

app.delete('/api/organizations/:orgId/teams/:teamId/logo', deleteTeamLogo);

// Error handler
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({ message: err.message });
});

describe('Teams Controller Integration Tests', () => {
  let mongoServer;
  let orgId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    orgId = new mongoose.Types.ObjectId().toString();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Team.deleteMany({});
    jest.clearAllMocks();
  });

  it('should create a team', async () => {
    const payload = {
      name: 'Engineering',
      description: 'Tech team'
    };

    const res = await request(app).post(`/api/organizations/${orgId}/teams`).send(payload);

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Engineering');
    
    // Verify db
    const saved = await Team.findOne({ name: 'Engineering', organizationId: orgId });
    expect(saved).not.toBeNull();
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: 'TEAM_CREATED' }));
  });

  it('should fail creating team if name is missing', async () => {
    const res = await request(app).post(`/api/organizations/${orgId}/teams`).send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('TEAM_NAME_REQUIRED');
  });
  
  it('should prevent duplicate team names in same org', async () => {
    await Team.create({ name: 'Engineering', organizationId: orgId });
    
    const res = await request(app).post(`/api/organizations/${orgId}/teams`).send({ name: 'Engineering' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('TEAM_ALREADY_EXISTS');
  });

  it('should add members to a team', async () => {
    const team = await Team.create({ name: 'QA', organizationId: orgId });
    const memberId = new mongoose.Types.ObjectId().toString();
    
    const res = await request(app).post(`/api/organizations/${orgId}/teams/${team._id}/members`).send({ memberIds: [memberId] });
    expect(res.status).toBe(200);
    
    const updated = await Team.findById(team._id);
    expect(updated.members.map(m => m.toString())).toContain(memberId);
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: 'TEAM_MEMBER_ADDED' }));
  });

  it('should upload a team logo', async () => {
    const team = await Team.create({ name: 'Design', organizationId: orgId });

    const res = await request(app).post(`/api/organizations/${orgId}/teams/${team._id}/upload-logo`);
    
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('LOGO_UPLOADED');
    expect(res.body.logo).toContain('test-logo.png');

    const updated = await Team.findById(team._id);
    expect(updated.logo).toContain('test-logo.png');
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: 'TEAM_LOGO_UPDATED' }));
  });

  it('should delete a team logo', async () => {
    const team = await Team.create({ name: 'Marketing', organizationId: orgId, logo: 'some-logo.png' });

    const res = await request(app).delete(`/api/organizations/${orgId}/teams/${team._id}/logo`);
    
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('LOGO_REMOVED');
    expect(res.body.logo).toBe('');

    const updated = await Team.findById(team._id);
    expect(updated.logo).toBe('');
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: 'TEAM_LOGO_DELETED' }));
  });
});
