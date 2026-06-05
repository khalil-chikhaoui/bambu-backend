// src/config/socket.js
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

let io = null;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    },
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error("Authentication error: Token missing"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }

      socket.user = user;
      next();
    } catch (error) {
      return next(new Error("Authentication error: Token invalid"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();
    console.log(`🔌 Client connected: ${socket.user.firstName} (Socket ID: ${socket.id})`);

    // Join user's personal private room
    socket.join(`user_${userId}`);

    // Handle joining organization room
    socket.on("join_organization", (orgId) => {
      if (!orgId) return;
      // Leave any existing organization rooms
      for (const room of socket.rooms) {
        if (room.startsWith("org_") && room !== `org_${orgId}`) {
          socket.leave(room);
        }
      }
      socket.join(`org_${orgId}`);
      console.log(`🏢 Socket ${socket.id} joined org_${orgId}`);
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

// Dispatch a real-time message to all online recipients
export const sendRealtimeMessage = (recipientIds, message) => {
  if (!io) return;
  recipientIds.forEach((recipientId) => {
    io.to(`user_${recipientId.toString()}`).emit("message_received", message);
  });
};
