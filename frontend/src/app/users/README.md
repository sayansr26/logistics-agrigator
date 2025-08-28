# User Management

This section provides comprehensive user management functionality for the logistics platform.

## Features

### User List Page (`/users`)

- **Search & Filter**: Advanced search and filtering capabilities
- **Status Filtering**: Filter by user status (Active, Inactive, Suspended)
- **Role Filtering**: Filter by user role (Admin, Client, Operations, Support)
- **Collapsible Filters**: Click the filter button to show/hide filter options
- **Real-time Search**: Search across user names, emails, and roles
- **Pagination**: Navigate through large user lists
- **User Statistics**: Overview cards showing total, active, inactive, and suspended users
- **User Actions**: View, edit, manage permissions, activate/deactivate, and suspend users

### Add New User Page (`/users/add`)

- **Comprehensive Form**: Complete user information collection
- **Form Validation**: Real-time validation with error messages
- **User Preview**: Live preview of user information as you type
- **Permission Management**: Granular permission selection
- **Responsive Design**: Mobile-friendly form layout

## User Roles

### Admin

- Full system access
- User management capabilities
- System configuration access

### Client

- Shipment management
- Order tracking
- Limited administrative access

### Operations

- Shipment operations
- Partner management
- Customer support

### Support

- Customer assistance
- Issue resolution
- Basic system access

## User Statuses

### Active

- Full system access
- Can perform assigned tasks
- Normal user experience

### Inactive

- Limited system access
- Cannot perform critical operations
- Requires reactivation

### Suspended

- No system access
- Account temporarily disabled
- Requires administrative review

## Permissions

The system supports granular permissions across different modules:

- **Shipments**: View, Create, Edit, Delete
- **Users**: View, Create, Edit, Delete
- **Reports**: View, Create
- **Partners**: View, Manage
- **Billing**: View, Manage

## Usage

### Adding a New User

1. Navigate to User Management
2. Click "Add New User" button
3. Fill in required information (marked with \*)
4. Select appropriate role and permissions
5. Click "Create User"

### Filtering Users

1. Click the filter button (funnel icon)
2. Select desired status and role filters
3. Use search bar for text-based filtering
4. Clear filters using "Clear All" button

### Managing Users

1. Use the actions menu (three dots) for each user
2. Available actions: View Profile, Edit User, Manage Permissions
3. Status changes: Activate/Deactivate, Suspend/Unsuspend

## Technical Details

### State Management

- Local state for form data and UI state
- URL parameters for success messages
- Form validation with real-time error clearing

### Responsive Design

- Mobile-first approach
- Grid layouts that adapt to screen size
- Touch-friendly interface elements

### Form Validation

- Required field validation
- Email format validation
- Real-time error display
- Error clearing on input

### Navigation

- Breadcrumb navigation
- Back button functionality
- Success message handling
- URL parameter management

## File Structure

```
users/
├── page.tsx          # Main user list page
├── add/
│   └── page.tsx     # Add new user form
└── README.md        # This documentation
```

## Dependencies

- Next.js 14 with App Router
- React hooks (useState, useEffect)
- Tailwind CSS for styling
- Lucide React for icons
- Custom UI components from `@/components/ui`
- Dashboard layout component
