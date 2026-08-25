/**
 * Wallet Top-up Service — Wave 3.2 (gateway-funded top-ups).
 *
 * WHAT THIS MODULE IS
 * -------------------
 * The ORCHESTRATION layer for money that arrives through a payment gateway:
 *
 *   - `initiateSelfTopup`      a logged-in user funds THEIR OWN wallet
 *   - `verifyClientCallback`   the browser reports "checkout succeeded"
 *   - `createAdminPaymentLink` an admin raises a link for SOMEONE ELSE
 *   - `listOrders` / `getOrder` / `getOrderWithLiveStatus`
 *   - `refreshFromProvider`    pull the gateway's view of an open order
 *   - `cancelAdminPaymentLink` kill an unpaid link
 *
 * WHAT THIS MODULE IS NOT
 * -----------------------
 * It is NOT a crediting implementation. `webhookService.creditOrder()` is the
 * ONLY code in this service that moves money, and every path here that
 * discovers a capture delegates to it. `externalWalletClient.topup` is
 * deliberately never required in this file — if you find yourself reaching for
 * it, you are about to build a second, subtly different idempotency story and
 * double-credit somebody. Route it through `creditOrder` instead.
 *
 * THE INVARIANTS THIS MODULE OWNS
 * -------------------------------
 *   T1. IDENTITY COMES FROM THE JWT ON SELF ROUTES. `initiateSelfTopup` and
 *       `verifyClientCallback` derive the wallet identity from `req.user` via
 *       `walletIdentity.resolveForSelf`. A `userId` / `walletUserId` in the
 *       request body is ignored outright — honouring it would let any
 *       authenticated user top up (or read) an arbitrary wallet.
 *   T2. MODE IS SNAPSHOTTED AT CREATION. `mode`/`isTest` are copied from the
 *       config that minted the order, so flipping TEST<->LIVE later cannot
 *       mis-route an in-flight order.
 *   T3. PAISE ARE THE UNIT. `amountPaise` is computed exactly once, at
 *       creation, with `Math.round(amount * 100)`, and both representations are
 *       stored. Nothing downstream ever re-derives paise from float rupees.
 *   T4. GATEWAY `notes` ARE LOAD-BEARING. Every order and link carries
 *       `{ walletUserId, clientCode, subjectUserId, kind }`.
 *       `webhookService.adoptOrphanPayment` reconstructs a lost local row from
 *       exactly those keys — dropping them turns a recoverable crash into
 *       unrecoverable money.
 *   T5. EVERY WRITE CARRIES AN AUDIT ROW, in the SAME `$transaction` as the
 *       state change wherever a transaction is possible.
 *   T6. NETWORK CALLS NEVER HAPPEN INSIDE A `$transaction`. A gateway
 *       round-trip inside a transaction pins a connection and a row lock for
 *       an unbounded remote timeout.
 *
 * @module services/payments/topupService
 */

const crypto = require("crypto");

const { prisma } = require("../../config/database");
const {
  APIError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} = require("../../shared/lib/errors");
const logger = require("../../shared/lib/logger");

const { getProvider } = require("./index");
const {
  resolveActiveConfig,
  resolveConfigForMode,
} = require("./providerConfigService");
const { creditOrder } = require("./webhookService");
const {
  resolveForSelf,
  resolveForAdmin,
  normalizeClientCode,
} = require("./walletIdentity");

const RESOURCE = "PaymentOrder";
const DEFAULT_PROVIDER = "razorpay";

/** Statuses that still expect gateway activity. */
const OPEN_STATUSES = ["CREATED", "PENDING"];

/** Statuses a link may be cancelled FROM (guarded transition). */
const CANCELLABLE_FROM = ["CREATED", "PENDING"];

/** Statuses an order may be locally expired FROM (guarded transition). */
const EXPIRABLE_FROM = ["CREATED", "PENDING"];

/**
 * Window for BOTH the open-order throttle and idempotency-key replay.
 * They share a window on purpose: an idempotent retry must be able to find the
 * order that is still counting against the throttle, otherwise the retry would
 * be rejected as "too many open orders" instead of returning the original.
 */
const OPEN_ORDER_WINDOW_MS = 15 * 60 * 1000;

/** A row older than this is considered stale enough to re-poll the gateway. */
const LIVE_STATUS_STALE_MS = 60 * 1000;

/** Razorpay refuses `expire_by` beyond 30 days; cap defensively at 720h. */
const MAX_LINK_EXPIRY_HOURS = 720;

/** Razorpay caps `receipt` at 40 chars. */
const MAX_RECEIPT_LENGTH = 40;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/**
 * Build an APIError with an explicit machine code and optional details.
 * (`ValidationError` hard-codes code VALIDATION_ERROR, which the frontend
 * cannot branch on — these flows need distinguishable codes.)
 * @private
 */
function fail(message, statusCode, code, details = null) {
  const error = new APIError(message, statusCode, code);
  if (details) error.details = details;
  return error;
}

/** Prisma Decimal -> JS number, for responses and audit payloads only. @private */
function toNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value.toNumber === "function") return value.toNumber();
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** AuditLog.userId is @db.Uuid — a phone number must never be written there. @private */
function asUuidOrNull(value) {
  return typeof value === "string" && UUID_RE.test(value) ? value : null;
}

/** @private */
function shortId(bytes = 6) {
  return crypto.randomBytes(bytes).toString("hex").toUpperCase();
}

/**
 * Best-effort audit row for paths that cannot share a transaction with their
 * state change (e.g. a guarded `updateMany` whose outcome decides whether an
 * audit row is even warranted). A failed audit write must never take down a
 * money flow, but it must always be shouted about.
 * @private
 */
async function writeAudit({
  action,
  resourceId,
  userId,
  details,
  ip,
  userAgent,
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: asUuidOrNull(userId),
        action,
        resource: RESOURCE,
        resourceId: resourceId || null,
        details: details || {},
        ipAddress: ip || null,
        userAgent: userAgent || null,
      },
    });
  } catch (error) {
    logger.error("AUDIT WRITE FAILED for payment order", {
      action,
      resourceId,
      error: error.message,
    });
  }
}

/** The audit row as a `$transaction`-composable Prisma promise (T5). @private */
function auditCreate({ action, resourceId, userId, details, ip, userAgent }) {
  return prisma.auditLog.create({
    data: {
      userId: asUuidOrNull(userId),
      action,
      resource: RESOURCE,
      resourceId: resourceId || null,
      details: details || {},
      ipAddress: ip || null,
      userAgent: userAgent || null,
    },
  });
}

