const Joi = require("joi");

// Common validation patterns
const uuidSchema = Joi.string()
  .uuid({ version: ["uuidv4"] })
  .required()
  .messages({
    "string.guid": "Invalid UUID format",
    "any.required": "ID is required",
  });

const amountSchema = Joi.number()
  .positive()
  .precision(2)
  .max(999999.99)
  .required()
  .messages({
    "number.positive": "Amount must be positive",
    "number.precision": "Amount can have at most 2 decimal places",
    "number.max": "Amount cannot exceed ₹9,99,999.99",
    "any.required": "Amount is required",
  });

const referenceSchema = Joi.string()
  .min(1)
  .max(255)
  .trim()
  .required()
  .messages({
    "string.min": "Reference cannot be empty",
    "string.max": "Reference cannot exceed 255 characters",
    "any.required": "Reference is required",
  });

const descriptionSchema = Joi.string()
  .max(500)
  .trim()
  .allow("")
  .optional()
  .messages({
    "string.max": "Description cannot exceed 500 characters",
  });

// Route parameter schemas
const userIdParamsSchema = Joi.object({
  userId: uuidSchema,
});

const paymentIdParamsSchema = Joi.object({
  paymentId: Joi.string().min(1).max(255).required().messages({
    "string.min": "Payment ID cannot be empty",
    "string.max": "Payment ID cannot exceed 255 characters",
    "any.required": "Payment ID is required",
  }),
});

// Wallet operation schemas
const debitWalletSchema = Joi.object({
  amount: amountSchema,
  reference: referenceSchema,
  description: descriptionSchema,
}).messages({
  "object.unknown": "Unknown field '{#label}' is not allowed",
});

const creditWalletSchema = Joi.object({
  amount: amountSchema,
  reference: referenceSchema,
  description: descriptionSchema,
}).messages({
  "object.unknown": "Unknown field '{#label}' is not allowed",
});

const loadBalanceSchema = Joi.object({
  amount: amountSchema,
  reference: referenceSchema,
  description: descriptionSchema,
}).messages({
  "object.unknown": "Unknown field '{#label}' is not allowed",
});

// Transaction history query schema
const transactionHistoryQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.integer": "Page must be an integer",
    "number.min": "Page must be at least 1",
  }),

  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),

  type: Joi.string()
    .valid("DEBIT", "CREDIT", "REFUND", "LOAD_BALANCE", "ADJUSTMENT")
    .optional()
    .messages({
      "any.only":
        "Transaction type must be one of: DEBIT, CREDIT, REFUND, LOAD_BALANCE, ADJUSTMENT",
    }),

  status: Joi.string()
    .valid("PENDING", "COMPLETED", "FAILED", "CANCELLED", "PROCESSING")
    .optional()
    .messages({
      "any.only":
        "Status must be one of: PENDING, COMPLETED, FAILED, CANCELLED, PROCESSING",
    }),

  reference: Joi.string().max(255).trim().optional().messages({
    "string.max": "Reference filter cannot exceed 255 characters",
  }),

  startDate: Joi.date().iso().optional().messages({
    "date.format":
      "Start date must be in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)",
  }),

  endDate: Joi.date().iso().min(Joi.ref("startDate")).optional().messages({
    "date.format": "End date must be in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)",
    "date.min": "End date must be after start date",
  }),
}).messages({
  "object.unknown": "Unknown query parameter '{#label}' is not allowed",
});

// Admin queries schemas
const adminWalletsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.integer": "Page must be an integer",
    "number.min": "Page must be at least 1",
  }),

  limit: Joi.number().integer().min(1).max(100).default(50).messages({
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),

  status: Joi.string()
    .valid("ACTIVE", "INACTIVE", "SUSPENDED", "BLOCKED")
    .optional()
    .messages({
      "any.only": "Status must be one of: ACTIVE, INACTIVE, SUSPENDED, BLOCKED",
    }),

  clientCode: Joi.string().max(50).trim().optional().messages({
    "string.max": "Client code cannot exceed 50 characters",
  }),

  searchUserId: Joi.string().max(255).trim().optional().messages({
    "string.max": "Search user ID cannot exceed 255 characters",
  }),
}).messages({
  "object.unknown": "Unknown query parameter '{#label}' is not allowed",
});

const adminTransactionsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.integer": "Page must be an integer",
    "number.min": "Page must be at least 1",
  }),

  limit: Joi.number().integer().min(1).max(100).default(50).messages({
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),

  type: Joi.string()
    .valid("DEBIT", "CREDIT", "REFUND", "LOAD_BALANCE", "ADJUSTMENT")
    .optional()
    .messages({
      "any.only":
        "Transaction type must be one of: DEBIT, CREDIT, REFUND, LOAD_BALANCE, ADJUSTMENT",
    }),

  status: Joi.string()
    .valid("PENDING", "COMPLETED", "FAILED", "CANCELLED", "PROCESSING")
    .optional()
    .messages({
      "any.only":
        "Status must be one of: PENDING, COMPLETED, FAILED, CANCELLED, PROCESSING",
    }),

  userId: Joi.string().max(255).trim().optional().messages({
    "string.max": "User ID search cannot exceed 255 characters",
  }),

  reference: Joi.string().max(255).trim().optional().messages({
    "string.max": "Reference filter cannot exceed 255 characters",
  }),

  startDate: Joi.date().iso().optional().messages({
    "date.format":
      "Start date must be in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)",
  }),

  endDate: Joi.date().iso().min(Joi.ref("startDate")).optional().messages({
    "date.format": "End date must be in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)",
    "date.min": "End date must be after start date",
  }),
}).messages({
  "object.unknown": "Unknown query parameter '{#label}' is not allowed",
});

