/**
 * Top-up routes — /api/v1/wallet/topup
 *
 * ROUTE ORDER IS LOAD-BEARING. Literal segments are declared BEFORE the
 * parameterised ones that would otherwise swallow them:
 *   - `/webhook/:provider` first, so nothing authenticated can shadow the
 *     unauthenticated gateway callback.
 *   - `/manual/pending` before `/manual/:requestId/*`.
 *   - `/self/orders` and every `/admin/*` route before `/orders/:orderId`.
 * Same rule `routes/wallet.js` follows for `/admin/*` ahead of `/:userId`, and
 * `routes/paymentProvider.js` follows for `/policy` ahead of `/:provider`.
 *
 * ZERO LOGIC LIVES HERE. Each route is: authenticate -> permission -> rate
 * limit -> validate -> controller.
 */

const express = require("express");

const {
  initiateSelfTopup,
  verifySelfTopup,
  listSelfOrders,
  getSelfOrder,
  createAdminPaymentLink,
  listAdminPaymentLinks,
  getAdminPaymentLink,
  refreshAdminPaymentLink,
  cancelAdminPaymentLink,
  listReconcileQueue,
  retryReconcile,
  handleWebhook,
} = require("../controllers/topupController");
const {
  createManualTopup,
  listManualTopups,
  listPendingApprovals,
  approveManualTopup,
  rejectManualTopup,
} = require("../controllers/manualTopupController");
const { authMiddleware } = require("../shared/lib/auth");
const {
  validateParams,
  validateBody,
  validateQuery,
} = require("../middleware/validate");
const {
  balanceLimiter,
  transactionLimiter,
  webhookLimiter,
} = require("../middleware/rateLimiter");
const {
  providerParamsSchema,
  orderIdParamsSchema,
  requestIdParamsSchema,
  selfTopupInitiateSchema,
  selfTopupVerifySchema,
  createPaymentLinkSchema,
  manualTopupSchema,
  approveManualTopupSchema,
  rejectManualTopupSchema,
  topupOrderListQuerySchema,
  paymentLinkListQuerySchema,
  manualTopupListQuerySchema,
  reconcileQueueQuerySchema,
} = require("../validation/paymentSchema");

const router = express.Router();

// ---------------------------------------------------------------------------
// Webhook — UNAUTHENTICATED BY DESIGN. Declared first.
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/wallet/topup/webhook/{provider}:
 *   post:
 *     tags: [Wallet Top-up]
 *     summary: Payment gateway webhook receiver
 *     description: |
 *       Receives asynchronous payment events from the gateway and credits the
 *       wallet. **Deliberately unauthenticated** — the gateway does not hold a
 *       JWT. Authenticity is proven by the HMAC signature over the raw request
 *       bytes, verified against the webhook secret for the mode snapshotted on
 *       the referenced order. The API Gateway whitelists this prefix in
 *       `authValidator.js` publicPaths for the same reason.
 *
 *       **Always answers 200 once the event has been recorded**, including for
 *       duplicate, ignored, deferred and failed credits: a non-2xx makes the
 *       gateway redeliver an event the replay guard would then swallow, which
 *       silently strands the money. The only non-200 answers are 401 for a bad
 *       signature and 503 when the event could not be persisted at all — the
 *       one case where a redelivery genuinely helps.
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [razorpay, stripe, cashfree, payu]
 *         description: Payment provider slug
 *     requestBody:
 *       required: true
 *       description: |
 *         The provider's raw event envelope. **Intentionally not validated** —
 *         see the note in the route definition.
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Event received and recorded
 *         content:
 *           application/json:
 *             example:
 *               status: success
 *               data:
 *                 received: true
 *                 handled: credited
 *       401:
 *         description: Signature verification failed
 *         content:
 *           application/json:
 *             example:
 *               status: error
 *               error:
 *                 code: INVALID_SIGNATURE
 *                 message: Invalid signature
 *       429:
 *         description: Too many webhook deliveries
 *       503:
 *         description: Event could not be persisted — gateway should redeliver
 */
