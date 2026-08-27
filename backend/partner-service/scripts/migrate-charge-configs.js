/**
 * Charge config audit / migration (Charges Engine v3).
 *
 * Joins each PartnerChargeConfig back to the AiChargeSuggestion that produced
 * it, re-reads the admin's original rate-card text out of
 * AiChargeSuggestion.inputContext.description, and replays the worked examples
 * written in that text through the REAL pricing engine. Reports three buckets:
 *
 *   MISPRICED   an example in the source text does not reproduce
 *   OK          every example reproduces
 *   UNVERIFIED  no source text, or the text stated no examples and no minimums
 *
 * The join is fuzzy and says so. Content equality does the real work; createdAt
 * is only a tiebreaker. A config created by hand has no suggestion at all and
 * lands in UNVERIFIED by construction — that is the honest answer, not a
 * failure of the script.
 *
 * --apply is gated on HIGH confidence (an exact content match to exactly one
 * suggestion). Writing on a LOW/NONE match means writing on a guess, applied to
 * live pricing.
 *
 * Usage (inside the partner-service container, where env vars exist):
 *   node backend/partner-service/scripts/migrate-charge-configs.js
 *   node backend/partner-service/scripts/migrate-charge-configs.js --partner=<id>
 *   node backend/partner-service/scripts/migrate-charge-configs.js --apply
 */

const { PrismaClient } = require("@prisma/client");
const { replayExamples } = require("../services/ai/rateCard/replay");

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");

function argValue(flag) {
  const inline = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (inline) return inline.slice(flag.length + 1);
  const at = process.argv.indexOf(flag);
  return at !== -1 ? process.argv[at + 1] : null;
}

const PARTNER = argValue("--partner");

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

