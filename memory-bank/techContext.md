# Tech Context - Technologies & Development Stack

## Technology Stack Overview

### Backend Technologies

#### **Core Runtime & Framework**
- **Node.js 18+**: Latest LTS with modern JavaScript features and performance optimizations
- **Express.js 4.18+**: Minimal, flexible web application framework
- **JavaScript/TypeScript**: Progressive adoption with TypeScript for critical services

#### **Database & ORM (CRITICAL)**
- **PostgreSQL 15+**: Primary database with advanced features (JSONB, UUID, full-text search)
- **Prisma ORM 5.x**: Type-safe database client with migration management ⭐ **MANDATORY**
- **Redis 7+**: In-memory data store for sessions, caching, and real-time features

**Prisma Benefits & Usage**:
```prisma
// Type-safe schema definition
model User {
  id           String   @id @default(uuid()) @db.Uuid
  email        String   @unique @db.VarChar(255)
  passwordHash String   @map("password_hash")
  role         UserRole
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
  
  sessions     Session[]
  auditLogs    AuditLog[]
  
  @@map("users")
}
```

```javascript
// Type-safe operations
const user = await prisma.user.create({
  data: { email, passwordHash, role },
  select: { id: true, email: true, role: true }
});
```

#### **Authentication & Security**
- **JWT (jsonwebtoken)**: Access and refresh token implementation
- **bcryptjs**: Password hashing with configurable rounds (12 rounds)
- **Joi**: Schema validation for request/response data
- **Helmet**: Security middleware for HTTP headers
- **Rate Limiting**: Express-rate-limit with Redis store

#### **HTTP Client & Integration**
- **Axios**: HTTP client for external service integration
- **HTTP Proxy Middleware**: API Gateway request forwarding
- **Multer**: File upload handling for documents and images

#### **Logging & Monitoring**
- **Winston**: Structured logging with multiple transports
- **Morgan**: HTTP request logging middleware
- **Health Check Endpoints**: Custom health monitoring implementation

### Frontend Technologies

#### **Core Framework & Language**
- **Next.js 14**: React framework with App Router (latest architecture)
- **React 18**: Modern React with concurrent features and hooks
- **TypeScript 5.x**: Static type checking for enhanced developer experience

#### **Styling & UI**
- **Tailwind CSS 3.x**: Utility-first CSS framework with custom design system
- **Headless UI**: Unstyled, accessible UI components
- **React Icons**: Comprehensive icon library
- **Custom Design Tokens**: Consistent spacing, colors, typography

#### **State Management & Forms**
- **Zustand**: Lightweight state management for global app state
- **React Hook Form**: Performant form management with minimal re-renders
- **Zod**: TypeScript-first schema validation for forms
- **SWR/React Query**: Data fetching and caching (to be selected)

#### **Build & Development**
- **Webpack 5**: Module bundler with tree shaking and optimization
- **ESLint + Prettier**: Code linting and formatting
- **PostCSS**: CSS processing with Tailwind plugins

### Infrastructure & DevOps

#### **Containerization**
- **Docker 24+**: Container platform for development and production
- **Docker Compose**: Multi-service orchestration for development
- **Multi-stage Builds**: Optimized production images

```dockerfile
# Multi-stage Docker pattern
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/

FROM base AS development
RUN npm ci
RUN npx prisma generate
COPY . .
CMD ["npm", "run", "dev"]

FROM base AS production
RUN npm ci --only=production
RUN npx prisma generate
COPY . .
USER node
CMD ["node", "server.js"]
```

#### **Development Environment**
- **Hot Reloading**: Live code updates in development
- **Volume Mounts**: Persistent development data
- **Service Networking**: Docker internal networking for service communication
- **Port Management**: Standardized port allocation across services

#### **Database Management**
- **Prisma Studio**: Visual database browser and editor
- **Database Migrations**: Version-controlled schema evolution
- **Connection Pooling**: Efficient database connection management
- **Multi-Database**: Service-per-database architecture

```bash
# Standard Prisma workflow
npx prisma migrate dev --name description  # Create migration
npx prisma generate                        # Update client
npx prisma studio                         # Visual database
npx prisma migrate deploy                 # Production deployment
```

### External Service Integration

#### **Existing Microservices**
- **Wallet Service (Port 8006)**: Financial transactions and balance management
- **Partner Service (Port 8007)**: Courier charge calculations and comparisons

