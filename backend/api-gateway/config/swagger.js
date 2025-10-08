const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Logistics API Gateway",
      version: "1.0.0",
      description:
        "API Gateway for Logistics Aggregator Portal - Routes requests to microservices",
      contact: {
        name: "Logistics Team",
        email: "dev@logistics.com",
      },
    },
    servers: [
      {
        url: process.env.API_GATEWAY_URL_LOCAL || "http://localhost:3001",
        description: "Current server",
      },
      {
        url: "http://103.17.193.231:3001",
        description: "Production server",
      },
      {
        url: "http://localhost:3001",
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
            timestamp: {
              type: "string",
              format: "date-time",
            },
            uptime: {
              type: "number",
              example: 3600,
            },
            service: {
              type: "string",
              example: "api-gateway",
            },
            version: {
              type: "string",
              example: "1.0.0",
            },
            environment: {
              type: "string",
              example: "development",
            },
            dependencies: {
              type: "object",
              properties: {
                redis: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      example: "healthy",
                    },
                    responseTime: {
                      type: "number",
                      example: 2,
                    },
                  },
                },
              },
            },
            system: {
              type: "object",
              properties: {
                memory: {
                  type: "object",
                  properties: {
                    used: {
                      type: "number",
                      example: 45,
                    },
                    total: {
                      type: "number",
                      example: 128,
                    },
                    unit: {
                      type: "string",
                      example: "MB",
                    },
                  },
                },
                pid: {
                  type: "number",
                  example: 1234,
                },
                platform: {
                  type: "string",
                  example: "linux",
                },
                nodeVersion: {
                  type: "string",
                  example: "v18.17.0",
                },
              },
            },
            responseTime: {
              type: "number",
              example: 15,
            },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "error",
            },
            error: {
              type: "object",
              properties: {
                code: {
                  type: "string",
                  example: "SERVICE_UNAVAILABLE",
                },
                message: {
                  type: "string",
                  example: "Service is currently unavailable",
                },
              },
            },
            meta: {
              type: "object",
              properties: {
                timestamp: {
                  type: "string",
                  format: "date-time",
                },
                service: {
                  type: "string",
                  example: "api-gateway",
                },
              },
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
        name: "Gateway",
        description: "API Gateway routing and proxy endpoints",
      },
    ],
  },
  apis: ["./server.js"],
};

const specs = swaggerJsdoc(options);

module.exports = specs;
