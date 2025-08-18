// Global error handler
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  // Database errors
  if (err.code === '23505') { // Unique constraint violation
    return res.status(400).json({
      status: 'error',
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'Resource already exists'
      }
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'error',
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid token'
      }
    });
  }

  // Default error
  res.status(500).json({
    status: 'error',
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    }
  });
};

module.exports = { errorHandler };