async function loadConfigs(partnerId) {
  return prisma.partnerChargeConfig.findMany({
    where: { ...(partnerId ? { partnerId } : {}) },
    include: {
      chargeDefinition: true,
      channel: { select: { id: true, channelName: true } },
      partner: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

async function loadSuggestions() {
  return prisma.aiChargeSuggestion.findMany({ orderBy: { createdAt: "asc" } });
}

async function loadMilestones(partnerId) {
  const zones = await prisma.zone.findMany({
    where: { partnerId, zoneType: "DISTANCE", status: true },
    include: { milestones: { orderBy: { sortOrder: "asc" } } },
  });
  return zones.flatMap((z) => z.milestones);
}

// ---------------------------------------------------------------------------
// The join
// ---------------------------------------------------------------------------

/** Order-insensitive canonical form, so two equal configs compare equal. */
function canonical(value) {
  if (Array.isArray(value)) {
    return value.map(canonical).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((out, k) => {
        out[k] = canonical(value[k]);
        return out;
      }, {});
  }
  if (typeof value === "number") return Number(value.toFixed(4));
  return value;
}

const sameConfig = (a, b) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

function indexSuggestions(suggestions) {
  const index = new Map();
  for (const s of suggestions) {
    const partnerId = s.inputContext?.partnerId;
    for (const cfg of s.suggestion?.configs || []) {
      if (!cfg?.chargeDefinitionCode) continue;
      const key = `${partnerId}|${cfg.chargeDefinitionCode}`;
      if (!index.has(key)) index.set(key, []);
      index.get(key).push({ suggestion: s, draftConfig: cfg });
    }
  }
  return index;
}

/**
 * Confidence ladder. REJECTED suggestions are dropped outright: the admin
 * explicitly disowned those drafts, so matching a config to one would be
 * actively misleading.
 */
function matchSuggestion(config, index) {
  const key = `${config.partnerId}|${config.chargeDefinition.code}`;
  const candidates = (index.get(key) || [])
    .filter((c) => c.suggestion.status !== "REJECTED")
    .filter((c) => c.suggestion.createdAt <= config.updatedAt)
    .sort((a, b) => b.suggestion.createdAt - a.suggestion.createdAt);

  if (candidates.length === 0) {
    return { chosen: null, confidence: "NONE", candidates: 0 };
  }

  const exact = candidates.filter((c) =>
    sameConfig(c.draftConfig.config, config.config),
  );

  if (exact.length === 1) {
    return {
      chosen: exact[0],
      confidence: candidates.length === 1 ? "HIGH" : "MEDIUM",
      candidates: candidates.length,
    };
  }

  return {
    chosen: candidates[0],
    confidence: "LOW",
    candidates: candidates.length,
    contentMismatch: true,
  };
}

// ---------------------------------------------------------------------------
// Parsing the admin's own text
// ---------------------------------------------------------------------------

const num = (s) => Number(String(s).replace(/,/g, ""));

/**
 * Deliberately narrow: only surface forms with no ambiguity. Everything else
 * is reported as a finding, never asserted as a fact.
 */
function parseRateCard(text) {
  const src = String(text || "");

  const minFreights = [
    ...src.matchAll(
      /min(?:imum)?\.?\s*(?:freight|charge)?[^0-9₹]{0,20}(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)/gi,
    ),
  ].map((m) => num(m[1]));

  const perKgRates = [
    ...src.matchAll(
      /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)\s*(?:\/|per\s*)\s*([\d.]*)\s*kg/gi,
    ),
  ].map((m) => num(m[1]));

  const billingUnitMatch = src.match(
    /billing\s*unit[^0-9]{0,20}([\d.]+)\s*kg/i,
  );

  // The freight line reads "Freight = 2 x Rs 26 = Rs 52": the answer is the
  // LAST amount on it, not the first (which is the per-unit rate).
  const workedExamples = [
    ...src.matchAll(
      /distance:\s*([\d.]+)\s*km[\s\S]{0,80}?weight:\s*([\d.]+)\s*kg[\s\S]{0,160}?(?:freight|charges?)\s*=([^\n]*)/gi,
    ),
  ]
    .map((m) => {
      const amounts = [
        ...m[3].matchAll(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)/gi),
      ].map((a) => num(a[1]));
      if (amounts.length === 0) return null;
      return {
        distanceKm: num(m[1]),
        weightKg: num(m[2]),
        expectedFreight: amounts[amounts.length - 1],
      };
    })
    .filter(Boolean);

  return {
    minFreights,
    perKgRates,
    billingUnit: billingUnitMatch ? num(billingUnitMatch[1]) : null,
    workedExamples,
    statesMinimums: minFreights.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

function classify(config, match, milestones) {
  const findings = [];

  if (!match.chosen) {
    return {
      verdict: "UNVERIFIED",
      findings: ["no stored prompt produced this config (created manually?)"],
      parsed: null,
      replay: null,
    };
  }

  const text = match.chosen.suggestion.inputContext?.description;
  const parsed = parseRateCard(text);

  if (match.contentMismatch) {
    findings.push(
      "the stored draft's config does not match the live rows — provenance is a guess",
    );
  }

  const isMatrix = config.chargeDefinition.computation?.method === "MATRIX";
  let replay = null;

  if (isMatrix && parsed.workedExamples.length > 0) {
    replay = replayExamples({
      definition: config.chargeDefinition,
      config: { config: config.config, conditions: config.conditions },
      milestones,
      examples: parsed.workedExamples,
    });
    for (const r of replay.results.filter((x) => !x.pass)) {
      findings.push(
        `worked example "${r.distanceKm} km, ${r.weightKg} kg -> Rs ${r.expectedFreight}": config computes ${r.actualFreight === null ? `nothing (${r.reason})` : `Rs ${r.actualFreight}`}`,
      );

      // Distinguish "the config is wrong" from "the example is wrong". The
      // engine renders max(minCharge, ceil(w/perKg) x charge); when the
      // minimum is what won and the example sits below it, the example ignored
      // a minimum the same rate card states — worth saying, because the fix is
      // then to the card, not to the config.
      const bound = /max\(([\d.]+),/.exec(r.calculation || "");
      const minCharge = bound ? Number(bound[1]) : null;
      if (
        minCharge !== null &&
        r.actualFreight === minCharge &&
        r.expectedFreight < minCharge
      ) {
        findings.push(
          `  ^ the Rs ${minCharge} minimum freight for milestone ${r.milestone?.suffix ?? "?"} is what binds; the worked example ignores the minimum its own rate card states`,
        );
      }
    }
  }

  if (isMatrix && parsed.statesMinimums) {
    for (const row of config.config?.rows || []) {
      const min = Number(row.minCharge);
      if (min > 0 && !parsed.minFreights.includes(min)) {
        findings.push(
          `config minCharge ${min} appears nowhere in the rate-card text, which does state minimums`,
        );
      }
    }
  }

  if (replay && replay.failed > 0)
    return { verdict: "MISPRICED", findings, parsed, replay };
  if (findings.some((f) => f.startsWith("config minCharge"))) {
    return { verdict: "MISPRICED", findings, parsed, replay };
  }
  if (replay && replay.allPassed)
    return { verdict: "OK", findings, parsed, replay };

  findings.push(
    "the source text yielded no replayable worked examples — cannot verify",
  );
  return { verdict: "UNVERIFIED", findings, parsed, replay };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function printRow(config, match, outcome) {
  const channel = config.channel
    ? `"${config.channel.channelName}"`
    : "partner-wide";
  console.log(
    `  ${outcome.verdict.padEnd(10)} ${config.partner?.name || config.partnerId} / ${config.chargeDefinition.code}  (${config.id.slice(0, 8)}…, channel: ${channel}, v${config.version})`,
  );

  if (match.chosen) {
    console.log(
      `    source: suggestion ${match.chosen.suggestion.id.slice(0, 8)}… (${match.chosen.suggestion.status}, ${match.confidence} confidence, ${match.candidates} candidate${match.candidates === 1 ? "" : "s"})`,
    );
  } else {
    console.log("    source: none — no stored prompt mentions this definition");
  }

  for (const finding of outcome.findings) console.log(`    - ${finding}`);
}

// ---------------------------------------------------------------------------

async function main() {
  console.log(
    `Charge config audit — ${APPLY ? "APPLY" : "DRY RUN (read-only)"}`,
  );

  const [configs, suggestions] = await Promise.all([
    loadConfigs(PARTNER),
    loadSuggestions(),
  ]);
  console.log(
    `Scope: ${PARTNER || "all partners"}  |  ${configs.length} config(s), ${suggestions.length} suggestion(s)\n`,
  );

  const index = indexSuggestions(suggestions);
  const milestonesByPartner = new Map();
  const counts = { MISPRICED: 0, OK: 0, UNVERIFIED: 0 };
  let written = 0;
  let skipped = 0;

  for (const config of configs) {
    if (!milestonesByPartner.has(config.partnerId)) {
      milestonesByPartner.set(
        config.partnerId,
        await loadMilestones(config.partnerId),
      );
    }

    const match = matchSuggestion(config, index);
    const outcome = classify(
      config,
      match,
      milestonesByPartner.get(config.partnerId),
    );
    counts[outcome.verdict] += 1;
    printRow(config, match, outcome);

    if (outcome.verdict !== "MISPRICED") continue;

    // Writing on anything below HIGH means writing on a guess, applied to live
    // pricing. Report it and leave it alone.
    if (match.confidence !== "HIGH") {
      console.log(
        `    NOT WRITABLE: provenance is ${match.confidence} confidence — fix this in the Charge Configs UI, where the write is validated, versioned, audited and cache-invalidated.`,
      );
      skipped += 1;
      continue;
    }

    if (!APPLY) {
      console.log("    would rewrite from the source rate card (--apply)");
      continue;
    }

    try {
      await prisma.$transaction([
        prisma.partnerChargeConfig.update({
          where: { id: config.id },
          data: {
            config: match.chosen.draftConfig.config,
            version: { increment: 1 },
          },
        }),
        prisma.auditLog.create({
          data: {
            action: "UPDATE_PARTNER_CHARGE_CONFIG",
            resourceType: "PARTNER_CHARGE_CONFIG",
            resourceId: config.id,
            userId: null,
            ipAddress: null,
            userAgent: "scripts/migrate-charge-configs.js",
            requestData: {
              reason:
                "migrate-charge-configs: re-encode from the source rate card",
              sourceSuggestionId: match.chosen.suggestion.id,
              before: config.config,
            },
            responseData: { after: match.chosen.draftConfig.config },
          },
        }),
      ]);
      written += 1;
      console.log("    REWRITTEN");
    } catch (error) {
      console.log(`    FAILED: ${error.message}`);
    }
  }

  console.log(
    `\nDone. ${counts.MISPRICED} mispriced, ${counts.OK} ok, ${counts.UNVERIFIED} unverified.`,
  );
  if (skipped > 0) {
    console.log(`${skipped} mispriced config(s) left alone (low provenance).`);
  }
  if (APPLY) {
    console.log(`${written} config(s) rewritten.`);
  } else {
    console.log(
      "Read-only — re-run with --apply to write HIGH-confidence rows.",
    );
  }

  process.exitCode = counts.MISPRICED > 0 ? 1 : 0;
}

main()
  .catch((error) => {
    console.error("Audit failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
