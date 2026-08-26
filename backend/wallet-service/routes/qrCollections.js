/**
 * Static-QR routes — /api/v1/wallet/topup/qr
 *
 * ROUTE ORDER IS LOAD-BEARING. Literal segments are declared BEFORE the
 * parameterised ones that would otherwise swallow them:
 *   - `/codes/mine` before `/codes/:id` — otherwise an outlet asking for its
 *     own QR is answered by the admin fetch with `id = "mine"`.
 *   - `/collections/unattributed` and `/collections/mine` before anything
 *     parameterised under `/collections`.
 * Same rule `routes/topup.js` follows for `/manual/pending` ahead of
 * `/manual/:requestId`, and `routes/wallet.js` for `/admin/*` ahead of
 * `/:userId`.
 *
 * ZERO LOGIC LIVES HERE. Each route is: authenticate -> permission -> rate
 * limit -> validate -> controller.
 *
 * PERMISSIONS. `settings:manage:all` guards the REGISTRY (who can decide which
 * outlet a QR pays into — the highest-consequence write in this module),
 * `wallet:manage:all` guards collection ingestion, `wallet:read:all` the admin
 * lists, and `wallet:read:own` the two self-service reads.
 * `authMiddleware.requirePermission` takes THREE SEPARATE ARGUMENTS
 * (module, action, scope) — never one "a:b:c" string.
 *
 * ASSIGN / REJECT are mounted here too (bottom of the file). The maker-checker
 * logic itself lives in `services/payments/qrAssignmentService.js`, which
 * delegates every rupee to `services/payments/manualTopupService.js` — this
 * router only wires the two verbs. `wallet:manage:all` guards assign (the maker)
 * and `wallet:approve:all` guards reject, which the `admin` role deliberately
 * does not hold.
 */

const express = require("express");

const {
  createQrCode,
  listQrCodes,
  getMyQrCode,
  updateQrCode,
  deactivateQrCode,
  listCollections,
  listUnattributed,
  getMyCollections,
  createManualCollection,
  importCollections,
  importCollectionsCsv,
  assignCollection,
  rejectCollection,
} = require("../controllers/qrCollectionController");
const { authMiddleware } = require("../shared/lib/auth");
const {
  validateBody,
  validateParams,
  validateQuery,
} = require("../middleware/validate");
const {
  balanceLimiter,
  transactionLimiter,
} = require("../middleware/rateLimiter");
const {
  createQrCodeSchema,
  updateQrCodeSchema,
  qrCodeListQuerySchema,
  qrIdParamsSchema,
  manualQrCollectionSchema,
  importQrCollectionsSchema,
  importQrCsvSchema,
  qrCollectionListQuerySchema,
  collectionIdParamsSchema,
  assignQrCollectionSchema,
  rejectQrCollectionSchema,
} = require("../validation/qrSchemas");

const router = express.Router();

// Every route in this router is authenticated. Unlike `routes/topup.js` there
// is NO unauthenticated callback here — the gateway's QR webhook lives at
// /api/v1/wallet/topup/qr-webhook/:provider in routes/topup.js, deliberately
// under a different prefix so nothing in this admin surface can shadow it.
router.use(authMiddleware.authenticate);

// ---------------------------------------------------------------------------
// QR registry — /codes
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/wallet/topup/qr/codes:
 *   post:
 *     tags: [Static QR]
 *     summary: Provision a static payment QR for an outlet
 *     description: >
 *       Requires `settings:manage:all`. Full contract documented on
 *       `controllers/qrCollectionController.createQrCode`.
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       201: { description: QR provisioned }
 *       409: { description: QR_IDENTIFIER_ALREADY_ACTIVE }
 */
router.post(
  "/codes",
  authMiddleware.requirePermission("settings", "manage", "all"),
  transactionLimiter,
  validateBody(createQrCodeSchema),
  createQrCode,
);

/**
 * @swagger
 * /api/v1/wallet/topup/qr/codes:
 *   get:
 *     tags: [Static QR]
 *     summary: List provisioned outlet QRs
 *     description: Requires `wallet:read:all`. Pagination rides inside `data`, 0-based.
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated QR list }
 */
router.get(
  "/codes",
  authMiddleware.requirePermission("wallet", "read", "all"),
  balanceLimiter,
  validateQuery(qrCodeListQuerySchema),
  listQrCodes,
);

/**
 * @swagger
 * /api/v1/wallet/topup/qr/codes/mine:
 *   get:
 *     tags: [Static QR]
 *     summary: The authenticated outlet's own payment QR
 *     description: >
 *       Requires `wallet:read:own`. Identity comes from the JWT, never a query
 *       parameter. DECLARED BEFORE `/codes/:id` — otherwise "mine" would be
 *       parsed as a QR id.
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: The outlet's active QR }
 *       404: { description: QR_NOT_PROVISIONED }
 */
router.get(
  "/codes/mine",
  authMiddleware.requirePermission("wallet", "read", "own"),
  balanceLimiter,
  getMyQrCode,
);

/**
 * @swagger
 * /api/v1/wallet/topup/qr/codes/{id}:
 *   patch:
 *     tags: [Static QR]
 *     summary: Update the mutable fields of a QR
 *     description: >
 *       Requires `settings:manage:all`. `walletUserId` / `clientCode` are
 *       refused with QR_REPOINT_FORBIDDEN — a QR is never repointed.
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Updated QR }
 *       400: { description: QR_REPOINT_FORBIDDEN }
 */
router.patch(
  "/codes/:id",
  authMiddleware.requirePermission("settings", "manage", "all"),
  transactionLimiter,
  validateParams(qrIdParamsSchema),
  validateBody(updateQrCodeSchema),
  updateQrCode,
);

