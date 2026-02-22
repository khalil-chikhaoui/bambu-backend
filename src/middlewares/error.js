/**
 * @fileoverview Centralized Error Handling Middlewares
 * Provides custom handlers for 404 (Not Found) errors and global server exceptions.
 */

/**
 * Middleware to handle requests for routes that do not exist.
 * This is triggered when no other route matches the incoming request.
 * * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export function notFound(req, res, next) {
  res.status(404).json({ 
    message: `Route not found - [${req.method}] ${req.originalUrl}` 
  });
}

/**
 * Global Error Handler
 * Catch-all middleware for handling application errors and formatting the response.
 * Automatically hides stack traces in production for security.
 * * @param {Error} err - The error object thrown by the application
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export function errorHandler(err, req, res, next) {
  // Determine the status code: 
  // If the response already has an error code, use it. Otherwise, default to 500.
  const status =
    res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  res.status(status).json({
    message: err.message || "Internal Server Error",
    // Only expose stack trace if the environment is explicitly set to 'development'
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
}