/**
 * @fileoverview User Controller
 * Handles user authentication, profile management, password recovery, 
 * and avatar assets.
 */

import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { generateToken } from "../middlewares/auth.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getTransporter } from "../config/mail.js";
import crypto from "crypto"; // Native Node module for random codes

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



/**
 * @desc    Authenticate user & get token
 * @route   POST /api/users/signin
 * @access  Public
 */
export const signIn = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).populate("memberships.businessId");

  if (user && (await user.matchPassword(password))) {
    
    // --- CHECK VERIFICATION STATUS ---
    if (!user.isVerified) {
      res.status(403);
      // PRO FIX: Throw a CODE, not a sentence
      throw new Error("AUTH_NOT_VERIFIED"); 
    }
    // ---------------------------------

    const token = generateToken(user._id);
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.verificationCode;

    res.json({
      user: userResponse,
      token: token,
    });
  } else {
    res.status(401);
    // PRO FIX: Throw a CODE
    throw new Error("AUTH_INVALID_CREDENTIALS");
  }
});

/**
 * @desc    Send password reset email 
 * @route   POST /api/users/forgot-password
 * @access  Public
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    // Security Best Practice: Don't confirm or deny account existence
    // We return success so the frontend shows the "Check Email" modal regardless
    return res.status(200).json({ message: "RESET_LINK_SENT" });
  }

  // Generate a short-lived (15 min) reset token
  const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  try {    
    const transporter = getTransporter(); 
    
    await transporter.sendMail({
      from: "InvoTrack <no.reply@invotrack.de>", 
      to: email, 
      subject: "Reset your Password",
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333; line-height: 1.6;">
          <h2>Password Reset Request</h2>
          <p>We received a request to reset your password. Click the button below to proceed. This link is valid for 15 minutes.</p>
          <div style="margin: 20px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: #231f70; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Reset Password</a>
          </div>
          <p>If you did not request this, please ignore this email.</p>
        </div>
      `,
    }); 

    res.status(200).json({ message: "RESET_LINK_SENT" });
  } catch (err) {
    res.status(500);
    // PRO FIX: Throw a CODE
    throw new Error("EMAIL_SEND_FAILED");
  }
});

/**
 * @desc    Register a new user (Direct Signup)
 * @route   POST /api/users/signup
 * @access  Public
 */
export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, language } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("AUTH_MISSING_FIELDS"); 
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("AUTH_USER_EXISTS"); 
  }

  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  
  const user = await User.create({
    name,
    email,
    password,
    language: language || "en", 
    memberships: [],
    isVerified: false,
    verificationCode: verificationCode,
    verificationCodeExpires: Date.now() + 15 * 60 * 1000, 
  });

  if (user) {
    try {
      const transporter = getTransporter();
      
      await transporter.sendMail({
        from: "InvoTrack <no.reply@invotrack.de>",
        to: email,
        subject: "Verify your email address",
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2>Welcome to InvoTrack, ${name}!</h2>
            <p>Thank you for signing up. Please use the verification code below to activate your account:</p>
            
            <div style="background-color: #f4f4f4; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <h1 style="color: #231f70; letter-spacing: 5px; margin: 0;">${verificationCode}</h1>
            </div>

            <p>This code expires in 15 minutes.</p>
            <p>If you did not request this, please ignore this email.</p>
          </div>
        `,
      });

    } catch (error) {
      //  We log the error but don't stop the response because the user is created.
      // They can request a resend later if the email fails.
      console.error("Email send failed:", error);
    }

    res.status(201).json({
      message: "Registration successful",
      email: user.email 
    });
  } else {
    res.status(400);
    throw new Error("AUTH_INVALID_DATA"); 
  }
});


/**
 * @desc    Verify email with code
 * @route   POST /api/users/verify-email
 * @access  Public
 */
export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, code } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    res.status(404);
    // PRO FIX: Error Code
    throw new Error("AUTH_USER_NOT_FOUND");
  }

  if (user.isVerified) {
    // This is technically a success state (idempotent), but we return a message
    return res.status(200).json({ message: "EMAIL_ALREADY_VERIFIED" });
  }

  // Check code validity
  if (user.verificationCode !== code || user.verificationCodeExpires < Date.now()) {
    res.status(400);
    // PRO FIX: Error Code
    throw new Error("AUTH_INVALID_CODE");
  }

  // Verify User
  user.isVerified = true;
  user.verificationCode = undefined;
  user.verificationCodeExpires = undefined;
  await user.save();

  // Auto-login user after verification
  const token = generateToken(user._id);
  const userResponse = user.toObject();
  delete userResponse.password;

  res.status(200).json({
    message: "Email verified successfully",
    user: userResponse,
    token: token
  });
});


/**
 * @desc    Resend verification code
 * @route   POST /api/users/resend-verification
 * @access  Public
 */
export const resendVerificationCode = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    res.status(404);
    // PRO FIX: Error Code
    throw new Error("AUTH_USER_NOT_FOUND");
  }

  if (user.isVerified) {
    // PRO FIX: Error Code (Status 400 because this action is invalid for verified users)
    res.status(400);
    throw new Error("EMAIL_ALREADY_VERIFIED"); 
  }

  // Generate new code
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  user.verificationCode = verificationCode;
  user.verificationCodeExpires = Date.now() + 15 * 60 * 1000; // 15 mins
  await user.save();

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: "InvoTrack <no.reply@invotrack.de>",
      to: email,
      subject: "New Verification Code",
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>New Verification Code</h2>
          <p>You requested a new verification code:</p>
          <h1 style="color: #231f70; letter-spacing: 5px;">${verificationCode}</h1>
          <p>This code expires in 15 minutes.</p>
        </div>
      `,
    });
    
    // Success message can remain a string or be a code if you want to translate the success toast too
    res.status(200).json({ message: "VERIFICATION_CODE_SENT" });
  } catch (error) {
    res.status(500);
    // PRO FIX: Error Code
    throw new Error("EMAIL_SEND_FAILED");
  }
});


