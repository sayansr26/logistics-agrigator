# Support Service AGENTS.md

## Service Overview

The Support Service manages customer support operations including ticket system, knowledge base, SLA tracking, and financial dispute management with wallet integration for comprehensive customer service operations.

**Status**: 📋 **Planned** - Customer support operations  
**Pattern**: Will follow auth-service patterns exactly.

## Development Commands

```bash
# Start support service only
docker-compose --profile support-service up

# Development with live reload
cd backend/support-service
pnpm install
pnpm run dev

# Database operations
npx prisma generate
npx prisma migrate deploy
npx prisma studio

# Testing
pnpm test
```

## Service Architecture

### Port Configuration

- **Development**: `http://localhost:3006`
- **Health Check**: `http://localhost:3006/health`
- **API Documentation**: `http://localhost:3006/api-docs`

### Database

- **Database**: `logistics_support`
- **ORM**: Prisma
- **Models**: Ticket, TicketMessage, KnowledgeBase, SLA, Dispute, AuditLog

### Key Features (Planned)

- 📋 Comprehensive ticket system with CRUD operations
- 📋 Knowledge base with search capabilities
- 📋 SLA tracking with automated alerts
- 📋 Financial dispute management (wallet integration)
- 📋 Support analytics and reporting
- 📋 Multi-channel support (email, chat, phone)
- 📋 Automated ticket routing and escalation
- 📋 Customer satisfaction tracking

## API Endpoints (Planned)

### Ticket Management

```bash
GET    /api/tickets                    # List tickets
GET    /api/tickets/:id               # Get ticket details
POST   /api/tickets                   # Create ticket
PUT    /api/tickets/:id               # Update ticket
DELETE /api/tickets/:id               # Close/Delete ticket
POST   /api/tickets/:id/messages      # Add message to ticket
GET    /api/tickets/:id/messages      # Get ticket messages
```

### Ticket Operations

```bash
PUT    /api/tickets/:id/assign        # Assign ticket to agent
PUT    /api/tickets/:id/escalate      # Escalate ticket
PUT    /api/tickets/:id/priority      # Update ticket priority
PUT    /api/tickets/:id/status        # Update ticket status
POST   /api/tickets/:id/merge         # Merge tickets
POST   /api/tickets/bulk-update       # Bulk ticket operations
```

### Knowledge Base

```bash
GET    /api/knowledge-base            # List articles
GET    /api/knowledge-base/:id        # Get article
POST   /api/knowledge-base            # Create article
PUT    /api/knowledge-base/:id        # Update article
DELETE /api/knowledge-base/:id        # Delete article
GET    /api/knowledge-base/search     # Search articles
GET    /api/knowledge-base/categories # List categories
```

### SLA Management

```bash
GET    /api/sla                       # Get SLA policies
PUT    /api/sla                       # Update SLA policies
GET    /api/sla/violations            # Get SLA violations
GET    /api/sla/metrics               # Get SLA metrics
POST   /api/sla/alerts                # Configure SLA alerts
```

### Dispute Management

```bash
GET    /api/disputes                  # List disputes
GET    /api/disputes/:id              # Get dispute details
POST   /api/disputes                  # Create dispute
PUT    /api/disputes/:id              # Update dispute
PUT    /api/disputes/:id/resolve      # Resolve dispute
POST   /api/disputes/:id/refund       # Process refund (wallet integration)
```

### Analytics & Reporting

```bash
GET    /api/analytics/tickets         # Ticket analytics
GET    /api/analytics/agents          # Agent performance
GET    /api/analytics/satisfaction    # Customer satisfaction
GET    /api/reports/sla               # SLA reports
GET    /api/reports/resolution-time   # Resolution time reports
```

### System Endpoints

```bash
GET    /health                        # Health check
GET    /api-docs                      # Swagger documentation
```

## Code Patterns (Following Auth Service)

### Controller Pattern

