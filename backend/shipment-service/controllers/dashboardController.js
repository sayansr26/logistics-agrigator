const axios = require("axios");
const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");
const { ValidationError } = require("../shared/lib/errors");
const { authUtils } = require("../shared/lib/auth");
const redisUtils = require("../shared/lib/redis");
const {
  daysQuerySchema,
  daysLimitQuerySchema,
} = require("../validation/dashboardSchemas");

/**
 * Read-only operations-dashboard aggregation endpoints.
 *
 * Every handler:
 *  - Joi-validates its own query params (the shared `validate()` middleware
 *    only checks `req.body`, so validation happens here to actually work).
 *  - Runs `authUtils.applyScopeFilter(req, where)` BEFORE querying, so an
 *    outlet caller only ever sees its own slice, never an error, never other
 *    tenants' data.
 *  - Caches its result in Redis for ~90s, keyed by route + caller identity +
 *    query params, so repeated dashboard loads don't hammer Postgres.
 *
 * All aggregation is done with Prisma's groupBy/aggregate/count, or by
 * fetching only the minimal columns needed and reducing in application code
 * (e.g. daily trend bucketing) — no raw SQL, per project rules.
 */

const ALL_STATUSES = [
  "CREATED",
  "BOOKED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RTO",
  "NDR",
  "HOLD",
];

const CACHE_TTL_SECONDS = 90;

function validateQuery(schema, query) {
  const { value, error } = schema.validate(query, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    throw new ValidationError(
      "Invalid query parameters",
      error.details.map((d) => d.message),
    );
  }
  return value;
}

