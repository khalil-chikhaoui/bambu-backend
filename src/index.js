/**
 * @fileoverview Main entry point for the Bambu Backend.
 */

import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import path from "path";

// Configs & Middlewares
import { connectDB } from "./config/db.js";
import { notFound, errorHandler } from "./middlewares/error.js";
import { swaggerDocs } from "./config/swagger.js";


////
import { getTransporter } from "./config/mail.js";

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


// --- Quick Email Test Endpoint ---
app.get("/test-email", async (req, res) => {
  try {
    const transporter = getTransporter();
    
    // Send the email
    const info = await transporter.sendMail({
      from: `"Bambu" <${process.env.SMTP_EMAIL}>`, // This MUST be your contact@bambu-services.com
      to: "chikhaouikhl@gmail.com",
      subject: "Test Email from Bambu Backend 🚀",
      text: "Hello! If you are reading this, your Google Workspace SMTP is working perfectly!",
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #231f70;">System Test Successful! 🎉</h2>
          <p>Your Node.js server is successfully communicating with Google Workspace.</p>
          <p>If you received this at chikhaouikhl@gmail.com, your SMTP credentials are correct!</p>
        </div>
      `,
    });

    console.log("Email sent: %s", info.messageId);
    
    res.status(200).json({
      status: "success",
      message: "Test email sent successfully to chikhaouikhl@gmail.com!",
      messageId: info.messageId,
    });
  } catch (error) {
    console.error("❌ Test email failed:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to send test email. Check server console.",
      error: error.message,
    });
  }
});

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
