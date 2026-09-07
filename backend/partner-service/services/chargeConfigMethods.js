/**
 * Per-method PartnerChargeConfig validation (Charges Engine v3).
 *
 * `ChargeDefinition.computation.paramsSchema` documents the shape a config must
 * satisfy, but nothing enforced it: Joi types `config` as
 * `Joi.object().unknown(true)`, and only MATRIX had structural checks
 * (findMatrixProblems). Every other method could therefore save a nonsense
 * config as Active and price to `null` on every shipment — a charge that
 * silently never applies, which is indistinguishable from one that is merely
 * not configured.
 *
 * Each validator below mirrors the corresponding calculator in
 * chargeEngine/calculators.js, so a config that passes here cannot return null
 * for a *configuration* reason. It may still legitimately return null for a
 * *shipment* reason — no option selected, no outlet badge, a weight outside
 * every slab — and that is not a config error.
 */

const { findMatrixProblems } = require("./chargeConfigShared");

const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);
const isPositive = (v) => isFiniteNumber(v) && v > 0;
const isNonNegative = (v) => isFiniteNumber(v) && v >= 0;

/** Optional field: absent/null is fine, present must satisfy `check`. */
function optional(value, check) {
  return value === undefined || value === null || check(value);
}

const SUBTOTAL_OF = ["FUEL_APPLICABLE", "FREIGHT", "PRE_TAX", "TAXABLE"];