// Payment gateway schemas (for future implementation)
const paymentGatewayInitiateSchema = Joi.object({
  amount: amountSchema,
  currency: Joi.string().valid("INR", "USD").default("INR").messages({
    "any.only": "Currency must be one of: INR, USD",
  }),

  provider: Joi.string()
    .valid("razorpay", "payu", "stripe", "cashfree")
    .required()
    .messages({
      "any.only": "Provider must be one of: razorpay, payu, stripe, cashfree",
      "any.required": "Payment provider is required",
    }),

  metadata: Joi.object().optional().messages({
    "object.base": "Metadata must be a valid object",
  }),
}).messages({
  "object.unknown": "Unknown field '{#label}' is not allowed",
});

const paymentGatewayWebhookSchema = Joi.object({
  paymentId: Joi.string().min(1).max(255).required().messages({
    "string.min": "Payment ID cannot be empty",
    "string.max": "Payment ID cannot exceed 255 characters",
    "any.required": "Payment ID is required",
  }),

  status: Joi.string()
    .valid("COMPLETED", "FAILED", "CANCELLED", "REFUNDED")
    .required()
    .messages({
      "any.only":
        "Status must be one of: COMPLETED, FAILED, CANCELLED, REFUNDED",
      "any.required": "Payment status is required",
    }),

  gatewayData: Joi.object().optional().messages({
    "object.base": "Gateway data must be a valid object",
  }),
}).messages({
  "object.unknown": "Unknown field '{#label}' is not allowed",
});

// Client code validation (for multi-tenant support)
const clientCodeSchema = Joi.string()
  .min(1)
  .max(50)
  .trim()
  .default("DEFAULT")
  .messages({
    "string.min": "Client code cannot be empty",
    "string.max": "Client code cannot exceed 50 characters",
  });

// Admin wallet proxy - query schema for listing client wallets
const adminClientWalletsQuerySchema = Joi.object({
  clientCode: Joi.string().max(50).trim().optional(),
  page: Joi.number().integer().min(0).default(0),
  size: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().max(50).optional(),
  sortDir: Joi.string().valid("asc", "desc").optional(),
  status: Joi.string().optional(),
}).options({ allowUnknown: true });

// Admin wallet proxy - query schema for listing client transactions
const adminClientTransactionsQuerySchema = Joi.object({
  clientCode: Joi.string().max(50).trim().optional(),
  page: Joi.number().integer().min(0).default(0),
  size: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().max(50).optional(),
  sortDir: Joi.string().valid("asc", "desc").optional(),
  type: Joi.string().optional(),
  status: Joi.string().optional(),
  userId: Joi.string().max(255).optional(),
}).options({ allowUnknown: true });

// Admin wallet proxy - get wallet query schema
const adminGetWalletQuerySchema = Joi.object({
  userId: Joi.string().min(1).max(255).required().messages({
    "any.required": "userId query parameter is required",
  }),
  clientCode: Joi.string().max(50).trim().optional(),
}).options({ allowUnknown: true });

// Admin wallet proxy - topup/debit/refund body schema
const adminWalletTransactionSchema = Joi.object({
  userId: Joi.string().min(1).max(255).required().messages({
    "any.required": "userId is required",
  }),
  clientCode: Joi.string().max(50).trim().optional(),
  amount: Joi.number().positive().required().messages({
    "number.positive": "Amount must be positive",
    "any.required": "Amount is required",
  }),
  currency: Joi.string().max(10).optional().default("INR"),
  reference_id: Joi.string().max(255).trim().optional(),
  transaction_id: Joi.number().integer().optional(),
  description: Joi.string().max(500).trim().optional(),
  metadata: Joi.alternatives()
    .try(Joi.string().max(1000).trim(), Joi.object())
    .optional(),
  remarks: Joi.object().optional(),
}).messages({
  "object.unknown": "Unknown field '{#label}' is not allowed",
});

// Admin wallet proxy - update user status body schema
const adminUpdateUserStatusSchema = Joi.object({
  userId: Joi.string().min(1).max(255).required().messages({
    "any.required": "userId is required",
  }),
  status: Joi.string().min(1).max(50).required().messages({
    "any.required": "status is required",
  }),
  clientCode: Joi.string().max(50).trim().optional(),
}).messages({
  "object.unknown": "Unknown field '{#label}' is not allowed",
});

// Admin wallet proxy - sync wallets body schema
const adminSyncWalletsSchema = Joi.object({
  userIds: Joi.array()
    .items(Joi.string().min(1).max(255))
    .min(1)
    .max(100)
    .required()
    .messages({
      "array.min": "At least one userId is required",
      "array.max": "Maximum 100 userIds per sync request",
      "any.required": "userIds array is required",
    }),
  clientCode: Joi.string().max(50).trim().optional(),
}).messages({
  "object.unknown": "Unknown field '{#label}' is not allowed",
});

module.exports = {
  // Parameter schemas
  userIdParamsSchema,
  paymentIdParamsSchema,

  // Wallet operation schemas
  debitWalletSchema,
  creditWalletSchema,
  loadBalanceSchema,

  // Query schemas
  transactionHistoryQuerySchema,
  adminWalletsQuerySchema,
  adminTransactionsQuerySchema,

  // Payment gateway schemas
  paymentGatewayInitiateSchema,
  paymentGatewayWebhookSchema,

  // Common schemas
  uuidSchema,
  amountSchema,
  referenceSchema,
  descriptionSchema,
  clientCodeSchema,

  // Admin wallet proxy schemas
  adminClientWalletsQuerySchema,
  adminClientTransactionsQuerySchema,
  adminGetWalletQuerySchema,
  adminWalletTransactionSchema,
  adminUpdateUserStatusSchema,
  adminSyncWalletsSchema,
};
