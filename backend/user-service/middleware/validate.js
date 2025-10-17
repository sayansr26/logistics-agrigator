// User Service Validation Middleware
// Input validation using Joi following auth-service patterns

const Joi = require("joi");
const APIResponse = require("../shared/lib/response");

// Validation schemas for user service
const schemas = {
  // User Profile validation
  createProfile: Joi.object({
    // Authentication fields (required for creating user in auth-service)
    email: Joi.string().email().required(),
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
      .required()
      .messages({
        "string.pattern.base":
          "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character",
      }),
    role: Joi.string()
      .valid(
        "superadmin",
        "admin",
        "client",
        "accounts",
        "sales",
        "support",
        "customer",
        "customer_account",
        "customer_sales",
        "customer_support",
        "affiliate",
      )
      .default("client"),
    status: Joi.string().valid("active", "inactive").default("active"),
    // Profile fields
    firstName: Joi.string().min(1).max(100).required(),
    lastName: Joi.string().min(1).max(100).required(),
    phoneNumber: Joi.string()
      .pattern(/^\+?[1-9]\d{1,14}$/)
      .optional(),
    // Allow 'phone' as alias for phoneNumber (from frontend)
    phone: Joi.string()
      .pattern(/^\+?[1-9]\d{1,14}$/)
      .optional(),
    companyName: Joi.string().max(200).optional(),
    // Allow 'company' as alias for companyName (from frontend)
    company: Joi.string().max(200).optional(),
    designation: Joi.string().max(100).optional(),
    // Allow 'position' as alias for designation (from frontend)
    position: Joi.string().max(100).optional(),
    department: Joi.string().max(100).optional(),
    // Support both structured address object and individual fields
    address: Joi.alternatives()
      .try(
        // Structured address object
        Joi.object({
          street: Joi.string().required(),
          city: Joi.string().required(),
          state: Joi.string().required(),
          postalCode: Joi.string().required(),
          country: Joi.string().required(),
        }),
        // Simple string address from frontend
        Joi.string().max(500),
      )
      .optional(),
    // Individual address fields from frontend
    city: Joi.string().max(100).optional(),
    state: Joi.string().max(100).optional(),
    pincode: Joi.string().max(10).optional(),
    billingAddress: Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      postalCode: Joi.string().required(),
      country: Joi.string().required(),
    }).optional(),
    preferences: Joi.object({
      theme: Joi.string().valid("light", "dark", "auto").default("light"),
      notifications: Joi.object({
        email: Joi.boolean().default(true),
        sms: Joi.boolean().default(false),
        push: Joi.boolean().default(true),
      }).default({}),
      language: Joi.string().valid("en", "es", "fr", "de").default("en"),
    }).optional(),
    timezone: Joi.string().max(50).optional(),
    language: Joi.string().valid("en", "es", "fr", "de").default("en"),
    clientId: Joi.string().uuid().optional(),
    notes: Joi.string().max(1000).optional(),
    permissions: Joi.array().items(Joi.string()).optional(),
  }),

  updateProfile: Joi.object({
    firstName: Joi.string().min(1).max(100).optional(),
    lastName: Joi.string().min(1).max(100).optional(),
    phoneNumber: Joi.string()
      .pattern(/^\+?[1-9]\d{1,14}$/)
      .optional()
      .allow(null),
    companyName: Joi.string().max(200).optional().allow(null),
    designation: Joi.string().max(100).optional().allow(null),
    department: Joi.string().max(100).optional().allow(null),
    address: Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      postalCode: Joi.string().required(),
      country: Joi.string().required(),
    })
      .optional()
      .allow(null),
    billingAddress: Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      postalCode: Joi.string().required(),
      country: Joi.string().required(),
    })
      .optional()
      .allow(null),
    preferences: Joi.object().optional(),
    timezone: Joi.string().max(50).optional().allow(null),
    language: Joi.string().valid("en", "es", "fr", "de").optional(),
  }).min(1), // At least one field must be provided

  // Client validation
  createClient: Joi.object({
    name: Joi.string().min(1).max(200).required(),
    slug: Joi.string()
      .min(1)
      .max(100)
      .pattern(/^[a-z0-9-]+$/)
      .required(),
    domain: Joi.string().domain().optional().allow(null),
    contactEmail: Joi.string().email().required(),
    contactPhone: Joi.string()
      .pattern(/^\+?[1-9]\d{1,14}$/)
      .optional()
      .allow(null),
    businessType: Joi.string().max(100).optional().allow(null),
    industry: Joi.string().max(100).optional().allow(null),
    companySize: Joi.string()
      .valid("1-10", "11-50", "51-200", "201-500", "500+")
      .optional()
      .allow(null),
    address: Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      postalCode: Joi.string().required(),
      country: Joi.string().required(),
    })
      .optional()
      .allow(null),
    subscriptionTier: Joi.string()
      .valid("basic", "premium", "enterprise")
      .default("basic"),
  }),

  updateClient: Joi.object({
    name: Joi.string().min(1).max(200).optional(),
    slug: Joi.string()
      .min(1)
      .max(100)
      .pattern(/^[a-z0-9-]+$/)
      .optional(),
    domain: Joi.string().domain().optional().allow(null),
    contactEmail: Joi.string().email().optional(),
    contactPhone: Joi.string()
      .pattern(/^\+?[1-9]\d{1,14}$/)
      .optional()
      .allow(null),
    businessType: Joi.string().max(100).optional().allow(null),
    industry: Joi.string().max(100).optional().allow(null),
    companySize: Joi.string()
      .valid("1-10", "11-50", "51-200", "201-500", "500+")
      .optional()
      .allow(null),
    address: Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      postalCode: Joi.string().required(),
      country: Joi.string().required(),
    })
      .optional()
      .allow(null),
    subscriptionTier: Joi.string()
      .valid("basic", "premium", "enterprise")
      .optional(),
    isActive: Joi.boolean().optional(),
  }).min(1),

  // Client Registration validation (RBAC-003 - License-based deployment)
  registerClient: Joi.object({
    name: Joi.string().min(1).max(200).required(),
    email: Joi.string().email().required(),
    contactPerson: Joi.string().min(2).max(100).optional(),
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
      .optional()
      .messages({
        "string.pattern.base":
          "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character",
      }),
    licenseType: Joi.string()
      .valid("TRIAL", "STANDARD", "PROFESSIONAL", "ENTERPRISE")
      .default("STANDARD"),
    plan: Joi.string()
      .valid("MONTHLY", "QUARTERLY", "YEARLY", "LIFETIME")
      .default("MONTHLY"),
    services: Joi.array()
      .items(
        Joi.string().valid(
          "auth-service",
          "user-service",
          "api-gateway",
          "shipment-service",
          "partner-service",
          "wallet-service",
          "platform-service",
          "support-service",
        ),
      )
      .default([
        "auth-service",
        "user-service",
        "api-gateway",
        "shipment-service",
        "partner-service",
        "wallet-service",
      ]),
    maxActivations: Joi.number().integer().min(1).default(1),
    validityDays: Joi.number().integer().min(1).default(30),
    features: Joi.object({
      multiTenant: Joi.boolean().default(false),
      whiteLabel: Joi.boolean().default(false),
      apiAccess: Joi.boolean().default(true),
      customDomain: Joi.boolean().default(false),
      ssoEnabled: Joi.boolean().default(false),
      advancedAnalytics: Joi.boolean().default(false),
    }).optional(),
    limits: Joi.object({
      maxUsers: Joi.number().integer().min(1).optional(),
      maxShipments: Joi.number().integer().min(1).optional(),
      maxCustomers: Joi.number().integer().min(1).optional(),
      maxApiCalls: Joi.number().integer().min(1).optional(),
    }).optional(),
    registry: Joi.string().optional(),
    enableMonitoring: Joi.boolean().default(false),
  }),

  // Client Settings validation
  createClientSettings: Joi.object({
    clientId: Joi.string().uuid().required(),
    brandName: Joi.string().max(200).optional().allow(null, ""),
    logo: Joi.string().uri().optional().allow(null, ""),
    primaryColor: Joi.string()
      .pattern(/^#[0-9A-Fa-f]{6}$/)
      .optional()
      .allow(null, ""),
    secondaryColor: Joi.string()
      .pattern(/^#[0-9A-Fa-f]{6}$/)
      .optional()
      .allow(null, ""),
    favicon: Joi.string().uri().optional().allow(null, ""),
    features: Joi.object().optional().allow(null),
    limits: Joi.object().optional().allow(null),
    integrations: Joi.object().optional().allow(null),
    emailFromName: Joi.string().max(100).optional().allow(null, ""),
    emailFromAddress: Joi.string().email().optional().allow(null, ""),
    emailTemplates: Joi.object().optional().allow(null),
  }),

  updateClientSettings: Joi.object({
    brandName: Joi.string().max(200).optional().allow(null),
    logo: Joi.string().uri().max(500).optional().allow(null),
    primaryColor: Joi.string()
      .pattern(/^#[0-9A-Fa-f]{6}$/)
      .optional()
      .allow(null),
    secondaryColor: Joi.string()
      .pattern(/^#[0-9A-Fa-f]{6}$/)
      .optional()
      .allow(null),
    favicon: Joi.string().uri().max(500).optional().allow(null),
    features: Joi.object().optional().allow(null),
    limits: Joi.object({
      maxUsers: Joi.number().integer().min(1).optional(),
      maxShipments: Joi.number().integer().min(1).optional(),
      storageLimit: Joi.number().integer().min(1).optional(), // in MB
    })
      .optional()
      .allow(null),
    integrations: Joi.object().optional().allow(null),
    emailFromName: Joi.string().max(100).optional().allow(null),
    emailFromAddress: Joi.string().email().optional().allow(null),
    emailTemplates: Joi.object().optional().allow(null),
  }).min(1),

  // User Invitation validation
  createUserInvitation: Joi.object({
    clientId: Joi.string().uuid().required(),
    email: Joi.string().email().required(),
    role: Joi.string()
      .valid("admin", "finance", "operations", "client", "support")
      .default("client"),
    expiresAt: Joi.date().iso().optional(),
  }),

  createInvitation: Joi.object({
    email: Joi.string().email().required(),
    role: Joi.string()
      .valid("admin", "finance", "operations", "client", "support")
      .default("client"),
    clientId: Joi.string().uuid().required(),
  }),

  // Query parameter validation
  paginationQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string()
      .valid("createdAt", "updatedAt", "name", "email")
      .default("createdAt"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc"),
    search: Joi.string().max(100).optional(),
  }),

  // UUID parameter validation
  uuidParam: Joi.object({
    id: Joi.string().uuid().required(),
  }),

  clientIdParam: Joi.object({
    clientId: Joi.string().uuid().required(),
  }),
};

// Generic validation middleware factory
const validate = (schema, source = "body") => {
  return (req, res, next) => {
    const data =
      source === "body"
        ? req.body
        : source === "params"
          ? req.params
          : source === "query"
            ? req.query
            : req[source];

    const { error, value } = schema.validate(data, {
      abortEarly: false, // Return all validation errors
      stripUnknown: true, // Remove unknown fields
      convert: true, // Convert types when possible
    });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
        value: detail.context?.value,
      }));

      return res
        .status(400)
        .json(
          APIResponse.error(
            "Validation failed",
            "VALIDATION_ERROR",
            details,
            400,
          ),
        );
    }

    // Replace the original data with validated/sanitized data
    if (source === "body") req.body = value;
    else if (source === "params") req.params = value;
    else if (source === "query") req.query = value;
    else req[source] = value;

    next();
  };
};

