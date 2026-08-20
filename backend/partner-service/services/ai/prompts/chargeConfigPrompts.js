/**
 * Charges Engine v3 — AI prompt templates (versioned)
 *
 * The system prompts embed the ChargeDefinition/PartnerChargeConfig contract
 * so DeepSeek drafts configs the deterministic engine can execute. Drafts are
 * ALWAYS stored as PENDING suggestions and re-validated in code — the model's
 * output is never trusted or applied directly.
 */

const PROMPT_VERSION = "v2";

const CONTRACT = `
You draft configuration for a deterministic shipping charges engine. You NEVER compute prices yourself — you produce config JSON the engine executes.

## ChargeDefinition (catalog entry, shared across partners)
{
  "code": "UPPER_SNAKE_CASE unique id",
  "name": "human label",
  "category": "BASE|COD|VAS|PICKUP_DELIVERY|SURCHARGE|RISK|TAX|NOTIFICATION|EVENT|DISCOUNT",
  "applyStage": "QUOTE|BOOKING_OPTION|EVENT",
  "phase": 100-950,  // 100 base freight, 200 docket, 300 pickup/delivery, 400 VAS, 500 value-based (COD/risk), 600 fuel, 650 green tax, 700 reverse, 800 discount, 900 GST, 950 events
  "computation": { "method": "...", "basis": "...", ... },
  "bookingQuestion": null | { "key", "label", "type": "boolean|select|datetime|number", "options"?: [{"value","label"}], "followUp"?: [{"when","key","label","type","options"?}] },
  "conditions": null | { "all"|"any": [ { "fact", "op": "eq|ne|gt|gte|lt|lte|in|nin|exists|truthy", "value" } ] },
  "aggregation": null | { "group", "strategy": "HIGHEST|SUM", "perSide"?: true },
  "flags": { "fuelApplicable"?: bool, "taxable"?: bool, "aiAssisted"?: bool }
}

## computation methods and their PartnerChargeConfig.config shapes
- FLAT (basis NONE): config { "amount": number }
- PERCENT_WITH_MIN (basis COD_AMOUNT|INVOICE_VALUE): config { "percent": number, "minAmount": number }; with "optionsBy": "<answerKey>" the config is keyed per option value instead
- PER_UNIT (basis CHARGEABLE_WEIGHT): config { "perUnit": number, "unitSize": number, "minAmount": number }
- SLAB (basis ANSWER_VALUE + "answerPath"): config { "slabs": [ { "upTo": number, "amount": number } ] }
- MATRIX (basis CHARGEABLE_WEIGHT): config { "mode": "MILESTONE"|"ZONE_PAIR", "rows": [ { "zoneMilestoneId"?: uuid, "fromZoneId"?: uuid, "toZoneId"?: uuid, "perKg": number, "charge": number, "minCharge"?: number } ] }
- PER_UNIT_TIME (basis CHARGEABLE_WEIGHT|EVENT_UNITS): config { "perKgPerDay"|"perUnit": number, "freeUnits": number, "minAmount"?: number }
- RATE_ADJUSTMENT (basis SUBTOTAL + "subtotalOf": "FUEL_APPLICABLE|FREIGHT|PRE_TAX|TAXABLE"): config { "percent": number, "flatExtra"?: number }
- OPTION_RATE (basis ANSWER_VALUE + "answerPath"): config { "rates": { "<optionValue>": number }, "perBox"?: bool }
- DISCOUNT (basis SUBTOTAL, subtotalOf PRE_TAX): config { "tiers": { "<badge>": { "type": "FLAT|PERCENTAGE", "value": number } } }

## MATRIX (BASE freight) rules — read carefully, these are the usual mistakes
- The two modes are NOT interchangeable and a row in the wrong mode NEVER matches, so the charge silently vanishes from every quote:
  - the partner's zone is type DISTANCE (it has km milestones) → mode "MILESTONE", one row per milestone, keyed by "zoneMilestoneId"
  - the partner's zone is type GEOLOGICAL (states/cities/pincodes) → mode "ZONE_PAIR", rows keyed by "fromZoneId" + "toZoneId"
- Use ONLY the exact UUIDs listed in the ZONE CONTEXT below. NEVER invent an id, and never use a placeholder such as "zone-a", "A", or "milestone-1" — a config with a made-up id is rejected.
- Row maths is: max(minCharge, ceil(chargeableWeight / perKg) x charge). So "perKg" is the SLAB SIZE IN KG, not a rate: "Rs 26 for up to 52 kg" is { "perKg": 52, "charge": 26, "minCharge": 26 }, and "Rs 52 per kg with Rs 26 minimum" is { "perKg": 1, "charge": 52, "minCharge": 26 }. Ask yourself which the admin meant and put it in "warnings" if it is ambiguous.
- A BASE-category charge is collected on EVERY shipment of that partner. Cover every milestone (MILESTONE mode) or every ordered zone pair including same-zone lanes like A→A (ZONE_PAIR mode); any lane you leave out makes the partner unquotable on that lane. Do NOT attach conditions to a BASE charge unless the admin explicitly asked for one.
- All rows of one partner's base freight belong in ONE config for the BASE_FREIGHT definition — do not create a new definition per zone.

## Facts available in conditions
paymentType ("COD"/"PREPAID"), codAmount, invoiceValue, chargeableWeight, actualWeight, numberOfBoxes, maxDimensionCm, shipmentType ("B2B"/"B2C"), serviceType, shipmentDirection ("FORWARD"/"REVERSE"), isFragile, distanceKm, outletBadge, pickup.city/state/isMetro/cityClass, delivery.city/state/isMetro/cityClass, side.pincodeType.<NAME> (with aggregation.perSide), answers.<questionKey>[.<followUpKey>]
`;

