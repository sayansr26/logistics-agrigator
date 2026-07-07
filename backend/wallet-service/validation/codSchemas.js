const Joi = require("joi");

const RECON_STATUSES = [
  "UNRECONCILED",
  "MATCHED",
  "MISSING",
  "SHORT",
  "EXCESS",
  "DUPLICATE",
  "MANUAL",
];
const COLLECTION_STATUSES = ["PENDING", "COLLECTED", "REMITTED"];
const ADJUSTMENT_TYPES = [
  "LOST",
  "DAMAGE",
  "SHORT_COD",
  "EXCESS_COD",
  "CREDIT_NOTE",
  "DEBIT_NOTE",
  "MANUAL",
];
const PAYMENT_MODES = ["WALLET_CREDIT", "BANK_TRANSFER", "UPI", "MANUAL"];
const CYCLES = ["DAILY", "WEEKLY", "T_PLUS_1", "T_PLUS_2"];
const SETTLEMENT_ACTIONS = [
  "verify",
  "approve",
  "release",
  "reject",
  "hold",
  "cancel",
  "reprocess",
];

// ---- COD ingestion ----
const ingestCodSchema = Joi.object({
  shipmentId: Joi.string().uuid().required(),
  awbNumber: Joi.string().trim().min(1).required(),
  orderId: Joi.string().trim().min(1).required(),
  invoiceNo: Joi.string().trim().allow("", null).optional(),
  userId: Joi.string().uuid().required(),
  clientCode: Joi.string().trim().default("DEFAULT"),
  partnerId: Joi.string().trim().allow("", null).optional(),
  partnerName: Joi.string().trim().allow("", null).optional(),
  codAmount: Joi.number().min(0).required(),
  deliveredAt: Joi.date().iso().optional(),
});

// ---- COD shipment list query ----
const listCodQuerySchema = Joi.object({
  search: Joi.string().trim().allow("").optional(),
  userId: Joi.string().uuid().optional(),
  clientCode: Joi.string().trim().optional(),
  partnerId: Joi.string().trim().optional(),
  collectionStatus: Joi.string().valid(...COLLECTION_STATUSES).optional(),
  reconStatus: Joi.string().valid(...RECON_STATUSES).optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

// ---- Collections ----
const collectionRowSchema = Joi.object({
  awbNumber: Joi.string().trim().min(1).required(),
  reportedAmount: Joi.number().min(0).required(),
  collectionDate: Joi.date().iso().optional(),
  courierReportId: Joi.string().trim().allow("", null).optional(),
  metadata: Joi.object().optional(),
});

const manualCollectionSchema = collectionRowSchema;

const importCollectionsSchema = Joi.object({
  source: Joi.string().valid("IMPORT", "API").default("IMPORT"),
  rows: Joi.array().items(collectionRowSchema).min(1).max(1000).required(),
});

const importCollectionsCsvSchema = Joi.object({
  source: Joi.string().valid("IMPORT", "API").default("IMPORT"),
  csv: Joi.string().min(1).max(5_000_000).required().messages({
    "string.empty": "CSV content is required",
  }),
});

// ---- Reconciliation ----
const autoReconcileSchema = Joi.object({
  userId: Joi.string().uuid().optional(),
  clientCode: Joi.string().trim().optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().optional(),
});

const manualReconcileSchema = Joi.object({
  status: Joi.string().valid(...RECON_STATUSES).default("MANUAL"),
  reportedAmount: Joi.number().min(0).optional(),
  remarks: Joi.string().trim().max(500).allow("", null).optional(),
});

// ---- Settlement ----
const generateSettlementSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  clientCode: Joi.string().trim().default("DEFAULT"),
  codShipmentIds: Joi.array().items(Joi.string().uuid()).optional(),
  cycle: Joi.string().valid(...CYCLES).optional(),
  paymentMode: Joi.string().valid(...PAYMENT_MODES).optional(),
  remarks: Joi.string().trim().max(500).allow("", null).optional(),
});

const settlementActionSchema = Joi.object({
  action: Joi.string().valid(...SETTLEMENT_ACTIONS).required(),
  paymentMode: Joi.string().valid(...PAYMENT_MODES).optional(),
  payoutReference: Joi.string().trim().max(200).optional(),
  reason: Joi.string().trim().max(500).optional(),
});

const adjustmentSchema = Joi.object({
  type: Joi.string().valid(...ADJUSTMENT_TYPES).required(),
  amount: Joi.number().required().messages({
    "any.required": "Adjustment amount is required (signed: + increases, - decreases payable)",
  }),
  reason: Joi.string().trim().min(3).max(500).required(),
  referenceAwb: Joi.string().trim().allow("", null).optional(),
});

const listSettlementsQuerySchema = Joi.object({
  userId: Joi.string().uuid().optional(),
  clientCode: Joi.string().trim().optional(),
  status: Joi.string()
    .valid("DRAFT", "FINANCE_VERIFICATION", "APPROVED", "RELEASED", "REJECTED", "HOLD", "CANCELLED")
    .optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const createRuleSchema = Joi.object({
  scope: Joi.string().valid("CUSTOMER", "COURIER", "GLOBAL").default("CUSTOMER"),
  clientCode: Joi.string().trim().allow("", null).optional(),
  userId: Joi.string().uuid().allow(null).optional(),
  partnerId: Joi.string().trim().allow("", null).optional(),
  cycle: Joi.string().valid(...CYCLES).default("T_PLUS_2"),
  paymentMode: Joi.string().valid(...PAYMENT_MODES).default("WALLET_CREDIT"),
  autoRelease: Joi.boolean().default(false),
  isActive: Joi.boolean().default(true),
});

const updateRuleSchema = Joi.object({
  scope: Joi.string().valid("CUSTOMER", "COURIER", "GLOBAL").optional(),
  clientCode: Joi.string().trim().allow("", null).optional(),
  userId: Joi.string().uuid().allow(null).optional(),
  partnerId: Joi.string().trim().allow("", null).optional(),
  cycle: Joi.string().valid(...CYCLES).optional(),
  paymentMode: Joi.string().valid(...PAYMENT_MODES).optional(),
  autoRelease: Joi.boolean().optional(),
  isActive: Joi.boolean().optional(),
}).min(1);

const runAutoSettlementSchema = Joi.object({
  dryRun: Joi.boolean().default(false),
});

module.exports = {
  ingestCodSchema,
  listCodQuerySchema,
  createRuleSchema,
  updateRuleSchema,
  runAutoSettlementSchema,
  manualCollectionSchema,
  importCollectionsSchema,
  importCollectionsCsvSchema,
  autoReconcileSchema,
  manualReconcileSchema,
  generateSettlementSchema,
  settlementActionSchema,
  adjustmentSchema,
  listSettlementsQuerySchema,
};
