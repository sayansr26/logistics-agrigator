/**
 * API Credential Controller
 *
 * Two distinct surfaces:
 *  1. `issueToken`  — public (rate-limited) credential exchange, mounted at
 *     /api/v1/external/auth/token. The only unauthenticated external route.
 *  2. CRUD          — session-authenticated management, mounted at
 *     /api/v1/api-credentials for the portal's credential manager. It lives
 *     OUTSIDE /api/v1/external because the gateway bars session tokens there.
 */

const axios = require("axios");
const { PrismaClient } = require("@prisma/client");

const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");
const apiCredentialService = require("../services/apiCredentialService");

const prisma = new PrismaClient();

const USER_SERVICE_URL =
  process.env.USER_SERVICE_URL || "http://user-service:3003";

/** Fields safe to return to the portal. Never includes `secretHash`. */
const PUBLIC_FIELDS = {
  id: true,
  clientId: true,
  secretLast4: true,
  name: true,
  actingUserId: true,
  outletId: true,
  role: true,
  scopes: true,
  environment: true,
  ipAllowlist: true,
  rateLimitPerMin: true,
  pinnedVersion: true,
  lastUsedAt: true,
  expiresAt: true,
  revokedAt: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * External-API-shaped error (the token endpoint is part of the public API, so
 * it must not leak the internal envelope).
 */
function externalError(res, statusCode, type, code, message) {
  return res.status(statusCode).json({
    success: false,
    error: { type, code, message },
    request_id: res.locals.requestId || null,
  });
}

/**
 * Resolve the acting principal for a new credential and freeze it on the row.
 *
 * outlet-owned key  -> acts as that outlet's auth user (role "outlet")
 * platform key      -> acts as the creating superadmin
 */
async function resolveActingPrincipal(req, { outletId, outletUserId }) {
  const actor = req.user;

  if (!outletId && !outletUserId) {
    // Platform-level credential: acts as the creator. Only superadmin may hold
    // one, since it is unscoped and must name an outlet per booking request.
    return {
      actingUserId: actor.id || actor.userId,
      actingPhone: actor.phone || null,
      tenantId: actor.clientId || null,
      outletId: null,
      role: actor.role,
    };
  }

  // Outlet-bound credential. The outlet is looked up ONCE here so the acting
  // auth user and the phone (the external wallet API's user id) are frozen on
  // the row - booking never needs a per-request lookup.
  const path = outletId
    ? `/api/v1/internal/outlets/${outletId}/badge`
    : `/api/v1/internal/outlets/by-user/${outletUserId}`;

  let outlet;
  try {
    const response = await axios.get(`${USER_SERVICE_URL}${path}`, {
      headers: {
        "X-Internal-Request":
          process.env.INTERNAL_SECRET || "internal-service-secret",
      },
      timeout: 5000,
    });
    outlet = response.data?.data;
  } catch (error) {
    logger.error("Failed to resolve outlet for API credential", {
      service: "auth-service",
      outletId,
      outletUserId,
      error: error.message,
    });
    throw Object.assign(new Error("Outlet lookup failed"), {
      statusCode: 502,
      code: "OUTLET_LOOKUP_FAILED",
    });
  }

  if (!outlet || outlet.found === false || !outlet.userId) {
    throw Object.assign(new Error("Outlet not found"), {
      statusCode: 404,
      code: "OUTLET_NOT_FOUND",
    });
  }

  if (outlet.isActive === false) {
    throw Object.assign(new Error("Outlet is inactive"), {
      statusCode: 409,
      code: "OUTLET_INACTIVE",
    });
  }

  return {
    actingUserId: outlet.userId,
    actingPhone: outlet.phone || null,
    tenantId: outlet.clientId || null,
    outletId: outlet.outletId,
    role: "outlet",
  };
}

/**
 * POST /api/v1/external/auth/token
 * Exchange {clientId, clientSecret} for a short-lived external API token.
 */
async function issueToken(req, res) {
  const { clientId, clientSecret } = req.body;

  try {
    const credential = await prisma.apiCredential.findUnique({
      where: { clientId },
    });

    // Always run a bcrypt comparison, even for an unknown clientId, so the
    // response time does not reveal whether the id exists.
    const secretOk = credential
      ? await apiCredentialService.verifySecret(
          clientSecret,
          credential.secretHash,
        )
      : await apiCredentialService.verifySecret(
          clientSecret,
          apiCredentialService.getDecoyHash(),
        );

    if (!credential || !secretOk) {
      logger.warn("External API token request rejected", {
        service: "auth-service",
        clientId,
        ip: req.ip,
        reason: credential ? "bad_secret" : "unknown_client",
      });
      return externalError(
        res,
        401,
        "authentication_error",
        "invalid_credentials",
        "Invalid client id or client secret.",
      );
    }

    const unusable = apiCredentialService.checkCredentialUsable(credential);
    if (unusable) {
      return externalError(
        res,
        401,
        "authentication_error",
        unusable.code,
        unusable.message,
      );
    }

    if (!apiCredentialService.checkIpAllowed(credential, req.ip)) {
      logger.warn("External API token request from disallowed IP", {
        service: "auth-service",
        credentialId: credential.id,
        ip: req.ip,
      });
      return externalError(
        res,
        403,
        "permission_error",
        "credential_ip_not_allowed",
        "Requests from this IP address are not permitted for this credential.",
      );
    }

    const { accessToken, expiresIn, scopes } =
      apiCredentialService.mintAccessToken(credential);

    await prisma.apiCredential.update({
      where: { id: credential.id },
      data: { lastUsedAt: new Date() },
    });

    logger.info("External API token issued", {
      service: "auth-service",
      credentialId: credential.id,
      actingUserId: credential.actingUserId,
      outletId: credential.outletId,
    });

    return res.json({
      success: true,
      data: {
        accessToken,
        tokenType: "Bearer",
        expiresIn,
        scopes,
        apiVersion:
          credential.pinnedVersion || apiCredentialService.CURRENT_API_VERSION,
      },
      request_id: res.locals.requestId || null,
    });
  } catch (error) {
    logger.error("Failed to issue external API token", {
      service: "auth-service",
      error: error.message,
    });
    return externalError(
      res,
      500,
      "api_error",
      "internal_error",
      "Failed to issue token.",
    );
  }
}

/**
 * POST /api/v1/api-credentials
 * Create a credential. The plaintext secret is returned exactly once.
 */
async function createCredential(req, res) {
  try {
    const actor = req.user;
    const actorId = actor.id || actor.userId;
    const isSuperadmin = actor.role === "superadmin";

    // An outlet may only ever create keys for itself; a superadmin may name any
    // outlet, or omit it for a platform-level key.
    //
    // A session JWT carries no outletId, so an outlet caller is resolved by its
    // own userId rather than trusting anything in the body.
    let lookup;
    if (isSuperadmin) {
      lookup = { outletId: req.body.outletId || null, outletUserId: null };
    } else if (actor.role === "outlet") {
      lookup = { outletId: null, outletUserId: actorId };
    } else {
      return res
        .status(403)
        .json(
          APIResponse.error(
            "Only superadmin and outlet users can create API credentials",
            "FORBIDDEN",
          ),
        );
    }

    const principal = await resolveActingPrincipal(req, lookup);

    const environment = req.body.environment || "live";
    const scopes = apiCredentialService.resolveEffectiveScopes(
      principal.role,
      req.body.scopes || [],
    );

    if (!scopes.length) {
      return res
        .status(400)
        .json(
          APIResponse.error(
            "None of the requested scopes are granted to this role",
            "NO_VALID_SCOPES",
          ),
        );
    }

    const clientId = apiCredentialService.generateClientId(environment);
    const clientSecret = apiCredentialService.generateClientSecret(environment);
    const secretHash = await apiCredentialService.hashSecret(clientSecret);

    const credential = await prisma.apiCredential.create({
      data: {
        clientId,
        secretHash,
        secretLast4: clientSecret.slice(-4),
        name: req.body.name,
        actingUserId: principal.actingUserId,
        actingPhone: principal.actingPhone,
        tenantId: principal.tenantId,
        outletId: principal.outletId,
        role: principal.role,
        scopes,
        environment,
        ipAllowlist: req.body.ipAllowlist || [],
        rateLimitPerMin: req.body.rateLimitPerMin || 60,
        pinnedVersion: apiCredentialService.CURRENT_API_VERSION,
        expiresAt: req.body.expiresAt || null,
        createdByUserId: actorId,
      },
      select: PUBLIC_FIELDS,
    });

    await prisma.auditLog.create({
      data: {
        userId: actorId,
        action: "CREATE",
        resource: "api_credential",
        resourceId: credential.id,
        changes: {
          clientId: credential.clientId,
          name: credential.name,
          outletId: credential.outletId,
          role: credential.role,
          scopes: credential.scopes,
          environment: credential.environment,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    return res.status(201).json(
      APIResponse.success(
        {
          ...credential,
          // Shown once, never recoverable.
          clientSecret,
        },
        {
          message:
            "Credential created. Copy the client secret now — it cannot be shown again.",
        },
      ),
    );
  } catch (error) {
    if (error.statusCode) {
      return res
        .status(error.statusCode)
        .json(APIResponse.error(error.message, error.code));
    }
    logger.error("Failed to create API credential", {
      service: "auth-service",
      error: error.message,
    });
    return res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to create API credential",
          "CREDENTIAL_CREATE_FAILED",
        ),
      );
  }
}

/**
 * Restrict a query to what the caller is allowed to see.
 */
function ownershipWhere(actor) {
  if (actor.role === "superadmin") return {};
  return { actingUserId: actor.id || actor.userId };
}

/**
 * GET /api/v1/api-credentials
 */
async function listCredentials(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 20, 1),
      100,
    );

    const where = {
      ...ownershipWhere(req.user),
      ...(req.query.includeRevoked === "true" ? {} : { revokedAt: null }),
    };

    const [credentials, total] = await Promise.all([
      prisma.apiCredential.findMany({
        where,
        select: PUBLIC_FIELDS,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.apiCredential.count({ where }),
    ]);

    return res.json(
      APIResponse.paginated(credentials, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }),
    );
  } catch (error) {
    logger.error("Failed to list API credentials", {
      service: "auth-service",
      error: error.message,
    });
    return res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to list API credentials",
          "CREDENTIAL_LIST_FAILED",
        ),
      );
  }
}

