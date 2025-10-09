FROM node:18-alpine

WORKDIR /app

# Install OpenSSL and pnpm
RUN apk add --no-cache openssl
RUN npm install -g pnpm@8.15.1

# Copy shared library first (from build context root)
COPY shared ./shared

# Copy service source code
COPY backend/platform-service .

# Install dependencies and generate Prisma client
RUN pnpm install
RUN npx prisma generate

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Create logs directory with service-specific subdirectory
RUN mkdir -p logs/platform-service

# Change ownership (including logs)
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 8005

CMD ["node", "server.js"]