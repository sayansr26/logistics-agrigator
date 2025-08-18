# Project Brief - Logistics Aggregator Portal

## Project Foundation & Scope

**Project Name**: Logistics Aggregator Portal  
**Domain**: E-Commerce, B2B, B2C Logistics Management  
**Target Market**: India Only  
**Development Timeline**: 24 weeks (6 months)  
**Budget Estimate**: ₹45-65 lakhs  

## Core Requirements & Goals

### Primary Objective
Build a comprehensive logistics management platform that integrates existing microservices (Wallet, Partner) with new services to create a unified portal for:
- Multi-tenant client management with white-label branding
- Complete shipment lifecycle management
- E-commerce platform integration (Shopify → WooCommerce)
- Real-time tracking and communication
- Financial transaction management
- Support and help desk operations

### Business Goals
1. **Market Position**: Become the leading logistics aggregator in India
2. **Client Base**: Support 100+ enterprise clients with multi-user access
3. **Transaction Volume**: Handle 10,000+ shipments monthly
4. **Platform Reach**: Initially Shopify, expand to WooCommerce, Magento
5. **User Experience**: Sub-500ms response times, >99.9% uptime

### Success Criteria
- **Phase 1**: Foundation with Auth, User, basic Shipment services
- **Phase 2**: Platform integrations and advanced features
- **Phase 3**: Analytics, AI/ML features, mobile app

## Technical Architecture Overview

### Microservices Structure (7 Total)
```
New Services (Build with Prisma ORM):
├── API Gateway (8000)      - Request routing, rate limiting
├── Auth Service (8001)     - JWT, RBAC, 2FA, audit logging
├── User Service (8002)     - Client management, profiles
├── Shipment Service (8003) - Order lifecycle management
├── Platform Service (8005) - E-commerce integrations
└── Support Service (8004)  - Help desk, tickets, knowledge base

Existing Services (Integrate via APIs):
├── Wallet Service (8006)   - Financial transactions
└── Partner Service (8007)  - Courier charge calculations
```

### Technology Stack
- **Backend**: Node.js + Express.js with Prisma ORM
- **Database**: PostgreSQL 15+ (service-per-database pattern)
- **Caching**: Redis 7+ for sessions and performance
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind
- **Infrastructure**: Docker + Docker Compose → VPS deployment
- **Authentication**: JWT with refresh tokens, RBAC, 2FA

### Critical Architectural Decisions
1. **Prisma ORM**: MANDATORY for all database operations (no raw SQL)
2. **Database Per Service**: Isolated data with audit logging across all services
3. **API-First Design**: REST APIs for service communication
4. **Type Safety**: Full TypeScript integration from database to frontend
5. **India-Specific**: GST compliance, local courier integrations, INR focus

## User Roles & Permissions

### Role-Based Access Control (5 Roles)
```
Admin (All Access):
- Complete system administration
- User management across all clients
- Financial oversight and reporting

Finance (Financial Operations):
- Wallet transactions and billing
- Financial reporting and analytics
- GST compliance and tax management

Operations (Logistics Management):
- Shipment creation and tracking
- Partner integration management
- Operational reporting and analytics

Client (Customer Access):
- Own shipment management
- Wallet balance viewing
- Basic reporting and tracking

Support (Customer Service):
- Ticket management and resolution
- User assistance and guidance
- Knowledge base management
```

## Core Feature Requirements

### Authentication & Authorization
- Multi-factor authentication with TOTP support
- Role-based permissions with granular access control
- Session management with Redis-based storage
- Complete audit trail for all user actions
- JWT access/refresh token pattern

### Client Management (Multi-Tenant)
- White-label branding (logos, colors, tracking pages)
- Client-specific settings and configurations
- User invitation system with role assignment
- Client data isolation and security
- Usage analytics and billing integration

### Shipment Management
- Complete order lifecycle (create → track → deliver)
- Integration with existing Partner Service for charges
- Real-time tracking with status updates
- Address validation and standardization
- Label generation and document management
- Bulk operations for high-volume clients

### Platform Integrations
- Shopify OAuth integration with order synchronization
- Webhook handling for real-time order updates
- Future: WooCommerce, Magento, OpenCart support
- Platform-specific settings and configurations
- Error handling and retry mechanisms

