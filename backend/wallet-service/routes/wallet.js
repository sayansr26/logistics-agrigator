const express = require("express");
const {
  getWallet,
  getBalance,
  debitWallet,
  creditWallet,
  getTransactions,
  loadBalance,
  getAllWallets,
  getAllTransactions,
  initiatePayment,
  handlePaymentWebhook,
  getPaymentStatus,
  getDetailedHealth,
} = require("../controllers/walletController");
const { authMiddleware } = require("../shared/lib/auth");
const {
  validateParams,
  validateBody,
  validateQuery,
} = require("../middleware/validate");
const {
  balanceLimiter,
  transactionLimiter,
  strictLimiter,
} = require("../middleware/rateLimiter");
const {
  userIdParamsSchema,
  paymentIdParamsSchema,
  debitWalletSchema,
  creditWalletSchema,
  loadBalanceSchema,
  transactionHistoryQuerySchema,
  adminWalletsQuerySchema,
  adminTransactionsQuerySchema,
  paymentGatewayInitiateSchema,
  paymentGatewayWebhookSchema,
  adminClientWalletsQuerySchema,
  adminClientTransactionsQuerySchema,
  adminGetWalletQuerySchema,
  adminWalletTransactionSchema,
  adminUpdateUserStatusSchema,
  adminSyncWalletsSchema,
} = require("../validation/walletSchema");
const {
  getClientWallets,
  getClientTransactions,
  getWallet: getAdminWallet,
  updateUserStatus,
  topupWallet,
  debitWallet: adminDebitWallet,
  refundWallet,
  syncWallets,
} = require("../controllers/adminWalletController");
const {
  getMyTransactionHistory,
  getMyTransactionStatistics,
  getMyWalletInfo,
} = require("../controllers/outletWalletController");
const {
  getSummary: getDashboardSummary,
  getTrend: getDashboardTrend,
} = require("../controllers/dashboardController");
const { dashboardRangeQuerySchema } = require("../validation/dashboardSchema");

const router = express.Router();

// -------------------------------------------------------------------------
// IMPORTANT: /admin/* routes MUST be defined BEFORE /:userId/* routes
// otherwise Express matches "admin" as a userId parameter
// -------------------------------------------------------------------------

/**
 * GET /api/v1/wallet/admin/client-wallets
 * List all wallets for a client from external wallet API
 */
router.get(
  "/admin/client-wallets",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "manage", "all"),
  validateQuery(adminClientWalletsQuerySchema),
  getClientWallets,
);

/**
 * GET /api/v1/wallet/admin/client-transactions
 * List all transactions for a client from external wallet API
 */
router.get(
  "/admin/client-transactions",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "manage", "all"),
  validateQuery(adminClientTransactionsQuerySchema),
  getClientTransactions,
);

/**
 * GET /api/v1/wallet/admin/wallet
 * Get or create wallet for a specific user (userId in query)
 */
// Service-callable: shipment-service resolves the outlet's wallet during
// booking, on behalf of a user who only holds wallet:read:own.
router.get(
  "/admin/wallet",
  authMiddleware.authenticate,
  authMiddleware.requirePermissionOrService("wallet", "manage", "all"),
  validateQuery(adminGetWalletQuerySchema),
  getAdminWallet,
);

/**
 * PATCH /api/v1/wallet/admin/user-status
 * Update user status under a client
 */
router.patch(
  "/admin/user-status",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "manage", "all"),
  validateBody(adminUpdateUserStatusSchema),
  updateUserStatus,
);

/**
 * POST /api/v1/wallet/admin/topup
 * Top up a user's wallet via external wallet API
 */
router.post(
  "/admin/topup",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "manage", "all"),
  validateBody(adminWalletTransactionSchema),
  topupWallet,
);

/**
 * POST /api/v1/wallet/admin/debit
 * Debit a user's wallet via external wallet API
 */
// Service-callable: the booking-time debit. The outlet paying for the shipment
// holds only wallet:read:own, so gating this on the caller's permissions makes
// booking impossible for every non-admin role.
router.post(
  "/admin/debit",
  authMiddleware.authenticate,
  authMiddleware.requirePermissionOrService("wallet", "manage", "all"),
  validateBody(adminWalletTransactionSchema),
  adminDebitWallet,
);

/**
 * POST /api/v1/wallet/admin/refund
 * Refund to a user's wallet via external wallet API
 */
