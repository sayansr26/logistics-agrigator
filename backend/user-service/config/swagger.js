const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Logistics User Service API",
      version: "1.0.0",
      description:
        "User management and client administration service for the Logistics Aggregator Portal",
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
        url: "http://localhost:8002",
        description: "Development server",
      },
      {
        url: "https://api.logistics.com/user",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token obtained from auth service login endpoint",
        },
      },
      schemas: {
        UserProfile: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Unique user profile identifier",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            userId: {
              type: "string",
              format: "uuid",
              description: "Reference to auth service user ID",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            firstName: {
              type: "string",
              minLength: 1,
              maxLength: 50,
              description: "User's first name",
              example: "John",
            },
            lastName: {
              type: "string",
              minLength: 1,
              maxLength: 50,
              description: "User's last name",
              example: "Doe",
            },
            email: {
              type: "string",
              format: "email",
              description: "User's email address",
              example: "john.doe@example.com",
            },
            phone: {
              type: "string",
              nullable: true,
              pattern: "^\\+?[1-9]\\d{1,14}$",
              description: "User's phone number (E.164 format)",
              example: "+1234567890",
            },
            avatar: {
              type: "string",
              nullable: true,
              format: "uri",
              description: "URL to user's avatar image",
              example: "https://example.com/avatars/user123.jpg",
            },
            timezone: {
              type: "string",
              default: "UTC",
              description: "User's timezone",
              example: "America/New_York",
            },
            language: {
              type: "string",
              default: "en",
              description: "User's preferred language",
              example: "en",
            },
            clientId: {
              type: "string",
              nullable: true,
              description: "Client ID for client users",
              example: "CLIENT_001",
            },
            isActive: {
              type: "boolean",
              description: "Whether the user profile is active",
              example: true,
            },
            isVerified: {
              type: "boolean",
              description: "Whether the user profile is verified",
              example: false,
            },
            lastLoginAt: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Last login timestamp",
              example: "2024-01-01T12:00:00.000Z",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Profile creation timestamp",
              example: "2024-01-01T00:00:00.000Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Profile last update timestamp",
              example: "2024-01-01T12:00:00.000Z",
            },
          },
        },
        Client: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Unique client identifier",
              example: "CLIENT_001",
            },
            name: {
              type: "string",
              minLength: 2,
              maxLength: 100,
              description: "Client company name",
              example: "Acme Corporation",
            },
            email: {
              type: "string",
              format: "email",
              description: "Client contact email",
              example: "contact@acme.com",
            },
            phone: {
              type: "string",
              nullable: true,
              description: "Client contact phone",
              example: "+1234567890",
            },
            address: {
              type: "string",
              nullable: true,
              description: "Client business address",
              example: "123 Business St, City, State 12345",
            },
            website: {
              type: "string",
              nullable: true,
              format: "uri",
              description: "Client website URL",
              example: "https://acme.com",
            },
            industry: {
              type: "string",
              nullable: true,
              description: "Client industry sector",
              example: "E-commerce",
            },
            isActive: {
              type: "boolean",
              description: "Whether the client is active",
              example: true,
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Client creation timestamp",
              example: "2024-01-01T00:00:00.000Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Client last update timestamp",
              example: "2024-01-01T12:00:00.000Z",
            },
          },
        },
        ClientSettings: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Unique settings identifier",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            clientId: {
              type: "string",
              description: "Reference to client",
              example: "CLIENT_001",
            },
            brandName: {
              type: "string",
              nullable: true,
              description: "White-label brand name",
              example: "Acme Logistics",
            },
            brandLogo: {
              type: "string",
              nullable: true,
              format: "uri",
              description: "URL to brand logo",
              example: "https://acme.com/logo.png",
            },
            brandColors: {
              type: "object",
              nullable: true,
              description: "Brand color scheme",
              properties: {
                primary: {
                  type: "string",
                  example: "#007bff",
                },
                secondary: {
                  type: "string",
                  example: "#6c757d",
                },
              },
            },
            customDomain: {
              type: "string",
              nullable: true,
              description: "Custom domain for white-label portal",
              example: "logistics.acme.com",
            },
            features: {
              type: "object",
              description: "Enabled features for the client",
              properties: {
                tracking: {
                  type: "boolean",
                  example: true,
                },
                wallet: {
                  type: "boolean",
                  example: true,
                },
                analytics: {
                  type: "boolean",
                  example: false,
                },
              },
            },
            integrations: {
              type: "object",
              nullable: true,
              description: "Third-party integration settings",
              properties: {
                webhook_url: {
                  type: "string",
                  format: "uri",
                  example: "https://acme.com/webhooks/logistics",
                },
                api_keys: {
                  type: "object",
                  example: {
                    "shipping_provider": "encrypted_key_123",
                  },
                },
              },
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Settings creation timestamp",
              example: "2024-01-01T00:00:00.000Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Settings last update timestamp",
              example: "2024-01-01T12:00:00.000Z",
            },
          },
        },
        UserInvitation: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Unique invitation identifier",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            email: {
              type: "string",
              format: "email",
              description: "Invited user's email",
              example: "newuser@acme.com",
            },
            role: {
              type: "string",
              enum: ["admin", "finance", "operations", "client", "support"],
              description: "Role to assign to invited user",
              example: "operations",
            },
            clientId: {
              type: "string",
              nullable: true,
              description: "Client ID for client role invitations",
              example: "CLIENT_001",
            },
            token: {
              type: "string",
              description: "Unique invitation token",
              example: "inv_abc123def456ghi789",
            },
            status: {
              type: "string",
              enum: ["pending", "accepted", "expired", "revoked"],
              description: "Invitation status",
              example: "pending",
            },
            invitedBy: {
              type: "string",
              format: "uuid",
              description: "ID of user who sent the invitation",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            expiresAt: {
              type: "string",
              format: "date-time",
              description: "Invitation expiration timestamp",
              example: "2024-01-08T00:00:00.000Z",
            },
            acceptedAt: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Invitation acceptance timestamp",
              example: "2024-01-02T10:30:00.000Z",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Invitation creation timestamp",
              example: "2024-01-01T00:00:00.000Z",
            },
          },
        },
        CreateUserProfileRequest: {
          type: "object",
          required: ["userId", "firstName", "lastName", "email"],
          properties: {
            userId: {
              type: "string",
              format: "uuid",
              description: "Reference to auth service user ID",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            firstName: {
              type: "string",
              minLength: 1,
              maxLength: 50,
              description: "User's first name",
              example: "John",
            },
            lastName: {
              type: "string",
              minLength: 1,
              maxLength: 50,
              description: "User's last name",
              example: "Doe",
            },
            email: {
              type: "string",
              format: "email",
              description: "User's email address",
              example: "john.doe@example.com",
            },
            phone: {
              type: "string",
              nullable: true,
              pattern: "^\\+?[1-9]\\d{1,14}$",
              description: "User's phone number (E.164 format)",
              example: "+1234567890",
            },
            avatar: {
              type: "string",
              nullable: true,
              format: "uri",
              description: "URL to user's avatar image",
              example: "https://example.com/avatars/user123.jpg",
            },
            timezone: {
              type: "string",
              default: "UTC",
              description: "User's timezone",
              example: "America/New_York",
            },
            language: {
              type: "string",
              default: "en",
              description: "User's preferred language",
              example: "en",
            },
            clientId: {
              type: "string",
              nullable: true,
              description: "Client ID for client users",
              example: "CLIENT_001",
            },
          },
        },
        UpdateUserProfileRequest: {
          type: "object",
          properties: {
            firstName: {
              type: "string",
              minLength: 1,
              maxLength: 50,
              description: "User's first name",
              example: "John",
            },
            lastName: {
              type: "string",
              minLength: 1,
              maxLength: 50,
              description: "User's last name",
              example: "Doe",
            },
            phone: {
              type: "string",
              nullable: true,
              pattern: "^\\+?[1-9]\\d{1,14}$",
              description: "User's phone number (E.164 format)",
              example: "+1234567890",
            },
            avatar: {
              type: "string",
              nullable: true,
              format: "uri",
              description: "URL to user's avatar image",
              example: "https://example.com/avatars/user123.jpg",
            },
            timezone: {
              type: "string",
              description: "User's timezone",
              example: "America/New_York",
            },
            language: {
              type: "string",
              description: "User's preferred language",
              example: "en",
            },
          },
        },
        CreateClientRequest: {
          type: "object",
          required: ["id", "name", "email"],
          properties: {
            id: {
              type: "string",
              pattern: "^CLIENT_[A-Z0-9_]+$",
              description: "Unique client identifier (must start with CLIENT_)",
              example: "CLIENT_001",
            },
            name: {
              type: "string",
              minLength: 2,
              maxLength: 100,
              description: "Client company name",
              example: "Acme Corporation",
            },
            email: {
              type: "string",
              format: "email",
              description: "Client contact email",
              example: "contact@acme.com",
            },
            phone: {
              type: "string",
              nullable: true,
              description: "Client contact phone",
              example: "+1234567890",
            },
            address: {
              type: "string",
              nullable: true,
              description: "Client business address",
              example: "123 Business St, City, State 12345",
            },
            website: {
              type: "string",
              nullable: true,
              format: "uri",
              description: "Client website URL",
              example: "https://acme.com",
            },
            industry: {
              type: "string",
              nullable: true,
              description: "Client industry sector",
              example: "E-commerce",
            },
          },
        },
        UpdateClientRequest: {
          type: "object",
          properties: {
            name: {
              type: "string",
              minLength: 2,
              maxLength: 100,
              description: "Client company name",
              example: "Acme Corporation",
            },
            email: {
              type: "string",
              format: "email",
              description: "Client contact email",
              example: "contact@acme.com",
            },
            phone: {
              type: "string",
              nullable: true,
              description: "Client contact phone",
              example: "+1234567890",
            },
            address: {
              type: "string",
              nullable: true,
              description: "Client business address",
              example: "123 Business St, City, State 12345",
            },
            website: {
              type: "string",
              nullable: true,
              format: "uri",
              description: "Client website URL",
              example: "https://acme.com",
            },
            industry: {
              type: "string",
              nullable: true,
              description: "Client industry sector",
              example: "E-commerce",
            },
          },
        },
        CreateClientSettingsRequest: {
          type: "object",
          required: ["clientId"],
          properties: {
            clientId: {
              type: "string",
              description: "Reference to client",
              example: "CLIENT_001",
            },
            brandName: {
              type: "string",
              nullable: true,
              description: "White-label brand name",
              example: "Acme Logistics",
            },
            brandLogo: {
              type: "string",
              nullable: true,
              format: "uri",
              description: "URL to brand logo",
              example: "https://acme.com/logo.png",
            },
            brandColors: {
              type: "object",
              nullable: true,
              description: "Brand color scheme",
              properties: {
                primary: {
                  type: "string",
                  example: "#007bff",
                },
                secondary: {
                  type: "string",
                  example: "#6c757d",
                },
              },
            },
            customDomain: {
              type: "string",
              nullable: true,
              description: "Custom domain for white-label portal",
              example: "logistics.acme.com",
            },
            features: {
              type: "object",
              description: "Enabled features for the client",
              properties: {
                tracking: {
                  type: "boolean",
                  example: true,
                },
                wallet: {
                  type: "boolean",
                  example: true,
                },
                analytics: {
                  type: "boolean",
                  example: false,
                },
              },
            },
            integrations: {
              type: "object",
              nullable: true,
              description: "Third-party integration settings",
            },
          },
        },
        CreateUserInvitationRequest: {
          type: "object",
          required: ["email", "role"],
          properties: {
            email: {
              type: "string",
              format: "email",
              description: "Email address to invite",
              example: "newuser@acme.com",
            },
            role: {
              type: "string",
              enum: ["admin", "finance", "operations", "client", "support"],
              description: "Role to assign to invited user",
              example: "operations",
            },
            clientId: {
              type: "string",
              nullable: true,
              description: "Client ID for client role invitations (required for client role)",
              example: "CLIENT_001",
            },
          },
        },
        PaginationQuery: {
          type: "object",
          properties: {
            page: {
              type: "integer",
              minimum: 1,
              default: 1,
              description: "Page number",
              example: 1,
            },
            limit: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 20,
              description: "Items per page",
              example: 20,
            },
            search: {
              type: "string",
              description: "Search term",
              example: "john",
            },
            sortBy: {
              type: "string",
              description: "Field to sort by",
              example: "createdAt",
            },
            sortOrder: {
              type: "string",
              enum: ["asc", "desc"],
              default: "desc",
              description: "Sort order",
              example: "desc",
            },
          },
        },
        PaginatedResponse: {
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
                items: {
                  type: "array",
                  description: "Array of items",
                },
                pagination: {
                  type: "object",
                  properties: {
                    page: {
                      type: "integer",
                      example: 1,
                    },
                    limit: {
                      type: "integer",
                      example: 20,
                    },
                    total: {
                      type: "integer",
                      example: 150,
                    },
                    pages: {
                      type: "integer",
                      example: 8,
                    },
                    hasNext: {
                      type: "boolean",
                      example: true,
                    },
                    hasPrev: {
                      type: "boolean",
                      example: false,
                    },
                  },
                },
              },
            },
            meta: {
              $ref: "#/components/schemas/ResponseMeta",
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
            message: {
              type: "string",
              description: "Success message",
              example: "Operation completed successfully",
            },
            data: {
              type: "object",
              description: "Response data",
            },
            meta: {
              $ref: "#/components/schemas/ResponseMeta",
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
                  example: "Invalid input data",
                },
                field: {
                  type: "string",
                  nullable: true,
                  description: "Field that caused the validation error",
                  example: "email",
                },
                details: {
                  type: "array",
                  nullable: true,
                  description: "Additional error details",
                  items: {
                    type: "object",
                  },
                },
              },
            },
            meta: {
              $ref: "#/components/schemas/ResponseMeta",
            },
          },
        },
        ResponseMeta: {
          type: "object",
          properties: {
            timestamp: {
              type: "string",
              format: "date-time",
              description: "Response timestamp",
              example: "2024-01-01T12:00:00.000Z",
            },
            service: {
              type: "string",
              description: "Service name",
              example: "user-service",
            },
            version: {
              type: "string",
              description: "Service version",
              example: "1.0.0",
            },
            requestId: {
              type: "string",
              nullable: true,
              description: "Request tracking ID",
              example: "req-123e4567-e89b-12d3-a456-426614174000",
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
            service: {
              type: "string",
              description: "Service name",
              example: "user-service",
            },
            version: {
              type: "string",
              description: "Service version",
              example: "1.0.0",
            },
            timestamp: {
              type: "string",
              format: "date-time",
              description: "Health check timestamp",
              example: "2024-01-01T12:00:00.000Z",
            },
            uptime: {
              type: "number",
              description: "Service uptime in seconds",
              example: 3600,
            },
            middleware: {
              type: "string",
              description: "Middleware status",
              example: "authentication middleware loaded",
            },
            database: {
              type: "string",
              enum: ["connected", "disconnected"],
              description: "Database connection status",
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
                authService: {
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
        name: "User Profiles",
        description: "User profile management operations",
      },
      {
        name: "Clients",
        description: "Client management operations",
      },
      {
        name: "Client Settings",
        description: "Client settings and white-label branding",
      },
      {
        name: "User Invitations",
        description: "User invitation system",
      },
      {
        name: "Admin",
        description: "Administrative operations (admin only)",
      },
      {
        name: "Testing",
        description: "Test endpoints for middleware and authentication validation",
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
