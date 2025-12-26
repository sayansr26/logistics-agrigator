// Customer Validation Schemas - Joi validation for customer management APIs

const Joi = require("joi");

// Validation middleware wrapper
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));
      return res.status(400).json({
        status: "error",
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: errors,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }
    next();
  };
};

// Bank details schema for outlets
const bankDetailsSchema = Joi.object({
  bankName: Joi.string().max(100).optional(),
  accountNumber: Joi.string().max(30).optional(),
  ifscCode: Joi.string().max(15).optional(),
  accountHolderName: Joi.string().max(100).optional(),
})
  .optional()
  .allow(null);

// Base customer fields (shared between DIRECT and OUTLET)
const baseCustomerFields = {
  name: Joi.string().min(2).max(200).required().messages({
    "string.empty": "Customer name is required",
    "string.min": "Customer name must be at least 2 characters",
    "string.max": "Customer name cannot exceed 200 characters",
  }),
  email: Joi.string().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Invalid email format",
  }),
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .optional()
    .allow(null, "")
    .messages({
      "string.pattern.base": "Invalid phone number format",
    }),
  clientId: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Invalid client ID format",
  }),
  customerType: Joi.string()
    .valid("DIRECT", "OUTLET")
    .default("DIRECT")
    .messages({
      "any.only": "Customer type must be either DIRECT or OUTLET",
    }),
  monthlyShipmentLimit: Joi.number()
    .integer()
    .min(0)
    .optional()
    .allow(null)
    .messages({
      "number.base": "Monthly shipment limit must be a number",
      "number.min": "Monthly shipment limit cannot be negative",
    }),
  enabledModules: Joi.array()
    .items(
      Joi.string().valid(
        "shipment",
        "billing",
        "wallet",
        "analytics",
        "support",
      ),
    )
    .default(["shipment", "billing", "wallet", "analytics"])
    .messages({
      "array.includes": "Invalid module specified",
    }),
  isActive: Joi.boolean().default(true),
};

// Outlet-specific fields
const outletFields = {
  outletCode: Joi.string().max(50).optional().allow(null, "").messages({
    "string.max": "Outlet code cannot exceed 50 characters",
  }),
  outletName: Joi.string().max(200).optional().allow(null, "").messages({
    "string.max": "Outlet name cannot exceed 200 characters",
  }),
  retailerName: Joi.string().max(200).optional().allow(null, "").messages({
    "string.max": "Retailer name cannot exceed 200 characters",
  }),
  contactPerson: Joi.string().max(100).optional().allow(null, "").messages({
    "string.max": "Contact person name cannot exceed 100 characters",
  }),
  outletStatus: Joi.string()
    .valid("active", "inactive", "suspended")
    .default("active")
    .messages({
      "any.only": "Outlet status must be one of: active, inactive, suspended",
    }),
  outletType: Joi.string()
    .valid("franchise", "direct", "retail", "warehouse")
    .optional()
    .allow(null, "")
    .messages({
      "any.only":
        "Outlet type must be one of: franchise, direct, retail, warehouse",
    }),
  businessHours: Joi.string().max(255).optional().allow(null, "").messages({
    "string.max": "Business hours cannot exceed 255 characters",
  }),
  gstNumber: Joi.string().max(20).optional().allow(null, "").messages({
    "string.max": "GST number cannot exceed 20 characters",
  }),
  panNumber: Joi.string().max(20).optional().allow(null, "").messages({
    "string.max": "PAN number cannot exceed 20 characters",
  }),
  bankDetails: bankDetailsSchema,
  assignedCouriers: Joi.array()
    .items(Joi.string().max(50))
    .default([])
    .messages({
      "array.base": "Assigned couriers must be an array",
    }),
  serviceAreas: Joi.array().items(Joi.string().max(20)).default([]).messages({
    "array.base": "Service areas must be an array",
  }),
  address: Joi.string().max(500).optional().allow(null, "").messages({
    "string.max": "Address cannot exceed 500 characters",
  }),
  city: Joi.string().max(100).optional().allow(null, "").messages({
    "string.max": "City cannot exceed 100 characters",
  }),
  state: Joi.string().max(100).optional().allow(null, "").messages({
    "string.max": "State cannot exceed 100 characters",
  }),
  pincode: Joi.string().max(10).optional().allow(null, "").messages({
    "string.max": "Pincode cannot exceed 10 characters",
  }),
  country: Joi.string().max(100).default("India").messages({
    "string.max": "Country cannot exceed 100 characters",
  }),
};

