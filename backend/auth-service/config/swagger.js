const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Logistics Auth Service API",
      version: "1.0.0",
      description:
        "Authentication and authorization service for the Logistics Aggregator Portal",
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
        url: "http://localhost:8001",
        description: "Development server",
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
          description: "JWT token obtained from login endpoint",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Unique user identifier",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            email: {
              type: "string",
              format: "email",
              description: "User email address",
              example: "user@example.com",
            },
            role: {
              type: "string",
              enum: ["admin", "finance", "operations", "client", "support"],
              description: "User role in the system",
              example: "client",
            },
            clientId: {
              type: "string",
              nullable: true,
              description: "Client ID for client users",
              example: "CLIENT_001",
            },
            permissions: {
              type: "array",
              items: {
                type: "string",
              },
              description: "List of user permissions",
              example: ["own_shipments", "tracking", "wallet_view"],
            },
            isActive: {
              type: "boolean",
              description: "Whether the user account is active",
              example: true,
            },
            twoFactorEnabled: {
              type: "boolean",
              description: "Whether 2FA is enabled for the user",
              example: false,
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Account creation timestamp",
              example: "2024-01-01T00:00:00.000Z",
            },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              format: "email",
              description: "User email address",
              example: "user@example.com",
            },
            password: {
              type: "string",
              minLength: 8,
              description: "User password",
              example: "SecurePassword123!",
            },
          },
        },
        RegisterRequest: {
          type: "object",
          required: ["email", "password", "name"],
          properties: {
            email: {
              type: "string",
              format: "email",
              description: "User email address",
              example: "newuser@example.com",
            },
            password: {
              type: "string",
              minLength: 8,
              pattern:
                "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$",
              description:
                "Strong password with uppercase, lowercase, number, and special character",
              example: "SecurePassword123!",
            },
            name: {
              type: "string",
              minLength: 2,
              maxLength: 100,
              description: "User full name",
              example: "John Doe",
            },
            role: {
              type: "string",
              enum: ["client", "operations", "finance"],
              default: "client",
              description:
                "User role (admin and support roles require admin approval)",
              example: "client",
            },
            clientId: {
              type: "string",
              nullable: true,
              description: "Client ID for client users",
              example: "CLIENT_001",
            },
          },
        },
        AuthResponse: {
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
                user: {
                  $ref: "#/components/schemas/User",
                },
                accessToken: {
                  type: "string",
                  description: "JWT access token (expires in 1 hour)",
                  example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                },
                refreshToken: {
                  type: "string",
                  description: "JWT refresh token (expires in 30 days)",
                  example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                },
                expiresIn: {
                  type: "number",
                  description: "Access token expiration time in seconds",
                  example: 3600,
                },
              },
            },
          },
        },
        RefreshRequest: {
          type: "object",
          required: ["refreshToken"],
          properties: {
            refreshToken: {
              type: "string",
              description: "Valid refresh token",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
          },
        },
        LogoutRequest: {
          type: "object",
          properties: {
            refreshToken: {
              type: "string",
              description: "Refresh token to invalidate",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
            accessToken: {
              type: "string",
              description: "Access token to blacklist",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
          },
        },
        SuccessResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["success"],
              example: "success",
            },
            data: {
              type: "object",
              description: "Response data",
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
                  example: "Invalid email format",
                },
                field: {
                  type: "string",
                  nullable: true,
                  description: "Field that caused the validation error",
                  example: "email",
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
              example: "auth-service",
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
            dependencies: {
              type: "object",
              description: "Status of external dependencies",
              properties: {
                postgres: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      enum: ["healthy", "unhealthy"],
                    },
                    responseTime: {
                      type: "number",
                      description: "Response time in milliseconds",
                    },
                  },
                },
                redis: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      enum: ["healthy", "unhealthy"],
                    },
                    responseTime: {
                      type: "number",
                      description: "Response time in milliseconds",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: "Authentication",
        description: "User authentication operations",
      },
      {
        name: "Authorization",
        description: "User authorization and permissions",
      },
      {
        name: "Admin",
        description: "Administrative operations (admin only)",
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
