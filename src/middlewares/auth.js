/**
 * @fileoverview Authentication Middlewares
 * Handles JWT generation and route protection by verifying tokens and
 * attaching the user profile to the request object.
 */

import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import rateLimit from "express-rate-limit";

/**
 * Generates a JSON Web Token (JWT) for a given user ID.
 * @param {string} id - The MongoDB User ID.
 * @param {boolean} rememberMe - Determines token lifespan.
 * @returns {string} Signed JWT token.
 */
export const generateToken = (id, rememberMe = false) => {
  // 30 days if they want to stay connected, 2 hours if it's a temporary session
  const lifespan = rememberMe ? "30d" : "2h";

  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: lifespan,
  });
};

/**
 * Middleware to protect private routes.
 * Verifies the Bearer token in the Authorization header.
 * * @throws {Error} 401 Not Authorized if token is missing, invalid, or user does not exist.
 */
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check for "Bearer <token>" in the Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Extract token from string ("Bearer XYZ...")
      token = req.headers.authorization.split(" ")[1];

      // Verify token signature against secret
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Retrieve user from database (excluding password field)
      req.user = await User.findById(decoded.id).select("-password");
    } catch (error) {
      console.error("Token verification failed:", error.message);
      res.status(401);
      throw new Error("Not authorized, token failed");
    }

    // 🐛 THE FIX: This is now OUTSIDE the catch block!
    // Handle cases where token is valid but user was deleted from DB
    if (!req.user) {
      res.status(401);
      throw new Error("Not authorized, user not found");
    }

    // Proceed to the next middleware or controller
    return next();
  }

  // Error if no token was provided in the headers
  if (!token) {
    res.status(401);
    throw new Error("Not authorized, no token");
  }
});



export const emailLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, 
  message: { message: "Trop de requêtes. Veuillez réessayer plus tard." },
});