/**
 * Top-up Controller — /api/v1/wallet/topup
 *
 * THIN BY MANDATE. Every rule that matters (identity resolution, amount bands,
 * idempotency, signature verification, the credit ledger, replay guards, audit
 * logging) lives in `services/payments/topupService.js`,
 * `services/payments/reconcileService.js` and
 * `services/payments/webhookService.js`. These handlers only translate
 * HTTP <-> service call, exactly like `paymentProviderController.js`.
 *
 * TWO CONTRACTS THIS FILE MUST NOT BREAK
 * --------------------------------------
 * 1. LIST ENVELOPES PASS STRAIGHT THROUGH.
 *    `topupService.listOrders()` and `reconcileService.listPending()` already
 *    return the complete envelope `{ data, pagination, success, filters }` in
 *    the snake_case shape the UI table reads. It is handed to
 *    `APIResponse.success(payload)` VERBATIM. Do NOT re-wrap it, and do NOT
 *    reach for `APIResponse.paginated()`: that helper puts pagination in
 *    `meta`, and the frontend slice's `transformResponse: r => r.data ?? r`
 *    throws `meta` away, so the table would render with no page count.
 *
 * 2. ERRORS USE THE 4-ARG `APIResponse.error(message, code, details, status)`.
 *    Several older controllers in this service call
 *    `APIResponse.error(message, 400, details)` — that lands the HTTP status in
 *    the `code` slot. The top-up UI reads `data.error.code` to branch (e.g.
 *    `PROVIDER_NOT_CONFIGURED` vs `AMOUNT_OUT_OF_RANGE`) and
 *    `data.error.details` to highlight fields, so that bug is not copied here.
 *
 * SECURITY INVARIANTS (called out by the top-up service author)
 * ------------------------------------------------------------
 * - `scope` is ALWAYS a route-level literal ("self" on the self routes,
 *   "admin" on the admin routes). It is never read from the query string,
 *   the body, or a header — otherwise `?scope=admin` is a privilege escalation.
 * - The self routes NEVER forward a client-supplied identity
 *   (`userId`, `walletUserId`, `subjectUserId`, `clientCode`) into the service.
 *   Self-serve identity comes from the JWT only. The handlers below destructure
 *   the exact fields the service accepts rather than spreading `req.body`, so a
 *   future schema change cannot silently open that door.
 */

const topupService = require("../services/payments/topupService");
const reconcileService = require("../services/payments/reconcileService");
const webhookService = require("../services/payments/webhookService");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");

/** Audit context carried into every write. */
function requestMeta(req) {
  return {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  };
}

/**
 * Single error translation point.
 * Uses the 4-arg APIResponse.error form — see the header note.
 */
function fail(res, error, fallbackMessage) {
  const statusCode = error.statusCode || 500;
  const code = error.code || "TOPUP_ERROR";

  if (statusCode >= 500) {
    logger.error(fallbackMessage, { error: error.message, stack: error.stack });
  } else {
    logger.warn(fallbackMessage, { error: error.message, code });
  }

  return res
    .status(statusCode)
    .json(
      APIResponse.error(
        error.message || fallbackMessage,
        code,
        error.details || null,
        statusCode,
      ),
    );
}

// ---------------------------------------------------------------------------
// Self-serve top-up
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/wallet/topup/self/initiate
 * Create a gateway order for the AUTHENTICATED user's own wallet.
 */
async function initiateSelfTopup(req, res) {
  try {
    const { amount, currency, provider, idempotencyKey, metadata } =
      req.body || {};

    // `user: req.user` is the ONLY identity input. No body-supplied
    // userId / walletUserId / subjectUserId is passed through.
    const result = await topupService.initiateSelfTopup({
      user: req.user,
      amount,
      currency,
      provider,
      idempotencyKey,
      metadata,
      ...requestMeta(req),
    });

    return res.status(201).json(APIResponse.success(result));
  } catch (error) {
    return fail(res, error, "Failed to initiate self top-up");
  }
}

/**
 * POST /api/v1/wallet/topup/self/verify
 * Verify the Razorpay checkout callback and credit the wallet.
 */
async function verifySelfTopup(req, res) {
  try {
    const {
      orderId,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
    } = req.body || {};

    const result = await topupService.verifyClientCallback({
      user: req.user,
      orderId,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
      ...requestMeta(req),
    });

    return res.json(APIResponse.success(result));
  } catch (error) {
    return fail(res, error, "Failed to verify top-up payment");
  }
}

/**
 * GET /api/v1/wallet/topup/self/orders
 * The caller's own top-up orders. `scope: "self"` pins identity to the JWT.
 */
