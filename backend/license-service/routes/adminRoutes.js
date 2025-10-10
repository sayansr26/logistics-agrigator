const express = require('express');
const router = express.Router();
const { adminOnly } = require('../middleware/licenseMiddleware');

/**
 * @swagger
 * /api/v1/admin/dashboard:
 *   get:
 *     summary: Get admin dashboard data
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/dashboard', adminOnly, async (req, res) => {
  // TODO: Implement dashboard data aggregation
  res.json({
    status: 'success',
    message: 'Admin dashboard routes pending implementation',
    data: {
      totalLicenses: 0,
      activeLicenses: 0,
      totalActivations: 0,
      revenue: 0
    }
  });
});

module.exports = router;