```javascript
// controllers/ticketController.js
class TicketController {
  static async createTicket(req, res) {
    try {
      const ticketData = req.body;
      const userId = req.user.id;

      // Auto-assign priority based on keywords
      const priority = await supportService.calculatePriority(
        ticketData.subject,
        ticketData.description,
      );

      // Auto-assign category
      const category = await supportService.categorizeTicket(
        ticketData.subject,
        ticketData.description,
      );

      // Create ticket
      const ticket = await prisma.ticket.create({
        data: {
          ...ticketData,
          userId,
          priority,
          category,
          status: "OPEN",
          ticketNumber: await generateTicketNumber(),
          slaDeadline: calculateSLADeadline(priority),
        },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          messages: true,
        },
      });

      // Create initial message
      await prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          userId,
          message: ticketData.description,
          messageType: "USER",
        },
      });

      // Auto-assign to agent if available
      const assignedAgent = await supportService.autoAssignTicket(ticket);
      if (assignedAgent) {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { assignedTo: assignedAgent.id },
        });
      }

      // Send notifications
      await notificationService.sendTicketCreatedNotification(ticket);

      // MANDATORY: Audit logging
      await prisma.auditLog.create({
        data: {
          userId,
          action: "TICKET_CREATED",
          resource: "ticket",
          resourceId: ticket.id,
          changes: {
            ticketNumber: ticket.ticketNumber,
            priority,
            category,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      res.status(201).json(APIResponse.success({ ticket }));
    } catch (error) {
      logger.error("Ticket creation error:", error);
      throw error;
    }
  }

  static async resolveTicket(req, res) {
    try {
      const { id } = req.params;
      const { resolution, satisfactionRating } = req.body;
      const agentId = req.user.id;

      // Update ticket
      const ticket = await prisma.ticket.update({
        where: { id },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolvedBy: agentId,
          resolution,
          satisfactionRating,
        },
        include: {
          user: true,
          assignedAgent: true,
        },
      });

      // Calculate resolution time for SLA tracking
      const resolutionTime = ticket.resolvedAt - ticket.createdAt;
      const slaViolation = ticket.resolvedAt > ticket.slaDeadline;

      // Update SLA metrics
      await prisma.sLAMetric.create({
        data: {
          ticketId: ticket.id,
          resolutionTime: Math.floor(resolutionTime / 1000), // seconds
          slaViolation,
          priority: ticket.priority,
        },
      });

      // Send resolution notification
      await notificationService.sendTicketResolvedNotification(ticket);

      // Audit logging
      await prisma.auditLog.create({
        data: {
          userId: agentId,
          action: "TICKET_RESOLVED",
          resource: "ticket",
          resourceId: id,
          changes: {
            resolution,
            resolutionTime: Math.floor(resolutionTime / 1000),
            slaViolation,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      res.json(APIResponse.success({ ticket }));
    } catch (error) {
      logger.error("Ticket resolution error:", error);
      throw error;
    }
  }
}
```

### Dispute Management with Wallet Integration

```javascript
// controllers/disputeController.js
class DisputeController {
  static async processRefund(req, res) {
    try {
      const { id } = req.params;
      const { refundAmount, reason } = req.body;
      const agentId = req.user.id;

      const dispute = await prisma.dispute.findUnique({
        where: { id },
        include: { user: true, relatedShipment: true },
      });

      if (!dispute) {
        throw new NotFoundError("Dispute", id);
      }

      // Process refund via Wallet Service
      const walletClient = walletService.getWalletServiceClient();
      const refundResult = await walletClient.creditAmount({
        userId: dispute.userId,
        amount: refundAmount,
        reference: `dispute_refund_${dispute.id}`,
        description: `Refund for dispute #${dispute.disputeNumber}: ${reason}`,
      });

      // Update dispute
      const updatedDispute = await prisma.dispute.update({
        where: { id },
        data: {
          status: "RESOLVED",
          resolution: "REFUNDED",
          refundAmount,
          refundReason: reason,
          resolvedAt: new Date(),
          resolvedBy: agentId,
          walletTransactionId: refundResult.transactionId,
        },
      });

      // Send notification
      await notificationService.sendDisputeResolvedNotification(updatedDispute);

      // Audit logging
      await prisma.auditLog.create({
        data: {
          userId: agentId,
          action: "DISPUTE_REFUND_PROCESSED",
          resource: "dispute",
          resourceId: id,
          changes: {
            refundAmount,
            reason,
            walletTransactionId: refundResult.transactionId,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      res.json(
        APIResponse.success({ dispute: updatedDispute, refund: refundResult }),
      );
    } catch (error) {
      logger.error("Dispute refund error:", error);
      throw error;
    }
  }
}
```

### Knowledge Base Search

```javascript
// controllers/knowledgeBaseController.js
class KnowledgeBaseController {
  static async searchArticles(req, res) {
    try {
      const { query, category, tags } = req.query;

      // Full-text search with relevance scoring
      const articles = await prisma.knowledgeBase.findMany({
        where: {
          AND: [
            {
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { content: { contains: query, mode: "insensitive" } },
                { tags: { hasSome: query.split(" ") } },
              ],
            },
            category ? { category } : {},
            tags ? { tags: { hasSome: tags.split(",") } } : {},
            { isPublished: true },
          ],
        },
        select: {
          id: true,
          title: true,
          excerpt: true,
          category: true,
          tags: true,
          viewCount: true,
          helpfulCount: true,
          updatedAt: true,
        },
        orderBy: [
          { helpfulCount: "desc" },
          { viewCount: "desc" },
          { updatedAt: "desc" },
        ],
      });

      // Update search analytics
      await prisma.searchAnalytic.create({
        data: {
          query,
          category,
          resultsCount: articles.length,
          userId: req.user?.id,
        },
      });

      res.json(APIResponse.success({ articles, total: articles.length }));
    } catch (error) {
      logger.error("Knowledge base search error:", error);
      throw error;
    }
  }
}
```

### Shared Library Usage

```javascript
// From server.js (root level)
const logger = require("./shared/lib/logger");

