# Logistics Portal - Navigation Structure

## Updated Navigation Based on PRD Requirements

The sidebar navigation has been updated to reflect the actual logistics application structure as defined in the Product Requirements Document (PRD). This provides a realistic navigation system that will be used in the production application.

## Main Navigation Structure

### 1. Dashboard

- **Route**: `/dashboard`
- **Purpose**: Main overview page with key metrics and recent activities

### 2. Shipments Management

- **Route**: `/shipments`
- **Badge**: 89 (active shipments count)
- **Sub-items**:
  - All Shipments (`/shipments`)
  - Create Shipment (`/shipments/create`)
  - Bulk Upload (`/shipments/bulk`)
  - Track & Trace (`/shipments/track`)
  - NDR Management (`/shipments/ndr`)

### 3. Orders Management

- **Route**: `/orders`
- **Purpose**: Order lifecycle management
- **Sub-items**:
  - All Orders (`/orders`)
  - Platform Orders (`/orders/platform`)
  - Manual Orders (`/orders/manual`)
  - Order History (`/orders/history`)

### 4. Wallet & Billing

- **Route**: `/wallet`
- **Purpose**: Financial management and billing
- **Sub-items**:
  - Wallet Balance (`/wallet`)
  - Transactions (`/wallet/transactions`)
  - Invoices (`/wallet/invoices`)
  - Settlements (`/wallet/settlements`)
  - GST Reports (`/wallet/gst`)

### 5. Disputes & Support

- **Route**: `/support`
- **Badge**: 3 (active disputes count)
- **Purpose**: Customer support and dispute resolution
- **Features**:
  - Action buttons for quick access
  - Tabbed interface for disputes and support tickets
  - Statistics dashboard
  - Search and filtering capabilities

### 6. Platform Integration

- **Route**: `/platforms`
- **Purpose**: E-commerce platform connections
- **Sub-items**:
  - Connected Platforms (`/platforms`)
  - Shopify (`/platforms/shopify`)
  - WooCommerce (`/platforms/woocommerce`)
  - API Integration (`/platforms/api`)
  - Webhooks (`/platforms/webhooks`)

### 7. Analytics & Reports

- **Route**: `/analytics`
- **Purpose**: Performance analytics and reporting
- **Sub-items**:
  - Dashboard Overview (`/analytics`)
  - Performance Reports (`/analytics/performance`)
  - Cost Analysis (`/analytics/costs`)
  - Partner Performance (`/analytics/partners`)
  - Custom Reports (`/analytics/custom`)

### 8. Courier Partners

- **Route**: `/partners`
- **Purpose**: Courier partner management
- **Sub-items**:
  - All Partners (`/partners`)
  - Rate Cards (`/partners/rates`)
  - Serviceability (`/partners/serviceability`)
  - Performance (`/partners/performance`)

### 9. User Management

- **Route**: `/users`
- **Purpose**: User and client account management
- **Sub-items**:
  - All Users (`/users`)
  - Add User (`/users/add`)
  - Roles & Permissions (`/users/roles`)
  - Client Accounts (`/users/clients`)

## Bottom Navigation

### 1. Notifications

- **Route**: `/notifications`
- **Badge**: 5 (unread notifications)
- **Purpose**: System notifications and alerts

### 2. Account Settings

- **Route**: `/settings`
- **Purpose**: User and company settings
- **Sub-items**:
  - Profile Settings (`/settings/profile`)
  - Company Settings (`/settings/company`)
  - API Keys (`/settings/api`)
  - Billing Settings (`/settings/billing`)

### 3. Help & Support

- **Route**: `/support`
- **Purpose**: Support resources and documentation
- **Sub-items**:
  - Contact Support (`/support/contact`)
  - Documentation (`/support/docs`)
  - API Reference (`/support/api`)
  - System Status (`/support/status`)

## Header Navigation

### Quick Actions Menu

- Create Shipment
- Bulk Upload
- Track Shipment
- NDR Management
- Create Dispute
- Wallet Balance

### Integrations Menu

- Shopify (Connected)
- WooCommerce (Available)
- Custom API (Available)
- Webhooks (Available)
- Courier Partners (Connected)
- Rate Calculator (Available)

## Features

### Navigation Features

- **Hierarchical Structure**: Multi-level navigation with expandable sub-menus
- **Active State Highlighting**: Current page and section highlighting
- **Badge Notifications**: Real-time counts for important items
- **Responsive Design**: Mobile hamburger menu, desktop fixed sidebar
- **Role-based Access**: Navigation items can be filtered based on user permissions

### Technical Implementation

- **React Components**: Modular component structure
- **TypeScript**: Full type safety for navigation items
- **Next.js Routing**: App Router compatible navigation
- **shadcn/ui Components**: Consistent UI components
- **Lucide Icons**: Professional iconography

## Future Backend Integration

### Static to Dynamic

All navigation items are currently static but designed for easy backend integration:

```typescript
// Current static structure
const navigationItems: NavItem[] = [...]

// Future dynamic structure
const [navigationItems, setNavigationItems] = useState<NavItem[]>([])

useEffect(() => {
  // Fetch user-specific navigation based on role
  const fetchNavigation = async () => {
    const response = await fetch('/api/navigation', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await response.json()
    setNavigationItems(data.navigation)
  }
  fetchNavigation()
}, [])
```

### Badge Updates

Badges will be updated with real-time data:

```typescript
// Real-time badge updates
const [badges, setBadges] = useState({
  shipments: 0,
  disputes: 0,
  notifications: 0,
});

// WebSocket or polling for real-time updates
useEffect(() => {
  const ws = new WebSocket("/ws/notifications");
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    setBadges(data.badges);
  };
}, []);
```

### Permission-based Navigation

Navigation items will be filtered based on user roles:

```typescript
// Role-based navigation filtering
const filterNavigationByRole = (items: NavItem[], userRole: string) => {
  return items.filter((item) => {
    return item.permissions?.includes(userRole) || !item.permissions;
  });
};
```

## Alignment with PRD

This navigation structure directly implements the feature modules defined in the PRD:

1. **Shipment Creation & Management** → Shipments section
2. **User Management & Authentication** → User Management section
3. **Platform Integration (Shopify)** → Platform Integration section
4. **Wallet Integration** → Wallet & Billing section
5. **Tracking & Notifications** → Shipments/Track & Notifications
6. **Dispute Management** → Disputes & Support section
7. **NDR Management** → Shipments/NDR Management
8. **Billing & Invoicing** → Wallet & Billing section
9. **Settlements & Remittance** → Wallet & Billing section
10. **Zone & Partner Management** → Courier Partners section

The navigation provides a logical, user-friendly structure that matches the business requirements and technical architecture defined in the project documentation.
