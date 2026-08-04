/**
 * AI COD Delivery Risk Prediction (Charges Engine v3)
 *
 * Predicts the delivery risk of a COD shipment. Fails SOFT: when the AI is
 * unavailable, returns { band: "UNKNOWN" } — quoting/booking must proceed and
 * any COD_VERIFICATION charge falls back to its configured flat amount.
 */

const aiClient = require("../../shared/lib/aiClient");
const logger = require("../../shared/lib/logger");
const prompts = require("./prompts/chargeConfigPrompts");

async function predictCodRisk(shipment) {
  try {
    const { json, model } = await aiClient.completeJson(
      prompts.codRiskMessages({ shipment }),
      { maxTokens: 500, temperature: 0.1 },
    );

    const band = ["LOW", "MEDIUM", "HIGH"].includes(json.band)
      ? json.band
      : "UNKNOWN";

    return {
      riskScore: Number(json.riskScore) || null,
      band,
      reasons: Array.isArray(json.reasons) ? json.reasons : [],
      recommendation: json.recommendation || null,
      model,
    };
  } catch (error) {
    logger.warn("COD risk prediction unavailable, degrading gracefully", {
      error: error.message,
    });
    return {
      riskScore: null,
      band: "UNKNOWN",
      reasons: [],
      recommendation: null,
      degraded: true,
    };
  }
}

module.exports = { predictCodRisk };