/**
 * Render the partner's real zones/milestones so the model references existing
 * UUIDs instead of inventing placeholders, and can pick MILESTONE vs ZONE_PAIR
 * from the zone types the partner actually has.
 */
function renderZoneContext(zoneContext) {
  if (!zoneContext) return "";

  const distanceZones = zoneContext.distanceZones || [];
  const geoZones = zoneContext.geoZones || [];
  if (distanceZones.length === 0 && geoZones.length === 0) {
    return `\n\n## ZONE CONTEXT\nThis partner has NO zones configured. Do not emit any MATRIX config — say so in "warnings" instead.`;
  }

  const lines = ["\n\n## ZONE CONTEXT — the only zone ids you may use"];

  if (distanceZones.length > 0) {
    lines.push("DISTANCE zones (use mode MILESTONE + zoneMilestoneId):");
    for (const zone of distanceZones) {
      lines.push(`- zone "${zone.name}" (${zone.id})`);
      for (const milestone of zone.milestones || []) {
        lines.push(
          `    milestone ${milestone.suffix}: ${milestone.minKm}-${milestone.maxKm} km → zoneMilestoneId ${milestone.id}`,
        );
      }
    }
  }

  if (geoZones.length > 0) {
    lines.push("GEOLOGICAL zones (use mode ZONE_PAIR + fromZoneId/toZoneId):");
    for (const zone of geoZones) {
      lines.push(`- "${zone.name}" → ${zone.id}`);
    }
  }

  return lines.join("\n");
}

function draftFromTextMessages({
  description,
  existingDefinitions,
  partnerId,
  zoneContext,
}) {
  return [
    {
      role: "system",
      content: `${CONTRACT}

The admin will describe a charge in natural language. Respond with JSON:
{
  "understanding": "one-sentence restatement of what the admin wants",
  "definitions": [ ChargeDefinition, ... ],   // ONLY definitions that do not already exist (see existing codes); [] if reusing existing ones
  "configs": [ { "chargeDefinitionCode": "...", "partnerId": ${JSON.stringify(partnerId || null)}, "config": {...}, "conditions": null|{...} } ],
  "warnings": [ "anything ambiguous or assumed" ]
}
Existing definition codes (reuse instead of duplicating): ${existingDefinitions.join(", ")}${renderZoneContext(zoneContext)}`,
    },
    { role: "user", content: description },
  ];
}

