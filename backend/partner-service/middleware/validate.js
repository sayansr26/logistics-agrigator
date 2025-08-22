// Use shared validation middleware
const { validate } = require("../shared/lib/validation");

// Export validation functions
module.exports = {
  validate,
  validateBody: validate, // Alias for backward compatibility
};
