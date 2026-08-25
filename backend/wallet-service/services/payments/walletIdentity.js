/**
 * Wallet Identity Resolver
 *
 * THE TWO IDENTITIES — never mix them:
 *
 *   1. EXTERNAL wallet identity (`walletUserId`) — the id the external wallet
 *      API (wapi.websiteduniya.com) is keyed by. For outlet users this is the
 *      user's PHONE NUMBER, not a UUID. See
 *      `controllers/outletWalletController.js:11,48,80` where every `/my/*`
 *      handler passes `req.user?.phone` as the wallet userId.
 *
 *   2. LOCAL subject id (`subjectUserId`) — our own `users.id`, a `@db.Uuid`.
 *      This is what local Prisma rows (payment orders, manual top-up requests,
 *      audit logs) must be keyed by, because every local FK/column is a UUID.
 *
 * Passing a phone where a UUID is expected fails Prisma at write time; passing
 * a UUID to the external wallet silently resolves to "no such wallet". So the
 * payment feature always carries BOTH and this module is the single place that
 * derives them.
 *
 * Money is credited against `walletUserId` (external, source of truth for
 * balances). Records, approvals and audit trails are keyed by `subjectUserId`.
 *
 * @typedef {Object} WalletIdentity
 * @property {string} walletUserId  - EXTERNAL wallet key (phone for outlets)
 * @property {string} clientCode    - external tenant code
 * @property {string} subjectUserId - LOCAL users.id (UUID)
 */

const { ValidationError } = require("../../shared/lib/errors");

const FALLBACK_CLIENT_CODE = "DEFAULT";

/**
 * Normalize a client code to the form the external wallet API expects.
 * Empty / missing values fall back to DEFAULT_CLIENT_CODE, then "DEFAULT".
 *
 * @param {*} value
 * @returns {string}
 */
function normalizeClientCode(value) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim().toUpperCase();
  }
  return (
    process.env.DEFAULT_CLIENT_CODE || FALLBACK_CLIENT_CODE
  ).toUpperCase();
}

/**
 * Resolve the wallet identity for the AUTHENTICATED caller (self top-up flows).
 *
 * NOTE ON clientCode: `user.clientCode` is read first for forward
 * compatibility, but the auth service does not actually mint `clientCode` into
 * the JWT today — so in practice the `DEFAULT_CLIENT_CODE` env fallback is the
 * real path taken. This mirrors `outletWalletController.js:87-88`. If/when the
 * claim is added to the token, this function starts honouring it with no code
 * change.
 *
 * @param {Object} user - req.user
 * @returns {WalletIdentity}
 * @throws {ValidationError} WALLET_IDENTITY_UNAVAILABLE when the phone is missing
 */
function resolveForSelf(user) {
  const phone = typeof user?.phone === "string" ? user.phone.trim() : "";

  if (!phone) {
    const error = new ValidationError(
      "Your wallet identity could not be resolved because no phone number is set on your account. Add a phone number to your profile to use wallet top-up.",
    );
    error.code = "WALLET_IDENTITY_UNAVAILABLE";
    throw error;
  }

  if (!user?.id) {
    const error = new ValidationError(
      "Your wallet identity could not be resolved because the authenticated user has no id.",
    );
    error.code = "WALLET_IDENTITY_UNAVAILABLE";
    throw error;
  }

  return {
    walletUserId: phone,
    clientCode: normalizeClientCode(user.clientCode),
    subjectUserId: user.id,
  };
}

/**
 * Resolve the wallet identity from an ADMIN-supplied request body
 * (payment links, manual top-ups — an admin acting on someone else's wallet).
 *
 * `walletUserId` here is whatever the external wallet is keyed by (a phone for
 * outlets), so it is validated as a non-empty string and NOT as a UUID.
 * `subjectUserId` is optional — an admin may create a link for a wallet that
 * has no local user row yet.
 *
 * @param {Object} body - validated request body
 * @returns {WalletIdentity} (subjectUserId may be null)
 * @throws {ValidationError} WALLET_IDENTITY_UNAVAILABLE
 */
function resolveForAdmin(body) {
  const raw = body?.walletUserId;
  const walletUserId = typeof raw === "string" ? raw.trim() : "";

  if (!walletUserId) {
    const error = new ValidationError(
      "walletUserId is required and must be a non-empty string (the external wallet id, e.g. the outlet's phone number).",
    );
    error.code = "WALLET_IDENTITY_UNAVAILABLE";
    throw error;
  }

  return {
    walletUserId,
    clientCode: normalizeClientCode(body?.clientCode),
    subjectUserId: body?.subjectUserId || null,
  };
}

/**
 * Every Redis key that caches a wallet balance and MUST be deleted after a
 * credit, so the user sees the new balance immediately.
 *
 * WHY THE EXTRA VARIANTS — a real, pre-existing inconsistency:
 * wallet-service falls back to `DEFAULT_CLIENT_CODE || "DEFAULT"` when no
 * clientCode is present (`controllers/outletWalletController.js:87-88`), while
 * shipment-service historically falls back to "LOGISTICS" in
 * `services/paymentProcessingService.js` when it builds `wallet:<id>:<code>`.
 * Two services therefore cache the SAME balance under DIFFERENT keys. Until
 * that fallback is unified, a credit that busts only our own key leaves
 * shipment-service serving a stale balance and wrongly rejecting a booking for
 * "insufficient balance". So we bust the resolved code AND both known
 * fallbacks. Deleting a key that does not exist is free.
 *
 * @param {string} walletUserId
 * @param {string} clientCode
 * @returns {string[]} de-duplicated Redis keys to DEL
 */
function buildBalanceCacheKeys(walletUserId, clientCode) {
  if (!walletUserId) {
    return [];
  }

  const resolved = normalizeClientCode(clientCode);
  const codes = new Set([resolved, "DEFAULT", "LOGISTICS"]);

  const keys = [
    `balance:${walletUserId}`,
    `external_wallet_balance:${walletUserId}`,
  ];

  for (const code of codes) {
    keys.push(`wallet:${walletUserId}:${code}`);
  }

  return [...new Set(keys)];
}

module.exports = {
  resolveForSelf,
  resolveForAdmin,
  normalizeClientCode,
  buildBalanceCacheKeys,
  FALLBACK_CLIENT_CODE,
};