function daysToDateFrom(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function callerIdentity(req) {
  const user = req.user || {};
  return {
    id: user.apiCredentialId || user.id || user.userId || "anon",
    role: user.role || "unknown",
    clientId: user.clientId || "none",
  };
}

function buildCacheKey(route, req, query) {
  const identity = callerIdentity(req);
  return `dash:${route}:${identity.id}:${identity.role}:${identity.clientId}:${JSON.stringify(
    query,
  )}`;
}

async function getCached(key) {
  try {
    return await redisUtils.getJSON(key);
  } catch (error) {
    logger.warn("Dashboard cache read failed, continuing without cache", {
      service: "shipment-service",
      key,
      error: error.message,
    });
    return null;
  }
}

async function setCached(key, value) {
  try {
    await redisUtils.setWithExpiry(key, value, CACHE_TTL_SECONDS);
  } catch (error) {
    logger.warn("Dashboard cache write failed, continuing without cache", {
      service: "shipment-service",
      key,
      error: error.message,
    });
  }
}

function toNumber(decimal) {
  if (decimal === null || decimal === undefined) return 0;
  return Number(decimal);
}

function scopedWhere(req, extra = {}) {
  return authUtils.applyScopeFilter(req, extra);
}

/**
 * GET /api/v1/shipments/dashboard/summary?days=30
 */
async function getDashboardSummary(req, res) {
  try {
    const { days } = validateQuery(daysQuerySchema, req.query);
    const cacheKey = buildCacheKey("summary", req, { days });
    const cached = await getCached(cacheKey);
    if (cached) {
      return res.json(APIResponse.success(cached, { cache: "hit" }));
    }

    const dateFrom = daysToDateFrom(days);
    const where = scopedWhere(req, { createdAt: { gte: dateFrom } });

    const [
      totalCount,
      statusGroups,
      shipmentTypeGroups,
      holdCount,
      pendingBookingCount,
      financials,
      courierCostPendingCount,
      deliveredWithTat,
      codGroups,
    ] = await Promise.all([
      prisma.shipment.count({ where }),
      prisma.shipment.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      prisma.shipment.groupBy({
        by: ["shipmentType"],
        where,
        _count: { _all: true },
      }),
      prisma.shipment.count({ where: { ...where, status: "HOLD" } }),
      prisma.shipment.count({
        where: { ...where, bookingStatus: "PENDING_BOOKING" },
      }),
      prisma.shipment.aggregate({
        where,
        _sum: { systemCharge: true, courierCost: true, profitMargin: true },
      }),
      prisma.shipment.count({ where: { ...where, courierCost: null } }),
      prisma.shipment.findMany({
        where: { ...where, status: "DELIVERED", actualDelivery: { not: null } },
        select: { createdAt: true, actualDelivery: true },
      }),
      prisma.shipment.groupBy({
        by: ["status"],
        where: { ...where, paymentType: "COD", codAmount: { not: null } },
        _count: { _all: true },
        _sum: { codAmount: true },
      }),
    ]);

    const byStatus = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0]));
    for (const g of statusGroups) byStatus[g.status] = g._count._all;

    const byShipmentType = {};
    for (const g of shipmentTypeGroups) {
      byShipmentType[g.shipmentType] = g._count._all;
    }

    const ndrCount = byStatus.NDR || 0;
    const rtoCount = byStatus.RTO || 0;
    const deliveredCount = byStatus.DELIVERED || 0;
    const rate = (count) => (totalCount > 0 ? count / totalCount : 0);

    let tat = { avgHours: null, sampleSize: 0 };
    if (deliveredWithTat.length > 0) {
      const totalMs = deliveredWithTat.reduce((sum, s) => {
        return sum + (new Date(s.actualDelivery) - new Date(s.createdAt));
      }, 0);
      const avgMs = totalMs / deliveredWithTat.length;
      tat = {
        avgHours: Number((avgMs / (1000 * 60 * 60)).toFixed(2)),
        sampleSize: deliveredWithTat.length,
      };
    }

    const codBuckets = {
      inTransit: { count: 0, amount: 0 },
      delivered: { count: 0, amount: 0 },
      rto: { count: 0, amount: 0 },
    };
    const codByStatus = {};
    for (const g of codGroups) {
      const count = g._count._all;
      const amount = toNumber(g._sum.codAmount);
      codByStatus[g.status] = { count, amount };
      if (g.status === "DELIVERED") {
        codBuckets.delivered.count += count;
        codBuckets.delivered.amount += amount;
      } else if (g.status === "RTO") {
        codBuckets.rto.count += count;
        codBuckets.rto.amount += amount;
      } else {
        codBuckets.inTransit.count += count;
        codBuckets.inTransit.amount += amount;
      }
    }

    const payload = {
      range: {
        days,
        from: dateFrom.toISOString(),
        to: new Date().toISOString(),
      },
      totals: { count: totalCount },
      byStatus,
      byShipmentType,
      rates: {
        ndr: { count: ndrCount, rate: rate(ndrCount) },
        rto: { count: rtoCount, rate: rate(rtoCount) },
        delivered: { count: deliveredCount, rate: rate(deliveredCount) },
      },
      exceptions: {
        // Money at risk: shipments held (e.g. weight-dispute, manual review)
        // and not currently moving.
        hold: { count: holdCount },
      },
      bookingFailures: {
        // bookingStatus === "PENDING_BOOKING": partner assigned but the
        // courier booking call has not yet succeeded/been retried.
        pendingBooking: { count: pendingBookingCount },
      },
      tat,
      financials: {
        currency: "INR",
        revenue: toNumber(financials._sum.systemCharge),
        courierCost: toNumber(financials._sum.courierCost),
        profitMargin: toNumber(financials._sum.profitMargin),
        // courierCost is null until captured (API/manual/rule); until then
        // courierCost/profitMargin totals above are provisional.
        courierCostPendingCount,
      },
      cod: {
        byStatus: codByStatus,
        buckets: codBuckets,
        note: "codAmount reflects outstanding/collectable amounts by shipment status as known to shipment-service. True settlement/remittance status is tracked in wallet-service and is not knowable from this service alone.",
      },
    };

    await setCached(cacheKey, payload);
    return res.json(APIResponse.success(payload, { cache: "miss" }));
  } catch (error) {
    return handleDashboardError(res, error, "getDashboardSummary");
  }
}

/**
 * GET /api/v1/shipments/dashboard/trend?days=30
 * Daily time series: date, shipment count, revenue sum.
 */
