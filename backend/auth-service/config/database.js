const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('Prisma connected to PostgreSQL');
    return prisma;
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
};

const disconnectDB = async () => {
  try {
    await prisma.$disconnect();
    console.log('Prisma disconnected');
  } catch (error) {
    console.error('Error disconnecting from database:', error);
  }
};

module.exports = {
  prisma,
  connectDB,
  disconnectDB
};