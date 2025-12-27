// Customer Validation Schemas - Joi validation for customer management APIs
// Updated to match Prisma schema: CustomerType = B2C | B2B

const Joi = require("joi");

// Validation middleware wrapper
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
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
    req.body = value; // Use validated/stripped data
    next();
  };
};

// Bank details schema (kept for Outlet model, not Customer)
const bankDetailsSchema = Joi.object({
  bankName: Joi.string().max(100).optional(),
  accountNumber: Joi.string().max(30).optional(),
  ifscCode: Joi.string().max(15).optional(),
  accountHolderName: Joi.string().max(100).optional(),
})
  .optional()
  .allow(null);

// =====================================================
// CUSTOMER SCHEMAS (B2C/B2B with login credentials)
// =====================================================

// Create customer validation schema
// - B2C: Direct customer (no outlet association)
// - B2B: Customer under an outlet (requires outletId)
// - password: Required to create login account
const customerCreateSchema = Joi.object({
  // Required fields
  name: Joi.string().min(2).max(200).required().messages({
    "string.empty": "Customer name is required",
    "string.min": "Customer name must be at least 2 characters",
    "string.max": "Customer name cannot exceed 200 characters",
    "any.required": "Customer name is required",
  }),
  email: Joi.string().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Invalid email format",
    "any.required": "Email is required",
  }),
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .optional()
    .allow(null, "")
    .messages({
      "string.pattern.base": "Invalid phone number format",
    }),
  
  // Customer type: B2C (direct) or B2B (outlet-linked)
  customerType: Joi.string()
    .valid("B2C", "B2B")
    .default("B2C")
    .messages({
      "any.only": "Customer type must be either B2C or B2B",
    }),
  
  // Outlet association (required for B2B customers)
  outletId: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Invalid outlet ID format",
  }),
  
  // Address fields
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
  
  // Login credentials (required for creating auth user)
  password: Joi.string()
    .min(8)
    .required()
    .messages({
      "string.empty": "Password is required",
      "string.min": "Password must be at least 8 characters",
      "any.required": "Password is required to create customer login",
    }),
  
  // Optional client association
  clientId: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Invalid client ID format",
  }),
  
  // Feature access control
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
})
  .custom((value, helpers) => {
    // Require outletId when customerType is B2B
    if (value.customerType === "B2B" && !value.outletId) {
      return helpers.error("any.custom", { message: "outletId is required for B2B customers" });
    }
    // Clear outletId for B2C customers
    if (value.customerType === "B2C") {
      value.outletId = null;
    }
    return value;
  })
  .messages({
    "any.custom": "{{#message}}",
  });

// Update customer validation schema
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
  
  // Customer type change
  customerType: Joi.string().valid("B2C", "B2B").optional().messages({
    "any.only": "Customer type must be either B2C or B2B",
  }),
  
  // Outlet association
  outletId: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Invalid outlet ID format",
  }),
  
  // Address fields
  address: Joi.string().max(500).optional().allow(null, ""),
  city: Joi.string().max(100).optional().allow(null, ""),
  state: Joi.string().max(100).optional().allow(null, ""),
  pincode: Joi.string().max(10).optional().allow(null, ""),
  country: Joi.string().max(100).optional(),
  
  // Password reset (optional - leave blank to keep existing)
  password: Joi.string()
    .min(8)
    .optional()
    .allow(null, "")
    .messages({
      "string.min": "Password must be at least 8 characters",
    }),
  
  // Feature access control
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
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

// =====================================================
// OUTLET SCHEMAS (for Outlet entity, not Customer)
// =====================================================

// Admin credentials schema for outlet creation
const adminCredentialsSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.empty": "Admin email is required",
    "string.email": "Invalid admin email format",
    "any.required": "Admin email is required",
  }),
  password: Joi.string().min(8).required().messages({
    "string.empty": "Admin password is required",
    "string.min": "Admin password must be at least 8 characters",
    "any.required": "Admin password is required",
  }),
  firstName: Joi.string().max(100).optional().allow(null, "").messages({
    "string.max": "First name cannot exceed 100 characters",
  }),
  lastName: Joi.string().max(100).optional().allow(null, "").messages({
    "string.max": "Last name cannot exceed 100 characters",
  }),
  name: Joi.string().max(200).optional().allow(null, "").messages({
    "string.max": "Name cannot exceed 200 characters",
  }),
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .optional()
    .allow(null, "")
    .messages({
      "string.pattern.base": "Invalid admin phone number format",
    }),
});