```javascript
// Integration pattern
class WalletServiceClient {
  async getBalance(userId) {
    const response = await axios.get(`${WALLET_SERVICE_URL}/wallet/balance/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
  }
}
```

#### **Third-Party APIs**
- **Shopify API**: E-commerce platform integration with OAuth2
- **Courier APIs**: Delhivery, Blue Dart, DTDC integration
- **Payment Gateways**: Razorpay, PayU (future integration)
- **Communication**: SMS and email service providers

#### **Platform Integration Architecture**
```javascript
// Shopify OAuth flow
const shopifyAuth = {
  authorizeURL: 'https://{shop}.myshopify.com/admin/oauth/authorize',
  tokenURL: 'https://{shop}.myshopify.com/admin/oauth/access_token',
  scopes: ['read_orders', 'write_orders', 'read_products'],
  webhooks: ['orders/create', 'orders/updated', 'orders/cancelled']
};
```

### Development Tools & Utilities

#### **Code Quality & Testing**
- **ESLint**: JavaScript/TypeScript linting with custom rules
- **Prettier**: Opinionated code formatting
- **Husky**: Git hooks for pre-commit checks
- **Jest**: Testing framework for unit and integration tests
- **Supertest**: HTTP assertion library for API testing

#### **Development Workflow**
- **Git**: Version control with conventional commits
- **VS Code**: Recommended IDE with extensions
- **Prisma Studio**: Database visualization and management
- **Docker Logs**: Centralized log viewing and debugging

#### **Environment Management**
```bash
# Environment variables pattern
NODE_ENV=development
PORT=8001
DATABASE_URL="postgresql://user:pass@localhost:5432/db"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="3600"
```

### Security Technologies

#### **Authentication & Authorization**
- **JWT Tokens**: Stateless authentication with short-lived access tokens
- **Refresh Token Rotation**: Secure token renewal mechanism  
- **Session Storage**: Redis-based session management
- **2FA Support**: TOTP (Time-based One-Time Password) implementation

#### **Data Protection**
- **Input Validation**: Joi schemas for request validation
- **SQL Injection Prevention**: Prisma ORM built-in protection
- **Password Security**: bcrypt with 12 rounds
- **Data Encryption**: AES-256 for sensitive data at rest

#### **Network Security**
- **HTTPS**: SSL/TLS encryption for all communications
- **CORS**: Cross-Origin Resource Sharing configuration
- **Rate Limiting**: API throttling and DDoS protection
- **Security Headers**: Helmet.js for HTTP security headers

### Performance & Monitoring

#### **Caching Strategy**
- **Redis Caching**: Query result caching with TTL
- **Session Caching**: User session data in Redis
- **API Response Caching**: Strategic endpoint caching
- **Static Asset Caching**: CDN and browser caching

#### **Database Optimization**
- **Connection Pooling**: Prisma connection pool management
- **Query Optimization**: Strategic use of `select` and `include`
- **Indexing Strategy**: Database indexes for performance
- **Migration Management**: Version-controlled schema changes

#### **Monitoring & Health Checks**
```javascript
// Health check implementation
app.get('/health', async (req, res) => {
  const checks = {
    database: await checkDatabaseConnection(),
    redis: await checkRedisConnection(),
    externalServices: await checkExternalServices()
  };
  
  const isHealthy = Object.values(checks).every(check => check.status === 'ok');
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks
  });
});
```

### India-Specific Technologies

#### **Compliance & Localization**
- **GST Calculation**: 18% tax calculation and reporting
- **Indian Pincode Validation**: 6-digit postal code validation
- **Regional Language Support**: i18n framework for Hindi/English
- **Indian Standard Time**: Timezone handling for IST

#### **Payment & Financial**
- **Indian Currency (INR)**: Decimal precision handling for rupees
- **Banking Integration**: NEFT, RTGS, UPI integration patterns
- **Financial Compliance**: RBI guidelines and reporting requirements

### Development Constraints & Standards

#### **Code Standards**
```javascript
// Standard service structure
src/
├── config/         # Configuration files
│   ├── database.js # Prisma client setup
│   └── redis.js    # Redis client setup
├── controllers/    # Route handlers
├── middleware/     # Custom middleware
├── routes/         # API route definitions
├── utils/          # Utility functions
├── prisma/         # Database schema & migrations
│   ├── schema.prisma
│   └── migrations/
└── server.js       # Application entry point
```

#### **Naming Conventions**
- **Files**: camelCase for JavaScript, kebab-case for configs
- **Database**: snake_case for tables and columns
- **APIs**: RESTful with consistent naming patterns
- **Environment**: UPPER_SNAKE_CASE for environment variables

#### **Performance Requirements**
- **API Response Times**: <500ms for critical operations
- **Database Query Performance**: <100ms for standard queries
- **Memory Usage**: <512MB per service container
- **CPU Usage**: <80% under normal load

### Future Technology Roadmap

#### **Short-term Enhancements (3-6 months)**
- **Message Queues**: Redis Pub/Sub or RabbitMQ for event-driven architecture
- **GraphQL**: API consolidation layer for complex frontend queries
- **TypeScript Migration**: Full TypeScript adoption across backend services
- **Testing Expansion**: Comprehensive unit and integration test coverage

#### **Medium-term Evolution (6-12 months)**
- **Microservices Mesh**: Service mesh architecture with Istio
- **Container Orchestration**: Kubernetes deployment for production scaling
- **CI/CD Pipeline**: Automated testing, building, and deployment
- **Advanced Monitoring**: Prometheus, Grafana, ELK stack implementation

#### **Long-term Vision (12+ months)**
- **Event Sourcing**: CQRS pattern for complex business logic
- **Machine Learning**: Predictive analytics for demand forecasting
- **Real-time Features**: WebSocket implementation for live updates
- **Mobile API**: GraphQL-based API for mobile applications

### Current Technology Status

#### **✅ Implemented & Validated**
- **Backend Infrastructure**: Node.js + Express + Prisma + PostgreSQL + Redis
- **Authentication System**: JWT with RBAC and audit logging
- **API Gateway**: Request routing and middleware
- **Frontend Foundation**: Next.js 14 with TypeScript and Tailwind
- **Development Environment**: Docker Compose with hot reloading
- **Database Management**: Prisma migrations and studio

#### **🔄 Ready for Implementation**
- **User Service**: Prisma schema design and API development
- **Frontend Integration**: Authentication forms and state management
- **External Service Integration**: Wallet and Partner service connections
- **Platform Integration**: Shopify OAuth and webhook handling

#### **📋 Planned for Future Phases**
- **Shipment Service**: Core logistics operations
- **Support Service**: Help desk and ticketing system
- **Advanced Features**: Analytics, reporting, mobile support
- **Production Deployment**: VPS deployment and monitoring

**Technology Decision Status**: ✅ **Stack Finalized and Validated**  
**Current Phase**: Foundation complete, feature development ready  
**Next Priority**: User Service development with established patterns