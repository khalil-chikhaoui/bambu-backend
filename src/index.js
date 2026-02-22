/**
 * @fileoverview Main entry point for the Invotrack Backend.
 */

import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import path from "path";

// Configs & Middlewares
import { connectDB } from "./config/db.js";
import { notFound, errorHandler } from "./middlewares/error.js";
import { swaggerDocs } from "./config/swagger.js";

const envFile =
  process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// Models
import "./models/User.js";

// Routes
import userRoutes from "./routes/users.routes.js";

const app = express();

// --- Middlewares ---
// CRITICAL: Once your frontend is live, change origin: "*"
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public Health Check Endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Bambu API is up and running!",
    uptime: process.uptime(), // Shows how many seconds the server has been alive
    timestamp: new Date().toISOString(),
  });
});

// --- API Routes ---
app.use("/api/users", userRoutes);

// --- Swagger ---
const PORT = process.env.PORT || 3040;
swaggerDocs(app, PORT);

// --- Error Handling ---
app.use(notFound);
app.use(errorHandler);

export default app;

// --- Server Startup ---
const startApp = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined in your .env file");
    }
    await connectDB(process.env.MONGODB_URI);
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on Port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
};

startApp();
