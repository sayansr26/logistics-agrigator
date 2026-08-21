/**
 * API Credential routes.
 *
 * Mounted in server.js as TWO separate routers:
 *
 *   /api/v1/external/auth   -> externalAuthRouter (public token exchange only)
 *   /api/v1/api-credentials -> managementRouter   (session-authenticated CRUD)
 *
 * They are deliberately split. The gateway confines /api/v1/external/* to
 * tokens carrying aud="external-api" and rejects session tokens there, so the
 * portal's credential manager cannot live under that prefix.
 */

const express = require("express");

const apiCredentialController = require("../controllers/apiCredentialController");
const { validate } = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const {
  tokenIssueLimiter,
  tokenIssueIpLimiter,
} = require("../middleware/rateLimiter");
const {
  issueTokenSchema,
  createCredentialSchema,
  updateCredentialSchema,
} = require("../validation/apiCredentialSchemas");

const externalAuthRouter = express.Router();
const managementRouter = express.Router();
const internalRouter = express.Router();

/**
 * @swagger
 * /api/v1/external/auth/token:
 *   post:
 *     tags: [External API]
 *     summary: Exchange API credentials for an access token
 *     description: |
 *       Public endpoint. Exchanges a `clientId`/`clientSecret` pair for a
 *       short-lived (1 hour) bearer token scoped to the External API. There is
 *       no refresh token — request a new one when this expires.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clientId, clientSecret]
 *             properties:
 *               clientId:
 *                 type: string
 *                 example: lgk_live_9f2a5c1d8e3b4a6f7c0d1e2f
 *               clientSecret:
 *                 type: string
 *                 example: sk_live_...
 *     responses:
 *       200:
 *         description: Token issued
 *       401:
 *         description: Invalid, revoked or expired credentials
 *       429:
 *         description: Too many token requests
 */
externalAuthRouter.post(
  "/token",
  tokenIssueIpLimiter,
  tokenIssueLimiter,
  validate(issueTokenSchema),
  apiCredentialController.issueToken,
);

// ---------------------------------------------------------------------------
// Credential management (portal session required)
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/api-credentials:
 *   get:
 *     tags: [API Credentials]
 *     summary: List API credentials
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Credential list }
 *   post:
 *     tags: [API Credentials]
 *     summary: Create an API credential
 *     description: The plaintext client secret is returned exactly once.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Credential created }
 */
managementRouter.get(
  "/",
  authenticate,
  apiCredentialController.listCredentials,
);

managementRouter.post(
  "/",
  authenticate,
  validate(createCredentialSchema),
  apiCredentialController.createCredential,
);

/**
 * @swagger
 * /api/v1/api-credentials/{id}:
 *   put:
 *     tags: [API Credentials]
 *     summary: Update a credential's name, scopes, IP allowlist or rate limit
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Credential updated }
 *   delete:
 *     tags: [API Credentials]
 *     summary: Revoke a credential
 *     description: Already-issued tokens stop working immediately.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Credential revoked }
 */
managementRouter.put(
  "/:id",
  authenticate,
  validate(updateCredentialSchema),
  apiCredentialController.updateCredential,
);

/**
 * @swagger
 * /api/v1/api-credentials/{id}/rotate:
 *   post:
 *     tags: [API Credentials]
 *     summary: Rotate a credential's secret
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: New secret issued (shown once) }
 */
managementRouter.post(
  "/:id/rotate",
  authenticate,
  apiCredentialController.rotateCredential,
);

managementRouter.delete(
  "/:id",
  authenticate,
  apiCredentialController.revokeCredential,
);

// ---------------------------------------------------------------------------
// Internal (service-to-service) — used by shipment-service's externalAuth to
// revalidate a credential behind a short Redis cache.
// ---------------------------------------------------------------------------

internalRouter.get(
  "/api-credentials/:id/status",
  (req, res, next) => {
    const secret = req.get("X-Internal-Request");
    if (!secret || secret !== process.env.INTERNAL_SECRET) {
      return res.status(403).json({
        status: "error",
        error: {
          code: "DIRECT_ACCESS_FORBIDDEN",
          message: "Internal endpoint",
        },
      });
    }
    return next();
  },
  apiCredentialController.getCredentialStatus,
);

module.exports = { externalAuthRouter, managementRouter, internalRouter };
