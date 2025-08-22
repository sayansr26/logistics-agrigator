# Backend Environment Configuration Guide

This document provides an overview of all environment configurations for backend services in the Logistics Aggregator Portal.

## 📋 Overview

Each backend service has its own `.env.example` file that serves as a template for creating the actual `.env` file. The setup script automatically creates `.env` files from these templates.

## 🔧 Service Configurations

### 1. Auth Service (`backend/auth-service/.env.example`)

**Purpose**: JWT authentication, session management, and security

**Key Configurations:**

- Database: `logistics_auth` (Port 8001)
- JWT token settings and expiration
- Redis for session storage
- Prisma ORM configuration

**Security Features:**

- JWT secret configuration
- Token expiration settings
- Session management

### 2. User Service (`backend/user-service/.env.example`)

**Purpose**: User management, profiles, and file handling

**Key Configurations:**

- Database: `logistics_users` (Port 8002)
- File upload paths for avatars and documents
- Maximum upload size and allowed file types
- Inter-service communication URLs

**User-Specific Features:**

- Avatar upload management
- Document handling
- File size and type restrictions

### 3. Shipment Service (`backend/shipment-service/.env.example`)

**Purpose**: Order tracking, shipment management, and logistics operations

**Key Configurations:**

- Database: `logistics_shipments` (Port 8003)
- Tracking URL configuration
- Courier integration settings
- Notification services (SMS/Email)

**Logistics Features:**

- Package weight limits
- Currency settings (INR)
- Courier webhook secrets
- Label and document upload paths
- SMS/Email provider configuration

### 4. Support Service (`backend/support-service/.env.example`)

**Purpose**: Customer support, ticketing, and help desk operations

**Key Configurations:**

- Database: `logistics_support` (Port 8004)
- Ticket management settings
- Live chat configuration
- Email notification setup

**Support Features:**

- Ticket attachment handling
- Auto-assignment settings
- Escalation timers
- Live chat session management
- Support email configuration

### 5. Platform Service (`backend/platform-service/.env.example`)

**Purpose**: E-commerce platform integrations (Shopify, Amazon, etc.)

**Key Configurations:**

- Database: `logistics_platforms` (Port 8005)
- Multiple platform API credentials
- Sync intervals and retry settings
- Webhook configurations

**Platform Integrations:**

- **Shopify**: Client ID, secret, webhook secret, API version
- **Amazon**: Client credentials, marketplace ID
- **WooCommerce**: Consumer key and secret
- **Magento**: Access token and base URL
- Sync scheduling and rate limiting

### 6. API Gateway (`backend/api-gateway/.env.example`)

**Purpose**: Request routing, rate limiting, and service orchestration

**Key Configurations:**

- Database: `logistics_gateway` (Port 8000)
- CORS configuration
- Rate limiting settings
- Service timeout configurations

**Gateway Features:**

- Request routing to microservices
- Rate limiting and throttling
- CORS policy management
- Circuit breaker configuration
- Load balancing strategies
- Health check monitoring

## 🗄️ Database Configuration

Each service uses its own PostgreSQL database:

| Service          | Database Name         | Port | Purpose                          |
| ---------------- | --------------------- | ---- | -------------------------------- |
| auth-service     | `logistics_auth`      | 8001 | User authentication, sessions    |
| user-service     | `logistics_users`     | 8002 | User profiles, client management |
| shipment-service | `logistics_shipments` | 8003 | Orders, tracking, logistics      |
| support-service  | `logistics_support`   | 8004 | Tickets, help desk               |
| platform-service | `logistics_platforms` | 8005 | E-commerce integrations          |
| api-gateway      | `logistics_gateway`   | 8000 | Gateway analytics, rate limiting |

## 🔗 Inter-Service Communication

All services are configured to communicate with each other through these URLs:

```bash
AUTH_SERVICE_URL="http://localhost:8001"
USER_SERVICE_URL="http://localhost:8002"
SHIPMENT_SERVICE_URL="http://localhost:8003"
SUPPORT_SERVICE_URL="http://localhost:8004"
PLATFORM_SERVICE_URL="http://localhost:8005"
API_GATEWAY_URL="http://localhost:8000"
```

