/**
 * Payment Gateway Validation Schemas
 *
 * Style follows `validation/walletSchema.js`: per-rule `.messages()` and an
 * `"object.unknown"` message on every object schema.
 *
 * NOTE — `middleware/validate.js` validates with `{ stripUnknown: true }`, so
 * unknown keys are SILENTLY REMOVED rather than rejected; the
 * `"object.unknown"` messages only fire where a schema opts out of stripping.
 * Never rely on an unknown key reaching a controller.
 *
 * SECRET SEMANTICS (updateProviderConfigSchema):
 *   - key ABSENT / `undefined` -> leave the stored secret UNCHANGED
 *   - key present as `""`      -> CLEAR the stored secret
 *   - key present with a value -> REPLACE the stored secret
 * Because of this, secrets are `.allow("", null)` and never `.required()` —
 * a UI that renders a masked value must not be forced to re-send it.
 */

const Joi = require("joi");

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

const uuidRequired = Joi.string()
  .uuid({ version: ["uuidv4"] })
  .required()
  .messages({
    "string.guid": "Invalid UUID format",
    "any.required": "ID is required",
  });

const uuidOptional = Joi.string()
  .uuid({ version: ["uuidv4"] })
  .optional()
  .messages({
    "string.guid": "Invalid UUID format",
  });

const moneyRequired = Joi.number().positive().precision(2).required().messages({
  "number.base": "Amount must be a number",
  "number.positive": "Amount must be positive",
  "number.precision": "Amount can have at most 2 decimal places",
  "any.required": "Amount is required",
});

const moneyOptional = Joi.number().positive().precision(2).optional().messages({
  "number.base": "Amount must be a number",
  "number.positive": "Amount must be positive",
  "number.precision": "Amount can have at most 2 decimal places",
});

const currencySchema = Joi.string().valid("INR").default("INR").messages({
  "any.only": "Currency must be INR",
});

// External wallet id — a PHONE for outlets, never a UUID. See
// services/payments/walletIdentity.js.
const walletUserIdSchema = Joi.string()
  .min(1)
  .max(255)
  .trim()
  .required()
  .messages({
    "string.min": "walletUserId cannot be empty",
    "string.max": "walletUserId cannot exceed 255 characters",
    "any.required": "walletUserId is required",
  });

const clientCodeOptional = Joi.string().max(50).trim().optional().messages({
  "string.max": "Client code cannot exceed 50 characters",
});

// A credential field: undefined = unchanged, "" = clear, value = replace.
const credentialSchema = Joi.string()
  .max(512)
  .trim()
  .allow("", null)
  .optional()
  .messages({
    "string.base": "Credential must be a string",
    "string.max": "Credential cannot exceed 512 characters",
  });

const unknownFieldMessage = {
  "object.unknown": "Unknown field '{#label}' is not allowed",
};

const unknownQueryMessage = {
  "object.unknown": "Unknown query parameter '{#label}' is not allowed",
};

/**
 * Every provider the API will accept in a path/param position.
 * Single source of truth — three separate literal arrays used to drift here,
 * which meant a new provider 400'd at the router before reaching any service.
 */
const PAYMENT_PROVIDERS = [
  "razorpay",
  "ccavenue",
  "ccavenue_upi_qr",
  "stripe",
  "cashfree",
  "payu",
];

/** Providers with a real implementation that can actually take a payment. */
const IMPLEMENTED_PAYMENT_PROVIDERS = ["razorpay", "ccavenue"];

// Status enums — must stay in sync with the Prisma enums.
const PAYMENT_ORDER_STATUSES = [
  "CREATED",
  "PENDING",
  "PAID",
  "CREDITED",
  "RECONCILE_PENDING",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
  "REFUNDED",
];

const MANUAL_TOPUP_STATUSES = [
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "CREDITED",
  "FAILED",
];

const pageSchema = Joi.number().integer().min(0).default(0).messages({
  "number.integer": "Page must be an integer",
  "number.min": "Page cannot be negative",
});

const sizeSchema = Joi.number().integer().min(1).max(100).default(20).messages({
  "number.integer": "Size must be an integer",
  "number.min": "Size must be at least 1",
  "number.max": "Size cannot exceed 100",
});

