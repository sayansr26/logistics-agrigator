/**
 * Charges Engine v3 — pure calculators
 *
 * One function per computation.method. Each takes (computation, config, facts)
 * and returns { amount, calculation } or null when the config cannot produce a
 * charge in this context (e.g. no matching matrix row). No I/O, no side
 * effects — trivially unit-testable.
 *
 * `computation` comes from the ChargeDefinition (method/basis/answerPath/...),
 * `config` from the PartnerChargeConfig (the actual values).
 */

const { getFact } = require("./conditionEvaluator");

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Resolve the numeric basis value for a computation from facts.
 */
function resolveBasis(computation, facts) {
  switch (computation.basis) {
    case "COD_AMOUNT":
      return num(facts.codAmount);
    case "INVOICE_VALUE":
      return num(facts.invoiceValue);
    case "CHARGEABLE_WEIGHT":
      return num(facts.chargeableWeight);
    case "ANSWER_VALUE":
      return num(getFact(facts, `answers.${computation.answerPath}`), NaN);
    case "EVENT_UNITS":
      return num(facts.eventUnits, NaN);
    case "SUBTOTAL":
      // Injected by the pipeline for RATE_ADJUSTMENT/DISCOUNT
      return num(facts.__subtotal);
    case "NONE":
    default:
      return 0;
  }
}

/**
 * When computation.optionsBy is set, the partner config is keyed by the
 * selected option value (e.g. {OWNER: {...}, CARRIER: {...}}).
 */
function resolveOptionConfig(computation, config, facts) {
  if (!computation.optionsBy) return config;
  const selected = getFact(facts, `answers.${computation.optionsBy}`);
  if (selected === undefined || selected === null) return null;
  return config[selected] ?? null;
}

