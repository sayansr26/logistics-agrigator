const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Logistics Shipment Service API",
      version: "1.0.0",
      description:
        "Shipment management service for the Logistics Aggregator Portal",
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
        url: "http://localhost:3004",
        description: "Development server (localhost)",
      },
      {
        url: `http://${process.env.HOST || "localhost"}:${process.env.PORT || 3004}`,
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
          description: "JWT token obtained from auth service login endpoint",
        },
      },
      schemas: {
        Shipment: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Unique shipment identifier",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            orderId: {
              type: "string",
              description: "Client order ID",
              example: "ORD-2024-001",
            },
            clientId: {
              type: "string",
              format: "uuid",
              description: "Client identifier",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            userId: {
              type: "string",
              format: "uuid",
              description: "User who created the shipment",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            status: {
              type: "string",
              enum: [
                "CREATED",
                "BOOKED",
                "PICKED_UP",
                "IN_TRANSIT",
                "OUT_FOR_DELIVERY",
                "DELIVERED",
                "CANCELLED",
                "RTO",
              ],
              description: "Current shipment status",
              example: "CREATED",
            },
            paymentType: {
              type: "string",
              enum: ["PREPAID", "COD"],
              description: "Payment method for the shipment",
              example: "PREPAID",
            },
            codAmount: {
              type: "number",
              format: "decimal",
              nullable: true,
              description: "Cash on delivery amount (if applicable)",
              example: 1500.5,
            },
            totalCost: {
              type: "number",
              format: "decimal",
              description: "Total shipping cost",
              example: 125.75,
            },
            pickupAddress: {
              $ref: "#/components/schemas/Address",
            },
            deliveryAddress: {
              $ref: "#/components/schemas/Address",
            },
            packageDetails: {
              $ref: "#/components/schemas/Package",
            },
            partnerId: {
              type: "string",
              nullable: true,
              description: "Assigned courier partner ID",
              example: "DELHIVERY",
            },
            awbNumber: {
              type: "string",
              nullable: true,
              description: "Air way bill number from courier partner",
              example: "12345678901234",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Shipment creation timestamp",
              example: "2024-01-01T00:00:00.000Z",
            },
            estimatedDelivery: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Estimated delivery timestamp",
              example: "2024-01-03T00:00:00.000Z",
            },
          },
        },
        Address: {
          type: "object",
          required: [
            "name",
            "phone",
            "addressLine1",
            "city",
            "state",
            "pincode",
          ],
          properties: {
            name: {
              type: "string",
              description: "Contact person name",
              example: "John Doe",
            },
            phone: {
              type: "string",
              pattern: "^\\+91[0-9]{10}$",
              description: "Phone number with country code",
              example: "+919876543210",
            },
            email: {
              type: "string",
              format: "email",
              nullable: true,
              description: "Email address",
              example: "john.doe@example.com",
            },
            addressLine1: {
              type: "string",
              description: "Address line 1",
              example: "123 Main Street",
            },
            addressLine2: {
              type: "string",
              nullable: true,
              description: "Address line 2",
              example: "Apartment 4B",
            },
            landmark: {
              type: "string",
              nullable: true,
              description: "Nearby landmark",
              example: "Near City Mall",
            },
            city: {
              type: "string",
              description: "City name",
              example: "Mumbai",
            },
            state: {
              type: "string",
              description: "State name",
              example: "Maharashtra",
            },
            pincode: {
              type: "string",
              pattern: "^[0-9]{6}$",
              description: "6-digit postal code",
              example: "400001",
            },
            country: {
              type: "string",
              default: "India",
              description: "Country",
              example: "India",
            },
          },
        },
        Package: {
          type: "object",
          required: ["weight", "dimensions"],
          properties: {
            weight: {
              type: "number",
              format: "decimal",
              description: "Package weight in kilograms",
              example: 2.5,
            },
            dimensions: {
              type: "object",
              properties: {
                length: {
                  type: "number",
                  format: "decimal",
                  description: "Length in centimeters",
                  example: 30.0,
                },
                width: {
                  type: "number",
                  format: "decimal",
                  description: "Width in centimeters",
                  example: 25.0,
                },
                height: {
                  type: "number",
                  format: "decimal",
                  description: "Height in centimeters",
                  example: 15.0,
                },
              },
            },
            description: {
              type: "string",
              nullable: true,
              description: "Package description",
              example: "Electronics - Mobile Phone",
            },
            value: {
              type: "number",
              format: "decimal",
              nullable: true,
              description: "Package value for insurance",
              example: 25000.0,
            },
            fragile: {
              type: "boolean",
              default: false,
              description: "Whether package contains fragile items",
              example: false,
            },
          },
        },
        TrackingEvent: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Event identifier",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            shipmentId: {
              type: "string",
              format: "uuid",
              description: "Associated shipment ID",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            status: {
              type: "string",
              description: "Event status",
              example: "PICKED_UP",
            },
            message: {
              type: "string",
              description: "Event description",
              example: "Package picked up from origin",
            },
            location: {
              type: "string",
              nullable: true,
              description: "Event location",
              example: "Mumbai Hub",
            },
            timestamp: {
              type: "string",
              format: "date-time",
              description: "Event timestamp",
              example: "2024-01-01T10:30:00.000Z",
            },
          },
        },
        CreateShipmentRequest: {
          type: "object",
          required: [
            "orderId",
            "pickupAddress",
            "deliveryAddress",
            "packageDetails",
          ],
          properties: {
            orderId: {
              type: "string",
              description: "Unique order identifier",
              example: "ORD-2024-001",
            },
            pickupAddress: {
              $ref: "#/components/schemas/Address",
            },
            deliveryAddress: {
              $ref: "#/components/schemas/Address",
            },
            packageDetails: {
              $ref: "#/components/schemas/Package",
            },
            paymentType: {
              type: "string",
              enum: ["PREPAID", "COD"],
              default: "PREPAID",
              description: "Payment method",
              example: "PREPAID",
            },
            codAmount: {
              type: "number",
              format: "decimal",
              nullable: true,
              description: "COD amount (required if paymentType is COD)",
              example: 1500.5,
            },
            serviceType: {
              type: "string",
              enum: ["STANDARD", "EXPRESS", "ECONOMY"],
              default: "STANDARD",
              description: "Delivery service type",
              example: "STANDARD",
            },
            specialInstructions: {
              type: "string",
              nullable: true,
              description: "Special delivery instructions",
              example: "Handle with care - fragile items",
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
            meta: {
              type: "object",
              properties: {
                timestamp: {
                  type: "string",
                  format: "date-time",
                  example: "2024-01-01T00:00:00.000Z",
                },
                service: {
                  type: "string",
                  example: "shipment-service",
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
                details: {
                  type: "object",
                  nullable: true,
                  description: "Additional error details",
                },
              },
            },
            meta: {
              type: "object",
              properties: {
                timestamp: {
                  type: "string",
                  format: "date-time",
                  example: "2024-01-01T00:00:00.000Z",
                },
                service: {
                  type: "string",
                  example: "shipment-service",
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
              example: "2024-01-01T00:00:00.000Z",
            },
            uptime: {
              type: "number",
              description: "Service uptime in seconds",
              example: 3600,
            },
            service: {
              type: "string",
              example: "shipment-service",
            },
            version: {
              type: "string",
              example: "1.0.0",
            },
            database: {
              type: "string",
              enum: ["connected", "disconnected"],
              example: "connected",
            },
            redis: {
              type: "string",
              enum: ["connected", "disconnected"],
              example: "connected",
            },
            dependencies: {
              type: "object",
              properties: {
                partnerService: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      enum: ["healthy", "unhealthy"],
                    },
                    responseTime: {
                      type: "number",
                    },
                  },
                },
                walletService: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      enum: ["healthy", "unhealthy"],
                    },
                    responseTime: {
                      type: "number",
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
        name: "Shipments",
        description: "Shipment management operations",
      },
      {
        name: "Tracking",
        description: "Shipment tracking and status updates",
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
