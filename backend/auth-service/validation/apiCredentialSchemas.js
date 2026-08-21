const Joi = require("joi");

const PERMISSION_PATTERN = /^[a-z*]+:[a-z*]+:[a-z*]+$/;

/**
 * POST /api/v1/external/auth/token — credential exchange.
 */
const issueTokenSchema = Joi.object({
  clientId: Joi.string().max(64).required().messages({
    "any.required": "clientId is required",
  }),
  clientSecret: Joi.string().max(255).required().messages({
    "any.required": "clientSecret is required",
  }),
});

/**
 * POST /api/v1/api-credentials — create a credential.
 *
 * `outletId` is optional only for superadmin (a platform-level key). For an
 * outlet creating its own key it is inferred from the session.
 */
const createCredentialSchema = Joi.object({
  name: Joi.string().min(2).max(120).required(),
  outletId: Joi.string().uuid().optional().allow(null),
  scopes: Joi.array()
    .items(Joi.string().pattern(PERMISSION_PATTERN))
    .max(40)
    .default([])
    .messages({
      "string.pattern.base":
        'Each scope must look like "module:action:scope", e.g. "shipment:create:own"',
    }),
  environment: Joi.string().valid("live", "test").default("live"),
  ipAllowlist: Joi.array().items(Joi.string().ip()).max(20).default([]),
  rateLimitPerMin: Joi.number().integer().min(1).max(6000).default(60),
  expiresAt: Joi.date().iso().greater("now").optional().allow(null),
});

const updateCredentialSchema = Joi.object({
  name: Joi.string().min(2).max(120).optional(),
  scopes: Joi.array()
    .items(Joi.string().pattern(PERMISSION_PATTERN))
    .max(40)
    .optional(),
  ipAllowlist: Joi.array().items(Joi.string().ip()).max(20).optional(),
  rateLimitPerMin: Joi.number().integer().min(1).max(6000).optional(),
  expiresAt: Joi.date().iso().greater("now").optional().allow(null),
}).min(1);

module.exports = {
  issueTokenSchema,
  createCredentialSchema,
  updateCredentialSchema,
};
