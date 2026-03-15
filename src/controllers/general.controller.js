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
    wantsPhoneMeeting 
  } = req.body;

  // 1. Honeypot check
  if (hp_address) {
    console.log("🤖 Bot detected via Honeypot.");
    return res.status(201).json({ status: "success", message: "MESSAGE_SENT_SUCCESSFULLY" });
  }

  if (!subject || !firstName || !lastName || !email || !message) {
    res.status(400);
    throw new Error("MISSING_FIELDS");
  }

  // 2. Save to Database
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

  // 3. Respond to frontend
  res.status(201).json({
    status: "success",
    message: "MESSAGE_SENT_SUCCESSFULLY",
  });

  // 4. Background Task: Send Emails
  (async () => {
    try {
      const transporter = getTransporter(); 
      const templates = getContactTemplates(contactEntry);

      // User receipt
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
      console.error("❌ Background Email Task Failed:", error.message);
    }
  })();
});