// Specific validation middleware functions
const validateCreateProfile = validate(schemas.createProfile, "body");
const validateUpdateProfile = validate(schemas.updateProfile, "body");
const validateCreateClient = validate(schemas.createClient, "body");
const validateUpdateClient = validate(schemas.updateClient, "body");
const validateRegisterClient = validate(schemas.registerClient, "body");
const validateCreateClientSettings = validate(
  schemas.createClientSettings,
  "body",
);
const validateUpdateClientSettings = validate(
  schemas.updateClientSettings,
  "body",
);
const validateCreateUserInvitation = validate(
  schemas.createUserInvitation,
  "body",
);
const validateCreateInvitation = validate(schemas.createInvitation, "body");
const validatePaginationQuery = validate(schemas.paginationQuery, "query");
const validateUuidParam = validate(schemas.uuidParam, "params");
const validateClientIdParam = validate(schemas.clientIdParam, "params");

module.exports = {
  // Generic validator
  validate,

  // Schemas for direct use
  schemas,

  // Specific validators
  validateCreateProfile,
  validateUpdateProfile,
  validateCreateClient,
  validateUpdateClient,
  validateRegisterClient,
  validateCreateClientSettings,
  validateUpdateClientSettings,
  validateCreateUserInvitation,
  validateCreateInvitation,
  validatePaginationQuery,
  validateUuidParam,
  validateClientIdParam,
};