/**
 * @swagger
 * /api/v1/wallet/topup/qr/codes/{id}/deactivate:
 *   post:
 *     tags: [Static QR]
 *     summary: Retire a payment QR
 *     description: Requires `settings:manage:all`. Idempotent.
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: QR deactivated }
 *       404: { description: QR_NOT_FOUND }
 */
router.post(
  "/codes/:id/deactivate",
  authMiddleware.requirePermission("settings", "manage", "all"),
  transactionLimiter,
  validateParams(qrIdParamsSchema),
  deactivateQrCode,
);

// ---------------------------------------------------------------------------
// Collections — /collections
//
// The two literal sub-paths are declared FIRST so no future `/collections/:id`
// can swallow them.
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/wallet/topup/qr/collections/unattributed:
 *   get:
 *     tags: [Static QR]
 *     summary: The ops queue — collections that cannot yet be credited
 *     description: >
 *       Requires `wallet:read:all`. `status` is forced to UNATTRIBUTED and a
 *       query-string `status` is ignored.
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated unattributed queue }
 */
router.get(
  "/collections/unattributed",
  authMiddleware.requirePermission("wallet", "read", "all"),
  balanceLimiter,
  validateQuery(qrCollectionListQuerySchema),
  listUnattributed,
);

/**
 * @swagger
 * /api/v1/wallet/topup/qr/collections/mine:
 *   get:
 *     tags: [Static QR]
 *     summary: The authenticated outlet's own QR collections
 *     description: >
 *       Requires `wallet:read:own`. `walletUserId` is forced from the JWT.
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated collection list for the caller's wallet }
 */
router.get(
  "/collections/mine",
  authMiddleware.requirePermission("wallet", "read", "own"),
  balanceLimiter,
  validateQuery(qrCollectionListQuerySchema),
  getMyCollections,
);

/**
 * @swagger
 * /api/v1/wallet/topup/qr/collections/manual:
 *   post:
 *     tags: [Static QR]
 *     summary: Hand-enter a static-QR collection
 *     description: >
 *       Requires `wallet:manage:all`. `amount` is in RUPEES; the controller
 *       converts to integer paise once, by decimal-string arithmetic.
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       201: { description: Collection recorded }
 *       200: { description: Duplicate UTR — no-op }
 */
router.post(
  "/collections/manual",
  authMiddleware.requirePermission("wallet", "manage", "all"),
  transactionLimiter,
  validateBody(manualQrCollectionSchema),
  createManualCollection,
);

/**
 * @swagger
 * /api/v1/wallet/topup/qr/collections/import:
 *   post:
 *     tags: [Static QR]
 *     summary: Import already-parsed settlement rows
 *     description: >
 *       Requires `wallet:manage:all`. `amountPaise` is INTEGER PAISE.
 *       `dryRun: true` writes nothing.
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Import report }
 */
router.post(
  "/collections/import",
  authMiddleware.requirePermission("wallet", "manage", "all"),
  transactionLimiter,
  validateBody(importQrCollectionsSchema),
  importCollections,
);

/**
 * @swagger
 * /api/v1/wallet/topup/qr/collections/import-csv:
 *   post:
 *     tags: [Static QR]
 *     summary: Import a UPI/QR settlement CSV
 *     description: >
 *       Requires `wallet:manage:all`. Parser line errors are merged into the
 *       returned report alongside importer row failures.
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Import report with parseErrors merged in }
 */
router.post(
  "/collections/import-csv",
  authMiddleware.requirePermission("wallet", "manage", "all"),
  transactionLimiter,
  validateBody(importQrCsvSchema),
  importCollectionsCsv,
);

/**
 * @swagger
 * /api/v1/wallet/topup/qr/collections:
 *   get:
 *     tags: [Static QR]
 *     summary: List static-QR collections
 *     description: Requires `wallet:read:all`. Pagination rides inside `data`, 0-based.
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated collection list }
 */
router.get(
  "/collections",
  authMiddleware.requirePermission("wallet", "read", "all"),
  balanceLimiter,
  validateQuery(qrCollectionListQuerySchema),
  listCollections,
);

/**
 * @swagger
 * /api/v1/wallet/topup/qr/collections/{id}/assign:
 *   post:
 *     tags: [Static QR]
 *     summary: Assign an unattributed QR payment to a wallet (MAKER)
 *     description: >
 *       Requires `wallet:manage:all`. Raises a `ManualTopupRequest`; **200** when
 *       it credits below the maker-checker threshold, **202** when it parks for
 *       a superadmin. See the controller for the full contract.
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Assigned and credited }
 *       202: { description: Assigned, awaiting superadmin approval }
 */
router.post(
  "/collections/:id/assign",
  authMiddleware.requirePermission("wallet", "manage", "all"),
  transactionLimiter,
  validateParams(collectionIdParamsSchema),
  validateBody(assignQrCollectionSchema),
  assignCollection,
);

/**
 * @swagger
 * /api/v1/wallet/topup/qr/collections/{id}/reject:
 *   post:
 *     tags: [Static QR]
 *     summary: Reject an unattributed QR payment as not-ours (CHECKER)
 *     description: >
 *       Requires `wallet:approve:all` — the permission the `admin` role
 *       deliberately lacks, which is what makes this superadmin-only. Terminal,
 *       and it never credits.
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Collection rejected }
 */
router.post(
  "/collections/:id/reject",
  authMiddleware.requirePermission("wallet", "approve", "all"),
  transactionLimiter,
  validateParams(collectionIdParamsSchema),
  validateBody(rejectQrCollectionSchema),
  rejectCollection,
);

module.exports = router;
