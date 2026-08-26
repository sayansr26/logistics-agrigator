/**
 * Static-QR Validation Schemas — Wave 4
 *
 * Style follows `validation/paymentSchema.js`: per-rule `.messages()` and an
 * `"object.unknown"` message on every object schema.
 *
 * NOTE — `middleware/validate.js` validates with `{ stripUnknown: true }`, so
 * unknown keys are SILENTLY REMOVED rather than rejected; the
 * `"object.unknown"` messages only fire where a schema opts out of stripping.
 * Never rely on an unknown key reaching a controller.
 *
 * TWO RULES THIS FILE ENFORCES THAT NOTHING DOWNSTREAM CAN RECOVER FROM:
 *
 *  1. A NEW QR MUST CARRY AN ATTRIBUTION KEY (`qrIdentifier` OR `vpa`).
 *     `qrCollectionService.resolveQr` matches on exactly those two columns, so
 *     a row with neither can never be matched to a payment — every rupee paid
 *     against it would sit in the unattributed queue forever.
 *
 *  2. A QR IS NEVER REPOINTED. `updateQrCodeSchema` FORBIDS `walletUserId` /
 *     `clientCode` / `subjectUserId` outright rather than stripping them, so an
 *     operator who tries gets told to deactivate-and-reissue instead of
 *     silently having their edit dropped. `outletQrService.assertNoRepoint`
 *     repeats the refusal for non-HTTP callers.
 *
 * MONEY IN THESE SCHEMAS IS RUPEES. `manualQrCollectionSchema.amount` is a
 * rupee amount and the controller converts it to integer paise exactly once via
 * `ccavenueCrypto.parseAmountToPaise` (decimal-string arithmetic, never
 * `amount * 100`). `.strict()` on that field is deliberate: with Joi's default
 * `convert: true`, `.precision(2)` ROUNDS a 3-decimal amount instead of
 * rejecting it, and silently inventing a paise value on a money field is
 * exactly what the paise-exact credit path must never be handed.
 */

const Joi = require("joi");

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

const UNKNOWN_MESSAGE = { "object.unknown": "Unknown field is not allowed" };

// External wallet id — a PHONE for outlets, never a UUID. See
// services/payments/walletIdentity.js.
const walletUserIdRequired = Joi.string()
  .min(1)
  .max(255)
  .trim()
  .required()
  .messages({
    "string.base": "walletUserId must be a string",
    "string.empty": "walletUserId cannot be empty",
    "string.min": "walletUserId cannot be empty",
    "string.max": "walletUserId cannot exceed 255 characters",
    "any.required":
      "walletUserId is required (the external wallet id, e.g. the outlet's phone number)",
  });

const walletUserIdOptional = Joi.string().min(1).max(255).trim().messages({
  "string.base": "walletUserId must be a string",
  "string.empty": "walletUserId cannot be empty",
  "string.max": "walletUserId cannot exceed 255 characters",
});

const clientCodeOptional = Joi.string().max(50).trim().messages({
  "string.base": "clientCode must be a string",
  "string.max": "clientCode cannot exceed 50 characters",
});

const uuidOptional = Joi.string()
  .uuid({ version: ["uuidv4"] })
  .messages({
    "string.guid": "Invalid UUID format",
  });

const providerOptional = Joi.string().max(50).trim().messages({
  "string.max": "provider cannot exceed 50 characters",
});

const modeSchema = Joi.string().valid("TEST", "LIVE").messages({
  "any.only": "mode must be TEST or LIVE",
});

const qrIdentifierOptional = Joi.string().max(190).trim().messages({
  "string.base": "qrIdentifier must be a string",
  "string.empty": "qrIdentifier cannot be empty",
  "string.max": "qrIdentifier cannot exceed 190 characters",
});

const vpaOptional = Joi.string().max(190).trim().messages({
  "string.base": "vpa must be a string",
  "string.empty": "vpa cannot be empty",
  "string.max": "vpa cannot exceed 190 characters",
});

