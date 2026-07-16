FROM node:20-alpine

WORKDIR /app

# Install OpenSSL and bash
RUN apk add --no-cache openssl bash

# Copy shared library first (from build context root)
COPY shared ./shared

# Copy service source code
COPY backend/license-service .

# Copy the enhanced entrypoint script
COPY scripts/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Install dependencies after copying source
# This creates a baseline, but entrypoint will re-sync if needed
RUN yarn install --frozen-lockfile || yarn install

# Generate Prisma client
RUN npx prisma generate

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Create logs directory with proper ownership
RUN mkdir -p /app/logs/license-service && chown -R nodejs:nodejs /app/logs

# CRITICAL: Ensure /app directory is writable by nodejs user
# This allows yarn to install/update dependencies at runtime
RUN chown -R nodejs:nodejs /app
RUN chmod -R 755 /app
RUN chmod -R 775 /app/node_modules 2>/dev/null || true

USER nodejs

EXPOSE 3011

# Use enhanced entrypoint that auto-syncs dependencies
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

# Default command (can be overridden)
CMD ["yarn", "dev"]