// Service-callable: the cancellation refund, same rationale as /admin/debit.
router.post(
  "/admin/refund",
  authMiddleware.authenticate,
  authMiddleware.requirePermissionOrService("wallet", "manage", "all"),
  validateBody(adminWalletTransactionSchema),
  refundWallet,
);

/**
 * POST /api/v1/wallet/admin/sync-wallets
 * Batch create wallets for multiple users (rate-limited)
 */
router.post(
  "/admin/sync-wallets",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "manage", "all"),
  validateBody(adminSyncWalletsSchema),
  syncWallets,
);

// -------------------------------------------------------------------------
// Admin local DB routes (all-wallets, transactions)
// -------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/wallet/admin/all-wallets:
 *   get:
 *     tags: [Admin Operations]
 *     summary: Get all wallets (Admin only)
 */
router.get(
  "/admin/all-wallets",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "manage", "all"),
  strictLimiter,
  validateQuery(adminWalletsQuerySchema),
  getAllWallets,
);

/**
 * @swagger
 * /api/v1/wallet/admin/transactions:
 *   get:
 *     tags: [Admin Operations]
 *     summary: Get all transactions (Admin only)
 */
router.get(
  "/admin/transactions",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "manage", "all"),
  strictLimiter,
  validateQuery(adminTransactionsQuerySchema),
  getAllTransactions,
);

// -------------------------------------------------------------------------
// Outlet (my) routes — authenticated user's own wallet data
// MUST be defined BEFORE /:userId catch-all routes
// -------------------------------------------------------------------------

/**
 * GET /api/v1/wallet/my/wallet-info
 * Get wallet info for the authenticated outlet user
 */
router.get(
  "/my/wallet-info",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "read", "own"),
  getMyWalletInfo,
);

/**
 * GET /api/v1/wallet/my/transactions
 * Get transaction history for the authenticated outlet user
 */
router.get(
  "/my/transactions",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "read", "own"),
  getMyTransactionHistory,
);

/**
 * GET /api/v1/wallet/my/statistics
 * Get transaction statistics for the authenticated outlet user
 */
router.get(
  "/my/statistics",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "read", "own"),
  getMyTransactionStatistics,
);

// -------------------------------------------------------------------------
// Dashboard routes — read-only aggregation for the ops/financial dashboard
// (backed by the local Wallet/Transaction ledger). Scoped the same way as
// the outlet "my/*" routes: outlet sees only their own wallet's data,
// admin/superadmin see everything. MUST be defined BEFORE /:userId routes.
// -------------------------------------------------------------------------

/**
 * GET /api/v1/wallet/dashboard/summary
 * Total balance, wallet status breakdown, top-up/debit sums, transaction
 * counts and low-balance wallets within the given day range.
 */
router.get(
  "/dashboard/summary",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "read", "own"),
  validateQuery(dashboardRangeQuerySchema),
  getDashboardSummary,
);

/**
 * GET /api/v1/wallet/dashboard/trend
 * Daily time series of top-up and debit totals within the given day range.
 */
router.get(
  "/dashboard/trend",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "read", "own"),
  validateQuery(dashboardRangeQuerySchema),
  getDashboardTrend,
);

// -------------------------------------------------------------------------
// Health check
// -------------------------------------------------------------------------

router.get("/health", authMiddleware.authenticate, getDetailedHealth);

// -------------------------------------------------------------------------
// Payment gateway routes (future)
// -------------------------------------------------------------------------

router.post(
  "/payment-gateway/initiate",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "create", "own"),
  transactionLimiter,
  validateBody(paymentGatewayInitiateSchema),
  initiatePayment,
);

router.post(
  "/payment-gateway/webhook",
  validateBody(paymentGatewayWebhookSchema),
  handlePaymentWebhook,
);

router.get(
  "/payment-gateway/status/:paymentId",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "read", "own"),
  balanceLimiter,
  validateParams(paymentIdParamsSchema),
  getPaymentStatus,
);