## 🌐 External Service Integration

### Wallet Service

```bash
WALLET_SERVICE_URL="http://localhost:8006"
WALLET_SERVICE_API_KEY="your_wallet_service_api_key"
```

### Partner Service

```bash
# Internal service communication
PARTNER_SERVICE_URL="http://localhost:3005"

# External partner service for calculations
PARTNER_SERVICE_EXTERNAL_URL="https://calc.websiteduniya.com"
PARTNER_SERVICE_API_KEY="your_partner_service_api_key"
```

## 🔐 Security Configuration

### JWT Settings (Common across services)

```bash
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="3600"
```

### Database Connection (Service-specific)

```bash
DATABASE_URL="postgresql://logistics:logistics123@localhost:5432/logistics_{service_db}"
```

### Redis Configuration

```bash
REDIS_URL="redis://localhost:6379"
```

## 📁 File Upload Configuration

### User Service

```bash
USER_AVATAR_UPLOAD_PATH="uploads/avatars"
USER_DOCUMENT_UPLOAD_PATH="uploads/documents"
MAX_UPLOAD_SIZE="10485760"
ALLOWED_FILE_TYPES="jpg,jpeg,png,pdf,doc,docx"
```

### Shipment Service

```bash
SHIPMENT_LABEL_UPLOAD_PATH="uploads/labels"
SHIPMENT_DOCUMENT_UPLOAD_PATH="uploads/documents"
MAX_PACKAGE_WEIGHT="50000"
```

### Support Service

```bash
TICKET_ATTACHMENT_UPLOAD_PATH="uploads/tickets"
MAX_ATTACHMENT_SIZE="10485760"
ALLOWED_ATTACHMENT_TYPES="jpg,jpeg,png,pdf,doc,docx,txt"
```

## 📧 Communication Services

### SMS Configuration (Shipment & Support Services)

```bash
SMS_PROVIDER="msg91"
MSG91_API_KEY="your_msg91_api_key"
```

### Email Configuration (Multiple Services)

```bash
EMAIL_PROVIDER="sendgrid"
SENDGRID_API_KEY="your_sendgrid_api_key"
```

## 🛠️ Setup Instructions

### Automatic Setup (Recommended)

```bash
# Setup all backend services
pnpm run setup:backend

# This will:
# 1. Copy all .env.example files to .env
# 2. Install dependencies
# 3. Generate Prisma clients
```

### Manual Setup

```bash
# For each service, copy the .env.example to .env
cp backend/auth-service/.env.example backend/auth-service/.env
cp backend/user-service/.env.example backend/user-service/.env
# ... repeat for all services

# Install dependencies
pnpm install

# Generate Prisma clients
pnpm -r run generate
```

## ⚠️ Production Considerations

Before deploying to production, ensure you update:

1. **JWT_SECRET** - Use a strong, unique secret (minimum 32 characters)
2. **Database credentials** - Use secure username/password combinations
3. **External API keys** - Replace all placeholder API keys with actual credentials
4. **Service URLs** - Update to production domain names
5. **Upload paths** - Configure proper file storage locations
6. **Email/SMS credentials** - Add production service credentials

## 🔍 Troubleshooting

### Missing .env files

```bash
# Regenerate all .env files
./scripts/setup.sh --backend --force
```

### Incorrect database URLs

Check that each service has the correct database name in its `.env` file:

- auth-service → `logistics_auth`
- user-service → `logistics_users`
- etc.

### Service communication issues

Verify that all services have the correct inter-service URLs configured.

### File upload issues

Check that upload directories exist and have proper permissions:

```bash
mkdir -p uploads/{avatars,documents,labels,tickets}
chmod 755 uploads/*
```

## 📚 Additional Resources

- [Setup Scripts Guide](../scripts/README.md)
- [Main Scripts Guide](../SCRIPTS_GUIDE.md)
- [Backend Task Management](./BACKEND_TASK.md)
- [Auth Service Documentation](./BACKEND_AUTH_TASK.md)