// ---------------------------------------------------------------------------
// uiStatus projection
// ---------------------------------------------------------------------------

/**
 * Collapse the 10-value `PaymentOrderStatus` enum into the 3 values the
 * frontend status chip actually renders.
 *
 * WHY SERVER-SIDE: the mapping is a business rule (RECONCILE_PENDING is money
 * the customer HAS paid and must read as PAID, not as an error), and three
 * different surfaces render this chip. Computed in one place, it cannot drift.
 * The raw `status` is kept in the payload alongside it for admin tooling.
 *
 *   PENDING <- CREATED | PENDING
 *   PAID    <- PAID | CREDITED | RECONCILE_PENDING   (+ needsAttention flag)
 *   EXPIRED <- EXPIRED | CANCELLED | FAILED
 *
 * REFUNDED is money that came and went; it is shown as PAID with
 * `needsAttention` left alone, since the refund itself is the record.
 *
 * @param {Object} order
 * @returns {{uiStatus: string, needsAttention: boolean}}
 */
function projectUiStatus(order) {
  const status = order?.status;

  let uiStatus;
  switch (status) {
    case "CREATED":
    case "PENDING":
      uiStatus = "PENDING";
      break;
    case "PAID":
    case "CREDITED":
    case "RECONCILE_PENDING":
    case "REFUNDED":
      uiStatus = "PAID";
      break;
    case "EXPIRED":
    case "CANCELLED":
    case "FAILED":
      uiStatus = "EXPIRED";
      break;
    default:
      uiStatus = "PENDING";
  }

  return {
    uiStatus,
    needsAttention:
      status === "RECONCILE_PENDING" || order?.needsManualAction === true,
  };
}

/**
 * The single row projection returned by EVERY export in this module.
 * Secrets (key secret, webhook secret) never appear here; `gatewayData` is
 * withheld from the default projection because it holds raw gateway payloads.
 *
 * @param {Object} order Prisma PaymentOrder row
 * @returns {Object}
 */
