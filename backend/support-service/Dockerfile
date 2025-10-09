FROM node:18-alpine

WORKDIR /app

# Install OpenSSL and pnpm
RUN apk add --no-cache openssl
RUN npm install -g pnpm@8.15.1

# Copy shared library first (from build context root)
COPY shared ./shared

# Copy service source code
COPY backend/support-service .

# Install dependencies and generate Prisma client
RUN pnpm install
RUN npx prisma generate

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Create logs directory with proper ownership BEFORE switching user
RUN mkdir -p /app/logs/support-service && chown -R nodejs:nodejs /app/logs

# Change ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 8004

CMD ["node", "server.js"]