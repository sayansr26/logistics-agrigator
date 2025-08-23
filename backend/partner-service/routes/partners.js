const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const APIResponse = require("../shared/lib/response");
const partnerController = require("../controllers/partnerController");
const { validateBody } = require("../middleware/validate");
const { partnerSchema } = require("../validation/partnerSchema");
const {
  partnerManagementLimiter,
  rateCalculationLimiter,
  serviceabilityLimiter,
} = require("../middleware/rateLimiter");

/**
 * @swagger
 * /api/partners:
 *   get:
 *     tags: [Partners]
 *     summary: Get all active partners
 *     description: Retrieve a list of all active courier partners
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: supportsCOD
 *         schema:
 *           type: boolean
 *         description: Filter by COD support
 *       - in: query
 *         name: supportsReverse
 *         schema:
 *           type: boolean
 *         description: Filter by reverse logistics support
 *     responses:
 *       200:
 *         description: List of partners
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     partners:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Partner'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/", authMiddleware.authenticate, async (req, res, next) => {
  try {
    const { isActive, supportsCOD, supportsReverse } = req.query;
    const filters = {
      ...(typeof isActive === "string" && { isActive: isActive === "true" }),
      ...(typeof supportsCOD === "string" && {
        supportsCOD: supportsCOD === "true",
      }),
      ...(typeof supportsReverse === "string" && {
        supportsReverse: supportsReverse === "true",
      }),
    };

    const partners = await partnerController.getAllPartners(filters);
    res.json(APIResponse.success({ partners }));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/partners/{id}:
 *   get:
 *     tags: [Partners]
 *     summary: Get partner by ID
 *     description: Retrieve a specific partner by their ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner ID
 *     responses:
 *       200:
 *         description: Partner details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PartnerResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/:id", authMiddleware.authenticate, async (req, res, next) => {
  try {
    const partner = await partnerController.getPartnerById(req.params.id);
    res.json(APIResponse.success({ partner }));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/partners:
 *   post:
 *     tags: [Partners]
 *     summary: Create a new partner
 *     description: Create a new courier partner
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePartnerRequest'
 *     responses:
 *       201:
 *         description: Created partner
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PartnerResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  "/",
  partnerManagementLimiter,
  authMiddleware.authenticate,
  authMiddleware.adminOnly,
  validateBody(partnerSchema.create),
  async (req, res, next) => {
    try {
      const partner = await partnerController.createPartner(req.body, req);
      res.status(201).json(APIResponse.success({ partner }));
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/partners/{id}:
 *   put:
 *     tags: [Partners]
 *     summary: Update a partner
 *     description: Update an existing courier partner
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePartnerRequest'
 *     responses:
 *       200:
 *         description: Updated partner
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PartnerResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put(
  "/:id",
  partnerManagementLimiter,
  authMiddleware.authenticate,
  authMiddleware.adminOnly,
  validateBody(partnerSchema.update),
  async (req, res, next) => {
    try {
      const partner = await partnerController.updatePartner(
        req.params.id,
        req.body,
        req,
      );
      res.json(APIResponse.success({ partner }));
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/partners/{id}:
 *   delete:
 *     tags: [Partners]
 *     summary: Delete a partner
 *     description: Delete an existing courier partner
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner ID
 *     responses:
 *       200:
 *         description: Partner deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete(
  "/:id",
  partnerManagementLimiter,
  authMiddleware.authenticate,
  authMiddleware.adminOnly,
  async (req, res, next) => {
    try {
      await partnerController.deletePartner(req.params.id, req);
      res.json(
        APIResponse.success({ message: "Partner deleted successfully" }),
      );
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/partners/calculate:
 *   post:
 *     tags: [Rates]
 *     summary: Calculate shipping rates
 *     description: Calculate shipping rates from all available partners
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RateCalculationRequest'
 *     responses:
 *       200:
 *         description: Rate calculation results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateCalculationResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  "/calculate",
  rateCalculationLimiter,
  authMiddleware.authenticate,
  async (req, res, next) => {
    try {
      const rates = await partnerController.calculateRates(req.body);

      const cheapestRate = rates.reduce((prev, current) =>
        prev.totalAmount < current.totalAmount ? prev : current,
      );

      const fastestRate = rates.reduce((prev, current) =>
        prev.deliveryDays < current.deliveryDays ? prev : current,
      );

      res.json(
        APIResponse.success({
          rates,
          cheapestRate,
          fastestRate,
        }),
      );
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/partners/serviceability:
 *   post:
 *     tags: [Serviceability]
 *     summary: Check serviceability
 *     description: Check if partners can service a route
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ServiceabilityRequest'
 *     responses:
 *       200:
 *         description: Serviceability check results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceabilityResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  "/serviceability",
  serviceabilityLimiter,
  authMiddleware.authenticate,
  async (req, res, next) => {
    try {
      const serviceability = await partnerController.checkServiceability(
        req.body,
      );
      res.json(APIResponse.success({ serviceability }));
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