const sortDirSchema = Joi.string()
  .valid("asc", "desc")
  .default("desc")
  .messages({
    "any.only": "sortDir must be one of: asc, desc",
  });

const startDateSchema = Joi.date().iso().optional().messages({
  "date.format": "Start date must be in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)",
});

const endDateSchema = Joi.date()
  .iso()
  .min(Joi.ref("startDate"))
  .optional()
  .messages({
    "date.format": "End date must be in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)",
    "date.min": "End date must be after start date",
  });

// ---------------------------------------------------------------------------
// Route parameter schemas
// ---------------------------------------------------------------------------

const providerParamsSchema = Joi.object({
  provider: Joi.string()
    .valid(...PAYMENT_PROVIDERS)
    .required()
    .messages({
      "any.only": `Provider must be one of: ${PAYMENT_PROVIDERS.join(", ")}`,
      "any.required": "Provider is required",
    }),
}).messages(unknownFieldMessage);

const orderIdParamsSchema = Joi.object({
  orderId: uuidRequired.messages({
    "string.guid": "Invalid order ID format",
    "any.required": "Order ID is required",
  }),
}).messages(unknownFieldMessage);

const requestIdParamsSchema = Joi.object({
  requestId: uuidRequired.messages({
    "string.guid": "Invalid request ID format",
    "any.required": "Request ID is required",
  }),
}).messages(unknownFieldMessage);

// ---------------------------------------------------------------------------
// Admin — provider configuration
// ---------------------------------------------------------------------------

/**
 * Update a payment provider's configuration.
 *
 * DB-AWARE RULE LIVES IN THE SERVICE, NOT HERE:
 * "enabling a mode requires its full credential trio (keyId + keySecret +
 * webhookSecret)" cannot be expressed in Joi, because a credential may already
 * be stored encrypted in the DB and therefore omitted from this payload. Joi
 * only sees the request body. The service layer merges the incoming values with
 * the stored ones and rejects an enable that would leave the active mode with
 * an incomplete trio.
 */
const updateProviderConfigSchema = Joi.object({
  isEnabled: Joi.boolean().optional().messages({
    "boolean.base": "isEnabled must be a boolean",
  }),

  mode: Joi.string().valid("TEST", "LIVE").optional().messages({
    "any.only": "Mode must be one of: TEST, LIVE",
  }),

  /**
   * The descriptor-driven write shape: `{test: {<fieldName>: value}, live: {…}}`
   * where `<fieldName>` is a credential field declared in
   * `services/payments/credentialDescriptors.js` (razorpay: keyId/keySecret/
   * webhookSecret; ccavenue: merchantId/accessCode/workingKey).
   *
   * `.pattern()` keys are KNOWN keys as far as Joi is concerned, so
   * `middleware/validate.js`'s `stripUnknown: true` keeps them — only keys that
   * match neither a declared child nor a pattern are stripped. The field names
   * are deliberately NOT enumerated here: the descriptor module is the single
   * source of truth for which names are valid, and it rejects an unknown one in
   * the service layer.
   */
  credentials: Joi.object({
    test: Joi.object().pattern(
      Joi.string().max(40),
      Joi.string().allow("", null).max(512),
    ),
    live: Joi.object().pattern(
      Joi.string().max(40),
      Joi.string().allow("", null).max(512),
    ),
  })
    .optional()
    .messages({
      // NOTE: no `{...}` in this message — Joi parses braces as a template.
      "object.base": "credentials must be an object with test / live keys",
    }),

  // LEGACY FLAT KEYS — kept for one release. The service maps each onto the
  // descriptor field that aliases to it, so an old client posting
  // `liveKeySecret` still reaches CCAvenue's `workingKey`.
  testKeyId: credentialSchema,
  testKeySecret: credentialSchema,
  testWebhookSecret: credentialSchema,
  liveKeyId: credentialSchema,
  liveKeySecret: credentialSchema,
  liveWebhookSecret: credentialSchema,

  currency: Joi.string().valid("INR").optional().messages({
    "any.only": "Currency must be INR",
  }),

  minAmount: moneyOptional.messages({
    "number.positive": "Minimum amount must be positive",
    "number.precision": "Minimum amount can have at most 2 decimal places",
  }),

  maxAmount: Joi.number()
    .positive()
    .precision(2)
    .greater(Joi.ref("minAmount"))
    .optional()
    .messages({
      "number.positive": "Maximum amount must be positive",
      "number.precision": "Maximum amount can have at most 2 decimal places",
      "number.greater":
        "Maximum amount must be greater than the minimum amount",
    }),

  quickAmounts: Joi.array()
    .items(
      Joi.number().positive().precision(2).messages({
        "number.positive": "Quick amounts must be positive",
        "number.precision": "Quick amounts can have at most 2 decimal places",
      }),
    )
    .max(8)
    .unique()
    .optional()
    .messages({
      "array.base": "quickAmounts must be an array of numbers",
      "array.max": "You can configure at most 8 quick amounts",
      "array.unique": "Quick amounts must be unique",
    }),

  paymentLinkExpiryHours: Joi.number()
    .integer()
    .min(1)
    .max(720)
    .optional()
    .messages({
      "number.integer": "Payment link expiry must be a whole number of hours",
      "number.min": "Payment link expiry must be at least 1 hour",
      "number.max": "Payment link expiry cannot exceed 720 hours (30 days)",
    }),
})
  .min(1)
  .messages({
    ...unknownFieldMessage,
    "object.min": "At least one field must be provided",
  });