// -------------------------------------------------------------------------
// User-specific routes (/:userId must be LAST - catches everything)
// -------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/wallet/{userId}:
 *   get:
 *     tags: [Wallet Management]
 *     summary: Get or create wallet for user
 *     description: |
 *       Retrieves wallet for the specified user. If wallet doesn't exist, it will be automatically created.
 *       This endpoint implements the AUTO WALLET CREATION requirement.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID to get/create wallet for
 *       - in: query
 *         name: clientCode
 *         schema:
 *           type: string
 *           default: DEFAULT
 *         description: Client code for multi-tenant support
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet retrieved or created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: success
 *               message: Wallet retrieved successfully
 *               data:
 *                 id: "550e8400-e29b-41d4-a716-446655440000"
 *                 userId: "550e8400-e29b-41d4-a716-446655440001"
 *                 balance: 1250.50
 *                 externalWalletId: "ext_wallet_123"
 *                 clientCode: "DEFAULT"
 *                 status: "ACTIVE"
 *                 createdAt: "2024-01-01T00:00:00.000Z"
 *                 updatedAt: "2024-01-01T12:00:00.000Z"
 *                 transactions: []
 *                 _count:
 *                   transactions: 0
 *                   paymentGateways: 0
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get(
  "/:userId",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "read", "own"),
  balanceLimiter,
  validateParams(userIdParamsSchema),
  getWallet,
);

