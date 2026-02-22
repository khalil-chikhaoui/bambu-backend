import nodemailer from "nodemailer";

export const getTransporter = () => {
  return nodemailer.createTransport({
    host: "smtp.zoho.eu",
    port: 587,         
    secure: false,    
    auth: {
      user: process.env.ZOHO_EMAIL,
      pass: process.env.ZOHO_PASSWORD,
    },
    // Optional but recommended for port 587
    tls: {
      ciphers: 'SSLv3'
    }
  });
};