# Project Brief - Logistics Aggregator Portal

> Foundation document | Last Updated: December 2024

## Project Overview

**Logistics Aggregator Portal** is a comprehensive multi-tenant B2B/B2C logistics management platform designed specifically for the Indian e-commerce market. It provides white-label capabilities and integrations with 75+ courier partners, serving as a complete shipping and logistics solution for businesses of all sizes.

## Vision

To become the leading logistics aggregation platform in India, offering seamless courier integrations, real-time tracking, automated shipping workflows, and comprehensive financial management—all through a single, unified platform.

## Core Requirements

### Business Requirements

1. **Multi-Tenant Architecture**
   - Support for multiple license holders (clients)
   - White-label customization capabilities
   - Tenant isolation for data security

2. **Courier Integration**
   - Integration with 75+ Indian courier partners
   - Unified API for all courier operations
   - Automated rate calculation and comparison
   - Real-time serviceability checks by pincode

3. **Shipment Management**
   - End-to-end shipment lifecycle management
   - Bulk order processing (CSV/Excel uploads)
   - AWB (Air Waybill) generation
   - Real-time tracking and status updates
   - NDR (Non-Delivery Report) management
   - RTO (Return to Origin) handling

4. **Financial Operations**
   - Prepaid wallet system for shipping charges
   - Transaction history and ledger
   - COD (Cash on Delivery) remittance tracking
   - Invoice generation and GST compliance

5. **Role-Based Access Control (RBAC)**
   - 11-role hierarchical permission system
   - Granular permission management
   - Scope-based data access (own, assigned, all)

### Technical Requirements

1. **Microservices Architecture**
   - Service isolation for scalability
   - Database-per-service pattern
   - Shared library for common utilities

2. **Security**
   - JWT-based authentication
   - Redis session management
   - HMAC-based API authentication for external services
   - Audit logging for all operations

3. **Performance**
   - Redis caching for API responses
   - Optimized database queries with Prisma ORM
   - Rate limiting and throttling

4. **Scalability**
   - Docker containerization
   - Horizontal scaling capability
   - Load balancing ready

## Target Users

| Role           | Description               | Primary Functions                       |
| -------------- | ------------------------- | --------------------------------------- |
| **Superadmin** | System owner              | Full system control, license management |
| **Admin**      | Platform administrator    | Platform configuration, user management |
| **Client**     | License holder (business) | Shipment operations, team management    |
| **Customer**   | End user of client        | Order placement, tracking               |
| **Affiliate**  | Commission partner        | Referral management, earnings           |

## Success Metrics

- **System Uptime**: 99.9% availability
- **API Response Time**: < 200ms for standard operations
- **Order Processing**: Support 10,000+ daily shipments
- **User Capacity**: 1,000+ concurrent users

## Project Scope

### In Scope

- API Gateway with intelligent routing
- Authentication and authorization services
- User and customer management
- Shipment lifecycle management
- Partner (courier) integration service
- Wallet and transaction management
- License management system
- Support ticketing system
- E-commerce platform integrations (Shopify, WooCommerce)
- Admin dashboard and reporting

### Out of Scope (Phase 1)

- Mobile applications
- AI-powered route optimization
- International shipping
- Warehouse management integration

## Constraints

1. **India-Focused**: All features optimized for Indian logistics
2. **Currency**: INR only
3. **Compliance**: GST regulations and invoicing requirements
4. **Infrastructure**: VPS-based deployment initially

## Timeline

- **Phase 1** (Weeks 1-8): Core services, authentication, shipment management
- **Phase 2** (Weeks 9-16): Full courier integration, bulk operations
- **Phase 3** (Weeks 17-24): Platform integrations, reporting, optimization

## Key Stakeholders

- **Development Team**: Microservices and frontend development
- **Operations Team**: Logistics and courier partnerships
- **Finance Team**: Wallet and billing operations
- **Support Team**: Customer and client assistance

---

**Status**: Phase 1 In Progress  
**Priority**: P0 - Critical Business Launch