/**
 * @swagger
 * /api/v1/wallet/{userId}/balance:
 *   get:
 *     tags: [Wallet Management]
 *     summary: Get wallet balance
 *     description: |
 *       Retrieves current wallet balance with optional external wallet synchronization.
 *       Includes balance comparison between local and external wallet if linked.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID to get balance for
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: success
 *               message: Balance retrieved successfully
 *               data:
 *                 userId: "550e8400-e29b-41d4-a716-446655440001"
 *                 walletId: "550e8400-e29b-41d4-a716-446655440000"
 *                 balance: 1250.50
 *                 externalBalance: 1250.50
 *                 currency: "INR"
 *                 status: "ACTIVE"
 *                 lastUpdated: "2024-01-01T12:00:00.000Z"
 *                 externalWalletLinked: true
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get(
  "/:userId/balance",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "read", "assigned"),
  balanceLimiter,
  validateParams(userIdParamsSchema),
  getBalance,
);

/**
 * @swagger
 * /api/v1/wallet/{userId}/debit:
 *   post:
 *     tags: [Transactions]
 *     summary: Debit wallet for shipment charges
 *     description: |
 *       Debits the specified amount from user's wallet for shipment charges.
 *       Validates sufficient balance before processing. Integrates with external wallet if linked.
 *       This endpoint is used for shipment charge deduction as per requirements.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID to debit wallet for
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - reference
 *             properties:
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 minimum: 0.01
 *                 maximum: 999999.99
 *                 example: 150.75
 *                 description: Amount to debit (maximum ₹9,99,999.99)
 *               reference:
 *                 type: string
 *                 maxLength: 255
 *                 example: "SHIPMENT_12345"
 *                 description: Reference for the transaction (shipment ID, order ID, etc.)
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Shipment charges for order #12345"
 *                 description: Optional transaction description
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet debited successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: success
 *               message: Wallet debited successfully
 *               data:
 *                 id: "550e8400-e29b-41d4-a716-446655440002"
 *                 walletId: "550e8400-e29b-41d4-a716-446655440000"
 *                 type: "DEBIT"
 *                 amount: 150.75
 *                 description: "Shipment charges for order #12345"
 *                 reference: "SHIPMENT_12345"
 *                 status: "COMPLETED"
 *                 createdAt: "2024-01-01T12:00:00.000Z"
 *                 metadata:
 *                   externalTransactionId: "ext_tx_123"
 *                   processedAt: "2024-01-01T12:00:00.000Z"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       402:
 *         description: Insufficient funds
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               status: error
 *               message: "Insufficient balance. Available: 100.00, Required: 150.75"
 *               error:
 *                 code: INSUFFICIENT_FUNDS
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post(
  "/:userId/debit",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "debit", "all"),
  transactionLimiter,
  validateParams(userIdParamsSchema),
  validateBody(debitWalletSchema),
  debitWallet,
);

/**
 * @swagger
 * /api/v1/wallet/{userId}/credit:
 *   post:
 *     tags: [Transactions]
 *     summary: Credit wallet for refunds
 *     description: |
 *       Credits the specified amount to user's wallet for refunds or adjustments.
 *       Integrates with external wallet if linked. Used for refund processing as per requirements.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID to credit wallet for
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - reference
 *             properties:
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 minimum: 0.01
 *                 maximum: 999999.99
 *                 example: 75.25
 *                 description: Amount to credit (maximum ₹9,99,999.99)
 *               reference:
 *                 type: string
 *                 maxLength: 255
 *                 example: "REFUND_12345"
 *                 description: Reference for the transaction (refund ID, adjustment ID, etc.)
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Refund for cancelled shipment #12345"
 *                 description: Optional transaction description
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet credited successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: success
 *               message: Wallet credited successfully
 *               data:
 *                 id: "550e8400-e29b-41d4-a716-446655440003"
 *                 walletId: "550e8400-e29b-41d4-a716-446655440000"
 *                 type: "CREDIT"
 *                 amount: 75.25
 *                 description: "Refund for cancelled shipment #12345"
 *                 reference: "REFUND_12345"
 *                 status: "COMPLETED"
 *                 createdAt: "2024-01-01T12:00:00.000Z"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post(
  "/:userId/credit",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "credit", "all"),
  transactionLimiter,
  validateParams(userIdParamsSchema),
  validateBody(creditWalletSchema),
  creditWallet,
);

/**
 * @swagger
 * /api/v1/wallet/{userId}/load-balance:
 *   post:
 *     tags: [Admin Operations]
 *     summary: Load balance manually (Admin only)
 *     description: |
 *       Manually loads balance into user's wallet. This is an administrative operation
 *       that requires admin role authorization. Used for manual balance adjustments.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID to load balance for
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - reference
 *             properties:
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 minimum: 0.01
 *                 maximum: 999999.99
 *                 example: 1000.00
 *                 description: Amount to load (maximum ₹9,99,999.99)
 *               reference:
 *                 type: string
 *                 maxLength: 255
 *                 example: "MANUAL_LOAD_2024_001"
 *                 description: Reference for the balance load
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Manual balance load for premium customer"
 *                 description: Optional load description
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Balance loaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: success
 *               message: Balance loaded successfully
 *               data:
 *                 id: "550e8400-e29b-41d4-a716-446655440004"
 *                 walletId: "550e8400-e29b-41d4-a716-446655440000"
 *                 type: "LOAD_BALANCE"
 *                 amount: 1000.00
 *                 description: "Manual balance load for premium customer"
 *                 reference: "MANUAL_LOAD_2024_001"
 *                 status: "COMPLETED"
 *                 createdAt: "2024-01-01T12:00:00.000Z"
 *                 metadata:
 *                   adminUserId: "550e8400-e29b-41d4-a716-446655440099"
 *                   loadType: "manual"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post(
  "/:userId/load-balance",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "load_balance", "all"),
  strictLimiter,
  validateParams(userIdParamsSchema),
  validateBody(loadBalanceSchema),
  loadBalance,
);

/**
 * @swagger
 * /api/v1/wallet/{userId}/transactions:
 *   get:
 *     tags: [Transactions]
 *     summary: Get transaction history
 *     description: |
 *       Retrieves paginated transaction history for the specified user's wallet.
 *       Supports filtering by transaction type, status, date range, and reference.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID to get transaction history for
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of transactions per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [DEBIT, CREDIT, REFUND, LOAD_BALANCE, ADJUSTMENT]
 *         description: Filter by transaction type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, CANCELLED, PROCESSING]
 *         description: Filter by transaction status
 *       - in: query
 *         name: reference
 *         schema:
 *           type: string
 *           maxLength: 255
 *         description: Filter by reference (partial match)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for date range filter (ISO format)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for date range filter (ISO format)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Transaction history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: success
 *               message: Transaction history retrieved successfully
 *               data:
 *                 transactions:
 *                   - id: "550e8400-e29b-41d4-a716-446655440002"
 *                     walletId: "550e8400-e29b-41d4-a716-446655440000"
 *                     type: "DEBIT"
 *                     amount: 150.75
 *                     description: "Shipment charges for order #12345"
 *                     reference: "SHIPMENT_12345"
 *                     status: "COMPLETED"
 *                     createdAt: "2024-01-01T12:00:00.000Z"
 *                 pagination:
 *                   page: 1
 *                   limit: 20
 *                   total: 45
 *                   totalPages: 3
 *                   hasMore: true
 *                 wallet:
 *                   id: "550e8400-e29b-41d4-a716-446655440000"
 *                   userId: "550e8400-e29b-41d4-a716-446655440001"
 *                   balance: 1250.50
 *                   status: "ACTIVE"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get(
  "/:userId/transactions",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "read", "assigned"),
  balanceLimiter,
  validateParams(userIdParamsSchema),
  validateQuery(transactionHistoryQuerySchema),
  getTransactions,
);

module.exports = router;
