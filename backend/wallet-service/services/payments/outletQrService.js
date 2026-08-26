/**
 * Outlet Static-QR Registry — Wave 4
 *
 * WHAT THIS OWNS
 * --------------
 * The `OutletPaymentQr` table: the rows that say WHICH OUTLET a printed static
 * UPI QR belongs to. It is the ONLY thing that can answer "whose money is
 * this?" for a static-QR payment — the payer controls the payload, so nothing
 * in an inbound webhook may ever be trusted to name a wallet.
 * `qrCollectionService.resolveQr` reads these rows; this module writes them.
 *
 * THE ONE RULE THAT SHAPES THIS WHOLE FILE: A QR IS NEVER REPOINTED.
 * ------------------------------------------------------------------
 * `updateQrCode` refuses `walletUserId` / `clientCode` outright
 * (`QR_REPOINT_FORBIDDEN`). Moving a live QR to a different outlet would
 * retro-actively change the meaning of every `QrCollection` row that already
 * snapshotted this QR's identity — yesterday's settled payments would start
 * claiming they went to an outlet that never received them. To move a QR you
 * DEACTIVATE it and ISSUE A NEW ONE, so the history stays truthful about where
 * money actually went. Only presentation and alerting signals are mutable.
 *
 * THE SECOND RULE: TWO LIVE QRS MAY NEVER CLAIM ONE IDENTIFIER.
 * ------------------------------------------------------------
 * Three PARTIAL unique indexes in the migration enforce at most one ACTIVE row
 * per `(provider, qrIdentifier)`, per `(provider, vpa)` and per
 * `(provider, walletUserId, clientCode)`. A violation is not an internal error:
 * it is an operator about to create a mis-routing bug, so every P2002 is mapped
 * to a 409 `QR_IDENTIFIER_ALREADY_ACTIVE` naming the key that collided.
 *
 * AUDIT: every write is audited INSIDE the same `$transaction` as the write, so
 * a QR can never change without a matching audit line. A `mode` change gets its
 * OWN action (`OUTLET_QR_MODE_CHANGED`) on top of `OUTLET_QR_UPDATED`, because
 * `mode` is what decides whether payments on this QR credit real money.
 */

const { prisma } = require("../../config/database");
const logger = require("../../shared/lib/logger");
const {
  ValidationError,
  ConflictError,
  NotFoundError,
} = require("../../shared/lib/errors");
const {
  resolveForSelf,
  resolveForAdmin,
  normalizeClientCode,
} = require("./walletIdentity");

const DEFAULT_PROVIDER = "ccavenue_upi_qr";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const AUDIT_RESOURCE = "OutletPaymentQr";

/** Audit actions written by this module. Exported so controllers and tests
 *  reference the constant instead of re-typing the string. */
const AUDIT_ACTIONS = {
  OUTLET_QR_CREATED: "OUTLET_QR_CREATED",
  OUTLET_QR_UPDATED: "OUTLET_QR_UPDATED",
  OUTLET_QR_MODE_CHANGED: "OUTLET_QR_MODE_CHANGED",
  OUTLET_QR_DEACTIVATED: "OUTLET_QR_DEACTIVATED",
};

/**
 * THE ONLY FIELDS `updateQrCode` MAY TOUCH.
 *
 * Everything absent from this list is either identity (`walletUserId`,
 * `clientCode`, `subjectUserId`), an attribution key (`qrIdentifier`, `vpa`) or
 * lifecycle state (`isActive`). Identity and attribution keys are immutable for
 * the reason in the file header; lifecycle moves only through
 * `deactivateQrCode`, so there is exactly one code path that retires a QR.
 */
const MUTABLE_FIELDS = [
  "label",
  "outletName",
  "qrPayload",
  "qrImageUrl",
  "mode",
  "maxPerCreditAmount",
  "maxPerDayAmount",
  "maxPerDayCount",
];

