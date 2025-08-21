// Use shared authentication middleware with service-specific extensions
const { authMiddleware } = require("../shared/lib/auth");

// Export all shared middleware functions
module.exports = {
  authenticate: authMiddleware.authenticate,
  authorize: authMiddleware.authorize,
  requireRole: authMiddleware.requireRole,
  enrichUserContext: authMiddleware.enrichUserContext,
  adminOnly: authMiddleware.adminOnly,
  clientOrHigher: authMiddleware.clientOrHigher,
  operationsOrHigher: authMiddleware.operationsOrHigher,
  financeOrAdmin: authMiddleware.financeOrAdmin,
};