const qrPayloadOptional = Joi.string().max(4096).trim().allow(null).messages({
  "string.max": "qrPayload cannot exceed 4096 characters",
});

const qrImageUrlOptional = Joi.string().max(2048).trim().allow(null).messages({
  "string.max": "qrImageUrl cannot exceed 2048 characters",
});

const labelOptional = Joi.string().max(120).trim().allow(null).messages({
  "string.max": "label cannot exceed 120 characters",
});

const outletNameOptional = Joi.string().max(200).trim().allow(null).messages({
  "string.max": "outletName cannot exceed 200 characters",
});

// Velocity / alerting signals. NOT credit gates — see the OutletPaymentQr
// schema comment: an attributed payment always credits, because the money is
// already in the merchant account.
const signalAmount = Joi.number().positive().precision(2).allow(null).messages({
  "number.base": "Amount must be a number",
  "number.positive": "Amount must be positive",
  "number.precision": "Amount can have at most 2 decimal places",
});

const signalCount = Joi.number().integer().positive().allow(null).messages({
  "number.base": "maxPerDayCount must be a number",
  "number.integer": "maxPerDayCount must be a whole number",
  "number.positive": "maxPerDayCount must be positive",
});

const pageSchema = Joi.number().integer().min(0).default(0).messages({
  "number.base": "page must be a number",
  "number.integer": "page must be a whole number",
  "number.min": "page cannot be negative (pagination is 0-based)",
});

const sizeSchema = Joi.number().integer().min(1).max(100).default(20).messages({
  "number.base": "size must be a number",
  "number.integer": "size must be a whole number",
  "number.min": "size must be at least 1",
  "number.max": "size cannot exceed 100",
});

const sortDirSchema = Joi.string()
  .valid("asc", "desc")
  .default("desc")
  .messages({
    "any.only": "sortDir must be asc or desc",
  });

const startDateSchema = Joi.date().iso().messages({
  "date.base": "startDate must be a valid date",
  "date.format": "startDate must be an ISO-8601 date",
});

const endDateSchema = Joi.date().iso().min(Joi.ref("startDate")).messages({
  "date.base": "endDate must be a valid date",
  "date.format": "endDate must be an ISO-8601 date",
  "date.min": "endDate must be on or after startDate",
});

// The forbidden-identity fields on update. FORBIDDEN, not stripped: an operator
// who tries to move a QR must be TOLD the procedure, not silently ignored.
const repointForbidden = (field) =>
  Joi.any()
    .forbidden()
    .messages({
      "any.unknown": `${field} cannot be changed on an existing QR. A QR is never repointed to another outlet — deactivate this QR (POST /codes/:id/deactivate) and issue a new one, so past collections keep pointing at the outlet that actually received the money.`,
    });

// ---------------------------------------------------------------------------
// QR registry
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/wallet/topup/qr/codes
 *
 * `.or("qrIdentifier", "vpa")` is the load-bearing rule — see rule 1 in the
 * file header.
 */
const createQrCodeSchema = Joi.object({
  walletUserId: walletUserIdRequired,
  clientCode: clientCodeOptional,
  subjectUserId: uuidOptional,
  outletId: uuidOptional,
  outletName: outletNameOptional,
  provider: providerOptional,
  qrIdentifier: qrIdentifierOptional,
  vpa: vpaOptional,
  qrPayload: qrPayloadOptional,
  qrImageUrl: qrImageUrlOptional,
  mode: modeSchema.default("TEST"),
  label: labelOptional,
  maxPerCreditAmount: signalAmount,
  maxPerDayAmount: signalAmount,
  maxPerDayCount: signalCount,
  metadata: Joi.object().unknown(true).messages({
    "object.base": "metadata must be an object",
  }),
})
  .or("qrIdentifier", "vpa")
  .messages({
    ...UNKNOWN_MESSAGE,
    "object.missing":
      "A QR must carry at least one attribution key: qrIdentifier or vpa. Without one, no payment can ever be matched to this outlet.",
  });