// Create customer validation schema (supports both DIRECT and OUTLET)
const customerCreateSchema = Joi.object({
  ...baseCustomerFields,
  ...outletFields,
}).when(Joi.object({ customerType: Joi.string().valid("OUTLET") }).unknown(), {
  then: Joi.object({
    outletCode: Joi.string().max(50).required().messages({
      "string.empty": "Outlet code is required for OUTLET type",
      "any.required": "Outlet code is required for OUTLET type",
    }),
    outletName: Joi.string().max(200).required().messages({
      "string.empty": "Outlet name is required for OUTLET type",
      "any.required": "Outlet name is required for OUTLET type",
    }),
    contactPerson: Joi.string().max(100).required().messages({
      "string.empty": "Contact person is required for OUTLET type",
      "any.required": "Contact person is required for OUTLET type",
    }),
  }),
});

// Update customer validation schema (supports both DIRECT and OUTLET)
const customerUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(200).optional().messages({
    "string.min": "Customer name must be at least 2 characters",
    "string.max": "Customer name cannot exceed 200 characters",
  }),
  email: Joi.string().email().optional().messages({
    "string.email": "Invalid email format",
  }),
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .optional()
    .allow(null, "")
    .messages({
      "string.pattern.base": "Invalid phone number format",
    }),
  clientId: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Invalid client ID format",
  }),
  customerType: Joi.string().valid("DIRECT", "OUTLET").optional().messages({
    "any.only": "Customer type must be either DIRECT or OUTLET",
  }),
  monthlyShipmentLimit: Joi.number()
    .integer()
    .min(0)
    .optional()
    .allow(null)
    .messages({
      "number.base": "Monthly shipment limit must be a number",
      "number.min": "Monthly shipment limit cannot be negative",
    }),
  enabledModules: Joi.array()
    .items(
      Joi.string().valid(
        "shipment",
        "billing",
        "wallet",
        "analytics",
        "support",
      ),
    )
    .optional()
    .messages({
      "array.includes": "Invalid module specified",
    }),
  isActive: Joi.boolean().optional(),
  // Outlet-specific update fields
  outletCode: Joi.string().max(50).optional().allow(null, ""),
  outletName: Joi.string().max(200).optional().allow(null, ""),
  retailerName: Joi.string().max(200).optional().allow(null, ""),
  contactPerson: Joi.string().max(100).optional().allow(null, ""),
  outletStatus: Joi.string()
    .valid("active", "inactive", "suspended")
    .optional(),
  outletType: Joi.string()
    .valid("franchise", "direct", "retail", "warehouse")
    .optional()
    .allow(null, ""),
  businessHours: Joi.string().max(255).optional().allow(null, ""),
  gstNumber: Joi.string().max(20).optional().allow(null, ""),
  panNumber: Joi.string().max(20).optional().allow(null, ""),
  bankDetails: bankDetailsSchema,
  assignedCouriers: Joi.array().items(Joi.string().max(50)).optional(),
  serviceAreas: Joi.array().items(Joi.string().max(20)).optional(),
  address: Joi.string().max(500).optional().allow(null, ""),
  city: Joi.string().max(100).optional().allow(null, ""),
  state: Joi.string().max(100).optional().allow(null, ""),
  pincode: Joi.string().max(10).optional().allow(null, ""),
  country: Joi.string().max(100).optional(),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

