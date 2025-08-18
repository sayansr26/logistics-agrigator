FROM node:18-alpine

WORKDIR /app

# Install OpenSSL and pnpm  
RUN apk add --no-cache openssl
RUN npm install -g pnpm@8.15.1

# Copy all source code first
COPY . .

# Install dependencies and generate Prisma client
RUN pnpm install
RUN npx prisma generate

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8002/health || exit 1

# Start the application
CMD ["pnpm", "run", "dev"]