const calculators = {
  FLAT(computation, config) {
    const amount = num(config.amount, NaN);
    if (!Number.isFinite(amount)) return null;
    return { amount: round2(amount), calculation: `flat ${round2(amount)}` };
  },

  PERCENT_WITH_MIN(computation, config, facts) {
    const effective = resolveOptionConfig(computation, config, facts);
    if (!effective) return null;

    const basis = resolveBasis(computation, facts);
    const percent = num(effective.percent);
    const minAmount = num(effective.minAmount);
    const pctAmount = (basis * percent) / 100;
    const amount = Math.max(minAmount, pctAmount);
    if (amount <= 0) return null;

    return {
      amount: round2(amount),
      calculation: `max(${round2(minAmount)}, ${percent}% x ${round2(basis)})`,
    };
  },

  PER_UNIT(computation, config, facts) {
    const basis = resolveBasis(computation, facts);
    if (!Number.isFinite(basis)) return null;

    const unitSize = num(config.unitSize, 1) || 1;
    const perUnit = num(config.perUnit);
    const minAmount = num(config.minAmount);
    const units = Math.ceil(basis / unitSize);
    const amount = Math.max(minAmount, units * perUnit);
    if (amount <= 0) return null;

    return {
      amount: round2(amount),
      calculation: `max(${round2(minAmount)}, ceil(${round2(basis)}/${unitSize}) x ${perUnit})`,
    };
  },

  SLAB(computation, config, facts) {
    const value = resolveBasis(computation, facts);
    if (!Number.isFinite(value)) return null;

    const slabs = Array.isArray(config.slabs) ? [...config.slabs] : [];
    if (slabs.length === 0) return null;
    slabs.sort((a, b) => num(a.upTo) - num(b.upTo));

    const slab = slabs.find((s) => value <= num(s.upTo)) || null;
    if (!slab) return null;

    return {
      amount: round2(num(slab.amount)),
      calculation: `slab(value ${value} <= ${slab.upTo}) = ${round2(num(slab.amount))}`,
    };
  },

  MATRIX(computation, config, facts) {
    const weight = num(facts.chargeableWeight);
    const rows = Array.isArray(config.rows) ? config.rows : [];
    if (rows.length === 0) return null;

    const mode = config.mode || "MILESTONE";
    const matching = rows.filter((row) => {
      if (mode === "MILESTONE") {
        return (
          row.zoneMilestoneId &&
          row.zoneMilestoneId === facts.distanceMilestoneId
        );
      }
      if (mode === "ZONE_PAIR") {
        return (
          Array.isArray(facts.pickupGeoZoneIds) &&
          Array.isArray(facts.deliveryGeoZoneIds) &&
          facts.pickupGeoZoneIds.includes(row.fromZoneId) &&
          facts.deliveryGeoZoneIds.includes(row.toZoneId)
        );
      }
      return false;
    });

    if (matching.length === 0) return null;

    // Multiple matching rows: highest computed charge wins (G2 semantics)
    let best = null;
    for (const row of matching) {
      const slabSize = num(row.perKg, 1) || 1;
      const perSlabCharge = num(row.charge);
      const minCharge = num(row.minCharge);
      const amount = Math.max(
        minCharge,
        Math.ceil(weight / slabSize) * perSlabCharge,
      );
      if (!best || amount > best.amount) {
        best = {
          amount: round2(amount),
          calculation: `${mode.toLowerCase()}: max(${round2(minCharge)}, ceil(${round2(weight)}/${slabSize}) x ${perSlabCharge})`,
        };
      }
    }

    return best && best.amount > 0 ? best : null;
  },

  PER_UNIT_TIME(computation, config, facts) {
    const freeUnits = num(config.freeUnits);
    const units = num(facts.eventUnits, NaN);
    if (!Number.isFinite(units)) return null;

    const billableUnits = Math.max(0, units - freeUnits);
    const minAmount = num(config.minAmount);

    let raw;
    let calculation;
    if (computation.basis === "CHARGEABLE_WEIGHT") {
      const weight = num(facts.chargeableWeight);
      const perKgPerDay = num(config.perKgPerDay);
      raw = weight * perKgPerDay * billableUnits;
      calculation = `${round2(weight)}kg x ${perKgPerDay}/kg/unit x ${billableUnits} units (after ${freeUnits} free)`;
    } else {
      const perUnit = num(config.perUnit);
      raw = perUnit * billableUnits;
      calculation = `${perUnit}/unit x ${billableUnits} units (after ${freeUnits} free)`;
    }

    const amount = Math.max(minAmount, raw);
    if (amount <= 0) return null;
    return { amount: round2(amount), calculation };
  },

  RATE_ADJUSTMENT(computation, config, facts) {
    const subtotal = num(facts.__subtotal);
    const percent = num(config.percent);
    const flatExtra = num(config.flatExtra);
    const amount = (subtotal * percent) / 100 + flatExtra;
    if (amount <= 0) return null;

    return {
      amount: round2(amount),
      calculation: `${percent}% x ${round2(subtotal)}${flatExtra ? ` + ${flatExtra}` : ""}`,
    };
  },

  OPTION_RATE(computation, config, facts) {
    const selected = getFact(facts, `answers.${computation.answerPath}`);
    if (selected === undefined || selected === null) return null;

    const rate = num(config.rates?.[selected], NaN);
    if (!Number.isFinite(rate) || rate <= 0) return null;

    const boxes = config.perBox ? Math.max(1, num(facts.numberOfBoxes, 1)) : 1;
    const amount = rate * boxes;

    return {
      amount: round2(amount),
      calculation: `${selected}: ${rate}${config.perBox ? ` x ${boxes} boxes` : ""}`,
    };
  },

  DISCOUNT(computation, config, facts) {
    const badge = facts.outletBadge;
    if (!badge) return null;
    const tier = config.tiers?.[badge];
    if (!tier) return null;

    const subtotal = num(facts.__subtotal);
    let amount;
    let calculation;
    if (tier.type === "PERCENTAGE") {
      amount = (subtotal * num(tier.value)) / 100;
      calculation = `${badge}: ${num(tier.value)}% of ${round2(subtotal)}`;
    } else {
      amount = num(tier.value);
      calculation = `${badge}: flat ${round2(amount)}`;
    }

    // Never discount below zero
    amount = Math.min(amount, subtotal);
    if (amount <= 0) return null;

    // Emitted as a negative line by the pipeline
    return { amount: round2(-amount), calculation };
  },
};

/**
 * Run the calculator for a definition's computation with a partner config.
 * Returns { amount, calculation } or null.
 */
function compute(computation, config, facts) {
  const calculator = calculators[computation?.method];
  if (!calculator) return null;
  return calculator(computation, config || {}, facts);
}

module.exports = { compute, calculators, round2 };
