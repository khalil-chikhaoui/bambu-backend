import asyncHandler from "express-async-handler";
import ContactMessage from "../models/ContactMessage.js";
import { getTransporter, getContactTemplates } from "../config/mail.js";

export const createContactMessage = asyncHandler(async (req, res) => {
  const { subject, firstName, lastName, email, message, language, hp_address } = req.body;

  // 1. Honeypot check
  if (hp_address) {
    console.log("🤖 Bot detected via Honeypot. Ignoring request.");
    return res.status(201).json({ status: "success", message: "MESSAGE_SENT_SUCCESSFULLY" });
  }

  if (!subject || !firstName || !lastName || !email || !message) {
    res.status(400);
    throw new Error("MISSING_FIELDS");
  }

  // 2. Save to Database (We wait for this so data is secure)
  const contactEntry = await ContactMessage.create({
    subject,
    firstName,
    lastName,
    email,
    message,
    language: language || "en",
  });

  // 3. Respond to frontend IMMEDIATELY (Fast UX!)
  res.status(201).json({
    status: "success",
    message: "MESSAGE_SENT_SUCCESSFULLY",
  });

  // 4. Background Task: Send Emails SEQUENTIALLY
  // We wrap this in a self-executing async function and DO NOT await it.
  // It runs in the background while the user is already looking at the success screen.
  (async () => {
    try {
      const transporter = getTransporter(); 
      const templates = getContactTemplates(contactEntry);

      console.log(`⏳ Background: Sending receipt to user: ${email}...`);
      await transporter.sendMail({
        from: `"Bambu System" <noreply@bambu-services.com>`, 
        to: email,
        subject: templates.user.subject,
        html: templates.user.html,
      });
      console.log("✅ Background: User receipt sent.");

      console.log("⏳ Background: Sending notification to admin...");
      await transporter.sendMail({
        from: `"Bambu System" <noreply@bambu-services.com>`, 
        to: process.env.SMTP_EMAIL, 
        subject: templates.admin.subject,
        html: templates.admin.html,
      });
      console.log("✅ Background: Admin notification sent.");

    } catch (error) {
      console.error("❌ Background Email Task Failed:", error.message);
    }
  })();
});