/**
 * PATCH /api/v1/wallet/topup/qr/codes/{id}
 *
 * The MUTABLE SUBSET ONLY — presentation and alerting signals plus `mode`.
 * Identity and attribution keys are absent by design (see rule 2 in the header)
 * and the three identity fields are explicitly forbidden so the refusal is
 * visible rather than silent.
 */
const updateQrCodeSchema = Joi.object({
  label: labelOptional,
  outletName: outletNameOptional,
  qrPayload: qrPayloadOptional,
  qrImageUrl: qrImageUrlOptional,
  mode: modeSchema,
  maxPerCreditAmount: signalAmount,
  maxPerDayAmount: signalAmount,
  maxPerDayCount: signalCount,

  walletUserId: repointForbidden("walletUserId"),
  clientCode: repointForbidden("clientCode"),
  subjectUserId: repointForbidden("subjectUserId"),
})
  .min(1)
  .messages({
    ...UNKNOWN_MESSAGE,
    "object.min": "At least one updatable field is required",
  });

/** GET /api/v1/wallet/topup/qr/codes */
const qrCodeListQuerySchema = Joi.object({
  provider: providerOptional,
  walletUserId: walletUserIdOptional,
  clientCode: clientCodeOptional,
  outletId: uuidOptional,
  qrIdentifier: qrIdentifierOptional,
  vpa: vpaOptional,
  mode: modeSchema,
  isActive: Joi.boolean().messages({
    "boolean.base": "isActive must be true or false",
  }),
  page: pageSchema,
  size: sizeSchema,
  sortDir: sortDirSchema,
}).messages(UNKNOWN_MESSAGE);

/** `:id` path parameter for every /codes/{id} route. */
const qrIdParamsSchema = Joi.object({
  id: Joi.string()
    .uuid({ version: ["uuidv4"] })
    .required()
    .messages({
      "string.guid": "Invalid QR id format",
      "any.required": "QR id is required",
    }),
}).messages(UNKNOWN_MESSAGE);

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/wallet/topup/qr/collections/manual
 *
 * An operator keying in a payment the provider never delivered to us.
 *
 * `utr` is REQUIRED here even though the column is nullable: a UTR-less
 * collection gets only a weak CONTENT dedupe key and is force-parked in the
 * manual queue by `ingestCollection`, so a hand-keyed row without one would be
 * strictly worse than useless. `remarks` is required because a human assertion
 * that money arrived must carry its justification into the audit trail.
 *
 * `amount` IS RUPEES — see the money note in the file header.
 */
const manualQrCollectionSchema = Joi.object({
  utr: Joi.string().min(1).max(64).trim().uppercase().required().messages({
    "string.base": "utr must be a string",
    "string.empty": "utr cannot be empty",
    "string.max": "utr cannot exceed 64 characters",
    "any.required":
      "utr is required for a manually entered collection — it is the bank's own reference for the transfer and the only strong idempotency key we have",
  }),
  amount: Joi.number().positive().precision(2).strict().required().messages({
    "number.base":
      "amount must be a JSON number of rupees (not a string), e.g. 1499.99",
    "number.positive": "amount must be greater than zero",
    "number.precision":
      "amount can have at most 2 decimal places — a paise value can never be invented by rounding",
    "any.required": "amount is required (in rupees)",
  }),
  provider: providerOptional,
  qrIdentifier: qrIdentifierOptional,
  walletUserId: walletUserIdOptional,
  payerVpa: vpaOptional,
  payerName: Joi.string().max(255).trim().messages({
    "string.max": "payerName cannot exceed 255 characters",
  }),
  txnAt: Joi.date().iso().messages({
    "date.base": "txnAt must be a valid date",
    "date.format": "txnAt must be an ISO-8601 date",
  }),
  providerTxnId: Joi.string().max(190).trim().messages({
    "string.max": "providerTxnId cannot exceed 190 characters",
  }),
  remarks: Joi.string().min(5).max(1000).trim().required().messages({
    "string.min": "remarks must be at least 5 characters",
    "string.max": "remarks cannot exceed 1000 characters",
    "any.required":
      "remarks is required — a hand-entered collection must record why an operator asserted this money arrived",
  }),
})
  .or("qrIdentifier", "walletUserId")
  .messages({
    ...UNKNOWN_MESSAGE,
    "object.missing":
      "Provide either qrIdentifier (the QR the payment landed on) or walletUserId (the outlet), so the collection can be attributed",
  });

