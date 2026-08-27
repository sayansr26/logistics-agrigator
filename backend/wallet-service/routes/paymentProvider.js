/**
 * Payment Provider routes — /api/v1/wallet/payment-providers
 *
 * ROUTE ORDER IS LOAD-BEARING: the LITERAL segments (`/policy`, `/active`) are
 * declared BEFORE `/:provider`, otherwise the parameterised route swallows them
 * and `GET /policy` arrives as `provider="policy"` (a 400 from
 * providerParamsSchema). Same rule the wallet router already follows for its
 * `/my/*` and `/admin/*` routes ahead of `/:userId`.
 */

const express = require("express");

const {
  listProviders,
  getProvider,
  updateProvider,
  testConnection,
  getPolicy,
  updatePolicy,
  getActiveProvider,
} = require("../controllers/paymentProviderController");
const { authMiddleware } = require("../shared/lib/auth");
const { validateParams, validateBody } = require("../middleware/validate");
const {
  providerParamsSchema,
  updateProviderConfigSchema,
  testConnectionSchema,
  updateTopupPolicySchema,
} = require("../validation/paymentSchema");

const router = express.Router();

// ---------------------------------------------------------------------------
// Literal segments — MUST be declared before /:provider
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/wallet/payment-providers/policy:
 *   get:
 *     tags: [Payment Providers]
 *     summary: Get the manual top-up policy
 *     description: |
 *       Returns the platform-level limits that govern manual (offline) wallet
 *       top-ups: per-transaction cap, approval threshold, per-user daily cap and
 *       whether a reason / external reference is mandatory.
 *       The row is lazily seeded with the schema defaults on first read.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Policy retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: success
 *               data:
 *                 id: "550e8400-e29b-41d4-a716-446655440000"
 *                 clientId: null
 *                 manualMaxPerTransaction: 100000
 *                 manualApprovalThreshold: 25000
 *                 manualMaxPerDayPerUser: null
 *                 requireReason: true
 *                 requireReference: true
 *                 updatedBy: null
 *                 updatedAt: "2024-01-01T00:00:00.000Z"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get(
  "/policy",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("settings", "read", "all"),
  getPolicy,
);

