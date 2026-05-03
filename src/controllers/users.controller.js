import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { generateToken } from "../middlewares/auth.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getTransporter } from "../config/mail.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/users/signin
 * @access  Public
 */
export const signIn = asyncHandler(async (req, res) => {
  // Extract rememberMe from the frontend request
  const { email, password, rememberMe } = req.body; 

  const user = await User.findOne({ email }).populate("memberships.organizationId");

  if (user && (await user.matchPassword(password))) {
    // Pass rememberMe to your generator
    const token = generateToken(user._id, rememberMe); 
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      user: userResponse,
      token: token,
    });
  } else {
    res.status(401);
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
    return res.status(200).json({ message: "RESET_LINK_SENT" });
  }

  const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  try {    
    const transporter = getTransporter(); 
    
    await transporter.sendMail({
      from: `"Bambu ERP" <${process.env.SMTP_EMAIL}>`,
      to: email, 
      subject: "Réinitialisation de votre mot de passe",
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333; line-height: 1.6;">
          <h2>Demande de réinitialisation</h2>
          <p>Nous avons reçu une demande de réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous. Ce lien est valide pendant 15 minutes.</p>
          <div style="margin: 20px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: #184c16; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Réinitialiser mon mot de passe</a>
          </div>
          <p>Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet e-mail.</p>
        </div>
      `,
    }); 

    res.status(200).json({ message: "RESET_LINK_SENT" });
  } catch (err) {
    res.status(500);
    throw new Error("EMAIL_SEND_FAILED");
  }
});


/**
 * @desc    Vérifier la validité du token de réinitialisation
 * @route   GET /api/users/reset-password/:token
 * @access  Public
 */
export const validateResetToken = asyncHandler(async (req, res) => {
  const { token } = req.params;

  try {
    // On essaie de décoder le token. S'il est expiré, ça déclenchera une erreur.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // On vérifie que l'utilisateur existe toujours
    const user = await User.findById(decoded.id);
    if (!user) {
      res.status(404);
      throw new Error("AUTH_USER_NOT_FOUND");
    }

    // Si tout est bon, on renvoie un statut 200
    res.status(200).json({ message: "TOKEN_VALID" });
  } catch (error) {
    res.status(401);
    throw new Error("AUTH_TOKEN_INVALID");
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
    const user = await User.findById(decoded.id).populate("memberships.organizationId");

    if (!user) {
      res.status(404);
      throw new Error("AUTH_USER_NOT_FOUND");
    }

    user.password = password;
    await user.save();

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
    throw new Error("AUTH_USER_NOT_FOUND");
  }

  // 1. Champs simples (Nom)
  if (req.body.name) user.name = req.body.name;
  
  // Note: On ne touche plus au password ici !

  // 2. Champs imbriqués (Téléphone et Adresse)
  if (req.body.phoneNumber) {
    user.phoneNumber = { ...user.phoneNumber, ...req.body.phoneNumber };
  }

  if (req.body.address) {
    user.address = { ...user.address, ...req.body.address };
  }

  const updatedUser = await user.save();
  await updatedUser.populate("memberships.organizationId");

  const userResponse = updatedUser.toObject();
  delete userResponse.password;

  res.json({
    user: userResponse,
    message: "PROFILE_UPDATED", 
  });
});

/**
 * @desc    Get the profile of the currently logged-in user
 * @route   GET /api/users/profile
 * @access  Private
 */
export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate("memberships.organizationId");

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
 * @desc    Upload user profile avatar
 * @route   POST /api/users/avatar
 * @access  Private
 */
export const uploadUserAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("UPLOAD_NO_FILE");
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    // If user is deleted during upload, clean up the orphaned file
    if (req.file.path) fs.unlinkSync(req.file.path);
    res.status(404);
    throw new Error("AUTH_USER_NOT_FOUND");
  }

  // Delete old avatar if it exists locally
  if (user.profileImage && user.profileImage.includes('/api/images/')) {
    try {
      const oldFileName = user.profileImage.split('/').pop();
      const storagePath = process.env.UPLOAD_PATH || path.join(__dirname, "../../images");
      const oldPath = path.join(storagePath, "users", oldFileName);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    } catch (err) {
      console.error("Failed to delete old user avatar:", err.message);
    }
  }

  // Save new avatar path to DB
  user.profileImage = `${process.env.BACKEND_URL}/api/images/users/${req.file.filename}`;
  await user.save();

  // Populate organization ID just like the other user routes
  await user.populate("memberships.organizationId");

  const userResponse = user.toObject();
  delete userResponse.password;

  res.status(200).json({
    message: "AVATAR_UPLOADED",
    user: userResponse,
  });
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

  user.profileImage = "";
  await user.save();

  // 1. On utilise le populate direct (plus rapide, pas de deuxième requête DB)
  await user.populate("memberships.organizationId");

  // 2. On supprime le mot de passe avant d'envoyer (sécurité)
  const userResponse = user.toObject();
  delete userResponse.password;

  res.json({ 
    message: "AVATAR_DELETED",
    user: userResponse 
  });
});