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
        AuditEvent: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Unique audit log entry ID",
            },
            service: {
              type: "string",
              enum: [
                "auth-service",
                "user-service",
                "shipment-service",
                "partner-service",
                "wallet-service",
                "license-service",
              ],
              description: "Service that generated the log",
            },
            timestamp: {
              type: "string",
              format: "date-time",
              description: "When the action occurred",
            },
            userId: {
              type: "string",
              format: "uuid",
              nullable: true,
              description: "User who performed the action",
            },
            clientId: {
              type: "string",
              format: "uuid",
              nullable: true,
              description: "Client/tenant ID for multi-tenant logs",
            },
            action: {
              type: "string",
              enum: [
                "CREATE",
                "UPDATE",
                "DELETE",
                "LOGIN",
                "LOGOUT",
                "TOKEN_REFRESH",
                "VIEW",
                "EXPORT",
              ],
              description: "Action performed",
            },
            resource: {
              type: "string",
              description: "Resource type that was affected",
            },
            resourceId: {
              type: "string",
              format: "uuid",
              nullable: true,
              description: "ID of the affected resource",
            },
            ipAddress: {
              type: "string",
              nullable: true,
              description: "IP address of the request",
            },
            userAgent: {
              type: "string",
              nullable: true,
              description: "Browser/client user agent",
            },
            changes: {
              type: "object",
              nullable: true,
              description: "Changes made (before/after for updates)",
            },
            metadata: {
              type: "object",
              nullable: true,
              description: "Additional context",
            },
          },
        },
        RuntimeLogLine: {
          type: "object",
          properties: {
            service: {
              type: "string",
              description: "Service that generated the log",
            },
            file: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}(-error)?\\.log$",
              description: "Log file name",
            },
            line: {
              type: "number",
              description: "Line number in the file",
            },
            parsed: {
              type: "object",
              nullable: true,
              properties: {
                timestamp: {
                  type: "string",
                  nullable: true,
                },
                level: {
                  type: "string",
                  enum: ["error", "warn", "info", "debug"],
                  nullable: true,
                },
                message: {
                  type: "string",
                },
              },
            },
            raw: {
              type: "string",
              nullable: true,
              description: "Raw log line with sensitive data redacted",
            },
          },
        },
        LogsPagination: {
          type: "object",
          properties: {
            nextCursor: {
              type: "string",
              nullable: true,
              description: "Cursor for next page",
            },
            hasMore: {
              type: "boolean",
              description: "Whether more logs are available",
            },
          },
        },
        AuditLogsResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["success", "error"],
            },
            data: {
              type: "array",
              items: {
                $ref: "#/components/schemas/AuditEvent",
              },
            },
            pagination: {
              $ref: "#/components/schemas/LogsPagination",
            },
            meta: {
              type: "object",
              properties: {
                gateway: {
                  type: "boolean",
                  description: "Indicates aggregated response",
                },
                timestamp: {
                  type: "string",
                  format: "date-time",
                },
                servicesQueried: {
                  type: "number",
                  description: "Number of services queried",
                },
              },
            },
          },
        },
        RuntimeLogsResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["success", "error"],
            },
            data: {
              type: "array",
              description: "Array of service log objects",
              items: {
                type: "object",
                properties: {
                  service: {
                    type: "string",
                  },
                  logs: {
                    type: "array",
                    items: {
                      $ref: "#/components/schemas/RuntimeLogLine",
                    },
                  },
                  available: {
                    type: "boolean",
                  },
                  availableFiles: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },
                  file: {
                    type: "string",
                  },
                },
              },
            },
            meta: {
              type: "object",
              properties: {
                gateway: {
                  type: "boolean",
                },
                timestamp: {
                  type: "string",
                  format: "date-time",
                },
                servicesQueried: {
                  type: "number",
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
      {
        name: "Logs",
        description: "Audit trail and runtime logs endpoints",
      },
    ],
  },
  apis: ["./server.js"],
};

const specs = swaggerJsdoc(options);

module.exports = specs;