/**
 * @swagger
 * /api/v1/wallet/payment-providers/policy:
 *   put:
 *     tags: [Payment Providers]
 *     summary: Update the manual top-up policy
 *     description: |
 *       Partial update — at least one field is required. Every change is written
 *       to the audit log as `WALLET_TOPUP_POLICY_UPDATED`.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               manualMaxPerTransaction:
 *                 type: number
 *                 example: 100000
 *               manualApprovalThreshold:
 *                 type: number
 *                 example: 25000
 *               manualMaxPerDayPerUser:
 *                 type: number
 *                 example: 50000
 *               requireReason:
 *                 type: boolean
 *               requireReference:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Policy updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.put(
  "/policy",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("settings", "manage", "all"),
  validateBody(updateTopupPolicySchema),
  updatePolicy,
);

/**
 * @swagger
 * /api/v1/wallet/payment-providers/active:
 *   get:
 *     tags: [Payment Providers]
 *     summary: Get the active payment provider (customer-facing, non-secret)
 *     description: |
 *       Returns the PUBLIC checkout parameters the Add Money screen needs:
 *       the public `keyId`, currency and amount limits. It NEVER returns a key
 *       secret or webhook secret.
 *
 *       When no gateway is enabled (or the enabled one is half-configured) this
 *       returns HTTP 200 with `{ enabled: false, provider: null }` rather than
 *       an error, so the UI simply hides Add Money.
 *
 *       `staticQr` reports the CCAvenue static UPI QR collection channel, which
 *       is configured as its OWN provider row and is independent of the checkout
 *       gateway above - it is never returned as `provider`, because it cannot
 *       create a checkout order. The UI hides every QR surface (the admin QR
 *       Collections / Unattributed queues and the outlet "My QR" page) when
 *       `staticQr.enabled` is false.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Active provider resolved (may be disabled)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: success
 *               data:
 *                 enabled: true
 *                 provider: razorpay
 *                 mode: TEST
 *                 keyId: "rzp_test_ABC123"
 *                 currency: INR
 *                 minAmount: 100
 *                 maxAmount: 200000
 *                 quickAmounts: [500, 1000, 2000, 5000]
 *                 staticQr:
 *                   enabled: true
 *                   provider: ccavenue_upi_qr
 *                   mode: TEST
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get(
  "/active",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "read", "own"),
  getActiveProvider,
);

/**
 * @swagger
 * /api/v1/wallet/payment-providers:
 *   get:
 *     tags: [Payment Providers]
 *     summary: List every payment provider with its masked configuration
 *     description: |
 *       Returns the implemented providers (currently Razorpay) plus the
 *       placeholder entries flagged `comingSoon: true` (stripe, cashfree, payu).
 *       Secrets are returned only as `keySecretSet` / `keySecretMasked`.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Providers retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get(
  "/",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("settings", "read", "all"),
  listProviders,
);

// ---------------------------------------------------------------------------
// Parameterised routes — MUST stay below the literal segments above
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/wallet/payment-providers/{provider}:
 *   get:
 *     tags: [Payment Providers]
 *     summary: Get one provider's masked configuration
 *     description: |
 *       The admin view. Key secrets and webhook secrets are never returned in
 *       plaintext — only `keySecretSet` (boolean), `keySecretMasked`
 *       (e.g. `rzp_test_••••••4f2a`) and `webhookSecretSet`.
 *
 *       If the stored ciphertext cannot be decrypted (PAYMENT_SECRET_ENC_KEY was
 *       rotated) the response still returns 200 with `credentialsUnreadable: true`
 *       and `keySecretMasked: null`, so the operator can re-enter the credentials.
 *
 *       `webhookUrl` is computed server-side for pasting into the gateway
 *       dashboard, alongside the `webhookEvents` that must be subscribed.
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [razorpay, stripe, cashfree, payu]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: success
 *               data:
 *                 provider: razorpay
 *                 clientId: null
 *                 isEnabled: true
 *                 mode: TEST
 *                 test:
 *                   keyId: "rzp_test_ABC123"
 *                   keySecretSet: true
 *                   keySecretMasked: "••••••4f2a"
 *                   webhookSecretSet: true
 *                 live:
 *                   keyId: null
 *                   keySecretSet: false
 *                   keySecretMasked: null
 *                   webhookSecretSet: false
 *                 currency: INR
 *                 minAmount: 100
 *                 maxAmount: 200000
 *                 quickAmounts: [500, 1000, 2000, 5000]
 *                 paymentLinkExpiryHours: 24
 *                 webhookUrl: "https://api.example.com/api/v1/wallet/topup/webhook/razorpay"
 *                 webhookEvents:
 *                   - payment.captured
 *                   - payment.failed
 *                   - payment_link.paid
 *                   - payment_link.expired
 *                   - refund.processed
 *                 lastTestedAt: "2024-01-01T00:00:00.000Z"
 *                 lastTestStatus: SUCCESS
 *                 lastTestMessage: "Connection successful"
 *                 updatedAt: "2024-01-01T00:00:00.000Z"
 *                 updatedBy: "550e8400-e29b-41d4-a716-446655440001"
 *                 comingSoon: false
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get(
  "/:provider",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("settings", "read", "all"),
  validateParams(providerParamsSchema),
  getProvider,
);

/**
 * @swagger
 * /api/v1/wallet/payment-providers/{provider}:
 *   put:
 *     tags: [Payment Providers]
 *     summary: Update a provider's configuration
 *     description: |
 *       Partial update — at least one field is required.
 *
 *       **Secret semantics:** a credential field that is OMITTED leaves the
 *       stored value untouched; sending `""` (or `null`) CLEARS it; sending a
 *       value REPLACES it. A masked value echoed back by the UI is treated as
 *       "unchanged" and is never written to the database. `keyId` fields are
 *       stored in plaintext by design — they are public checkout keys.
 *
 *       **Enabling guard:** setting `isEnabled: true` requires the complete
 *       credential trio (keyId + keySecret + webhookSecret) for the effective
 *       mode, counting values already stored. Otherwise the call fails 400 with
 *       code `PROVIDER_CREDENTIALS_INCOMPLETE` and the missing field names.
 *
 *       **Mode-switch guard:** changing `mode` is refused (409,
 *       `PENDING_ORDERS_BLOCK_MODE_SWITCH`) while any payment order in the
 *       CURRENT mode is still `CREATED` or `PENDING`. The response `details`
 *       carry `total` and up to 20 `blockingOrders`. There is no force override.
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [razorpay, stripe, cashfree, payu]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               isEnabled:
 *                 type: boolean
 *               mode:
 *                 type: string
 *                 enum: [TEST, LIVE]
 *               testKeyId:
 *                 type: string
 *               testKeySecret:
 *                 type: string
 *                 description: Omit to keep, "" to clear, value to replace
 *               testWebhookSecret:
 *                 type: string
 *               liveKeyId:
 *                 type: string
 *               liveKeySecret:
 *                 type: string
 *               liveWebhookSecret:
 *                 type: string
 *               currency:
 *                 type: string
 *                 enum: [INR]
 *               minAmount:
 *                 type: number
 *               maxAmount:
 *                 type: number
 *               quickAmounts:
 *                 type: array
 *                 items:
 *                   type: number
 *               paymentLinkExpiryHours:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Configuration updated successfully (same shape as GET)
 *       400:
 *         description: Validation failed or PROVIDER_CREDENTIALS_INCOMPLETE
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         description: PENDING_ORDERS_BLOCK_MODE_SWITCH — in-flight orders block the mode change
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.put(
  "/:provider",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("settings", "manage", "all"),
  validateParams(providerParamsSchema),
  validateBody(updateProviderConfigSchema),
  updateProvider,
);

/**
 * @swagger
 * /api/v1/wallet/payment-providers/{provider}/test-connection:
 *   post:
 *     tags: [Payment Providers]
 *     summary: Test the stored credentials against the gateway
 *     description: |
 *       Calls the provider's connectivity check using the STORED credentials for
 *       the requested mode (defaults to the provider's current mode). The body
 *       accepts a `mode` only — a secret is never accepted here, so the test
 *       always validates exactly what the platform will transact with.
 *
 *       The outcome is persisted to `lastTestedAt` / `lastTestStatus` /
 *       `lastTestMessage` and audit-logged as `PAYMENT_PROVIDER_TESTED`.
 *       A failed test returns HTTP 200 with `ok: false`, not an error status.
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [razorpay, stripe, cashfree, payu]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mode:
 *                 type: string
 *                 enum: [TEST, LIVE]
 *     responses:
 *       200:
 *         description: Test executed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: success
 *               data:
 *                 ok: true
 *                 mode: TEST
 *                 message: "Connection successful"
 *                 accountHint: "acc_ABC123"
 *                 latencyMs: 412
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         description: PROVIDER_NOT_CONFIGURED — the requested mode has no complete credential trio
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post(
  "/:provider/test-connection",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("settings", "manage", "all"),
  validateParams(providerParamsSchema),
  validateBody(testConnectionSchema),
  testConnection,
);

module.exports = router;