// Outlet-specific create validation schema (customerType=OUTLET with required fields)
const outletCreateSchema = Joi.object({
  ...baseCustomerFields,
  customerType: Joi.string().valid("OUTLET").default("OUTLET"),
  // Required outlet fields
  outletCode: Joi.string().max(50).required().messages({
    "string.empty": "Outlet code is required",
    "any.required": "Outlet code is required",
  }),
  outletName: Joi.string().max(200).required().messages({
    "string.empty": "Outlet name is required",
    "any.required": "Outlet name is required",
  }),
  contactPerson: Joi.string().max(100).required().messages({
    "string.empty": "Contact person is required",
    "any.required": "Contact person is required",
  }),
  address: Joi.string().max(500).required().messages({
    "string.empty": "Address is required",
    "any.required": "Address is required",
  }),
  city: Joi.string().max(100).required().messages({
    "string.empty": "City is required",
    "any.required": "City is required",
  }),
  state: Joi.string().max(100).required().messages({
    "string.empty": "State is required",
    "any.required": "State is required",
  }),
  pincode: Joi.string().max(10).required().messages({
    "string.empty": "Pincode is required",
    "any.required": "Pincode is required",
  }),
  // Optional outlet fields
  retailerName: Joi.string().max(200).optional().allow(null, ""),
  outletStatus: Joi.string()
    .valid("active", "inactive", "suspended")
    .default("active"),
  outletType: Joi.string()
    .valid("franchise", "direct", "retail", "warehouse")
    .optional()
    .allow(null, ""),
  businessHours: Joi.string().max(255).optional().allow(null, ""),
  gstNumber: Joi.string().max(20).optional().allow(null, ""),
  panNumber: Joi.string().max(20).optional().allow(null, ""),
  bankDetails: bankDetailsSchema,
  assignedCouriers: Joi.array().items(Joi.string().max(50)).default([]),
  serviceAreas: Joi.array().items(Joi.string().max(20)).default([]),
  country: Joi.string().max(100).default("India"),
});

// Outlet update validation schema
const outletUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(200).optional(),
  email: Joi.string().email().optional(),
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .optional()
    .allow(null, ""),
  clientId: Joi.string().uuid().optional().allow(null),
  monthlyShipmentLimit: Joi.number().integer().min(0).optional().allow(null),
  enabledModules: Joi.array()
    .items(
      Joi.string().valid(
        "shipment",
        "billing",
        "wallet",
        "analytics",
        "support",
      ),
    )
    .optional(),
  isActive: Joi.boolean().optional(),
  // Outlet fields
  outletCode: Joi.string().max(50).optional(),
  outletName: Joi.string().max(200).optional(),
  retailerName: Joi.string().max(200).optional().allow(null, ""),
  contactPerson: Joi.string().max(100).optional(),
  outletStatus: Joi.string()
    .valid("active", "inactive", "suspended")
    .optional(),
  outletType: Joi.string()
    .valid("franchise", "direct", "retail", "warehouse")
    .optional()
    .allow(null, ""),
  businessHours: Joi.string().max(255).optional().allow(null, ""),
  gstNumber: Joi.string().max(20).optional().allow(null, ""),
  panNumber: Joi.string().max(20).optional().allow(null, ""),
  bankDetails: bankDetailsSchema,
  assignedCouriers: Joi.array().items(Joi.string().max(50)).optional(),
  serviceAreas: Joi.array().items(Joi.string().max(20)).optional(),
  address: Joi.string().max(500).optional(),
  city: Joi.string().max(100).optional(),
  state: Joi.string().max(100).optional(),
  pincode: Joi.string().max(10).optional(),
  country: Joi.string().max(100).optional(),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

