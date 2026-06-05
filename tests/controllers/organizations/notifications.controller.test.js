import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

const {
  getNotifications,
  markAsRead,
  markAllAsRead,
} = await import("../../../src/controllers/notifications.controller.js");

import Notification from "../../../src/models/chat/Notification.js";
import User from "../../../src/models/User.js";

// ==========================================
// FAKE MIDDLEWARES FOR TESTING
// ==========================================
let testUserId;

const fakeProtect = (req, res, next) => {
  req.user = { _id: testUserId };
  next();
};

const app = express();
app.use(express.json());

app.get("/api/notifications", fakeProtect, getNotifications);
app.patch("/api/notifications/read-all", fakeProtect, markAllAsRead);
app.patch("/api/notifications/:id/read", fakeProtect, markAsRead);

app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({ message: err.message });
});

describe("Notifications Controller Integration Tests", () => {
  let mongoServer;
  let orgId;
  let senderUser;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    orgId = new mongoose.Types.ObjectId();
    const recipient = await User.create({
      firstName: "Recipient",
      lastName: "User",
      email: "recipient@bambu.com",
      password: "password123",
    });
    testUserId = recipient._id;

    senderUser = await User.create({
      firstName: "Sender",
      lastName: "User",
      email: "sender@bambu.com",
      password: "password123",
    });
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Notification.deleteMany({});
  });

  describe("GET /api/notifications", () => {
    it("should fetch all user notifications", async () => {
      await Notification.create([
        {
          recipient: testUserId,
          sender: senderUser._id,
          organizationId: orgId,
          type: "SYSTEM",
          title: "Alert",
          content: "System update",
        },
      ]);

      const response = await request(app).get("/api/notifications");

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe("Alert");
    });

    it("should filter notifications by organizationId if provided", async () => {
      const otherOrgId = new mongoose.Types.ObjectId();

      await Notification.create([
        {
          recipient: testUserId,
          sender: senderUser._id,
          organizationId: orgId,
          type: "SYSTEM",
          title: "Org Alert",
          content: "System update",
        },
        {
          recipient: testUserId,
          sender: senderUser._id,
          organizationId: otherOrgId,
          type: "SYSTEM",
          title: "Other Org Alert",
          content: "System update",
        },
      ]);

      const response = await request(app)
        .get("/api/notifications")
        .query({ orgId: orgId.toString() });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe("Org Alert");
    });
  });

  describe("PATCH /api/notifications/:id/read", () => {
    it("should mark a single notification as read", async () => {
      const notif = await Notification.create({
        recipient: testUserId,
        sender: senderUser._id,
        organizationId: orgId,
        type: "SYSTEM",
        title: "Alert",
        content: "System update",
        isRead: false,
      });

      const response = await request(app).patch(`/api/notifications/${notif._id}/read`);

      expect(response.status).toBe(200);
      expect(response.body.isRead).toBe(true);

      const dbNotif = await Notification.findById(notif._id);
      expect(dbNotif.isRead).toBe(true);
    });
  });

  describe("PATCH /api/notifications/read-all", () => {
    it("should mark all user notifications as read in organization", async () => {
      await Notification.create([
        {
          recipient: testUserId,
          sender: senderUser._id,
          organizationId: orgId,
          type: "SYSTEM",
          title: "Alert 1",
          content: "System update",
          isRead: false,
        },
        {
          recipient: testUserId,
          sender: senderUser._id,
          organizationId: orgId,
          type: "SYSTEM",
          title: "Alert 2",
          content: "System update",
          isRead: false,
        },
      ]);

      const response = await request(app)
        .patch("/api/notifications/read-all")
        .send({ orgId: orgId.toString() });

      expect(response.status).toBe(200);

      const unreadCount = await Notification.countDocuments({
        recipient: testUserId,
        isRead: false,
      });
      expect(unreadCount).toBe(0);
    });
  });
});