// NO `authenticate` and NO `requirePermission`: the signature is the auth.
// NO `validateBody` either — `middleware/validate.js` runs Joi with
// `stripUnknown: true`, which would strip the provider's nested envelope
// (`payload.payment.entity`, `payload.payment_link.entity`, ...) down to
// nothing before the service ever sees it, and would also mutate `req.body`
// away from the bytes the signature covers. Only the path param is validated.
router.post(
  "/webhook/:provider",
  webhookLimiter,
  validateParams(providerParamsSchema),
  handleWebhook,
);

// ---------------------------------------------------------------------------
// Self-serve top-up — identity comes from the JWT, never from the request
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/wallet/topup/self/initiate:
 *   post:
 *     tags: [Wallet Top-up]
 *     summary: Start a self-serve wallet top-up
 *     description: |
 *       Creates a gateway order for the **authenticated caller's own** wallet
 *       and returns the checkout parameters the browser SDK needs. Any
 *       identity field in the body is ignored: the target wallet is resolved
 *       from the JWT only.
 *
 *       Repeating the call with the same `idempotencyKey` and amount returns
 *       the original order (`reused: true`) instead of minting a second one.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 5000
 *               currency:
 *                 type: string
 *                 example: INR
 *               provider:
 *                 type: string
 *                 enum: [razorpay]
 *               idempotencyKey:
 *                 type: string
 *                 maxLength: 100
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Order created at the gateway
 *       400:
 *         description: Validation failed or amount outside the configured band
 *       409:
 *         description: Provider disabled/not configured, or too many open orders
 *       429:
 *         description: Rate limit exceeded
 */
router.post(
  "/self/initiate",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "create", "own"),
  transactionLimiter,
  validateBody(selfTopupInitiateSchema),
  initiateSelfTopup,
);

/**
 * @swagger
 * /api/v1/wallet/topup/self/verify:
 *   post:
 *     tags: [Wallet Top-up]
 *     summary: Verify a checkout callback and credit the wallet
 *     description: |
 *       Verifies the signature the gateway's browser SDK handed back and, when
 *       it checks out, credits the wallet. Ownership of the order is re-checked
 *       against the JWT, and the signed gateway order id must match the one
 *       minted for this row.
 *
 *       The webhook is the authoritative path; this route is the fast one, so
 *       a response may legitimately report `credited: false` with the credit
 *       deferred to the reconcile worker.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               [orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature]
 *             properties:
 *               orderId:
 *                 type: string
 *                 format: uuid
 *               razorpay_order_id:
 *                 type: string
 *               razorpay_payment_id:
 *                 type: string
 *               razorpay_signature:
 *                 type: string
 *     responses:
 *       200:
 *         description: Signature verified
 *       400:
 *         description: Validation failed or the signature does not match
 *       403:
 *         description: The order does not belong to the caller
 *       404:
 *         description: Payment order not found
 */
router.post(
  "/self/verify",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "create", "own"),
  transactionLimiter,
  validateBody(selfTopupVerifySchema),
  verifySelfTopup,
);

/**
 * @swagger
 * /api/v1/wallet/topup/self/orders:
 *   get:
 *     tags: [Wallet Top-up]
 *     summary: List the caller's own top-up orders
 *     description: |
 *       Scoped to the caller's own wallet identity, resolved from the JWT.
 *       Any `walletUserId` / `subjectUserId` / `clientCode` filter in the query
 *       string is dropped by the service on this scope.
 *
 *       Pagination rides **inside** the payload
 *       (`{ data, pagination, success, filters }`) with a 0-based
 *       `current_page`, because the frontend slice only reads the `data` half
 *       of the envelope.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: size
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: provider
 *         schema: { type: string, enum: [razorpay, stripe, cashfree, payu] }
 *       - in: query
 *         name: sortDir
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200:
 *         description: Orders retrieved
 *       400:
 *         description: Invalid query parameters
 */
router.get(
  "/self/orders",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "read", "own"),
  balanceLimiter,
  validateQuery(topupOrderListQuerySchema),
  listSelfOrders,
);

// ---------------------------------------------------------------------------
// Manual (offline) top-up — handlers reused as-is from manualTopupController
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/wallet/topup/manual/pending:
 *   get:
 *     tags: [Wallet Top-up]
 *     summary: List manual top-up requests awaiting approval
 *     description: The approver's queue — requests above the auto-approve threshold.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: size
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Pending requests retrieved
 */
