import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Bambu ERP API',
      version: '1.0.0',
      description: 'Documentation interactive pour le backend Bambu ERP. Connectez-vous avec les identifiants Admin pour tester les routes privées.',
    },
    servers: [
      {
        url: 'http://localhost:3040/api',
        description: 'Serveur de Développement Local',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Entrez votre token JWT ici (sans le mot "Bearer").'
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/docs/*.yaml'],  
};

const specs = swaggerJsdoc(options);

export const swaggerDocs = (app, port) => {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
    customCss: '.swagger-ui .topbar { display: none }', // Makes the UI look cleaner
    customSiteTitle: "Bambu API Docs"
  }));

  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  console.log(`📄 Swagger Docs available at http://localhost:${port}/api/docs`);
};