/**
 * Settlement Routes
 *
 * Mounted at /api/v1/wallet/settlement (inherits the wallet gateway proxy).
 * Settlement generation, adjustments, approval workflow, and a customer portal view.
 */

const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../shared/lib/auth");
const { validateBody, validateQuery } = require("../middleware/validate");
const { generalLimiter, transactionLimiter } = require("../middleware/rateLimiter");
const settlementController = require("../controllers/settlementController");
const {
  generateSettlementSchema,
  settlementActionSchema,
  adjustmentSchema,
  listSettlementsQuerySchema,
  createRuleSchema,
  updateRuleSchema,
  runAutoSettlementSchema,
} = require("../validation/codSchemas");

const auth = authMiddleware.authenticate;
// COD/settlement admin operations are finance-team functions. Gate by role
// (superadmin/admin/accounts) — matches the sidebar + route access model.
// The `wallet:manage:all` permission is not granted to the admin role by default.
const manage = authMiddleware.requireRole(["superadmin", "admin", "accounts"]);

// ---- Customer portal (own settlements) ----
// Forces userId scope to the requesting user; any authenticated user may view their own.
router.get(
  "/my",
  auth,
  generalLimiter,
  (req, _res, next) => {
    req.query.userId = req.user?.id || req.user?.userId;
    next();
  },
  validateQuery(listSettlementsQuerySchema),
  settlementController.listSettlements,
);

// ---- Admin / finance ----
router.post("/generate", auth, manage, transactionLimiter, validateBody(generateSettlementSchema), settlementController.generateSettlement);
router.get("/", auth, manage, generalLimiter, validateQuery(listSettlementsQuerySchema), settlementController.listSettlements);

// ---- Settlement rules (configurable cycles / auto payout) ----
// Must be registered BEFORE "/:id" so "/rules" isn't captured by the ":id" param.
router.get("/rules", auth, manage, generalLimiter, settlementController.listRules);
router.post("/rules", auth, manage, transactionLimiter, validateBody(createRuleSchema), settlementController.createRule);
router.put("/rules/:id", auth, manage, transactionLimiter, validateBody(updateRuleSchema), settlementController.updateRule);
router.delete("/rules/:id", auth, manage, transactionLimiter, settlementController.deleteRule);
// Manually trigger the auto-settlement run (same routine the scheduler uses)
router.post("/run-auto", auth, manage, transactionLimiter, validateBody(runAutoSettlementSchema), settlementController.runAutoSettlement);

router.get("/:id", auth, manage, generalLimiter, settlementController.getSettlement);
router.post("/:id/adjustments", auth, manage, transactionLimiter, validateBody(adjustmentSchema), settlementController.addAdjustment);
// Workflow: verify | approve | release | reject | hold | cancel | reprocess
router.post("/:id/actions", auth, manage, transactionLimiter, validateBody(settlementActionSchema), settlementController.actOnSettlement);

module.exports = router;
