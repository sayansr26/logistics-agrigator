FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.1

# Copy all source code first (needed for monorepo)
COPY . .

# Install dependencies
RUN pnpm install

# Create .next directory with proper permissions
RUN mkdir -p .next

EXPOSE 3000

CMD ["pnpm", "run", "dev"]