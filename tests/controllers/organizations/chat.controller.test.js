import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// 1. Mock Socket helpers
jest.unstable_mockModule("../../../src/config/socket.js", () => ({
  sendRealtimeMessage: jest.fn(),
  sendRealtimeNotification: jest.fn(),
  getIO: jest.fn(),
}));

const {
  getConversations,
  getMessages,
  createConversation,
  sendMessage,
} = await import("../../../src/controllers/chat.controller.js");

const { sendRealtimeMessage, sendRealtimeNotification } = await import(
  "../../../src/config/socket.js"
);

import Conversation from "../../../src/models/Conversation.js";
import Message from "../../../src/models/Message.js";
import User from "../../../src/models/User.js";

// ==========================================
// FAKE MIDDLEWARES FOR TESTING
// ==========================================
let testUserId;

const fakeProtect = (req, res, next) => {
  req.user = { _id: testUserId, firstName: "Khalil", lastName: "C" };
  next();
};

const app = express();
app.use(express.json());

app.get("/api/organizations/:orgId/chat", fakeProtect, getConversations);
app.post("/api/organizations/:orgId/chat", fakeProtect, createConversation);
app.get("/api/organizations/:orgId/chat/:convId/messages", fakeProtect, getMessages);
app.post("/api/organizations/:orgId/chat/:convId/messages", fakeProtect, sendMessage);

app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({ message: err.message });
});

describe("Chat Controller Integration Tests", () => {
  let mongoServer;
  let orgId;
  let recipientUser;

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
    const sender = await User.create({
      firstName: "Khalil",
      lastName: "C",
      email: "khalil@bambu.com",
      password: "password123",
    });
    testUserId = sender._id;

    recipientUser = await User.create({
      firstName: "Recipient",
      lastName: "User",
      email: "recipient@bambu.com",
      password: "password123",
    });
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    jest.clearAllMocks();
  });

  describe("POST /api/organizations/:orgId/chat", () => {
    it("should create a new conversation successfully", async () => {
      const response = await request(app)
        .post(`/api/organizations/${orgId}/chat`)
        .send({
          participantIds: [recipientUser._id.toString()],
        });

      expect(response.status).toBe(201);
      expect(response.body.participants).toHaveLength(2);
      expect(response.body.isGroup).toBe(false);
    });

    it("should return an existing conversation if one already exists for 1-to-1 DMs", async () => {
      // Pre-create conversation
      const existing = await Conversation.create({
        organizationId: orgId,
        participants: [testUserId, recipientUser._id],
        isGroup: false,
      });

      const response = await request(app)
        .post(`/api/organizations/${orgId}/chat`)
        .send({
          participantIds: [recipientUser._id.toString()],
        });

      expect(response.status).toBe(200);
      expect(response.body._id).toBe(existing._id.toString());
    });
  });

  describe("GET /api/organizations/:orgId/chat", () => {
    it("should return list of conversations for user", async () => {
      await Conversation.create({
        organizationId: orgId,
        participants: [testUserId, recipientUser._id],
        isGroup: false,
      });

      const response = await request(app).get(`/api/organizations/${orgId}/chat`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    });
  });

  describe("POST /api/organizations/:orgId/chat/:convId/messages", () => {
    it("should create a message, update lastMessage, and trigger socket events", async () => {
      const conv = await Conversation.create({
        organizationId: orgId,
        participants: [testUserId, recipientUser._id],
        isGroup: false,
      });

      const response = await request(app)
        .post(`/api/organizations/${orgId}/chat/${conv._id}/messages`)
        .send({ content: "Hello there" });

      expect(response.status).toBe(201);
      expect(response.body.content).toBe("Hello there");
      expect(response.body.sender._id).toBe(testUserId.toString());

      // Check DB Conversation update
      const updatedConv = await Conversation.findById(conv._id);
      expect(updatedConv.lastMessage.toString()).toBe(response.body._id);

      // Check socket mocks
      expect(sendRealtimeMessage).toHaveBeenCalled();
      expect(sendRealtimeNotification).toHaveBeenCalled();
    });
  });

  describe("GET /api/organizations/:orgId/chat/:convId/messages", () => {
    it("should retrieve messages for conversation in chronological order", async () => {
      const conv = await Conversation.create({
        organizationId: orgId,
        participants: [testUserId, recipientUser._id],
        isGroup: false,
      });

      await Message.create([
        { conversationId: conv._id, sender: testUserId, content: "First message" },
        { conversationId: conv._id, sender: recipientUser._id, content: "Second message" },
      ]);

      const response = await request(app).get(
        `/api/organizations/${orgId}/chat/${conv._id}/messages`
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].content).toBe("First message");
      expect(response.body[1].content).toBe("Second message");
    });
  });
});
