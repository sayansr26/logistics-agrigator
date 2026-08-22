/**
 * Bulk Re-rate Service
 *
 * Processes a batch of weight/dimension/courier-charge updates keyed by AWB number.
 * Per row: recompute volumetric/chargeable weight, selling charge (via partner rate
 * engine), courier cost & profit margin, reconcile the customer wallet
 * (refund-old / charge-new for PREPAID; adjust COD amount or wallet for COD), persist
 * the shipment, and record a ShipmentFinancialAdjustment + audit log.
 *
 * Returns a processing report with successful and failed records (client requirement:
 * "Validate all records, recalculate, adjust wallets, generate a processing report").
 *
 * Mirrors the single-shipment rerate flow in shipmentController.rerateShipment.
 */

const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");
const weightCalc = require("../shared/utils/weightCalc");
const partnerIntegrationService = require("./partnerIntegrationService");
const paymentProcessingService = require("./paymentProcessingService");
const shipmentWalletService = require("./shipmentWalletService");

const {
  checkRerateEligibility,
  buildHoldReason,
} = require("./rerateEligibility");

/**
 * Process one row. Returns a report entry; never throws (errors captured per-row).
 */
async function processRow(row, reason, ctx) {
  const { authToken, walletAuthToken, userId } = ctx;
  const result = {
    awbNumber: row.awbNumber,
    success: false,
  };

  try {
    const shipment = await prisma.shipment.findFirst({
      where: { awbNumber: row.awbNumber },
      select: {
        id: true,
        orderId: true,
        outletId: true,
        userId: true,
        walletUserId: true,
        status: true,
        walletTransactionId: true,
        partnerId: true,
        totalCost: true,
        codAmount: true,
        weight: true,
        length: true,
        width: true,
        height: true,
        numberOfBoxes: true,
        volumetricDivisor: true,
        volumetricFactor: true,
        paymentType: true,
        pickupPincode: true,
        deliveryPincode: true,
        serviceType: true,
        value: true,
        fragile: true,
        // Same omission as the single re-rate: without these the bulk re-quote
        // drops the shipment's VAS lines and mis-prices COD.
        vasSelections: true,
        codBaseAmount: true,
      },
    });

    if (!shipment) {
      result.error = "Shipment not found for AWB";
      return result;
    }
    // Same rule as the single re-rate: admins may settle a partner's weight
    // report whatever status the shipment has reached by the time it lands.
    const eligibility = checkRerateEligibility(shipment.status, ctx.role);
    if (!eligibility.allowed) {
      result.error = eligibility.reason;
      return result;
    }

    const oldCost = parseFloat(shipment.totalCost);
    const newWeight = row.newWeight || parseFloat(shipment.weight);
    const newLength = row.newLength || parseFloat(shipment.length);
    const newWidth = row.newWidth || parseFloat(shipment.width);
    const newHeight = row.newHeight || parseFloat(shipment.height);
    // Reuse the formula the shipment was originally priced with
    const { divisor, factor } = weightCalc.resolveVolumetricConfig({
      divisor: shipment.volumetricDivisor,
      factor: shipment.volumetricFactor,
    });
    const numBoxes = shipment.numberOfBoxes || 1;

    const newVolWeight = weightCalc.computeVolumetric({
      boxes: numBoxes,
      length: newLength,
      width: newWidth,
      height: newHeight,
      divisor,
      factor,
    });
    const newChargeableWeight = weightCalc.computeChargeable(
      newWeight,
      newVolWeight,
    );

    // Recalculate selling charge via partner rate engine
    let newCost = oldCost;
    let rateCourierCost = null;
    try {
      const rateData = await partnerIntegrationService.calculateRates(
        {
          fromPincode: shipment.pickupPincode,
          toPincode: shipment.deliveryPincode,
          weight: newChargeableWeight,
          serviceType: shipment.serviceType,
          dimensions: { length: newLength, width: newWidth, height: newHeight },
          paymentMode: shipment.paymentType,
          // Price COD on the base collectable — stored codAmount includes the
          // outlet markup since charges-engine v3
          codAmount: shipment.codBaseAmount
            ? parseFloat(shipment.codBaseAmount)
            : shipment.codAmount
              ? parseFloat(shipment.codAmount)
              : 0,
          declaredValue: shipment.value ? parseFloat(shipment.value) : 0,
          isFragile: shipment.fragile || false,
          outletId: shipment.outletId || undefined,
          partnerId: shipment.partnerId,
          skipServiceabilityCheck: true,
          // Re-price the same VAS lines the shipment was booked with
          vasSelections: Array.isArray(shipment.vasSelections)
            ? shipment.vasSelections.map((s) => ({
                chargeCode: s.chargeCode,
                answer: s.answer,
              }))
            : [],
        },
        authToken,
      );
      const partnerRate = (rateData.rates || []).find(
        (r) => r.partnerId === shipment.partnerId,
      );
      if (partnerRate) {
        newCost = partnerRate.totalAmount;
        if (
          partnerRate.courierCost !== undefined &&
          partnerRate.courierCost !== null
        ) {
          rateCourierCost = parseFloat(partnerRate.courierCost);
        }
      }
    } catch (rateErr) {
      logger.warn("Bulk re-rate: rate recalculation failed, using old cost", {
        service: "shipment-service",
        awbNumber: row.awbNumber,
        error: rateErr.message,
      });
    }

    const difference = weightCalc.round(newCost - oldCost, 2);

    // Courier cost & profit
    let newCourierCost = null;
    let newCourierCostSource = null;
    if (row.courierCharge !== undefined && row.courierCharge !== null) {
      newCourierCost = parseFloat(row.courierCharge);
      newCourierCostSource = "MANUAL";
    } else if (rateCourierCost !== null) {
      newCourierCost = rateCourierCost;
      newCourierCostSource = "RULE";
    }
    const newProfitMargin = weightCalc.computeProfitMargin(
      newCost,
      newCourierCost,
    );

    // Wallet reconciliation
    const walletResolution =
      await shipmentWalletService.resolveShipmentWalletTarget(shipment);
    const walletTarget = walletResolution.walletUserId;
    const oldCodAmount = shipment.codAmount
      ? parseFloat(shipment.codAmount)
      : 0;

    // Unique per adjustment — see the single re-rate for why the shipment
    // default reference cannot be reused.
    const settlementRef = `SHIPMENT_${shipment.id}_RERATE_${Date.now()}`;

    let refundTxId = null;
    let chargeTxId = null;
    let holdApplied = false;
    let codAmountUpdated = false;
    let newCodAmount = oldCodAmount;

    if (difference !== 0 && shipment.paymentType === "PREPAID") {
      // Settle ONLY the difference — refunding the full old charge and then
      // re-debiting the full new one double-charged the customer whenever the
      // refund leg failed. See the single re-rate for the full rationale.
      const delta = Math.abs(difference);

      if (difference > 0) {
        try {
          const charge = await paymentProcessingService.processShipmentPayment(
            walletTarget,
            delta,
            shipment.id,
            `Bulk re-rate top-up for ${shipment.orderId} (₹${oldCost} → ₹${newCost}): ${reason}`,
            walletAuthToken,
            settlementRef,
          );
          chargeTxId = charge.walletTransactionId;
        } catch (e) {
          holdApplied = true;
          logger.warn("Bulk re-rate top-up failed - hold applied", {
            awbNumber: row.awbNumber,
            shortfall: delta,
            error: e.message,
          });
        }
      } else {
        try {
          const refund = await paymentProcessingService.processShipmentRefund(
            walletTarget,
            delta,
            shipment.id,
            `Bulk re-rate partial refund for ${shipment.orderId} (₹${oldCost} → ₹${newCost}): ${reason}`,
            walletAuthToken,
            shipment.walletTransactionId,
            settlementRef,
          );
          refundTxId = refund.refundTransactionId;
        } catch (e) {
          logger.error("Bulk re-rate partial refund failed - refund owed", {
            awbNumber: row.awbNumber,
            owed: delta,
            error: e.message,
          });
        }
      }
    } else if (difference !== 0 && shipment.paymentType === "COD") {
      // For COD, default to UPDATE_COD (adjust COD amount) unless DEDUCT_WALLET requested
      const effectiveCodAction =
        difference < 0 ? "UPDATE_COD" : row.codAction || "UPDATE_COD";
      if (effectiveCodAction === "UPDATE_COD") {
        newCodAmount = Math.max(0, oldCodAmount + difference);
        codAmountUpdated = true;
      } else {
        // DEDUCT_WALLET — difference only, same rationale as PREPAID above.
        const delta = Math.abs(difference);

        if (difference > 0) {
          try {
            const charge =
              await paymentProcessingService.processShipmentPayment(
                walletTarget,
                delta,
                shipment.id,
                `Bulk re-rate top-up (COD wallet) for ${shipment.orderId} (₹${oldCost} → ₹${newCost}): ${reason}`,
                walletAuthToken,
                settlementRef,
              );
            chargeTxId = charge.walletTransactionId;
          } catch (e) {
            holdApplied = true;
            logger.warn(
              "Bulk re-rate COD wallet top-up failed - hold applied",
              {
                awbNumber: row.awbNumber,
                shortfall: delta,
                error: e.message,
              },
            );
          }
        } else {
          try {
            const refund = await paymentProcessingService.processShipmentRefund(
              walletTarget,
              delta,
              shipment.id,
              `Bulk re-rate partial refund (COD wallet) for ${shipment.orderId} (₹${oldCost} → ₹${newCost}): ${reason}`,
              walletAuthToken,
              shipment.walletTransactionId,
              settlementRef,
            );
            refundTxId = refund.refundTransactionId;
          } catch (e) {
            logger.error(
              "Bulk re-rate COD wallet partial refund failed - refund owed",
              { awbNumber: row.awbNumber, owed: delta, error: e.message },
            );
          }
        }
      }
    }

    const updateData = {
      disputeStatus: holdApplied ? "HOLD" : "RESOLVED",
      disputedWeight: newWeight,
      disputedLength: newLength,
      disputedWidth: newWidth,
      disputedHeight: newHeight,
      disputedCost: newCost,
      totalCost: holdApplied ? shipment.totalCost : newCost,
      chargeableWeight: newChargeableWeight,
      volumetricWeight: newVolWeight,
    };
    if (!holdApplied && newCourierCost !== null) {
      updateData.courierCost = newCourierCost;
      updateData.profitMargin = newProfitMargin;
      updateData.courierCostSource = newCourierCostSource;
    }
    if (codAmountUpdated) {
      updateData.codAmount = newCodAmount;
    }
    if (holdApplied) {
      updateData.status = "HOLD";
      updateData.holdReason = buildHoldReason({
        oldCost,
        newCost,
        oldWeight: parseFloat(shipment.weight),
        newWeight,
        reason,
      });
    }

    await prisma.shipment.update({
      where: { id: shipment.id },
      data: updateData,
    });

    await prisma.shipmentFinancialAdjustment.create({
      data: {
        shipmentId: shipment.id,
        adjustmentType: "DISPUTE_RERATE",
        reason: `[BULK] ${reason}`,
        oldAmount: oldCost,
        newAmount: newCost,
        difference,
        refundTransactionId: refundTxId,
        chargeTransactionId: chargeTxId,
        disputedWeight: newWeight,
        disputedLength: newLength,
        disputedWidth: newWidth,
        disputedHeight: newHeight,
        createdById: userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: "BULK_RERATE_SHIPMENT",
        resource: "Shipment",
        resourceId: shipment.id,
        changes: {
          reason,
          oldCost,
          newCost,
          difference,
          holdApplied,
          codAmountUpdated,
          courierCost: newCourierCost,
          profitMargin: newProfitMargin,
        },
        metadata: { source: "shipment-service", bulk: true },
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
        clientId: ctx.clientId,
      },
    });

    result.success = true;
    result.shipmentId = shipment.id;
    result.orderId = shipment.orderId;
    result.oldCost = oldCost;
    result.newCost = holdApplied ? oldCost : newCost;
    result.difference = difference;
    result.courierCost = newCourierCost;
    result.profitMargin = holdApplied ? null : newProfitMargin;
    result.chargeableWeight = newChargeableWeight;
    result.holdApplied = holdApplied;
    result.codAmountUpdated = codAmountUpdated;
    if (codAmountUpdated) {
      result.oldCodAmount = oldCodAmount;
      result.newCodAmount = newCodAmount;
    }
    return result;
  } catch (error) {
    logger.error("Bulk re-rate row failed", {
      service: "shipment-service",
      awbNumber: row.awbNumber,
      error: error.message,
    });
    result.error = error.message;
    return result;
  }
}

/**
 * Process a bulk re-rate batch sequentially (to avoid wallet race conditions).
 * @param {Array} rows
 * @param {string} reason
 * @param {Object} ctx - { userId, clientId, authToken, walletAuthToken, ip, userAgent }
 * @returns {Promise<{ total, successCount, failureCount, successful, failed }>}
 */
async function processBulkRerate(rows, reason, ctx) {
  const successful = [];
  const failed = [];

  for (const row of rows) {
    const r = await processRow(row, reason, ctx);
    if (r.success) successful.push(r);
    else failed.push(r);
  }

  return {
    total: rows.length,
    successCount: successful.length,
    failureCount: failed.length,
    successful,
    failed,
  };
}

module.exports = { processBulkRerate };
