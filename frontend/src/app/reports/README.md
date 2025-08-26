# Reports & Analytics Page

## Overview

The Reports & Analytics page provides comprehensive insights into logistics operations, financial performance, and business metrics. It follows the same UI design patterns as the demo tables page for consistency.

## Features

### 1. Overview Dashboard

- **Key Metrics Cards**: Total shipments, revenue, active users, delivery rate
- **Performance Metrics**: Delivery performance, courier statistics
- **Shipment Status Distribution**: Visual breakdown using progress charts
- **Courier Performance Chart**: Vertical bar chart showing shipment volume by courier
- **Recent Activity**: Latest shipment updates and status changes

### 2. Shipments Analytics

- **Comprehensive Table**: Detailed shipment data with search and filtering
- **Export Functionality**: Download shipment data for external analysis
- **Pagination**: Efficient data browsing with configurable page sizes
- **Action Menu**: View details, generate reports, export data

### 3. Financial Analytics

- **Financial Overview**: Revenue, COD shipments, pending invoices
- **Payment Mode Distribution**: Visual breakdown of payment methods
- **Transaction History**: Recent wallet transactions and charges
- **Invoice Status**: Current invoice status and amounts

### 4. Performance Analytics

- **Performance Metrics**: Delivery success rate, average delivery time, customer satisfaction
- **Platform Performance**: E-commerce platform comparison table
- **Success Rate Visualization**: Progress bars showing platform performance

## Components Used

### Custom Chart Components

- **ProgressChart**: Horizontal progress bars with labels and percentages
- **BarChart**: Vertical and horizontal bar charts for data visualization
- **MetricCard**: Reusable metric display cards with change indicators

### UI Components

- **Card**: Content containers with headers and descriptions
- **Table**: Data tables with sorting and pagination
- **Badge**: Status indicators with color coding
- **Button**: Action buttons with various styles
- **Select**: Date range and filter dropdowns

## Data Sources

The page uses mock data from `@/lib/mock-data.ts`:

- `mockShipments`: Shipment tracking and status data
- `mockUsers`: User account information
- `mockOrders`: E-commerce order data
- `mockTransactions`: Wallet transaction history
- `mockInvoices`: Invoice and billing data

## Navigation

The page is accessible via:

- **Sidebar**: "Analytics & Reports" menu item
- **URL**: `/reports`
- **Breadcrumbs**: Home → Reports & Analytics

## Responsive Design

- **Mobile**: Single-column layout with stacked cards
- **Tablet**: Two-column grid for medium screens
- **Desktop**: Full four-column grid with detailed charts

## Future Enhancements

1. **Real-time Data**: Integration with live API endpoints
2. **Advanced Charts**: Interactive charts with drill-down capabilities
3. **Custom Reports**: Report builder with drag-and-drop interface
4. **Data Export**: Multiple format support (PDF, Excel, CSV)
5. **Scheduled Reports**: Automated report generation and delivery
6. **Alert System**: Performance threshold notifications

## Technical Implementation

- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS with custom design system
- **State Management**: React hooks for local state
- **Components**: Modular, reusable component architecture
- **Performance**: Optimized rendering with proper memoization
- **Accessibility**: ARIA labels and keyboard navigation support
