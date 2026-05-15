// src/controllers/general.controller.js
import asyncHandler from "express-async-handler";
import ContactMessage from "../models/ContactMessage.js";
import { getTransporter, getContactTemplates } from "../config/mail.js";

export const createContactMessage = asyncHandler(async (req, res) => {
  const {
    subject,
    firstName,
    lastName,
    email,
    message,
    language,
    hp_address,
    phone,
    wantsPhoneMeeting,
  } = req.body;

  // Honeypot Check
  if (hp_address) {
    console.log("🤖 Bot detected via Honeypot.");
    return res
      .status(201)
      .json({ status: "success", message: "MESSAGE_SENT_SUCCESSFULLY" });
  }

  if (!subject || !firstName || !lastName || !email || !message) {
    res.status(400);
    throw new Error("MISSING_FIELDS");
  }

  // Save to Database
  const contactEntry = await ContactMessage.create({
    subject,
    firstName,
    lastName,
    email,
    message,
    phone: phone || "",
    wantsPhoneMeeting: !!wantsPhoneMeeting,
    language: language || "en",
  });

  // Respond to frontend
  res.status(201).json({
    status: "success",
    message: "MESSAGE_SENT_SUCCESSFULLY",
  });

  // Background Task: Send Emails
  (async () => {
    try {
      const transporter = getTransporter();
      const templates = getContactTemplates(contactEntry);

      await transporter.sendMail({
        from: `"Bambu System" <noreply@bambu-services.com>`,
        to: email,
        subject: templates.user.subject,
        html: templates.user.html,
      });

      // Admin notification
      await transporter.sendMail({
        from: `"Bambu System" <noreply@bambu-services.com>`,
        to: process.env.SMTP_EMAIL,
        subject: templates.admin.subject,
        html: templates.admin.html,
      });
    } catch (error) {
      console.log("❌ Background Email Task Failed:", error.message);
    }
  })();
});
