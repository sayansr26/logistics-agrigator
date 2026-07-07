/**
 * Settlement Scheduler
 *
 * Lightweight interval worker that periodically runs the auto-settlement routine
 * (settlementRuleService.runAutoSettlement) so configured settlement cycles
 * (DAILY / WEEKLY / T+1 / T+2) and auto wallet/bank payouts happen without manual
 * action.
 *
 * Env:
 *  - AUTO_SETTLEMENT_ENABLED = "true" to enable (default off)
 *  - AUTO_SETTLEMENT_INTERVAL_MIN = interval in minutes (default 60)
 *
 * Deliberately simple (setInterval) — no external job-queue dependency. Runs are
 * non-overlapping (guarded by an in-flight flag) and best-effort.
 */

const logger = require("../shared/lib/logger");
const settlementRuleService = require("./settlementRuleService");

let timer = null;
let running = false;

async function tick() {
  if (running) {
    logger.debug("Auto-settlement tick skipped — previous run still in progress");
    return;
  }
  running = true;
  try {
    const summary = await settlementRuleService.runAutoSettlement({});
    logger.info("Auto-settlement scheduler tick complete", summary);
  } catch (e) {
    logger.error("Auto-settlement scheduler tick failed", { error: e.message });
  } finally {
    running = false;
  }
}

function start() {
  if (process.env.AUTO_SETTLEMENT_ENABLED !== "true") {
    logger.info("Auto-settlement scheduler disabled (set AUTO_SETTLEMENT_ENABLED=true to enable)");
    return;
  }
  const minutes = Math.max(1, parseInt(process.env.AUTO_SETTLEMENT_INTERVAL_MIN || "60", 10));
  const ms = minutes * 60 * 1000;
  logger.info(`Auto-settlement scheduler starting (every ${minutes} min)`);
  // Fire once shortly after boot, then on the interval
  timer = setInterval(tick, ms);
  if (timer.unref) timer.unref(); // don't keep the process alive solely for this
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { start, stop, tick };
