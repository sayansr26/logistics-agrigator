/**
 * AI Charge Controller (Charges Engine v3)
 *
 * HTTP layer for the DeepSeek-powered config brain, quote explanation,
 * COD-risk prediction, anomaly scan, and the suggestion review workflow.
 * Business logic lives in services/ai/*.
 */

const configBrainService = require("../services/ai/configBrainService");
const aiSuggestionService = require("../services/ai/aiSuggestionService");
const quoteExplainService = require("../services/ai/quoteExplainService");
const codRiskService = require("../services/ai/codRiskService");
const anomalyService = require("../services/ai/anomalyService");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");

function getReqContext(req) {
  return {
    userId: req.user?.userId || null,
    ip: req.ip || req.connection?.remoteAddress || null,
    userAgent: req.get?.("User-Agent") || null,
  };
}

async function draftFromText(req, res, next) {
  try {
    const { description, partnerId } = req.body;
    const result = await configBrainService.draftFromText({
      description,
      partnerId: partnerId || null,
      userId: req.user?.userId || null,
    });

    res.status(201).json(
      APIResponse.success(result, {
        message:
          "Draft configs generated — review and approve before they take effect",
      }),
    );
  } catch (error) {
    logger.error("Error drafting configs from text:", error);
    next(error);
  }
}

async function importLegacy(req, res, next) {
  try {
    const result = await configBrainService.importLegacy({
      legacyExport: req.body.legacyExport,
      userId: req.user?.userId || null,
    });

    res.status(201).json(
      APIResponse.success(result, {
        message:
          "Legacy rules converted to draft configs — review and approve before they take effect",
      }),
    );
  } catch (error) {
    logger.error("Error importing legacy rules:", error);
    next(error);
  }
}

async function listSuggestions(req, res, next) {
  try {
    const result = await aiSuggestionService.listSuggestions(req.query);
    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Error listing AI suggestions:", error);
    next(error);
  }
}

async function approveSuggestion(req, res, next) {
  try {
    const result = await aiSuggestionService.approveSuggestion(
      req.params.id,
      getReqContext(req),
    );
    res.json(APIResponse.success(result, { message: "Suggestion approved" }));
  } catch (error) {
    logger.error("Error approving AI suggestion:", error);
    next(error);
  }
}

async function rejectSuggestion(req, res, next) {
  try {
    const suggestion = await aiSuggestionService.rejectSuggestion(
      req.params.id,
      getReqContext(req),
    );
    res.json(
      APIResponse.success({ suggestion }, { message: "Suggestion rejected" }),
    );
  } catch (error) {
    logger.error("Error rejecting AI suggestion:", error);
    next(error);
  }
}

async function explainQuote(req, res, next) {
  try {
    const { breakdown, pricing, context } = req.body;
    const result = await quoteExplainService.explainQuote({
      breakdown,
      pricing,
      context,
    });
    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Error explaining quote:", error);
    next(error);
  }
}

async function codRisk(req, res, next) {
  try {
    const result = await codRiskService.predictCodRisk(req.body);
    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Error predicting COD risk:", error);
    next(error);
  }
}

async function anomalyScan(req, res, next) {
  try {
    const result = await anomalyService.runAnomalyScan({
      partnerId: req.body.partnerId || null,
      userId: req.user?.userId || null,
    });
    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Error running anomaly scan:", error);
    next(error);
  }
}

module.exports = {
  draftFromText,
  importLegacy,
  listSuggestions,
  approveSuggestion,
  rejectSuggestion,
  explainQuote,
  codRisk,
  anomalyScan,
};
