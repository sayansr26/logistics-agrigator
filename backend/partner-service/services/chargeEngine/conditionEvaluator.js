/**
 * Charges Engine v3 — condition evaluator
 *
 * Evaluates a conditions JSON ({all: [...]} / {any: [...]} of
 * {fact, op, value}) against a facts object. Facts are addressed by dot-path
 * (e.g. "answers.loading.enabled", "delivery.pincodeType.ODA").
 *
 * An unknown fact makes that single condition false (with a debug log) — the
 * evaluator never throws, so a mis-configured condition can only suppress a
 * charge, never break a quote.
 */

const logger = require("../../shared/lib/logger");

/**
 * Resolve a dot-path against the facts object. Returns undefined when any
 * segment is missing.
 */
function getFact(facts, path) {
  if (!path || typeof path !== "string") return undefined;
  let current = facts;
  for (const segment of path.split(".")) {
    if (current === null || current === undefined) return undefined;
    current = current[segment];
  }
  return current;
}

function compare(op, factValue, condValue) {
  switch (op) {
    case "eq":
      return factValue === condValue;
    case "ne":
      return factValue !== condValue;
    case "gt":
      return Number(factValue) > Number(condValue);
    case "gte":
      return Number(factValue) >= Number(condValue);
    case "lt":
      return Number(factValue) < Number(condValue);
    case "lte":
      return Number(factValue) <= Number(condValue);
    case "in":
      return Array.isArray(condValue) && condValue.includes(factValue);
    case "nin":
      return Array.isArray(condValue) && !condValue.includes(factValue);
    case "exists":
      return factValue !== undefined && factValue !== null;
    case "truthy":
      return !!factValue;
    default:
      logger.debug("Unknown condition operator", { op });
      return false;
  }
}

function evaluateSingle(condition, facts) {
  const { fact, op = "eq", value } = condition || {};
  if (!fact) return false;

  const factValue = getFact(facts, fact);

  // exists/truthy are meaningful on undefined facts; every other operator
  // treats a missing fact as non-matching
  if (factValue === undefined && op !== "exists" && op !== "truthy") {
    logger.debug("Condition fact not present in context", { fact, op });
    return false;
  }

  return compare(op, factValue, value);
}

/**
 * Evaluate a conditions object against facts.
 * null/undefined conditions → true (unconditional charge).
 */
function evaluate(conditions, facts) {
  if (!conditions) return true;

  try {
    const { all, any } = conditions;
    if (Array.isArray(all) && all.length > 0) {
      if (!all.every((c) => evaluateSingle(c, facts))) return false;
    }
    if (Array.isArray(any) && any.length > 0) {
      if (!any.some((c) => evaluateSingle(c, facts))) return false;
    }
    return true;
  } catch (error) {
    logger.warn("Condition evaluation failed; treating as non-matching", {
      error: error.message,
    });
    return false;
  }
}

module.exports = { evaluate, getFact };