/**
 * Load a credential the caller is allowed to act on.
 */
async function findOwnedCredential(req) {
  return prisma.apiCredential.findFirst({
    where: { id: req.params.id, ...ownershipWhere(req.user) },
  });
}

/**
 * PUT /api/v1/api-credentials/:id
 */
async function updateCredential(req, res) {
  try {
    const existing = await findOwnedCredential(req);
    if (!existing) {
      return res
        .status(404)
        .json(APIResponse.error("Credential not found", "NOT_FOUND"));
    }
    if (existing.revokedAt) {
      return res
        .status(409)
        .json(
          APIResponse.error(
            "Cannot modify a revoked credential",
            "CREDENTIAL_REVOKED",
          ),
        );
    }

    const data = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.ipAllowlist !== undefined)
      data.ipAllowlist = req.body.ipAllowlist;
    if (req.body.rateLimitPerMin !== undefined)
      data.rateLimitPerMin = req.body.rateLimitPerMin;
    if (req.body.expiresAt !== undefined) data.expiresAt = req.body.expiresAt;
    if (req.body.scopes !== undefined) {
      const scopes = apiCredentialService.resolveEffectiveScopes(
        existing.role,
        req.body.scopes,
      );
      if (!scopes.length) {
        return res
          .status(400)
          .json(
            APIResponse.error(
              "None of the requested scopes are granted to this role",
              "NO_VALID_SCOPES",
            ),
          );
      }
      data.scopes = scopes;
    }

    const updated = await prisma.apiCredential.update({
      where: { id: existing.id },
      data,
      select: PUBLIC_FIELDS,
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id || req.user.userId,
        action: "UPDATE",
        resource: "api_credential",
        resourceId: existing.id,
        changes: data,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    // Scope/limit changes must not be masked by a cached credential status.
    // (Cache invalidation only — NOT the revocation key, which would disable
    // the credential outright.)
    await apiCredentialService.invalidateCredentialCache(existing.id);

    return res.json(APIResponse.success(updated));
  } catch (error) {
    logger.error("Failed to update API credential", {
      service: "auth-service",
      error: error.message,
    });
    return res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to update API credential",
          "CREDENTIAL_UPDATE_FAILED",
        ),
      );
  }
}

