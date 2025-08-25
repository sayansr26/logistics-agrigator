const express = require("express");
const partnerPerformanceController = require("../controllers/partnerPerformanceController");
const authMiddleware = require("../middleware/auth");
const { performanceAnalyticsLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     PerformanceMetrics:
 *       type: object
 *       properties:
 *         deliveryEfficiency:
 *           type: number
 *           description: Delivery efficiency percentage
 *           example: 95.5
 *         onTimeDeliveryRate:
 *           type: number
 *           description: On-time delivery rate percentage
 *           example: 92.3
 *         costEfficiency:
 *           type: number
 *           description: Cost efficiency score
 *           example: 87.8
 *         qualityScore:
 *           type: number
 *           description: Overall quality score
 *           example: 4.2
 *         customerSatisfaction:
 *           type: number
 *           description: Customer satisfaction rating
 *           example: 4.5
 *
 *     PerformanceData:
 *       type: object
 *       properties:
 *         partnerId:
 *           type: string
 *           description: Partner identifier
 *           example: "partner_123"
 *         calculatedMetrics:
 *           $ref: '#/components/schemas/PerformanceMetrics'
 *         rawData:
 *           type: object
 *           description: Raw performance data from external API
 *         lastUpdated:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *
 *     SystemDashboard:
 *       type: object
 *       properties:
 *         systemHealth:
 *           type: object
 *           properties:
 *             status:
 *               type: string
 *               enum: [healthy, degraded, unhealthy]
 *               example: healthy
 *             components:
 *               type: object
 *               properties:
 *                 database:
 *                   type: string
 *                   example: healthy
 *                 redis:
 *                   type: string
 *                   example: healthy
 *                 externalAPI:
 *                   type: string
 *                   example: healthy
 *         performanceSummary:
 *           type: object
 *           properties:
 *             totalPartners:
 *               type: integer
 *               example: 25
 *             activePartners:
 *               type: integer
 *               example: 23
 *             averagePerformance:
 *               type: number
 *               example: 87.5
 *         alertsSummary:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *               example: 5
 *             critical:
 *               type: integer
 *               example: 0
 *             warning:
 *               type: integer
 *               example: 2
 *             info:
 *               type: integer
 *               example: 3
 *
 *     AnalyticsData:
 *       type: object
 *       properties:
 *         insights:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 example: trend
 *               message:
 *                 type: string
 *                 example: Performance trending upward
 *               data:
 *                 type: object
 *         trends:
 *           type: object
 *           properties:
 *             performance:
 *               type: string
 *               example: improving
 *             cost:
 *               type: string
 *               example: optimizing
 *         recommendations:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 example: optimization
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *                 example: medium
 *               message:
 *                 type: string
 *                 example: Consider route optimization
 *               impact:
 *                 type: string
 *                 example: 5-10% cost reduction
 *
 *     BenchmarkData:
 *       type: object
 *       properties:
 *         comparisons:
 *           type: object
 *           properties:
 *             industryAverage:
 *               type: string
 *               example: above
 *             peerComparison:
 *               type: string
 *               example: competitive
 *         rankings:
 *           type: object
 *           properties:
 *             overall:
 *               type: integer
 *               example: 1
 *             byCategory:
 *               type: object
 *               properties:
 *                 cost:
 *                   type: integer
 *                   example: 2
 *                 speed:
 *                   type: integer
 *                   example: 1
 *                 quality:
 *                   type: integer
 *                   example: 3
 *         improvements:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               area:
 *                 type: string
 *                 example: delivery_speed
 *               suggestion:
 *                 type: string
 *                 example: Optimize route planning
 *               expectedImpact:
 *                 type: string
 *                 example: 15% faster delivery
 *               priority:
 *                 type: string
 *                 example: high
 *
 *     KPIData:
 *       type: object
 *       properties:
 *         calculatedKPIs:
 *           type: object
 *           properties:
 *             efficiency:
 *               type: number
 *               example: 85.5
 *             reliability:
 *               type: number
 *               example: 92.3
 *             customerSatisfaction:
 *               type: number
 *               example: 4.2
 *             costOptimization:
 *               type: number
 *               example: 78.9
 *         kpiTrends:
 *           type: object
 *           properties:
 *             efficiency:
 *               type: string
 *               example: improving
 *             reliability:
 *               type: string
 *               example: stable
 *         alerts:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 example: warning
 *               kpi:
 *                 type: string
 *                 example: efficiency
 *               message:
 *                 type: string
 *                 example: Efficiency below threshold
 *               threshold:
 *                 type: number
 *                 example: 80
 *               current:
 *                 type: number
 *                 example: 75
 *
 *     AlertsData:
 *       type: object
 *       properties:
 *         categorizedAlerts:
 *           type: object
 *           properties:
 *             critical:
 *               type: array
 *               items:
 *                 type: object
 *             warning:
 *               type: array
 *               items:
 *                 type: object
 *             info:
 *               type: array
 *               items:
 *                 type: object
 *             total:
 *               type: integer
 *               example: 5
 *         priorityAlerts:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               severity:
 *                 type: string
 *                 enum: [critical, warning, info]
 *               message:
 *                 type: string
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *         actionableAlerts:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               actionable:
 *                 type: boolean
 *                 example: true
 *               action:
 *                 type: string
 *                 example: Investigate delivery delays
 */

/**
 * @swagger
 * /api/v1/partner-performance/{partnerId}:
 *   get:
 *     summary: Get partner performance metrics
 *     description: Retrieve comprehensive performance metrics for a specific partner including calculated metrics, trends, and insights
 *     tags: [Partner Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner identifier
 *         example: "partner_123"
 *       - in: query
 *         name: skipCache
 *         schema:
 *           type: boolean
 *         description: Skip cache and fetch fresh data
 *         example: false
 *       - in: query
 *         name: dateRange
 *         schema:
 *           type: string
 *         description: Date range for performance data (e.g., "30d", "7d", "1m")
 *         example: "30d"
 *     responses:
 *       200:
 *         description: Partner performance metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     performance:
 *                       $ref: '#/components/schemas/PerformanceData'
 *                 message:
 *                   type: string
 *                   example: Partner performance retrieved successfully
 *       400:
 *         description: Invalid partner ID
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Partner not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/:partnerId",
  authMiddleware.authenticate,
  performanceAnalyticsLimiter,
  partnerPerformanceController.getPartnerPerformance,
);

/**
 * @swagger
 * /api/v1/main-system-dashboard:
 *   get:
 *     summary: Get system dashboard data
 *     description: Retrieve comprehensive system dashboard including health status, performance summary, and alerts overview
 *     tags: [Partner Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: skipCache
 *         schema:
 *           type: boolean
 *         description: Skip cache and fetch fresh data
 *         example: false
 *       - in: query
 *         name: includeDetails
 *         schema:
 *           type: boolean
 *         description: Include detailed component information
 *         example: true
 *     responses:
 *       200:
 *         description: System dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     dashboard:
 *                       $ref: '#/components/schemas/SystemDashboard'
 *                 message:
 *                   type: string
 *                   example: System dashboard retrieved successfully
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.get(
  "/main-system-dashboard",
  authMiddleware.authenticate,
  performanceAnalyticsLimiter,
  partnerPerformanceController.getSystemDashboard,
);

/**
 * @swagger
 * /api/v1/partner-analytics/{partnerId}:
 *   get:
 *     summary: Get partner analytics
 *     description: Retrieve detailed analytics for a partner including insights, trends, and recommendations
 *     tags: [Partner Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner identifier
 *         example: "partner_123"
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *         description: Analytics timeframe
 *         example: "30d"
 *       - in: query
 *         name: metrics
 *         schema:
 *           type: string
 *         description: Comma-separated list of metrics to include
 *         example: "efficiency,cost,quality"
 *       - in: query
 *         name: skipCache
 *         schema:
 *           type: boolean
 *         description: Skip cache and fetch fresh data
 *         example: false
 *     responses:
 *       200:
 *         description: Partner analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     analytics:
 *                       $ref: '#/components/schemas/AnalyticsData'
 *                 message:
 *                   type: string
 *                   example: Partner analytics retrieved successfully
 *       400:
 *         description: Invalid partner ID
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Partner not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/partner-analytics/:partnerId",
  authMiddleware.authenticate,
  performanceAnalyticsLimiter,
  partnerPerformanceController.getPartnerAnalytics,
);

/**
 * @swagger
 * /api/v1/partner-benchmarks/{partnerId}:
 *   get:
 *     summary: Get partner benchmarks
 *     description: Retrieve benchmark comparisons for a partner against industry standards and peers
 *     tags: [Partner Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner identifier
 *         example: "partner_123"
 *       - in: query
 *         name: compareWith
 *         schema:
 *           type: string
 *         description: Comparison type (industry, peers, historical)
 *         example: "industry"
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Benchmark category (cost, speed, quality, overall)
 *         example: "overall"
 *       - in: query
 *         name: skipCache
 *         schema:
 *           type: boolean
 *         description: Skip cache and fetch fresh data
 *         example: false
 *     responses:
 *       200:
 *         description: Partner benchmarks retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     benchmarks:
 *                       $ref: '#/components/schemas/BenchmarkData'
 *                 message:
 *                   type: string
 *                   example: Partner benchmarks retrieved successfully
 *       400:
 *         description: Invalid partner ID
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Partner not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/partner-benchmarks/:partnerId",
  authMiddleware.authenticate,
  performanceAnalyticsLimiter,
  partnerPerformanceController.getPartnerBenchmarks,
);

/**
 * @swagger
 * /api/v1/partner-kpis/{partnerId}:
 *   get:
 *     summary: Get partner KPIs
 *     description: Retrieve key performance indicators for a partner with trends and alerts
 *     tags: [Partner Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner identifier
 *         example: "partner_123"
 *       - in: query
 *         name: kpis
 *         schema:
 *           type: string
 *         description: Comma-separated list of KPIs to include
 *         example: "efficiency,reliability,satisfaction"
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *         description: KPI calculation period
 *         example: "30d"
 *       - in: query
 *         name: skipCache
 *         schema:
 *           type: boolean
 *         description: Skip cache and fetch fresh data
 *         example: false
 *     responses:
 *       200:
 *         description: Partner KPIs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     kpis:
 *                       $ref: '#/components/schemas/KPIData'
 *                 message:
 *                   type: string
 *                   example: Partner KPIs retrieved successfully
 *       400:
 *         description: Invalid partner ID
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Partner not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/partner-kpis/:partnerId",
  authMiddleware.authenticate,
  performanceAnalyticsLimiter,
  partnerPerformanceController.getPartnerKPIs,
);

/**
 * @swagger
 * /api/v1/performance-alerts:
 *   get:
 *     summary: Get performance alerts
 *     description: Retrieve system-wide performance alerts with categorization and prioritization
 *     tags: [Partner Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [critical, warning, info]
 *         description: Filter alerts by severity level
 *         example: "warning"
 *       - in: query
 *         name: partnerId
 *         schema:
 *           type: string
 *         description: Filter alerts for specific partner
 *         example: "partner_123"
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Alert category filter
 *         example: "performance"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Maximum number of alerts to return
 *         example: 50
 *       - in: query
 *         name: skipCache
 *         schema:
 *           type: boolean
 *         description: Skip cache and fetch fresh data
 *         example: false
 *     responses:
 *       200:
 *         description: Performance alerts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     alerts:
 *                       $ref: '#/components/schemas/AlertsData'
 *                 message:
 *                   type: string
 *                   example: Performance alerts retrieved successfully
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.get(
  "/performance-alerts",
  authMiddleware.authenticate,
  performanceAnalyticsLimiter,
  partnerPerformanceController.getPerformanceAlerts,
);

/**
 * @swagger
 * /api/v1/partner-performance/cache/{partnerId}:
 *   delete:
 *     summary: Clear performance cache
 *     description: Clear cached performance data for a specific partner or all partners
 *     tags: [Partner Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: false
 *         schema:
 *           type: string
 *         description: Partner identifier (optional - if not provided, clears all cache)
 *         example: "partner_123"
 *     responses:
 *       200:
 *         description: Performance cache cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     cleared:
 *                       type: boolean
 *                       example: true
 *                     partnerId:
 *                       type: string
 *                       example: "partner_123"
 *                 message:
 *                   type: string
 *                   example: Performance cache cleared successfully
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.delete(
  "/cache/:partnerId?",
  authMiddleware.authenticate,
  authMiddleware.adminOnly,
  partnerPerformanceController.clearPerformanceCache,
);

/**
 * @swagger
 * /api/v1/partner-performance/statistics:
 *   get:
 *     summary: Get performance statistics
 *     description: Retrieve aggregated performance statistics across all partners
 *     tags: [Partner Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *         description: Statistics timeframe
 *         example: "30d"
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *         description: Group statistics by (partner, region, service_type)
 *         example: "partner"
 *     responses:
 *       200:
 *         description: Performance statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     statistics:
 *                       type: object
 *                       properties:
 *                         totalPartners:
 *                           type: integer
 *                           example: 25
 *                         activePartners:
 *                           type: integer
 *                           example: 23
 *                         performanceMetrics:
 *                           $ref: '#/components/schemas/PerformanceMetrics'
 *                         trends:
 *                           type: object
 *                         alerts:
 *                           type: object
 *                 message:
 *                   type: string
 *                   example: Performance statistics retrieved successfully
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.get(
  "/statistics",
  authMiddleware.authenticate,
  performanceAnalyticsLimiter,
  partnerPerformanceController.getPerformanceStatistics,
);

/**
 * @swagger
 * /api/v1/partner-performance/report:
 *   post:
 *     summary: Generate performance report
 *     description: Generate a comprehensive performance report for a partner with optional comparisons
 *     tags: [Partner Performance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - partnerId
 *               - reportType
 *             properties:
 *               partnerId:
 *                 type: string
 *                 description: Partner identifier
 *                 example: "partner_123"
 *               reportType:
 *                 type: string
 *                 enum: [summary, detailed, comparative, trend_analysis]
 *                 description: Type of report to generate
 *                 example: "detailed"
 *               dateRange:
 *                 type: object
 *                 properties:
 *                   start:
 *                     type: string
 *                     format: date-time
 *                     description: Report start date
 *                   end:
 *                     type: string
 *                     format: date-time
 *                     description: Report end date
 *               includeComparisons:
 *                 type: boolean
 *                 description: Include benchmark comparisons in report
 *                 example: true
 *               format:
 *                 type: string
 *                 enum: [json, pdf, csv]
 *                 description: Report output format
 *                 example: "json"
 *     responses:
 *       200:
 *         description: Performance report generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     report:
 *                       type: object
 *                       properties:
 *                         partnerId:
 *                           type: string
 *                           example: "partner_123"
 *                         reportType:
 *                           type: string
 *                           example: "detailed"
 *                         performance:
 *                           $ref: '#/components/schemas/PerformanceData'
 *                         analytics:
 *                           $ref: '#/components/schemas/AnalyticsData'
 *                         kpis:
 *                           $ref: '#/components/schemas/KPIData'
 *                         benchmarks:
 *                           $ref: '#/components/schemas/BenchmarkData'
 *                         generatedAt:
 *                           type: string
 *                           format: date-time
 *                         generatedBy:
 *                           type: string
 *                 message:
 *                   type: string
 *                   example: Performance report generated successfully
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Partner not found
 *       500:
 *         description: Internal server error
 */
router.post(
  "/report",
  authMiddleware.authenticate,
  performanceAnalyticsLimiter,
  partnerPerformanceController.generatePerformanceReport,
);

module.exports = router;