async function getDashboardTrend(req, res) {
  try {
    const { days } = validateQuery(daysQuerySchema, req.query);
    const cacheKey = buildCacheKey("trend", req, { days });
    const cached = await getCached(cacheKey);
    if (cached) {
      return res.json(APIResponse.success(cached, { cache: "hit" }));
    }

    const dateFrom = daysToDateFrom(days);
    const where = scopedWhere(req, { createdAt: { gte: dateFrom } });

    const rows = await prisma.shipment.findMany({
      where,
      select: { createdAt: true, systemCharge: true },
      orderBy: { createdAt: "asc" },
    });

    const byDay = new Map();
    for (const row of rows) {
      const dateKey = row.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
      if (!byDay.has(dateKey)) {
        byDay.set(dateKey, { date: dateKey, count: 0, revenue: 0 });
      }
      const bucket = byDay.get(dateKey);
      bucket.count += 1;
      bucket.revenue += toNumber(row.systemCharge);
    }

    const series = Array.from(byDay.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    const payload = {
      range: {
        days,
        from: dateFrom.toISOString(),
        to: new Date().toISOString(),
      },
      series,
    };

    await setCached(cacheKey, payload);
    return res.json(APIResponse.success(payload, { cache: "miss" }));
  } catch (error) {
    return handleDashboardError(res, error, "getDashboardTrend");
  }
}

/**
 * GET /api/v1/shipments/dashboard/couriers?days=30
 * Top 20 couriers (by shipmentCount) with revenue, cost, margin.
 */
async function getDashboardCouriers(req, res) {
  try {
    const { days } = validateQuery(daysQuerySchema, req.query);
    const cacheKey = buildCacheKey("couriers", req, { days });
    const cached = await getCached(cacheKey);
    if (cached) {
      return res.json(APIResponse.success(cached, { cache: "hit" }));
    }

    const dateFrom = daysToDateFrom(days);
    const where = scopedWhere(req, {
      createdAt: { gte: dateFrom },
      partnerId: { not: null },
    });

    const groups = await prisma.shipment.groupBy({
      by: ["partnerId", "partnerName"],
      where,
      _count: { _all: true },
      _sum: { systemCharge: true, courierCost: true },
      orderBy: { _count: { partnerId: "desc" } },
      take: 20,
    });

    const couriers = groups.map((g) => {
      const revenue = toNumber(g._sum.systemCharge);
      const courierCost = toNumber(g._sum.courierCost);
      return {
        partnerId: g.partnerId,
        partnerName: g.partnerName,
        shipmentCount: g._count._all,
        revenue,
        courierCost,
        margin: revenue - courierCost,
      };
    });

    const payload = {
      range: {
        days,
        from: dateFrom.toISOString(),
        to: new Date().toISOString(),
      },
      couriers,
    };

    await setCached(cacheKey, payload);
    return res.json(APIResponse.success(payload, { cache: "miss" }));
  } catch (error) {
    return handleDashboardError(res, error, "getDashboardCouriers");
  }
}

/**
 * GET /api/v1/shipments/dashboard/outlets?days=30&limit=10
 * Top outlets by volume and by revenue.
 */
const USER_SERVICE_URL =
  process.env.USER_SERVICE_URL || "http://user-service:3003";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

/**
 * Look up display names for a handful of outlet ids via user-service.
 *
 * Deliberately best-effort and bounded: only the rows actually rendered are
 * fetched, failures degrade to a null name rather than failing the panel.
 *
 * @param {string[]} outletIds
 * @returns {Promise<Map<string,string>>} id → name
 */
async function resolveOutletNames(outletIds = []) {
  const out = new Map();
  if (outletIds.length === 0) return out;

  await Promise.all(
    outletIds.map(async (id) => {
      try {
        const { data } = await axios.get(
          `${USER_SERVICE_URL}/api/v1/internal/outlets/${id}/billing-details`,
          {
            headers: { "X-Internal-Request": INTERNAL_SECRET },
            timeout: 3000,
          },
        );
        const d = data?.data;
        const name = d?.name || d?.outletName || d?.companyName || null;
        if (name) out.set(id, name);
      } catch (error) {
        logger.warn("Could not resolve outlet name for dashboard", {
          outletId: id,
          error: error.message,
        });
      }
    }),
  );

  return out;
}

async function getDashboardOutlets(req, res) {
  try {
    const { days, limit } = validateQuery(daysLimitQuerySchema, req.query);
    const cacheKey = buildCacheKey("outlets", req, { days, limit });
    const cached = await getCached(cacheKey);
    if (cached) {
      return res.json(APIResponse.success(cached, { cache: "hit" }));
    }

    const dateFrom = daysToDateFrom(days);
    const where = scopedWhere(req, {
      createdAt: { gte: dateFrom },
      outletId: { not: null },
    });

    // A single groupBy is enough — sort in application code both ways so we
    // don't run two near-identical queries against Postgres.
    const groups = await prisma.shipment.groupBy({
      by: ["outletId"],
      where,
      _count: { _all: true },
      _sum: { systemCharge: true },
    });

    // Outlet names live in user-service, so a groupBy here only yields ids.
    // Showing a raw UUID in a "Top Outlets" table is unreadable, so resolve the
    // names for just the rows we are about to display. Falls back to the id if
    // user-service is unreachable — a degraded label beats a failed panel.
    const outlets = groups.map((g) => ({
      outletId: g.outletId,
      outletName: null,
      shipmentCount: g._count._all,
      revenue: toNumber(g._sum.systemCharge),
    }));

    const displayedIds = [
      ...new Set(
        [...outlets]
          .sort((a, b) => b.shipmentCount - a.shipmentCount)
          .slice(0, limit)
          .concat(
            [...outlets].sort((a, b) => b.revenue - a.revenue).slice(0, limit),
          )
          .map((o) => o.outletId),
      ),
    ];

    const nameById = await resolveOutletNames(displayedIds);
    for (const o of outlets) {
      o.outletName = nameById.get(o.outletId) || null;
    }

    const topByVolume = [...outlets]
      .sort((a, b) => b.shipmentCount - a.shipmentCount)
      .slice(0, limit);
    const topByRevenue = [...outlets]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    const payload = {
      range: {
        days,
        from: dateFrom.toISOString(),
        to: new Date().toISOString(),
      },
      limit,
      topByVolume,
      topByRevenue,
    };

    await setCached(cacheKey, payload);
    return res.json(APIResponse.success(payload, { cache: "miss" }));
  } catch (error) {
    return handleDashboardError(res, error, "getDashboardOutlets");
  }
}

/**
 * GET /api/v1/shipments/dashboard/adjustments?days=30
 * Weight-dispute re-rate adjustments, scoped via the owning shipment.
 */
async function getDashboardAdjustments(req, res) {
  try {
    const { days } = validateQuery(daysQuerySchema, req.query);
    const cacheKey = buildCacheKey("adjustments", req, { days });
    const cached = await getCached(cacheKey);
    if (cached) {
      return res.json(APIResponse.success(cached, { cache: "hit" }));
    }

    const dateFrom = daysToDateFrom(days);
    // ShipmentFinancialAdjustment has no outletId/clientId of its own —
    // scope it via the owning shipment relation.
    const shipmentScope = scopedWhere(req, {});

    const adjustments = await prisma.shipmentFinancialAdjustment.findMany({
      where: {
        createdAt: { gte: dateFrom },
        shipment: shipmentScope,
      },
      select: { adjustmentType: true, difference: true },
    });

    const byType = new Map();
    for (const adj of adjustments) {
      const key = adj.adjustmentType || "UNKNOWN";
      if (!byType.has(key)) {
        byType.set(key, { adjustmentType: key, count: 0, totalDifference: 0 });
      }
      const bucket = byType.get(key);
      bucket.count += 1;
      bucket.totalDifference += toNumber(adj.difference);
    }

    const payload = {
      range: {
        days,
        from: dateFrom.toISOString(),
        to: new Date().toISOString(),
      },
      adjustments: Array.from(byType.values()),
    };

    await setCached(cacheKey, payload);
    return res.json(APIResponse.success(payload, { cache: "miss" }));
  } catch (error) {
    return handleDashboardError(res, error, "getDashboardAdjustments");
  }
}

function handleDashboardError(res, error, handlerName) {
  logger.error(`Dashboard endpoint failed: ${handlerName}`, {
    service: "shipment-service",
    error: error.message,
    stack: error.stack,
  });

  if (error instanceof ValidationError) {
    return res
      .status(error.statusCode || 400)
      .json(APIResponse.error(error.message, error.code, error.details));
  }

  return res
    .status(500)
    .json(
      APIResponse.error(
        "Failed to load dashboard data",
        "DASHBOARD_QUERY_FAILED",
      ),
    );
}

module.exports = {
  getDashboardSummary,
  getDashboardTrend,
  getDashboardCouriers,
  getDashboardOutlets,
  getDashboardAdjustments,
};
