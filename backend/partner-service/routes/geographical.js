/**
 * Geographical Routes
 *
 * Routes for geographical data operations including pincode search,
 * city/state data retrieval, and geographical hierarchy management
 */

const express = require("express");
const authMiddleware = require("../middleware/auth");
const rateLimiter = require("../middleware/rateLimiter");
const GeographicalController = require("../controllers/geographicalController");

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     PincodeSearchResult:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique pincode ID
 *         pincode:
 *           type: string
 *           description: 6-digit pincode
 *         latitude:
 *           type: number
 *           description: Latitude coordinate
 *         longitude:
 *           type: number
 *           description: Longitude coordinate
 *         district:
 *           type: string
 *           description: District name
 *         type:
 *           type: string
 *           description: Area type (urban/rural)
 *         area:
 *           type: object
 *           description: Area information
 *         fullAddress:
 *           type: string
 *           description: Complete formatted address
 *
 *     StateWithCounts:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: State ID
 *         name:
 *           type: string
 *           description: State name
 *         code:
 *           type: string
 *           description: State code
 *         counts:
 *           type: object
 *           properties:
 *             cities:
 *               type: integer
 *             areas:
 *               type: integer
 *             pincodes:
 *               type: integer
 *
 *     City:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: City ID
 *         name:
 *           type: string
 *           description: City name
 *         state:
 *           type: object
 *           description: State information
 *         isMetro:
 *           type: boolean
 *           description: Whether city is a metro
 *         population:
 *           type: integer
 *           description: City population
 *
 *     Area:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Area ID
 *         name:
 *           type: string
 *           description: Area name
 *         type:
 *           type: string
 *           description: Area type
 *         city:
 *           type: object
 *           description: City information
 *         pincodeCount:
 *           type: integer
 *           description: Number of pincodes in area
 */

/**
 * @swagger
 * /api/geographical/pincodes/search:
 *   get:
 *     summary: Search pincodes with comprehensive filtering
 *     tags: [Geographical]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pincode
 *         schema:
 *           type: string
 *         description: 6-digit pincode to search
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: City name to search
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: State name to search
 *       - in: query
 *         name: district
 *         schema:
 *           type: string
 *         description: District name to search
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [urban, rural, all]
 *         description: Area type filter
 *       - in: query
 *         name: latitude
 *         schema:
 *           type: number
 *         description: Latitude for proximity search
 *       - in: query
 *         name: longitude
 *         schema:
 *           type: number
 *         description: Longitude for proximity search
 *       - in: query
 *         name: radius
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Search radius in kilometers
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of results per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: pincode
 *         description: Field to sort by
 *       - in: query
 *         name: searchMode
 *         schema:
 *           type: string
 *           enum: [exact, partial]
 *           default: partial
 *         description: Search matching mode
 *       - in: query
 *         name: includeHierarchy
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include geographical hierarchy
 *       - in: query
 *         name: includeCoordinates
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include coordinate information
 *       - in: query
 *         name: includeMetadata
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include additional metadata
 *     responses:
 *       200:
 *         description: Pincode search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PincodeSearchResult'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalRecords:
 *                       type: integer
 *       400:
 *         description: Invalid search parameters
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/pincodes/search",
  authMiddleware.authenticate,
  rateLimiter.geographicalSearchLimiter,
  GeographicalController.searchPincodes,
);

/**
 * @swagger
 * /api/geographical/pincodes/{pincode}:
 *   get:
 *     summary: Get specific pincode details
 *     tags: [Geographical]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pincode
 *         required: true
 *         schema:
 *           type: string
 *         description: 6-digit pincode
 *     responses:
 *       200:
 *         description: Pincode details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/PincodeSearchResult'
 *       400:
 *         description: Invalid pincode format
 *       404:
 *         description: Pincode not found
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/pincodes/:pincode",
  authMiddleware.authenticate,
  rateLimiter.geographicalSearchLimiter,
  GeographicalController.getPincodeDetails,
);

/**
 * @swagger
 * /api/geographical/pincodes/{pincode}/hierarchy:
 *   get:
 *     summary: Get geographical hierarchy for pincode
 *     tags: [Geographical]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pincode
 *         required: true
 *         schema:
 *           type: string
 *         description: 6-digit pincode
 *     responses:
 *       200:
 *         description: Pincode geographical hierarchy
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
 *                   description: Hierarchical geographical data
 *       400:
 *         description: Invalid pincode format
 *       404:
 *         description: Hierarchy not found
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/pincodes/:pincode/hierarchy",
  authMiddleware.authenticate,
  rateLimiter.geographicalSearchLimiter,
  GeographicalController.getPincodeHierarchy,
);

/**
 * @swagger
 * /api/geographical/states:
 *   get:
 *     summary: Get all states with pincode counts
 *     tags: [Geographical]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: States with pincode counts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/StateWithCounts'
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/states",
  authMiddleware.authenticate,
  rateLimiter.geographicalSearchLimiter,
  GeographicalController.getStatesWithPincodeCounts,
);

/**
 * @swagger
 * /api/geographical/cities:
 *   get:
 *     summary: Get cities with comprehensive filtering
 *     tags: [Geographical]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: stateIds
 *         schema:
 *           type: string
 *         description: Comma-separated state IDs
 *       - in: query
 *         name: states
 *         schema:
 *           type: string
 *         description: State names to filter
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for city names
 *       - in: query
 *         name: isMetro
 *         schema:
 *           type: boolean
 *         description: Filter metro cities only
 *       - in: query
 *         name: minPopulation
 *         schema:
 *           type: integer
 *         description: Minimum population filter
 *       - in: query
 *         name: maxPopulation
 *         schema:
 *           type: integer
 *         description: Maximum population filter
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of results per page
 *     responses:
 *       200:
 *         description: Cities list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/City'
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/cities",
  authMiddleware.authenticate,
  rateLimiter.geographicalSearchLimiter,
  GeographicalController.getCities,
);

/**
 * @swagger
 * /api/geographical/areas:
 *   get:
 *     summary: Get areas with comprehensive filtering
 *     tags: [Geographical]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cityIds
 *         schema:
 *           type: string
 *         description: Comma-separated city IDs
 *       - in: query
 *         name: stateIds
 *         schema:
 *           type: string
 *         description: Comma-separated state IDs
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for area names
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Area type filter
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of results per page
 *     responses:
 *       200:
 *         description: Areas list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Area'
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/areas",
  authMiddleware.authenticate,
  rateLimiter.geographicalSearchLimiter,
  GeographicalController.getAreas,
);

/**
 * @swagger
 * /api/geographical/stats:
 *   get:
 *     summary: Get geographical service statistics
 *     tags: [Geographical]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Geographical service statistics
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
 *                     cachePrefix:
 *                       type: string
 *                     defaultCacheTTL:
 *                       type: integer
 *                     externalClientStatus:
 *                       type: string
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/stats",
  authMiddleware.authenticate,
  rateLimiter.geographicalSearchLimiter,
  GeographicalController.getGeographicalStats,
);

module.exports = router;