/**
 * @desc    Reset password using a valid JWT token
 * @route   POST /api/users/reset-password
 * @access  Public
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).populate("memberships.businessId");

    if (!user) {
      res.status(404);
      // PRO FIX: Error Code
      throw new Error("AUTH_USER_NOT_FOUND");
    }

    user.password = password;
    await user.save();

    // Create a new session token so user is logged in after reset
    const sessionToken = generateToken(user._id);
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      message: "PASSWORD_RESET_SUCCESS",
      user: userResponse,
      token: sessionToken,
    });
  } catch (error) {
    res.status(401);
    // PRO FIX: Error Code (Catch-all for jwt errors)
    throw new Error("AUTH_TOKEN_INVALID");
  }
});


/**
 * @desc    Update user profile details
 * @route   PUT /api/users/profile
 * @access  Private
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id); 

  if (!user) {
    res.status(404);
    // PRO FIX: Error Code
    throw new Error("AUTH_USER_NOT_FOUND");
  }

  // Update fields if provided
  user.name = req.body.name || user.name;
  user.profileImage = req.body.profileImage || user.profileImage;
  
  if (req.body.language) {
    user.language = req.body.language;
  }

  if (req.body.password) {
    user.password = req.body.password;
  }

  const updatedUser = await user.save();
  await updatedUser.populate("memberships.businessId");

  const userResponse = updatedUser.toObject();
  delete userResponse.password;

  res.json({
    user: userResponse,
    message: "PROFILE_UPDATED", // Success Code (Optional, usually handled by frontend state)
  });
});

/**
 * @desc    Get the profile of the currently logged-in user
 * @route   GET /api/users/profile
 * @access  Private
 */
export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate("memberships.businessId");

  if (user) {
    const userResponse = user.toObject();
    delete userResponse.password;
    res.json(userResponse);
  } else {
    res.status(404);
    throw new Error("AUTH_USER_NOT_FOUND");
  }
});


/**
 * @desc    Delete user avatar
 * @route   DELETE /api/users/avatar
 * @access  Private
 */
export const deleteUserAvatar = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error("AUTH_USER_NOT_FOUND");
  }

  // 1. Delete file logic (Keep existing)
  if (user.profileImage && user.profileImage.includes('/api/images/')) {
    try {
      const filename = user.profileImage.split('/').pop();
      const storagePath = process.env.UPLOAD_PATH || path.join(__dirname, "../../images");
      const filePath = path.join(storagePath, "users", filename);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error("Persistent File Delete Error:", error.message);
    }
  }

  // 2. Clear DB field
  user.profileImage = "";
  await user.save();

  const updatedUser = await User.findById(req.user._id).populate("memberships.businessId");

  res.json({ 
    message: "AVATAR_DELETED",
    user: updatedUser 
  });
});