const testConnectionSchema = Joi.object({
  mode: Joi.string().valid("TEST", "LIVE").optional().messages({
    "any.only": "Mode must be one of: TEST, LIVE",
  }),
}).messages(unknownFieldMessage);

// ---------------------------------------------------------------------------
// Admin — manual top-up policy
// ---------------------------------------------------------------------------

const updateTopupPolicySchema = Joi.object({
  manualMaxPerTransaction: moneyOptional.messages({
    "number.positive": "Manual max per transaction must be positive",
    "number.precision":
      "Manual max per transaction can have at most 2 decimal places",
  }),

  manualApprovalThreshold: moneyOptional.messages({
    "number.positive": "Manual approval threshold must be positive",
    "number.precision":
      "Manual approval threshold can have at most 2 decimal places",
  }),

  manualMaxPerDayPerUser: moneyOptional.messages({
    "number.positive": "Manual max per day per user must be positive",
    "number.precision":
      "Manual max per day per user can have at most 2 decimal places",
  }),

  requireReason: Joi.boolean().optional().messages({
    "boolean.base": "requireReason must be a boolean",
  }),

  requireReference: Joi.boolean().optional().messages({
    "boolean.base": "requireReference must be a boolean",
  }),
})
  .min(1)
  .messages({
    ...unknownFieldMessage,
    "object.min": "At least one field must be provided",
  });

// ---------------------------------------------------------------------------
// Self-service top-up (authenticated user pays for their own wallet)
// ---------------------------------------------------------------------------

const selfTopupInitiateSchema = Joi.object({
  amount: moneyRequired,

  currency: currencySchema,

  // NO DEFAULT, deliberately: when the caller omits `provider`,
  // `topupService.initiateSelfTopup` asks
  // `providerConfigService.resolveActiveProviderName()` which gateway is
  // actually enabled. Defaulting to "razorpay" here made a CCAvenue-only
  // deployment silently mint Razorpay orders.
  provider: Joi.string()
    .valid(...IMPLEMENTED_PAYMENT_PROVIDERS)
    .optional()
    .messages({
      "any.only": `Provider must be one of: ${IMPLEMENTED_PAYMENT_PROVIDERS.join(", ")}`,
    }),

  idempotencyKey: Joi.string().max(100).trim().optional().messages({
    "string.max": "Idempotency key cannot exceed 100 characters",
  }),

  metadata: Joi.object().optional().messages({
    "object.base": "Metadata must be a valid object",
  }),
}).messages(unknownFieldMessage);

