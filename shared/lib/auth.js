const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Shared authentication utilities
const authUtils = {
  // Hash password
  hashPassword: async (password) => {
    return await bcrypt.hash(password, 12);
  },

  // Compare password
  comparePassword: async (password, hash) => {
    return await bcrypt.compare(password, hash);
  },

  // Generate JWT token
  generateToken: (payload, options = {}) => {
    const defaultOptions = {
      expiresIn: process.env.JWT_EXPIRES_IN || '3600s'
    };
    return jwt.sign(payload, process.env.JWT_SECRET, { ...defaultOptions, ...options });
  },

  // Verify JWT token
  verifyToken: (token) => {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw error;
    }
  },

  // Generate refresh token
  generateRefreshToken: (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' });
  },

  // Get user permissions based on role
  getRolePermissions: (role) => {
    const permissions = {
      admin: ['all_permissions'],
      finance: ['wallet_access', 'billing_access', 'reports_access'],
      operations: ['shipment_access', 'tracking_access', 'partner_access'],
      client: ['own_shipments', 'tracking', 'wallet_view'],
      support: ['ticket_access', 'user_support', 'knowledge_base']
    };
    
    return permissions[role] || [];
  },

  // Check if user has required permissions
  hasPermissions: (userPermissions, requiredPermissions) => {
    if (userPermissions.includes('all_permissions')) {
      return true;
    }
    
    return requiredPermissions.every(permission => 
      userPermissions.includes(permission)
    );
  }
};

module.exports = authUtils;