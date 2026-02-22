/**
 * @fileoverview Authentication Middlewares
 * Handles JWT generation and route protection by verifying tokens and 
 * attaching the user profile to the request object.
 */

import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import User from "../models/User.js";

/**
 * Generates a JSON Web Token (JWT) for a given user ID.
 * * @param {string} id - The MongoDB User ID.
 * @returns {string} Signed JWT token valid for 30 days.
 */
export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

/**
 * Middleware to protect private routes.
 * Verifies the Bearer token in the Authorization header.
 * * @throws {Error} 401 Not Authorized if token is missing, invalid, or user does not exist.
 */
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  // 1. Check for "Bearer <token>" in the Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // 2. Extract token from string ("Bearer XYZ...")
      token = req.headers.authorization.split(" ")[1];

      // 3. Verify token signature against secret
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 4. Retrieve user from database (excluding password field)
      // This attaches the user object to 'req.user' for use in subsequent controllers
      req.user = await User.findById(decoded.id).select("-password");

      // 5. Handle cases where token is valid but user was deleted from DB
      if (!req.user) {
        res.status(401);
        throw new Error("Not authorized, user not found");
      }

      // 6. Proceed to the next middleware or controller
      next();
    } catch (error) {
      console.error("Token verification failed:", error.message);
      res.status(401);
      throw new Error("Not authorized, token failed");
    }
  }

  // 7. Error if no token was provided in the headers
  if (!token) {
    res.status(401);
    throw new Error("Not authorized, no token");
  }
});