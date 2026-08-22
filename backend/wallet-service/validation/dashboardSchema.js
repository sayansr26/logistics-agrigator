const Joi = require("joi");

/**
 * Query schema shared by both dashboard aggregation endpoints
 * (GET /dashboard/summary and GET /dashboard/trend).
 */
const dashboardRangeQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(365).default(30).messages({
    "number.integer": "days must be an integer",
    "number.min": "days must be at least 1",
    "number.max": "days cannot exceed 365",
  }),
  // Only honored for admin/superadmin callers (see dashboardService's
  // getScopeContext) — every other role is always scoped to their own
  // req.user.clientCode / wallet, matching adminWalletController.js's
  // clientCode override pattern for the other admin wallet-proxy routes.
  clientCode: Joi.string().max(50).trim().optional(),
});

module.exports = {
  dashboardRangeQuerySchema,
};
