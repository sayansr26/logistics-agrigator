const express = require('express');
const router = express.Router();
const { adminOnly } = require('../middleware/licenseMiddleware');

/**
 * @swagger
 * /api/v1/subscriptions:
 *   get:
 *     summary: List all subscriptions
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', adminOnly, async (req, res) => {
  // TODO: Implement subscription listing
  res.json({ status: 'success', message: 'Subscription routes pending implementation' });
});

module.exports = router;