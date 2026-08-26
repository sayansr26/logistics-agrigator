/**
 * Static-QR Controller — Wave 4
 *
 * THIN BY MANDATE. Every rule — the never-repoint refusal, the partial-unique
 * 409 mapping, dedupe/idempotency, the never-guess attribution match, and every
 * audit line — lives in `services/payments/outletQrService.js` and
 * `services/payments/qrCollectionService.js`. These handlers do four things and
 * nothing else: read the request context, convert money at the boundary, call
 * the service, map the outcome to an HTTP status.
 *
 * ERROR SHAPE — READ THIS BEFORE COPYING ANOTHER CONTROLLER IN THIS SERVICE.
 * `APIResponse.error(message, code, details, statusCode)` takes the machine
 * code SECOND. Several older controllers here (and `middleware/validate.js`)
 * call it as `APIResponse.error(msg, 400, details)`, which writes the NUMBER
 * 400 into `error.code`. The QR admin UI branches on `data.error.code`
 * (QR_REPOINT_FORBIDDEN vs QR_IDENTIFIER_ALREADY_ACTIVE vs QR_NOT_PROVISIONED)
 * and renders `data.error.details.conflictingKey`, so that bug is not
 * reproduced here.
 *
 * LIST ENVELOPES PASS STRAIGHT THROUGH.
 * The services already return the frontend's hard-contract envelope
 * (`{data, pagination:{...snake_case, current_page 0-based}, success, filters}`).
 * It is handed to `APIResponse.success(payload)` VERBATIM — never re-wrapped,
 * never re-shaped, and never `APIResponse.paginated()`, whose `meta.pagination`
 * the RTK Query slice discards when it unwraps `response.data`.
 *
 * MONEY CROSSES THE BOUNDARY EXACTLY ONCE, HERE.
 * `createManualCollection` is the only place a rupee amount becomes paise. It
 * uses `ccavenueCrypto.parseAmountToPaise` — decimal-STRING arithmetic, the
 * same semantics as `utils/csvParser.parseRupeesToPaise`. Never
 * `Math.round(amount * 100)`: `parseFloat("1499.99") * 100` is
 * 149998.99999999999, and a rounded paise value would later fail the
 * paise-exact check in the credit path and park a perfectly good payment.
 */

const outletQrService = require("../services/payments/outletQrService");
const qrCollectionService = require("../services/payments/qrCollectionService");
const qrAssignmentService = require("../services/payments/qrAssignmentService");
const { parseAmountToPaise } = require("../services/payments/ccavenueCrypto");
const { parseCsvQrCollections } = require("../utils/csvParser");
const { resolveForSelf } = require("../services/payments/walletIdentity");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");

/**
 * Audit context carried into every write path. `req.ip` and the User-Agent are
 * what tie a QR change to the human who made it when a payment later turns out
 * to have gone to the wrong outlet.
 * @param {Object} req
 * @returns {{ip: ?string, userAgent: ?string}}
 */
function requestMeta(req) {
  return {
    ip: req.ip,
    userAgent: req.headers["user-agent"] || null,
  };
}

/**
 * Single error mapper. 5xx logs a stack (we broke), 4xx logs a warning (the
 * caller or a policy refused) — a duplicate QR identifier is normal operator
 * traffic, not an incident.
 *
 * @param {Object} res
 * @param {Error} error
 * @param {string} fallbackMessage
 * @param {string} [fallbackCode]
 */