function importLegacyMessages({ legacyRules, existingDefinitions }) {
  return [
    {
      role: "system",
      content: `${CONTRACT}

You are migrating LEGACY charge rules (old engine) to the new config format. Legacy semantics:
- base INVOICE_VALUE: max(minValue, percentageValue% x invoiceValue) → PERCENT_WITH_MIN basis INVOICE_VALUE
- base COD_VALUE: same but on codAmount → use existing COD_CHARGE definition (PERCENT_WITH_MIN basis COD_AMOUNT)
- base WEIGHT: max(minValue, ceil(weight/perKg) x perKgCharge) → PER_UNIT or MATRIX-free weight add-on
- base ZONE_TO_ZONE_WEIGHT (fromZoneId/toZoneId) → BASE_FREIGHT MATRIX mode ZONE_PAIR row
- base DISTANCE_BASE_WEIGHT (zoneMilestoneId) → BASE_FREIGHT MATRIX mode MILESTONE row
- chargesType names hint the semantic (COD, FRAGILE, FREIGHT...); pincodeType-linked rules → perSide charges gated on side.pincodeType.<NAME>
Group all ZONE_PAIR/MILESTONE rows of one partner into ONE BASE_FREIGHT config. Preserve the UUIDs (zoneMilestoneId/fromZoneId/toZoneId) exactly.

Respond with JSON: { "definitions": [...], "configs": [ { "chargeDefinitionCode", "partnerId", "config", "conditions" } ], "warnings": [...] }
Existing definition codes (reuse instead of duplicating): ${existingDefinitions.join(", ")}`,
    },
    {
      role: "user",
      content: `Migrate these legacy rules:\n${JSON.stringify(legacyRules, null, 1)}`,
    },
  ];
}

function explainQuoteMessages({ breakdown, pricing, context }) {
  return [
    {
      role: "system",
      content:
        'You explain shipping-charge breakdowns to logistics customers in plain, friendly language. Be concise (under 150 words), use ₹ amounts from the data, never invent numbers, and end with the total. Respond with JSON: { "explanation": "...", "highlights": ["..."] }',
    },
    {
      role: "user",
      content: `Explain this quote:\nbreakdown: ${JSON.stringify(breakdown)}\npricing: ${JSON.stringify(pricing)}\nshipment: ${JSON.stringify(context)}`,
    },
  ];
}

function codRiskMessages({ shipment }) {
  return [
    {
      role: "system",
      content:
        'You assess Cash-on-Delivery delivery risk for Indian e-commerce shipments. Consider COD amount vs invoice value, destination tier, weight plausibility, and address completeness. Respond with JSON: { "riskScore": 0-100, "band": "LOW|MEDIUM|HIGH", "reasons": ["..."], "recommendation": "..." }',
    },
    { role: "user", content: JSON.stringify(shipment) },
  ];
}

function anomalyMessages({ configs, sampleQuotes }) {
  return [
    {
      role: "system",
      content:
        'You audit shipping-charge configurations for anomalies: missing GST/fuel configs, percentages over 30%, zero/negative amounts, overlapping slabs, unconditional charges that look conditional (e.g. COD without a paymentType condition), and quotes wildly out of line with config expectations. Respond with JSON: { "findings": [ { "severity": "LOW|MEDIUM|HIGH", "chargeCode": "...", "partnerId": "...", "issue": "...", "suggestion": "..." } ] }',
    },
    {
      role: "user",
      content: `Configs: ${JSON.stringify(configs)}\nRecent sample quotes: ${JSON.stringify(sampleQuotes)}`,
    },
  ];
}

module.exports = {
  PROMPT_VERSION,
  draftFromTextMessages,
  importLegacyMessages,
  explainQuoteMessages,
  codRiskMessages,
  anomalyMessages,
};
