const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { prisma } = require('../config/database');
const { getRedisClient } = require('../config/redis');

class AuthController {
  // User registration
  static async register(req, res) {
    try {
      const { email, password, name, role = 'client', clientId } = req.body;
      
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });
      
      if (existingUser) {
        return res.status(400).json({
          status: 'error',
          error: {
            code: 'USER_EXISTS',
            message: 'User with this email already exists'
          }
        });
      }
      
      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);
      
      // Create user with Prisma
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role,
          clientId
        },
        select: {
          id: true,
          email: true,
          role: true,
          clientId: true,
          isActive: true,
          createdAt: true
        }
      });
      
      // Log user creation
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'CREATE',
          resource: 'user',
          resourceId: user.id,
          changes: {
            email: user.email,
            role: user.role
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });
      
      res.status(201).json({
        status: 'success',
        data: { user }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        status: 'error',
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Registration failed'
        }
      });
    }
  }
  
  // User login
  static async login(req, res) {
    try {
      const { email, password, twoFactorCode } = req.body;
      
      // Get user with Prisma
      const user = await prisma.user.findUnique({
        where: { 
          email,
          isActive: true
        }
      });
      
      if (!user) {
        return res.status(401).json({
          status: 'error',
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password'
          }
        });
      }
      
      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({
          status: 'error',
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password'
          }
        });
      }
      
      // Check 2FA if enabled
      if (user.twoFactorEnabled) {
        if (!twoFactorCode) {
          return res.status(401).json({
            status: 'error',
            error: {
              code: 'TWO_FACTOR_REQUIRED',
              message: '2FA code required'
            }
          });
        }
        
        const verified = speakeasy.totp.verify({
          secret: user.twoFactorSecret,
          encoding: 'base32',
          token: twoFactorCode,
          window: 1
        });
        
        if (!verified) {
          return res.status(401).json({
            status: 'error',
            error: {
              code: 'INVALID_2FA_CODE',
              message: 'Invalid 2FA code'
            }
          });
        }
      }
      
      // Generate tokens
      const permissions = this.getRolePermissions(user.role);
      const accessToken = jwt.sign(
        {
          userId: user.id,
          clientId: user.clientId,
          role: user.role,
          permissions
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '3600s' }
      );
      
      const refreshToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      
      // Store refresh token with Prisma
      await prisma.session.create({
        data: {
          userId: user.id,
          refreshToken,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });
      
      // Store session in Redis
      const redisClient = getRedisClient();
      await redisClient.setEx(
        `session:${user.id}`,
        3600,
        JSON.stringify({ userId: user.id, role: user.role })
      );
      
      // Log successful login
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          resource: 'session',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });
      
      res.json({
        status: 'success',
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            clientId: user.clientId,
            permissions
          },
          accessToken,
          refreshToken,
          expiresIn: 3600
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        status: 'error',
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Login failed'
        }
      });
    }
  }
  
  // Refresh token
  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(401).json({
          status: 'error',
          error: {
            code: 'REFRESH_TOKEN_REQUIRED',
            message: 'Refresh token is required'
          }
        });
      }
      
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
      
      // Find session with Prisma
      const session = await prisma.session.findFirst({
        where: {
          userId: decoded.userId,
          refreshToken,
          expiresAt: {
            gt: new Date()
          }
        },
        include: {
          user: true
        }
      });
      
      if (!session) {
        return res.status(401).json({
          status: 'error',
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Invalid or expired refresh token'
          }
        });
      }
      
      const user = session.user;
      
      // Generate new access token
      const permissions = this.getRolePermissions(user.role);
      const newAccessToken = jwt.sign(
        {
          userId: user.id,
          clientId: user.clientId,
          role: user.role,
          permissions
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '3600s' }
      );
      
      // Generate new refresh token
      const newRefreshToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      
      // Update session with new refresh token
      await prisma.session.update({
        where: { id: session.id },
        data: {
          refreshToken: newRefreshToken,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });
      
      res.json({
        status: 'success',
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn: 3600
        }
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(401).json({
        status: 'error',
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid refresh token'
        }
      });
    }
  }
  
  // Logout
  static async logout(req, res) {
    try {
      const { refreshToken } = req.body;
      const userId = req.user?.userId;
      
      if (refreshToken) {
        // Delete specific session
        await prisma.session.deleteMany({
          where: {
            refreshToken,
            userId
          }
        });
      }
      
      if (userId) {
        // Remove from Redis
        const redisClient = getRedisClient();
        await redisClient.del(`session:${userId}`);
        
        // Log logout
        await prisma.auditLog.create({
          data: {
            userId,
            action: 'LOGOUT',
            resource: 'session',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          }
        });
      }
      
      res.json({
        status: 'success',
        data: {
          message: 'Logged out successfully'
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        status: 'error',
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Logout failed'
        }
      });
    }
  }
  
  // Get role permissions
  static getRolePermissions(role) {
    const permissions = {
      admin: ['all_permissions'],
      finance: ['wallet_access', 'billing_access', 'reports_access'],
      operations: ['shipment_access', 'tracking_access', 'partner_access'],
      client: ['own_shipments', 'tracking', 'wallet_view'],
      support: ['ticket_access', 'user_support', 'knowledge_base']
    };
    
    return permissions[role] || [];
  }
}

module.exports = AuthController;