// LITERAL BEFORE PARAM: declared ahead of /manual/:requestId/* so "pending" is
// never matched as a requestId.
router.get(
  "/manual/pending",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "approve", "all"),
  balanceLimiter,
  validateQuery(manualTopupListQuerySchema),
  listPendingApprovals,
);

/**
 * @swagger
 * /api/v1/wallet/topup/manual:
 *   post:
 *     tags: [Wallet Top-up]
 *     summary: Record a manual (offline) wallet top-up
 *     description: |
 *       Records money received outside the gateway (NEFT, cash, cheque, UPI
 *       reference). Requests at or below the policy's auto-approve threshold
 *       credit immediately; larger ones enter the approval queue.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Manual top-up recorded
 *       400:
 *         description: Validation failed or policy limit exceeded
 *   get:
 *     tags: [Wallet Top-up]
 *     summary: List manual top-up requests
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: size
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Manual top-up requests retrieved
 */
router.post(
  "/manual",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "manage", "all"),
  transactionLimiter,
  validateBody(manualTopupSchema),
  createManualTopup,
);

router.get(
  "/manual",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "read", "all"),
  balanceLimiter,
  validateQuery(manualTopupListQuerySchema),
  listManualTopups,
);

/**
 * @swagger
 * /api/v1/wallet/topup/manual/{requestId}/approve:
 *   post:
 *     tags: [Wallet Top-up]
 *     summary: Approve a pending manual top-up
 *     description: Approves the request and credits the wallet.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reviewRemarks:
 *                 type: string
 *     responses:
 *       200:
 *         description: Request approved and wallet credited
 *       404:
 *         description: Request not found
 *       409:
 *         description: Request is not in a pending state
 */
router.post(
  "/manual/:requestId/approve",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "approve", "all"),
  transactionLimiter,
  validateParams(requestIdParamsSchema),
  validateBody(approveManualTopupSchema),
  approveManualTopup,
);

/**
 * @swagger
 * /api/v1/wallet/topup/manual/{requestId}/reject:
 *   post:
 *     tags: [Wallet Top-up]
 *     summary: Reject a pending manual top-up
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reviewRemarks]
 *             properties:
 *               reviewRemarks:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 1000
 *                 description: Mandatory — the audit trail needs a stated reason.
 *     responses:
 *       200:
 *         description: Request rejected
 *       400:
 *         description: Rejection remarks missing or shorter than 10 characters
 *       404:
 *         description: Request not found
 *       409:
 *         description: Request is not in a pending state
 */
router.post(
  "/manual/:requestId/reject",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "approve", "all"),
  transactionLimiter,
  validateParams(requestIdParamsSchema),
  validateBody(rejectManualTopupSchema),
  rejectManualTopup,
);

// ---------------------------------------------------------------------------
// Admin — payment links (literal /admin/payment-links before any /admin/:x)
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/wallet/topup/admin/payment-links:
 *   post:
 *     tags: [Wallet Top-up Admin]
 *     summary: Create a payable top-up link for another user
 *     description: |
 *       Mints a gateway payment link for a wallet identified in the body. A
 *       body-supplied identity is legitimate here precisely because the route
 *       is gated on `wallet:manage:all`; the self-serve routes never accept one.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               walletUserId: { type: string }
 *               clientCode: { type: string }
 *               subjectUserId: { type: string, format: uuid }
 *               amount: { type: number }
 *               currency: { type: string }
 *               description: { type: string }
 *               payerName: { type: string }
 *               payerEmail: { type: string, format: email }
 *               expiryHours: { type: integer }
 *     responses:
 *       201:
 *         description: Payment link created
 *       400:
 *         description: Validation failed or amount outside the configured band
 *       409:
 *         description: Provider disabled or not configured
 *   get:
 *     tags: [Wallet Top-up Admin]
 *     summary: List admin-created payment links
 *     description: |
 *       `kind` is forced to `ADMIN_LINK` by the route, so this listing cannot be
 *       widened into "every order on the platform" from the query string.
 *       Returns the same in-payload pagination envelope as the self listing.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: size
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: walletUserId
 *         schema: { type: string }
 *       - in: query
 *         name: clientCode
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Payment links retrieved
 */
router.post(
  "/admin/payment-links",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "manage", "all"),
  transactionLimiter,
  validateBody(createPaymentLinkSchema),
  createAdminPaymentLink,
);