// From controllers/, middleware/, routes/
const APIResponse = require("../shared/lib/response");
const { ValidationError, NotFoundError } = require("../shared/lib/errors");
const { walletService } = require("../shared");
```

## Database Schema (Planned)

### Ticket Model

```prisma
model Ticket {
  id           String @id @default(cuid())
  ticketNumber String @unique

  // User Information
  userId String
  user   User   @relation(fields: [userId], references: [id])

  // Ticket Details
  subject     String
  description String
  category    String
  priority    Priority     @default(MEDIUM)
  status      TicketStatus @default(OPEN)

  // Assignment
  assignedTo    String?
  assignedAgent User?   @relation("AssignedTickets", fields: [assignedTo], references: [id])

  // SLA Tracking
  slaDeadline DateTime
  resolvedAt  DateTime?
  resolvedBy  String?
  resolver    User?     @relation("ResolvedTickets", fields: [resolvedBy], references: [id])

  // Resolution
  resolution         String?
  satisfactionRating Int?

  // Metadata
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  messages   TicketMessage[]
  slaMetrics SLAMetric[]

  @@map("tickets")
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
  CRITICAL
}

enum TicketStatus {
  OPEN
  IN_PROGRESS
  WAITING_FOR_CUSTOMER
  RESOLVED
  CLOSED
  ESCALATED
}
```

### Ticket Message Model

```prisma
model TicketMessage {
  id       String @id @default(cuid())
  ticketId String
  ticket   Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  userId String
  user   User   @relation(fields: [userId], references: [id])

  message     String
  messageType MessageType

  // Attachments
  attachments String[]

  // Internal Notes
  isInternal Boolean @default(false)

  createdAt DateTime @default(now())

  @@map("ticket_messages")
}

enum MessageType {
  USER
  AGENT
  SYSTEM
  EMAIL
}
```

### Knowledge Base Model

```prisma
model KnowledgeBase {
  id String @id @default(cuid())

  title    String
  content  String
  excerpt  String?
  category String
  tags     String[]

  // Publishing
  isPublished Boolean   @default(false)
  publishedAt DateTime?

  // Analytics
  viewCount    Int @default(0)
  helpfulCount Int @default(0)

  // Author
  authorId String
  author   User   @relation(fields: [authorId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("knowledge_base")
}
```

### Dispute Model

```prisma
model Dispute {
  id            String @id @default(cuid())
  disputeNumber String @unique

  // User Information
  userId String
  user   User   @relation(fields: [userId], references: [id])

  // Dispute Details
  type        DisputeType
  subject     String
  description String
  amount      Float?

  // Related Entities
  shipmentId String?
  orderId    String?

  // Resolution
  status       DisputeStatus @default(OPEN)
  resolution   String?
  refundAmount Float?
  refundReason String?

  // Wallet Integration
  walletTransactionId String?

  // Assignment
  assignedTo String?
  resolvedAt DateTime?
  resolvedBy String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("disputes")
}

enum DisputeType {
  REFUND_REQUEST
  DAMAGED_GOODS
  LOST_SHIPMENT
  BILLING_ISSUE
  SERVICE_COMPLAINT
  OTHER
}

enum DisputeStatus {
  OPEN
  INVESTIGATING
  RESOLVED
  REJECTED
  ESCALATED
}
```

### SLA Metric Model

```prisma
model SLAMetric {
  id       String @id @default(cuid())
  ticketId String
  ticket   Ticket @relation(fields: [ticketId], references: [id])

  resolutionTime Int // in seconds
  slaViolation   Boolean  @default(false)
  priority       Priority

  createdAt DateTime @default(now())

  @@map("sla_metrics")
}
```

## SLA Configuration

### SLA Policies

```javascript
// services/slaService.js
const SLA_POLICIES = {
  CRITICAL: {
    responseTime: 15 * 60, // 15 minutes
    resolutionTime: 4 * 60 * 60, // 4 hours
  },
  URGENT: {
    responseTime: 30 * 60, // 30 minutes
    resolutionTime: 8 * 60 * 60, // 8 hours
  },
  HIGH: {
    responseTime: 2 * 60 * 60, // 2 hours
    resolutionTime: 24 * 60 * 60, // 24 hours
  },
  MEDIUM: {
    responseTime: 4 * 60 * 60, // 4 hours
    resolutionTime: 48 * 60 * 60, // 48 hours
  },
  LOW: {
    responseTime: 8 * 60 * 60, // 8 hours
    resolutionTime: 72 * 60 * 60, // 72 hours
  },
};

const calculateSLADeadline = (priority) => {
  const policy = SLA_POLICIES[priority];
  return new Date(Date.now() + policy.resolutionTime * 1000);
};
```

## Rate Limiting Configuration

```javascript
// middleware/rateLimiter.js
const ticketCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 tickets per hour per user
});

const knowledgeBaseSearchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 searches per minute
});

const disputeCreationLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3, // 3 disputes per day per user
});
```

## Integration Points

### Wallet Service Integration

```javascript
// For dispute refunds and financial operations
const { walletService } = require("../shared");

const processRefund = async (disputeId, amount, reason) => {
  const walletClient = walletService.getWalletServiceClient();

  return await walletClient.creditAmount({
    userId: dispute.userId,
    amount,
    reference: `dispute_refund_${disputeId}`,
    description: `Dispute refund: ${reason}`,
  });
};
```

### Notification Service Integration

```javascript
// services/notificationService.js
class NotificationService {
  static async sendTicketCreatedNotification(ticket) {
    // Send email to user
    await emailService.send({
      to: ticket.user.email,
      template: "ticket-created",
      data: {
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
      },
    });

    // Notify assigned agent
    if (ticket.assignedTo) {
      await slackService.notifyAgent(ticket.assignedTo, {
        message: `New ticket assigned: #${ticket.ticketNumber}`,
        priority: ticket.priority,
      });
    }
  }
}
```

## Current Development Status

### 📋 Planned (SUPP-001)

- Service foundation following auth-service patterns
- Comprehensive ticket system with CRUD operations
- Knowledge base with search capabilities
- SLA tracking with automated alerts
- Financial dispute management (wallet integration)
- Support analytics and reporting endpoints

### 🔄 Dependencies Required

- **Shipment Service**: For shipment-related disputes
- **Platform Service**: For order-related disputes
- **Wallet Service**: For refund processing
- **Notification Service**: For email/SMS notifications

### ✅ Prerequisites Met

- Auth Service operational (authentication patterns)
- User Service operational (user context)
- Wallet integration available (shared library)
- Infrastructure ready (Docker, PostgreSQL, Redis)

## Testing (When Implemented)

### Health Check

```bash
curl http://localhost:3006/health
```

### Ticket Operations

```bash
# Create ticket
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"subject":"Shipment Issue","description":"My shipment is delayed","category":"SHIPMENT"}' \
  http://localhost:3006/api/tickets

# Search knowledge base
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3006/api/knowledge-base/search?query=shipping+delay"

# Process dispute refund
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{"refundAmount":100,"reason":"Damaged goods"}' \
  http://localhost:3006/api/disputes/:id/refund
```

### Analytics

```bash
# Get ticket analytics
curl -H "Authorization: Bearer <admin_token>" \
  http://localhost:3006/api/analytics/tickets

# Get SLA metrics
curl -H "Authorization: Bearer <admin_token>" \
  http://localhost:3006/api/reports/sla
```

## Performance Metrics (Target)

### SLA Targets

- **Response Time**: 95% within SLA
- **Resolution Time**: 90% within SLA
- **Customer Satisfaction**: 4.5+ average rating
- **First Contact Resolution**: 70%+

### System Performance

- **Ticket Creation**: <500ms response time
- **Knowledge Base Search**: <200ms response time
- **Analytics Queries**: <2s response time
- **Concurrent Users**: 1000+ support agents

## Troubleshooting

### Common Issues (When Implemented)

1. **SLA violations**: Check agent workload and auto-assignment rules
2. **Wallet refund failures**: Verify wallet service integration and balance
3. **Search performance**: Check database indexes and query optimization
4. **Notification failures**: Verify email/SMS service configuration

### Debug Commands

```bash
# Check service logs
docker-compose logs -f support-service

# Access container
docker exec -it logistics-support-service sh

# Check database
cd backend/support-service && npx prisma studio

# Test wallet integration
curl http://localhost:8006/health
```

---

**Note**: This service is planned for implementation and will follow auth-service patterns exactly. It focuses on comprehensive customer support operations with ticket management, knowledge base, and financial dispute resolution capabilities.