/**
 * POST /api/v1/api-credentials/:id/rotate
 * Issue a new secret for the same clientId. Old tokens keep working until they
 * expire unless the caller also revokes.
 */
async function rotateCredential(req, res) {
  try {
    const existing = await findOwnedCredential(req);
    if (!existing) {
      return res
        .status(404)
        .json(APIResponse.error("Credential not found", "NOT_FOUND"));
    }
    if (existing.revokedAt) {
      return res
        .status(409)
        .json(
          APIResponse.error(
            "Cannot rotate a revoked credential",
            "CREDENTIAL_REVOKED",
          ),
        );
    }

    const clientSecret = apiCredentialService.generateClientSecret(
      existing.environment,
    );
    const secretHash = await apiCredentialService.hashSecret(clientSecret);

    const updated = await prisma.apiCredential.update({
      where: { id: existing.id },
      data: { secretHash, secretLast4: clientSecret.slice(-4) },
      select: PUBLIC_FIELDS,
    });

    await apiCredentialService.invalidateCredentialCache(existing.id);

    await prisma.auditLog.create({
      data: {
        userId: req.user.id || req.user.userId,
        action: "UPDATE",
        resource: "api_credential",
        resourceId: existing.id,
        changes: { rotated: true, secretLast4: updated.secretLast4 },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    return res.json(
      APIResponse.success(
        { ...updated, clientSecret },
        {
          message:
            "Secret rotated. Copy the new client secret now — it cannot be shown again.",
        },
      ),
    );
  } catch (error) {
    logger.error("Failed to rotate API credential", {
      service: "auth-service",
      error: error.message,
    });
    return res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to rotate API credential",
          "CREDENTIAL_ROTATE_FAILED",
        ),
      );
  }
}

/**
 * DELETE /api/v1/api-credentials/:id
 * Soft-revoke, and kill already-issued tokens via the Redis revocation key.
 */
async function revokeCredential(req, res) {
  try {
    const existing = await findOwnedCredential(req);
    if (!existing) {
      return res
        .status(404)
        .json(APIResponse.error("Credential not found", "NOT_FOUND"));
    }
    if (existing.revokedAt) {
      return res.json(
        APIResponse.success(
          { id: existing.id, revokedAt: existing.revokedAt },
          { message: "Credential was already revoked" },
        ),
      );
    }

    const revoked = await prisma.apiCredential.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
      select: PUBLIC_FIELDS,
    });

    await apiCredentialService.markCredentialRevoked(existing.id);
    await apiCredentialService.invalidateCredentialCache(existing.id);

    await prisma.auditLog.create({
      data: {
        userId: req.user.id || req.user.userId,
        action: "DELETE",
        resource: "api_credential",
        resourceId: existing.id,
        changes: { revoked: true, clientId: existing.clientId },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    return res.json(
      APIResponse.success(revoked, { message: "Credential revoked" }),
    );
  } catch (error) {
    logger.error("Failed to revoke API credential", {
      service: "auth-service",
      error: error.message,
    });
    return res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to revoke API credential",
          "CREDENTIAL_REVOKE_FAILED",
        ),
      );
  }
}

/**
 * GET /api/v1/internal/api-credentials/:id/status
 * Service-to-service liveness check used by shipment-service's externalAuth.
 */
async function getCredentialStatus(req, res) {
  try {
    const credential = await prisma.apiCredential.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        revokedAt: true,
        expiresAt: true,
        scopes: true,
        rateLimitPerMin: true,
        ipAllowlist: true,
        pinnedVersion: true,
      },
    });

    if (!credential) {
      return res
        .status(404)
        .json(APIResponse.error("Credential not found", "NOT_FOUND"));
    }

    const unusable = apiCredentialService.checkCredentialUsable(credential);

    return res.json(
      APIResponse.success({
        ...credential,
        active: !unusable,
        reason: unusable ? unusable.code : null,
      }),
    );
  } catch (error) {
    logger.error("Failed to fetch credential status", {
      service: "auth-service",
      error: error.message,
    });
    return res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to fetch credential status",
          "CREDENTIAL_STATUS_FAILED",
        ),
      );
  }
}

module.exports = {
  issueToken,
  createCredential,
  listCredentials,
  updateCredential,
  rotateCredential,
  revokeCredential,
  getCredentialStatus,
};
