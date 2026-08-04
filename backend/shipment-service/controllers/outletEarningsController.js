/**
 * Outlet Earnings Controller (charges-engine v3)
 *
 * Read endpoints over the OutletEarning markup-commission ledger.
 * Scoping:
 *   - outlet role: own earnings only (outlet resolved from the auth user)
 *   - client roles: earnings across the client's outlets
 *   - admin/superadmin: everything, optionally filtered by outletId
 */

const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");
const { ValidationError } = require("../shared/lib/errors");
const outletWalletContextService = require("../services/outletWalletContextService");

/**
 * Resolve the ledger scope (where clause) for the requesting user.
 */
async function resolveEarningsScope(req) {
  const role = req.user.role;
  const userId = req.user.userId || req.user.id;

  if (role === "outlet") {
    const context =
      await outletWalletContextService.resolveOutletWalletByUserId(userId);
    if (!context?.outletId) {
      throw new ValidationError("No outlet found for this user");
    }
    return { outletId: context.outletId };
  }

  if (["superadmin", "admin"].includes(role)) {
    return req.query.outletId ? { outletId: req.query.outletId } : {};
  }

  // client-side roles: scope to their clientId
  if (req.user.clientId) {
    return { clientId: req.user.clientId };
  }

  throw new ValidationError("Unable to resolve earnings scope for this user");
}

/**
 * GET /api/v1/shipments/earnings
 * Query: page, limit, status (ACCRUED|CANCELLED), from, to, outletId (admin)
 */
async function getOutletEarnings(req, res) {
  try {
    const scope = await resolveEarningsScope(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 20),
    );
    const { status, from, to } = req.query;

    const where = {
      ...scope,
      ...(status && { status }),
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to) }),
            },
          }
        : {}),
    };

    const [earnings, total] = await Promise.all([
      prisma.outletEarning.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          shipment: {
            select: {
              orderId: true,
              awbNumber: true,
              status: true,
              paymentType: true,
              partnerName: true,
              deliveryCity: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.outletEarning.count({ where }),
    ]);

    res.json(
      APIResponse.success({
        earnings: earnings.map((e) => ({
          ...e,
          systemCharge: parseFloat(e.systemCharge),
          markupValue: parseFloat(e.markupValue),
          markupAmount: parseFloat(e.markupAmount),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }),
    );
  } catch (error) {
    logger.error("Failed to list outlet earnings", {
      service: "shipment-service",
      userId: req.user?.userId,
      error: error.message,
    });
    if (error instanceof ValidationError) {
      return res
        .status(400)
        .json(APIResponse.error(error.message, "VALIDATION_ERROR"));
    }
    res
      .status(500)
      .json(APIResponse.error("Failed to list earnings", "EARNINGS_FAILED"));
  }
}

/**
 * GET /api/v1/shipments/earnings/summary
 */
async function getOutletEarningsSummary(req, res) {
  try {
    const scope = await resolveEarningsScope(req);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [byStatus, monthToDate] = await Promise.all([
      prisma.outletEarning.groupBy({
        by: ["status"],
        where: scope,
        _sum: { markupAmount: true },
        _count: { _all: true },
      }),
      prisma.outletEarning.aggregate({
        where: {
          ...scope,
          status: "ACCRUED",
          createdAt: { gte: monthStart },
        },
        _sum: { markupAmount: true },
        _count: { _all: true },
      }),
    ]);

    const statusRow = (status) =>
      byStatus.find((row) => row.status === status) || {
        _sum: { markupAmount: 0 },
        _count: { _all: 0 },
      };

    const accrued = statusRow("ACCRUED");
    const cancelled = statusRow("CANCELLED");

    res.json(
      APIResponse.success({
        summary: {
          totalAccrued: parseFloat(accrued._sum.markupAmount || 0),
          accruedCount: accrued._count._all,
          totalCancelled: parseFloat(cancelled._sum.markupAmount || 0),
          cancelledCount: cancelled._count._all,
          monthToDate: parseFloat(monthToDate._sum.markupAmount || 0),
          monthToDateCount: monthToDate._count._all,
        },
      }),
    );
  } catch (error) {
    logger.error("Failed to summarize outlet earnings", {
      service: "shipment-service",
      userId: req.user?.userId,
      error: error.message,
    });
    if (error instanceof ValidationError) {
      return res
        .status(400)
        .json(APIResponse.error(error.message, "VALIDATION_ERROR"));
    }
    res
      .status(500)
      .json(
        APIResponse.error("Failed to summarize earnings", "EARNINGS_FAILED"),
      );
  }
}

module.exports = { getOutletEarnings, getOutletEarningsSummary };