async function listSelfOrders(req, res) {
  try {
    const payload = await topupService.listOrders({
      query: req.query,
      actor: req.user,
      scope: "self", // route-level literal — never from the request
    });

    // Complete envelope — passed through untouched (see header note 1).
    return res.json(APIResponse.success(payload));
  } catch (error) {
    return fail(res, error, "Failed to list top-up orders");
  }
}

/**
 * GET /api/v1/wallet/topup/orders/:orderId
 * One of the caller's own orders, refreshed from the gateway when stale.
 */
async function getSelfOrder(req, res) {
  try {
    const order = await topupService.getOrderWithLiveStatus({
      orderId: req.params.orderId,
      actor: req.user,
      scope: "self", // route-level literal
    });

    return res.json(APIResponse.success(order));
  } catch (error) {
    return fail(res, error, "Failed to fetch top-up order");
  }
}

// ---------------------------------------------------------------------------
// Admin — payment links
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/wallet/topup/admin/payment-links
 * Create a payable link for ANOTHER user's wallet. Body-supplied identity is
 * legitimate here precisely because the route is gated on wallet:manage:all.
 */
async function createAdminPaymentLink(req, res) {
  try {
    const order = await topupService.createAdminPaymentLink({
      actor: req.user,
      body: req.body,
      ...requestMeta(req),
    });

    return res.status(201).json(APIResponse.success(order));
  } catch (error) {
    return fail(res, error, "Failed to create payment link");
  }
}

/**
 * GET /api/v1/wallet/topup/admin/payment-links
 * List admin-created payment links only — `kind: "ADMIN_LINK"` is forced by the
 * route, not accepted from the query, so this listing can never be widened into
 * "every order in the platform" by a crafted query string.
 */
async function listAdminPaymentLinks(req, res) {
  try {
    const payload = await topupService.listOrders({
      query: { ...req.query, kind: "ADMIN_LINK" },
      actor: req.user,
      scope: "admin", // route-level literal
    });

    return res.json(APIResponse.success(payload));
  } catch (error) {
    return fail(res, error, "Failed to list payment links");
  }
}

/**
 * GET /api/v1/wallet/topup/admin/payment-links/:orderId
 */
async function getAdminPaymentLink(req, res) {
  try {
    const order = await topupService.getOrderWithLiveStatus({
      orderId: req.params.orderId,
      actor: req.user,
      scope: "admin", // route-level literal
    });

    return res.json(APIResponse.success(order));
  } catch (error) {
    return fail(res, error, "Failed to fetch payment link");
  }
}

/**
 * POST /api/v1/wallet/topup/admin/payment-links/:orderId/refresh
 * Force a gateway poll for one order, ignoring the staleness window.
 */
async function refreshAdminPaymentLink(req, res) {
  try {
    const order = await topupService.refreshFromProvider({
      orderId: req.params.orderId,
      actor: req.user,
    });

    return res.json(APIResponse.success(order));
  } catch (error) {
    return fail(res, error, "Failed to refresh payment link from provider");
  }
}

/**
 * POST /api/v1/wallet/topup/admin/payment-links/:orderId/cancel
 */
async function cancelAdminPaymentLink(req, res) {
  try {
    const order = await topupService.cancelAdminPaymentLink({
      orderId: req.params.orderId,
      actor: req.user,
      reason: req.body?.reason,
      ...requestMeta(req),
    });

    return res.json(APIResponse.success(order));
  } catch (error) {
    return fail(res, error, "Failed to cancel payment link");
  }
}

// ---------------------------------------------------------------------------
// Admin — reconciliation queue
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/wallet/topup/admin/reconcile-queue
 * Orders whose credit has not landed yet (paid at the gateway, not yet in the
 * wallet) plus the backlog counters.
 */
async function listReconcileQueue(req, res) {
  try {
    const payload = await reconcileService.listPending({ query: req.query });

    // Complete envelope — passed through untouched (see header note 1).
    return res.json(APIResponse.success(payload));
  } catch (error) {
    return fail(res, error, "Failed to list the reconcile queue");
  }
}

/**
 * POST /api/v1/wallet/topup/admin/orders/:orderId/reconcile
 * Manually retry the credit for one stuck order.
 */
async function retryReconcile(req, res) {
  try {
    const result = await reconcileService.retryOne(req.params.orderId, {
      actor: req.user,
    });

    return res.json(APIResponse.success(result));
  } catch (error) {
    return fail(res, error, "Failed to retry reconciliation for the order");
  }
}