router.get(
  "/admin/payment-links",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "manage", "all"),
  balanceLimiter,
  validateQuery(paymentLinkListQuerySchema),
  listAdminPaymentLinks,
);

/**
 * @swagger
 * /api/v1/wallet/topup/admin/payment-links/{orderId}:
 *   get:
 *     tags: [Wallet Top-up Admin]
 *     summary: Get one payment link, refreshed from the gateway when stale
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Payment link retrieved
 *       404:
 *         description: Payment order not found
 */
router.get(
  "/admin/payment-links/:orderId",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "manage", "all"),
  balanceLimiter,
  validateParams(orderIdParamsSchema),
  getAdminPaymentLink,
);

/**
 * @swagger
 * /api/v1/wallet/topup/admin/payment-links/{orderId}/refresh:
 *   post:
 *     tags: [Wallet Top-up Admin]
 *     summary: Force a gateway status poll for one order
 *     description: Bypasses the staleness window and re-reads the order at the provider.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Order refreshed from the provider
 *       404:
 *         description: Payment order not found
 *       502:
 *         description: The provider could not be reached
 */
router.post(
  "/admin/payment-links/:orderId/refresh",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "manage", "all"),
  transactionLimiter,
  validateParams(orderIdParamsSchema),
  refreshAdminPaymentLink,
);

/**
 * @swagger
 * /api/v1/wallet/topup/admin/payment-links/{orderId}/cancel:
 *   post:
 *     tags: [Wallet Top-up Admin]
 *     summary: Cancel an open payment link
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment link cancelled
 *       404:
 *         description: Payment order not found
 *       409:
 *         description: The link is already paid, cancelled or expired
 */
router.post(
  "/admin/payment-links/:orderId/cancel",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "manage", "all"),
  transactionLimiter,
  validateParams(orderIdParamsSchema),
  cancelAdminPaymentLink,
);

// ---------------------------------------------------------------------------
// Admin — reconciliation queue
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/wallet/topup/admin/reconcile-queue:
 *   get:
 *     tags: [Wallet Top-up Admin]
 *     summary: List orders whose wallet credit has not landed yet
 *     description: |
 *       The money-safety triage view: orders paid at the gateway whose credit is
 *       still pending, stuck or exhausted, together with the backlog counters.
 *       Returns the same in-payload pagination envelope as the other listings.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: size
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string, default: RECONCILE_PENDING }
 *       - in: query
 *         name: provider
 *         schema: { type: string, enum: [razorpay, stripe, cashfree, payu] }
 *     responses:
 *       200:
 *         description: Reconcile queue retrieved
 */
router.get(
  "/admin/reconcile-queue",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "manage", "all"),
  balanceLimiter,
  validateQuery(reconcileQueueQuerySchema),
  listReconcileQueue,
);

/**
 * @swagger
 * /api/v1/wallet/topup/admin/orders/{orderId}/reconcile:
 *   post:
 *     tags: [Wallet Top-up Admin]
 *     summary: Manually retry the wallet credit for one stuck order
 *     description: |
 *       Re-runs the credit for a single order out of band from the worker. The
 *       credit itself is idempotent, so a retry on an order that has since been
 *       credited is a safe no-op.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Retry attempted — the result reports whether it credited
 *       404:
 *         description: Payment order not found
 */
router.post(
  "/admin/orders/:orderId/reconcile",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "manage", "all"),
  transactionLimiter,
  validateParams(orderIdParamsSchema),
  retryReconcile,
);

// ---------------------------------------------------------------------------
// Self-serve single order — DECLARED LAST
// `/orders/:orderId` sits at the router root, so it must come after every
// literal top-level segment (`/self`, `/manual`, `/admin`, `/webhook`).
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/wallet/topup/orders/{orderId}:
 *   get:
 *     tags: [Wallet Top-up]
 *     summary: Get one of the caller's own top-up orders
 *     description: |
 *       Returns the order with a live gateway status when the stored row is
 *       stale. Scoped to `self`: the service re-checks ownership against the
 *       JWT and answers 403 for someone else's order.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Order retrieved
 *       403:
 *         description: The order does not belong to the caller
 *       404:
 *         description: Payment order not found
 */
router.get(
  "/orders/:orderId",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "read", "own"),
  balanceLimiter,
  validateParams(orderIdParamsSchema),
  getSelfOrder,
);

module.exports = router;
