import nodemailer from "nodemailer";

export const getTransporter = () => {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,         
    secure: false, // true for 465, false for other ports (587)
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });
};