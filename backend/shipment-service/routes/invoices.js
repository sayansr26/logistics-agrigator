const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../shared/lib/auth");
const { validate } = require("../middleware/validate");
const { generalLimiter } = require("../middleware/rateLimiter");

const {
  issueTaxInvoice,
  getInvoiceById,
  listInvoices,
  issueAdjustmentNote,
  downloadInvoicePdf,
} = require("../controllers/invoiceController");

const {
  issueTaxInvoiceSchema,
  getInvoiceByIdSchema,
  listInvoicesSchema,
  issueAdjustmentNoteSchema,
  getInvoicePdfSchema,
} = require("../validation/invoiceSchemas");

// POST /api/v1/invoices/shipments/:shipmentId/issue
router.post(
  "/shipments/:shipmentId/issue",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "update", "assigned"),
  validate(issueTaxInvoiceSchema),
  issueTaxInvoice,
);

// POST /api/v1/invoices/notes
router.post(
  "/notes",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "update", "assigned"),
  validate(issueAdjustmentNoteSchema),
  issueAdjustmentNote,
);

// Read scope is "own", not "assigned": an outlet holds shipment:read:own and
// scope matching is EXACT (see shared/constants/permissions.matchesPermission —
// there is no own < assigned < parent hierarchy on the server). The controller
// scopes every read to the caller's outlet/client, so "own" is the honest
// requirement here rather than the thing keeping tenants apart.
// GET /api/v1/invoices
router.get(
  "/",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "own"),
  validate(listInvoicesSchema),
  listInvoices,
);

// GET /api/v1/invoices/:id/pdf
router.get(
  "/:id/pdf",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "own"),
  validate(getInvoicePdfSchema),
  downloadInvoicePdf,
);

// GET /api/v1/invoices/:id
router.get(
  "/:id",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "own"),
  validate(getInvoiceByIdSchema),
  getInvoiceById,
);

module.exports = router;
