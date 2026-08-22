const { getExternalWalletClient } = require("./externalWalletClient");
const { getRedisClient } = require("../config/redis");
const logger = require("../shared/lib/logger");

// Fixed low-balance threshold (not yet configurable per client/tenant).
const LOW_BALANCE_THRESHOLD = 500;
const LOW_BALANCE_LIST_LIMIT = 20;
const CACHE_TTL_SECONDS = 90;

// Pagination bounds against the external wallet API (wapi.websiteduniya.com).
// The external API has no server-side date-range filter for transactions
// (verified against a live response — `startDate`/`endDate` and the
// documented `from`/`to` params are both silently ignored), so date-range
// filtering happens here in application code by paging through transactions
// (sorted createdAt desc) until we cross the `since` boundary. These caps
// bound how far we'll page if a client/user has an unusually large
// transaction volume still inside the requested range.
const TXN_PAGE_SIZE = 100;
const MAX_TXN_PAGES = 10; // up to 1,000 transactions scanned per request

// Bound on how many wallet-list pages we'll scan when building the
// low-balance list. We ask the external API to sort ascending by balance
// (verified working against a live response) so the lowest-balance wallets
// land on page 0 and we can usually stop after one page once we see a
// balance >= threshold; this cap only matters if a client has an unusually
// large number of wallets under the threshold.
const WALLET_PAGE_SIZE = 100;
const MAX_WALLET_PAGES = 5; // up to 500 wallets scanned

// Transaction `type` values actually emitted by the external wallet API.
// IMPORTANT: this is NOT the local Prisma TransactionType enum
// (DEBIT/CREDIT/REFUND/LOAD_BALANCE/ADJUSTMENT) — verified against live
// responses from the external system (GET transactions/client/LOGISTICS on
// 2026-08-22), which only ever emits TOP_UP, REFUND, and DEBIT. The
// external API's own per-user statistics endpoint
// (transactions/users/{id}/statistics) independently confirms this via its
// `top_up_stats` / `refund_stats` / `debit_stats` breakdown. No CREDIT,
// LOAD_BALANCE, or ADJUSTMENT values were observed; if the external system
// ever introduces one, it simply won't be classified into either bucket
// below (same "don't force-fit" approach the old code took with
// ADJUSTMENT), but will still be visible in the raw per-type counts.
const TOP_UP_TYPES = ["TOP_UP", "REFUND"];
const DEBIT_TYPES = ["DEBIT"];

/**
 * Resolve which external-API scope (client-wide vs single user) the caller
 * is entitled to see, mirroring the two existing controllers rather than
 * inventing a new pattern:
 *  - outlet role: scoped to their own wallet only, keyed by phone number,
 *    exactly like outletWalletController.js's getMyTransactionHistory /
 *    getMyWalletInfo (`req.user.phone`, `req.user.clientCode`).
 *  - every other role (admin/superadmin/client/accounts/sales/support...):
 *    scoped to a clientCode, resolved the same way
 *    adminWalletController.js's getClientWallets/getClientTransactions do
 *    (`req.query.clientCode || DEFAULT_CLIENT_CODE || "DEFAULT"`), except
 *    the query-param override is only honored for admin/superadmin — a
 *    non-admin client-scoped role falls back to their own
 *    `req.user.clientCode` instead of being able to request another
 *    client's data.
 */
function getScopeContext(req) {
  const user = req.user || {};
  const role = user.role || "unknown";

  if (role === "outlet") {
    return {
      mode: "outlet",
      role,
      userId: user.phone,
      clientCode:
        user.clientCode || process.env.DEFAULT_CLIENT_CODE || "DEFAULT",
    };
  }

  const isAdminLike = role === "superadmin" || role === "admin";
  const clientCode =
    (isAdminLike && req.query?.clientCode) ||
    user.clientCode ||
    process.env.DEFAULT_CLIENT_CODE ||
    "DEFAULT";

  return { mode: "client", role, clientCode };
}

/**
 * A cache-key-safe identity for the caller's data scope.
 */
function scopeIdentity(scopeCtx) {
  if (scopeCtx.mode === "outlet") {
    return `outlet:${scopeCtx.userId || "unknown"}`;
  }
  return `client:${scopeCtx.clientCode}`;
}

