const { walletService, walletMiddleware } = require("../shared");
const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");

/**
 * Shipment Controller with Wallet Integration
 *
 * Demonstrates integration with external Wallet Service for:
 * - Balance validation before shipment creation
 * - Payment reservation and confirmation
 * - Refund processing for cancelled shipments
 */

/**
 * Create a new shipment with payment processing
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createShipment(req, res) {
  try {
    const userId = req.user.id;
    const {
      pickup,
      delivery,
      packageDetails,
      serviceType = "standard",
      paymentMethod = "wallet",
    } = req.body;

    // Calculate shipment cost (mock calculation)
    const shipmentCost = calculateShipmentCost(
      pickup,
      delivery,
      packageDetails,
      serviceType,
    );

    logger.info("Creating shipment with wallet payment", {
      service: "shipment-service",
      userId,
      shipmentCost,
      paymentMethod,
      serviceType,
    });

    // Wallet reservation should already be done by middleware
    const { walletReservation } = req;

    if (!walletReservation) {
      return res
        .status(400)
        .json(
          APIResponse.error("Payment reservation required", "PAYMENT_REQUIRED"),
        );
    }

    // Create shipment record (mock implementation)
    const shipment = {
      id: `SHP${Date.now()}`,
      userId,
      pickup,
      delivery,
      packageDetails,
      serviceType,
      cost: shipmentCost,
      status: "created",
      paymentStatus: "reserved",
      reservationId: walletReservation.reservationId,
      createdAt: new Date().toISOString(),
      estimatedDelivery: calculateEstimatedDelivery(serviceType),
    };

    // In a real implementation, save to database here
    logger.info("Shipment created successfully", {
      service: "shipment-service",
      shipmentId: shipment.id,
      userId,
      cost: shipmentCost,
      reservationId: walletReservation.reservationId,
    });

    // Confirm payment reservation
    try {
      const confirmationResult =
        await walletMiddleware.confirmWalletReservation(
          walletReservation.reservationId,
          {
            shipmentId: shipment.id,
            serviceType,
            confirmedBy: "shipment-service",
          },
        );

      if (confirmationResult.success) {
        shipment.paymentStatus = "confirmed";
        shipment.transactionId = confirmationResult.data.transactionId;

        logger.info("Payment confirmed for shipment", {
          service: "shipment-service",
          shipmentId: shipment.id,
          transactionId: confirmationResult.data.transactionId,
        });
      }
    } catch (confirmError) {
      logger.error(
        "Failed to confirm payment, shipment created but payment pending",
        {
          service: "shipment-service",
          shipmentId: shipment.id,
          reservationId: walletReservation.reservationId,
          error: confirmError.message,
        },
      );

      // Shipment is created but payment confirmation failed
      shipment.paymentStatus = "confirmation_failed";
    }

    return res
      .status(201)
      .json(APIResponse.success(shipment, "Shipment created successfully"));
  } catch (error) {
    logger.error("Failed to create shipment", {
      service: "shipment-service",
      userId: req.user?.id,
      error: error.message,
      stack: error.stack,
    });

    return res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to create shipment",
          "SHIPMENT_CREATION_FAILED",
        ),
      );
  }
}

/**
 * Cancel a shipment and process refund
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function cancelShipment(req, res) {
  try {
    const userId = req.user.id;
    const { shipmentId } = req.params;
    const { reason = "user_requested" } = req.body;

    logger.info("Cancelling shipment", {
      service: "shipment-service",
      shipmentId,
      userId,
      reason,
    });

    // In real implementation, fetch shipment from database
    // Mock shipment data
    const shipment = {
      id: shipmentId,
      userId,
      cost: 150,
      status: "created",
      paymentStatus: "confirmed",
      transactionId: "txn123",
      createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    };

    // Validate shipment ownership
    if (shipment.userId !== userId) {
      return res
        .status(403)
        .json(APIResponse.error("Access denied", "FORBIDDEN"));
    }

    // Check if shipment can be cancelled
    if (!["created", "pickup_scheduled"].includes(shipment.status)) {
      return res
        .status(400)
        .json(
          APIResponse.error(
            "Shipment cannot be cancelled at this stage",
            "CANCELLATION_NOT_ALLOWED",
          ),
        );
    }

    // Calculate refund amount (could be partial based on cancellation policy)
    const refundAmount = calculateRefundAmount(shipment, reason);

    if (refundAmount > 0) {
      try {
        // Process refund
        const refundResult = await walletMiddleware.creditWalletAmount(
          userId,
          refundAmount,
          "INR",
          `refund-${shipmentId}`,
          {
            shipmentId,
            originalTransactionId: shipment.transactionId,
            cancellationReason: reason,
            refundType: "shipment_cancellation",
          },
        );

        if (refundResult.success) {
          logger.info("Refund processed successfully", {
            service: "shipment-service",
            shipmentId,
            userId,
            refundAmount,
            refundTransactionId: refundResult.data.transactionId,
          });

          // Update shipment status
          shipment.status = "cancelled";
          shipment.paymentStatus = "refunded";
          shipment.refundAmount = refundAmount;
          shipment.refundTransactionId = refundResult.data.transactionId;
          shipment.cancelledAt = new Date().toISOString();
          shipment.cancellationReason = reason;
        } else {
          logger.error("Refund processing failed", {
            service: "shipment-service",
            shipmentId,
            userId,
            refundAmount,
            error: refundResult.error,
          });

          return res
            .status(500)
            .json(
              APIResponse.error("Failed to process refund", "REFUND_FAILED"),
            );
        }
      } catch (refundError) {
        logger.error("Refund processing error", {
          service: "shipment-service",
          shipmentId,
          userId,
          refundAmount,
          error: refundError.message,
        });

        return res
          .status(500)
          .json(APIResponse.error("Failed to process refund", "REFUND_ERROR"));
      }
    } else {
      // No refund applicable
      shipment.status = "cancelled";
      shipment.paymentStatus = "no_refund";
      shipment.cancelledAt = new Date().toISOString();
      shipment.cancellationReason = reason;
    }

    return res.json(
      APIResponse.success(shipment, "Shipment cancelled successfully"),
    );
  } catch (error) {
    logger.error("Failed to cancel shipment", {
      service: "shipment-service",
      shipmentId: req.params.shipmentId,
      userId: req.user?.id,
      error: error.message,
      stack: error.stack,
    });

    return res
      .status(500)
      .json(
        APIResponse.error("Failed to cancel shipment", "CANCELLATION_FAILED"),
      );
  }
}

/**
 * Get user's wallet balance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getWalletBalance(req, res) {
  try {
    const userId = req.user.id;
    const { currency = "INR" } = req.query;

    logger.info("Getting wallet balance", {
      service: "shipment-service",
      userId,
      currency,
    });

    const walletClient = walletService.getWalletServiceClient();
    const balanceResult = await walletClient.getBalance(userId, currency);

    if (!balanceResult.success) {
      return res
        .status(503)
        .json(
          APIResponse.error(
            "Wallet service unavailable",
            "WALLET_SERVICE_ERROR",
          ),
        );
    }

    return res.json(
      APIResponse.success(balanceResult.data, "Balance retrieved successfully"),
    );
  } catch (error) {
    logger.error("Failed to get wallet balance", {
      service: "shipment-service",
      userId: req.user?.id,
      error: error.message,
    });

    if (error instanceof walletService.WalletServiceError) {
      return res
        .status(error.statusCode || 503)
        .json(APIResponse.error(error.message, "WALLET_SERVICE_ERROR"));
    }

    return res
      .status(500)
      .json(APIResponse.error("Failed to get balance", "BALANCE_CHECK_FAILED"));
  }
}

/**
 * Get transaction history for user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getTransactionHistory(req, res) {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0, dateFrom, dateTo } = req.query;

    logger.info("Getting transaction history", {
      service: "shipment-service",
      userId,
      limit,
      offset,
    });

    const walletClient = walletService.getWalletServiceClient();
    const historyResult = await walletClient.getTransactionHistory(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      dateFrom,
      dateTo,
    });

    if (!historyResult.success) {
      return res
        .status(503)
        .json(
          APIResponse.error(
            "Wallet service unavailable",
            "WALLET_SERVICE_ERROR",
          ),
        );
    }

    return res.json(
      APIResponse.success(
        historyResult.data,
        "Transaction history retrieved successfully",
      ),
    );
  } catch (error) {
    logger.error("Failed to get transaction history", {
      service: "shipment-service",
      userId: req.user?.id,
      error: error.message,
    });

    return res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to get transaction history",
          "HISTORY_FETCH_FAILED",
        ),
      );
  }
}

// Helper functions

/**
 * Calculate shipment cost based on parameters
 * @param {Object} pickup - Pickup details
 * @param {Object} delivery - Delivery details
 * @param {Object} packageDetails - Package details
 * @param {string} serviceType - Service type
 * @returns {number} Calculated cost
 */
