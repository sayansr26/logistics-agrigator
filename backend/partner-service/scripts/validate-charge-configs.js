/**
 * Charge config health check (Charges Engine v3).
 *
 * Read-only. Sweeps every ACTIVE PartnerChargeConfig and reports the ones whose
 * stored JSON cannot price:
 *
 *   - per-method problems  (services/chargeConfigMethods.js)
 *   - dangling references  (zone / milestone / pincodeType / channel ids)
 *
 * Why it exists: `computation.paramsSchema` documents the shape a config must
 * satisfy, but nothing enforced it — Joi types `config` as an unknown object and
 * only MATRIX had structural checks. Every other method could save a nonsense
 * config as Active and price to null on every shipment, which looks exactly like
 * a charge that was never configured.
 *
 * Run this BEFORE turning on write-time enforcement, so you see what the new
 * rules would reject while it is still only a report.
 *
 * Usage (inside the partner-service container, where env vars exist):
 *   node backend/partner-service/scripts/validate-charge-configs.js
 *
 * Exit code 1 when anything is invalid, so it can gate a deploy.
 */

const {
  validateAllConfigs,
} = require("../services/partnerChargeConfigService");
const { prisma } = require("../config/database");

async function main() {
  console.log("Charge config health check — read-only\n");

  const { checked, invalid, findings } = await validateAllConfigs();

  for (const f of findings) {
    console.log(
      `  INVALID  ${f.chargeCode}  (${f.configId.slice(0, 8)}…, partner ${f.partnerId})`,
    );
    for (const problem of f.problems) console.log(`    - ${problem}`);
  }

  if (invalid === 0) {
    console.log("  All active configs can price.\n");
  } else {
    console.log("");
  }

  console.log(`Done. ${checked} active config(s) checked, ${invalid} invalid.`);
  if (invalid > 0) {
    console.log(
      "These would be REJECTED once write-time enforcement is enabled. Fix them in the\n" +
        "Charge Configs UI first — the write path there validates, versions and audits.",
    );
  }

  process.exitCode = invalid > 0 ? 1 : 0;
}

main()
  .catch((error) => {
    console.error("Health check failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
