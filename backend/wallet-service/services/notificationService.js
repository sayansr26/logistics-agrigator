/**
 * Notification Service (pluggable dispatcher)
 *
 * Fires COD/settlement lifecycle notifications (COD received, settlement ready/
 * released/hold/rejected, dispute updates). Providers are pluggable behind a
 * common interface so real channels can drop in without touching call sites.
 *
 * Current providers:
 *  - "log"     : always-on, writes the notification to the logger (default).
 *  - "whatsapp": Gupshup WhatsApp Business stub — logs the intended send and is
 *                ready to be wired to the Gupshup API (env GUPSHUP_API_KEY / _SOURCE).
 *
 * Enable providers via env NOTIFICATION_PROVIDERS (comma-separated), default "log".
 * All sends are best-effort and never throw into the caller.
 */

const logger = require("../shared/lib/logger");

const EVENTS = {
  COD_RECEIVED: "COD_RECEIVED",
  SETTLEMENT_READY: "SETTLEMENT_READY",
  SETTLEMENT_RELEASED: "SETTLEMENT_RELEASED",
  SETTLEMENT_HOLD: "SETTLEMENT_HOLD",
  SETTLEMENT_REJECTED: "SETTLEMENT_REJECTED",
  DISPUTE_UPDATE: "DISPUTE_UPDATE",
};

// ---- Providers ----

const logProvider = {
  name: "log",
  async send(event, payload) {
    logger.info(`[notification:${event}]`, { channel: "log", ...payload });
  },
};

/**
 * Gupshup WhatsApp Business provider (STUB).
 * Wire to https://api.gupshup.io/wa/api/v1/msg using GUPSHUP_API_KEY + GUPSHUP_SOURCE.
 * For now it logs the intended WhatsApp message so the event flow is exercised.
 */
const whatsappProvider = {
  name: "whatsapp",
  async send(event, payload) {
    const apiKey = process.env.GUPSHUP_API_KEY;
    const source = process.env.GUPSHUP_SOURCE;
    if (!apiKey || !source) {
      logger.info(`[notification:${event}] WhatsApp (Gupshup) stub — not configured`, {
        channel: "whatsapp",
        to: payload.to || null,
        message: buildMessage(event, payload),
      });
      return;
    }
    // TODO: real Gupshup send. Left as a stub per current rollout decision.
    logger.info(`[notification:${event}] WhatsApp (Gupshup) send (stub)`, {
      channel: "whatsapp",
      to: payload.to || null,
      message: buildMessage(event, payload),
    });
  },
};

const ALL_PROVIDERS = { log: logProvider, whatsapp: whatsappProvider };

function activeProviders() {
  const names = (process.env.NOTIFICATION_PROVIDERS || "log")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const providers = names.map((n) => ALL_PROVIDERS[n]).filter(Boolean);
  return providers.length ? providers : [logProvider];
}

/** Build a human-readable message for a given event. */
function buildMessage(event, payload) {
  const amt = payload.amount != null ? `₹${payload.amount}` : "";
  switch (event) {
    case EVENTS.COD_RECEIVED:
      return `COD of ${amt} received for AWB ${payload.awbNumber || ""}.`;
    case EVENTS.SETTLEMENT_READY:
      return `Your COD settlement ${payload.settlementNo || ""} of ${amt} is ready.`;
    case EVENTS.SETTLEMENT_RELEASED:
      return `Settlement ${payload.settlementNo || ""} of ${amt} has been released.`;
    case EVENTS.SETTLEMENT_HOLD:
      return `Settlement ${payload.settlementNo || ""} is on hold. ${payload.reason || ""}`.trim();
    case EVENTS.SETTLEMENT_REJECTED:
      return `Settlement ${payload.settlementNo || ""} was rejected. ${payload.reason || ""}`.trim();
    case EVENTS.DISPUTE_UPDATE:
      return `Update on your dispute: ${payload.reason || ""}`.trim();
    default:
      return `Notification: ${event}`;
  }
}

/**
 * Dispatch an event to all active providers. Best-effort, never throws.
 * @param {string} event - one of EVENTS
 * @param {Object} payload - { to?, userId?, amount?, settlementNo?, awbNumber?, reason? }
 */
async function notify(event, payload = {}) {
  const providers = activeProviders();
  await Promise.all(
    providers.map((p) =>
      p.send(event, payload).catch((e) =>
        logger.warn(`Notification provider ${p.name} failed`, {
          event,
          error: e.message,
        }),
      ),
    ),
  );
}

module.exports = { notify, EVENTS };
