# Available Components for Logistics Portal

## Overview

This document lists all available shadcn/ui components and demo pages that can be reused when building new features for the logistics portal.

## shadcn/ui Components Library

### Form Components ✅

- **Button** - All variants (default, secondary, outline, ghost, destructive, link)
- **Input** - Text inputs with validation support
- **Form** - Form wrapper with React Hook Form integration
- **Label** - Accessible form labels
- **Textarea** - Multi-line text inputs
- **Select** - Dropdown selection with search
- **Checkbox** - Boolean inputs with proper styling

### Data Display Components ✅

- **Table** - Responsive data tables with sorting
- **Badge** - Status indicators and labels
- **Avatar** - User profile pictures with fallbacks
- **Progress** - Progress bars for metrics and loading

### Layout Components ✅

- **Card** - Content containers with header/content/footer
- **Dialog** - Modal dialogs and overlays
- **Sheet** - Side panels and mobile overlays
- **Separator** - Visual dividers and spacers

### Navigation Components ✅

- **Navigation Menu** - Dropdown navigation with rich content
- **Breadcrumb** - Auto-generated breadcrumb navigation
- **Dropdown Menu** - Context menus and action dropdowns

### Custom Layout Components ✅

- **Sidebar** - Complete sidebar navigation with multi-level menus
- **Header** - Application header with navigation and user menu
- **Dashboard Layout** - Complete page layout with sidebar + header
- **Breadcrumb Nav** - Smart breadcrumb generation from routes

## Demo Pages Available for Reference

### 1. Forms Demo (`/demo/forms`)

**Location**: `src/app/demo/forms/page.tsx`

**What's Included**:

- Complete shipment creation form
- All form components in use
- Zod validation with error handling
- React Hook Form integration
- Form state display for debugging
- Multi-section form layout
- Responsive design

**Reusable Patterns**:

```typescript
// Form validation schema
const formSchema = z.object({
  field: z.string().min(2, { message: "Error message" })
})

// Form component usage
<Form {...form}>
  <FormField
    control={form.control}
    name="fieldName"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Field Label</FormLabel>
        <FormControl>
          <Input {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
</Form>
```

### 2. Data Tables Demo (`/demo/tables`)

**Location**: `src/app/demo/tables/page.tsx`

**What's Included**:

- Shipments and Users data tables
- Search functionality across multiple columns
- Pagination with page numbers
- Action dropdown menus
- Status badges with color coding
- Tab switching between datasets
- Statistics cards
- Responsive table design

**Reusable Patterns**:

```typescript
// Table with actions
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Column</TableHead>
      <TableHead className="text-right">Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {data.map((item) => (
      <TableRow key={item.id}>
        <TableCell>{item.name}</TableCell>
        <TableCell className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Action 1</DropdownMenuItem>
              <DropdownMenuItem>Action 2</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### 3. Navigation Demo (`/demo/navigation`)

**Location**: `src/app/demo/navigation/page.tsx`

**What's Included**:

- Complete navigation system showcase
- Navigation menu examples
- Breadcrumb examples
- Feature overview cards
- Mobile/desktop responsive behavior

**Reusable Patterns**:

```typescript
// Dashboard layout usage
<DashboardLayout customBreadcrumbs={breadcrumbs}>
  <div className="space-y-8">
    {/* Page content */}
  </div>
</DashboardLayout>
```

## Mock Data Available

### Location: `src/lib/mock-data.ts`

**Available Mock Data**:

- **Shipments**: 8 realistic shipment records with all logistics fields
- **Users**: 5 user profiles with different roles and statuses
- **Utility Functions**: Color coding, formatting, date handling

**Data Interfaces**:

```typescript
interface Shipment {
  id: string;
  trackingNumber: string;
  senderName: string;
  receiverName: string;
  origin: string;
  destination: string;
  status: "pending" | "in_transit" | "delivered" | "cancelled" | "delayed";
  priority: "low" | "medium" | "high" | "urgent";
  weight: number;
  value: number;
  createdAt: string;
  estimatedDelivery: string;
  courierPartner: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "client" | "operations" | "support";
  status: "active" | "inactive" | "suspended";
  lastLogin: string;
  shipmentsCount: number;
}
```

## Production Pages Ready for Backend Integration

### 1. Login Page (`/auth/login`)

**Features**:

- Email/password form with validation
- Password visibility toggle
- Remember me checkbox
- Demo credentials display
- Loading states
- Forgot password link

**Backend Integration Ready**:

```typescript
// Replace static redirect with API call
const response = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password, rememberMe }),
});
```

### 2. Register Page (`/auth/register`)

**Features**:

- Multi-step registration form
- Personal and company information
- Business type selection
- Password confirmation
- Terms acceptance
- Newsletter subscription

### 3. Dashboard Page (`/dashboard`)

**Features**:

- Key metrics cards with trend indicators
- Recent shipments table
- Alerts and notifications panel
- Performance metrics with progress bars
- Quick action buttons

## Navigation Structure (Production Ready)

### Sidebar Navigation

Based on PRD requirements with 9 main sections:

1. **Dashboard** - Overview
2. **Shipments** (89 active) - All shipment management
3. **Orders** - Order lifecycle
4. **Wallet & Billing** - Financial management
5. **Disputes & Support** (3 active) - Customer support
6. **Platform Integration** - E-commerce connections
7. **Analytics & Reports** - Performance analytics
8. **Courier Partners** - Partner management
9. **User Management** - Account management

### Header Navigation

- **Quick Actions**: Create shipment, bulk upload, track, NDR, disputes, wallet
- **Integrations**: Platform connections, courier partners, rate calculator
- **User Menu**: Profile, settings, logout

## How to Use Components in New Features

### 1. Copy from Demo Pages

When building new features, reference the demo pages:

```bash
# Reference these files for patterns:
src/app/demo/forms/page.tsx      # Form patterns
src/app/demo/tables/page.tsx     # Table patterns
src/app/demo/navigation/page.tsx # Navigation patterns
```

### 2. Use Dashboard Layout

For all main application pages:

```typescript
import { DashboardLayout } from '@/components/layout/dashboard-layout'

export default function YourPage() {
  return (
    <DashboardLayout>
      {/* Your page content */}
    </DashboardLayout>
  )
}
```

### 3. Import Components

All shadcn/ui components are available:

```typescript
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
// ... and all other components
```

### 4. Use Mock Data

For development and testing:

```typescript
import { mockShipments, mockUsers, getStatusColor } from "@/lib/mock-data";
```

## Quality Assurance

### Build Verification Rule ✅

**CRITICAL**: Always run build after changes:

```bash
cd frontend && pnpm run build
```

### Component Import Verification

- All Lucide icons must be imported
- All shadcn/ui components must be imported
- Use absolute paths (`@/components/...`)

## Ready for Feature Development

The frontend now has:

- ✅ **Complete component library** with 15+ components
- ✅ **Production-ready pages** for auth and dashboard
- ✅ **Demo components** for reference and reuse
- ✅ **Real navigation structure** based on PRD requirements
- ✅ **Quality rules** to maintain code quality
- ✅ **Mock data** for development and testing

**All components and patterns are ready for building the actual logistics application features!**