function calculateShipmentCost(pickup, delivery, packageDetails, serviceType) {
  // Mock calculation - in real implementation, this would integrate with Partner Service
  let baseCost = 100;

  // Distance-based pricing (mock)
  const distance = calculateDistance(pickup, delivery);
  baseCost += distance * 2;

  // Weight-based pricing
  if (packageDetails.weight > 1) {
    baseCost += (packageDetails.weight - 1) * 20;
  }

  // Service type multiplier
  const serviceMultipliers = {
    express: 1.5,
    standard: 1.0,
    economy: 0.8,
  };

  baseCost *= serviceMultipliers[serviceType] || 1.0;

  return Math.round(baseCost);
}

/**
 * Calculate distance between pickup and delivery (mock)
 * @param {Object} pickup - Pickup location
 * @param {Object} delivery - Delivery location
 * @returns {number} Distance in kilometers
 */
function calculateDistance(pickup, delivery) {
  // Mock distance calculation
  return Math.random() * 50 + 10; // 10-60 km
}

/**
 * Calculate estimated delivery date
 * @param {string} serviceType - Service type
 * @returns {string} ISO date string
 */
function calculateEstimatedDelivery(serviceType) {
  const now = new Date();
  const deliveryDays = {
    express: 1,
    standard: 3,
    economy: 7,
  };

  const days = deliveryDays[serviceType] || 3;
  now.setDate(now.getDate() + days);

  return now.toISOString();
}

/**
 * Calculate refund amount based on cancellation policy
 * @param {Object} shipment - Shipment details
 * @param {string} reason - Cancellation reason
 * @returns {number} Refund amount
 */
function calculateRefundAmount(shipment, reason) {
  const { cost, createdAt } = shipment;
  const hoursElapsed =
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);

  // Refund policy based on time elapsed
  if (hoursElapsed < 1) {
    return cost; // Full refund within 1 hour
  } else if (hoursElapsed < 24) {
    return Math.round(cost * 0.8); // 80% refund within 24 hours
  } else {
    return Math.round(cost * 0.5); // 50% refund after 24 hours
  }
}

module.exports = {
  createShipment,
  cancelShipment,
  getWalletBalance,
  getTransactionHistory,
};
