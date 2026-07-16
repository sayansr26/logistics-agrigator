# =============== PRODUCTION BUILD ===============
FROM node:20-alpine
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy workspace files (needed for yarn to resolve dependencies)
COPY --chown=nodejs:nodejs package.json yarn.lock ./
COPY --chown=nodejs:nodejs shared/package.json ./shared/package.json
COPY --chown=nodejs:nodejs frontend/package.json ./frontend/

# Install all dependencies
RUN yarn install --frozen-lockfile

# Copy shared and frontend source
COPY --chown=nodejs:nodejs shared ./shared
COPY --chown=nodejs:nodejs frontend ./frontend

# Build frontend
USER nodejs
RUN cd /app/frontend && yarn build

# Set up production runtime
USER root
WORKDIR /app/frontend

# Copy standalone output to root
RUN cp -r .next/standalone/* /app/production/ 2>/dev/null || mkdir -p /app/production
RUN cp -r .next/static /app/production/.next/ 2>/dev/null || true
RUN cp -r public /app/production/ 2>/dev/null || true

WORKDIR /app/production
USER nodejs

EXPOSE 3000

ENV PORT 3000
ENV NODE_ENV production

CMD ["node", "server.js"]
