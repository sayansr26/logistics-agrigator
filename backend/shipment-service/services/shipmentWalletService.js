const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");
const outletWalletContextService = require("./outletWalletContextService");

async function persistWalletUserId(shipmentId, walletUserId) {
  if (!shipmentId || !walletUserId) return;

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: { walletUserId },
  });
}

async function resolveShipmentWalletTarget(shipment) {
  if (!shipment) {
    return {
      walletUserId: null,
      source: "missing-shipment",
      persisted: false,
      isFallback: false,
    };
  }

  if (shipment.walletUserId) {
    return {
      walletUserId: shipment.walletUserId,
      source: "shipment.walletUserId",
      persisted: false,
      isFallback: false,
    };
  }

  let resolvedOutlet = null;
  let source = null;

  if (shipment.outletId) {
    resolvedOutlet =
      await outletWalletContextService.resolveOutletWalletByOutletId(
        shipment.outletId,
      );
    source = "user-service.outletId";
  }

  if (!resolvedOutlet && shipment.userId) {
    resolvedOutlet =
      await outletWalletContextService.resolveOutletWalletByUserId(
        shipment.userId,
      );
    source = "user-service.userId";
  }

  if (resolvedOutlet?.phone) {
    try {
      await persistWalletUserId(shipment.id, resolvedOutlet.phone);
    } catch (error) {
      logger.warn("Failed to persist resolved wallet user ID on shipment", {
        service: "shipment-service",
        shipmentId: shipment.id,
        walletUserId: resolvedOutlet.phone,
        error: error.message,
      });
    }

    return {
      walletUserId: resolvedOutlet.phone,
      source,
      persisted: true,
      isFallback: false,
    };
  }

  if (shipment.userId) {
    logger.warn("Falling back to shipment.userId for wallet operation", {
      service: "shipment-service",
      shipmentId: shipment.id,
      userId: shipment.userId,
    });

    return {
      walletUserId: shipment.userId,
      source: "shipment.userId",
      persisted: false,
      isFallback: true,
    };
  }

  return {
    walletUserId: null,
    source: "unresolved",
    persisted: false,
    isFallback: false,
  };
}

function getCancellationPaymentStatus(
  shipment,
  refundAmount,
  refundTransactionId,
) {
  if (shipment.paymentType === "COD" || refundAmount <= 0) {
    return "NO_REFUND";
  }

  if (refundTransactionId) {
    return "REFUNDED";
  }

  return "REFUND_FAILED";
}

module.exports = {
  resolveShipmentWalletTarget,
  getCancellationPaymentStatus,
};
