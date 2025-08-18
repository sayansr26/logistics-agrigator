// Shared utilities and configurations
const auth = require('./lib/auth');
const validation = require('./lib/validation');
const logger = require('./lib/logger');
const database = require('./lib/database');
const redis = require('./lib/redis');
const response = require('./lib/response');
const errors = require('./lib/errors');

module.exports = {
  auth,
  validation,
  logger,
  database,
  redis,
  response,
  errors
};