/** Decimal columns — written as STRINGS so the value never round-trips a float. */
const DECIMAL_FIELDS = new Set(["maxPerCreditAmount", "maxPerDayAmount"]);

/**
 * The three partial unique indexes, by the constraint name Postgres reports in
 * `P2002.meta.target`. Mapped to a human key so the 409 tells the operator
 * WHICH uniqueness they broke rather than just "duplicate".
 * @see prisma/migrations/20260901120000_.../migration.sql
 */
const UNIQUE_CONSTRAINTS = [
  {
    match: "outlet_payment_qrs_provider_qrid_uniq",
    key: "provider+qrIdentifier",
    message:
      "Another ACTIVE QR already uses this qrIdentifier for this provider. Deactivate it before issuing a new one.",
  },
  {
    match: "outlet_payment_qrs_provider_vpa_uniq",
    key: "provider+vpa",
    message:
      "Another ACTIVE QR already uses this VPA for this provider. Deactivate it before issuing a new one.",
  },
  {
    match: "outlet_payment_qrs_active_wallet_uniq",
    key: "provider+walletUserId+clientCode",
    message:
      "This outlet already has an ACTIVE QR for this provider. Deactivate it before issuing a replacement.",
  },
];

/* ------------------------------------------------------------------ *
 * Create
 * ------------------------------------------------------------------ */

/**
 * Provision a new outlet QR row.
 *
 * @param {Object} args
 * @param {Object} args.body validated `createQrCodeSchema` body
 * @param {Object} args.actor `req.user`
 * @param {?string} [args.ip]
 * @param {?string} [args.userAgent]
 * @returns {Promise<Object>} `serializeQrCode` projection
 * @throws {ValidationError} QR_KEY_REQUIRED when neither qrIdentifier nor vpa
 * @throws {ConflictError} QR_IDENTIFIER_ALREADY_ACTIVE on any partial-unique hit
 */
async function createQrCode({ body, actor, ip, userAgent } = {}) {
  const input = body || {};

  // `resolveForAdmin` is the single place that normalises the EXTERNAL wallet
  // identity (a phone for outlets, never a UUID) and the client code.
  const identity = resolveForAdmin(input);

  const qrIdentifier = trimOrNull(input.qrIdentifier);
  const vpa = trimOrNull(input.vpa);

  // Defence in depth — `createQrCodeSchema` also enforces this. A row with
  // NEITHER key can never be matched by `resolveQr`, so every payment landing
  // on it would go to the unattributed queue forever.
  if (!qrIdentifier && !vpa) {
    throw validationError(
      "A QR must carry at least one attribution key: qrIdentifier or vpa. Without one, no payment can ever be matched to this outlet.",
      "QR_KEY_REQUIRED",
      { qrIdentifier: null, vpa: null },
    );
  }

  const provider = normalizeProvider(input.provider);
  const actorId = uuidOrNull(actor && actor.id);

  const data = {
    provider,
    walletUserId: identity.walletUserId,
    clientCode: normalizeClientCode(identity.clientCode),
    subjectUserId: uuidOrNull(identity.subjectUserId),
    outletId: uuidOrNull(input.outletId),
    outletName: trimOrNull(input.outletName),
    qrIdentifier,
    vpa,
    qrPayload: trimOrNull(input.qrPayload),
    qrImageUrl: trimOrNull(input.qrImageUrl),
    mode: input.mode || "TEST",
    isActive: true,
    label: trimOrNull(input.label),
    maxPerCreditAmount: decimalOrNull(input.maxPerCreditAmount),
    maxPerDayAmount: decimalOrNull(input.maxPerDayAmount),
    maxPerDayCount: Number.isInteger(input.maxPerDayCount)
      ? input.maxPerDayCount
      : null,
    provisionedAt: new Date(),
    provisionedBy: actorId,
    metadata:
      input.metadata && typeof input.metadata === "object"
        ? input.metadata
        : undefined,
    createdBy: actorId,
    updatedBy: actorId,
  };

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const row = await tx.outletPaymentQr.create({ data });

      await tx.auditLog.create({
        data: auditData({
          action: AUDIT_ACTIONS.OUTLET_QR_CREATED,
          resourceId: row.id,
          userId: actorId,
          ip,
          userAgent,
          details: {
            provider: row.provider,
            walletUserId: row.walletUserId,
            clientCode: row.clientCode,
            qrIdentifier: row.qrIdentifier,
            vpa: row.vpa,
            mode: row.mode,
            outletId: row.outletId,
            label: row.label,
          },
        }),
      });

      return row;
    });
  } catch (error) {
    throw mapUniqueViolation(error, { provider, qrIdentifier, vpa, identity });
  }

  logger.info("Outlet QR provisioned", {
    id: created.id,
    provider: created.provider,
    walletUserId: created.walletUserId,
    mode: created.mode,
    actorId,
  });

  return serializeQrCode(created);
}

