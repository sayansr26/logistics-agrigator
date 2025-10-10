const { PrismaClient } = require('@prisma/client');
const logger = require('../shared/lib/logger');

let prisma;

/**
 * Initialize Prisma database connection
 */
const initializeDatabase = async () => {
  try {
    const logConfig = process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn', 'info']
      : ['error', 'warn'];

    prisma = new PrismaClient({
      log: logConfig,
      errorFormat: 'minimal',
    });

    // Test connection
    await prisma.$connect();
    logger.info('Database connected successfully');

    return prisma;
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
};

/**
 * Get Prisma client instance
 */
const getDatabase = () => {
  if (!prisma) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return prisma;
};

/**
 * Close database connection
 */
const closeDatabase = async () => {
  if (prisma) {
    await prisma.$disconnect();
    logger.info('Database connection closed');
  }
};

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase,
};