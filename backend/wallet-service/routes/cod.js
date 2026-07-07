/**
 * COD Remittance Routes
 *
 * Mounted at /api/v1/wallet/cod (inherits the wallet gateway proxy).
 * COD shipment management, collections, reconciliation and reports.
 */

const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../shared/lib/auth");
const { validateBody, validateQuery } = require("../middleware/validate");
const { generalLimiter, transactionLimiter } = require("../middleware/rateLimiter");
const codController = require("../controllers/codController");
const {
  ingestCodSchema,
  listCodQuerySchema,
  manualCollectionSchema,
  importCollectionsSchema,
  importCollectionsCsvSchema,
  autoReconcileSchema,
  manualReconcileSchema,
} = require("../validation/codSchemas");

const auth = authMiddleware.authenticate;
// COD/settlement admin operations are finance-team functions. Gate by role
// (superadmin/admin/accounts) — matches the sidebar + route access model.
// The `wallet:manage:all` permission is not granted to the admin role by default.
const manage = authMiddleware.requireRole(["superadmin", "admin", "accounts"]);

// ---- COD shipments ----
// Ingestion (called by shipment-service on COD delivery, or admin)
router.post("/shipments/ingest", auth, manage, transactionLimiter, validateBody(ingestCodSchema), codController.ingestCodShipment);
router.get("/shipments", auth, manage, generalLimiter, validateQuery(listCodQuerySchema), codController.listCodShipments);

// ---- Collections ----
router.post("/collections/manual", auth, manage, transactionLimiter, validateBody(manualCollectionSchema), codController.addManualCollection);
router.post("/collections/import", auth, manage, transactionLimiter, validateBody(importCollectionsSchema), codController.importCollections);
router.post("/collections/import-csv", auth, manage, transactionLimiter, validateBody(importCollectionsCsvSchema), codController.importCollectionsCsv);
router.patch("/collections/:id/verify", auth, manage, generalLimiter, codController.verifyCollection);

// ---- Reconciliation ----
router.post("/reconcile/auto", auth, manage, transactionLimiter, validateBody(autoReconcileSchema), codController.autoReconcile);
router.get("/reconcile", auth, manage, generalLimiter, codController.listReconciliations);
router.patch("/reconcile/:codShipmentId", auth, manage, generalLimiter, validateBody(manualReconcileSchema), codController.manualReconcile);

// ---- Reports ----
router.get("/reports/:type", auth, manage, generalLimiter, codController.report);

module.exports = router;
