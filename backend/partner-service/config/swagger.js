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
        // Zone System v2: Pincode Type schemas
        PincodeType: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Unique pincode type identifier",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            name: {
              type: "string",
              description: "Pincode type name (unique)",
              example: "Metro",
            },
            charge: {
              type: "number",
              format: "decimal",
              description: "Associated charge amount",
              example: 25.5,
            },
            description: {
              type: "string",
              nullable: true,
              description: "Optional description",
              example: "Metro city pincode type",
            },
            isActive: {
              type: "boolean",
              description: "Whether the type is active",
              example: true,
            },
            assignedPincodeCount: {
              type: "integer",
              description: "Number of pincodes assigned to this type",
              example: 150,
            },
            createdAt: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T00:00:00.000Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              example: "2024-01-01T00:00:00.000Z",
            },
          },
        },
        CreatePincodeTypeRequest: {
          type: "object",
          required: ["name", "charge"],
          properties: {
            name: {
              type: "string",
              minLength: 2,
              maxLength: 50,
              pattern: "^[A-Za-z0-9_-]+$",
              description: "Unique pincode type name",
              example: "Metro",
            },
            charge: {
              type: "number",
              minimum: 0,
              maximum: 9999999.99,
              description: "Associated charge amount",
              example: 25.5,
            },
            description: {
              type: "string",
              maxLength: 255,
              nullable: true,
              description: "Optional description",
              example: "Metro city pincode type",
            },
            isActive: {
              type: "boolean",
              default: true,
              description: "Whether the type is active",
            },
          },
        },
        BulkAssignPincodesRequest: {
          type: "object",
          required: ["pincodeCodes"],
          properties: {
            pincodeCodes: {
              type: "array",
              items: {
                type: "string",
                pattern: "^[0-9]{6}$",
              },
              minItems: 1,
              maxItems: 1000,
              description: "Array of 6-digit pincode codes to assign",
              example: ["110001", "110002", "110003"],
            },
          },
        },
        BulkAssignmentResult: {
          type: "object",
          properties: {
            assignedCount: {
              type: "integer",
              description: "Number of successfully assigned pincodes",
              example: 95,
            },
            totalRequested: {
              type: "integer",
              description: "Total number of pincodes requested",
              example: 100,
            },
            validPincodes: {
              type: "integer",
              description: "Number of valid pincodes found",
              example: 98,
            },
            skippedDuplicates: {
              type: "integer",
              description: "Number of already assigned (skipped) pincodes",
              example: 3,
            },
            missingPincodes: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Pincode codes not found in database",
              example: ["999999", "888888"],
            },
          },
        },
        PincodeTypesByPincode: {
          type: "object",
          properties: {
            pincode: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                code: { type: "string", example: "110001" },
                areaName: { type: "string", nullable: true },
                district: { type: "string", nullable: true },
                status: { type: "boolean" },
                state: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    name: { type: "string" },
                    code: { type: "string" },
                  },
                },
              },
            },
            types: {
              type: "array",
              items: {
                $ref: "#/components/schemas/PincodeType",
              },
            },
            activeTypes: {
              type: "array",
              items: {
                $ref: "#/components/schemas/PincodeType",
              },
              description: "Only active pincode types",
            },
            totalCharge: {
              type: "number",
              description: "Sum of charges from all active types",
              example: 75.5,
            },
          },
        },
        // Zone System v2: Zone Type enum
        ZoneType: {
          type: "string",
          enum: ["DISTANCE", "GEOLOGICAL"],
          description:
            "Type of zone - GEOLOGICAL for geographical associations, DISTANCE for milestone-based",
          example: "DISTANCE",
        },
        // Zone System v2: Zone Milestone schema
        ZoneMilestone: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Unique milestone identifier",
            },
            minKm: {
              type: "integer",
              minimum: 0,
              description: "Minimum distance in kilometers (inclusive)",
              example: 0,
            },
            maxKm: {
              type: "integer",
              minimum: 0,
              description: "Maximum distance in kilometers (inclusive)",
              example: 50,
            },
            suffix: {
              type: "string",
              description: "Zone suffix (A, B, C, etc.)",
              example: "A",
            },
            sortOrder: {
              type: "integer",
              description: "Order of milestone (1-based)",
              example: 1,
            },
            rangeLabel: {
              type: "string",
              description: "Human-readable range label",
              example: "0-50 km (Zone A)",
            },
          },
        },
        // Zone System v2: Create Distance Zone Request
        CreateDistanceZoneRequest: {
          type: "object",
          required: ["name", "zoneType", "partnerIds", "milestones"],
          properties: {
            name: {
              type: "string",
              minLength: 3,
              maxLength: 255,
              description: "Zone name (unique per partner)",
              example: "North Region Distance Zone",
            },
            description: {
              type: "string",
              maxLength: 1000,
              nullable: true,
              description: "Optional zone description",
              example: "Distance-based zone for north region",
            },
            status: {
              type: "boolean",
              default: true,
              description: "Whether the zone is active",
            },
            zoneType: {
              type: "string",
              enum: ["DISTANCE"],
              description: "Must be DISTANCE for distance zones",
              example: "DISTANCE",
            },
            partnerIds: {
              type: "array",
              items: {
                type: "string",
                pattern: "^c[a-z0-9]{24}$",
              },
              minItems: 1,
              maxItems: 100,
              description: "Array of partner IDs (CUID format)",
              example: ["clfz1234567890abcdefghij"],
            },
            milestones: {
              type: "array",
              items: {
                type: "object",
                required: ["minKm", "maxKm"],
                properties: {
                  minKm: {
                    type: "integer",
                    minimum: 0,
                    description: "Minimum distance in km",
                    example: 0,
                  },
                  maxKm: {
                    type: "integer",
                    minimum: 0,
                    description: "Maximum distance in km",
                    example: 50,
                  },
                },
              },
              minItems: 1,
              maxItems: 26,
              description: "Distance milestones (must be adjacent, no gaps)",
              example: [
                { minKm: 0, maxKm: 50 },
                { minKm: 51, maxKm: 500 },
                { minKm: 501, maxKm: 1000 },
              ],
            },
          },
        },
        // Zone System v2: Calculate Distance Request
        CalculateDistanceRequest: {
          type: "object",
          required: ["fromPincode", "toPincode"],
          properties: {
            fromPincode: {
              type: "string",
              pattern: "^[0-9]{6}$",
              description: "Source pincode (6 digits)",
              example: "110001",
            },
            toPincode: {
              type: "string",
              pattern: "^[0-9]{6}$",
              description: "Destination pincode (6 digits)",
              example: "400001",
            },
          },
        },
        // Zone System v2: Calculate Distance Response
        CalculateDistanceResponse: {
          type: "object",
          properties: {
            fromPincode: { type: "string", example: "110001" },
            toPincode: { type: "string", example: "400001" },
            distanceKm: {
              type: "number",
              description: "Distance in kilometers",
              example: 1153.72,
            },
            distanceMiles: {
              type: "number",
              description: "Distance in miles",
              example: 716.97,
            },
            fromLocation: {
              type: "object",
              properties: {
                latitude: { type: "number", example: 28.6139 },
                longitude: { type: "number", example: 77.209 },
                area: { type: "string", nullable: true },
                city: { type: "string", nullable: true },
                state: { type: "string", nullable: true },
              },
            },
            toLocation: {
              type: "object",
              properties: {
                latitude: { type: "number", example: 18.9387 },
                longitude: { type: "number", example: 72.8354 },
                area: { type: "string", nullable: true },
                city: { type: "string", nullable: true },
                state: { type: "string", nullable: true },
              },
            },
            calculationMethod: {
              type: "string",
              example: "haversine",
            },
            cached: {
              type: "boolean",
              description: "Whether result was served from cache",
              example: false,
            },
          },
        },
        // Zone System v2: Match Zone Request
        MatchZoneRequest: {
          type: "object",
          required: ["fromPincode", "toPincode"],
          properties: {
            fromPincode: {
              type: "string",
              pattern: "^[0-9]{6}$",
              description: "Source pincode (6 digits)",
              example: "110001",
            },
            toPincode: {
              type: "string",
              pattern: "^[0-9]{6}$",
              description: "Destination pincode (6 digits)",
              example: "400001",
            },
            partnerId: {
              type: "string",
              pattern: "^c[a-z0-9]{24}$",
              nullable: true,
              description: "Partner ID (optional if user has partnerId in JWT)",
              example: "clfz1234567890abcdefghij",
            },
          },
        },
        // Zone System v2: Match Zone Response
        MatchZoneResponse: {
          type: "object",
          properties: {
            matched: {
              type: "boolean",
              description: "Whether a matching milestone was found",
              example: true,
            },
            distanceKm: {
              type: "number",
              description: "Calculated distance in km",
              example: 1153.72,
            },
            partnerId: {
              type: "string",
              example: "clfz1234567890abcdefghij",
            },
            zone: {
              type: "object",
              nullable: true,
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string", example: "North Region Distance Zone" },
                description: { type: "string", nullable: true },
              },
            },
            milestone: {
              $ref: "#/components/schemas/ZoneMilestone",
            },
            zoneSuffix: {
              type: "string",
              description: "The matched zone suffix (e.g., A, B, C)",
              example: "C",
            },
            fromLocation: {
              type: "object",
              description: "Source location details",
            },
            toLocation: {
              type: "object",
              description: "Destination location details",
            },
          },
        },
        // Zone (updated to include zoneType)
        Zone: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Unique zone identifier",
            },
            partnerId: {
              type: "string",
              description: "Partner ID (CUID format)",
            },
            name: {
              type: "string",
              description: "Zone name",
              example: "Zone A",
            },
            description: {
              type: "string",
              nullable: true,
              description: "Zone description",
            },
            zoneType: {
              $ref: "#/components/schemas/ZoneType",
            },
            status: {
              type: "boolean",
              description: "Whether the zone is active",
              example: true,
            },
            milestones: {
              type: "array",
              items: {
                $ref: "#/components/schemas/ZoneMilestone",
              },
              description: "Distance milestones (only for DISTANCE zones)",
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
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
        name: "Zones",
        description:
          "Zone management - supports GEOLOGICAL (geographical) and DISTANCE (milestone-based) zones",
      },
      {
        name: "DistanceZones",
        description:
          "Distance zone operations - calculate distance, match zones by distance, manage milestones",
      },
      {
        name: "PincodeTypes",
        description:
          "Pincode type management (Zone System v2) - Admin/Operations only",
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
