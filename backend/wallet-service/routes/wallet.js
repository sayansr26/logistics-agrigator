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
const { authenticate, authorize } = require("../middleware/auth");
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
} = require("../validation/walletSchema");

const router = express.Router();

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
  authenticate,
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
  authenticate,
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
  authenticate,
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
  authenticate,
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
  authenticate,
  authorize(["admin", "finance"]), // Admin or finance role required
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
  authenticate,
  balanceLimiter,
  validateParams(userIdParamsSchema),
  validateQuery(transactionHistoryQuerySchema),
  getTransactions,
);

/**
 * @swagger
 * /api/v1/wallet/admin/all-wallets:
 *   get:
 *     tags: [Admin Operations]
 *     summary: Get all wallets (Admin only)
 *     description: |
 *       Retrieves paginated list of all wallets in the system. Administrative operation
 *       that requires admin role authorization. Supports filtering and searching.
 *     parameters:
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
 *           default: 50
 *         description: Number of wallets per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, SUSPENDED, BLOCKED]
 *         description: Filter by wallet status
 *       - in: query
 *         name: clientCode
 *         schema:
 *           type: string
 *           maxLength: 50
 *         description: Filter by client code
 *       - in: query
 *         name: searchUserId
 *         schema:
 *           type: string
 *           maxLength: 255
 *         description: Search by user ID (partial match)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All wallets retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get(
  "/admin/all-wallets",
  authenticate,
  authorize(["admin", "finance"]),
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
 *     description: |
 *       Retrieves paginated list of all transactions in the system. Administrative operation
 *       that requires admin role authorization. Supports comprehensive filtering.
 *     parameters:
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
 *           default: 50
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
 *         name: userId
 *         schema:
 *           type: string
 *           maxLength: 255
 *         description: Filter by user ID (partial match)
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
 *         description: Start date for date range filter
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for date range filter
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All transactions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get(
  "/admin/transactions",
  authenticate,
  authorize(["admin", "finance"]),
  strictLimiter,
  validateQuery(adminTransactionsQuerySchema),
  getAllTransactions,
);

/**
 * @swagger
 * /api/v1/wallet/payment-gateway/initiate:
 *   post:
 *     tags: [Payment Gateway]
 *     summary: Initiate payment gateway transaction (Future)
 *     description: |
 *       Initiates a payment gateway transaction for wallet top-up. This is a future feature
 *       placeholder for payment gateway integration (Razorpay, PayU, etc.).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - provider
 *             properties:
 *               amount:
 *                 type: number
 *                 format: decimal
 *                 minimum: 0.01
 *                 maximum: 999999.99
 *                 example: 500.00
 *                 description: Amount to load via payment gateway
 *               provider:
 *                 type: string
 *                 enum: [razorpay, payu, stripe, cashfree]
 *                 example: razorpay
 *                 description: Payment gateway provider
 *               metadata:
 *                 type: object
 *                 description: Additional payment metadata
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Payment initiation prepared (future feature)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post(
  "/payment-gateway/initiate",
  authenticate,
  transactionLimiter,
  validateBody(paymentGatewayInitiateSchema),
  initiatePayment,
);

/**
 * @swagger
 * /api/v1/wallet/payment-gateway/webhook:
 *   post:
 *     tags: [Payment Gateway]
 *     summary: Handle payment gateway webhook (Future)
 *     description: |
 *       Handles payment gateway webhook notifications for payment status updates.
 *       This is a future feature placeholder for payment gateway webhook handling.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentId
 *               - status
 *             properties:
 *               paymentId:
 *                 type: string
 *                 maxLength: 255
 *                 example: "pay_123456789"
 *                 description: Payment gateway payment ID
 *               status:
 *                 type: string
 *                 enum: [COMPLETED, FAILED, CANCELLED, REFUNDED]
 *                 example: COMPLETED
 *                 description: Payment status from gateway
 *               gatewayData:
 *                 type: object
 *                 description: Gateway-specific webhook data
 *     responses:
 *       200:
 *         description: Payment webhook received (future feature)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post(
  "/payment-gateway/webhook",
  validateBody(paymentGatewayWebhookSchema),
  handlePaymentWebhook,
);

/**
 * @swagger
 * /api/v1/wallet/payment-gateway/status/{paymentId}:
 *   get:
 *     tags: [Payment Gateway]
 *     summary: Check payment status (Future)
 *     description: |
 *       Retrieves payment status from payment gateway. This is a future feature
 *       placeholder for payment gateway status checking.
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *           maxLength: 255
 *         description: Payment gateway payment ID
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Payment status retrieved (future feature)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
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
  "/payment-gateway/status/:paymentId",
  authenticate,
  balanceLimiter,
  validateParams(paymentIdParamsSchema),
  getPaymentStatus,
);

/**
 * @swagger
 * /api/v1/wallet/health:
 *   get:
 *     tags: [Health]
 *     summary: Detailed health check with external service monitoring
 *     description: |
 *       Comprehensive health check that includes database, Redis, external wallet API status,
 *       and basic wallet service metrics. Provides detailed service health information.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Detailed health check completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: success
 *               message: Detailed health check completed
 *               data:
 *                 service: "wallet-service"
 *                 status: "ok"
 *                 timestamp: "2024-01-01T12:00:00.000Z"
 *                 checks:
 *                   database: "healthy"
 *                   redis: "healthy"
 *                   externalWalletAPI: "healthy"
 *                 metrics:
 *                   totalWallets: 150
 *                   totalTransactions: 1250
 *                   totalBalance: 125000.50
 *                 responseTime: 45
 *       503:
 *         description: Service health check failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get("/health", authenticate, getDetailedHealth);

module.exports = router;