function serializeOrder(order) {
  if (!order) return null;

  const { uiStatus, needsAttention } = projectUiStatus(order);

  return {
    orderId: order.id,
    kind: order.kind,
    provider: order.provider,
    mode: order.mode,
    isTest: order.isTest,

    walletUserId: order.walletUserId,
    clientCode: order.clientCode,
    subjectUserId: order.subjectUserId,

    payerName: order.payerName,
    payerEmail: order.payerEmail,
    payerPhone: order.payerPhone,

    amount: toNumber(order.amount),
    amountPaise: order.amountPaise,
    currency: order.currency,

    status: order.status,
    uiStatus,
    needsAttention,

    providerOrderId: order.providerOrderId,
    providerLinkId: order.providerLinkId,
    providerPaymentId: order.providerPaymentId,
    shortUrl: order.shortUrl,
    expiresAt: order.expiresAt,

    externalReferenceId: order.externalReferenceId,
    externalTransactionId: order.externalTransactionId,
    creditedAt: order.creditedAt,

    reconcileAttempts: order.reconcileAttempts,
    lastReconcileAt: order.lastReconcileAt,
    nextRetryAt: order.nextRetryAt,
    reconcileError: order.reconcileError,
    needsManualAction: order.needsManualAction,

    refundedAmount: toNumber(order.refundedAmount),

    notes: order.notes,
    createdBy: order.createdBy,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Scope & ownership
// ---------------------------------------------------------------------------

/**
 * Does this order belong to the authenticated caller?
 *
 * Two accepted proofs because the two identities are genuinely separate
 * namespaces (see walletIdentity.js): the LOCAL uuid (`subjectUserId`) and the
 * EXTERNAL wallet key (`walletUserId`, a phone). An admin-created link for a
 * user carries the phone but may have a null `subjectUserId`, so matching on
 * either is required for the user to see their own link.
 *
 * @private
 */
function ownsOrder(order, user) {
  if (!order || !user) return false;

  if (user.id && order.subjectUserId && order.subjectUserId === user.id) {
    return true;
  }

  const phone = typeof user.phone === "string" ? user.phone.trim() : "";
  return Boolean(phone) && order.walletUserId === phone;
}

/**
 * Throw unless the caller may see this order under `scope`.
 * `scope: "admin"` is only ever passed by a route already gated on
 * `wallet:manage:all`, so it is an unconditional pass here.
 * @private
 */
function assertReadable(order, actor, scope) {
  if (scope === "admin") return;

  if (!ownsOrder(order, actor)) {
    // Deliberately 403 and not 404: the caller supplied a real id they are not
    // entitled to. There is no enumeration risk worth hiding here — order ids
    // are v4 UUIDs.
    throw new AuthorizationError(
      "You are not allowed to access this payment order",
    );
  }
}

// ---------------------------------------------------------------------------
// Amount handling
// ---------------------------------------------------------------------------

/**
 * Validate the rupee amount against the provider's configured band and convert
 * to integer paise ONCE (T3).
 *
 * @param {*} amount
 * @param {Object} config resolved provider config
 * @returns {{amount: number, amountPaise: number}}
 * @private
 */
function resolveAmount(amount, config) {
  const rupees = Number(amount);

  if (!Number.isFinite(rupees) || rupees <= 0) {
    throw fail(
      "amount must be a positive number of rupees",
      400,
      "AMOUNT_OUT_OF_RANGE",
      { min: config?.minAmount ?? null, max: config?.maxAmount ?? null },
    );
  }

  const min = Number.isFinite(Number(config?.minAmount))
    ? Number(config.minAmount)
    : null;
  const max = Number.isFinite(Number(config?.maxAmount))
    ? Number(config.maxAmount)
    : null;

  if ((min !== null && rupees < min) || (max !== null && rupees > max)) {
    throw fail(
      `Top-up amount must be between ₹${min ?? 0} and ₹${max ?? "∞"}`,
      400,
      "AMOUNT_OUT_OF_RANGE",
      { min, max },
    );
  }

  // Rounded exactly once. `amountPaise` is the authoritative figure from here
  // on — webhookService compares captures against it in integer paise.
  const amountPaise = Math.round(rupees * 100);

  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    throw fail(
      "amount could not be converted to integer paise",
      400,
      "AMOUNT_OUT_OF_RANGE",
      { min, max },
    );
  }

  // Store rupees derived FROM paise so the two columns can never disagree by a
  // floating-point hair (e.g. 100.005 -> 10001 paise -> 100.01).
  return { amount: amountPaise / 100, amountPaise };
}

// ---------------------------------------------------------------------------
// Throttle & idempotency
// ---------------------------------------------------------------------------

/** @private */
function maxOpenOrders() {
  const parsed = Number(process.env.TOPUP_MAX_OPEN_ORDERS);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 3;
}

/**
 * Refuse to mint an unbounded number of live gateway orders for one wallet.
 *
 * WHY: every `orders.create` is a real object at Razorpay. A user hammering the
 * "Add money" button (or a script) would otherwise leave dozens of open orders
 * behind, each one a live payable object, and each one a row the reconcile
 * worker has to poll. Only orders NEWER than the window count, so an
 * abandoned checkout self-heals after 15 minutes with no cleanup job.
 *
 * @private
 */
async function assertOpenOrderBudget(identity) {
  const limit = maxOpenOrders();

  const openCount = await prisma.paymentOrder.count({
    where: {
      walletUserId: identity.walletUserId,
      clientCode: identity.clientCode,
      status: { in: OPEN_STATUSES },
      createdAt: { gte: new Date(Date.now() - OPEN_ORDER_WINDOW_MS) },
    },
  });

  if (openCount >= limit) {
    throw fail(
      `You already have ${openCount} payment(s) awaiting completion. Finish or abandon them before starting another.`,
      429,
      "TOO_MANY_OPEN_ORDERS",
      { openCount, limit, windowMinutes: OPEN_ORDER_WINDOW_MS / 60000 },
    );
  }
}

/**
 * Find an existing order for this caller's idempotency key.
 *
 * WHERE THE KEY LIVES — a deliberate choice: `PaymentOrder` has no dedicated
 * idempotency column, and adding one is a migration that Wave 3.2 does not own.
 * The key is therefore written to BOTH:
 *   - `gatewayData.idempotencyKey` — the queryable copy. Postgres JSONB
 *     supports Prisma's `path`/`equals` filter, so this is a real lookup, not a
 *     table scan of parsed JSON in Node.
 *   - `notes` — the human-readable copy an operator reads in the admin table.
 * The match is deliberately narrow (same wallet + key + amount + status
 * CREATED + inside the window) so a reused key with a DIFFERENT amount falls
 * through and mints a new order rather than silently charging the old figure.
 *
 * @private
 */
async function findIdempotentOrder(identity, idempotencyKey, amountPaise) {
  if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
    return null;
  }

  return prisma.paymentOrder.findFirst({
    where: {
      kind: "SELF_SERVE",
      walletUserId: identity.walletUserId,
      clientCode: identity.clientCode,
      amountPaise,
      status: "CREATED",
      createdAt: { gte: new Date(Date.now() - OPEN_ORDER_WINDOW_MS) },
      gatewayData: {
        path: ["idempotencyKey"],
        equals: idempotencyKey.trim(),
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// initiateSelfTopup
// ---------------------------------------------------------------------------

/**
 * Start a self-serve wallet top-up: create a gateway order and return
 * everything the browser Checkout widget needs.
 *
 * NO MONEY MOVES HERE. This only mints a payable object at the gateway; the
 * wallet is credited later by the webhook (or by `verifyClientCallback` as a
 * fast path), both of which funnel into `webhookService.creditOrder`.
 *
 * @param {Object} args
 * @param {Object} args.user            req.user (the JWT — the ONLY identity source)
 * @param {number} args.amount          rupees
 * @param {string} [args.currency]
 * @param {string} [args.provider="razorpay"]
 * @param {string} [args.idempotencyKey]
 * @param {Object} [args.metadata]
 * @param {string} [args.ip]
 * @param {string} [args.userAgent]
 * @returns {Promise<{orderId: string, providerOrderId: string, provider: string,
 *   mode: string, keyId: string, amount: number, amountPaise: number,
 *   currency: string, status: string, isTest: boolean, reused: boolean,
 *   checkoutParams: Object, prefill: {name: string|null, email: string|null, contact: string|null},
 *   order: Object}>}
 */
async function initiateSelfTopup({
  user,
  amount,
  currency,
  provider = DEFAULT_PROVIDER,
  idempotencyKey,
  metadata,
  ip,
  userAgent,
} = {}) {
  // ---- 1. IDENTITY FROM THE JWT ONLY (T1) --------------------------------
  // Note what is NOT read here: `body.userId`, `body.walletUserId`,
  // `body.subjectUserId`, `body.clientCode`. A client-supplied identity on a
  // self-serve route is ignored outright — accepting it would let any
  // authenticated user push money into (and later read) an arbitrary wallet.
  // The admin path (`createAdminPaymentLink`) is where a body-supplied
  // identity is legitimate, and that route is gated on `wallet:manage:all`.
  const identity = resolveForSelf(user);

  // ---- 2. PROVIDER CONFIG (409 when disabled / not configured) -----------
  const config = await resolveActiveConfig(provider);

  // ---- 3. AMOUNT BAND + PAISE (T3) ---------------------------------------
  const { amount: rupees, amountPaise } = resolveAmount(amount, config);

  // ---- 4. IDEMPOTENT REPLAY BEFORE THE THROTTLE --------------------------
  // Order matters: a genuine retry (double-click, flaky network, client
  // auto-retry) must return the ORIGINAL order, not be rejected by the
  // throttle that the original order itself is counting towards.
  const existing = await findIdempotentOrder(
    identity,
    idempotencyKey,
    amountPaise,
  );
  if (existing) {
    logger.info("Self top-up idempotency hit — returning the existing order", {
      orderId: existing.id,
      providerOrderId: existing.providerOrderId,
      walletUserId: identity.walletUserId,
    });

    return buildInitiateResponse(existing, config, user, { reused: true });
  }

  // ---- 5. OPEN-ORDER THROTTLE --------------------------------------------
  await assertOpenOrderBudget(identity);

  // ---- 6. CREATE AT THE GATEWAY (outside any transaction — T6) -----------
  const impl = getProvider(provider);
  const orderId = crypto.randomUUID();
  const receipt = `WLT-${shortId()}`.slice(0, MAX_RECEIPT_LENGTH);

  const created = await impl.createOrder({
    config,
    amountPaise,
    currency: currency || config.currency,
    receipt,
    // LOAD-BEARING (T4): webhookService.adoptOrphanPayment rebuilds a lost
    // local row from exactly these four keys. Never omit them, never rename
    // them without changing extractNotes()/adoptOrphanPayment() in lockstep.
    notes: {
      walletUserId: identity.walletUserId,
      clientCode: identity.clientCode,
      subjectUserId: identity.subjectUserId,
      kind: "SELF_SERVE",
    },
  });

  // ---- 7. PERSIST + AUDIT IN ONE TRANSACTION (T5) ------------------------
  // The row id is generated up front so the audit row in the SAME transaction
  // array can reference it — `$transaction([...])` cannot read the result of an
  // earlier statement.
  const trimmedKey =
    typeof idempotencyKey === "string" && idempotencyKey.trim()
      ? idempotencyKey.trim()
      : null;

  const [order] = await prisma.$transaction([
    prisma.paymentOrder.create({
      data: {
        id: orderId,
        kind: "SELF_SERVE",
        provider,
        // T2: snapshot the mode. A later TEST<->LIVE flip must not strand this.
        mode: config.mode,
        isTest: config.mode === "TEST",

        walletUserId: identity.walletUserId,
        clientCode: identity.clientCode,
        subjectUserId: identity.subjectUserId,

        payerName: user?.name || user?.fullName || null,
        payerEmail: user?.email || null,
        payerPhone: user?.phone || null,

        amount: rupees,
        amountPaise,
        currency: created.currency || currency || config.currency,

        status: "CREATED",
        providerOrderId: created.providerOrderId,

        notes: trimmedKey ? `idempotencyKey=${trimmedKey}` : null,
        gatewayData: {
          idempotencyKey: trimmedKey,
          receipt,
          createdVia: "SELF_SERVE_CHECKOUT",
          metadata: metadata || null,
          providerOrder: created.raw || null,
        },
        createdBy: asUuidOrNull(identity.subjectUserId),
      },
    }),
    auditCreate({
      action: "TOPUP_ORDER_CREATED",
      resourceId: orderId,
      userId: identity.subjectUserId,
      ip,
      userAgent,
      details: {
        kind: "SELF_SERVE",
        provider,
        mode: config.mode,
        isTest: config.mode === "TEST",
        amount: rupees,
        amountPaise,
        currency: created.currency || currency || config.currency,
        providerOrderId: created.providerOrderId,
        receipt,
        walletUserId: identity.walletUserId,
        clientCode: identity.clientCode,
        idempotencyKey: trimmedKey,
      },
    }),
  ]);

  logger.info("Self top-up order created", {
    orderId: order.id,
    providerOrderId: order.providerOrderId,
    provider,
    mode: config.mode,
    amountPaise,
  });

  return buildInitiateResponse(order, config, user, {
    reused: false,
    checkoutParams: created.checkoutParams,
  });
}

/**
 * Shared response shape for a fresh AND a replayed order, so the client cannot
 * tell the two apart except by the explicit `reused` flag.
 * @private
 */
function buildInitiateResponse(
  order,
  config,
  user,
  { reused, checkoutParams } = {},
) {
  return {
    orderId: order.id,
    providerOrderId: order.providerOrderId,
    provider: order.provider,
    mode: order.mode,
    // PUBLIC key id only. `config.keySecret` / `config.webhookSecret` must
    // never leave the server.
    keyId: config.keyId,
    amount: toNumber(order.amount),
    amountPaise: order.amountPaise,
    currency: order.currency,
    status: order.status,
    isTest: order.isTest,
    reused: Boolean(reused),
    checkoutParams: checkoutParams || {
      key: config.keyId,
      order_id: order.providerOrderId,
      amount: order.amountPaise,
      currency: order.currency,
    },
    prefill: {
      name: order.payerName || user?.name || user?.fullName || null,
      email: order.payerEmail || user?.email || null,
      contact: order.payerPhone || user?.phone || null,
    },
    order: serializeOrder(order),
  };
}

// ---------------------------------------------------------------------------
// verifyClientCallback
// ---------------------------------------------------------------------------

/**
 * The browser's "checkout handler fired" fast path.
 *
 * THIS IS A UX ACCELERATOR, NOT THE CREDIT AUTHORITY. The webhook remains the
 * authority; this exists so the user sees their new balance in ~1s instead of
 * waiting for Razorpay's webhook. It therefore does the SAME three things a
 * webhook does, in the same order, and then hands off:
 *
 *   signature check -> independent capture confirmation -> creditOrder()
 *
 * WHY A RACE WITH THE WEBHOOK CANNOT DOUBLE-CREDIT: this function never
 * credits. It delegates to `webhookService.creditOrder`, which is the single
 * crediting implementation, and which guards with (a) a `updateMany`
 * CREATED|PENDING|EXPIRED -> PAID claim that exactly ONE concurrent caller can
 * win, and (b) the deterministic external reference `RZP_<paymentId>`, on which
 * the external wallet API is unique — so even two processes that both somehow
 * won a claim would collide on that key and the second would get a 409, which
 * `creditOrder` correctly reads as "already landed". Both racers converge on
 * one credit.
 *
 * The browser payload is treated as a HINT throughout: the amount credited
 * comes from `order.amountPaise` and the gateway's own fetched payment, never
 * from anything the client posted.
 *
 * @param {Object} args
 * @param {Object} args.user
 * @param {string} args.orderId our PaymentOrder.id
 * @param {string} args.razorpay_order_id
 * @param {string} args.razorpay_payment_id
 * @param {string} args.razorpay_signature
 * @param {string} [args.ip]
 * @param {string} [args.userAgent]
 * @returns {Promise<{orderId: string, status: string, verified: true,
 *   credited: boolean, isTest: boolean, needsAttention: boolean,
 *   uiStatus: string, balanceAfter?: number, order: Object}>}
 */
async function verifyClientCallback({
  user,
  orderId,
  razorpay_order_id: razorpayOrderId,
  razorpay_payment_id: razorpayPaymentId,
  razorpay_signature: razorpaySignature,
  ip,
  userAgent,
} = {}) {
  // ---- 1. LOAD + OWNERSHIP ------------------------------------------------
  const order = await prisma.paymentOrder.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new NotFoundError("Payment order not found");
  }

  // Ownership from the JWT (T1). Without this, any authenticated user could
  // drive the credit path for another user's order.
  if (!ownsOrder(order, user)) {
    throw new AuthorizationError(
      "You are not allowed to verify this payment order",
    );
  }

  // The signed order id must be the one we minted for this row. A mismatch
  // means the client stitched a valid signature from a DIFFERENT payment onto
  // this order id — the signature would verify, but against the wrong order.
  if (
    razorpayOrderId &&
    order.providerOrderId &&
    razorpayOrderId !== order.providerOrderId
  ) {
    throw fail(
      "Payment signature does not belong to this order",
      400,
      "INVALID_PAYMENT_SIGNATURE",
    );
  }

  // ---- 2. SIGNATURE (against the order's SNAPSHOTTED mode) ----------------
  // `requireEnabled: false`: an admin may have disabled the provider while this
  // checkout was in flight. Refusing to verify then would strand a real,
  // already-captured payment. Disabling stops NEW orders, never in-flight ones.
  const config = await resolveConfigForMode(order.provider, order.mode, {
    requireEnabled: false,
  });
  const impl = getProvider(order.provider);

  const signatureOk = impl.verifyClientSignature({
    config,
    payload: {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
    },
  });

  if (!signatureOk) {
    // Mark NOTHING. A bad signature is an unauthenticated claim, and letting it
    // move the row (even to FAILED) would hand an attacker a way to cancel
    // someone else's in-flight payment.
    await writeAudit({
      action: "TOPUP_VERIFY_SIGNATURE_INVALID",
      resourceId: order.id,
      userId: order.subjectUserId,
      ip,
      userAgent,
      details: {
        provider: order.provider,
        providerOrderId: razorpayOrderId || null,
        providerPaymentId: razorpayPaymentId || null,
      },
    });

    logger.warn("Client payment signature verification failed", {
      orderId: order.id,
      providerOrderId: razorpayOrderId,
    });

    throw fail(
      "Payment signature verification failed",
      400,
      "INVALID_PAYMENT_SIGNATURE",
    );
  }

  // ---- 3. INDEPENDENT CAPTURE CONFIRMATION --------------------------------
  // A valid signature proves the payload came from Razorpay; it does NOT prove
  // the payment was captured (an authorized-but-failed payment still produces
  // a signed handler payload). Ask the gateway directly.
  const payment = await impl.fetchPayment({
    config,
    providerPaymentId: razorpayPaymentId,
  });

  if (!payment || payment.captured !== true || payment.status !== "captured") {
    logger.info("Client verify: payment is not captured — nothing to credit", {
      orderId: order.id,
      providerPaymentId: razorpayPaymentId,
      status: payment && payment.status,
    });

    const fresh = await prisma.paymentOrder.findUnique({
      where: { id: order.id },
    });
    const projection = projectUiStatus(fresh || order);

    return {
      orderId: order.id,
      status: (fresh || order).status,
      uiStatus: projection.uiStatus,
      needsAttention: projection.needsAttention,
      verified: true,
      credited: false,
      isTest: (fresh || order).isTest,
      providerPaymentStatus: (payment && payment.status) || null,
      order: serializeOrder(fresh || order),
    };
  }

  // ---- 4. DELEGATE — the ONE crediting implementation ---------------------
  // `parsed` is built from the GATEWAY's payment entity, never from the client
  // payload, so the amount check inside creditOrder compares our expectation
  // against Razorpay's own figure.
  const parsed = {
    providerPaymentId: payment.providerPaymentId,
    providerOrderId: payment.providerOrderId,
    amountPaise: payment.amountPaise,
    currency: payment.currency,
    capturedAt: payment.capturedAt,
    outcome: "PAID",
    raw: payment.raw,
  };

  const result = await creditOrder(order, parsed, {
    source: "CLIENT_VERIFY",
    verifiedMode: order.mode,
    config,
  });

  const fresh = await prisma.paymentOrder.findUnique({
    where: { id: order.id },
  });
  const finalRow = fresh || order;
  const projection = projectUiStatus(finalRow);

  await writeAudit({
    action: "TOPUP_CLIENT_VERIFIED",
    resourceId: order.id,
    userId: order.subjectUserId,
    ip,
    userAgent,
    details: {
      provider: order.provider,
      mode: order.mode,
      providerPaymentId: payment.providerPaymentId,
      handled: result.handled,
      credited: Boolean(result.credited),
      status: finalRow.status,
    },
  });

  return {
    orderId: order.id,
    status: finalRow.status,
    uiStatus: projection.uiStatus,
    needsAttention: projection.needsAttention,
    verified: true,
    credited: Boolean(result.credited),
    isTest: Boolean(result.isTest ?? finalRow.isTest),
    needsManualAction: Boolean(result.needsManualAction),
    externalTransactionId:
      result.externalTransactionId || finalRow.externalTransactionId || null,
    // `balanceAfter` is only present when the crediting path happened to return
    // one; the external wallet API is the balance authority and this module
    // never queries it just to decorate a response.
    ...(result.balanceAfter !== undefined
      ? { balanceAfter: result.balanceAfter }
      : {}),
    order: serializeOrder(finalRow),
  };
}

// ---------------------------------------------------------------------------
// createAdminPaymentLink
// ---------------------------------------------------------------------------

/**
 * Admin raises a Razorpay Payment Link so SOMEONE ELSE can fund their wallet.
 *
 * This is the one flow where the wallet identity legitimately comes from the
 * request body (`resolveForAdmin`) — the route mounting it must be gated on
 * `wallet:manage:all`.
 *
 * @param {Object} args
 * @param {Object} args.actor req.user (the admin)
 * @param {Object} args.body validated payload
 * @param {string} [args.ip]
 * @param {string} [args.userAgent]
 * @returns {Promise<Object>} `serializeOrder` projection (includes shortUrl + uiStatus)
 */
async function createAdminPaymentLink({ actor, body, ip, userAgent } = {}) {
  const payload = body || {};
  const provider = payload.provider || DEFAULT_PROVIDER;

  const identity = resolveForAdmin(payload);
  const config = await resolveActiveConfig(provider);
  const { amount: rupees, amountPaise } = resolveAmount(payload.amount, config);

  // ---- Expiry ------------------------------------------------------------
  // Capped hard: Razorpay rejects an `expire_by` too far out, and an
  // effectively-immortal payable link is a standing liability nobody reviews.
  const requestedHours = Number(
    payload.expiryHours ?? config.paymentLinkExpiryHours ?? 24,
  );
  const expiryHours = Math.min(
    Math.max(Number.isFinite(requestedHours) ? requestedHours : 24, 1),
    MAX_LINK_EXPIRY_HOURS,
  );
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
  const expiresAtUnix = Math.floor(expiresAt.getTime() / 1000);

  const impl = getProvider(provider);
  const orderId = crypto.randomUUID();
  const referenceId = `WLT-${shortId()}`.slice(0, MAX_RECEIPT_LENGTH);

  // Network call OUTSIDE the transaction (T6).
  const link = await impl.createPaymentLink({
    config,
    amountPaise,
    currency: payload.currency || config.currency,
    description:
      payload.description || `Wallet top-up for ${identity.walletUserId}`,
    expiresAtUnix,
    customer: {
      name: payload.payerName || undefined,
      email: payload.payerEmail || undefined,
      contact: payload.payerPhone || identity.walletUserId || undefined,
    },
    // LOAD-BEARING (T4) — same reconstruction contract as the checkout path.
    notes: {
      walletUserId: identity.walletUserId,
      clientCode: identity.clientCode,
      subjectUserId: identity.subjectUserId,
      kind: "ADMIN_LINK",
    },
    callbackUrl: process.env.PAYMENT_CALLBACK_URL,
    referenceId,
  });

  const resolvedExpiry = link.expiresAt ? new Date(link.expiresAt) : expiresAt;

  const [order] = await prisma.$transaction([
    prisma.paymentOrder.create({
      data: {
        id: orderId,
        kind: "ADMIN_LINK",
        provider,
        mode: config.mode, // T2
        isTest: config.mode === "TEST",

        walletUserId: identity.walletUserId,
        clientCode: identity.clientCode,
        subjectUserId: identity.subjectUserId,

        payerName: payload.payerName || null,
        payerEmail: payload.payerEmail || null,
        payerPhone: payload.payerPhone || null,

        amount: rupees,
        amountPaise,
        currency: link.currency || payload.currency || config.currency,

        status: "CREATED",
        providerLinkId: link.providerLinkId,
        shortUrl: link.shortUrl,
        expiresAt: resolvedExpiry,

        notes: payload.notes || payload.reason || null,
        gatewayData: {
          referenceId,
          createdVia: "ADMIN_PAYMENT_LINK",
          expiryHours,
          providerLink: link.raw || null,
        },
        createdBy: asUuidOrNull(actor?.id),
      },
    }),
    auditCreate({
      action: "PAYMENT_LINK_CREATED",
      resourceId: orderId,
      userId: actor?.id,
      ip,
      userAgent,
      details: {
        kind: "ADMIN_LINK",
        provider,
        mode: config.mode,
        isTest: config.mode === "TEST",
        amount: rupees,
        amountPaise,
        currency: link.currency || payload.currency || config.currency,
        walletUserId: identity.walletUserId,
        clientCode: identity.clientCode,
        subjectUserId: identity.subjectUserId,
        providerLinkId: link.providerLinkId,
        shortUrl: link.shortUrl,
        expiresAt: resolvedExpiry.toISOString(),
        expiryHours,
        referenceId,
        createdBy: actor?.id || null,
      },
    }),
  ]);

  logger.info("Admin payment link created", {
    orderId: order.id,
    providerLinkId: order.providerLinkId,
    walletUserId: identity.walletUserId,
    amountPaise,
    createdBy: actor?.id,
  });

  return serializeOrder(order);
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

/**
 * Build the Prisma WHERE + the echoed filter block.
 *
 * THE SCOPE RULE IS ENFORCED HERE AND NOWHERE ELSE. Under `scope: "self"` the
 * wallet identity is OVERWRITTEN from the JWT after the query filters are
 * applied, so a crafted `?walletUserId=<someone else>` cannot widen the result
 * set — it is silently replaced, never honoured. This is why the self list
 * endpoint and the admin list endpoint can safely share one implementation.
 *
 * @private
 */
function buildListWhere(query, actor, scope) {
  const q = query || {};
  const where = {};

  if (q.status) where.status = q.status;
  if (q.kind) where.kind = q.kind;
  if (q.provider) where.provider = q.provider;
  if (q.mode) where.mode = q.mode;
  if (q.needsManualAction !== undefined && q.needsManualAction !== null) {
    where.needsManualAction =
      q.needsManualAction === true || q.needsManualAction === "true";
  }

  if (q.startDate || q.endDate) {
    where.createdAt = {};
    if (q.startDate) where.createdAt.gte = new Date(q.startDate);
    if (q.endDate) where.createdAt.lte = new Date(q.endDate);
  }

  let walletUserId = null;
  let clientCode = null;

  if (scope === "admin") {
    if (q.walletUserId) walletUserId = String(q.walletUserId).trim();
    if (q.clientCode) clientCode = normalizeClientCode(q.clientCode);
    if (q.subjectUserId) where.subjectUserId = q.subjectUserId;
    if (walletUserId) where.walletUserId = walletUserId;
    if (clientCode) where.clientCode = clientCode;
  } else {
    // SELF — identity from the JWT, query params ignored (T1).
    const identity = resolveForSelf(actor);
    walletUserId = identity.walletUserId;
    clientCode = identity.clientCode;

    // Match on EITHER identity: an admin-created link for this user carries the
    // phone but may have no subjectUserId, and a self-serve order carries both.
    where.OR = [
      { walletUserId: identity.walletUserId },
      ...(identity.subjectUserId
        ? [{ subjectUserId: identity.subjectUserId }]
        : []),
    ];

    // Any caller-supplied identity filter is dropped on the floor here.
    delete where.subjectUserId;
  }

  return {
    where,
    filters: {
      status: q.status ?? null,
      kind: q.kind ?? null,
      provider: q.provider ?? null,
      mode: q.mode ?? null,
      walletUserId,
      clientCode,
      startDate: q.startDate ?? null,
      endDate: q.endDate ?? null,
      sortDir: q.sortDir === "asc" ? "asc" : "desc",
      scope: scope === "admin" ? "admin" : "self",
    },
  };
}

/**
 * THE LIST ENVELOPE IS A HARD CONTRACT.
 *
 * The frontend's RTK Query slice uses `transformResponse: r => r.data ?? r`, so
 * it only ever sees the `data` half of `APIResponse.success(payload)`. Anything
 * placed in `meta` — which is exactly where `APIResponse.paginated()` puts
 * pagination — is DISCARDED before the component sees it, and the table renders
 * with no page count. Pagination therefore rides INSIDE the payload, in the
 * snake_case shape the UI reads, with a 0-BASED `current_page`.
 *
 * Do not "tidy" this into `APIResponse.paginated()`.
 *
 * @private
 */
function buildListEnvelope(rows, total, page, size, filters) {
  return {
    data: rows.map(serializeOrder),
    pagination: {
      total_elements: total,
      has_previous: page > 0,
      has_next: (page + 1) * size < total,
      total_pages: size > 0 ? Math.ceil(total / size) : 0,
      current_page: page, // 0-BASED
      page_size: size,
    },
    success: true,
    filters,
  };
}

/** @private */
function resolvePaging(query) {
  const q = query || {};
  const rawPage = Number(q.page ?? 0);
  const rawSize = Number(q.size ?? DEFAULT_PAGE_SIZE);

  const page =
    Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 0;
  const size =
    Number.isFinite(rawSize) && rawSize > 0
      ? Math.min(Math.floor(rawSize), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  return { page, size };
}

/**
 * List payment orders.
 *
 * @param {Object} args
 * @param {Object} args.query
 * @param {Object} args.actor req.user
 * @param {"self"|"admin"} [args.scope="self"] "self" forces the caller's own
 *   identity regardless of query params; "admin" allows filtering by walletUserId
 * @returns {Promise<{data: Object[], pagination: Object, success: true, filters: Object}>}
 */
async function listOrders({ query, actor, scope = "self" } = {}) {
  const { page, size } = resolvePaging(query);
  const { where, filters } = buildListWhere(query, actor, scope);

  const [total, rows] = await Promise.all([
    prisma.paymentOrder.count({ where }),
    prisma.paymentOrder.findMany({
      where,
      orderBy: { createdAt: filters.sortDir },
      skip: page * size,
      take: size,
    }),
  ]);

  return buildListEnvelope(rows, total, page, size, filters);
}

/**
 * Fetch one order (no gateway call).
 *
 * @param {Object} args
 * @param {string} args.orderId
 * @param {Object} args.actor
 * @param {"self"|"admin"} [args.scope="self"]
 * @returns {Promise<Object>} `serializeOrder` projection
 */
async function getOrder({ orderId, actor, scope = "self" } = {}) {
  const order = await prisma.paymentOrder.findUnique({
    where: { id: orderId },
  });

  if (!order) throw new NotFoundError("Payment order not found");

  assertReadable(order, actor, scope);
  return serializeOrder(order);
}

// ---------------------------------------------------------------------------
// Live status / provider refresh
// ---------------------------------------------------------------------------

/** @private */
function isOpen(order) {
  return OPEN_STATUSES.includes(order.status);
}

/** @private */
function isStale(order) {
  const touched = order.updatedAt || order.createdAt;
  if (!touched) return true;
  return Date.now() - new Date(touched).getTime() > LIVE_STATUS_STALE_MS;
}

/**
 * Fetch an order and, when it is still open AND the local row is stale,
 * re-poll the gateway before answering.
 *
 * WHY THIS EXISTS — the bootstrap case: on a fresh deployment the Razorpay
 * webhook may not be configured yet (or the endpoint is not reachable from the
 * internet). Without this, a user who paid successfully would sit on a PENDING
 * chip forever with their money at the gateway. Polling on read turns that
 * silent stall into a self-healing one, and every capture it discovers is
 * routed through `creditOrder` like any other — same claim, same reference,
 * same idempotency. It is NOT a replacement for the webhook; it only runs when
 * someone happens to look at the order.
 *
 * The 60s staleness gate keeps a refreshing UI from hammering Razorpay's API.
 *
 * @param {Object} args
 * @param {string} args.orderId
 * @param {Object} args.actor
 * @param {"self"|"admin"} [args.scope="self"]
 * @returns {Promise<Object>} `serializeOrder` projection (+ `refreshed`, `refreshError`)
 */
async function getOrderWithLiveStatus({ orderId, actor, scope = "self" } = {}) {
  const order = await prisma.paymentOrder.findUnique({
    where: { id: orderId },
  });

  if (!order) throw new NotFoundError("Payment order not found");

  assertReadable(order, actor, scope);

  if (!isOpen(order) || !isStale(order)) {
    return { ...serializeOrder(order), refreshed: false };
  }

  try {
    const refreshed = await pollProvider(order, "LIVE_STATUS");
    return {
      ...refreshed.order,
      refreshed: true,
      providerStatus: refreshed.providerStatus,
    };
  } catch (error) {
    // A gateway outage must NEVER make "show me my order" fail. Degrade to the
    // last known local state and say so.
    logger.warn("Live status refresh failed — serving the local row", {
      orderId: order.id,
      error: error.message,
    });
    return {
      ...serializeOrder(order),
      refreshed: false,
      refreshError: error.message,
    };
  }
}

/**
 * Explicitly re-poll the gateway for an order (the admin "Refresh status"
 * button). Unlike `getOrderWithLiveStatus` there is no staleness gate — the
 * operator asked for it — but the error is NOT swallowed, because a failed
 * explicit refresh must be visible.
 *
 * @param {Object} args
 * @param {string} args.orderId
 * @param {Object} args.actor
 * @param {"self"|"admin"} [args.scope="admin"]
 * @returns {Promise<Object>} `serializeOrder` projection + `providerStatus`
 */
async function refreshFromProvider({ orderId, actor, scope = "admin" } = {}) {
  const order = await prisma.paymentOrder.findUnique({
    where: { id: orderId },
  });

  if (!order) throw new NotFoundError("Payment order not found");

  assertReadable(order, actor, scope);

  const result = await pollProvider(order, "REFRESH");

  await writeAudit({
    action: "TOPUP_REFRESHED_FROM_PROVIDER",
    resourceId: order.id,
    userId: actor?.id,
    details: {
      provider: order.provider,
      mode: order.mode,
      statusBefore: order.status,
      statusAfter: result.order.status,
      providerStatus: result.providerStatus,
      credited: result.credited,
    },
  });

  return {
    ...result.order,
    providerStatus: result.providerStatus,
    credited: result.credited,
  };
}

/**
 * The shared provider-polling body behind `getOrderWithLiveStatus` and
 * `refreshFromProvider`.
 *
 * Discovery order:
 *   1. ADMIN_LINK  -> `fetchPaymentLink` gives us the captured payment id.
 *   2. Known payment id -> `fetchPayment` confirms capture.
 *   3. Neither     -> nothing to discover. A self-serve checkout whose browser
 *      never came back leaves NO payment id anywhere we can query by, which is
 *      precisely what the webhook (and `adoptOrphanPayment`) exist to cover.
 * Then the local expiry sweep runs.
 *
 * Every discovered capture is handed to `creditOrder` — never credited here.
 *
 * @private
 * @returns {Promise<{order: Object, providerStatus: string|null, credited: boolean}>}
 */
async function pollProvider(order, source) {
  const config = await resolveConfigForMode(order.provider, order.mode, {
    // In-flight orders must keep settling even if the provider was disabled
    // for NEW business.
    requireEnabled: false,
  });
  const impl = getProvider(order.provider);

  let providerStatus = null;
  let providerPaymentId = order.providerPaymentId || null;
  let linkExpired = false;

  // ---- 1. Payment link ----------------------------------------------------
  if (order.providerLinkId) {
    const link = await impl.fetchPaymentLink({
      config,
      providerLinkId: order.providerLinkId,
    });

    providerStatus = link.status || null;
    providerPaymentId = providerPaymentId || link.providerPaymentId || null;
    linkExpired = link.status === "expired" || link.status === "cancelled";

    if (link.shortUrl && link.shortUrl !== order.shortUrl) {
      await prisma.paymentOrder.update({
        where: { id: order.id },
        data: { shortUrl: link.shortUrl },
      });
    }
  }

  // ---- 2. Confirm the capture --------------------------------------------
  let credited = false;

  if (providerPaymentId) {
    const payment = await impl.fetchPayment({ config, providerPaymentId });
    providerStatus = payment.status || providerStatus;

    if (payment.captured === true && payment.status === "captured") {
      const parsed = {
        providerPaymentId: payment.providerPaymentId,
        providerOrderId: payment.providerOrderId,
        amountPaise: payment.amountPaise,
        currency: payment.currency,
        capturedAt: payment.capturedAt,
        outcome: "PAID",
        raw: payment.raw,
      };

      // Same single crediting implementation, same guarded claim, same
      // deterministic RZP_<paymentId> reference as the webhook — so this
      // racing a webhook converges on exactly one credit.
      const result = await creditOrder(order, parsed, {
        source,
        verifiedMode: order.mode,
        config,
      });
      credited = Boolean(result.credited);
    }
  }

  // ---- 3. Local expiry sweep ---------------------------------------------
  // Only when nothing was credited: a real capture must always beat our local
  // expiry guess.
  if (!credited) {
    const localLapsed =
      order.expiresAt && new Date(order.expiresAt).getTime() < Date.now();

    if (linkExpired || localLapsed) {
      const expired = await prisma.paymentOrder.updateMany({
        where: { id: order.id, status: { in: EXPIRABLE_FROM } },
        data: { status: "EXPIRED" },
      });

      if (expired.count > 0) {
        await writeAudit({
          action: "TOPUP_EXPIRED",
          resourceId: order.id,
          userId: order.subjectUserId,
          details: {
            provider: order.provider,
            providerLinkId: order.providerLinkId,
            providerOrderId: order.providerOrderId,
            providerStatus,
            source,
          },
        });
      }
    }
  }

  const fresh = await prisma.paymentOrder.findUnique({
    where: { id: order.id },
  });

  return {
    order: serializeOrder(fresh || order),
    providerStatus,
    credited,
  };
}

// ---------------------------------------------------------------------------
// cancelAdminPaymentLink
// ---------------------------------------------------------------------------

/**
 * Cancel an unpaid admin payment link.
 *
 * The gateway is cancelled FIRST, then the local guarded transition runs.
 * That order is deliberate: if the local row were flipped first and the gateway
 * call then failed, we would show CANCELLED while a live payable link was still
 * in the customer's inbox — the one outcome that actually loses money.
 *
 * @param {Object} args
 * @param {string} args.orderId
 * @param {Object} args.actor
 * @param {string} [args.reason]
 * @param {string} [args.ip]
 * @param {string} [args.userAgent]
 * @returns {Promise<Object>} `serializeOrder` projection
 */
async function cancelAdminPaymentLink({
  orderId,
  actor,
  reason,
  ip,
  userAgent,
} = {}) {
  const order = await prisma.paymentOrder.findUnique({
    where: { id: orderId },
  });

  if (!order) throw new NotFoundError("Payment order not found");

  if (order.kind !== "ADMIN_LINK" || !order.providerLinkId) {
    throw new ValidationError(
      "Only admin payment links can be cancelled with this endpoint",
    );
  }

  if (!CANCELLABLE_FROM.includes(order.status)) {
    throw fail(
      `A payment order in status ${order.status} cannot be cancelled`,
      409,
      "ORDER_NOT_CANCELLABLE",
      { status: order.status, allowedFrom: CANCELLABLE_FROM },
    );
  }

  const config = await resolveConfigForMode(order.provider, order.mode, {
    requireEnabled: false,
  });
  const impl = getProvider(order.provider);

  // Network call outside the transaction (T6).
  const cancelled = await impl.cancelPaymentLink({
    config,
    providerLinkId: order.providerLinkId,
  });

  // Guarded transition + audit. The interactive transaction is used (rather
  // than the array form) so the audit row is only written when THIS caller
  // actually won the transition — a concurrent cancel must not produce two
  // "cancelled by" entries for one event.
  const outcome = await prisma.$transaction(async (tx) => {
    const claimed = await tx.paymentOrder.updateMany({
      where: { id: order.id, status: { in: CANCELLABLE_FROM } },
      data: {
        status: "CANCELLED",
        notes: reason ? String(reason).slice(0, 2000) : order.notes,
      },
    });

    if (claimed.count === 0) {
      return { claimed: false };
    }

    await tx.auditLog.create({
      data: {
        userId: asUuidOrNull(actor?.id),
        action: "PAYMENT_LINK_CANCELLED",
        resource: RESOURCE,
        resourceId: order.id,
        details: {
          provider: order.provider,
          mode: order.mode,
          providerLinkId: order.providerLinkId,
          walletUserId: order.walletUserId,
          clientCode: order.clientCode,
          amount: toNumber(order.amount),
          amountPaise: order.amountPaise,
          statusBefore: order.status,
          providerStatus: cancelled && cancelled.status,
          reason: reason || null,
          cancelledBy: actor?.id || null,
        },
        ipAddress: ip || null,
        userAgent: userAgent || null,
      },
    });

    return { claimed: true };
  });

  if (!outcome.claimed) {
    // Someone (or a webhook) moved the order between our read and our claim.
    logger.info("Cancel skipped — order left the cancellable set", {
      orderId: order.id,
      statusAtRead: order.status,
    });
  } else {
    logger.info("Admin payment link cancelled", {
      orderId: order.id,
      providerLinkId: order.providerLinkId,
      cancelledBy: actor?.id,
    });
  }

  const fresh = await prisma.paymentOrder.findUnique({
    where: { id: order.id },
  });
  return serializeOrder(fresh || order);
}

// ---------------------------------------------------------------------------

module.exports = {
  // HTTP surface
  initiateSelfTopup,
  verifyClientCallback,
  createAdminPaymentLink,
  listOrders,
  getOrder,
  getOrderWithLiveStatus,
  refreshFromProvider,
  cancelAdminPaymentLink,

  // Exported for reuse/tests — not part of the HTTP surface.
  serializeOrder,
  projectUiStatus,
  buildListEnvelope,
  OPEN_STATUSES,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
};
