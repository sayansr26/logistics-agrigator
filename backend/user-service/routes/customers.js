// Customer Routes - RBAC-006 Customer Management APIs
// Routes for customer CRUD and sub-user management

const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");
const { authMiddleware } = require("../shared/lib/auth");
const {
  validateCustomerCreate,
  validateCustomerUpdate,
  validateCustomerUserCreate,
} = require("../validation/customerSchemas");

/**
 * @swagger
 * tags:
 *   name: Customers
 *   description: Customer management endpoints (RBAC-006)
 */

/**
 * @swagger
 * /api/v1/customers:
 *   post:
 *     summary: Create a new customer
 *     description: Create a new customer under the authenticated client (Permission - customer:create:parent)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *                 example: Acme Corporation
 *               email:
 *                 type: string
 *                 format: email
 *                 example: contact@acme.com
 *               phone:
 *                 type: string
 *                 example: "+919876543210"
 *               monthlyShipmentLimit:
 *                 type: integer
 *                 example: 1000
 *               enabledModules:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["shipment", "billing", "wallet", "analytics"]
 *               isActive:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Customer created successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Insufficient permissions
 *       409:
 *         description: Customer email already exists
 */
router.post(
  "/v1/customers",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("customer", "create", "parent"),
  validateCustomerCreate,
  customerController.createCustomer,
);

/**
 * @swagger
 * /api/v1/customers:
 *   get:
 *     summary: List all customers
 *     description: List customers with scope filtering (Permission - customer:read:assigned)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: List of customers
 *       403:
 *         description: Insufficient permissions
 */
router.get(
  "/v1/customers",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("customer", "read", "assigned"),
  customerController.listCustomers,
);

/**
 * @swagger
 * /api/v1/customers/{customerId}:
 *   get:
 *     summary: Get customer details
 *     description: Get detailed information about a specific customer (Permission - customer:read:assigned)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Customer details
 *       403:
 *         description: Access denied
 *       404:
 *         description: Customer not found
 */
router.get(
  "/v1/customers/:customerId",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("customer", "read", "assigned"),
  customerController.getCustomer,
);

/**
 * @swagger
 * /api/v1/customers/{customerId}:
 *   put:
 *     summary: Update customer
 *     description: Update customer details (Permission - customer:update:assigned)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               monthlyShipmentLimit:
 *                 type: integer
 *               enabledModules:
 *                 type: array
 *                 items:
 *                   type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Customer updated successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Customer not found
 */
router.put(
  "/v1/customers/:customerId",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("customer", "update", "assigned"),
  validateCustomerUpdate,
  customerController.updateCustomer,
);

/**
 * @swagger
 * /api/v1/customers/{customerId}:
 *   delete:
 *     summary: Deactivate customer
 *     description: Soft delete customer by deactivating (Permission - customer:delete:assigned)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Customer deactivated successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Customer not found
 */
router.delete(
  "/v1/customers/:customerId",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("customer", "delete", "assigned"),
  customerController.deleteCustomer,
);

/**
 * @swagger
 * /api/v1/customers/{customerId}/users:
 *   post:
 *     summary: Add customer sub-user
 *     description: Add a team member to customer (Permission - customer:manage:parent)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               role:
 *                 type: string
 *                 enum: [customer, customer_account, customer_sales, customer_support]
 *                 default: customer
 *               enabledModules:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["shipment", "billing"]
 *     responses:
 *       201:
 *         description: Customer user added successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Customer not found
 *       409:
 *         description: User already assigned
 */
router.post(
  "/v1/customers/:customerId/users",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("customer", "manage", "parent"),
  validateCustomerUserCreate,
  customerController.addCustomerUser,
);

/**
 * @swagger
 * /api/v1/customers/{customerId}/users:
 *   get:
 *     summary: List customer sub-users
 *     description: Get all team members for a customer (Permission - customer:read:assigned)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of customer users
 *       403:
 *         description: Access denied
 */
router.get(
  "/v1/customers/:customerId/users",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("customer", "read", "assigned"),
  customerController.listCustomerUsers,
);

/**
 * @swagger
 * /api/v1/customers/{customerId}/users/{userId}:
 *   put:
 *     summary: Update customer sub-user
 *     description: Update customer team member details (Permission - customer:update:assigned)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *               enabledModules:
 *                 type: array
 *                 items:
 *                   type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Customer user updated successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Customer user not found
 */
router.put(
  "/v1/customers/:customerId/users/:userId",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("customer", "update", "assigned"),
  customerController.updateCustomerUser,
);

/**
 * @swagger
 * /api/v1/customers/{customerId}/users/{userId}:
 *   delete:
 *     summary: Remove customer sub-user
 *     description: Remove team member from customer (Permission - customer:delete:assigned)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Customer user removed successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Customer user not found
 */
router.delete(
  "/v1/customers/:customerId/users/:userId",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("customer", "delete", "assigned"),
  customerController.removeCustomerUser,
);

module.exports = router;
