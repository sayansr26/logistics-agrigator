FROM node:18-alpine

WORKDIR /app

# Install OpenSSL and pnpm
RUN apk add --no-cache openssl
RUN npm install -g pnpm@8.15.1

# Copy shared library first (from build context root)
COPY shared ./shared

# Copy service source code
COPY backend/license-service .

# Install dependencies and generate Prisma client
RUN pnpm install
RUN npx prisma generate

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Create logs directory with proper ownership BEFORE switching user
RUN mkdir -p /app/logs/license-service && chown -R nodejs:nodejs /app/logs

# CRITICAL FIX: Ensure /app directory and all subdirectories are writable by nodejs user
# This allows pnpm to create temp files and install dependencies when running as nodejs user
RUN chown -R nodejs:nodejs /app
RUN chmod -R 755 /app
RUN chmod -R 775 /app/node_modules 2>/dev/null || true

# Create .pnpm-store directory for pnpm cache with proper permissions
RUN mkdir -p /app/.pnpm-store && chown -R nodejs:nodejs /app/.pnpm-store && chmod 775 /app/.pnpm-store

# Create startup script that ensures dependencies are installed before starting
RUN printf '#!/bin/sh\necho "Checking and installing dependencies if needed..."\npnpm install --frozen-lockfile 2>/dev/null || pnpm install\necho "Running Prisma migrations..."\nnpx prisma migrate deploy || echo "Migration failed or no migrations to apply"\necho "Starting server with auto-reload..."\nexec pnpm run dev\n' > /app/start.sh
RUN chmod +x /app/start.sh
RUN chown nodejs:nodejs /app/start.sh

USER nodejs

EXPOSE 3011

CMD ["/app/start.sh"]