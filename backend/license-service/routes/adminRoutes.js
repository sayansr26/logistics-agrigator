const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../shared/lib/auth");

/**
 * @swagger
 * /api/v1/admin/dashboard:
 *   get:
 *     summary: Get admin dashboard data
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/dashboard",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("license", "manage", "all"),
  async (req, res) => {
    // TODO: Implement dashboard data aggregation
    res.json({
      status: "success",
      message: "Admin dashboard routes pending implementation",
      data: {
        totalLicenses: 0,
        activeLicenses: 0,
        totalActivations: 0,
        revenue: 0,
      },
    });
  },
);

module.exports = router;
