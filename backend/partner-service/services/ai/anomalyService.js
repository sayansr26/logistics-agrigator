/**
 * AI Config Anomaly Scan (Charges Engine v3)
 *
 * Admin-triggered audit of the active charge configuration (plus a handful of
 * live sample quotes when available). Findings are stored as
 * AiChargeSuggestion(kind ANOMALY, status PENDING) for the admin inbox.
 */

const { prisma } = require("../../config/database");
const aiClient = require("../../shared/lib/aiClient");
const logger = require("../../shared/lib/logger");
const prompts = require("./prompts/chargeConfigPrompts");

async function runAnomalyScan({ partnerId, userId } = {}) {
  const MAX_CONFIGS = 150;
  const rows = await prisma.partnerChargeConfig.findMany({
    where: { isActive: true, ...(partnerId && { partnerId }) },
    select: {
      id: true,
      partnerId: true,
      config: true,
      conditions: true,
      chargeDefinition: {
        select: {
          code: true,
          category: true,
          applyStage: true,
          phase: true,
          computation: true,
          conditions: true,
          flags: true,
        },
      },
    },
    take: MAX_CONFIGS + 1,
  });

  if (rows.length === 0) {
    return { findings: [], scannedConfigs: 0, suggestionId: null };
  }

  const truncated = rows.length > MAX_CONFIGS;
  if (truncated) {
    logger.warn(
      "Anomaly scan truncated to first configs — narrow by partnerId",
      {
        cap: MAX_CONFIGS,
      },
    );
  }

  // Compact projection: prompt size directly drives generation latency, and
  // paramsSchema is contract documentation the auditor doesn't need.
  const configs = rows.slice(0, MAX_CONFIGS).map((row) => ({
    partnerId: row.partnerId,
    code: row.chargeDefinition.code,
    category: row.chargeDefinition.category,
    stage: row.chargeDefinition.applyStage,
    phase: row.chargeDefinition.phase,
    method: row.chargeDefinition.computation?.method,
    basis: row.chargeDefinition.computation?.basis,
    flags: row.chargeDefinition.flags || undefined,
    config: row.config,
    conditions: row.conditions || row.chargeDefinition.conditions || undefined,
  }));

  // Long-form generation: a findings list over 100+ configs can stream for
  // well over the default timeout — give it room instead of aborting mid-body.
  const { json, model } = await aiClient.completeJson(
    prompts.anomalyMessages({ configs, sampleQuotes: [] }),
    { maxTokens: 2000, timeoutMs: 90000 },
  );

  const findings = Array.isArray(json.findings) ? json.findings : [];

  let suggestionId = null;
  if (findings.length > 0) {
    const record = await prisma.aiChargeSuggestion.create({
      data: {
        kind: "ANOMALY",
        status: "PENDING",
        inputContext: {
          partnerId: partnerId || null,
          scannedConfigs: configs.length,
          promptVersion: prompts.PROMPT_VERSION,
        },
        suggestion: { findings },
        modelUsed: model,
        createdById: userId || null,
      },
    });
    suggestionId = record.id;
  }

  logger.info("AI anomaly scan completed", {
    scannedConfigs: configs.length,
    findings: findings.length,
    suggestionId,
  });

  return { findings, scannedConfigs: configs.length, suggestionId };
}

module.exports = { runAnomalyScan };