// ---------------------------------------------------------------------------
// Webhook (unauthenticated — the HMAC signature is the authenticity proof)
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/wallet/topup/webhook/:provider
 *
 * THE HTTP STATUS HERE IS A MONEY-SAFETY DECISION, NOT A COSMETIC ONE.
 *
 * Razorpay retries any non-2xx response. Our replay guard is keyed on the
 * event id, so the FIRST delivery has already been recorded by the time a
 * retry arrives — the retry is then correctly swallowed as a duplicate and the
 * failure is never actually re-attempted. Answering non-2xx for a deferred or
 * failed credit therefore burns the gateway's only retry on a no-op and strands
 * the money. So: everything that was *received and recorded* answers 200, and
 * the reconcile worker owns the follow-up.
 *
 * The two deliberate exceptions:
 *  - 401 on a signature mismatch — an unauthenticated caller must be told no,
 *    and Razorpay never sends a badly-signed event, so there is nothing to lose.
 *  - 503, thrown by the service as `APIError(503, "WEBHOOK_INFRA_UNAVAILABLE")`
 *    when the event could NOT be persisted. That is the one case where a
 *    redelivery is genuinely useful, because nothing was recorded and the
 *    replay guard will not swallow it.
 */
async function handleWebhook(req, res) {
  try {
    const result = await webhookService.handleWebhook({
      provider: req.params.provider,
      // The exact bytes the provider signed — captured by the express.json
      // `verify` hook in server.js. JSON.stringify(req.body) is NOT
      // byte-identical and would fail HMAC verification.
      rawBody: req.rawBody,
      parsedBody: req.body,
      headers: req.headers,
      ip: req.ip,
    });

    const { status, code, handled, ...rest } = result || {};

    if (status === 401) {
      logger.warn("Webhook rejected — invalid signature", {
        provider: req.params.provider,
        code,
        handled,
      });

      return res
        .status(401)
        .json(
          APIResponse.error(
            "Invalid signature",
            "INVALID_SIGNATURE",
            null,
            401,
          ),
        );
    }

    // Everything else — including unsupported providers, ignored event types,
    // duplicates, deferred credits and failed credits — is acknowledged with
    // 200 so the gateway stops retrying. See the note above.
    return res.status(200).json(
      APIResponse.success({
        received: true,
        handled,
        ...(code ? { code } : {}),
        ...rest,
      }),
    );
  } catch (error) {
    // Only APIError(503, "WEBHOOK_INFRA_UNAVAILABLE") reaches here: the event
    // was not recorded, so a redelivery is wanted.
    return fail(res, error, "Failed to process payment webhook");
  }
}

// ---------------------------------------------------------------------------
// Hosted-gateway return (unauthenticated — the AES envelope + a server-to-server
// re-confirmation are the authenticity proof)
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/wallet/topup/return/{provider}:
 *   post:
 *     tags: [Wallet Top-up]
 *     summary: Hosted payment gateway redirect return
 *     description: |
 *       Receives the customer's browser back from a NON-SEAMLESS gateway
 *       (CCAvenue) after they have paid on the gateway's own page. The gateway
 *       POSTs an AES-encrypted `encResp` form field here.
 *
 *       **Deliberately unauthenticated** — the request is issued by the gateway
 *       / the customer's browser and carries no JWT. The API Gateway whitelists
 *       this prefix in `authValidator.js` publicPaths for the same reason.
 *
 *       **Always answers 302**, including for a failed, unknown or
 *       undecryptable payload. A customer who has just handed over money must
 *       land on the wallet callback page, never on a JSON error body.
 *
 *       The credit is re-confirmed server-to-server before any money moves; a
 *       decrypted envelope alone is never treated as proof of payment.
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [razorpay, ccavenue, stripe, cashfree, payu]
 *         description: Payment provider slug
 *     requestBody:
 *       required: false
 *       description: |
 *         `application/x-www-form-urlencoded` with the gateway's `encResp`.
 *         **Intentionally not validated** — see the note in the route.
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               encResp:
 *                 type: string
 *     responses:
 *       302:
 *         description: |
 *           Redirect to
 *           `/wallet/topup/callback?provider=&orderId=&status=&ref=`.
 *           `status` is one of `paid`, `failed`, `pending`, `unknown`.
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *       429:
 *         description: Too many return hits from this IP
 *   get:
 *     tags: [Wallet Top-up]
 *     summary: Hosted payment gateway redirect return (GET variant)
 *     description: |
 *       Defensive twin of the POST handler — some gateways issue a GET against
 *       the `cancel_url`. Identical behaviour; the payload, if any, arrives on
 *       the query string.
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirect to the wallet callback page
 */
