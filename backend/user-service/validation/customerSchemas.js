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

// Create customer validation schema
const customerCreateSchema = Joi.object({
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
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
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
};
