const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Support Service API",
      version: "1.0.0",
      description:
        "Support, ticketing, and knowledge base management for Logistics Aggregator Portal",
      contact: {
        name: "API Support",
        email: "support@logistics.com",
      },
    },
    servers: [
      {
        url: "http://localhost:3007",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        HealthResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "ok",
            },
            service: {
              type: "string",
              example: "support-service",
            },
            timestamp: {
              type: "string",
              format: "date-time",
            },
            version: {
              type: "string",
              example: "1.0.0",
            },
          },
        },
      },
    },
    tags: [
      {
        name: "Health",
        description: "Health check endpoints",
      },
      {
        name: "Tickets",
        description: "Support ticket management",
      },
      {
        name: "FAQ",
        description: "Frequently asked questions",
      },
      {
        name: "Knowledge Base",
        description: "Knowledge base articles",
      },
    ],
  },
  apis: ["./server.js", "./routes/**/*.js"],
};

const specs = swaggerJsdoc(options);

module.exports = specs;
