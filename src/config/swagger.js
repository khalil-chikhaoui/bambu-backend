/**
 * @fileoverview Swagger Documentation Configuration
 * Configures OpenAPI/Swagger UI for automated API documentation, 
 * schema definitions, and interactive endpoint testing.
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

/**
 * Swagger Specification Options
 * Configures the core metadata and security definitions for the API docs.
 */
const options = {
  definition: {
    openapi: '3.0.0', // Standard OpenAPI version
    info: {
      title: 'Invotrack API',
      version: '1.0.0',
      description: 'Professional Invoice & Sales Tracking API documentation',
    },
    servers: [
      {
        url: 'http://localhost:3040/api',
        description: 'Local Development Server',
      },
    ],
    components: {
      /**
       * Defines the JWT Authorization method.
       * This allows developers to paste their JWT into Swagger 
       * to test protected routes.
       */
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // Path to the API docs (YAML or JS files containing Swagger annotations)
  apis: ['./src/docs/*.yaml'], 
};

// Initialize the swagger-jsdoc specs
const specs = swaggerJsdoc(options);

/**
 * Initializes Swagger UI on the Express application.
 * * @param {import('express').Application} app - The Express application instance.
 * @param {number|string} port - The port the server is running on.
 */
export const swaggerDocs = (app, port) => {
  // 1. Serve the UI at /api/docs
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs));

  /**
   * 2. Optional: Serve the raw JSON specification.
   * Useful for importing into tools like Postman or Insomnia.
   */
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  console.log(`📄 Swagger Docs available at http://localhost:${port}/api/docs`);
};