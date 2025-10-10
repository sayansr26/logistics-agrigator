const express = require('express');
const router = express.Router();
const { adminOnly } = require('../middleware/licenseMiddleware');

/**
 * @swagger
 * /api/v1/metrics/usage:
 *   get:
 *     summary: Get usage metrics
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 */
router.get('/usage', adminOnly, async (req, res) => {
  // TODO: Implement usage metrics
  res.json({
    status: 'success',
    message: 'Metrics routes pending implementation',
    data: {
      apiCalls: 0,
      activeUsers: 0,
      dataProcessed: 0
    }
  });
});

module.exports = router;