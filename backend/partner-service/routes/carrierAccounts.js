/**
 * Carrier Account (Service Channel) Routes
 *
 * Manage weight-slab shipping products / accounts per carrier partner:
 * - List accounts for a partner
 * - Select the matching account for a chargeable weight (used by shipment-service)
 * - Create / update / delete accounts
 *
 * Authentication: Required (JWT)
 * Authorization: Admin + Operations roles for mutations
 */

const express = require("express");
const router = express.Router();
const carrierAccountController = require("../controllers/carrierAccountController");
const { validate } = require("../middleware/validate");
const { authMiddleware } = require("../shared/lib/auth");
const { partnerManagementLimiter } = require("../middleware/rateLimiter");
const {
  createCarrierAccountSchema,
  updateCarrierAccountSchema,
} = require("../validation/carrierAccountSchemas");

// All carrier-account routes require authentication.
// NOTE: partnerManagementLimiter (max 20 / 15min) is applied ONLY to mutations
// below — NOT router-wide — so GET/list/select reads (which happen on every page
// load) are not throttled by the strict write limiter.
router.use(authMiddleware.authenticate);

/**
 * @route GET /api/v1/partners/:partnerId/carrier-accounts/select?weight=&serviceType=
 * @desc  Select the best-matching carrier account for a chargeable weight.
 *        Used by the rating/booking flow, so available to any authenticated
 *        caller — but returns non-secret routing metadata only (credentials
 *        are excluded at the service layer).
 * @access Private (authenticated)
 */
router.get(
  "/partners/:partnerId/carrier-accounts/select",
  carrierAccountController.selectAccount,
);

/**
 * @route GET /api/v1/partners/:partnerId/carrier-accounts
 * @desc  List all carrier accounts for a partner (admin/operations config view).
 * @access Private (superadmin, admin, operations)
 */
router.get(
  "/partners/:partnerId/carrier-accounts",
  authMiddleware.requireRole(["superadmin", "admin", "operations"]),
  carrierAccountController.listAccounts,
);

// Mutations restricted to admin/operations roles + strict management limiter
router.post(
  "/partners/:partnerId/carrier-accounts",
  authMiddleware.requireRole(["superadmin", "admin", "operations"]),
  partnerManagementLimiter,
  validate(createCarrierAccountSchema, "body"),
  carrierAccountController.createAccounts,
);

router.put(
  "/carrier-accounts/:accountId",
  authMiddleware.requireRole(["superadmin", "admin", "operations"]),
  partnerManagementLimiter,
  validate(updateCarrierAccountSchema, "body"),
  carrierAccountController.updateAccount,
);

router.delete(
  "/carrier-accounts/:accountId",
  authMiddleware.requireRole(["superadmin", "admin", "operations"]),
  partnerManagementLimiter,
  carrierAccountController.deleteAccount,
);

module.exports = router;