function fail(res, error, fallbackMessage, fallbackCode = "QR_ERROR") {
  const statusCode = error.statusCode || 500;
  const code = error.code || fallbackCode;

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

/* ------------------------------------------------------------------ *
 * QR registry
 * ------------------------------------------------------------------ */

/**
 * @swagger
 * /api/v1/wallet/topup/qr/codes:
 *   post:
 *     tags: [Static QR]
 *     summary: Provision a static payment QR for an outlet
 *     description: |
 *       Creates the row that says WHICH OUTLET a printed static UPI QR belongs
 *       to. This row is the ONLY thing that can answer "whose money is this?"
 *       for a static-QR payment — nothing in an inbound webhook payload is
 *       trusted to name a wallet, because the payer controls the payload.
 *
 *       **At least one of `qrIdentifier` or `vpa` is required.** Those are the
 *       only two columns attribution matches on; a row with neither can never
 *       be matched, and every rupee paid against it would sit unattributed.
 *
 *       Three PARTIAL unique indexes allow at most one **ACTIVE** row per
 *       `(provider, qrIdentifier)`, per `(provider, vpa)` and per
 *       `(provider, walletUserId, clientCode)`. A collision returns **409**
 *       `QR_IDENTIFIER_ALREADY_ACTIVE` with `details.conflictingKey` naming
 *       which one broke — two live QRs claiming one identifier is a
 *       mis-routing bug, not a duplicate-row nuisance.
 *
 *       `walletUserId` is the EXTERNAL wallet id (a phone number for outlet
 *       users), never a local UUID.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [walletUserId]
 *             properties:
 *               walletUserId:
 *                 type: string
 *                 description: External wallet id (phone for outlet users)
 *                 example: "9876543210"
 *               clientCode: { type: string, example: "DEFAULT" }
 *               subjectUserId: { type: string, format: uuid }
 *               outletId: { type: string, format: uuid }
 *               outletName: { type: string, example: "Andheri West Counter" }
 *               provider: { type: string, example: "ccavenue_upi_qr" }
 *               qrIdentifier:
 *                 type: string
 *                 description: The provider's QR / sub-merchant reference
 *                 example: "STORE-AND-001"
 *               vpa: { type: string, example: "outlet001@ccavenue" }
 *               qrPayload:
 *                 type: string
 *                 description: Raw UPI intent string the outlet renders
 *               qrImageUrl: { type: string }
 *               mode: { type: string, enum: [TEST, LIVE], default: TEST }
 *               label: { type: string, example: "Counter 1" }
 *               maxPerCreditAmount:
 *                 type: number
 *                 description: Alerting signal only — never a credit gate
 *               maxPerDayAmount: { type: number }
 *               maxPerDayCount: { type: integer }
 *               metadata: { type: object }
 *     responses:
 *       201: { description: QR provisioned }
 *       400: { description: Validation failed (e.g. QR_KEY_REQUIRED) }
 *       403: { description: Insufficient permissions }
 *       409: { description: QR_IDENTIFIER_ALREADY_ACTIVE }
 */
async function createQrCode(req, res) {
  try {
    const { ip, userAgent } = requestMeta(req);
    const qr = await outletQrService.createQrCode({
      body: req.body,
      actor: req.user,
      ip,
      userAgent,
    });

    return res.status(201).json(APIResponse.success(qr));
  } catch (error) {
    return fail(
      res,
      error,
      "Failed to provision outlet QR",
      "QR_CREATE_FAILED",
    );
  }
}

/**
 * @swagger
 * /api/v1/wallet/topup/qr/codes:
 *   get:
 *     tags: [Static QR]
 *     summary: List provisioned outlet QRs
 *     description: |
 *       Admin listing of the QR registry, filterable by outlet, provider,
 *       identifier and lifecycle state.
 *
 *       **Pagination rides INSIDE `data`**, snake_case, with a **0-based**
 *       `current_page` — the frontend unwraps `response.data`, so anything in
 *       `meta` is discarded. `providerData` (the gateway's verbatim
 *       provisioning response) is never returned.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: query, name: provider, schema: { type: string } }
 *       - { in: query, name: walletUserId, schema: { type: string } }
 *       - { in: query, name: clientCode, schema: { type: string } }
 *       - { in: query, name: outletId, schema: { type: string, format: uuid } }
 *       - { in: query, name: qrIdentifier, schema: { type: string } }
 *       - { in: query, name: vpa, schema: { type: string } }
 *       - { in: query, name: mode, schema: { type: string, enum: [TEST, LIVE] } }
 *       - { in: query, name: isActive, schema: { type: boolean } }
 *       - { in: query, name: page, schema: { type: integer, default: 0 }, description: "0-based" }
 *       - { in: query, name: size, schema: { type: integer, default: 20, maximum: 100 } }
 *       - { in: query, name: sortDir, schema: { type: string, enum: [asc, desc], default: desc } }
 *     responses:
 *       200:
 *         description: Paginated QR list
 *         content:
 *           application/json:
 *             example:
 *               status: success
 *               data:
 *                 data: []
 *                 pagination:
 *                   total_elements: 0
 *                   has_previous: false
 *                   has_next: false
 *                   total_pages: 0
 *                   current_page: 0
 *                   page_size: 20
 *                 success: true
 *                 filters: {}
 *       403: { description: Insufficient permissions }
 */
async function listQrCodes(req, res) {
  try {
    const payload = await outletQrService.listQrCodes({ query: req.query });
    // Straight through — see the envelope note in the file header.
    return res.json(APIResponse.success(payload));
  } catch (error) {
    return fail(res, error, "Failed to list outlet QRs", "QR_LIST_FAILED");
  }
}

/**
 * @swagger
 * /api/v1/wallet/topup/qr/codes/mine:
 *   get:
 *     tags: [Static QR]
 *     summary: The authenticated outlet's own payment QR
 *     description: |
 *       Returns the caller's ACTIVE QR, including `qrPayload` / `qrImageUrl` so
 *       the outlet can render and print it.
 *
 *       **Identity comes from the JWT, never from a query parameter.** A
 *       `?walletUserId=` here would be a horizontal-privilege hole: any outlet
 *       could read another outlet's QR payload and start collecting money into
 *       someone else's wallet. Resolution goes through
 *       `walletIdentity.resolveForSelf`, which needs a phone number on the
 *       account (**400** `WALLET_IDENTITY_UNAVAILABLE` otherwise).
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200: { description: The outlet's active QR }
 *       400: { description: WALLET_IDENTITY_UNAVAILABLE }
 *       404: { description: QR_NOT_PROVISIONED }
 */
async function getMyQrCode(req, res) {
  try {
    const qr = await outletQrService.getMyQrCode({ user: req.user });
    return res.json(APIResponse.success(qr));
  } catch (error) {
    return fail(
      res,
      error,
      "Failed to load your payment QR",
      "QR_FETCH_FAILED",
    );
  }
}

/**
 * @swagger
 * /api/v1/wallet/topup/qr/codes/{id}:
 *   patch:
 *     tags: [Static QR]
 *     summary: Update the mutable fields of a QR
 *     description: |
 *       Only presentation fields (`label`, `outletName`, `qrPayload`,
 *       `qrImageUrl`), the velocity/alerting signals and `mode` are mutable.
 *
 *       **A QR is NEVER repointed to another outlet.** `walletUserId`,
 *       `clientCode` and `subjectUserId` are refused with **400**
 *       `QR_REPOINT_FORBIDDEN`, because repointing would retro-actively change
 *       the meaning of every collection that already snapshotted this QR's
 *       identity — yesterday's settled payments would start claiming they went
 *       somewhere they never went. To move a QR, deactivate it and issue a new
 *       one.
 *
 *       A `mode` change is audited SEPARATELY as `OUTLET_QR_MODE_CHANGED`: it
 *       decides whether payments on this QR credit real money.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               label: { type: string }
 *               outletName: { type: string }
 *               qrPayload: { type: string }
 *               qrImageUrl: { type: string }
 *               mode: { type: string, enum: [TEST, LIVE] }
 *               maxPerCreditAmount: { type: number }
 *               maxPerDayAmount: { type: number }
 *               maxPerDayCount: { type: integer }
 *     responses:
 *       200: { description: Updated QR }
 *       400: { description: Validation failed / QR_REPOINT_FORBIDDEN }
 *       404: { description: QR_NOT_FOUND }
 *       409: { description: QR_IDENTIFIER_ALREADY_ACTIVE }
 */
async function updateQrCode(req, res) {
  try {
    const { ip, userAgent } = requestMeta(req);
    const qr = await outletQrService.updateQrCode({
      id: req.params.id,
      patch: req.body,
      actor: req.user,
      ip,
      userAgent,
    });

    return res.json(APIResponse.success(qr));
  } catch (error) {
    return fail(res, error, "Failed to update outlet QR", "QR_UPDATE_FAILED");
  }
}

/**
 * @swagger
 * /api/v1/wallet/topup/qr/codes/{id}/deactivate:
 *   post:
 *     tags: [Static QR]
 *     summary: Retire a payment QR
 *     description: |
 *       Sets `isActive = false` and stamps `deactivatedAt` / `deactivatedBy`.
 *       This is the only way a QR leaves service, and HALF of the repointing
 *       procedure (deactivate, then issue a new row).
 *
 *       **Idempotent** — deactivating an already-inactive QR returns the row
 *       unchanged rather than a 409, and writes no second audit line.
 *
 *       Payments on the retired identifier keep arriving (the sticker is still
 *       on the counter) and will land UNATTRIBUTED with reason `INACTIVE_QR`
 *       until a replacement row exists. That is deliberate: the system must
 *       never act on a retired QR, but an admin still sees "this looks like
 *       outlet X's retired QR" in the unattributed queue.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: QR deactivated (or already inactive) }
 *       404: { description: QR_NOT_FOUND }
 */
async function deactivateQrCode(req, res) {
  try {
    const { ip, userAgent } = requestMeta(req);
    const qr = await outletQrService.deactivateQrCode({
      id: req.params.id,
      actor: req.user,
      ip,
      userAgent,
    });

    return res.json(APIResponse.success(qr));
  } catch (error) {
    return fail(
      res,
      error,
      "Failed to deactivate outlet QR",
      "QR_DEACTIVATE_FAILED",
    );
  }
}

/* ------------------------------------------------------------------ *
 * Collections
 * ------------------------------------------------------------------ */

/**
 * @swagger
 * /api/v1/wallet/topup/qr/collections:
 *   get:
 *     tags: [Static QR]
 *     summary: List static-QR collections
 *     description: |
 *       Every inbound static-QR payment, matched or not — webhook, import,
 *       manual and poll alike. Unmatched rows are recorded too: money that
 *       arrived must be on the books even when we cannot yet say whose it is.
 *
 *       `rawPayload` (the provider's verbatim body, which can carry payer PII)
 *       is never returned. Pagination rides inside `data`, 0-based.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [UNATTRIBUTED, ASSIGN_PENDING, ATTRIBUTED, CREDIT_PENDING, CREDITED, REJECTED, IGNORED] } }
 *       - { in: query, name: source, schema: { type: string, enum: [WEBHOOK, IMPORT, MANUAL, POLL] } }
 *       - { in: query, name: provider, schema: { type: string } }
 *       - { in: query, name: qrIdentifier, schema: { type: string } }
 *       - { in: query, name: walletUserId, schema: { type: string } }
 *       - { in: query, name: utr, schema: { type: string } }
 *       - { in: query, name: needsManualAction, schema: { type: boolean } }
 *       - { in: query, name: startDate, schema: { type: string, format: date-time } }
 *       - { in: query, name: endDate, schema: { type: string, format: date-time } }
 *       - { in: query, name: page, schema: { type: integer, default: 0 }, description: "0-based" }
 *       - { in: query, name: size, schema: { type: integer, default: 20, maximum: 100 } }
 *       - { in: query, name: sortDir, schema: { type: string, enum: [asc, desc], default: desc } }
 *     responses:
 *       200: { description: Paginated collection list }
 *       403: { description: Insufficient permissions }
 */
async function listCollections(req, res) {
  try {
    const payload = await qrCollectionService.listCollections(req.query);
    return res.json(APIResponse.success(payload));
  } catch (error) {
    return fail(
      res,
      error,
      "Failed to list QR collections",
      "QR_COLLECTION_LIST_FAILED",
    );
  }
}

/**
 * @swagger
 * /api/v1/wallet/topup/qr/collections/unattributed:
 *   get:
 *     tags: [Static QR]
 *     summary: The ops queue — collections that cannot yet be credited
 *     description: |
 *       Forces `status = UNATTRIBUTED`; a `status` in the query string is
 *       ignored, so this endpoint can never be widened into a general list by a
 *       crafted query.
 *
 *       `UNATTRIBUTED` is a SUPERSET of "no QR matched": a UTR-less collection
 *       that DID match a QR is parked here on purpose, because without a UTR
 *       the idempotency key is only a content hash and no such row may reach an
 *       automatic credit before a human confirms it. `unattributedReason` says
 *       which case a row is (`NO_QR_MATCH`, `INACTIVE_QR`, `NO_UTR`).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: query, name: qrIdentifier, schema: { type: string } }
 *       - { in: query, name: utr, schema: { type: string } }
 *       - { in: query, name: source, schema: { type: string, enum: [WEBHOOK, IMPORT, MANUAL, POLL] } }
 *       - { in: query, name: startDate, schema: { type: string, format: date-time } }
 *       - { in: query, name: endDate, schema: { type: string, format: date-time } }
 *       - { in: query, name: page, schema: { type: integer, default: 0 } }
 *       - { in: query, name: size, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       200: { description: Paginated unattributed queue }
 *       403: { description: Insufficient permissions }
 */
async function listUnattributed(req, res) {
  try {
    const payload = await qrCollectionService.listUnattributed(req.query);
    return res.json(APIResponse.success(payload));
  } catch (error) {
    return fail(
      res,
      error,
      "Failed to list unattributed QR collections",
      "QR_COLLECTION_LIST_FAILED",
    );
  }
}

/**
 * @swagger
 * /api/v1/wallet/topup/qr/collections/mine:
 *   get:
 *     tags: [Static QR]
 *     summary: The authenticated outlet's own QR collections
 *     description: |
 *       The same list as `/collections`, scoped to the caller's wallet.
 *
 *       `walletUserId` is resolved from the JWT via
 *       `walletIdentity.resolveForSelf` and OVERWRITES anything supplied in the
 *       query string, so this endpoint cannot be pointed at another outlet's
 *       payment history.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: query, name: status, schema: { type: string } }
 *       - { in: query, name: startDate, schema: { type: string, format: date-time } }
 *       - { in: query, name: endDate, schema: { type: string, format: date-time } }
 *       - { in: query, name: page, schema: { type: integer, default: 0 } }
 *       - { in: query, name: size, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       200: { description: Paginated collection list for the caller's wallet }
 *       400: { description: WALLET_IDENTITY_UNAVAILABLE }
 */
async function getMyCollections(req, res) {
  try {
    const identity = resolveForSelf(req.user);

    const payload = await qrCollectionService.listCollections({
      ...req.query,
      // FORCED, not defaulted — see the description above.
      walletUserId: identity.walletUserId,
    });

    return res.json(APIResponse.success(payload));
  } catch (error) {
    return fail(
      res,
      error,
      "Failed to list your QR collections",
      "QR_COLLECTION_LIST_FAILED",
    );
  }
}

/**
 * @swagger
 * /api/v1/wallet/topup/qr/collections/manual:
 *   post:
 *     tags: [Static QR]
 *     summary: Hand-enter a static-QR collection
 *     description: |
 *       For money the provider never delivered to us (a missing webhook, a
 *       payment visible only on the bank statement). The row goes through the
 *       SAME `ingestCollection` path as every other source, so dedupe, the
 *       never-guess match and the audit trail are identical.
 *
 *       **`amount` is in RUPEES** and is converted to integer paise exactly
 *       once, here, by decimal-string arithmetic. More than 2 decimal places is
 *       a **400** `INVALID_AMOUNT`, never a silent round — a rounded paise
 *       value would later fail the paise-exact check in the credit path and
 *       park a good payment.
 *
 *       `utr` is required (it is the only strong idempotency key) and `remarks`
 *       is required (a human assertion that money arrived must carry its
 *       justification into the audit trail). Supply `qrIdentifier`, or
 *       `walletUserId` and the outlet's ACTIVE QR identifier is resolved for
 *       you.
 *
 *       Re-entering the same UTR is a **200** no-op reporting
 *       `duplicate: true` — not an error and never a second credit.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [utr, amount, remarks]
 *             properties:
 *               utr: { type: string, example: "UTR2024081512345678" }
 *               amount: { type: number, example: 1499.99, description: "RUPEES" }
 *               qrIdentifier: { type: string, example: "STORE-AND-001" }
 *               walletUserId: { type: string, example: "9876543210" }
 *               payerVpa: { type: string }
 *               payerName: { type: string }
 *               txnAt: { type: string, format: date-time }
 *               providerTxnId: { type: string }
 *               provider: { type: string }
 *               remarks: { type: string, minLength: 5 }
 *     responses:
 *       201: { description: Collection recorded }
 *       200: { description: Duplicate UTR — no-op, no second credit }
 *       400: { description: Validation failed / INVALID_AMOUNT / QR_UNRESOLVED }
 *       403: { description: Insufficient permissions }
 */
async function createManualCollection(req, res) {
  try {
    const body = req.body;

    // THE ONE RUPEE -> PAISE CONVERSION. Decimal-string arithmetic; `null`
    // means "not an exact rupee amount", which is a 400, not a round.
    const amountPaise = parseAmountToPaise(body.amount);
    if (amountPaise === null || amountPaise <= 0) {
      return res
        .status(400)
        .json(
          APIResponse.error(
            "amount must be a positive rupee value with at most 2 decimal places",
            "INVALID_AMOUNT",
            { amount: body.amount },
            400,
          ),
        );
    }

    // An operator often knows the outlet but not the QR string. Resolving the
    // identifier from the wallet keeps `ingestCollection`'s exact-match rule
    // intact — we never hand it a guess.
    let qrIdentifier = body.qrIdentifier || null;
    if (!qrIdentifier && body.walletUserId) {
      const qr = await outletQrService.resolveQrForWallet({
        walletUserId: body.walletUserId,
        provider: body.provider,
      });

      if (!qr) {
        return res
          .status(400)
          .json(
            APIResponse.error(
              "That outlet has no ACTIVE payment QR, so this collection cannot be attributed. Supply qrIdentifier explicitly, or provision a QR first.",
              "QR_UNRESOLVED",
              { walletUserId: body.walletUserId },
              400,
            ),
          );
      }

      qrIdentifier = qr.qrIdentifier;
    }

    const outcome = await qrCollectionService.ingestCollection({
      provider: body.provider,
      source: "MANUAL",
      utr: body.utr,
      providerTxnId: body.providerTxnId || null,
      qrIdentifier,
      payerVpa: body.payerVpa || null,
      payerName: body.payerName || null,
      amountPaise,
      txnAt: body.txnAt || null,
      actorUserId: req.user && req.user.id,
      metadata: {
        remarks: body.remarks,
        enteredBy: (req.user && req.user.id) || null,
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null,
      },
    });

    const payload = {
      collection: qrCollectionService.serializeCollection(outcome.collection),
      duplicate: outcome.duplicate,
      matched: outcome.matched,
      status: outcome.status,
    };

    // A duplicate is a 200 no-op, not a 201 creation and not an error:
    // re-keying a UTR an operator is unsure about is the normal way of checking.
    return res
      .status(outcome.duplicate ? 200 : 201)
      .json(APIResponse.success(payload));
  } catch (error) {
    return fail(
      res,
      error,
      "Failed to record manual QR collection",
      "QR_MANUAL_COLLECTION_FAILED",
    );
  }
}

/**
 * @swagger
 * /api/v1/wallet/topup/qr/collections/import:
 *   post:
 *     tags: [Static QR]
 *     summary: Import already-parsed settlement rows
 *     description: |
 *       Bulk ingestion of rows in `ingestCollection` shape (`amountPaise` is
 *       INTEGER PAISE here — the caller has already done the conversion).
 *
 *       Per-row try/catch: one bad row never aborts a batch of a thousand good
 *       ones. **A duplicate is a first-class outcome, not a failure** —
 *       re-importing yesterday's file is the normal way an operator makes sure
 *       nothing was missed, and must read as "40 already had, 3 new".
 *
 *       `dryRun: true` resolves and dedupe-checks every row and WRITES NOTHING;
 *       it is the only thing standing between an operator and importing the
 *       wrong bank statement.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rows]
 *             properties:
 *               rows:
 *                 type: array
 *                 maxItems: 5000
 *                 items:
 *                   type: object
 *                   required: [amountPaise]
 *                   properties:
 *                     utr: { type: string }
 *                     amountPaise: { type: integer, description: "INTEGER PAISE" }
 *                     qrIdentifier: { type: string }
 *                     payerVpa: { type: string }
 *                     payerName: { type: string }
 *                     txnAt: { type: string, format: date-time }
 *                     providerTxnId: { type: string }
 *               dryRun: { type: boolean, default: false }
 *     responses:
 *       200: { description: Import report }
 *       400: { description: Validation failed }
 *       403: { description: Insufficient permissions }
 */
async function importCollections(req, res) {
  try {
    const report = await qrCollectionService.importCollections(req.body.rows, {
      source: "IMPORT",
      actorUserId: req.user && req.user.id,
      dryRun: Boolean(req.body.dryRun),
    });

    return res.json(APIResponse.success(report));
  } catch (error) {
    return fail(
      res,
      error,
      "Failed to import QR collections",
      "QR_IMPORT_FAILED",
    );
  }
}

/**
 * @swagger
 * /api/v1/wallet/topup/qr/collections/import-csv:
 *   post:
 *     tags: [Static QR]
 *     summary: Import a UPI/QR settlement CSV
 *     description: |
 *       Parses the CSV text with `utils/csvParser.parseCsvQrCollections` (which
 *       converts the file's RUPEE amounts to integer paise by decimal-string
 *       arithmetic) and feeds the rows through the same importer as
 *       `/collections/import`.
 *
 *       **The parser's per-LINE errors are merged into the report** alongside
 *       the importer's per-ROW failures, as `parseErrors` plus a combined
 *       `errors` list, so an operator sees "line 7: invalid amount" and "row 3:
 *       ..." in one place. A report that showed only half the failures would
 *       leave an operator believing a file imported cleanly when it did not.
 *
 *       Header names are matched flexibly (`utr`/`rrn`/`bankrrn`,
 *       `amount`/`credit`, `qrid`/`storeid`/`terminalid`, ...). A file with no
 *       amount column, or with neither a UTR nor a QR column, fails as a whole.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [csv]
 *             properties:
 *               csv: { type: string, description: "Raw CSV text, max 5MB" }
 *               dryRun: { type: boolean, default: false }
 *     responses:
 *       200: { description: Import report with parseErrors merged in }
 *       400: { description: Validation failed / CSV_NO_ROWS }
 *       403: { description: Insufficient permissions }
 */
async function importCollectionsCsv(req, res) {
  try {
    const { rows, errors: parseErrors } = parseCsvQrCollections(req.body.csv);

    if (!rows || rows.length === 0) {
      return res
        .status(400)
        .json(
          APIResponse.error(
            "No importable rows were found in the CSV",
            "CSV_NO_ROWS",
            { parseErrors: parseErrors || [] },
            400,
          ),
        );
    }

    const report = await qrCollectionService.importCollections(rows, {
      source: "IMPORT",
      actorUserId: req.user && req.user.id,
      dryRun: Boolean(req.body.dryRun),
    });

    const lineErrors = parseErrors || [];

    // MERGED, not appended alongside: `errors` is the single list an operator
    // reads, and `parseErrorCount` keeps the parse failures countable on their
    // own. `failureCount` stays the IMPORTER's number so it still lines up with
    // `total`, which counts only the rows that reached the importer.
    return res.json(
      APIResponse.success({
        ...report,
        parsedRows: rows.length,
        parseErrorCount: lineErrors.length,
        parseErrors: lineErrors,
        errors: [
          ...lineErrors.map((e) => ({
            scope: "PARSE",
            line: e.line,
            error: e.error,
          })),
          ...report.failed.map((f) => ({
            scope: "IMPORT",
            index: f.index,
            utr: f.utr,
            error: f.error,
          })),
        ],
      }),
    );
  } catch (error) {
    return fail(
      res,
      error,
      "Failed to import QR collections from CSV",
      "QR_CSV_IMPORT_FAILED",
    );
  }
}

/* ------------------------------------------------------------------ *
 * Assignment of an UNATTRIBUTED collection (maker-checker)
 * ------------------------------------------------------------------ */

/**
 * @swagger
 * /api/v1/wallet/topup/qr/collections/{id}/assign:
 *   post:
 *     tags: [Static QR]
 *     summary: Assign an unattributed QR payment to a wallet
 *     description: |
 *       **THE MAKER STEP.** Requires `wallet:manage:all`. This endpoint moves
 *       no money itself: it raises a `ManualTopupRequest`, which is where the
 *       per-transaction cap, the per-user daily cap, the policy snapshot, the
 *       deterministic `MANUAL_<id>` idempotency key and the maker-checker
 *       threshold all live.
 *
 *       `reason` (min 10 chars) is MANDATORY. The amount is taken from the
 *       collection row, never from the payload.
 *
 *       * **200** — below `policy.manualApprovalThreshold`: credited at once,
 *         collection `CREDITED`.
 *       * **202** — at or above the threshold: parked at `PENDING_APPROVAL`
 *         for a **superadmin other than the requester**; the collection stays
 *         `ASSIGN_PENDING` until that review settles.
 *       * **409** `QR_COLLECTION_NOT_ASSIGNABLE` — the row is no longer
 *         `UNATTRIBUTED` (someone else claimed it).
 *       * **409** `QR_COLLECTION_ALREADY_ASSIGNED` — already linked to a request.
 *       * **422** `MANUAL_TOPUP_CAP_EXCEEDED` / `MANUAL_TOPUP_DAILY_CAP_EXCEEDED`
 *         / `ASSIGN_REASON_REQUIRED`.
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [walletUserId, reason]
 *             properties:
 *               walletUserId:
 *                 type: string
 *                 description: External wallet id (phone for outlet users)
 *                 example: "9876543210"
 *               clientCode: { type: string, example: "DEFAULT" }
 *               subjectUserId: { type: string, format: uuid }
 *               outletPaymentQrId:
 *                 type: string
 *                 format: uuid
 *                 description: >
 *                   Records which QR this payment is read as. Does NOT create
 *                   or repoint an OutletPaymentQr row.
 *               reason:
 *                 type: string
 *                 minLength: 10
 *                 example: "Payer confirmed on call; matches outlet ledger entry"
 *     responses:
 *       200: { description: Assigned and credited (below threshold) }
 *       202: { description: Assigned, awaiting superadmin approval }
 *       409: { description: Not assignable, or already assigned }
 *       422: { description: Cap breach or missing reason }
 */
async function assignCollection(req, res) {
  try {
    const { ip, userAgent } = requestMeta(req);

    const result = await qrAssignmentService.assignUnattributed({
      collectionId: req.params.id,
      walletUserId: req.body.walletUserId,
      clientCode: req.body.clientCode,
      subjectUserId: req.body.subjectUserId,
      outletPaymentQrId: req.body.outletPaymentQrId,
      reason: req.body.reason,
      actor: req.user,
      ip,
      userAgent,
    });

    // 202 == "accepted, awaiting a checker" — the same contract the manual
    // top-up endpoint uses, so the UI branches on the status code alone.
    const statusCode = result.requiresApproval ? 202 : 200;

    return res
      .status(statusCode)
      .json(
        APIResponse.success(
          result,
          result.requiresApproval
            ? "Assignment recorded and sent to a superadmin for approval"
            : "QR payment assigned and wallet credited successfully",
        ),
      );
  } catch (error) {
    return fail(
      res,
      error,
      "Failed to assign the QR collection",
      "QR_COLLECTION_ASSIGN_FAILED",
    );
  }
}

/**
 * @swagger
 * /api/v1/wallet/topup/qr/collections/{id}/reject:
 *   post:
 *     tags: [Static QR]
 *     summary: Reject an unattributed QR payment ("not our money")
 *     description: |
 *       Terminal, and it **never credits** — there is no call to the wallet API
 *       anywhere on this path. Requires `wallet:approve:all`, which the `admin`
 *       role deliberately does not hold, so this is superadmin-only; the
 *       service asserts the role a second time.
 *
 *       `remarks` (min 10 chars) is MANDATORY.
 *
 *       A collection whose `ManualTopupRequest` is still reviewable is refused
 *       with **409** `QR_COLLECTION_HAS_PENDING_REQUEST`: reject that request
 *       first, which returns the collection to `UNATTRIBUTED`, then reject it.
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [remarks]
 *             properties:
 *               remarks: { type: string, minLength: 10 }
 *     responses:
 *       200: { description: Collection rejected }
 *       403: { description: SUPERADMIN_REQUIRED }
 *       409: { description: Not rejectable, or a review is still pending }
 *       422: { description: REJECT_REMARKS_REQUIRED }
 */
async function rejectCollection(req, res) {
  try {
    const { ip, userAgent } = requestMeta(req);

    const result = await qrAssignmentService.rejectCollection({
      collectionId: req.params.id,
      remarks: req.body.remarks,
      actor: req.user,
      ip,
      userAgent,
    });

    return res.json(
      APIResponse.success(result, "QR collection rejected successfully"),
    );
  } catch (error) {
    return fail(
      res,
      error,
      "Failed to reject the QR collection",
      "QR_COLLECTION_REJECT_FAILED",
    );
  }
}

module.exports = {
  // Registry
  createQrCode,
  listQrCodes,
  getMyQrCode,
  updateQrCode,
  deactivateQrCode,
  // Collections
  listCollections,
  listUnattributed,
  getMyCollections,
  createManualCollection,
  importCollections,
  importCollectionsCsv,
  // Assignment (maker-checker)
  assignCollection,
  rejectCollection,
};
