/**
 * Manual Top-up Controller — Wave 3.3
 *
 * THIN BY MANDATE. Every rule — the per-transaction cap, the daily cap, the
 * maker-checker threshold, the superadmin-only review gate, the self-approval
 * ban, the guarded state transition, idempotency and audit logging — lives in
 * `services/payments/manualTopupService.js`. These handlers do three things and
 * nothing else: read the request context, call the service, map the outcome to
 * an HTTP status.
 *
 * ERROR SHAPE — READ THIS BEFORE COPYING ANOTHER CONTROLLER IN THIS SERVICE.
 * `APIResponse.error(message, code, details, statusCode)` takes the machine
 * code SECOND. Several older controllers here (and `middleware/validate.js`)
 * call it as `APIResponse.error(msg, 400, details)`, which writes the NUMBER
 * 400 into `error.code` and shifts `details` into the `details` slot only by
 * luck. The manual top-up UI branches on `data.error.code`
 * (MANUAL_TOPUP_CAP_EXCEEDED vs SELF_APPROVAL_FORBIDDEN vs ALREADY_REVIEWED)
 * and renders `data.error.details`, so that bug is not reproduced here.
 */

const manualTopupService = require("../services/payments/manualTopupService");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");

/** Audit context carried into every state change. */
function requestMeta(req) {
  return {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  };
}

/**
 * Single error mapper. 5xx logs a stack (we broke), 4xx logs a warning (the
 * caller or a policy refused) — a cap breach is normal traffic, not an incident.
 *
 * @param {Object} res
 * @param {Error} error
 * @param {string} fallbackMessage
 */