/* ------------------------------------------------------------------ *
 * Read
 * ------------------------------------------------------------------ */

/**
 * List QR rows with filters + pagination.
 *
 * @param {Object} args
 * @param {Object} args.query validated `qrCodeListQuerySchema`
 * @returns {Promise<Object>} the list envelope (see `buildListEnvelope`)
 */
async function listQrCodes({ query } = {}) {
  const q = query || {};

  const page = Math.max(0, Number(q.page ?? 0) || 0);
  const size = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(q.size ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE),
  );
  const sortDir = q.sortDir === "asc" ? "asc" : "desc";

  const { where, filters } = buildListWhere(q);

  const [total, rows] = await Promise.all([
    prisma.outletPaymentQr.count({ where }),
    prisma.outletPaymentQr.findMany({
      where,
      orderBy: { createdAt: sortDir },
      skip: page * size,
      take: size,
    }),
  ]);

  return buildListEnvelope(rows, total, page, size, {
    ...filters,
    sortDir,
  });
}

/**
 * The outlet's OWN QR — identity comes from the JWT, NEVER from a query param.
 *
 * A `?walletUserId=` here would be a horizontal-privilege hole: any outlet
 * could read (and render, and print) another outlet's QR payload and start
 * collecting money into someone else's wallet. `resolveForSelf` is therefore
 * the only source of identity on this path.
 *
 * @param {Object} args
 * @param {Object} args.user `req.user`
 * @returns {Promise<Object>} `serializeQrCode` projection
 * @throws {ValidationError} WALLET_IDENTITY_UNAVAILABLE (no phone on the account)
 * @throws {NotFoundError} QR_NOT_PROVISIONED when the outlet has no active QR
 */
async function getMyQrCode({ user } = {}) {
  const identity = resolveForSelf(user);

  const row = await findActiveByWallet({
    walletUserId: identity.walletUserId,
    clientCode: identity.clientCode,
  });

  if (!row) {
    const error = new NotFoundError(
      "No active payment QR has been issued for your outlet yet. Ask an administrator to provision one.",
    );
    error.code = "QR_NOT_PROVISIONED";
    error.details = {
      walletUserId: identity.walletUserId,
      clientCode: identity.clientCode,
    };
    throw error;
  }

  return serializeQrCode(row);
}

/**
 * The ACTIVE QR for one wallet identity, or null.
 *
 * Exported because the manual-collection path needs it: an operator keying a
 * payment in by hand often knows the outlet but not the QR string, and the
 * QR identifier is what `qrCollectionService.ingestCollection` matches on.
 * Resolving it HERE keeps that lookup in the service layer.
 *
 * @param {Object} args
 * @param {string} args.walletUserId external wallet id (phone for outlets)
 * @param {string} [args.clientCode]
 * @param {string} [args.provider]
 * @returns {Promise<?Object>} the raw row, or null
 */
