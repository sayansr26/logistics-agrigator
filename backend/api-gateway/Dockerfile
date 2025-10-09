FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.1

# Copy shared library first (from build context root)
COPY shared ./shared

# Copy service source code
COPY backend/api-gateway .

# Install dependencies after copying source
RUN pnpm install

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Create logs directory with proper ownership BEFORE switching user
RUN mkdir -p /app/logs/api-gateway && chown -R nodejs:nodejs /app/logs

# CRITICAL FIX: Ensure /app directory and all subdirectories are writable by nodejs user
# This allows pnpm to create temp files and install dependencies when running as nodejs user
RUN chown -R nodejs:nodejs /app
RUN chmod -R 755 /app
RUN chmod -R 775 /app/node_modules 2>/dev/null || true

# Create .pnpm-store directory for pnpm cache with proper permissions
RUN mkdir -p /app/.pnpm-store && chown -R nodejs:nodejs /app/.pnpm-store && chmod 775 /app/.pnpm-store

# Create startup script that ensures dependencies are installed before starting
RUN printf '#!/bin/sh\necho "Checking and installing dependencies if needed..."\npnpm install --frozen-lockfile 2>/dev/null || pnpm install\necho "Starting server with auto-reload..."\nexec pnpm run dev\n' > /app/start.sh
RUN chmod +x /app/start.sh
RUN chown nodejs:nodejs /app/start.sh

USER nodejs

EXPOSE 3001

CMD ["/app/start.sh"]