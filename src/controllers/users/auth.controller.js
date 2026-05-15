import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";
import User from "../../models/User.js";
import { generateToken } from "../../middlewares/auth.js";
import { getTransporter } from "../../config/mail.js";

export const signIn = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body;

  const user = await User.findOne({ email }).populate(
    "memberships.organizationId",
  );

  if (user && (await user.matchPassword(password))) {
    const token = generateToken(user._id, rememberMe);
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      user: userResponse,
      token: token,
    });
  } else {
    res.status(400);
    throw new Error("AUTH_INVALID_CREDENTIALS");
  }
});

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

export const validateResetToken = asyncHandler(async (req, res) => {
  const { token } = req.params;

  let decoded;
  
  
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    res.status(400);
    throw new Error("AUTH_TOKEN_INVALID");
  }

  
  const user = await User.findById(decoded.id);
  if (!user) {
    res.status(404);
    throw new Error("AUTH_USER_NOT_FOUND");
  }
  
  res.status(200).json({ message: "TOKEN_VALID" });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    res.status(400);
    throw new Error("AUTH_TOKEN_INVALID");
  }

  // 2. Do the database operations OUTSIDE the catch block
  const user = await User.findById(decoded.id).populate(
    "memberships.organizationId",
  );

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
});