async function resolveQrForWallet({ walletUserId, clientCode, provider } = {}) {
  const wallet = trimOrNull(walletUserId);
  if (!wallet) return null;

  return findActiveByWallet({
    walletUserId: wallet,
    clientCode: normalizeClientCode(clientCode),
    provider,
  });
}

/** @private */
async function findActiveByWallet({ walletUserId, clientCode, provider }) {
  return prisma.outletPaymentQr.findFirst({
    where: {
      provider: normalizeProvider(provider),
      walletUserId,
      clientCode: normalizeClientCode(clientCode),
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

/* ------------------------------------------------------------------ *
 * Update
 * ------------------------------------------------------------------ */

/**
 * Patch the MUTABLE subset of a QR row.
 *
 * @param {Object} args
 * @param {string} args.id
 * @param {Object} args.patch validated `updateQrCodeSchema` body
 * @param {Object} args.actor `req.user`
 * @param {?string} [args.ip]
 * @param {?string} [args.userAgent]
 * @returns {Promise<Object>} `serializeQrCode` projection
 * @throws {ValidationError} QR_REPOINT_FORBIDDEN when identity is in the patch
 * @throws {NotFoundError} QR_NOT_FOUND
 * @throws {ConflictError} QR_IDENTIFIER_ALREADY_ACTIVE
 */
async function updateQrCode({ id, patch, actor, ip, userAgent } = {}) {
  const body = patch || {};

  assertNoRepoint(body);

  const existing = await prisma.outletPaymentQr.findUnique({ where: { id } });
  if (!existing) {
    const error = new NotFoundError("Payment QR not found");
    error.code = "QR_NOT_FOUND";
    error.details = { id };
    throw error;
  }

  const actorId = uuidOrNull(actor && actor.id);
  const data = {};
  const changes = {};

  for (const field of MUTABLE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;

    const next = normalizeMutableValue(field, body[field]);
    const before = existing[field];

    if (sameValue(before, next)) continue;

    data[field] = next;
    changes[field] = { from: toPlain(before), to: toPlain(next) };
  }

  if (Object.keys(data).length === 0) {
    // Nothing material changed — do NOT write an audit line saying a QR was
    // updated when it was not. Audit noise is how real changes get missed.
    return serializeQrCode(existing);
  }

  const modeChanged = Object.prototype.hasOwnProperty.call(data, "mode");
  data.updatedBy = actorId;

  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      const row = await tx.outletPaymentQr.update({ where: { id }, data });

      await tx.auditLog.create({
        data: auditData({
          action: AUDIT_ACTIONS.OUTLET_QR_UPDATED,
          resourceId: row.id,
          userId: actorId,
          ip,
          userAgent,
          details: {
            provider: row.provider,
            walletUserId: row.walletUserId,
            qrIdentifier: row.qrIdentifier,
            changes,
          },
        }),
      });

      if (modeChanged) {
        // A SEPARATE audit line, deliberately. `mode` decides whether payments
        // on this QR credit REAL money (LIVE) or are simulated (TEST); a
        // reviewer must be able to find every mode flip by action alone,
        // without grepping inside a generic update's `changes` blob.
        await tx.auditLog.create({
          data: auditData({
            action: AUDIT_ACTIONS.OUTLET_QR_MODE_CHANGED,
            resourceId: row.id,
            userId: actorId,
            ip,
            userAgent,
            details: {
              provider: row.provider,
              walletUserId: row.walletUserId,
              qrIdentifier: row.qrIdentifier,
              from: existing.mode,
              to: row.mode,
            },
          }),
        });
      }

      return row;
    });
  } catch (error) {
    throw mapUniqueViolation(error, {
      provider: existing.provider,
      qrIdentifier: existing.qrIdentifier,
      vpa: existing.vpa,
      identity: {
        walletUserId: existing.walletUserId,
        clientCode: existing.clientCode,
      },
    });
  }

  if (modeChanged) {
    logger.warn("Outlet QR MODE CHANGED", {
      id: updated.id,
      from: existing.mode,
      to: updated.mode,
      walletUserId: updated.walletUserId,
      actorId,
    });
  }

  return serializeQrCode(updated);
}

/**
 * Retire a QR. This is HALF of the repointing procedure (deactivate, then
 * issue a new row) and the only way `isActive` ever becomes false.
 *
 * Idempotent: deactivating an already-inactive QR is a no-op that returns the
 * row, not a 409 — an operator clicking twice has not made a mistake, and a
 * second audit line would falsely claim a second retirement.
 *
 * @param {Object} args
 * @param {string} args.id
 * @param {Object} args.actor `req.user`
 * @param {?string} [args.ip]
 * @param {?string} [args.userAgent]
 * @returns {Promise<Object>} `serializeQrCode` projection
 * @throws {NotFoundError} QR_NOT_FOUND
 */
async function deactivateQrCode({ id, actor, ip, userAgent } = {}) {
  const existing = await prisma.outletPaymentQr.findUnique({ where: { id } });
  if (!existing) {
    const error = new NotFoundError("Payment QR not found");
    error.code = "QR_NOT_FOUND";
    error.details = { id };
    throw error;
  }

  if (!existing.isActive) {
    logger.info("Outlet QR already inactive — deactivate is a no-op", { id });
    return serializeQrCode(existing);
  }

  const actorId = uuidOrNull(actor && actor.id);

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.outletPaymentQr.update({
      where: { id },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: actorId,
        updatedBy: actorId,
      },
    });

    await tx.auditLog.create({
      data: auditData({
        action: AUDIT_ACTIONS.OUTLET_QR_DEACTIVATED,
        resourceId: row.id,
        userId: actorId,
        ip,
        userAgent,
        details: {
          provider: row.provider,
          walletUserId: row.walletUserId,
          clientCode: row.clientCode,
          qrIdentifier: row.qrIdentifier,
          vpa: row.vpa,
          mode: row.mode,
        },
      }),
    });

    return row;
  });

  // Loud on purpose: the printed sticker is still on the counter. Payments will
  // keep arriving on this identifier and will now land UNATTRIBUTED
  // (`INACTIVE_QR`) until a replacement row exists.
  logger.warn(
    "Outlet QR DEACTIVATED — printed codes still in circulation will land unattributed",
    {
      id: updated.id,
      provider: updated.provider,
      qrIdentifier: updated.qrIdentifier,
      walletUserId: updated.walletUserId,
      actorId,
    },
  );

  return serializeQrCode(updated);
}