const selfTopupVerifySchema = Joi.object({
  orderId: uuidRequired.messages({
    "string.guid": "Invalid order ID format",
    "any.required": "Order ID is required",
  }),

  razorpay_order_id: Joi.string().max(255).trim().required().messages({
    "string.max": "razorpay_order_id cannot exceed 255 characters",
    "any.required": "razorpay_order_id is required",
  }),

  razorpay_payment_id: Joi.string().max(255).trim().required().messages({
    "string.max": "razorpay_payment_id cannot exceed 255 characters",
    "any.required": "razorpay_payment_id is required",
  }),

  razorpay_signature: Joi.string().max(512).trim().required().messages({
    "string.max": "razorpay_signature cannot exceed 512 characters",
    "any.required": "razorpay_signature is required",
  }),
}).messages(unknownFieldMessage);

// ---------------------------------------------------------------------------
// Admin — payment links
// ---------------------------------------------------------------------------

const createPaymentLinkSchema = Joi.object({
  walletUserId: walletUserIdSchema,
  clientCode: clientCodeOptional,
  subjectUserId: uuidOptional,

  amount: Joi.number().positive().required().messages({
    "number.base": "Amount must be a number",
    "number.positive": "Amount must be positive",
    "any.required": "Amount is required",
  }),

  currency: currencySchema,

  description: Joi.string().max(255).trim().allow("").optional().messages({
    "string.max": "Description cannot exceed 255 characters",
  }),

  payerName: Joi.string().max(255).trim().allow("").optional().messages({
    "string.max": "Payer name cannot exceed 255 characters",
  }),

  payerEmail: Joi.string()
    .email({ tlds: { allow: false } })
    .max(255)
    .trim()
    .allow("")
    .optional()
    .messages({
      "string.email": "Payer email must be a valid email address",
      "string.max": "Payer email cannot exceed 255 characters",
    }),

  payerPhone: Joi.string().max(20).trim().allow("").optional().messages({
    "string.max": "Payer phone cannot exceed 20 characters",
  }),

  expiryHours: Joi.number().integer().min(1).max(720).optional().messages({
    "number.integer": "Expiry must be a whole number of hours",
    "number.min": "Expiry must be at least 1 hour",
    "number.max": "Expiry cannot exceed 720 hours (30 days)",
  }),

  notes: Joi.string().max(500).trim().allow("").optional().messages({
    "string.max": "Notes cannot exceed 500 characters",
  }),
}).messages(unknownFieldMessage);

// ---------------------------------------------------------------------------
// Admin — manual (offline) top-up
// ---------------------------------------------------------------------------

/**
 * Manual top-up credits real money without a gateway confirming it, so `reason`
 * and `externalReference` (the NEFT/UTR/cheque/receipt number) are ALWAYS
 * required at the schema level — the DB policy flags (requireReason /
 * requireReference) may only ever tighten this, never relax it.
 */
const manualTopupSchema = Joi.object({
  walletUserId: walletUserIdSchema,
  clientCode: clientCodeOptional,
  subjectUserId: uuidOptional,

  amount: moneyRequired,
  currency: currencySchema,

  reason: Joi.string().min(10).max(1000).trim().required().messages({
    "string.min": "Reason must be at least 10 characters",
    "string.max": "Reason cannot exceed 1000 characters",
    "any.required": "Reason is required for a manual top-up",
  }),

  externalReference: Joi.string().min(3).max(255).trim().required().messages({
    "string.min": "External reference must be at least 3 characters",
    "string.max": "External reference cannot exceed 255 characters",
    "any.required":
      "External reference (UTR / cheque / receipt number) is required for a manual top-up",
  }),

  metadata: Joi.object().optional().messages({
    "object.base": "Metadata must be a valid object",
  }),
}).messages(unknownFieldMessage);

const approveManualTopupSchema = Joi.object({
  reviewRemarks: Joi.string().max(1000).trim().allow("").optional().messages({
    "string.max": "Review remarks cannot exceed 1000 characters",
  }),
}).messages(unknownFieldMessage);

const rejectManualTopupSchema = Joi.object({
  reviewRemarks: Joi.string().min(10).max(1000).trim().required().messages({
    "string.min": "Rejection remarks must be at least 10 characters",
    "string.max": "Rejection remarks cannot exceed 1000 characters",
    "any.required": "Rejection remarks are required",
  }),
}).messages(unknownFieldMessage);

// ---------------------------------------------------------------------------
// List query schemas
// ---------------------------------------------------------------------------

