const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Logistics Wallet Service API",
      version: "1.0.0",
      description:
        "Payment Processing and External Wallet API Integration Service for Logistics Aggregator Portal",
      contact: {
        name: "Logistics Development Team",
        email: "dev@logistics.com",
      },
    },
    servers: [
      {
        url: "http://localhost:3006",
        description: "Development server",
      },
      {
        url: "https://api.logistics.com",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token from Auth Service",
        },
        HMACAuth: {
          type: "apiKey",
          in: "header",
          name: "X-Wallet-Signature",
          description: "HMAC signature for external wallet API authentication",
        },
      },
      schemas: {
        Wallet: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Wallet unique identifier",
            },
            userId: {
              type: "string",
              format: "uuid",
              description: "User ID who owns this wallet",
            },
            balance: {
              type: "number",
              format: "decimal",
              description: "Current wallet balance",
              example: 1250.5,
            },
            externalWalletId: {
              type: "string",
              nullable: true,
              description: "External wallet service ID",
            },
            clientCode: {
              type: "string",
              description: "Client code for multi-tenant support",
              default: "DEFAULT",
            },
            status: {
              type: "string",
              enum: ["ACTIVE", "INACTIVE", "SUSPENDED", "BLOCKED"],
              description: "Wallet status",
            },
            metadata: {
              type: "object",
              nullable: true,
              description: "Additional wallet metadata",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Wallet creation timestamp",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Last updated timestamp",
            },
          },
          required: ["id", "userId", "balance", "status"],
        },
        Transaction: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Transaction unique identifier",
            },
            walletId: {
              type: "string",
              format: "uuid",
              description: "Wallet ID",
            },
            type: {
              type: "string",
              enum: ["DEBIT", "CREDIT", "REFUND", "LOAD_BALANCE", "ADJUSTMENT"],
              description: "Transaction type",
            },
            amount: {
              type: "number",
              format: "decimal",
              description: "Transaction amount",
              example: 150.75,
            },
            description: {
              type: "string",
              nullable: true,
              description: "Transaction description",
            },
            reference: {
              type: "string",
              nullable: true,
              description: "Reference ID (shipment ID, order ID, etc)",
            },
            status: {
              type: "string",
              enum: [
                "PENDING",
                "COMPLETED",
                "FAILED",
                "CANCELLED",
                "PROCESSING",
              ],
              description: "Transaction status",
            },
            metadata: {
              type: "object",
              nullable: true,
              description: "Additional transaction metadata",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Transaction creation timestamp",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Last updated timestamp",
            },
          },
          required: ["id", "walletId", "type", "amount", "status"],
        },
        PaymentGateway: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Payment gateway record ID",
            },
            walletId: {
              type: "string",
              format: "uuid",
              description: "Wallet ID",
            },
            provider: {
              type: "string",
              description: "Payment gateway provider",
              example: "razorpay",
            },
            paymentId: {
              type: "string",
              description: "Gateway payment ID",
            },
            orderId: {
              type: "string",
              nullable: true,
              description: "Gateway order ID",
            },
            amount: {
              type: "number",
              format: "decimal",
              description: "Payment amount",
            },
            currency: {
              type: "string",
              description: "Currency code",
              default: "INR",
            },
            status: {
              type: "string",
              enum: [
                "PENDING",
                "COMPLETED",
                "FAILED",
                "CANCELLED",
                "REFUNDED",
                "EXPIRED",
              ],
              description: "Payment status",
            },
            gatewayData: {
              type: "object",
              nullable: true,
              description: "Gateway-specific data",
            },
            webhookData: {
              type: "object",
              nullable: true,
              description: "Webhook response data",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Payment creation timestamp",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Last updated timestamp",
            },
          },
          required: [
            "id",
            "walletId",
            "provider",
            "paymentId",
            "amount",
            "status",
          ],
        },
        SuccessResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "success",
            },
            message: {
              type: "string",
              example: "Operation completed successfully",
            },
            data: {
              type: "object",
              description: "Response data",
            },
            meta: {
              type: "object",
              properties: {
                timestamp: {
                  type: "string",
                  format: "date-time",
                },
                requestId: {
                  type: "string",
                  format: "uuid",
                },
                pagination: {
                  type: "object",
                  nullable: true,
                  properties: {
                    page: { type: "integer" },
                    limit: { type: "integer" },
                    total: { type: "integer" },
                    totalPages: { type: "integer" },
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
              example: "error",
            },
            message: {
              type: "string",
              example: "An error occurred",
            },
            error: {
              type: "object",
              properties: {
                code: {
                  type: "string",
                  example: "VALIDATION_ERROR",
                },
                details: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      field: { type: "string" },
                      message: { type: "string" },
                    },
                  },
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
                requestId: {
                  type: "string",
                  format: "uuid",
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
              description: "Overall health status",
            },
            timestamp: {
              type: "string",
              format: "date-time",
              description: "Health check timestamp",
            },
            uptime: {
              type: "number",
              description: "Service uptime in seconds",
            },
            service: {
              type: "string",
              example: "wallet-service",
            },
            version: {
              type: "string",
              example: "1.0.0",
            },
            environment: {
              type: "string",
              example: "development",
            },
            database: {
              type: "string",
              enum: ["connected", "disconnected"],
            },
            redis: {
              type: "string",
              enum: ["connected", "disconnected"],
            },
            dependencies: {
              type: "object",
              properties: {
                postgres: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    responseTime: { type: "number" },
                  },
                },
                redis: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    responseTime: { type: "number" },
                  },
                },
                externalWalletAPI: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    responseTime: { type: "number" },
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
                    used: { type: "number" },
                    total: { type: "number" },
                    external: { type: "number" },
                    unit: { type: "string", example: "MB" },
                  },
                },
                pid: { type: "number" },
                platform: { type: "string" },
                nodeVersion: { type: "string" },
              },
            },
            responseTime: {
              type: "number",
              description: "Health check response time in ms",
            },
          },
        },
      },
    },
    tags: [
      {
        name: "Health",
        description: "Service health check endpoints",
      },
      {
        name: "Wallet Management",
        description: "Wallet CRUD operations and balance management",
      },
      {
        name: "Transactions",
        description: "Transaction processing and history",
      },
      {
        name: "Payment Gateway",
        description: "Payment gateway integration (future)",
      },
      {
        name: "Admin Operations",
        description: "Administrative operations (admin role required)",
      },
    ],
  },
  apis: ["./routes/*.js", "./controllers/*.js", "./server.js"],
};

const specs = swaggerJsdoc(options);
module.exports = specs;