/* ------------------------------------------------------------------ *
 * Serialization
 * ------------------------------------------------------------------ */

/**
 * API projection of a QR row.
 *
 * `providerData` IS DELIBERATELY WITHHELD: it is the gateway's verbatim
 * provisioning response and can carry merchant-side credentials and internal
 * identifiers. It stays in the database for reconciliation.
 *
 * `qrPayload` / `qrImageUrl` ARE exposed — the outlet has to render its own QR,
 * and both are public by construction (the payload is what a payer scans).
 *
 * @param {?Object} row
 * @returns {?Object}
 */
function serializeQrCode(row) {
  if (!row) return null;

  return {
    id: row.id,
    provider: row.provider,
    walletUserId: row.walletUserId,
    clientCode: row.clientCode,
    subjectUserId: row.subjectUserId ?? null,
    outletId: row.outletId ?? null,
    outletName: row.outletName ?? null,
    qrIdentifier: row.qrIdentifier ?? null,
    vpa: row.vpa ?? null,
    qrPayload: row.qrPayload ?? null,
    qrImageUrl: row.qrImageUrl ?? null,
    mode: row.mode,
    isActive: Boolean(row.isActive),
    label: row.label ?? null,
    maxPerCreditAmount: toNumber(row.maxPerCreditAmount),
    maxPerDayAmount: toNumber(row.maxPerDayAmount),
    maxPerDayCount: row.maxPerDayCount ?? null,
    provisionedAt: row.provisionedAt ?? null,
    provisionedBy: row.provisionedBy ?? null,
    deactivatedAt: row.deactivatedAt ?? null,
    deactivatedBy: row.deactivatedBy ?? null,
    metadata: row.metadata ?? null,
    createdBy: row.createdBy ?? null,
    updatedBy: row.updatedBy ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    // providerData intentionally omitted — see the JSDoc above.
  };
}