function fail(res, error, fallbackMessage) {
  const statusCode = error.statusCode || 500;
  const code = error.code || "MANUAL_TOPUP_ERROR";

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

/**
 * @swagger
 * /api/v1/wallet/topup/manual:
 *   post:
 *     tags: [Manual Top-up]
 *     summary: Raise a manual (offline) wallet top-up
 *     description: |
 *       Credits a wallet for money received OUTSIDE any payment gateway
 *       (NEFT/RTGS, cheque, cash deposit). Three safeguards apply:
 *
 *       1. **Reason + external reference are mandatory** — `reason` (min 10
 *          chars) and `externalReference` (min 3 chars, the bank UTR / cheque /
 *          receipt number) are persisted on the manual-credit register.
 *       2. **Per-transaction cap** — an amount above
 *          `policy.manualMaxPerTransaction` is rejected with **422**
 *          `MANUAL_TOPUP_CAP_EXCEEDED`. An optional per-user daily cap yields
 *          **422** `MANUAL_TOPUP_DAILY_CAP_EXCEEDED`.
 *       3. **Maker-checker** — an amount at or above
 *          `policy.manualApprovalThreshold` is parked in `PENDING_APPROVAL`
 *          (**202**) and can only be approved by a *superadmin* other than the
 *          requester. Below the threshold the credit lands immediately (**200**).
 *
 *       A row is written in BOTH cases, so the manual-credit register is
 *       complete for audit even for small, instantly-credited amounts.
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
 *             required: [walletUserId, amount, reason, externalReference]
 *             properties:
 *               walletUserId:
 *                 type: string
 *                 description: External wallet id (phone for outlet users)
 *                 example: "9876543210"
 *               clientCode:
 *                 type: string
 *                 example: "DEFAULT"
 *               subjectUserId:
 *                 type: string
 *                 format: uuid
 *                 description: Local users.id, when a local user row exists
 *               amount:
 *                 type: number
 *                 format: float
 *                 example: 5000
 *               currency:
 *                 type: string
 *                 enum: [INR]
 *                 default: INR
 *               reason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 1000
 *                 example: "NEFT received against invoice INV-2024-1187"
 *               externalReference:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 255
 *                 description: Bank UTR / NEFT reference / cheque number
 *                 example: "UTR2024081512345678"
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Below the approval threshold — wallet credited immediately
 *         content:
 *           application/json:
 *             example:
 *               status: success
 *               data:
 *                 requestId: "550e8400-e29b-41d4-a716-446655440000"
 *                 status: "CREDITED"
 *                 requiresApproval: false
 *                 amount: 5000
 *                 currency: "INR"
 *                 walletUserId: "9876543210"
 *                 alreadyCredited: false
 *                 transaction: { transaction_id: "TXN123456" }
 *       202:
 *         description: At or above the approval threshold — parked for a superadmin
 *         content:
 *           application/json:
 *             example:
 *               status: success
 *               data:
 *                 requestId: "550e8400-e29b-41d4-a716-446655440000"
 *                 status: "PENDING_APPROVAL"
 *                 requiresApproval: true
 *                 threshold: 25000
 *                 amount: 50000
 *                 transaction: null
 *       400:
 *         description: Validation failed (missing/short reason or reference)
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Missing wallet:manage:all
 *       422:
 *         description: Policy breach — per-transaction or daily cap exceeded
 *         content:
 *           application/json:
 *             example:
 *               status: error
 *               error:
 *                 code: "MANUAL_TOPUP_CAP_EXCEEDED"
 *                 message: "Manual top-up amount 250000 exceeds the per-transaction cap of 100000."
 *                 details: { cap: 100000, amount: 250000 }
 *       502:
 *         description: Request recorded but the external wallet credit failed (retryable)
 */
async function createManualTopup(req, res) {
  try {
    const { ip, userAgent } = requestMeta(req);

    const result = await manualTopupService.requestManualTopup({
      actor: req.user,
      body: req.body,
      ip,
      userAgent,
    });

    // 202 Accepted is the honest code for the maker-checker path: the
    // instruction is recorded, no money has moved, a human still has to act.
    const statusCode = result.requiresApproval ? 202 : 200;

    return res
      .status(statusCode)
      .json(
        APIResponse.success(
          result,
          result.requiresApproval
            ? "Manual top-up request submitted for superadmin approval"
            : "Manual top-up credited successfully",
        ),
      );
  } catch (error) {
    return fail(res, error, "Failed to create manual top-up request");
  }
}

/**
 * @swagger
 * /api/v1/wallet/topup/manual:
 *   get:
 *     tags: [Manual Top-up]
 *     summary: List manual top-up requests (the manual-credit register)
 *     description: |
 *       Every manual credit ever raised, in any status, with its reason,
 *       external reference, requester and reviewer.
 *
 *       **Pagination is 0-based and rides inside `data`** (`data.pagination`,
 *       snake_case) rather than in `meta`, because the frontend unwraps
 *       `response.data` before the component sees it.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 0, default: 0 }
 *         description: 0-based page index
 *       - in: query
 *         name: size
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: sortDir
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING_APPROVAL, APPROVED, REJECTED, CREDITED, FAILED]
 *       - in: query
 *         name: walletUserId
 *         schema: { type: string }
 *       - in: query
 *         name: clientCode
 *         schema: { type: string }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Manual top-up requests retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               status: success
 *               data:
 *                 data:
 *                   - id: "550e8400-e29b-41d4-a716-446655440000"
 *                     walletUserId: "9876543210"
 *                     amount: 50000
 *                     status: "PENDING_APPROVAL"
 *                     reason: "NEFT received against invoice INV-2024-1187"
 *                     externalReference: "UTR2024081512345678"
 *                 pagination:
 *                   total_elements: 1
 *                   has_previous: false
 *                   has_next: false
 *                   total_pages: 1
 *                   current_page: 0
 *                   page_size: 20
 *                 success: true
 *                 filters: { status: null, walletUserId: null }
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Missing wallet:read:all
 */
async function listManualTopups(req, res) {
  try {
    const result = await manualTopupService.list({
      query: req.query,
      actor: req.user,
    });

    return res.json(
      APIResponse.success(
        result,
        "Manual top-up requests retrieved successfully",
      ),
    );
  } catch (error) {
    return fail(res, error, "Failed to list manual top-up requests");
  }
}

/**
 * @swagger
 * /api/v1/wallet/topup/manual/pending:
 *   get:
 *     tags: [Manual Top-up]
 *     summary: The superadmin approval queue
 *     description: |
 *       Manual top-ups in `PENDING_APPROVAL` only. The `status` query parameter
 *       is deliberately IGNORED here, so this endpoint can never be widened
 *       into a general list by a crafted query string.
 *
 *       Same 0-based `data.pagination` envelope as `GET /topup/manual`.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 0, default: 0 }
 *       - in: query
 *         name: size
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: sortDir
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - in: query
 *         name: walletUserId
 *         schema: { type: string }
 *       - in: query
 *         name: clientCode
 *         schema: { type: string }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Pending approvals retrieved successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Missing wallet:approve:all (superadmin only)
 */
async function listPendingApprovals(req, res) {
  try {
    const result = await manualTopupService.listPending({
      query: req.query,
      actor: req.user,
    });

    return res.json(
      APIResponse.success(
        result,
        "Pending manual top-up approvals retrieved successfully",
      ),
    );
  } catch (error) {
    return fail(res, error, "Failed to list pending manual top-up approvals");
  }
}

/**
 * @swagger
 * /api/v1/wallet/topup/manual/{requestId}/approve:
 *   post:
 *     tags: [Manual Top-up]
 *     summary: Approve a pending manual top-up and credit the wallet
 *     description: |
 *       **SUPERADMIN ONLY — the checker half of maker-checker.** Enforced three
 *       independent ways:
 *
 *       1. the route requires `wallet:approve:all`, which the `admin` role
 *          deliberately does NOT hold;
 *       2. the service asserts `req.user.role === "superadmin"` explicitly
 *          (403 `SUPERADMIN_REQUIRED`) — `requireRole` cannot express this
 *          because it short-circuits for `admin`;
 *       3. the requester may never review their own request
 *          (403 `SELF_APPROVAL_FORBIDDEN`).
 *
 *       The status transition is guarded in SQL, so two simultaneous approvals
 *       produce one credit and one **409** `ALREADY_REVIEWED`. The external
 *       credit uses a deterministic `reference_id`, so a retry after a failure
 *       cannot double-credit.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reviewRemarks:
 *                 type: string
 *                 maxLength: 1000
 *                 example: "Verified against the bank statement of 15-Aug"
 *     responses:
 *       200:
 *         description: Approved and credited
 *         content:
 *           application/json:
 *             example:
 *               status: success
 *               data:
 *                 requestId: "550e8400-e29b-41d4-a716-446655440000"
 *                 status: "CREDITED"
 *                 amount: 50000
 *                 alreadyCredited: false
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: |
 *           `SUPERADMIN_REQUIRED` (not a superadmin) or
 *           `SELF_APPROVAL_FORBIDDEN` (you raised this request)
 *       404:
 *         description: MANUAL_TOPUP_NOT_FOUND
 *       409:
 *         description: ALREADY_REVIEWED — the request is no longer pending
 *         content:
 *           application/json:
 *             example:
 *               status: error
 *               error:
 *                 code: "ALREADY_REVIEWED"
 *                 message: "This manual top-up request has already been reviewed (current status: CREDITED)."
 *                 details: { requestId: "550e8400-...", currentStatus: "CREDITED" }
 *       502:
 *         description: Approved but the external wallet credit failed (retryable)
 */
async function approveManualTopup(req, res) {
  try {
    const { ip, userAgent } = requestMeta(req);

    const result = await manualTopupService.approve({
      requestId: req.params.requestId,
      reviewer: req.user,
      reviewRemarks: req.body?.reviewRemarks,
      ip,
      userAgent,
    });

    return res.json(
      APIResponse.success(
        result,
        "Manual top-up approved and wallet credited successfully",
      ),
    );
  } catch (error) {
    return fail(res, error, "Failed to approve manual top-up request");
  }
}

/**
 * @swagger
 * /api/v1/wallet/topup/manual/{requestId}/reject:
 *   post:
 *     tags: [Manual Top-up]
 *     summary: Reject a pending manual top-up
 *     description: |
 *       **SUPERADMIN ONLY**, same three gates as approve. `reviewRemarks` is
 *       REQUIRED (min 10 chars) because the rejection reason is the entire
 *       audit value of a rejection.
 *
 *       This path NEVER touches money — there is no external wallet call
 *       anywhere in it.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reviewRemarks]
 *             properties:
 *               reviewRemarks:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 1000
 *                 example: "No matching credit found in the bank statement"
 *     responses:
 *       200:
 *         description: Rejected
 *         content:
 *           application/json:
 *             example:
 *               status: success
 *               data:
 *                 requestId: "550e8400-e29b-41d4-a716-446655440000"
 *                 status: "REJECTED"
 *                 reviewRemarks: "No matching credit found in the bank statement"
 *       400:
 *         description: Validation failed — reviewRemarks missing or too short
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: SUPERADMIN_REQUIRED or SELF_APPROVAL_FORBIDDEN
 *       404:
 *         description: MANUAL_TOPUP_NOT_FOUND
 *       409:
 *         description: ALREADY_REVIEWED
 */
async function rejectManualTopup(req, res) {
  try {
    const { ip, userAgent } = requestMeta(req);

    const result = await manualTopupService.reject({
      requestId: req.params.requestId,
      reviewer: req.user,
      reviewRemarks: req.body?.reviewRemarks,
      ip,
      userAgent,
    });

    return res.json(
      APIResponse.success(result, "Manual top-up rejected successfully"),
    );
  } catch (error) {
    return fail(res, error, "Failed to reject manual top-up request");
  }
}

module.exports = {
  createManualTopup,
  listManualTopups,
  listPendingApprovals,
  approveManualTopup,
  rejectManualTopup,
};