function dayKeyUTC(date) {
  return new Date(date).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

async function readCache(redis, key) {
  try {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    logger.warn("Dashboard cache read failed", { key, error: error.message });
    return null;
  }
}

async function writeCache(redis, key, value) {
  try {
    await redis.setEx(key, CACHE_TTL_SECONDS, JSON.stringify(value));
  } catch (error) {
    logger.warn("Dashboard cache write failed", {
      key,
      error: error.message,
    });
  }
}

/**
 * Page through a caller's transactions (client-wide via
 * listClientTransactions, or per-user via getUserTransactionHistory for
 * outlet role) sorted newest-first, collecting everything with
 * createdAt >= since. Stops as soon as a page contains a transaction older
 * than `since` (the boundary has been crossed, nothing more can qualify)
 * or the external API reports no further pages, bounded by MAX_TXN_PAGES
 * as a safety cap.
 */
async function fetchTransactionsInRange(externalClient, scopeCtx, since) {
  const collected = [];
  let truncated = false;
  let page = 0;

  while (page < MAX_TXN_PAGES) {
    const resp =
      scopeCtx.mode === "outlet"
        ? await externalClient.getUserTransactionHistory(scopeCtx.userId, {
            page,
            size: TXN_PAGE_SIZE,
          })
        : await externalClient.listClientTransactions(scopeCtx.clientCode, {
            page,
            size: TXN_PAGE_SIZE,
            sortBy: "createdAt",
            sortDir: "desc",
          });

    const items = Array.isArray(resp?.data) ? resp.data : [];
    if (items.length === 0) break;

    let reachedBoundary = false;
    for (const tx of items) {
      if (new Date(tx.createdAt) >= since) {
        collected.push(tx);
      } else {
        reachedBoundary = true;
      }
    }

    const hasNext = resp?.pagination?.has_next === true;
    if (reachedBoundary || !hasNext) {
      break;
    }

    page += 1;
    if (page >= MAX_TXN_PAGES && hasNext) {
      truncated = true;
    }
  }

  return { transactions: collected, truncated };
}

/**
 * Client-wide wallet stats + low-balance list, sourced from
 * listClientWallets. The external API returns a pre-computed `stats` block
 * (total_balance, total_wallets, active/suspended/blocked/closed_wallets)
 * on every call, so a single cheap request (size=1) gives us the totals
 * without summing every wallet ourselves. Low-balance wallets are fetched
 * separately, sorted ascending by balance so the lowest balances land on
 * page 0 and scanning can usually stop after one page.
 */
async function getClientWalletData(externalClient, clientCode) {
  const statsResp = await externalClient.listClientWallets(clientCode, {
    page: 0,
    size: 1,
  });
  const stats = statsResp?.stats || {};

  const lowBalanceWallets = [];
  let truncated = false;
  let page = 0;

  while (page < MAX_WALLET_PAGES) {
    const resp = await externalClient.listClientWallets(clientCode, {
      page,
      size: WALLET_PAGE_SIZE,
      sortBy: "balance",
      sortDir: "asc",
    });
    const items = Array.isArray(resp?.data) ? resp.data : [];
    if (items.length === 0) break;

    let exceededThreshold = false;
    for (const w of items) {
      const balance = Number(w.balance);
      if (balance < LOW_BALANCE_THRESHOLD) {
        lowBalanceWallets.push(w);
      } else {
        // Sorted ascending — once we see one at/above threshold, nothing
        // further on this or later pages can qualify.
        exceededThreshold = true;
        break;
      }
    }

    const hasNext = resp?.pagination?.has_next === true;
    if (exceededThreshold || !hasNext) break;

    page += 1;
    if (page >= MAX_WALLET_PAGES && hasNext) {
      truncated = true;
    }
  }

  lowBalanceWallets.sort((a, b) => Number(a.balance) - Number(b.balance));

  return {
    wallets: {
      count: Number(stats.total_wallets || 0),
      totalBalance: Number(stats.total_balance || 0),
      byStatus: {
        ACTIVE: Number(stats.active_wallets || 0),
        SUSPENDED: Number(stats.suspended_wallets || 0),
        BLOCKED: Number(stats.blocked_wallets || 0),
        CLOSED: Number(stats.closed_wallets || 0),
      },
    },
    lowBalanceWallets: lowBalanceWallets
      .slice(0, LOW_BALANCE_LIST_LIMIT)
      .map((w) => ({
        id: w.id,
        userId: w.user_id,
        balance: Number(w.balance),
        status: w.status,
        clientCode: w.client_code,
      })),
    lowBalanceTruncated: truncated,
  };
}

/**
 * Outlet-role equivalent of getClientWalletData: the caller only has one
 * wallet, resolved via getUserWalletInfo (per outletWalletController.js's
 * getMyWalletInfo), so "wallets" here is always count<=1.
 */
async function getOutletWalletData(externalClient, scopeCtx) {
  const info = await externalClient.getUserWalletInfo(
    scopeCtx.clientCode,
    scopeCtx.userId,
  );
  const wallet = info?.data?.wallet || {};
  const balance = Number(wallet.balance || 0);
  const status = wallet.status || "UNKNOWN";

  const lowBalanceWallets = [];
  if (balance < LOW_BALANCE_THRESHOLD) {
    lowBalanceWallets.push({
      id: info?.data?.id,
      userId: info?.data?.userId,
      balance,
      status,
      clientCode: info?.data?.clientCode,
    });
  }

  return {
    wallets: {
      count: 1,
      totalBalance: balance,
      byStatus: { [status]: 1 },
    },
    lowBalanceWallets,
    lowBalanceTruncated: false,
  };
}

/**
 * GET /dashboard/summary aggregation, sourced from the external wallet API.
 */
async function getSummary(req, days) {
  const scopeCtx = getScopeContext(req);
  const redis = getRedisClient();
  const cacheKey = `wallet:dashboard:summary:${scopeIdentity(scopeCtx)}:${days}`;

  const cached = await readCache(redis, cacheKey);
  if (cached) {
    return cached;
  }

  const externalClient = getExternalWalletClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [walletData, { transactions, truncated: txnTruncated }] =
    await Promise.all([
      scopeCtx.mode === "outlet"
        ? getOutletWalletData(externalClient, scopeCtx)
        : getClientWalletData(externalClient, scopeCtx.clientCode),
      fetchTransactionsInRange(externalClient, scopeCtx, since),
    ]);

  const countsByType = {};
  const countsByStatus = {};
  let topUpSum = 0;
  let debitSum = 0;

  for (const tx of transactions) {
    const type = tx.type || "UNKNOWN";
    const status = tx.status || "UNKNOWN";
    const amount = Number(tx.amount || 0);

    countsByType[type] = (countsByType[type] || 0) + 1;
    countsByStatus[status] = (countsByStatus[status] || 0) + 1;

    if (TOP_UP_TYPES.includes(type)) {
      topUpSum += amount;
    } else if (DEBIT_TYPES.includes(type)) {
      debitSum += amount;
    }
  }

  const result = {
    range: { days, since: since.toISOString() },
    scope:
      scopeCtx.mode === "outlet"
        ? { mode: "outlet", clientCode: scopeCtx.clientCode }
        : { mode: "client", clientCode: scopeCtx.clientCode },
    wallets: walletData.wallets,
    transactions: {
      topUpSum,
      debitSum,
      topUpTypes: TOP_UP_TYPES,
      debitTypes: DEBIT_TYPES,
      countsByType,
      countsByStatus,
      truncated: txnTruncated,
    },
    lowBalance: {
      threshold: LOW_BALANCE_THRESHOLD,
      count: walletData.lowBalanceWallets.length,
      wallets: walletData.lowBalanceWallets,
      truncated: walletData.lowBalanceTruncated,
    },
  };

  await writeCache(redis, cacheKey, result);

  return result;
}

/**
 * GET /dashboard/trend aggregation — daily top-up vs debit totals, sourced
 * from the external wallet API.
 */
async function getTrend(req, days) {
  const scopeCtx = getScopeContext(req);
  const redis = getRedisClient();
  const cacheKey = `wallet:dashboard:trend:${scopeIdentity(scopeCtx)}:${days}`;

  const cached = await readCache(redis, cacheKey);
  if (cached) {
    return cached;
  }

  const externalClient = getExternalWalletClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const { transactions, truncated } = await fetchTransactionsInRange(
    externalClient,
    scopeCtx,
    since,
  );

  const buckets = new Map(); // dayKey -> { date, topUp, debit }

  // Pre-seed every day in range so the frontend gets a continuous series
  // even for days with zero transactions.
  const dayCount = Math.ceil(
    (Date.now() - since.getTime()) / (24 * 60 * 60 * 1000),
  );
  for (let i = 0; i <= dayCount; i++) {
    const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
    const key = dayKeyUTC(d);
    buckets.set(key, { date: key, topUp: 0, debit: 0 });
  }

  for (const tx of transactions) {
    const type = tx.type;
    if (!TOP_UP_TYPES.includes(type) && !DEBIT_TYPES.includes(type)) {
      continue;
    }
    const key = dayKeyUTC(tx.createdAt);
    if (!buckets.has(key)) {
      buckets.set(key, { date: key, topUp: 0, debit: 0 });
    }
    const bucket = buckets.get(key);
    const amount = Number(tx.amount || 0);
    if (TOP_UP_TYPES.includes(type)) {
      bucket.topUp += amount;
    } else {
      bucket.debit += amount;
    }
  }

  const series = Array.from(buckets.values()).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );

  const result = {
    range: { days, since: since.toISOString() },
    scope:
      scopeCtx.mode === "outlet"
        ? { mode: "outlet", clientCode: scopeCtx.clientCode }
        : { mode: "client", clientCode: scopeCtx.clientCode },
    topUpTypes: TOP_UP_TYPES,
    debitTypes: DEBIT_TYPES,
    truncated,
    series,
  };

  await writeCache(redis, cacheKey, result);

  return result;
}

module.exports = {
  getSummary,
  getTrend,
  LOW_BALANCE_THRESHOLD,
  TOP_UP_TYPES,
  DEBIT_TYPES,
};
