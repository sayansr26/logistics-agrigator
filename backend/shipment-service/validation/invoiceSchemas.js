const Joi = require("joi");

// POST /api/v1/invoices/shipments/:shipmentId/issue
const issueTaxInvoiceSchema = {
  params: Joi.object({
    shipmentId: Joi.string().uuid().required().messages({
      "string.guid": "shipmentId must be a valid UUID",
      "any.required": "shipmentId is required",
    }),
  }),
};

// GET /api/v1/invoices/:id
const getInvoiceByIdSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required().messages({
      "string.guid": "id must be a valid UUID",
      "any.required": "id is required",
    }),
  }),
};

// GET /api/v1/invoices
const listInvoicesSchema = {
  query: Joi.object({
    // Invoices are reached from the shipment they belong to, so filtering by
    // shipment is the primary access path — not a convenience.
    shipmentId: Joi.string().uuid().optional(),
    outletId: Joi.string().uuid().optional(),
    clientId: Joi.string().uuid().optional(),
    dateFrom: Joi.date().iso().optional(),
    dateTo: Joi.date().iso().optional(),
    status: Joi.string().valid("ISSUED", "CANCELLED").optional(),
    invoiceType: Joi.string()
      .valid("TAX_INVOICE", "CREDIT_NOTE", "DEBIT_NOTE")
      .optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

// POST /api/v1/invoices/notes
const issueAdjustmentNoteSchema = {
  body: Joi.object({
    financialAdjustmentId: Joi.string().uuid().required().messages({
      "string.guid": "financialAdjustmentId must be a valid UUID",
      "any.required": "financialAdjustmentId is required",
    }),
  }),
};

// GET /api/v1/invoices/:id/pdf
const getInvoicePdfSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required().messages({
      "string.guid": "id must be a valid UUID",
      "any.required": "id is required",
    }),
  }),
};

module.exports = {
  issueTaxInvoiceSchema,
  getInvoiceByIdSchema,
  listInvoicesSchema,
  issueAdjustmentNoteSchema,
  getInvoicePdfSchema,
};
