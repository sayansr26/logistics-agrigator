const router = require("express").Router();
const controller = require("../controllers/geographicalDistanceController");
const { validate } = require("../middleware/validate");
const schemas = require("../validation/distanceSchemas");

/**
 * @swagger
 * tags:
 *   name: Geographical Distance
 *   description: Distance calculation endpoints for various geographical entities
 */

/**
 * @swagger
 * /api/v1/geography/distance/pincode-to-pincode:
 *   post:
 *     summary: Calculate distance between two pincodes
 *     tags: [Geographical Distance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromPincode
 *               - toPincode
 *             properties:
 *               fromPincode:
 *                 type: string
 *                 pattern: ^[0-9]{6}$
 *                 example: "110001"
 *                 description: 6-digit source pincode
 *               toPincode:
 *                 type: string
 *                 pattern: ^[0-9]{6}$
 *                 example: "400001"
 *                 description: 6-digit destination pincode
 *     responses:
 *       200:
 *         description: Distance calculated successfully
 *       400:
 *         description: Invalid request data
 */
router.post(
  "/pincode-to-pincode",
  validate(schemas.pincodeDistanceSchema),
  controller.calculatePincodeDistance,
);

/**
 * @swagger
 * /api/v1/geography/distance/city-to-city:
 *   post:
 *     summary: Calculate distance between two cities
 *     tags: [Geographical Distance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromCityId
 *               - toCityId
 *             properties:
 *               fromCityId:
 *                 type: string
 *                 format: uuid
 *                 description: UUID of source city
 *               toCityId:
 *                 type: string
 *                 format: uuid
 *                 description: UUID of destination city
 *     responses:
 *       200:
 *         description: Distance calculated successfully
 *       400:
 *         description: Invalid request data
 */
router.post(
  "/city-to-city",
  validate(schemas.cityDistanceSchema),
  controller.calculateCityDistance,
);

/**
 * @swagger
 * /api/v1/geography/distance/state-to-state:
 *   post:
 *     summary: Calculate distance between two states
 *     tags: [Geographical Distance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromStateId
 *               - toStateId
 *             properties:
 *               fromStateId:
 *                 type: string
 *                 format: uuid
 *                 description: UUID of source state
 *               toStateId:
 *                 type: string
 *                 format: uuid
 *                 description: UUID of destination state
 *     responses:
 *       200:
 *         description: Distance calculated successfully
 *       400:
 *         description: Invalid request data
 */
router.post(
  "/state-to-state",
  validate(schemas.stateDistanceSchema),
  controller.calculateStateDistance,
);

/**
 * @swagger
 * /api/v1/geography/distance/area-to-area:
 *   post:
 *     summary: Calculate distance between two areas
 *     tags: [Geographical Distance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromAreaId
 *               - toAreaId
 *             properties:
 *               fromAreaId:
 *                 type: string
 *                 format: uuid
 *                 description: UUID of source area
 *               toAreaId:
 *                 type: string
 *                 format: uuid
 *                 description: UUID of destination area
 *     responses:
 *       200:
 *         description: Distance calculated successfully
 *       400:
 *         description: Invalid request data
 */
router.post(
  "/area-to-area",
  validate(schemas.areaDistanceSchema),
  controller.calculateAreaDistance,
);

/**
 * @swagger
 * /api/v1/geography/distance/coordinates:
 *   post:
 *     summary: Calculate distance between two coordinates
 *     tags: [Geographical Distance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - from
 *               - to
 *             properties:
 *               from:
 *                 type: object
 *                 required:
 *                   - latitude
 *                   - longitude
 *                 properties:
 *                   latitude:
 *                     type: number
 *                     minimum: -90
 *                     maximum: 90
 *                     example: 28.6139
 *                   longitude:
 *                     type: number
 *                     minimum: -180
 *                     maximum: 180
 *                     example: 77.2090
 *               to:
 *                 type: object
 *                 required:
 *                   - latitude
 *                   - longitude
 *                 properties:
 *                   latitude:
 *                     type: number
 *                     minimum: -90
 *                     maximum: 90
 *                     example: 18.9387
 *                   longitude:
 *                     type: number
 *                     minimum: -180
 *                     maximum: 180
 *                     example: 72.8354
 *     responses:
 *       200:
 *         description: Distance calculated successfully
 *       400:
 *         description: Invalid coordinates
 */
router.post(
  "/coordinates",
  validate(schemas.coordinateDistanceSchema),
  controller.calculateCoordinateDistance,
);

/**
 * @swagger
 * /api/v1/geography/distance/batch:
 *   post:
 *     summary: Calculate multiple distances in batch
 *     tags: [Geographical Distance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - calculations
 *             properties:
 *               calculations:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 100
 *                 description: Array of distance calculation requests
 *                 items:
 *                   type: object
 *                   required:
 *                     - type
 *                     - from
 *                     - to
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [pincode, city, state, area, coordinates]
 *                       description: Type of distance calculation
 *                     from:
 *                       description: Source location (format depends on type)
 *                     to:
 *                       description: Destination location (format depends on type)
 *     responses:
 *       200:
 *         description: Batch calculation completed
 *       400:
 *         description: Invalid request data
 */
router.post(
  "/batch",
  validate(schemas.batchDistanceSchema),
  controller.batchCalculateDistances,
);

/**
 * @swagger
 * /api/v1/geography/distance/clear-cache:
 *   post:
 *     summary: Clear distance calculation cache (Admin only)
 *     tags: [Geographical Distance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pattern:
 *                 type: string
 *                 default: "distance:*"
 *                 description: Cache key pattern to clear
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 *       403:
 *         description: Unauthorized - Admin access required
 *       400:
 *         description: Error clearing cache
 */
router.post(
  "/clear-cache",
  validate(schemas.clearCacheSchema),
  controller.clearDistanceCache,
);

/**
 * @swagger
 * /api/v1/geography/distance/health:
 *   get:
 *     summary: Health check for distance calculation service
 *     tags: [Geographical Distance]
 *     responses:
 *       200:
 *         description: Service is healthy
 *       500:
 *         description: Service is unhealthy
 */
router.get("/health", controller.healthCheck);

module.exports = router;