// Direct customer create validation schema (for public signup)
const directCustomerCreateSchema = Joi.object({
  name: Joi.string().min(2).max(200).required().messages({
    "string.empty": "Name is required",
    "string.min": "Name must be at least 2 characters",
  }),
  email: Joi.string().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Invalid email format",
  }),
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .optional()
    .allow(null, ""),
  firstName: Joi.string().max(100).optional(),
  lastName: Joi.string().max(100).optional(),
});

// Create customer user validation schema
const customerUserCreateSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    "string.empty": "User ID is required",
    "string.guid": "Invalid user ID format",
  }),
  role: Joi.string()
    .valid("customer", "customer_account", "customer_sales", "customer_support")
    .default("customer")
    .messages({
      "any.only":
        "Invalid role. Must be one of: customer, customer_account, customer_sales, customer_support",
    }),
  enabledModules: Joi.array()
    .items(
      Joi.string().valid(
        "shipment",
        "billing",
        "wallet",
        "analytics",
        "support",
      ),
    )
    .default(["shipment", "billing"])
    .messages({
      "array.includes": "Invalid module specified",
    }),
});

// Update customer user validation schema
const customerUserUpdateSchema = Joi.object({
  role: Joi.string()
    .valid("customer", "customer_account", "customer_sales", "customer_support")
    .optional()
    .messages({
      "any.only":
        "Invalid role. Must be one of: customer, customer_account, customer_sales, customer_support",
    }),
  enabledModules: Joi.array()
    .items(
      Joi.string().valid(
        "shipment",
        "billing",
        "wallet",
        "analytics",
        "support",
      ),
    )
    .optional()
    .messages({
      "array.includes": "Invalid module specified",
    }),
  isActive: Joi.boolean().optional(),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

// Assignment validation schemas
const assignCustomersSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    "string.empty": "User ID is required",
    "string.guid": "Invalid user ID format",
  }),
  customerIds: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .required()
    .messages({
      "array.min": "At least one customer ID is required",
      "string.guid": "Invalid customer ID format",
    }),
  accessLevel: Joi.string().valid("FULL", "RESTRICTED").optional().messages({
    "any.only": "Access level must be either FULL or RESTRICTED",
  }),
});

const unassignCustomersSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    "string.empty": "User ID is required",
    "string.guid": "Invalid user ID format",
  }),
  customerIds: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .required()
    .messages({
      "array.min": "At least one customer ID is required",
      "string.guid": "Invalid customer ID format",
    }),
});

const bulkAssignmentSchema = Joi.object({
  assignments: Joi.array()
    .items(
      Joi.object({
        userId: Joi.string().uuid().required(),
        customerIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
        accessLevel: Joi.string().valid("FULL", "RESTRICTED").optional(),
      }),
    )
    .min(1)
    .required()
    .messages({
      "array.min": "At least one assignment is required",
    }),
});

const updateAccessLevelSchema = Joi.object({
  accessLevel: Joi.string().valid("FULL", "RESTRICTED").required().messages({
    "string.empty": "Access level is required",
    "any.only": "Access level must be either FULL or RESTRICTED",
  }),
});

module.exports = {
  validateCustomerCreate: validate(customerCreateSchema),
  validateCustomerUpdate: validate(customerUpdateSchema),
  validateCustomerUserCreate: validate(customerUserCreateSchema),
  validateCustomerUserUpdate: validate(customerUserUpdateSchema),
  validateAssignCustomers: validate(assignCustomersSchema),
  validateUnassignCustomers: validate(unassignCustomersSchema),
  validateBulkAssignment: validate(bulkAssignmentSchema),
  validateUpdateAccessLevel: validate(updateAccessLevelSchema),
  // New outlet-specific validations
  validateOutletCreate: validate(outletCreateSchema),
  validateOutletUpdate: validate(outletUpdateSchema),
  validateDirectCustomerCreate: validate(directCustomerCreateSchema),
  // Export raw schemas for reuse
  customerCreateSchema,
  customerUpdateSchema,
  outletCreateSchema,
  outletUpdateSchema,
  directCustomerCreateSchema,
};