/* ------------------------------------------------------------------ *
 * Internals
 * ------------------------------------------------------------------ */

/**
 * THE REPOINT GUARD. See the file header for why this is a hard refusal rather
 * than a silently-ignored field.
 * @private
 */
function assertNoRepoint(body) {
  const offending = ["walletUserId", "clientCode", "subjectUserId"].filter(
    (field) => Object.prototype.hasOwnProperty.call(body, field),
  );

  if (offending.length === 0) return;

  throw validationError(
    "A payment QR can never be repointed to a different outlet. Deactivate this QR and issue a new one instead, so past collections keep pointing at the outlet that actually received the money.",
    "QR_REPOINT_FORBIDDEN",
    { immutableFields: offending },
  );
}

/**
 * Map a Prisma P2002 on any of the three PARTIAL unique indexes to a 409 that
 * names the key that collided. Anything else is re-thrown untouched.
 * @private
 */
function mapUniqueViolation(error, context) {
  if (!error || error.code !== "P2002") return error;

  const target = describeTarget(error);
  const matched = UNIQUE_CONSTRAINTS.find((c) => target.includes(c.match));

  const conflict = new ConflictError(
    matched
      ? matched.message
      : "Another ACTIVE QR already claims one of this QR's unique keys. Deactivate it before issuing a new one.",
  );
  conflict.code = "QR_IDENTIFIER_ALREADY_ACTIVE";
  conflict.details = {
    conflictingKey: matched ? matched.key : target || "unknown",
    constraint: target || null,
    provider: context.provider ?? null,
    qrIdentifier: context.qrIdentifier ?? null,
    vpa: context.vpa ?? null,
    walletUserId: context.identity ? context.identity.walletUserId : null,
    clientCode: context.identity ? context.identity.clientCode : null,
  };

  logger.warn("Outlet QR uniqueness violated", {
    conflictingKey: conflict.details.conflictingKey,
    provider: conflict.details.provider,
    qrIdentifier: conflict.details.qrIdentifier,
  });

  return conflict;
}

/**
 * `P2002.meta.target` is a constraint NAME string for raw-SQL partial indexes
 * and an array of column names for Prisma-declared ones. Flatten both.
 * @private
 */
function describeTarget(error) {
  const target = error.meta && error.meta.target;
  if (!target) return "";
  return Array.isArray(target) ? target.join(",") : String(target);
}

/** @private */
function buildListWhere(query) {
  const where = {};

  if (query.provider) where.provider = normalizeProvider(query.provider);
  if (query.walletUserId)
    where.walletUserId = String(query.walletUserId).trim();
  if (query.clientCode)
    where.clientCode = normalizeClientCode(query.clientCode);
  if (query.outletId) where.outletId = query.outletId;
  if (query.qrIdentifier)
    where.qrIdentifier = String(query.qrIdentifier).trim();
  if (query.vpa) where.vpa = String(query.vpa).trim();
  if (query.mode) where.mode = query.mode;
  if (typeof query.isActive === "boolean") where.isActive = query.isActive;

  return {
    where,
    filters: {
      provider: query.provider ? normalizeProvider(query.provider) : null,
      walletUserId: query.walletUserId ?? null,
      clientCode: query.clientCode
        ? normalizeClientCode(query.clientCode)
        : null,
      outletId: query.outletId ?? null,
      qrIdentifier: query.qrIdentifier ?? null,
      vpa: query.vpa ?? null,
      mode: query.mode ?? null,
      isActive: typeof query.isActive === "boolean" ? query.isActive : null,
    },
  };
}

