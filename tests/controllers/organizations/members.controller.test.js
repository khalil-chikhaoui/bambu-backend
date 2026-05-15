import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// 1. Mock Mail & Audit (3 levels up)
const sendMailMock = jest.fn().mockResolvedValue(true);
jest.unstable_mockModule('../../../src/config/mail.js', () => ({
  getTransporter: jest.fn().mockReturnValue({ sendMail: sendMailMock }),
}));
jest.unstable_mockModule('../../../src/middlewares/audit.service.js', () => ({
  logAudit: jest.fn(),
}));

const { 
  inviteMember, 
  getOrganizationMembers, 
  updateMemberRole, 
  removeMember, 
  leaveOrganization 
} = await import('../../../src/controllers/organizations/members.controller.js');

const { logAudit } = await import('../../../src/middlewares/audit.service.js');
import User from '../../../src/models/User.js';
import Organization from '../../../src/models/Organization.js';
import Invitation from '../../../src/models/Invitation.js';

const app = express();
app.use(express.json());

const testUserId = new mongoose.Types.ObjectId();
const fakeAuth = (req, res, next) => {
  req.user = { _id: testUserId, firstName: 'Admin', lastName: 'User' };
  next();
};

app.post('/api/organizations/:id/invite', fakeAuth, inviteMember);
app.get('/api/organizations/:id/members', getOrganizationMembers);
app.put('/api/organizations/:id/members/:memberId', fakeAuth, updateMemberRole);
app.delete('/api/organizations/:id/members/:memberId', fakeAuth, removeMember);
app.post('/api/organizations/:id/leave', fakeAuth, leaveOrganization);

app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({ message: err.message });
});

describe('Organization Members Controller Tests', () => {
  let mongoServer;
  let testOrg;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    testOrg = await Organization.create({ name: 'Bambu Team', maxMembers: 3 });
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Organization.deleteMany({});
    await Invitation.deleteMany({});
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------
  // INVITE MEMBER
  // ---------------------------------------------------------
  describe('POST /invite', () => {
    it('should create a pending invitation and send an email', async () => {
      const response = await request(app)
        .post(`/api/organizations/${testOrg._id}/invite`)
        .send({
          email: 'new@bambu.com',
          firstName: 'New',
          lastName: 'Member',
          role: 'employee'
        });

      expect(response.status).toBe(200);
      const invite = await Invitation.findOne({ email: 'new@bambu.com' });
      expect(invite).not.toBeNull();
      expect(sendMailMock).toHaveBeenCalled();
      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'INVITE_SENT' }));
    });

    it('should block invitation if max members (active + pending) reached', async () => {
        // Org max is 3. Let's add 2 users and 1 invite.
        await User.create({ firstName: 'U1', lastName: 'L', email: '1@a.com', password: 'p', memberships: [{ organizationId: testOrg._id }] });
        await User.create({ firstName: 'U2', lastName: 'L', email: '2@a.com', password: 'p', memberships: [{ organizationId: testOrg._id }] });
        await Invitation.create({ firstName: 'P', lastName: 'I', email: 'p@i.com', token: 't', organizationId: testOrg._id });

        const response = await request(app)
          .post(`/api/organizations/${testOrg._id}/invite`)
          .send({ email: 'overflow@bambu.com', firstName: 'Too', lastName: 'Many' });

        expect(response.status).toBe(403);
        expect(response.body.message).toBe('ORG_MAX_MEMBERS_EXCEEDED');
    });
  });

  // ---------------------------------------------------------
  // REMOVE MEMBER / CANCEL INVITE
  // ---------------------------------------------------------
  describe('DELETE /members/:memberId', () => {
    it('should cancel a pending invitation', async () => {
      const invite = await Invitation.create({ firstName: 'T', lastName: 'D', email: 'd@b.com', token: 't', organizationId: testOrg._id });
      
      const response = await request(app).delete(`/api/organizations/${testOrg._id}/members/${invite._id}`);
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('INVITATION_CANCELLED');
    });

    it('should remove an active member from the organization', async () => {
      const user = await User.create({
        firstName: 'Khalil', lastName: 'C', email: 'k@b.com', password: 'p',
        memberships: [{ organizationId: testOrg._id, role: 'employee' }]
      });

      const response = await request(app).delete(`/api/organizations/${testOrg._id}/members/${user._id}`);
      
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.memberships).toHaveLength(0);
    });
  });

 // ---------------------------------------------------------
  // LEAVE ORGANIZATION (LAST ADMIN CHECK)
  // ---------------------------------------------------------
  describe('POST /leave', () => {
    it('should prevent the last admin from leaving', async () => {
      // 1. Create the user with the EXACT ID used in fakeAuth
      // and the EXACT membership structure the controller expects
      await User.create({
        _id: testUserId, 
        firstName: 'Last', 
        lastName: 'Admin', 
        email: 'admin@bambu.com', 
        password: 'password123',
        memberships: [{ 
          organizationId: testOrg._id, 
          role: 'admin',
          title: 'Owner'
        }]
      });

      // 2. Act
      const response = await request(app)
        .post(`/api/organizations/${testOrg._id}/leave`);

      // 3. Assert
      // If there are no OTHER admins, this should be 400
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('CANNOT_LEAVE_AS_LAST_ADMIN');
    });

    it('should allow leaving if there is another admin', async () => {
        // Create current user (Admin)
        await User.create({
          _id: testUserId, 
          firstName: 'Leaver', 
          lastName: 'User', 
          email: 'leaver@bambu.com', 
          password: 'p',
          memberships: [{ organizationId: testOrg._id, role: 'admin' }]
        });

        // Create ANOTHER admin
        await User.create({
          firstName: 'Stay', 
          lastName: 'Admin', 
          email: 'stay@bambu.com', 
          password: 'p',
          memberships: [{ organizationId: testOrg._id, role: 'admin' }]
        });

        const response = await request(app)
          .post(`/api/organizations/${testOrg._id}/leave`);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('LEFT_ORG');
    });
  });
});