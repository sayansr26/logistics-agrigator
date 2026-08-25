/**
 * Top-up Reconciliation Worker
 *
 * Lightweight interval worker that periodically runs the reconciliation pass
 * (reconcileService.runPending) so a payment that was captured at the gateway
 * but never credited to the wallet — because a webhook failed post-record, the
 * external wallet was down, or a process died mid-credit — is retried without
 * anyone noticing it first.
 *
 * Env:
 *  - TOPUP_RECONCILE_ENABLED       = "true" to enable (default true in compose)
 *  - TOPUP_RECONCILE_INTERVAL_SEC  = interval in seconds (default 120)
 *  - TOPUP_RECONCILE_BATCH         = per-scan row budget (default 25)
 *  - TOPUP_RECONCILE_MAX_ATTEMPTS  = attempt ceiling (default 10, read by
 *                                    reconcileService)
 *
 * Deliberately simple (setInterval) — no external job-queue dependency, same
 * shape as `services/settlementScheduler.js`. Runs are non-overlapping, both
 * in-process (an in-flight flag) and across replicas (a Redis lock), and every
 * tick is best-effort: a tick may never throw out of the interval callback.
 */

const logger = require("../../shared/lib/logger");
const { getRedisClient } = require("../../config/redis");
const reconcileService = require("./reconcileService");

/** Cross-replica mutex key. */
const LOCK_KEY = "lock:topup:reconcile";

/** Identifies which replica holds the lock — logged, and checked before release. */
const instanceId = `${process.pid}:${Math.random().toString(36).slice(2, 10)}`;

const DEFAULT_INTERVAL_SEC = 120;
const DEFAULT_BATCH = 25;

let timer = null;
let running = false;

/* ------------------------------------------------------------------ *
 * Config
 * ------------------------------------------------------------------ */

function isEnabled() {
  // Default TRUE: an un-run reconciler is a silent money-loss risk, so this
  // must be opt-OUT. Compose sets it explicitly anyway.
  return (process.env.TOPUP_RECONCILE_ENABLED || "true") === "true";
}

function intervalSeconds() {
  const parsed = parseInt(process.env.TOPUP_RECONCILE_INTERVAL_SEC || "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_INTERVAL_SEC;
}

function batchSize() {
  const parsed = parseInt(process.env.TOPUP_RECONCILE_BATCH || "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_BATCH;
}

/* ------------------------------------------------------------------ *
 * Cross-replica lock
 * ------------------------------------------------------------------ */

/**
 * `SET lock:topup:reconcile <instanceId> NX EX <interval-10>`.
 *
 * A double attempt across replicas would be HARMLESS as far as money goes —
 * the external wallet 409s on a reused `reference_id`, which the money path
 * treats as success, so nothing can be credited twice. What it would do is
 * muddy the picture: two replicas racing the same order both bump
 * `reconcileAttempts`, so an order could burn its whole attempt budget in one
 * tick and be flagged for manual action for no reason, and the logs would show
 * phantom duplicate failures. The lock exists for that, not for safety.
 *
 * TTL is `interval - 10s` so the lock always expires before the next tick even
 * if this process dies holding it (no manual recovery needed), while still
 * outliving a normal run.
 *
 * Redis being unavailable must not stop reconciliation: we log and proceed
 * unlocked, accepting the muddied counters over a stalled queue.
 *
 * @private
 * @returns {Promise<{acquired: boolean, locked: boolean}>} `locked` is false
 *   when Redis could not be used at all (so nothing needs releasing).
 */
async function acquireLock(ttlSeconds) {
  let client;
  try {
    client = getRedisClient();
  } catch (error) {
    logger.warn("Reconcile lock unavailable — running unlocked", {
      error: error.message,
    });
    return { acquired: true, locked: false };
  }

  try {
    const result = await client.set(LOCK_KEY, instanceId, {
      NX: true,
      EX: Math.max(1, ttlSeconds),
    });
    // node-redis v4 returns "OK" on success and null when NX blocked it.
    return { acquired: result === "OK" || result === true, locked: true };
  } catch (error) {
    logger.warn("Reconcile lock acquisition failed — running unlocked", {
      error: error.message,
    });
    return { acquired: true, locked: false };
  }
}

/**
 * Release only if we still own it — a lock that already expired may belong to
 * another replica by now, and deleting that one would defeat the point.
 *
 * @private
 */
async function releaseLock() {
  try {
    const client = getRedisClient();
    const holder = await client.get(LOCK_KEY);
    if (holder === instanceId) {
      await client.del(LOCK_KEY);
    }
  } catch (error) {
    // The TTL cleans up regardless.
    logger.debug("Reconcile lock release skipped", { error: error.message });
  }
}

/* ------------------------------------------------------------------ *
 * Tick
 * ------------------------------------------------------------------ */

/**
 * One reconciliation tick. NEVER throws — an exception escaping the interval
 * callback would take the process down and stop reconciliation entirely.
 */
async function tick() {
  if (running) {
    logger.debug("Reconcile tick skipped — previous run still in progress");
    return null;
  }

  running = true;
  const ttl = Math.max(10, intervalSeconds() - 10);
  let lock = { acquired: false, locked: false };

  try {
    lock = await acquireLock(ttl);

    if (!lock.acquired) {
      logger.debug("Reconcile tick skipped — another replica holds the lock");
      return null;
    }

    const summary = await reconcileService.runPending({ limit: batchSize() });
    logger.info("Top-up reconcile tick complete", { instanceId, ...summary });
    return summary;
  } catch (error) {
    logger.error("Top-up reconcile tick failed", {
      instanceId,
      error: error.message,
    });
    return null;
  } finally {
    if (lock.locked && lock.acquired) {
      await releaseLock();
    }
    running = false;
  }
}

/* ------------------------------------------------------------------ *
 * Lifecycle
 * ------------------------------------------------------------------ */

function start() {
  if (!isEnabled()) {
    logger.info(
      "Top-up reconcile worker disabled (set TOPUP_RECONCILE_ENABLED=true to enable)",
    );
    return;
  }

  if (timer) {
    logger.debug("Top-up reconcile worker already started");
    return;
  }

  const seconds = intervalSeconds();
  logger.info(`Top-up reconcile worker starting (every ${seconds}s)`, {
    instanceId,
    batch: batchSize(),
    maxAttempts: reconcileService.maxAttempts(),
  });

  timer = setInterval(tick, seconds * 1000);
  if (timer.unref) timer.unref(); // never hold the process open for this
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info("Top-up reconcile worker stopped", { instanceId });
  }
}

/**
 * Trigger one pass by hand (tests, an admin "run now" action). Honours the
 * same in-process and Redis guards as the scheduled tick.
 *
 * @returns {Promise<Object|null>} the run summary, or null if it was skipped.
 */
async function runOnce() {
  return tick();
}

/** True while a tick is in flight in THIS process. */
function isRunning() {
  return running;
}

module.exports = {
  start,
  stop,
  runOnce,
  isRunning,

  // Exported for tests / diagnostics.
  tick,
  instanceId,
  LOCK_KEY,
};