/**
 * THE LIST ENVELOPE IS A HARD CONTRACT.
 *
 * The frontend's RTK Query slice unwraps `response.data`, so anything placed in
 * `meta` — exactly where `APIResponse.paginated()` puts pagination — is
 * DISCARDED and the table renders with no page count. Pagination therefore
 * rides INSIDE the payload, snake_case, with a 0-BASED `current_page`.
 * Identical to `qrCollectionService.buildListEnvelope` and
 * `manualTopupService.buildListEnvelope`. Do not "tidy" this into
 * `APIResponse.paginated()`.
 * @private
 */
function buildListEnvelope(rows, total, page, size, filters) {
  const totalPages = size > 0 ? Math.ceil(total / size) : 0;

  return {
    data: rows.map(serializeQrCode),
    pagination: {
      total_elements: total,
      has_previous: page > 0,
      has_next: (page + 1) * size < total,
      total_pages: totalPages,
      current_page: page,
      page_size: size,
    },
    success: true,
    filters,
  };
}

/** @private */
function auditData({ action, resourceId, userId, details, ip, userAgent }) {
  return {
    // AuditLog.userId is @db.Uuid — only a LOCAL portal uuid may go here.
    // `walletUserId` is a phone number and belongs in `details`.
    userId: uuidOrNull(userId),
    action,
    resource: AUDIT_RESOURCE,
    resourceId: uuidOrNull(resourceId),
    details: details || {},
    ipAddress: ip ? String(ip).slice(0, 45) : null,
    userAgent: userAgent ? String(userAgent) : null,
  };
}

/** @private */
function normalizeMutableValue(field, value) {
  if (value === null) return null;
  if (DECIMAL_FIELDS.has(field)) return decimalOrNull(value);
  if (field === "maxPerDayCount") {
    return Number.isInteger(value) ? value : null;
  }
  if (field === "mode") return value;
  return trimOrNull(value);
}

/** @private */
function sameValue(before, next) {
  const a = toPlain(before);
  const b = toPlain(next);
  if (a === null && b === null) return true;
  return a === b;
}

/**
 * Decimal/Date/primitive -> a comparable, JSON-safe plain value.
 * @private
 */
function toPlain(value) {
  if (value === null || value === undefined) return null;
  if (
    typeof value === "object" &&
    typeof value.toString === "function" &&
    typeof value.toNumber === "function"
  ) {
    return value.toString();
  }
  if (value instanceof Date) return value.toISOString();
  return typeof value === "number" ? String(value) : value;
}

/**
 * Money for a `Decimal` column, as a STRING — never a float. `Number.toFixed(2)`
 * on a Joi-validated (already 2dp) rupee value is exact.
 * @private
 */
function decimalOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num.toFixed(2);
}

/** @private */
function normalizeProvider(provider) {
  return typeof provider === "string" && provider.trim()
    ? provider.trim()
    : DEFAULT_PROVIDER;
}

/** @private */
function trimOrNull(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** @private */
function toNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value.toNumber === "function") return value.toNumber();
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** @private */
function uuidOrNull(value) {
  return typeof value === "string" && UUID_RE.test(value) ? value : null;
}

/** @private */
function validationError(message, code, details) {
  const err = new ValidationError(message, details || null);
  err.code = code;
  return err;
}

module.exports = {
  createQrCode,
  listQrCodes,
  getMyQrCode,
  resolveQrForWallet,
  updateQrCode,
  deactivateQrCode,
  serializeQrCode,
  AUDIT_ACTIONS,
  AUDIT_RESOURCE,
  MUTABLE_FIELDS,
  DEFAULT_PROVIDER,
};
