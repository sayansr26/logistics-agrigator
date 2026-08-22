const dashboardService = require("../services/dashboardService");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");

/**
 * GET /api/v1/wallet/dashboard/summary?days=30
 * Read-only aggregation sourced from the external wallet API: total
 * balance, wallet status breakdown, top-up/debit sums, transaction counts
 * and low-balance wallets, scoped to the caller (outlet sees only their
 * own wallet, admin/superadmin/client roles see their client's wallets).
 */
async function getSummary(req, res) {
  try {
    const { days } = req.query;

    logger.debug("Fetching wallet dashboard summary", {
      userId: req.user?.id,
      role: req.user?.role,
      days,
    });

    const summary = await dashboardService.getSummary(req, days);

    res.json(
      APIResponse.success(summary, "Dashboard summary retrieved successfully"),
    );
  } catch (error) {
    logger.error("Error getting wallet dashboard summary:", error);
    res
      .status(error.statusCode || 500)
      .json(
        APIResponse.error(
          error.message || "Failed to fetch dashboard summary",
          error.statusCode || 500,
        ),
      );
  }
}

/**
 * GET /api/v1/wallet/dashboard/trend?days=30
 * Read-only daily time series of top-up vs debit totals, sourced from the
 * external wallet API and scoped the same way as the summary endpoint.
 */
async function getTrend(req, res) {
  try {
    const { days } = req.query;

    logger.debug("Fetching wallet dashboard trend", {
      userId: req.user?.id,
      role: req.user?.role,
      days,
    });

    const trend = await dashboardService.getTrend(req, days);

    res.json(
      APIResponse.success(trend, "Dashboard trend retrieved successfully"),
    );
  } catch (error) {
    logger.error("Error getting wallet dashboard trend:", error);
    res
      .status(error.statusCode || 500)
      .json(
        APIResponse.error(
          error.message || "Failed to fetch dashboard trend",
          error.statusCode || 500,
        ),
      );
  }
}

module.exports = {
  getSummary,
  getTrend,
};
