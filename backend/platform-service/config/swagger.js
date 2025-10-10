const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Platform Service API",
      version: "1.0.0",
      description:
        "E-commerce platform integrations (Shopify, WooCommerce, etc.) for Logistics Aggregator Portal",
      contact: {
        name: "API Support",
        email: "support@logistics.com",
      },
    },
    servers: [
      {
        url: "http://localhost:3008",
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
              example: "platform-service",
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
        name: "Platforms",
        description: "Platform management",
      },
      {
        name: "Shopify",
        description: "Shopify integration endpoints",
      },
      {
        name: "WooCommerce",
        description: "WooCommerce integration endpoints",
      },
      {
        name: "Integrations",
        description: "User platform integrations",
      },
    ],
  },
  apis: ["./server.js", "./routes/**/*.js"],
};

const specs = swaggerJsdoc(options);

module.exports = specs;