const topupOrderListQuerySchema = Joi.object({
  page: pageSchema,
  size: sizeSchema,
  sortDir: sortDirSchema,

  status: Joi.string()
    .valid(...PAYMENT_ORDER_STATUSES)
    .optional()
    .messages({
      "any.only": `Status must be one of: ${PAYMENT_ORDER_STATUSES.join(", ")}`,
    }),

  provider: Joi.string()
    .valid(...PAYMENT_PROVIDERS)
    .optional()
    .messages({
      "any.only": `Provider must be one of: ${PAYMENT_PROVIDERS.join(", ")}`,
    }),

  walletUserId: Joi.string().max(255).trim().optional().messages({
    "string.max": "walletUserId filter cannot exceed 255 characters",
  }),

  clientCode: clientCodeOptional,
  startDate: startDateSchema,
  endDate: endDateSchema,
}).messages(unknownQueryMessage);

const paymentLinkListQuerySchema = Joi.object({
  page: pageSchema,
  size: sizeSchema,
  sortDir: sortDirSchema,

  status: Joi.string()
    .valid(...PAYMENT_ORDER_STATUSES)
    .optional()
    .messages({
      "any.only": `Status must be one of: ${PAYMENT_ORDER_STATUSES.join(", ")}`,
    }),

  walletUserId: Joi.string().max(255).trim().optional().messages({
    "string.max": "walletUserId filter cannot exceed 255 characters",
  }),

  clientCode: clientCodeOptional,
  startDate: startDateSchema,
  endDate: endDateSchema,
}).messages(unknownQueryMessage);

const manualTopupListQuerySchema = Joi.object({
  page: pageSchema,
  size: sizeSchema,
  sortDir: sortDirSchema,

  status: Joi.string()
    .valid(...MANUAL_TOPUP_STATUSES)
    .optional()
    .messages({
      "any.only": `Status must be one of: ${MANUAL_TOPUP_STATUSES.join(", ")}`,
    }),

  walletUserId: Joi.string().max(255).trim().optional().messages({
    "string.max": "walletUserId filter cannot exceed 255 characters",
  }),

  clientCode: clientCodeOptional,
  startDate: startDateSchema,
  endDate: endDateSchema,
}).messages(unknownQueryMessage);

/**
 * Reconcile queue: orders the gateway says are PAID but whose wallet credit did
 * not land. Defaults to the statuses that need a human, so an unfiltered call
 * returns exactly the work queue.
 */
const reconcileQueueQuerySchema = Joi.object({
  page: pageSchema,
  size: sizeSchema,
  sortDir: sortDirSchema,

  status: Joi.string()
    .valid(...PAYMENT_ORDER_STATUSES)
    .default("RECONCILE_PENDING")
    .messages({
      "any.only": `Status must be one of: ${PAYMENT_ORDER_STATUSES.join(", ")}`,
    }),

  provider: Joi.string()
    .valid(...PAYMENT_PROVIDERS)
    .optional()
    .messages({
      "any.only": `Provider must be one of: ${PAYMENT_PROVIDERS.join(", ")}`,
    }),

  walletUserId: Joi.string().max(255).trim().optional().messages({
    "string.max": "walletUserId filter cannot exceed 255 characters",
  }),

  clientCode: clientCodeOptional,
  startDate: startDateSchema,
  endDate: endDateSchema,
}).messages(unknownQueryMessage);

module.exports = {
  // Params
  providerParamsSchema,
  orderIdParamsSchema,
  requestIdParamsSchema,

  // Admin config
  updateProviderConfigSchema,
  testConnectionSchema,
  updateTopupPolicySchema,

  // Self top-up
  selfTopupInitiateSchema,
  selfTopupVerifySchema,

  // Payment links
  createPaymentLinkSchema,

  // Manual top-up
  manualTopupSchema,
  approveManualTopupSchema,
  rejectManualTopupSchema,

  // Lists
  topupOrderListQuerySchema,
  paymentLinkListQuerySchema,
  manualTopupListQuerySchema,
  reconcileQueueQuerySchema,

  // Enums (shared with services/controllers)
  PAYMENT_PROVIDERS,
  IMPLEMENTED_PAYMENT_PROVIDERS,
  PAYMENT_ORDER_STATUSES,
  MANUAL_TOPUP_STATUSES,
};
