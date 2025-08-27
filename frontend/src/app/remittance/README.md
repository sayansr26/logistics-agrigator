# Remittance Page

## Overview

The Remittance page manages pending COD (Cash on Delivery) settlements for logistics operations. It provides a comprehensive interface for tracking, filtering, and processing remittance data.

## Features

### 🎯 Core Functionality

- **Pending COD Settlement Management**: View and manage all pending COD settlements
- **Retailer Filtering**: Filter settlements by specific retailers/outlets
- **Bulk Selection**: Select multiple items for batch processing
- **Real-time Calculations**: Automatic calculation of total and selected amounts

### 📊 Data Display

- **Outlet Information**: Shows the retailer/outlet name
- **Reference Numbers**: Displays both Ref No and AWB numbers
- **Receiver Details**: Customer/receiver information
- **Courier Information**: Delivery partner details
- **Weight & Amount**: Package weight and settlement amount
- **Status Tracking**: Current settlement status

### 🔍 Filtering & Search

- **Retailer Dropdown**: Filter by specific retailers
- **Search Functionality**: Quick search through settlements
- **Status-based Filtering**: Filter by settlement status (pending, settled, cancelled)

### 📈 Summary Cards

- **Total Items**: Count of all settlements
- **Total Amount**: Sum of all settlement amounts
- **Selected Amount**: Sum of selected items for processing

### ⚡ Action Buttons

- **UP-Comming Rem**: View upcoming remittances
- **Remittance History**: Access historical settlement data
- **Export Selected**: Export selected items
- **Process Settlement**: Process selected settlements

## Data Structure

### Remittance Interface

```typescript
interface Remittance {
  id: string;
  outlet: string;
  refNo: string;
  awbNumber: string;
  receiver: string;
  courier: string;
  weight: number;
  amount: number;
  status: "pending" | "settled" | "cancelled";
  createdAt: string;
  settledAt?: string;
}
```

### Mock Data

The page uses mock data from `@/lib/mock-data.ts` including:

- `mockRemittances`: Sample remittance data
- `mockRetailers`: Available retailer options
- Utility functions for formatting and status colors

## UI Components Used

### Core Components

- **Card**: Main container for sections
- **Button**: Action buttons with icons
- **Select**: Retailer filter dropdown
- **Checkbox**: Item selection
- **Table**: Data display

### Icons (Lucide React)

- **FileText**: Document icon for UP-Comming Rem
- **RefreshCw**: Refresh icon for Remittance History
- **Search**: Search functionality icon

## Styling

### Color Scheme

- **Primary Green**: `bg-green-600` for action buttons
- **Hover States**: `hover:bg-green-700` for interactive elements
- **Status Colors**: Dynamic colors based on settlement status
- **Text Hierarchy**: Different font weights and sizes for information hierarchy

### Responsive Design

- **Mobile-first**: Responsive grid layouts
- **Table Overflow**: Horizontal scroll for mobile devices
- **Flexible Cards**: Adaptive summary card layout

## State Management

### Local State

- `selectedRetailer`: Currently selected retailer filter
- `selectedItems`: Array of selected item IDs
- `remittances`: Filtered remittance data

### State Updates

- **Filter Changes**: Updates displayed data based on retailer selection
- **Selection Changes**: Updates selected items and calculated amounts
- **Search Actions**: Triggers data filtering

## Future Enhancements

### Planned Features

- **Date Range Filtering**: Filter by settlement date ranges
- **Advanced Search**: Search by receiver name, AWB number, etc.
- **Bulk Actions**: Export to Excel, PDF generation
- **Real-time Updates**: WebSocket integration for live data
- **Settlement Processing**: Integration with payment systems
- **Audit Trail**: Track settlement processing history

### API Integration

- **Backend Endpoints**: Connect to remittance service APIs
- **Real-time Sync**: Live data synchronization
- **Error Handling**: Comprehensive error management
- **Loading States**: Better user experience during data fetching

## Usage

### Basic Usage

1. Navigate to `/remittance`
2. Select retailer from dropdown (optional)
3. Click "Search" to filter results
4. Select items using checkboxes
5. Use action buttons for bulk operations

### Advanced Features

- **Select All**: Use header checkbox to select all items
- **Individual Selection**: Select specific items for processing
- **Amount Tracking**: Monitor total and selected amounts
- **Export Functionality**: Export selected data for external processing

## Technical Notes

### Performance

- **Virtual Scrolling**: For large datasets (future implementation)
- **Debounced Search**: Optimize search performance
- **Memoized Calculations**: Efficient amount calculations

### Accessibility

- **ARIA Labels**: Proper accessibility attributes
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader**: Compatible with assistive technologies

### Security

- **Input Validation**: Validate all user inputs
- **Data Sanitization**: Clean data before processing
- **Permission Checks**: Role-based access control
