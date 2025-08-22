const express = require("express");
const { walletMiddleware } = require("../shared");
const authMiddleware = require("../middleware/auth");
const shipmentController = require("../controllers/shipmentController");

const router = express.Router();

/**
 * Shipment Routes with Wallet Integration
 *
 * Demonstrates middleware usage for:
 * - Authentication
 * - Balance validation
 * - Payment reservation
 * - Error handling
 */

/**
 * @swagger
 * /api/shipments:
 *   post:
 *     summary: Create a new shipment with wallet payment
 *     tags: [Shipments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pickup
 *               - delivery
 *               - packageDetails
 *             properties:
 *               pickup:
 *                 type: object
 *                 properties:
 *                   address:
 *                     type: string
 *                   pincode:
 *                     type: string
 *                   contactName:
 *                     type: string
 *                   contactPhone:
 *                     type: string
 *               delivery:
 *                 type: object
 *                 properties:
 *                   address:
 *                     type: string
 *                   pincode:
 *                     type: string
 *                   contactName:
 *                     type: string
 *                   contactPhone:
 *                     type: string
 *               packageDetails:
 *                 type: object
 *                 properties:
 *                   weight:
 *                     type: number
 *                   dimensions:
 *                     type: object
 *                   description:
 *                     type: string
 *               serviceType:
 *                 type: string
 *                 enum: [express, standard, economy]
 *                 default: standard
 *               paymentMethod:
 *                 type: string
 *                 enum: [wallet, cod]
 *                 default: wallet
 *     responses:
 *       201:
 *         description: Shipment created successfully
 *       400:
 *         description: Invalid request data
 *       402:
 *         description: Insufficient wallet balance
 *       401:
 *         description: Authentication required
 *       503:
 *         description: Wallet service unavailable
 */
router.post(
  "/",
  authMiddleware.authenticate,
  // Calculate shipment cost and check balance
  walletMiddleware.requireSufficientBalance((req) => {
    const {
      pickup,
      delivery,
      packageDetails,
      serviceType = "standard",
    } = req.body;

    // Mock cost calculation - in real implementation, call Partner Service
    let cost = 100;
    if (packageDetails?.weight > 1) {
      cost += (packageDetails.weight - 1) * 20;
    }

    const serviceMultipliers = { express: 1.5, standard: 1.0, economy: 0.8 };
    cost *= serviceMultipliers[serviceType] || 1.0;

    return Math.round(cost);
  }),
  // Reserve payment amount
  walletMiddleware.reserveWalletAmount(
    (req) => req.walletInfo.checkedAmount, // Use the amount from balance check
    "INR",
    (req) => `shipment-${Date.now()}-${req.user.id}`, // Generate reference ID
  ),
  // Error handler for wallet operations
  walletMiddleware.walletErrorHandler(),
  shipmentController.createShipment,
);

/**
 * @swagger
 * /api/shipments/{shipmentId}/cancel:
 *   post:
 *     summary: Cancel a shipment and process refund
 *     tags: [Shipments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shipmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Shipment ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Cancellation reason
 *     responses:
 *       200:
 *         description: Shipment cancelled successfully
 *       400:
 *         description: Cancellation not allowed
 *       403:
 *         description: Access denied
 *       404:
 *         description: Shipment not found
 *       500:
 *         description: Cancellation failed
 */
router.post(
  "/:shipmentId/cancel",
  authMiddleware.authenticate,
  shipmentController.cancelShipment,
);

/**
 * @swagger
 * /api/shipments/wallet/balance:
 *   get:
 *     summary: Get user's wallet balance
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *           default: INR
 *         description: Currency code
 *     responses:
 *       200:
 *         description: Balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     currency:
 *                       type: string
 *                     balance:
 *                       type: number
 *                     availableBalance:
 *                       type: number
 *                     reservedBalance:
 *                       type: number
 *       401:
 *         description: Authentication required
 *       503:
 *         description: Wallet service unavailable
 */
router.get(
  "/wallet/balance",
  authMiddleware.authenticate,
  shipmentController.getWalletBalance,
);

/**
 * @swagger
 * /api/shipments/wallet/transactions:
 *   get:
 *     summary: Get user's transaction history
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of transactions to retrieve
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of transactions to skip
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering
 *     responses:
 *       200:
 *         description: Transaction history retrieved successfully
 *       401:
 *         description: Authentication required
 *       503:
 *         description: Wallet service unavailable
 */
router.get(
  "/wallet/transactions",
  authMiddleware.authenticate,
  shipmentController.getTransactionHistory,
);

/**
 * @swagger
 * /api/shipments/wallet/health:
 *   get:
 *     summary: Check wallet service health
 *     tags: [Wallet]
 *     responses:
 *       200:
 *         description: Wallet service is healthy
 *       503:
 *         description: Wallet service unavailable
 */
router.get("/wallet/health", async (req, res) => {
  try {
    const { walletService } = require("../shared");
    const walletClient = walletService.getWalletServiceClient();
    const healthResult = await walletClient.healthCheck();

    if (healthResult.success) {
      return res.json({
        success: true,
        data: healthResult.data,
        message: "Wallet service is healthy",
      });
    } else {
      return res.status(503).json({
        success: false,
        error: healthResult.error,
        message: "Wallet service is unavailable",
      });
    }
  } catch (error) {
    return res.status(503).json({
      success: false,
      error: {
        message: "Failed to check wallet service health",
        details: error.message,
      },
    });
  }
});

module.exports = router;
