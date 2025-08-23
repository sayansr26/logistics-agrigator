const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Logistics Partner Service API",
      version: "1.0.0",
      description:
        "Partner management and external courier API integration service for the Logistics Aggregator Portal",
      contact: {
        name: "API Support",
        email: "support@logistics.com",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: "http://localhost:3005",
        description: "Development server (localhost)",
      },
      {
        url: `http://${process.env.HOST || "localhost"}:${process.env.PORT || 3005}`,
        description: "Development server (current host)",
      },
      {
        url: "https://api.logistics.com",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token obtained from auth service",
        },
      },
      schemas: {
        Partner: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Unique partner identifier",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            name: {
              type: "string",
              description: "Partner name",
              example: "DELHIVERY",
            },
            code: {
              type: "string",
              description: "Partner code",
              example: "DELHIVERY",
            },
            displayName: {
              type: "string",
              description: "Partner display name",
              example: "Delhivery",
            },
            isActive: {
              type: "boolean",
              description: "Whether the partner is active",
              example: true,
            },
            supportsCOD: {
              type: "boolean",
              description: "Whether the partner supports COD",
              example: true,
            },
            supportsReverse: {
              type: "boolean",
              description: "Whether the partner supports reverse logistics",
              example: true,
            },
            maxWeight: {
              type: "number",
              nullable: true,
              description: "Maximum weight supported in kg",
              example: 50.0,
            },
            servicePincodes: {
              type: "array",
              items: {
                type: "string",
              },
              description: "List of supported pincodes",
              example: ["110001", "400001", "560001"],
            },
          },
        },
        RateCalculationRequest: {
          type: "object",
          required: ["fromPincode", "toPincode", "weight", "serviceType"],
          properties: {
            fromPincode: {
              type: "string",
              pattern: "^[0-9]{6}$",
              description: "Origin pincode",
              example: "110001",
            },
            toPincode: {
              type: "string",
              pattern: "^[0-9]{6}$",
              description: "Destination pincode",
              example: "400001",
            },
            weight: {
              type: "number",
              minimum: 0.1,
              maximum: 100,
              description: "Package weight in kg",
              example: 2.5,
            },
            dimensions: {
              type: "object",
              properties: {
                length: {
                  type: "number",
                  description: "Length in cm",
                  example: 30,
                },
                width: {
                  type: "number",
                  description: "Width in cm",
                  example: 20,
                },
                height: {
                  type: "number",
                  description: "Height in cm",
                  example: 15,
                },
              },
            },
            serviceType: {
              type: "string",
              enum: ["SURFACE", "AIR", "EXPRESS"],
              description: "Service type",
              example: "SURFACE",
            },
            codAmount: {
              type: "number",
              nullable: true,
              description: "COD amount if applicable",
              example: 1500.0,
            },
            partnerId: {
              type: "string",
              nullable: true,
              description: "Specific partner ID for calculation",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
          },
        },
        RateCalculationResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["success"],
              example: "success",
            },
            data: {
              type: "object",
              properties: {
                rates: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      partnerId: {
                        type: "string",
                        example: "123e4567-e89b-12d3-a456-426614174000",
                      },
                      partnerName: {
                        type: "string",
                        example: "Delhivery",
                      },
                      serviceType: {
                        type: "string",
                        example: "SURFACE",
                      },
                      rate: {
                        type: "number",
                        example: 85.5,
                      },
                      codCharge: {
                        type: "number",
                        nullable: true,
                        example: 15.0,
                      },
                      fuelSurcharge: {
                        type: "number",
                        example: 8.55,
                      },
                      totalAmount: {
                        type: "number",
                        example: 109.05,
                      },
                      deliveryDays: {
                        type: "integer",
                        example: 3,
                      },
                      isServiceable: {
                        type: "boolean",
                        example: true,
                      },
                    },
                  },
                },
                cheapestRate: {
                  type: "object",
                  description: "Cheapest rate among all partners",
                },
                fastestRate: {
                  type: "object",
                  description: "Fastest delivery among all partners",
                },
              },
            },
          },
        },
        ServiceabilityRequest: {
          type: "object",
          required: ["fromPincode", "toPincode"],
          properties: {
            fromPincode: {
              type: "string",
              pattern: "^[0-9]{6}$",
              description: "Origin pincode",
              example: "110001",
            },
            toPincode: {
              type: "string",
              pattern: "^[0-9]{6}$",
              description: "Destination pincode",
              example: "400001",
            },
            partnerId: {
              type: "string",
              nullable: true,
              description: "Specific partner ID to check",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
          },
        },
        ServiceabilityResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["success"],
              example: "success",
            },
            data: {
              type: "object",
              properties: {
                serviceability: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      partnerId: {
                        type: "string",
                        example: "123e4567-e89b-12d3-a456-426614174000",
                      },
                      partnerName: {
                        type: "string",
                        example: "Delhivery",
                      },
                      isServiceable: {
                        type: "boolean",
                        example: true,
                      },
                      serviceTypes: {
                        type: "array",
                        items: {
                          type: "string",
                        },
                        example: ["SURFACE", "AIR"],
                      },
                      deliveryDays: {
                        type: "object",
                        properties: {
                          SURFACE: {
                            type: "integer",
                            example: 3,
                          },
                          AIR: {
                            type: "integer",
                            example: 2,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["error"],
              example: "error",
            },
            error: {
              type: "object",
              properties: {
                code: {
                  type: "string",
                  description: "Error code",
                  example: "VALIDATION_ERROR",
                },
                message: {
                  type: "string",
                  description: "Human-readable error message",
                  example: "Invalid pincode format",
                },
                field: {
                  type: "string",
                  nullable: true,
                  description: "Field that caused the validation error",
                  example: "fromPincode",
                },
              },
            },
          },
        },
        HealthResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["ok", "error"],
              example: "ok",
            },
            timestamp: {
              type: "string",
              format: "date-time",
              description: "Health check timestamp",
              example: "2024-01-01T00:00:00.000Z",
            },
            uptime: {
              type: "number",
              description: "Service uptime in seconds",
              example: 3600,
            },
            service: {
              type: "string",
              description: "Service name",
              example: "partner-service",
            },
            version: {
              type: "string",
              description: "Service version",
              example: "1.0.0",
            },
            database: {
              type: "string",
              enum: ["connected", "disconnected"],
              description: "Database connection status",
              example: "connected",
            },
            redis: {
              type: "string",
              enum: ["connected", "disconnected"],
              description: "Redis connection status",
              example: "connected",
            },
          },
        },
      },
    },
    tags: [
      {
        name: "Partners",
        description: "Partner management operations",
      },
      {
        name: "Rates",
        description: "Rate calculation and pricing",
      },
      {
        name: "Serviceability",
        description: "Serviceability checking operations",
      },
      {
        name: "Health",
        description: "Service health and monitoring",
      },
    ],
  },
  apis: ["./routes/*.js", "./server.js"],
};

const specs = swaggerJsdoc(options);

module.exports = specs;