async function handleProviderReturn(req, res) {
  const provider = req.params.provider;

  try {
    const result = await topupService.handleGatewayReturn({
      provider,
      // The exact bytes as delivered — captured by the form-encoded `verify`
      // hook in server.js. The service falls back to these when the body
      // parser did not claim the content type.
      rawBody: req.rawBody,
      // GET carries the payload on the query string, POST in the body.
      parsedBody:
        req.method === "GET"
          ? { ...(req.query || {}), ...(req.body || {}) }
          : req.body,
      headers: req.headers,
      ip: req.ip,
    });

    logger.info("Gateway return processed", {
      provider,
      orderId: result.orderId,
      handled: result.handled,
      credited: result.credited,
    });

    // ALWAYS a 302. Never a JSON body on this route.
    return res.redirect(302, result.redirectTo);
  } catch (error) {
    // The service is written never to throw for a payment-shaped problem, so
    // reaching here means something genuinely unexpected broke. Even then the
    // customer gets the callback page: the money is safe at the gateway and the
    // webhook / reconcile worker owns the follow-up. An error page here would
    // read to a paying customer as "my payment vanished".
    logger.error("Gateway return handling threw — redirecting as pending", {
      provider,
      error: error.message,
      stack: error.stack,
    });

    const base = (
      process.env.PAYMENT_RETURN_UI_URL ||
      process.env.FRONTEND_URL ||
      ""
    ).replace(/\/+$/, "");

    return res.redirect(
      302,
      `${base}/wallet/topup/callback?provider=${encodeURIComponent(
        provider || "",
      )}&orderId=&status=pending&ref=`,
    );
  }
}

/**
 * @swagger
 * /api/v1/wallet/topup/qr-webhook/{provider}:
 *   post:
 *     tags: [Wallet Top-up]
 *     summary: Static UPI QR collection webhook receiver
 *     description: |
 *       Receives UPI collection notifications for static per-wallet QR codes.
 *       **Deliberately unauthenticated** — the gateway holds no JWT; the
 *       payload's own signature/envelope is the authenticity proof, verified
 *       inside `qrWebhookService`.
 *
 *       Answers 200 for everything that was received and recorded, for exactly
 *       the same money-safety reason as the main webhook: a non-2xx burns the
 *       gateway's retry on an event the replay guard would then swallow.
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       description: The provider's raw collection envelope. **Intentionally not validated.**
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Collection event received and recorded
 *       401:
 *         description: Signature verification failed
 *       429:
 *         description: Too many webhook deliveries
 *       503:
 *         description: Event could not be persisted — gateway should redeliver
 */
async function handleQrWebhook(req, res) {
  try {
    // LAZY REQUIRE, same reasoning as `registerLazy` in services/payments/index.js:
    // `qrWebhookService` lands in this wave alongside this handler, and a
    // top-level require of a not-yet-present module would take wallet-service
    // down at boot instead of failing this one route cleanly.
    const qrWebhookService = require("../services/payments/qrWebhookService");

    const result = await qrWebhookService.handleQrWebhook({
      provider: req.params.provider,
      // Raw bytes: whatever signs this envelope signs the bytes, not a
      // re-serialisation of the parsed object.
      rawBody: req.rawBody,
      parsedBody: req.body,
      headers: req.headers,
      ip: req.ip,
    });

    const { status, code, handled, ...rest } = result || {};

    if (status === 401) {
      logger.warn("QR webhook rejected — invalid signature", {
        provider: req.params.provider,
        code,
        handled,
      });

      return res
        .status(401)
        .json(
          APIResponse.error(
            "Invalid signature",
            "INVALID_SIGNATURE",
            null,
            401,
          ),
        );
    }

    // Same mapping as handleWebhook: everything recorded answers 200.
    return res.status(200).json(
      APIResponse.success({
        received: true,
        handled,
        ...(code ? { code } : {}),
        ...rest,
      }),
    );
  } catch (error) {
    return fail(res, error, "Failed to process the UPI QR collection webhook");
  }
}

module.exports = {
  // Self-serve
  initiateSelfTopup,
  verifySelfTopup,
  listSelfOrders,
  getSelfOrder,

  // Admin — payment links
  createAdminPaymentLink,
  listAdminPaymentLinks,
  getAdminPaymentLink,
  refreshAdminPaymentLink,
  cancelAdminPaymentLink,

  // Admin — reconciliation
  listReconcileQueue,
  retryReconcile,

  // Webhook
  handleWebhook,

  // Hosted-gateway return + static-QR collection webhook
  handleProviderReturn,
  handleQrWebhook,
};