// Outlet create validation schema (for Outlet model)
const outletCreateSchema = Joi.object({
  code: Joi.string().max(50).optional().allow(null, "").messages({
    "string.max": "Outlet code cannot exceed 50 characters",
  }),
  name: Joi.string().min(2).max(200).required().messages({
    "string.empty": "Outlet name is required",
    "string.min": "Outlet name must be at least 2 characters",
    "string.max": "Outlet name cannot exceed 200 characters",
    "any.required": "Outlet name is required",
  }),
  contactPerson: Joi.string().max(100).optional().allow(null, "").messages({
    "string.max": "Contact person name cannot exceed 100 characters",
  }),
  email: Joi.string().email().required().messages({
    "string.empty": "Outlet email is required",
    "string.email": "Invalid email format",
    "any.required": "Outlet email is required",
  }),
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .optional()
    .allow(null, "")
    .messages({
      "string.pattern.base": "Invalid phone number format",
    }),
  type: Joi.string()
    .valid("RETAIL", "WAREHOUSE", "FRANCHISE", "DIRECT", "retail", "warehouse", "franchise", "direct")
    .default("RETAIL")
    .messages({
      "any.only": "Type must be one of: RETAIL, WAREHOUSE, FRANCHISE, DIRECT",
    }),
  status: Joi.string()
    .valid("ACTIVE", "INACTIVE", "PENDING", "SUSPENDED", "active", "inactive", "pending", "suspended")
    .default("ACTIVE")
    .messages({
      "any.only": "Status must be one of: ACTIVE, INACTIVE, PENDING, SUSPENDED",
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
  gstNumber: Joi.string().max(20).optional().allow(null, "").messages({
    "string.max": "GST number cannot exceed 20 characters",
  }),
  panNumber: Joi.string().max(20).optional().allow(null, "").messages({
    "string.max": "PAN number cannot exceed 20 characters",
  }),
  bankDetails: bankDetailsSchema,
  isActive: Joi.boolean().default(true),
  // Admin credentials for outlet login (required)
  adminCredentials: adminCredentialsSchema.required().messages({
    "any.required": "Admin credentials are required for outlet creation",
  }),
}).options({ stripUnknown: true });

// Outlet update validation schema
const outletUpdateSchema = Joi.object({
  code: Joi.string().max(50).optional().messages({
    "string.max": "Outlet code cannot exceed 50 characters",
  }),
  name: Joi.string().min(2).max(200).optional().messages({
    "string.min": "Outlet name must be at least 2 characters",
    "string.max": "Outlet name cannot exceed 200 characters",
  }),
  contactPerson: Joi.string().max(100).optional().allow(null, "").messages({
    "string.max": "Contact person name cannot exceed 100 characters",
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
  type: Joi.string()
    .valid("RETAIL", "WAREHOUSE", "FRANCHISE", "DIRECT", "retail", "warehouse", "franchise", "direct")
    .optional()
    .messages({
      "any.only": "Type must be one of: RETAIL, WAREHOUSE, FRANCHISE, DIRECT",
    }),
  status: Joi.string()
    .valid("ACTIVE", "INACTIVE", "PENDING", "SUSPENDED", "active", "inactive", "pending", "suspended")
    .optional()
    .messages({
      "any.only": "Status must be one of: ACTIVE, INACTIVE, PENDING, SUSPENDED",
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
  country: Joi.string().max(100).optional().messages({
    "string.max": "Country cannot exceed 100 characters",
  }),
  gstNumber: Joi.string().max(20).optional().allow(null, "").messages({
    "string.max": "GST number cannot exceed 20 characters",
  }),
  panNumber: Joi.string().max(20).optional().allow(null, "").messages({
    "string.max": "PAN number cannot exceed 20 characters",
  }),
  bankDetails: bankDetailsSchema,
  isActive: Joi.boolean().optional(),
}).options({ stripUnknown: true });

// =====================================================
// CUSTOMER USER SCHEMAS (team members under a customer)
// =====================================================

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

// =====================================================
// ASSIGNMENT SCHEMAS
// =====================================================

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

// Direct customer create validation schema (for public signup - no password needed, handled by auth)
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

module.exports = {
  validateCustomerCreate: validate(customerCreateSchema),
  validateCustomerUpdate: validate(customerUpdateSchema),
  validateCustomerUserCreate: validate(customerUserCreateSchema),
  validateCustomerUserUpdate: validate(customerUserUpdateSchema),
  validateAssignCustomers: validate(assignCustomersSchema),
  validateUnassignCustomers: validate(unassignCustomersSchema),
  validateBulkAssignment: validate(bulkAssignmentSchema),
  validateUpdateAccessLevel: validate(updateAccessLevelSchema),
  // Outlet-specific validations
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
