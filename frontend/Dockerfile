FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.1

# Copy all source code first (needed for monorepo)
COPY . .

# Install dependencies
RUN pnpm install

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Create necessary directories for Next.js
RUN mkdir -p .next .pnpm-store

# CRITICAL FIX: Ensure /app directory is writable for Next.js
RUN chown -R nodejs:nodejs /app
RUN chmod -R 755 /app
RUN chmod -R 775 /app/node_modules 2>/dev/null || true
RUN chmod -R 775 /app/.next 2>/dev/null || true
RUN chmod -R 775 /app/.pnpm-store 2>/dev/null || true

# Create startup script that ensures dependencies and Next.js build
RUN printf '#!/bin/sh\necho "Checking and installing dependencies if needed..."\npnpm install --frozen-lockfile 2>/dev/null || pnpm install\necho "Starting Next.js development server..."\nexec pnpm run dev\n' > /app/start.sh
RUN chmod +x /app/start.sh
RUN chown nodejs:nodejs /app/start.sh

USER nodejs

EXPOSE 3000

CMD ["/app/start.sh"]