/**
 * One parsed settlement row — EXACTLY the shape
 * `qrCollectionService.ingestCollection` accepts, and exactly what
 * `utils/csvParser.parseCsvQrCollections` emits.
 *
 * `amountPaise` is INTEGER PAISE here, not rupees: these rows come from a
 * parser that has already done the decimal-string conversion, so re-deriving it
 * from a float would be a second chance to lose a paisa.
 */
const importRowSchema = Joi.object({
  utr: Joi.string().max(64).trim().uppercase().allow(null).messages({
    "string.max": "utr cannot exceed 64 characters",
  }),
  amountPaise: Joi.number().integer().positive().required().messages({
    "number.base": "amountPaise must be a number",
    "number.integer": "amountPaise must be a whole number of paise",
    "number.positive": "amountPaise must be greater than zero",
    "any.required": "amountPaise is required",
  }),
  qrIdentifier: qrIdentifierOptional.allow(null),
  payerVpa: vpaOptional.allow(null),
  payerName: Joi.string().max(255).trim().allow(null).messages({
    "string.max": "payerName cannot exceed 255 characters",
  }),
  txnAt: Joi.date().iso().allow(null).messages({
    "date.base": "txnAt must be a valid date",
    "date.format": "txnAt must be an ISO-8601 date",
  }),
  providerTxnId: Joi.string().max(190).trim().allow(null).messages({
    "string.max": "providerTxnId cannot exceed 190 characters",
  }),
})
  .or("utr", "qrIdentifier")
  .messages({
    ...UNKNOWN_MESSAGE,
    "object.missing": "Row has neither a UTR nor a QR identifier",
  });

/** POST /api/v1/wallet/topup/qr/collections/import */
const importQrCollectionsSchema = Joi.object({
  rows: Joi.array()
    .items(importRowSchema)
    .min(1)
    .max(5000)
    .required()
    .messages({
      "array.base": "rows must be an array",
      "array.min": "rows must contain at least one row",
      "array.max": "rows cannot exceed 5000 entries per import",
      "any.required": "rows is required",
    }),
  provider: providerOptional,
  // A dry run resolves and dedupe-checks every row and WRITES NOTHING. It is
  // the only thing standing between an operator and importing the wrong file.
  dryRun: Joi.boolean().default(false).messages({
    "boolean.base": "dryRun must be true or false",
  }),
}).messages(UNKNOWN_MESSAGE);

/** 5 MB of CSV text — comfortably above a month of settlement rows. */
const MAX_CSV_BYTES = 5 * 1024 * 1024;

/** POST /api/v1/wallet/topup/qr/collections/import-csv */
const importQrCsvSchema = Joi.object({
  csv: Joi.string().min(1).max(MAX_CSV_BYTES).required().messages({
    "string.base": "csv must be a string",
    "string.empty": "csv cannot be empty",
    "string.max": "csv cannot exceed 5MB",
    "any.required": "csv is required (the settlement file's text content)",
  }),
  provider: providerOptional,
  dryRun: Joi.boolean().default(false).messages({
    "boolean.base": "dryRun must be true or false",
  }),
}).messages(UNKNOWN_MESSAGE);