### Financial Operations
- Integration with existing Wallet Service
- Transaction tracking and reconciliation
- GST calculation and compliance
- Billing and invoicing automation
- Financial reporting and analytics

## India-Specific Requirements

### Compliance & Legal
- 18% GST calculations and reporting
- Indian postal code (pincode) validation
- Regional language support (Hindi + English)
- Data localization requirements
- Indian business hour operations

### Courier Integration
- Primary: Delhivery, Blue Dart, DTDC
- Secondary: India Post, Shiprocket, Xpressbees
- Real-time rate comparison
- Service availability by pincode
- COD (Cash on Delivery) support

### Performance Requirements
- **Critical Operations**: <500ms (authentication, search)
- **Standard Operations**: <2s (shipment creation, reports)
- **Batch Operations**: <30s (bulk imports, analytics)
- **Availability**: >99.9% uptime with 24/7 monitoring
- **Scalability**: Support 10,000+ concurrent users

## Development Approach

### Phase-Based Development (24 Weeks)
```
Phase 1 (Weeks 1-8): Foundation & Core Features
├── Infrastructure setup with Prisma architecture
├── Authentication service with RBAC
├── User management with client isolation
├── Basic shipment operations
├── Shopify integration MVP
└── Frontend application foundation

Phase 2 (Weeks 9-16): Advanced Features & Integration
├── Complete platform integrations
├── Advanced shipment features
├── Support system implementation
├── Analytics and reporting
├── Performance optimization
└── Mobile responsiveness

Phase 3 (Weeks 17-24): Production & Enhancement
├── Load testing and optimization
├── Advanced analytics with ML
├── Mobile application development
├── Third-party API extensions
├── Production deployment
└── Documentation and training
```

### Team Structure (10 Developers)
- **Backend Team (4)**: Microservices development with Prisma
- **Frontend Team (3)**: Next.js application development
- **Full-Stack Team (2)**: Integration and API development
- **DevOps (1)**: Infrastructure, deployment, monitoring

## Quality & Security Standards

### Code Quality
- TypeScript across all layers
- Prisma ORM for type-safe database operations
- Comprehensive error handling and logging
- Code reviews and automated testing
- ESLint + Prettier for consistent formatting

### Security Framework
- JWT-based authentication with secure refresh patterns
- Input validation and sanitization (Joi-based)
- SQL injection prevention via Prisma ORM
- Rate limiting and DDoS protection
- Audit logging for all sensitive operations
- HTTPS-only communication in production

### Monitoring & Observability
- Structured logging with Winston
- Health checks for all services
- Database performance monitoring
- Real-time error tracking
- Business metrics and analytics

## External Dependencies & Integrations

### Existing Services (To Integrate)
1. **Wallet Service**: Financial transactions and balance management
2. **Partner Service**: Courier charge calculations and comparisons

### Third-Party Services
1. **Shopify API**: E-commerce platform integration
2. **Courier APIs**: Delhivery, Blue Dart, DTDC
3. **Payment Gateways**: Razorpay, PayU (future)
4. **SMS/Email Services**: OTP and notifications
5. **Maps APIs**: Google Maps for address validation

## Risk Mitigation & Constraints

### Technical Risks
- **External API Dependencies**: Robust error handling and fallbacks
- **Database Performance**: Proper indexing and query optimization
- **Service Reliability**: Health checks and automated recovery
- **Data Security**: Encryption at rest and in transit

### Business Constraints
- **India-Only Focus**: Regional compliance and local integrations
- **Existing Service Integration**: Must work with current Wallet/Partner APIs
- **Performance Requirements**: Sub-500ms for critical operations
- **Budget Constraints**: ₹45-65 lakhs development budget

## Project Success Metrics

### Technical KPIs
- **Performance**: 95% of requests <500ms
- **Reliability**: 99.9% uptime SLA
- **Security**: Zero security incidents
- **Code Quality**: >90% test coverage

### Business KPIs
- **User Adoption**: 100+ enterprise clients onboarded
- **Transaction Volume**: 10,000+ monthly shipments processed
- **Client Satisfaction**: >4.5/5 satisfaction rating
- **Platform Integration**: Shopify fully functional, WooCommerce planned

**Project Status**: ✅ Foundation Complete - Week 2 Development Ready  
**Next Milestone**: User Service Development with Prisma Schema Design