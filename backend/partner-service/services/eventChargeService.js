/**
 * Event Charge Service (Charges Engine v3)
 *
 * Prices EVENT-stage charges (demurrage, reattempt delivery, address
 * correction, in-transit cancellation, NDR handling) on demand for an existing
 * shipment context. The result feeds shipment-service's
 * ShipmentFinancialAdjustment — this service only computes, it never persists
 * money movements.
 */

const { prisma } = require("../config/database");
const { ValidationError, NotFoundError } = require("../shared/lib/errors");
const { compute, round2 } = require("./chargeEngine/calculators");
const { evaluate } = require("./chargeEngine/conditionEvaluator");

/**
 * Quote an EVENT charge.
 *
 * @param {Object} input
 * @param {string} input.partnerId
 * @param {string} input.chargeCode - EVENT-stage definition code (e.g. DEMURRAGE)
 * @param {Object} [input.eventParams] - e.g. { units: 9 } (days/attempts)
 * @param {Object} [input.shipmentContext] - { chargeableWeight, codAmount,
 *   invoiceValue, paymentType, shipmentType }
 * @returns {{ chargeCode, name, amount, gstRate, gstAmount, total, calculation }}
 */
async function quoteEventCharge({
  partnerId,
  chargeCode,
  eventParams = {},
  shipmentContext = {},
}) {
  const definition = await prisma.chargeDefinition.findUnique({
    where: { code: chargeCode },
  });
  if (!definition) throw new NotFoundError("ChargeDefinition", chargeCode);
  if (definition.applyStage !== "EVENT") {
    throw new ValidationError(
      `${chargeCode} is not an EVENT-stage charge (stage: ${definition.applyStage})`,
    );
  }
  if (!definition.isActive) {
    throw new ValidationError(`${chargeCode} is not active`);
  }

  const config = await prisma.partnerChargeConfig.findFirst({
    where: {
      partnerId,
      chargeDefinitionId: definition.id,
      isActive: true,
    },
    orderBy: { priority: "asc" },
  });
  if (!config) {
    throw new NotFoundError(
      "PartnerChargeConfig",
      `${chargeCode} for partner ${partnerId}`,
    );
  }

  const facts = {
    chargeableWeight: Number(shipmentContext.chargeableWeight) || 0,
    codAmount: Number(shipmentContext.codAmount) || 0,
    invoiceValue: Number(shipmentContext.invoiceValue) || 0,
    paymentType: shipmentContext.paymentType || "PREPAID",
    shipmentType: shipmentContext.shipmentType || "B2C",
    eventUnits: Number(
      eventParams.units ?? eventParams.days ?? eventParams.attempts,
    ),
    answers: {},
  };

  const conditions = config.conditions || definition.conditions || null;
  if (!evaluate(conditions, facts)) {
    return {
      chargeCode,
      name: definition.name,
      applicable: false,
      amount: 0,
      gstRate: 0,
      gstAmount: 0,
      total: 0,
      calculation: "conditions not met for this shipment context",
    };
  }

  const result = compute(definition.computation, config.config, facts);
  if (!result || result.amount <= 0) {
    return {
      chargeCode,
      name: definition.name,
      applicable: false,
      amount: 0,
      gstRate: 0,
      gstAmount: 0,
      total: 0,
      calculation: result?.calculation || "no charge for the given parameters",
    };
  }

  // GST from the partner's GST config (taxable EVENT charges)
  let gstRate = 0;
  let gstAmount = 0;
  const taxable = definition.flags?.taxable !== false;
  if (taxable) {
    const gstDefinition = await prisma.chargeDefinition.findUnique({
      where: { code: "GST" },
      select: { id: true },
    });
    if (gstDefinition) {
      const gstConfig = await prisma.partnerChargeConfig.findFirst({
        where: {
          partnerId,
          chargeDefinitionId: gstDefinition.id,
          isActive: true,
        },
        select: { config: true },
      });
      gstRate = Number(gstConfig?.config?.percent) || 0;
      gstAmount = round2((result.amount * gstRate) / 100);
    }
  }

  return {
    chargeCode,
    name: definition.name,
    applicable: true,
    amount: result.amount,
    gstRate,
    gstAmount,
    total: round2(result.amount + gstAmount),
    calculation: result.calculation,
  };
}

module.exports = { quoteEventCharge };
