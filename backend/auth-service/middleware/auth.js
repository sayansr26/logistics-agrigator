const jwt = require('jsonwebtoken');
const { getRedisClient } = require('../config/redis');

const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        status: 'error',
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access denied. No token provided.'
        }
      });
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if session exists in Redis
    const redisClient = getRedisClient();
    const session = await redisClient.get(`session:${decoded.userId}`);
    
    if (!session) {
      return res.status(401).json({
        status: 'error',
        error: {
          code: 'INVALID_SESSION',
          message: 'Invalid session.'
        }
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token expired.'
        }
      });
    }
    
    res.status(401).json({
      status: 'error',
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid token.'
      }
    });
  }
};

const authorize = (requiredPermissions) => {
  return (req, res, next) => {
    const userPermissions = req.user.permissions || [];
    
    // Admin has all permissions
    if (userPermissions.includes('all_permissions')) {
      return next();
    }
    
    const hasPermission = requiredPermissions.every(permission =>
      userPermissions.includes(permission)
    );
    
    if (!hasPermission) {
      return res.status(403).json({
        status: 'error',
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions.'
        }
      });
    }
    
    next();
  };
};

module.exports = { authenticate, authorize };