const validators = {
  FLAT(computation, config, problems) {
    // calculators.FLAT returns null on a non-finite amount.
    if (!isFiniteNumber(config.amount)) {
      problems.push('FLAT needs "amount" as a number');
    } else if (config.amount <= 0) {
      problems.push(
        'FLAT "amount" must be greater than zero, or the charge never applies',
      );
    }
  },

  PERCENT_WITH_MIN(computation, config, problems) {
    // With optionsBy the config is keyed per answer value instead.
    if (computation.optionsBy) {
      const keys = Object.keys(config || {});
      if (keys.length === 0) {
        problems.push(
          `PERCENT_WITH_MIN with optionsBy "${computation.optionsBy}" needs one entry per option value`,
        );
        return;
      }
      for (const key of keys) {
        const branch = config[key];
        if (!branch || typeof branch !== "object") {
          problems.push(
            `option "${key}" must be an object with percent and minAmount`,
          );
          continue;
        }
        validators.PERCENT_WITH_MIN({}, branch, problems);
      }
      return;
    }

    if (!isNonNegative(config.percent)) {
      problems.push(
        'PERCENT_WITH_MIN needs "percent" as a number of zero or more',
      );
    }
    if (!optional(config.minAmount, isNonNegative)) {
      problems.push('PERCENT_WITH_MIN "minAmount" must be zero or more');
    }
    // max(minAmount, percent x basis) <= 0 for every shipment.
    if (!config.percent && !config.minAmount) {
      problems.push(
        "PERCENT_WITH_MIN with neither a percent nor a minimum can never produce a charge",
      );
    }
  },

  PER_UNIT(computation, config, problems) {
    if (!isPositive(config.perUnit)) {
      problems.push('PER_UNIT needs "perUnit" as a positive number');
    }
    if (!optional(config.unitSize, isPositive)) {
      problems.push(
        'PER_UNIT "unitSize" must be a positive number (it divides the basis)',
      );
    }
    if (!optional(config.minAmount, isNonNegative)) {
      problems.push('PER_UNIT "minAmount" must be zero or more');
    }
  },

  SLAB(computation, config, problems) {
    const slabs = config.slabs;
    if (!Array.isArray(slabs) || slabs.length === 0) {
      problems.push('SLAB needs a non-empty "slabs" array');
      return;
    }

    const seen = new Set();
    slabs.forEach((slab, i) => {
      const at = `slab ${i + 1}`;
      if (!slab || typeof slab !== "object") {
        problems.push(`${at}: must be an object with upTo and amount`);
        return;
      }
      if (!isPositive(slab.upTo)) {
        problems.push(`${at}: "upTo" must be a positive number`);
      } else if (seen.has(slab.upTo)) {
        problems.push(`${at}: duplicate "upTo" ${slab.upTo}`);
      } else {
        seen.add(slab.upTo);
      }
      if (!isNonNegative(slab.amount)) {
        problems.push(`${at}: "amount" must be zero or more`);
      }
    });

    if (!computation.answerPath && computation.basis === "ANSWER_VALUE") {
      problems.push("SLAB on ANSWER_VALUE needs computation.answerPath");
    }
  },

  MATRIX(computation, config, problems) {
    // Already covered in depth, and used by the manual API too.
    problems.push(...findMatrixProblems(computation, config));
  },

  PER_UNIT_TIME(computation, config, problems) {
    // The calculator branches on basis, so the required rate field differs.
    if (computation.basis === "CHARGEABLE_WEIGHT") {
      if (!isPositive(config.perKgPerDay)) {
        problems.push(
          'PER_UNIT_TIME on CHARGEABLE_WEIGHT needs "perKgPerDay" as a positive number',
        );
      }
    } else if (!isPositive(config.perUnit)) {
      problems.push('PER_UNIT_TIME needs "perUnit" as a positive number');
    }
    if (!optional(config.freeUnits, isNonNegative)) {
      problems.push('PER_UNIT_TIME "freeUnits" must be zero or more');
    }
    if (!optional(config.minAmount, isNonNegative)) {
      problems.push('PER_UNIT_TIME "minAmount" must be zero or more');
    }
  },

  RATE_ADJUSTMENT(computation, config, problems) {
    if (!isFiniteNumber(config.percent)) {
      problems.push('RATE_ADJUSTMENT needs "percent" as a number');
    }
    if (!optional(config.flatExtra, isNonNegative)) {
      problems.push('RATE_ADJUSTMENT "flatExtra" must be zero or more');
    }
    if (!config.percent && !config.flatExtra) {
      problems.push(
        "RATE_ADJUSTMENT with neither a percent nor a flat extra can never produce a charge",
      );
    }
    if (
      computation.subtotalOf &&
      !SUBTOTAL_OF.includes(computation.subtotalOf)
    ) {
      problems.push(
        `computation.subtotalOf "${computation.subtotalOf}" must be one of ${SUBTOTAL_OF.join(", ")}`,
      );
    }
  },

  OPTION_RATE(computation, config, problems) {
    if (!computation.answerPath) {
      problems.push(
        "OPTION_RATE needs computation.answerPath naming the booking question",
      );
    }
    const rates = config.rates;
    if (
      !rates ||
      typeof rates !== "object" ||
      Object.keys(rates).length === 0
    ) {
      problems.push(
        'OPTION_RATE needs a non-empty "rates" object keyed by option value',
      );
      return;
    }
    for (const [option, rate] of Object.entries(rates)) {
      // The calculator drops any rate that is not > 0, so a zero-rated option
      // is silently unpriced rather than free.
      if (!isPositive(rate)) {
        problems.push(
          `OPTION_RATE rate for "${option}" must be a positive number`,
        );
      }
    }
    if (!optional(config.perBox, (v) => typeof v === "boolean")) {
      problems.push('OPTION_RATE "perBox" must be true or false');
    }
  },

  DISCOUNT(computation, config, problems) {
    const tiers = config.tiers;
    if (
      !tiers ||
      typeof tiers !== "object" ||
      Object.keys(tiers).length === 0
    ) {
      problems.push(
        'DISCOUNT needs a non-empty "tiers" object keyed by outlet badge',
      );
      return;
    }
    for (const [badge, tier] of Object.entries(tiers)) {
      if (!tier || typeof tier !== "object") {
        problems.push(
          `DISCOUNT tier "${badge}" must be an object with type and value`,
        );
        continue;
      }
      if (!["PERCENTAGE", "FLAT"].includes(tier.type)) {
        problems.push(
          `DISCOUNT tier "${badge}": type must be PERCENTAGE or FLAT`,
        );
      }
      if (!isPositive(tier.value)) {
        problems.push(
          `DISCOUNT tier "${badge}": value must be a positive number`,
        );
      }
    }
  },
};

/**
 * Validate a config against its definition's computation method.
 *
 * @param {object} computation - ChargeDefinition.computation
 * @param {object} configJson  - PartnerChargeConfig.config
 * @returns {string[]} problems; empty means the config can price
 */
function validateConfigForMethod(computation, configJson) {
  const problems = [];
  const method = computation?.method;

  if (!method) return ["charge definition has no computation.method"];

  const validate = validators[method];
  // An unknown method is the definition's problem, not the config's, and
  // assertComputationShape already guards it on the definition write path.
  if (!validate) return problems;

  if (!configJson || typeof configJson !== "object") {
    return [`${method} config must be an object`];
  }

  validate(computation, configJson, problems);
  return problems;
}

module.exports = {
  validateConfigForMethod,
  SUPPORTED_METHODS: Object.keys(validators),
};
