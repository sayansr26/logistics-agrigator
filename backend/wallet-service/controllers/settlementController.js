/**
 * Settlement Controller
 *
 * HTTP surface for settlement generation, adjustments and the approval workflow.
 */

const settlementService = require("../services/settlementService");
const settlementRuleService = require("../services/settlementRuleService");
const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");

function uid(req) {
  return req.user?.id || req.user?.userId;
}
function fail(res, error, msg) {
  logger.error(msg, { error: error.message });
  const status = /not found/i.test(error.message)
    ? 404
    : /cannot|required|no eligible|must be/i.test(error.message)
      ? 409
      : 400;
  return res.status(status).json(APIResponse.error(error.message, "SETTLEMENT_ERROR", null, status));
}

async function generateSettlement(req, res) {
  try {
    const settlement = await settlementService.generateSettlement({
      ...req.body,
      createdBy: uid(req),
    });
    res.status(201).json(APIResponse.success(settlement, "Settlement generated"));
  } catch (e) {
    fail(res, e, "generateSettlement failed");
  }
}

async function listSettlements(req, res) {
  try {
    const result = await settlementService.listSettlements(req.query);
    res.json(APIResponse.paginated(result.items, result.pagination));
  } catch (e) {
    fail(res, e, "listSettlements failed");
  }
}

async function getSettlement(req, res) {
  try {
    const settlement = await settlementService.getSettlement(req.params.id);
    res.json(APIResponse.success(settlement));
  } catch (e) {
    fail(res, e, "getSettlement failed");
  }
}

async function addAdjustment(req, res) {
  try {
    const result = await settlementService.addAdjustment({
      settlementId: req.params.id,
      ...req.body,
      createdBy: uid(req),
    });
    res.status(201).json(APIResponse.success(result, "Adjustment added"));
  } catch (e) {
    fail(res, e, "addAdjustment failed");
  }
}

async function actOnSettlement(req, res) {
  try {
    const { action, ...opts } = req.body;
    const updated = await settlementService.transition(req.params.id, action, {
      ...opts,
      userId: uid(req),
    });
    res.json(APIResponse.success(updated, `Settlement ${action} applied`));
  } catch (e) {
    fail(res, e, "actOnSettlement failed");
  }
}

// ---- Settlement rules ----
async function listRules(req, res) {
  try {
    const rules = await settlementRuleService.listRules(req.query);
    res.json(APIResponse.success({ rules, total: rules.length }));
  } catch (e) {
    fail(res, e, "listRules failed");
  }
}

async function createRule(req, res) {
  try {
    const rule = await settlementRuleService.createRule(req.body, uid(req));
    res.status(201).json(APIResponse.success(rule, "Settlement rule created"));
  } catch (e) {
    fail(res, e, "createRule failed");
  }
}

async function updateRule(req, res) {
  try {
    const rule = await settlementRuleService.updateRule(req.params.id, req.body, uid(req));
    res.json(APIResponse.success(rule, "Settlement rule updated"));
  } catch (e) {
    fail(res, e, "updateRule failed");
  }
}

async function deleteRule(req, res) {
  try {
    await settlementRuleService.deleteRule(req.params.id, uid(req));
    res.json(APIResponse.success({ message: "Settlement rule deleted" }));
  } catch (e) {
    fail(res, e, "deleteRule failed");
  }
}

async function runAutoSettlement(req, res) {
  try {
    const summary = await settlementRuleService.runAutoSettlement({
      dryRun: req.body?.dryRun === true,
    });
    res.json(APIResponse.success(summary, "Auto-settlement run complete"));
  } catch (e) {
    fail(res, e, "runAutoSettlement failed");
  }
}

module.exports = {
  generateSettlement,
  listSettlements,
  getSettlement,
  addAdjustment,
  actOnSettlement,
  listRules,
  createRule,
  updateRule,
  deleteRule,
  runAutoSettlement,
};
