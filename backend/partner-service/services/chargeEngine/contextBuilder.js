/**
 * Charges Engine v3 — pricing context (facts) builder
 *
 * Assembles the immutable facts object the condition evaluator and calculators
 * read. Pure assembly — all I/O (zones, pincode types, city info) is done by
 * the caller (quoteService) and passed in.
 *
 * Facts registry (keep in sync with prisma/seeds/chargeDefinitions.seed.js):
 *   paymentType, codAmount, invoiceValue, chargeableWeight, actualWeight,
 *   numberOfBoxes, maxDimensionCm, shipmentType, serviceType,
 *   shipmentDirection, isFragile, distanceKm, distanceMilestoneId,
 *   pickupGeoZoneIds, deliveryGeoZoneIds, outletBadge, eventUnits,
 *   pickup.{city,state,isMetro,cityClass,pincodeType.<NAME>},
 *   delivery.{...same},
 *   answers.<questionKey>[...]
 *
 * perSide charges are evaluated once per side with `side` aliased to that
 * side's facts (side.pincodeType.ODA etc.).
 */

/**
 * Normalize vasSelections ([{chargeCode, answer}]) into the answers map keyed
 * by each definition's bookingQuestion.key.
 *
 * Questions WITH followUp store an object answer ({enabled, floor, ...});
 * a scalar arriving for such a question is wrapped as {enabled: value}.
 * Questions without followUp keep scalar answers as-is.
 */
function buildAnswers(vasSelections = [], definitionsByCode = new Map()) {
  const answers = {};

  for (const selection of vasSelections) {
    if (!selection || !selection.chargeCode) continue;
    const definition = definitionsByCode.get(selection.chargeCode);
    const question = definition?.bookingQuestion;
    if (!question || !question.key) continue;

    let { answer } = selection;
    const hasFollowUp =
      Array.isArray(question.followUp) && question.followUp.length > 0;

    if (hasFollowUp) {
      if (answer === null || answer === undefined) continue;
      if (typeof answer !== "object" || Array.isArray(answer)) {
        answer = { enabled: answer };
      }
    }

    answers[question.key] = answer;
  }

  return answers;
}

/**
 * Build the facts object for one partner quote evaluation.
 */
function buildFacts({
  params,
  chargeableWeight,
  zoneResult,
  pickupGeoZoneIds,
  deliveryGeoZoneIds,
  pickupSide,
  deliverySide,
  answers,
  outletBadge,
  eventUnits,
}) {
  const {
    weight,
    dimensions,
    numberOfBoxes = 1,
    paymentType = "PREPAID",
    codAmount = 0,
    declaredValue = 0,
    isFragile = false,
    shipmentType = "B2C",
    serviceType = null,
    shipmentDirection = "FORWARD",
  } = params;

  const maxDimensionCm = dimensions
    ? Math.max(
        Number(dimensions.length) || 0,
        Number(dimensions.width) || 0,
        Number(dimensions.height) || 0,
      )
    : 0;

  return {
    paymentType,
    // Zeroed on non-COD shipments so a stray codAmount can never price a
    // prepaid quote
    codAmount: paymentType === "COD" ? Number(codAmount) || 0 : 0,
    invoiceValue: Number(declaredValue) || 0,
    chargeableWeight: Number(chargeableWeight) || 0,
    actualWeight: Number(weight) || 0,
    numberOfBoxes: Number(numberOfBoxes) || 1,
    maxDimensionCm,
    shipmentType,
    serviceType,
    shipmentDirection,
    isFragile: !!isFragile,
    distanceKm: zoneResult?.distanceKm ?? null,
    distanceMilestoneId: zoneResult?.milestone?.id || null,
    pickupGeoZoneIds: pickupGeoZoneIds || [],
    deliveryGeoZoneIds: deliveryGeoZoneIds || [],
    outletBadge: outletBadge || undefined,
    eventUnits,
    pickup: pickupSide || {},
    delivery: deliverySide || {},
    answers: answers || {},
  };
}

/**
 * Facts for a per-side evaluation: same facts, with `side` aliased to the
 * pickup or delivery side.
 */
function withSide(facts, sideName) {
  return { ...facts, side: facts[sideName] || {} };
}

/**
 * Build one side's facts ({city, state, isMetro, cityClass, pincodeType}).
 * pincodeTypeValuesByName: { ODA: "yes", HILL: "no", ... } (canonical names).
 */
function buildSide({ geo, pincodeTypeValuesByName }) {
  return {
    city: geo?.city || null,
    state: geo?.state || null,
    isMetro: geo?.isMetro ?? false,
    cityClass: geo?.cityClass || null,
    pincodeType: pincodeTypeValuesByName || {},
  };
}

module.exports = { buildAnswers, buildFacts, buildSide, withSide };
