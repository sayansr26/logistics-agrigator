# Support & Disputes Page

## Overview

The Support & Disputes page provides a comprehensive interface for managing customer disputes and support tickets in the logistics portal.

## Features

### 1. Action Buttons

- **All Disputes**: Quick access to dispute management
- **Support Tickets**: Handle customer support requests and inquiries
- **Create Ticket**: Create new support tickets
- **Knowledge Base**: Access FAQs and guides

### 2. Tab Navigation

- **Disputes Tab**: View and manage customer disputes and delivery issues
- **Support Tickets Tab**: Handle customer support requests and inquiries

### 2. Statistics Dashboard

- Total Disputes count
- Open Disputes count
- Resolved Disputes count
- Support Tickets count

### 3. Disputes Management

- **Table Columns**:
  - Dispute ID & Tracking Number
  - Tracking Details (Origin → Destination, Courier)
  - Customer Information (Name, Email, Phone)
  - Issue Type & Reason
  - Status & Priority
  - Created & Last Updated dates
  - Actions (View, Update, Contact, Resolve)

### 4. Support Tickets Management

- **Table Columns**:
  - Ticket Number
  - Customer Information
  - Subject & Description
  - Priority & Status
  - Category & Subcategory
  - Created Date
  - Response Time
  - Actions (View, Reply, Update, Close)

### 5. Search & Filtering

- Real-time search across all fields
- Filter by status, priority, or category
- Refresh functionality

### 6. Actions & Workflows

- **Disputes**: View details, update status, contact customer, mark resolved
- **Support Tickets**: View ticket, reply, update status, close ticket

## Data Structure

### Dispute Interface

```typescript
interface Dispute {
  id: string;
  disputeNumber: string;
  trackingNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  origin: string;
  destination: string;
  courierPartner: string;
  issueType: string;
  reason: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  createdAt: string;
  lastUpdated: string;
  assignedTo?: string;
  resolution?: string;
}
```

### Support Ticket Interface

```typescript
interface SupportTicket {
  id: string;
  ticketNumber: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  description: string;
  category: string;
  subcategory: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";
  createdAt: string;
  lastResponse?: string;
  responseTime?: number;
  assignedTo?: string;
  tags?: string[];
}
```

## Mock Data

The page currently uses mock data from `@/lib/mock-data.ts`:

- 5 sample disputes with various statuses and priorities
- 6 sample support tickets across different categories

## UI Components Used

- DashboardLayout (consistent with other pages)
- Card components for statistics and content
- Table components for data display
- Badge components for status and priority indicators
- Button components for actions
- Dropdown menus for row actions
- Search input with filtering
- Tab navigation between disputes and support

## Navigation

- **Route**: `/support`
- **Breadcrumb**: Dashboard → Support & Disputes
- **Sidebar**: Available in main navigation under "Disputes & Support" (single menu item)
- **Action Buttons**: Quick access to main support functions

## Future Enhancements

- Real-time updates via WebSocket
- Advanced filtering and sorting
- Bulk actions for multiple items
- Integration with notification system
- File attachment support for evidence
- SLA tracking and escalation workflows
- Knowledge base integration
- Customer communication history
