FROM node:18-alpine

WORKDIR /app

# Install OpenSSL and pnpm
RUN apk add --no-cache openssl
RUN npm install -g pnpm@8.15.1

# Copy shared library first (from build context root)
COPY shared ./shared

# Copy service source code
COPY backend/partner-service .

# Install dependencies and generate Prisma client
RUN pnpm install
RUN npx prisma generate

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Create logs directory
RUN mkdir -p logs

# Create startup script that runs migrations before starting the server
RUN printf '#!/bin/sh\necho "Running Prisma migrations..."\nnpx prisma migrate deploy || echo "Migration failed or no migrations to apply"\necho "Starting server with auto-reload..."\nexec pnpm run dev\n' > /app/start.sh
RUN chmod +x /app/start.sh

# Change ownership of all files
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3005

CMD ["/app/start.sh"]