/** GET /collections, /collections/unattributed, /collections/mine */
const qrCollectionListQuerySchema = Joi.object({
  status: Joi.string()
    .valid(
      "UNATTRIBUTED",
      "ASSIGN_PENDING",
      "ATTRIBUTED",
      "CREDIT_PENDING",
      "CREDITED",
      "REJECTED",
      "IGNORED",
    )
    .messages({
      "any.only":
        "status must be one of UNATTRIBUTED, ASSIGN_PENDING, ATTRIBUTED, CREDIT_PENDING, CREDITED, REJECTED, IGNORED",
    }),
  source: Joi.string().valid("WEBHOOK", "IMPORT", "MANUAL", "POLL").messages({
    "any.only": "source must be one of WEBHOOK, IMPORT, MANUAL, POLL",
  }),
  provider: providerOptional,
  qrIdentifier: qrIdentifierOptional,
  walletUserId: walletUserIdOptional,
  utr: Joi.string().max(64).trim().uppercase().messages({
    "string.max": "utr cannot exceed 64 characters",
  }),
  needsManualAction: Joi.boolean().messages({
    "boolean.base": "needsManualAction must be true or false",
  }),
  startDate: startDateSchema,
  endDate: endDateSchema,
  page: pageSchema,
  size: sizeSchema,
  sortDir: sortDirSchema,
}).messages(UNKNOWN_MESSAGE);

// ---------------------------------------------------------------------------
// Assignment / rejection of an UNATTRIBUTED collection (maker-checker)
// ---------------------------------------------------------------------------

/** `:id` for a QrCollection route. */
const collectionIdParamsSchema = Joi.object({
  id: Joi.string()
    .uuid({ version: ["uuidv4"] })
    .required()
    .messages({
      "string.guid": "Invalid collection id format",
      "any.required": "Collection id is required",
    }),
}).messages(UNKNOWN_MESSAGE);

/**
 * POST /collections/:id/assign — the MAKER step.
 *
 * `reason` is MANDATORY at min 10 chars, the same floor `manualTopupSchema`
 * applies: this payload becomes a `ManualTopupRequest`, and the reason is the
 * entire audit value of a human deciding that wallet X gets this money.
 *
 * `amount` is deliberately ABSENT. It comes from the collection row — the
 * amount the payer actually sent. Letting a caller supply it would allow a
 * credit that does not match the payment.
 *
 * `outletPaymentQrId` only RECORDS which QR this payment is read as. It never
 * creates or repoints an `OutletPaymentQr` row; that is the registry's job and
 * is gated on `settings:manage:all`, because repointing a QR changes where
 * every FUTURE payment on it lands.
 */
const assignQrCollectionSchema = Joi.object({
  walletUserId: walletUserIdRequired,
  clientCode: clientCodeOptional,
  subjectUserId: uuidOptional,
  outletPaymentQrId: uuidOptional,

  reason: Joi.string().min(10).max(1000).trim().required().messages({
    "string.min": "Reason must be at least 10 characters",
    "string.max": "Reason cannot exceed 1000 characters",
    "any.required":
      "A reason is required to assign an unattributed QR payment to a wallet",
  }),
}).messages(UNKNOWN_MESSAGE);

/** POST /collections/:id/reject — terminal "this is not our money". */
const rejectQrCollectionSchema = Joi.object({
  remarks: Joi.string().min(10).max(1000).trim().required().messages({
    "string.min": "Rejection remarks must be at least 10 characters",
    "string.max": "Rejection remarks cannot exceed 1000 characters",
    "any.required": "Rejection remarks are required",
  }),
}).messages(UNKNOWN_MESSAGE);

module.exports = {
  // Registry
  createQrCodeSchema,
  updateQrCodeSchema,
  qrCodeListQuerySchema,
  qrIdParamsSchema,
  // Collections
  manualQrCollectionSchema,
  importRowSchema,
  importQrCollectionsSchema,
  importQrCsvSchema,
  qrCollectionListQuerySchema,
  // Assignment (maker-checker)
  collectionIdParamsSchema,
  assignQrCollectionSchema,
  rejectQrCollectionSchema,
  // Constants
  MAX_CSV_BYTES,
};
