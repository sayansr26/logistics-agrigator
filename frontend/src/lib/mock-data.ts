// Mock data for logistics application

export interface BulkUpload {
  id: string;
  uploadId: string;
  dateTime: string;
  status: "completed" | "failed" | "in_progress";
  totalRecords: number;
  successCount: number;
  failedCount: number;
  fileName: string;
}

export interface Shipment {
  id: string;
  trackingNumber: string;
  referenceNumber: string;
  senderName: string;
  receiverName: string;
  origin: string;
  originState: string;
  originPinCode: string;
  destination: string;
  destinationState: string;
  destinationPinCode: string;
  status: "pending" | "in_transit" | "delivered" | "cancelled" | "delayed";
  priority: "low" | "medium" | "high" | "urgent";
  weight: number;
  value: number;
  createdAt: string;
  estimatedDelivery: string;
  courierPartner: string;
  manifestDate: string;
  manifestTime: string;
  paymentMode: "prepaid" | "cod" | "credit" | "wallet";
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "client" | "operations" | "support";
  status: "active" | "inactive" | "suspended";
  lastLogin: string;
  shipmentsCount: number;
  avatar?: string;
}

// User Management Interfaces
export interface UserRole {
  value: "admin" | "client" | "operations" | "support";
  label: string;
  color: string;
  description: string;
  permissions: string[];
}

export interface UserStatus {
  value: "active" | "inactive" | "suspended";
  label: string;
  color: string;
  description: string;
}

export interface UserPermission {
  value: string;
  label: string;
  category: string;
  description: string;
}

export interface UserFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  company: string;
  department: string;
  position: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  notes: string;
  permissions: string[];
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  platform: "shopify" | "woocommerce" | "manual" | "amazon" | "flipkart";
  status:
    | "pending"
    | "confirmed"
    | "processing"
    | "shipped"
    | "delivered"
    | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  itemCount: number;
  shippingAddress: string;
  createdAt: string;
  estimatedShipping: string;
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
}

// NDR (Non-Delivery Report) interface
export interface NDR {
  id: string;
  trackingNumber: string;
  receiverName: string;
  // receiverContact: string;
  attemptNumber: number;
  attemptDate: string;
  attemptTime: string;
  status: "pending" | "resolved" | "cancelled";
  reason: string;
  comments: string;
  createdAt: string;
}

// Dispute interface
export interface Dispute {
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

// Support Ticket interface
export interface SupportTicket {
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
  responseTime?: number; // in hours
  assignedTo?: string;
  tags?: string[];
}

// Generate mock shipments
export const mockShipments: Shipment[] = [
  {
    id: "1",
    trackingNumber: "LOG2024001",
    referenceNumber: "REF001234",
    senderName: "TechCorp Inc.",
    receiverName: "John Smith",
    origin: "Mumbai",
    originState: "Maharashtra",
    originPinCode: "400001",
    destination: "New York",
    destinationState: "New York",
    destinationPinCode: "10001",
    status: "in_transit",
    priority: "high",
    weight: 2.5,
    value: 1200,
    createdAt: "2024-08-15T10:30:00Z",
    estimatedDelivery: "2024-08-20T15:00:00Z",
    courierPartner: "DHL Express",
    manifestDate: "2024-08-15",
    manifestTime: "14:30",
    paymentMode: "prepaid",
  },
  {
    id: "2",
    trackingNumber: "LOG2024002",
    referenceNumber: "REF001235",
    senderName: "Fashion Store",
    receiverName: "Sarah Johnson",
    origin: "Delhi",
    originState: "Delhi",
    originPinCode: "110001",
    destination: "London",
    destinationState: "England",
    destinationPinCode: "SW1A 1AA",
    status: "delivered",
    priority: "medium",
    weight: 1.2,
    value: 450,
    createdAt: "2024-08-14T14:20:00Z",
    estimatedDelivery: "2024-08-18T12:00:00Z",
    courierPartner: "FedEx",
    manifestDate: "2024-08-14",
    manifestTime: "16:45",
    paymentMode: "cod",
  },
  {
    id: "3",
    trackingNumber: "LOG2024003",
    referenceNumber: "REF001236",
    senderName: "Electronics Hub",
    receiverName: "Mike Chen",
    origin: "Bangalore",
    originState: "Karnataka",
    originPinCode: "560001",
    destination: "Toronto",
    destinationState: "Ontario",
    destinationPinCode: "M5H 2N2",
    status: "pending",
    priority: "low",
    weight: 5.8,
    value: 2800,
    createdAt: "2024-08-16T09:15:00Z",
    estimatedDelivery: "2024-08-22T10:30:00Z",
    courierPartner: "UPS",
    manifestDate: "2024-08-16",
    manifestTime: "11:20",
    paymentMode: "credit",
  },
  {
    id: "4",
    trackingNumber: "LOG2024004",
    referenceNumber: "REF001237",
    senderName: "BookWorld",
    receiverName: "Emma Wilson",
    origin: "Chennai",
    originState: "Tamil Nadu",
    originPinCode: "600001",
    destination: "Sydney",
    destinationState: "New South Wales",
    destinationPinCode: "2000",
    status: "delayed",
    priority: "medium",
    weight: 0.8,
    value: 85,
    createdAt: "2024-08-13T16:45:00Z",
    estimatedDelivery: "2024-08-19T14:20:00Z",
    courierPartner: "Aramex",
    manifestDate: "2024-08-13",
    manifestTime: "18:15",
    paymentMode: "wallet",
  },
  {
    id: "5",
    trackingNumber: "LOG2024005",
    referenceNumber: "REF001238",
    senderName: "Gadget Store",
    receiverName: "David Brown",
    origin: "Hyderabad",
    originState: "Telangana",
    originPinCode: "500001",
    destination: "Berlin",
    destinationState: "Berlin",
    destinationPinCode: "10115",
    status: "cancelled",
    priority: "urgent",
    weight: 3.2,
    value: 1850,
    createdAt: "2024-08-12T11:30:00Z",
    estimatedDelivery: "2024-08-17T09:00:00Z",
    courierPartner: "DHL Express",
    manifestDate: "2024-08-12",
    manifestTime: "13:45",
    paymentMode: "prepaid",
  },
  {
    id: "6",
    trackingNumber: "LOG2024006",
    referenceNumber: "REF001239",
    senderName: "Artisan Crafts",
    receiverName: "Lisa Garcia",
    origin: "Pune",
    originState: "Maharashtra",
    originPinCode: "411001",
    destination: "Mexico City",
    destinationState: "CDMX",
    destinationPinCode: "01000",
    status: "in_transit",
    priority: "high",
    weight: 1.5,
    value: 650,
    createdAt: "2024-08-16T13:20:00Z",
    estimatedDelivery: "2024-08-21T16:45:00Z",
    courierPartner: "FedEx",
    manifestDate: "2024-08-16",
    manifestTime: "15:30",
    paymentMode: "cod",
  },
  {
    id: "7",
    trackingNumber: "LOG2024007",
    referenceNumber: "REF001240",
    senderName: "Sports Equipment Co.",
    receiverName: "Tom Anderson",
    origin: "Kolkata",
    originState: "West Bengal",
    originPinCode: "700001",
    destination: "Tokyo",
    destinationState: "Tokyo",
    destinationPinCode: "100-0001",
    status: "delivered",
    priority: "low",
    weight: 4.7,
    value: 980,
    createdAt: "2024-08-11T08:15:00Z",
    estimatedDelivery: "2024-08-16T11:30:00Z",
    courierPartner: "UPS",
    manifestDate: "2024-08-11",
    manifestTime: "10:45",
    paymentMode: "wallet",
  },
  {
    id: "8",
    trackingNumber: "LOG2024008",
    referenceNumber: "REF001241",
    senderName: "Home Decor Ltd.",
    receiverName: "Anna Martinez",
    origin: "Ahmedabad",
    originState: "Gujarat",
    originPinCode: "380001",
    destination: "Paris",
    destinationState: "Île-de-France",
    destinationPinCode: "75001",
    status: "pending",
    priority: "medium",
    weight: 2.1,
    value: 320,
    createdAt: "2024-08-17T07:45:00Z",
    estimatedDelivery: "2024-08-23T13:15:00Z",
    courierPartner: "Aramex",
    manifestDate: "2024-08-17",
    manifestTime: "09:30",
    paymentMode: "credit",
  },
];

// Generate mock orders
export const mockOrders: Order[] = [
  {
    id: "1",
    orderNumber: "ORD2024001",
    customerName: "John Smith",
    platform: "shopify",
    status: "confirmed",
    priority: "high",
    itemCount: 3,
    shippingAddress: "123 Main St, New York, NY 10001",
    createdAt: "2024-08-18T10:30:00Z",
    estimatedShipping: "2024-08-20T15:00:00Z",
    paymentStatus: "paid",
  },
  {
    id: "2",
    orderNumber: "ORD2024002",
    customerName: "Sarah Johnson",
    platform: "woocommerce",
    status: "processing",
    priority: "medium",
    itemCount: 2,
    shippingAddress: "456 Oak Ave, Los Angeles, CA 90210",
    createdAt: "2024-08-18T09:15:00Z",
    estimatedShipping: "2024-08-21T12:00:00Z",
    paymentStatus: "paid",
  },
  {
    id: "3",
    orderNumber: "ORD2024003",
    customerName: "Mike Chen",
    platform: "amazon",
    status: "pending",
    priority: "low",
    itemCount: 1,
    shippingAddress: "789 Pine St, Chicago, IL 60601",
    createdAt: "2024-08-18T08:45:00Z",
    estimatedShipping: "2024-08-22T10:30:00Z",
    paymentStatus: "pending",
  },
  {
    id: "4",
    orderNumber: "ORD2024004",
    customerName: "Emma Wilson",
    platform: "manual",
    status: "shipped",
    priority: "urgent",
    itemCount: 5,
    shippingAddress: "321 Elm Dr, Miami, FL 33101",
    createdAt: "2024-08-17T16:20:00Z",
    estimatedShipping: "2024-08-19T14:00:00Z",
    paymentStatus: "paid",
  },
  {
    id: "5",
    orderNumber: "ORD2024005",
    customerName: "David Brown",
    platform: "flipkart",
    status: "cancelled",
    priority: "medium",
    itemCount: 2,
    shippingAddress: "654 Maple Ln, Seattle, WA 98101",
    createdAt: "2024-08-17T14:10:00Z",
    estimatedShipping: "2024-08-20T11:30:00Z",
    paymentStatus: "refunded",
  },
  {
    id: "6",
    orderNumber: "ORD2024006",
    customerName: "Lisa Garcia",
    platform: "shopify",
    status: "delivered",
    priority: "high",
    itemCount: 4,
    shippingAddress: "987 Cedar St, Austin, TX 73301",
    createdAt: "2024-08-16T13:30:00Z",
    estimatedShipping: "2024-08-18T16:45:00Z",
    paymentStatus: "paid",
  },
  {
    id: "7",
    orderNumber: "ORD2024007",
    customerName: "Tom Anderson",
    platform: "woocommerce",
    status: "processing",
    priority: "low",
    itemCount: 1,
    shippingAddress: "147 Birch Ave, Denver, CO 80201",
    createdAt: "2024-08-16T11:15:00Z",
    estimatedShipping: "2024-08-21T09:00:00Z",
    paymentStatus: "paid",
  },
  {
    id: "8",
    orderNumber: "ORD2024008",
    customerName: "Anna Martinez",
    platform: "amazon",
    status: "confirmed",
    priority: "medium",
    itemCount: 3,
    shippingAddress: "258 Willow St, Phoenix, AZ 85001",
    createdAt: "2024-08-18T07:45:00Z",
    estimatedShipping: "2024-08-22T13:15:00Z",
    paymentStatus: "paid",
  },
];

// Generate mock users
export const mockUsers: User[] = [
  {
    id: "1",
    name: "Alice Johnson",
    email: "alice@techcorp.com",
    role: "admin",
    status: "active",
    lastLogin: "2024-08-18T09:30:00Z",
    shipmentsCount: 45,
  },
  {
    id: "2",
    name: "Bob Smith",
    email: "bob@fashionstore.com",
    role: "client",
    status: "active",
    lastLogin: "2024-08-17T14:20:00Z",
    shipmentsCount: 23,
  },
  {
    id: "3",
    name: "Carol Davis",
    email: "carol@logistics.com",
    role: "operations",
    status: "active",
    lastLogin: "2024-08-18T08:15:00Z",
    shipmentsCount: 156,
  },
  {
    id: "4",
    name: "David Wilson",
    email: "david@support.com",
    role: "support",
    status: "inactive",
    lastLogin: "2024-08-15T16:45:00Z",
    shipmentsCount: 12,
  },
  {
    id: "5",
    name: "Eva Brown",
    email: "eva@electronics.com",
    role: "client",
    status: "suspended",
    lastLogin: "2024-08-10T11:30:00Z",
    shipmentsCount: 8,
  },
];

// Utility functions
export function getStatusColor(status: Shipment["status"]): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "in_transit":
      return "bg-blue-100 text-blue-800";
    case "delivered":
      return "bg-green-100 text-green-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    case "delayed":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getPriorityColor(priority: Shipment["priority"]): string {
  switch (priority) {
    case "low":
      return "bg-gray-100 text-gray-800";
    case "medium":
      return "bg-blue-100 text-blue-800";
    case "high":
      return "bg-orange-100 text-orange-800";
    case "urgent":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getRoleColor(role: string): string {
  switch (role) {
    case "superadmin":
      return "bg-red-100 text-red-800";
    case "admin":
      return "bg-purple-100 text-purple-800";
    case "client":
      return "bg-blue-100 text-blue-800";
    case "operations":
      return "bg-green-100 text-green-800";
    case "support":
      return "bg-yellow-100 text-yellow-800";
    case "customer":
      return "bg-cyan-100 text-cyan-800";
    case "outlet_admin":
      return "bg-indigo-100 text-indigo-800";
    case "outlet_staff":
      return "bg-teal-100 text-teal-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getUserStatusColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800";
    case "inactive":
      return "bg-gray-100 text-gray-800";
    case "suspended":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "INR",
  }).format(amount);
}

export function formatDate(dateString: string): string {
  // Ensure consistent timezone handling by using UTC
  const date = new Date(dateString);

  // Use UTC methods to avoid timezone differences
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC", // Force UTC to prevent hydration mismatch
  }).format(date);
}

export function getOrderStatusColor(status: Order["status"]): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "confirmed":
      return "bg-blue-100 text-blue-800";
    case "processing":
      return "bg-purple-100 text-purple-800";
    case "shipped":
      return "bg-indigo-100 text-indigo-800";
    case "delivered":
      return "bg-green-100 text-green-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getPlatformColor(platform: Order["platform"]): string {
  switch (platform) {
    case "shopify":
      return "bg-green-100 text-green-800";
    case "woocommerce":
      return "bg-purple-100 text-purple-800";
    case "amazon":
      return "bg-orange-100 text-orange-800";
    case "flipkart":
      return "bg-blue-100 text-blue-800";
    case "manual":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getPaymentStatusColor(status: Order["paymentStatus"]): string {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "failed":
      return "bg-red-100 text-red-800";
    case "refunded":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getPaymentModeColor(mode: Shipment["paymentMode"]): string {
  switch (mode) {
    case "prepaid":
      return "bg-green-100 text-green-800";
    case "cod":
      return "bg-orange-100 text-orange-800";
    case "credit":
      return "bg-blue-100 text-blue-800";
    case "wallet":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getFirstWord(name: string): string {
  return name.split(" ")[0];
}

// Wallet & Billing interfaces
export interface Transaction {
  id: string;
  transactionDetails: {
    date: string;
    time: string;
    status: "completed" | "pending" | "failed";
    reference: string;
  };
  accountDetails: {
    accountNumber: string;
  };
  orderId: string;
  awbLrn: string;
  weightZone: {
    weight: number;
    zone: string;
  };
  // description: string;
  credit: number;
  debit: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  dueDate: string;
  issuedDate: string;
  description: string;
}

// Mock wallet transactions
export const mockTransactions: Transaction[] = [
  {
    id: "1",
    transactionDetails: {
      date: "2024-08-18",
      time: "10:30 AM",
      status: "completed",
      reference: "TXN001234",
    },
    accountDetails: {
      accountNumber: "SUBS 5KG",
    },
    orderId: "ORD2024001",
    awbLrn: "DHL123456789",
    weightZone: {
      weight: 2.5,
      zone: "A",
    },
    // description: "Shipment charges for DHL Express delivery",
    credit: 0,
    debit: 45.5,
  },
  {
    id: "2",
    transactionDetails: {
      date: "2024-08-17",
      time: "02:20 PM",
      status: "completed",
      reference: "TXN001235",
    },
    accountDetails: {
      accountNumber: "SUBS 5KG",
    },
    orderId: "",
    awbLrn: "",
    weightZone: {
      weight: 0,
      zone: "",
    },
    // description: "Wallet top-up via Credit Card ending ****1234",
    credit: 500.0,
    debit: 0,
  },
  {
    id: "3",
    transactionDetails: {
      date: "2024-08-16",
      time: "09:15 AM",
      status: "pending",
      reference: "TXN001236",
    },
    accountDetails: {
      accountNumber: "SUBS 5KG",
    },
    orderId: "ORD2024005",
    awbLrn: "UPS987654321",
    weightZone: {
      weight: 1.8,
      zone: "B",
    },
    // description: "Refund for cancelled shipment - UPS Ground",
    credit: 32.75,
    debit: 0,
  },
  {
    id: "4",
    transactionDetails: {
      date: "2024-08-15",
      time: "04:45 PM",
      status: "completed",
      reference: "TXN001237",
    },
    accountDetails: {
      accountNumber: "SUBS 5KG",
    },
    orderId: "",
    awbLrn: "",
    weightZone: {
      weight: 0,
      zone: "",
    },
    // description: "Monthly platform subscription fee",
    credit: 0,
    debit: 25.0,
  },
  {
    id: "5",
    transactionDetails: {
      date: "2024-08-14",
      time: "11:30 AM",
      status: "completed",
      reference: "TXN001238",
    },
    accountDetails: {
      accountNumber: "SUBS 5KG",
    },
    orderId: "ORD2024003",
    awbLrn: "FDX456789123",
    weightZone: {
      weight: 3.2,
      zone: "C",
    },
    // description: "Shipment charges for FedEx Express delivery",
    credit: 0,
    debit: 38.2,
  },
];

// Mock invoices
// Mock bulk uploads
export const mockBulkUploads: BulkUpload[] = [
  {
    id: "1",
    uploadId: "BULK2024001",
    dateTime: "2024-01-15 10:30 AM",
    status: "completed",
    totalRecords: 50,
    successCount: 48,
    failedCount: 2,
    fileName: "jan_shipments.xlsx",
  },
  {
    id: "2",
    uploadId: "BULK2024002",
    dateTime: "2024-01-14 15:45 PM",
    status: "failed",
    totalRecords: 30,
    successCount: 0,
    failedCount: 30,
    fileName: "urgent_orders.xlsx",
  },
  {
    id: "3",
    uploadId: "BULK2024003",
    dateTime: "2024-01-14 09:15 AM",
    status: "in_progress",
    totalRecords: 100,
    successCount: 45,
    failedCount: 10,
    fileName: "weekly_shipments.xlsx",
  },
  {
    id: "4",
    uploadId: "BULK2024004",
    dateTime: "2024-01-13 14:20 PM",
    status: "completed",
    totalRecords: 75,
    successCount: 73,
    failedCount: 2,
    fileName: "partner_shipments.xlsx",
  },
  {
    id: "5",
    uploadId: "BULK2024005",
    dateTime: "2024-01-13 11:10 AM",
    status: "completed",
    totalRecords: 25,
    successCount: 25,
    failedCount: 0,
    fileName: "express_delivery.xlsx",
  },
];

// Mock NDRs (Non-Delivery Reports)
export const mockNDRs: NDR[] = [
  {
    id: "1",
    trackingNumber: "LOG2024001",
    receiverName: "John Smith",
    // receiverContact: "+1-555-0123",
    attemptNumber: 1,
    attemptDate: "2024-08-18",
    attemptTime: "10:30 AM",
    status: "pending",
    reason: "Receiver not available",
    comments: "No one answered the door during delivery attempt",
    createdAt: "2024-08-18T10:30:00Z",
  },
  {
    id: "2",
    trackingNumber: "LOG2024002",
    receiverName: "Sarah Johnson",
    // receiverContact: "+1-555-0124",
    attemptNumber: 2,
    attemptDate: "2024-08-17",
    attemptTime: "02:20 PM",
    status: "resolved",
    reason: "Incorrect address",
    comments: "Package delivered to correct address after verification",
    // courierPartner: "FedEx",
    createdAt: "2024-08-17T14:20:00Z",
  },
  {
    id: "3",
    trackingNumber: "LOG2024003",
    receiverName: "Mike Chen",
    // receiverContact: "+1-555-0125",
    attemptNumber: 1,
    attemptDate: "2024-08-16",
    attemptTime: "09:15 AM",
    status: "pending",
    reason: "Business closed",
    comments: "Delivery attempted during business hours but office was closed",
    // courierPartner: "UPS",
    createdAt: "2024-08-16T09:15:00Z",
  },
  {
    id: "4",
    trackingNumber: "LOG2024004",
    receiverName: "Emma Wilson",
    // receiverContact: "+1-555-0126",
    attemptNumber: 3,
    attemptDate: "2024-08-15",
    attemptTime: "04:45 PM",
    status: "cancelled",
    reason: "Receiver requested cancellation",
    comments: "Customer called to cancel delivery and return to sender",
    // courierPartner: "Aramex",
    createdAt: "2024-08-15T16:45:00Z",
  },
  {
    id: "5",
    trackingNumber: "LOG2024005",
    receiverName: "David Brown",
    // receiverContact: "+1-555-0127",
    attemptNumber: 1,
    attemptDate: "2024-08-14",
    attemptTime: "11:30 AM",
    status: "pending",
    reason: "Access restricted",
    comments: "Security guard refused entry to building",
    // courierPartner: "DHL Express",
    createdAt: "2024-08-14T11:30:00Z",
  },
  {
    id: "6",
    trackingNumber: "LOG2024006",
    receiverName: "Lisa Garcia",
    // receiverContact: "+1-555-0128",
    attemptNumber: 2,
    attemptDate: "2024-08-13",
    attemptTime: "03:20 PM",
    status: "resolved",
    reason: "Payment issue",
    comments: "COD payment resolved, package delivered successfully",
    // courierPartner: "FedEx",
    createdAt: "2024-08-13T15:20:00Z",
  },
  {
    id: "7",
    trackingNumber: "LOG2024007",
    receiverName: "Tom Anderson",
    // receiverContact: "+1-555-0129",
    attemptNumber: 1,
    attemptDate: "2024-08-12",
    attemptTime: "08:15 AM",
    status: "pending",
    reason: "Weather conditions",
    comments: "Heavy rain prevented delivery, will retry next day",
    // courierPartner: "UPS",
    createdAt: "2024-08-12T08:15:00Z",
  },
  {
    id: "8",
    trackingNumber: "LOG2024008",
    receiverName: "Anna Martinez",
    // receiverContact: "+1-555-0130",
    attemptNumber: 1,
    attemptDate: "2024-08-11",
    attemptTime: "07:45 AM",
    status: "pending",
    reason: "Vehicle breakdown",
    comments: "Delivery vehicle had mechanical issues, rescheduled",
    // courierPartner: "Aramex",
    createdAt: "2024-08-11T07:45:00Z",
  },
];

export const mockInvoices: Invoice[] = [
  {
    id: "1",
    invoiceNumber: "INV-2024-001",
    amount: 1250.0,
    status: "paid",
    dueDate: "2024-08-25",
    issuedDate: "2024-08-01",
    description: "Monthly Shipping Services - July 2024",
  },
  {
    id: "2",
    invoiceNumber: "INV-2024-002",
    amount: 875.5,
    status: "pending",
    dueDate: "2024-08-30",
    issuedDate: "2024-08-15",
    description: "Additional Services & Fees",
  },
  {
    id: "3",
    invoiceNumber: "INV-2024-003",
    amount: 450.0,
    status: "overdue",
    dueDate: "2024-08-10",
    issuedDate: "2024-07-25",
    description: "Express Delivery Services",
  },
];

// Generate mock disputes
export const mockDisputes: Dispute[] = [
  {
    id: "1",
    disputeNumber: "DISP-2024-001",
    trackingNumber: "LOG2024001",
    customerName: "John Smith",
    customerEmail: "john.smith@email.com",
    customerPhone: "+1-555-0101",
    origin: "Mumbai",
    destination: "New York",
    courierPartner: "FedEx",
    issueType: "Delivery Delay",
    reason: "Package delayed due to weather conditions",
    status: "open",
    priority: "high",
    createdAt: "2024-08-15T10:30:00Z",
    lastUpdated: "2024-08-16T14:20:00Z",
    assignedTo: "Support Team A",
  },
  {
    id: "2",
    disputeNumber: "DISP-2024-002",
    trackingNumber: "LOG2024002",
    customerName: "Sarah Johnson",
    customerEmail: "sarah.j@email.com",
    customerPhone: "+1-555-0102",
    origin: "Delhi",
    destination: "Los Angeles",
    courierPartner: "DHL",
    issueType: "Package Damaged",
    reason: "Package arrived with visible damage",
    status: "in_progress",
    priority: "urgent",
    createdAt: "2024-08-14T09:15:00Z",
    lastUpdated: "2024-08-16T11:45:00Z",
    assignedTo: "Claims Team B",
  },
  {
    id: "3",
    disputeNumber: "DISP-2024-003",
    trackingNumber: "LOG2024003",
    customerName: "Mike Wilson",
    customerEmail: "mike.w@email.com",
    customerPhone: "+1-555-0103",
    origin: "Bangalore",
    destination: "Chicago",
    courierPartner: "UPS",
    issueType: "Wrong Address",
    reason: "Package delivered to incorrect address",
    status: "resolved",
    priority: "medium",
    createdAt: "2024-08-12T16:45:00Z",
    lastUpdated: "2024-08-15T13:30:00Z",
    assignedTo: "Support Team A",
    resolution: "Package redirected to correct address",
  },
  {
    id: "4",
    disputeNumber: "DISP-2024-004",
    trackingNumber: "LOG2024004",
    customerName: "Emily Davis",
    customerEmail: "emily.d@email.com",
    customerPhone: "+1-555-0104",
    origin: "Chennai",
    destination: "Houston",
    courierPartner: "Aramex",
    issueType: "Missing Package",
    reason: "Package not received despite delivery confirmation",
    status: "open",
    priority: "high",
    createdAt: "2024-08-16T08:20:00Z",
    lastUpdated: "2024-08-16T15:10:00Z",
    assignedTo: "Investigation Team C",
  },
  {
    id: "5",
    disputeNumber: "DISP-2024-005",
    trackingNumber: "LOG2024005",
    customerName: "David Brown",
    customerEmail: "david.b@email.com",
    customerPhone: "+1-555-0105",
    origin: "Hyderabad",
    destination: "Phoenix",
    courierPartner: "Blue Dart",
    issueType: "Billing Dispute",
    reason: "Incorrect charges applied to shipment",
    status: "in_progress",
    priority: "medium",
    createdAt: "2024-08-13T12:00:00Z",
    lastUpdated: "2024-08-16T10:15:00Z",
    assignedTo: "Finance Team D",
  },
];

// Generate mock support tickets
export const mockSupportTickets: SupportTicket[] = [
  {
    id: "1",
    ticketNumber: "SUP-2024-001",
    customerName: "Alice Cooper",
    subject: "Account Access Issues",
    description:
      "Unable to log into my account. Getting 'Invalid credentials' error even with correct password.",
    category: "Technical Support",
    subcategory: "Account Access",
    priority: "high",
    status: "open",
    createdAt: "2024-08-16T09:00:00Z",
    assignedTo: "Tech Support Team",
    tags: ["login", "account", "technical"],
    customerEmail: "",
  },
  {
    id: "2",
    ticketNumber: "SUP-2024-002",
    customerName: "Robert Taylor",
    subject: "Bulk Upload Template Request",
    description:
      "Need the latest Excel template for bulk shipment uploads. Current template seems outdated.",
    category: "General Inquiry",
    subcategory: "Documentation",
    priority: "low",
    status: "resolved",
    createdAt: "2024-08-15T14:30:00Z",
    lastResponse: "2024-08-15T16:45:00Z",
    responseTime: 2,
    assignedTo: "Customer Success Team",
    tags: ["template", "bulk-upload", "excel"],
    customerEmail: "",
  },
  {
    id: "3",
    ticketNumber: "SUP-2024-003",
    customerName: "Lisa Anderson",
    subject: "API Integration Support",
    description:
      "Need help integrating our Shopify store with the logistics API. Getting 401 authentication errors.",
    category: "Technical Support",
    subcategory: "API Integration",
    priority: "high",
    status: "in_progress",
    createdAt: "2024-08-14T11:15:00Z",
    lastResponse: "2024-08-16T13:20:00Z",
    responseTime: 50,
    assignedTo: "Developer Support Team",
    tags: ["api", "shopify", "integration", "authentication"],
    customerEmail: "",
  },
  {
    id: "4",
    ticketNumber: "SUP-2024-004",
    customerName: "James Miller",
    subject: "Pricing Information",
    description:
      "Looking for detailed pricing information for international shipments to Europe. Need rates for different weight categories.",
    category: "Sales Inquiry",
    subcategory: "Pricing",
    priority: "medium",
    status: "waiting_customer",
    createdAt: "2024-08-13T10:45:00Z",
    lastResponse: "2024-08-15T15:30:00Z",
    responseTime: 29,
    assignedTo: "Sales Team",
    tags: ["pricing", "international", "europe", "rates"],
    customerEmail: "",
  },
  {
    id: "5",
    ticketNumber: "SUP-2024-005",
    customerName: "Maria Garcia",
    subject: "Refund Request",
    description:
      "Requesting refund for cancelled shipment LOG2024006. Payment was deducted but shipment was cancelled due to courier unavailability.",
    category: "Billing Support",
    subcategory: "Refunds",
    priority: "urgent",
    status: "open",
    createdAt: "2024-08-16T07:30:00Z",
    assignedTo: "Finance Team",
    tags: ["refund", "cancelled", "payment", "urgent"],
    customerEmail: "",
  },
  {
    id: "6",
    ticketNumber: "SUP-2024-006",
    customerName: "Tom Wilson",
    subject: "Mobile App Feature Request",
    description:
      "Would be great to have push notifications for shipment status updates in the mobile app. Currently only email notifications available.",
    category: "Feature Request",
    subcategory: "Mobile App",
    priority: "low",
    status: "open",
    createdAt: "2024-08-12T16:20:00Z",
    assignedTo: "Product Team",
    tags: ["mobile-app", "notifications", "feature-request"],
    customerEmail: "",
  },
];

// Wallet utility functions
export function getTransactionStatusColor(
  status: Transaction["transactionDetails"]["status"],
): string {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "failed":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getInvoiceStatusColor(status: Invoice["status"]): string {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "overdue":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getBulkUploadStatusColor(status: BulkUpload["status"]): string {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800";
    case "failed":
      return "bg-red-100 text-red-800";
    case "in_progress":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

// NDR utility functions
export function getNDRStatusColor(status: NDR["status"]): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "resolved":
      return "bg-green-100 text-green-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

// Dispute utility functions
export function getDisputeStatusColor(status: Dispute["status"]): string {
  switch (status) {
    case "open":
      return "bg-red-100 text-red-800";
    case "in_progress":
      return "bg-yellow-100 text-yellow-800";
    case "resolved":
      return "bg-green-100 text-green-800";
    case "closed":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

// Support Ticket utility functions
export function getTicketPriorityColor(
  priority: SupportTicket["priority"],
): string {
  switch (priority) {
    case "urgent":
      return "border-red-500 text-red-700 bg-red-50";
    case "high":
      return "border-orange-500 text-orange-700 bg-orange-50";
    case "medium":
      return "border-yellow-500 text-yellow-700 bg-yellow-50";
    case "low":
      return "border-green-500 text-green-700 bg-green-50";
    default:
      return "border-gray-500 text-gray-700 bg-gray-50";
  }
}

export function getTicketStatusColor(status: SupportTicket["status"]): string {
  switch (status) {
    case "open":
      return "bg-red-100 text-red-800";
    case "in_progress":
      return "bg-yellow-100 text-yellow-800";
    case "waiting_customer":
      return "bg-blue-100 text-blue-800";
    case "resolved":
      return "bg-green-100 text-green-800";
    case "closed":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

// Shopify Platform Integration Data
export interface ShopifyStore {
  id: string;
  name: string;
  domain: string;
  status: "connected" | "disconnected" | "error" | "pending";
  lastSync: string;
  ordersCount: number;
  revenue: number;
  apiKey: string;
  apiSecret: string;
  webhookUrl: string;
  accessToken: string;
  storeImage?: string;
  settings: ShopifySettings;
}

export interface ShopifySettings {
  autoSync: boolean;
  syncInterval: number; // minutes
  webhookEnabled: boolean;
  orderStatusMapping: Record<string, string>;
  inventorySync: boolean;
  customerSync: boolean;
  productSync: boolean;
}

export interface ShopifyOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  createdAt: string;
  lastSync: string;
  syncStatus: "synced" | "pending" | "failed";
  platform: "shopify";
}

// Mock Shopify stores data
export const mockShopifyStores: ShopifyStore[] = [
  {
    id: "shopify-1",
    name: "TechCorp Store",
    domain: "techcorp.myshopify.com",
    status: "connected",
    lastSync: "2024-08-21T10:30:00Z",
    ordersCount: 1247,
    revenue: 45780,
    apiKey: "shp_1234567890abcdef",
    apiSecret: "shp_1234567890abcdef",
    webhookUrl: "https://api.logistics.com/webhooks/shopify",
    accessToken: "shpat_1234567890abcdef",
    settings: {
      autoSync: true,
      syncInterval: 15,
      webhookEnabled: true,
      orderStatusMapping: {
        pending: "pending",
        processing: "in_transit",
        shipped: "delivered",
        delivered: "delivered",
        cancelled: "cancelled",
      },
      inventorySync: true,
      customerSync: true,
      productSync: false,
    },
  },
  {
    id: "shopify-2",
    name: "Fashion Hub",
    domain: "fashionhub.myshopify.com",
    status: "pending",
    lastSync: "2024-08-21T09:15:00Z",
    ordersCount: 0,
    revenue: 0,
    apiKey: "shp_9876543210fedcba",
    apiSecret: "shp_9876543210fedcba",
    webhookUrl: "https://api.logistics.com/webhooks/shopify",
    accessToken: "shpat_9876543210fedcba",
    storeImage:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop&auto=format",
    settings: {
      autoSync: false,
      syncInterval: 30,
      webhookEnabled: false,
      orderStatusMapping: {},
      inventorySync: false,
      customerSync: false,
      productSync: false,
    },
  },
  {
    id: "shopify-3",
    name: "Electronics World",
    domain: "electronics.myshopify.com",
    status: "connected",
    lastSync: "2024-08-21T11:45:00Z",
    ordersCount: 892,
    revenue: 32150,
    apiKey: "shp_abcdef1234567890",
    apiSecret: "shp_abcdef1234567890",
    webhookUrl: "https://api.logistics.com/webhooks/shopify",
    accessToken: "shpat_abcdef1234567890",
    storeImage:
      "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&h=300&fit=crop&auto=format",
    settings: {
      autoSync: true,
      syncInterval: 20,
      webhookEnabled: true,
      orderStatusMapping: {
        pending: "pending",
        processing: "in_transit",
        shipped: "delivered",
        delivered: "delivered",
        cancelled: "cancelled",
      },
      inventorySync: true,
      customerSync: false,
      productSync: true,
    },
  },
];

// Mock Shopify orders data
export const mockShopifyOrders: ShopifyOrder[] = [
  {
    id: "order-1",
    orderNumber: "#1001",
    customerName: "John Doe",
    total: 299.99,
    status: "pending",
    createdAt: "2024-08-21T10:00:00Z",
    lastSync: "2024-08-21T10:30:00Z",
    syncStatus: "synced",
    platform: "shopify",
  },
  {
    id: "order-2",
    orderNumber: "#1002",
    customerName: "Jane Smith",
    total: 149.5,
    status: "processing",
    createdAt: "2024-08-21T09:30:00Z",
    lastSync: "2024-08-21T10:15:00Z",
    syncStatus: "synced",
    platform: "shopify",
  },
  {
    id: "order-3",
    orderNumber: "#1003",
    customerName: "Bob Johnson",
    total: 89.99,
    status: "shipped",
    createdAt: "2024-08-21T08:00:00Z",
    lastSync: "2024-08-21T09:45:00Z",
    syncStatus: "synced",
    platform: "shopify",
  },
  {
    id: "order-4",
    orderNumber: "#1004",
    customerName: "Alice Brown",
    total: 450.0,
    status: "delivered",
    createdAt: "2024-08-20T16:30:00Z",
    lastSync: "2024-08-20T17:00:00Z",
    syncStatus: "synced",
    platform: "shopify",
  },
  {
    id: "order-5",
    orderNumber: "#1005",
    customerName: "Charlie Wilson",
    total: 199.99,
    status: "cancelled",
    createdAt: "2024-08-20T14:15:00Z",
    lastSync: "2024-08-20T14:30:00Z",
    syncStatus: "synced",
    platform: "shopify",
  },
];

// Platform integration utility functions
export function getShopifyStatusColor(status: ShopifyStore["status"]): string {
  switch (status) {
    case "connected":
      return "bg-green-100 text-green-800";
    case "disconnected":
      return "bg-gray-100 text-gray-800";
    case "error":
      return "bg-red-100 text-red-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getShopifyStatusIcon(status: ShopifyStore["status"]) {
  switch (status) {
    case "connected":
      return "bg-green-500";
    case "disconnected":
      return "bg-gray-500";
    case "error":
      return "bg-red-500";
    case "pending":
      return "bg-yellow-500";
    default:
      return "bg-gray-500";
  }
}

export function getShopifySyncStatusColor(
  status: ShopifyOrder["syncStatus"],
): string {
  switch (status) {
    case "synced":
      return "bg-green-100 text-green-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "failed":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getShopifyOrderStatusColor(
  status: ShopifyOrder["status"],
): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "processing":
      return "bg-blue-100 text-blue-800";
    case "shipped":
      return "bg-indigo-100 text-indigo-800";
    case "delivered":
      return "bg-green-100 text-green-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

// Partner/Courier interfaces
export interface Partner {
  id: string;
  name: string;
  logo?: string;
  type: "courier" | "logistics" | "warehouse" | "customs";
  status: "active" | "inactive" | "suspended" | "pending";
  rating: number;
  deliveryTime: string;
  coverage: string[];
  services: string[];
  pricing: {
    baseRate: number;
    perKgRate: number;
    fuelSurcharge: number;
    zoneRates: Record<string, number>;
  };
  contact: {
    email: string;
    phone: string;
    address: string;
    website: string;
  };
  performance: {
    totalShipments: number;
    successRate: number;
    avgDeliveryTime: number;
    customerSatisfaction: number;
  };
  lastUpdated: string;
  contractStartDate: string;
  contractEndDate: string;
}

export interface PartnerShipment {
  id: string;
  partnerId: string;
  partnerName: string;
  trackingNumber: string;
  status:
    | "pending"
    | "picked_up"
    | "in_transit"
    | "out_for_delivery"
    | "delivered"
    | "failed";
  pickupDate: string;
  estimatedDelivery: string;
  actualDelivery?: string;
  weight: number;
  value: number;
  origin: string;
  destination: string;
  customerName: string;
  customerPhone: string;
  paymentMode: "prepaid" | "cod";
  charges: number;
  commission: number;
  createdAt: string;
}

// Mock partner data
export const mockPartners: Partner[] = [
  {
    id: "partner-1",
    name: "DHL Express",
    logo: "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=400&h=300&fit=crop&auto=format",
    type: "courier",
    status: "active",
    rating: 4.8,
    deliveryTime: "2-3 days",
    coverage: ["International", "Express", "Same Day"],
    services: [
      "Express Delivery",
      "Freight",
      "E-commerce",
      "Customs Clearance",
    ],
    pricing: {
      baseRate: 25.0,
      perKgRate: 8.5,
      fuelSurcharge: 2.5,
      zoneRates: {
        "Zone A": 15.0,
        "Zone B": 25.0,
        "Zone C": 35.0,
      },
    },
    contact: {
      email: "partnership@dhl.com",
      phone: "+1-800-225-5345",
      address: "1234 Logistics Blvd, Memphis, TN 38118",
      website: "https://www.dhl.com",
    },
    performance: {
      totalShipments: 15420,
      successRate: 98.5,
      avgDeliveryTime: 2.3,
      customerSatisfaction: 4.7,
    },
    lastUpdated: "2024-08-21T10:30:00Z",
    contractStartDate: "2024-01-01",
    contractEndDate: "2024-12-31",
  },
  {
    id: "partner-2",
    name: "FedEx Corporation",
    logo: "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=400&h=300&fit=crop&auto=format",
    type: "courier",
    status: "active",
    rating: 4.6,
    deliveryTime: "1-3 days",
    coverage: ["Domestic", "International", "Express"],
    services: ["Ground Shipping", "Express", "Freight", "Customs"],
    pricing: {
      baseRate: 22.0,
      perKgRate: 7.8,
      fuelSurcharge: 2.8,
      zoneRates: {
        "Zone A": 12.0,
        "Zone B": 22.0,
        "Zone C": 32.0,
      },
    },
    contact: {
      email: "partnership@fedex.com",
      phone: "+1-800-463-3339",
      address: "942 S Shady Grove Rd, Memphis, TN 38120",
      website: "https://www.fedex.com",
    },
    performance: {
      totalShipments: 12850,
      successRate: 97.8,
      avgDeliveryTime: 2.1,
      customerSatisfaction: 4.5,
    },
    lastUpdated: "2024-08-21T09:15:00Z",
    contractStartDate: "2024-01-01",
    contractEndDate: "2024-12-31",
  },
  {
    id: "partner-3",
    name: "UPS Logistics",
    logo: "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=400&h=300&fit=crop&auto=format",
    type: "courier",
    status: "active",
    rating: 4.7,
    deliveryTime: "1-4 days",
    coverage: ["Domestic", "International", "Ground"],
    services: ["Ground", "Air", "Freight", "Supply Chain"],
    pricing: {
      baseRate: 20.0,
      perKgRate: 7.2,
      fuelSurcharge: 2.2,
      zoneRates: {
        "Zone A": 10.0,
        "Zone B": 20.0,
        "Zone C": 30.0,
      },
    },
    contact: {
      email: "partnership@ups.com",
      phone: "+1-800-742-5877",
      address: "55 Glenlake Pkwy NE, Atlanta, GA 30328",
      website: "https://www.ups.com",
    },
    performance: {
      totalShipments: 11230,
      successRate: 98.2,
      avgDeliveryTime: 2.4,
      customerSatisfaction: 4.6,
    },
    lastUpdated: "2024-08-21T11:45:00Z",
    contractStartDate: "2024-01-01",
    contractEndDate: "2024-12-31",
  },
  {
    id: "partner-4",
    name: "Aramex International",
    logo: "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=400&h=300&fit=crop&auto=format",
    type: "courier",
    status: "active",
    rating: 4.4,
    deliveryTime: "3-5 days",
    coverage: ["Middle East", "Asia", "Africa"],
    services: ["Express", "Freight", "E-commerce", "Customs"],
    pricing: {
      baseRate: 18.0,
      perKgRate: 6.5,
      fuelSurcharge: 2.0,
      zoneRates: {
        "Zone A": 8.0,
        "Zone B": 18.0,
        "Zone C": 28.0,
      },
    },
    contact: {
      email: "partnership@aramex.com",
      phone: "+971-4-809-0000",
      address: "Dubai Airport Free Zone, Dubai, UAE",
      website: "https://www.aramex.com",
    },
    performance: {
      totalShipments: 8750,
      successRate: 96.5,
      avgDeliveryTime: 3.8,
      customerSatisfaction: 4.3,
    },
    lastUpdated: "2024-08-21T08:30:00Z",
    contractStartDate: "2024-01-01",
    contractEndDate: "2024-12-31",
  },
  {
    id: "partner-5",
    name: "Blue Dart Express",
    logo: "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=400&h=300&fit=crop&auto=format",
    type: "courier",
    status: "active",
    rating: 4.5,
    deliveryTime: "1-2 days",
    coverage: ["Domestic", "Express", "Same Day"],
    services: ["Express", "Ground", "Freight", "E-commerce"],
    pricing: {
      baseRate: 15.0,
      perKgRate: 5.5,
      fuelSurcharge: 1.8,
      zoneRates: {
        "Zone A": 5.0,
        "Zone B": 15.0,
        "Zone C": 25.0,
      },
    },
    contact: {
      email: "partnership@bluedart.com",
      phone: "+91-22-6601-6601",
      address: "Blue Dart Centre, Sahar Airport Road, Mumbai, India",
      website: "https://www.bluedart.com",
    },
    performance: {
      totalShipments: 23450,
      successRate: 97.2,
      avgDeliveryTime: 1.8,
      customerSatisfaction: 4.4,
    },
    lastUpdated: "2024-08-21T12:15:00Z",
    contractStartDate: "2024-01-01",
    contractEndDate: "2024-12-31",
  },
  {
    id: "partner-6",
    name: "DTDC Express",
    logo: "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=400&h=300&fit=crop&auto=format",
    type: "courier",
    status: "active",
    rating: 4.2,
    deliveryTime: "2-4 days",
    coverage: ["Domestic", "Express", "Economy"],
    services: ["Express", "Ground", "Freight", "E-commerce"],
    pricing: {
      baseRate: 12.0,
      perKgRate: 4.8,
      fuelSurcharge: 1.5,
      zoneRates: {
        "Zone A": 3.0,
        "Zone B": 12.0,
        "Zone C": 22.0,
      },
    },
    contact: {
      email: "partnership@dtdc.com",
      phone: "+91-80-2222-2222",
      address: "DTDC House, 3rd Floor, Jeevan Bhima Nagar, Bangalore, India",
      website: "https://www.dtdc.com",
    },
    performance: {
      totalShipments: 18750,
      successRate: 95.8,
      avgDeliveryTime: 2.9,
      customerSatisfaction: 4.1,
    },
    lastUpdated: "2024-08-21T13:45:00Z",
    contractStartDate: "2024-01-01",
    contractEndDate: "2024-12-31",
  },
];

// Mock partner shipments data
export const mockPartnerShipments: PartnerShipment[] = [
  {
    id: "ps-1",
    partnerId: "partner-1",
    partnerName: "DHL Express",
    trackingNumber: "DHL123456789",
    status: "delivered",
    pickupDate: "2024-08-18T10:30:00Z",
    estimatedDelivery: "2024-08-20T15:00:00Z",
    actualDelivery: "2024-08-20T14:30:00Z",
    weight: 2.5,
    value: 1200,
    origin: "Mumbai",
    destination: "New York",
    customerName: "John Smith",
    customerPhone: "+1-555-0123",
    paymentMode: "prepaid",
    charges: 45.5,
    commission: 4.55,
    createdAt: "2024-08-18T10:00:00Z",
  },
  {
    id: "ps-2",
    partnerId: "partner-2",
    partnerName: "FedEx Corporation",
    trackingNumber: "FDX987654321",
    status: "in_transit",
    pickupDate: "2024-08-19T14:20:00Z",
    estimatedDelivery: "2024-08-22T12:00:00Z",
    weight: 1.8,
    value: 850,
    origin: "Delhi",
    destination: "Los Angeles",
    customerName: "Sarah Johnson",
    customerPhone: "+1-555-0124",
    paymentMode: "cod",
    charges: 38.2,
    commission: 3.82,
    createdAt: "2024-08-19T14:00:00Z",
  },
  {
    id: "ps-3",
    partnerId: "partner-3",
    partnerName: "UPS Logistics",
    trackingNumber: "UPS456789123",
    status: "out_for_delivery",
    pickupDate: "2024-08-20T09:15:00Z",
    estimatedDelivery: "2024-08-21T10:30:00Z",
    weight: 3.2,
    value: 1850,
    origin: "Bangalore",
    destination: "Chicago",
    customerName: "Mike Chen",
    customerPhone: "+1-555-0125",
    paymentMode: "prepaid",
    charges: 52.8,
    commission: 5.28,
    createdAt: "2024-08-20T09:00:00Z",
  },
  {
    id: "ps-4",
    partnerId: "partner-4",
    partnerName: "Aramex International",
    trackingNumber: "ARX789123456",
    status: "picked_up",
    pickupDate: "2024-08-21T11:45:00Z",
    estimatedDelivery: "2024-08-24T16:45:00Z",
    weight: 0.8,
    value: 95,
    origin: "Chennai",
    destination: "Dubai",
    customerName: "Emma Wilson",
    customerPhone: "+1-555-0126",
    paymentMode: "prepaid",
    charges: 28.5,
    commission: 2.85,
    createdAt: "2024-08-21T11:30:00Z",
  },
  {
    id: "ps-5",
    partnerId: "partner-5",
    partnerName: "Blue Dart Express",
    trackingNumber: "BLD321654987",
    status: "delivered",
    pickupDate: "2024-08-17T16:45:00Z",
    estimatedDelivery: "2024-08-18T11:30:00Z",
    actualDelivery: "2024-08-18T10:45:00Z",
    weight: 1.5,
    value: 650,
    origin: "Hyderabad",
    destination: "Mumbai",
    customerName: "David Brown",
    customerPhone: "+1-555-0127",
    paymentMode: "cod",
    charges: 22.5,
    commission: 2.25,
    createdAt: "2024-08-17T16:30:00Z",
  },
  {
    id: "ps-6",
    partnerId: "partner-6",
    partnerName: "DTDC Express",
    trackingNumber: "DTD147258369",
    status: "pending",
    pickupDate: "2024-08-22T08:30:00Z",
    estimatedDelivery: "2024-08-25T14:00:00Z",
    weight: 2.1,
    value: 420,
    origin: "Pune",
    destination: "Kolkata",
    customerName: "Lisa Garcia",
    customerPhone: "+1-555-0128",
    paymentMode: "prepaid",
    charges: 18.8,
    commission: 1.88,
    createdAt: "2024-08-22T08:00:00Z",
  },
];

// Partner utility functions
export function getPartnerStatusColor(status: Partner["status"]): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800";
    case "inactive":
      return "bg-gray-100 text-gray-800";
    case "suspended":
      return "bg-red-100 text-red-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getPartnerTypeColor(type: Partner["type"]): string {
  switch (type) {
    case "courier":
      return "bg-blue-100 text-blue-800";
    case "logistics":
      return "bg-green-100 text-green-800";
    case "warehouse":
      return "bg-purple-100 text-purple-800";
    case "customs":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getPartnerShipmentStatusColor(
  status: PartnerShipment["status"],
): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "picked_up":
      return "bg-blue-100 text-blue-800";
    case "in_transit":
      return "bg-indigo-100 text-indigo-800";
    case "out_for_delivery":
      return "bg-purple-100 text-purple-800";
    case "delivered":
      return "bg-green-100 text-green-800";
    case "failed":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getRatingColor(rating: number): string {
  if (rating >= 4.5) return "text-green-600";
  if (rating >= 4.0) return "text-yellow-600";
  if (rating >= 3.5) return "text-orange-600";
  return "text-red-600";
}

export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

// User Management Data
export const userRoles: UserRole[] = [
  {
    value: "admin",
    label: "Admin",
    color: "bg-red-100 text-red-800",
    description: "Full system access with user management capabilities",
    permissions: [
      "shipments_view",
      "shipments_create",
      "shipments_edit",
      "shipments_delete",
      "users_view",
      "users_create",
      "users_edit",
      "users_delete",
      "reports_view",
      "reports_create",
      "partners_view",
      "partners_manage",
      "billing_view",
      "billing_manage",
    ],
  },
  {
    value: "client",
    label: "Client",
    color: "bg-blue-100 text-blue-800",
    description: "Shipment management and order tracking access",
    permissions: [
      "shipments_view",
      "shipments_create",
      "shipments_edit",
      "reports_view",
      "billing_view",
    ],
  },
  {
    value: "operations",
    label: "Operations",
    color: "bg-orange-100 text-orange-800",
    description: "Shipment operations and partner management",
    permissions: [
      "shipments_view",
      "shipments_edit",
      "partners_view",
      "partners_manage",
      "reports_view",
      "reports_create",
    ],
  },
  {
    value: "support",
    label: "Support",
    color: "bg-teal-100 text-teal-800",
    description: "Customer assistance and issue resolution",
    permissions: ["shipments_view", "users_view", "reports_view"],
  },
];

export const userStatuses: UserStatus[] = [
  {
    value: "active",
    label: "Active",
    color: "bg-green-100 text-green-800",
    description: "User has full access to assigned features",
  },
  {
    value: "inactive",
    label: "Inactive",
    color: "bg-yellow-100 text-yellow-800",
    description: "User account is temporarily disabled",
  },
  {
    value: "suspended",
    label: "Suspended",
    color: "bg-red-100 text-red-800",
    description: "User account is suspended due to policy violation",
  },
];

export const userPermissions: UserPermission[] = [
  // Shipment permissions
  {
    value: "shipments_view",
    label: "View Shipments",
    category: "Shipments",
    description: "Can view shipment details and status",
  },
  {
    value: "shipments_create",
    label: "Create Shipments",
    category: "Shipments",
    description: "Can create new shipments",
  },
  {
    value: "shipments_edit",
    label: "Edit Shipments",
    category: "Shipments",
    description: "Can modify existing shipment details",
  },
  {
    value: "shipments_delete",
    label: "Delete Shipments",
    category: "Shipments",
    description: "Can delete shipments from the system",
  },

  // User management permissions
  {
    value: "users_view",
    label: "View Users",
    category: "Users",
    description: "Can view user profiles and information",
  },
  {
    value: "users_create",
    label: "Create Users",
    category: "Users",
    description: "Can create new user accounts",
  },
  {
    value: "users_edit",
    label: "Edit Users",
    category: "Users",
    description: "Can modify user account details",
  },
  {
    value: "users_delete",
    label: "Delete Users",
    category: "Users",
    description: "Can delete user accounts",
  },

  // Report permissions
  {
    value: "reports_view",
    label: "View Reports",
    category: "Reports",
    description: "Can access and view system reports",
  },
  {
    value: "reports_create",
    label: "Create Reports",
    category: "Reports",
    description: "Can generate custom reports",
  },

  // Partner permissions
  {
    value: "partners_view",
    label: "View Partners",
    category: "Partners",
    description: "Can view partner information",
  },
  {
    value: "partners_manage",
    label: "Manage Partners",
    category: "Partners",
    description: "Can manage partner relationships and settings",
  },

  // Billing permissions
  {
    value: "billing_view",
    label: "View Billing",
    category: "Billing",
    description: "Can view billing information and invoices",
  },
  {
    value: "billing_manage",
    label: "Manage Billing",
    category: "Billing",
    description: "Can manage billing settings and payment processing",
  },
];

// User management utility functions
export function getRoleByValue(value: string): UserRole | undefined {
  return userRoles.find((role) => role.value === value);
}

export function getStatusByValue(value: string): UserStatus | undefined {
  return userStatuses.find((status) => status.value === value);
}

export function getPermissionByValue(
  value: string,
): UserPermission | undefined {
  return userPermissions.find((permission) => permission.value === value);
}

export function getPermissionsByCategory(category: string): UserPermission[] {
  return userPermissions.filter(
    (permission) => permission.category === category,
  );
}

export function getDefaultPermissionsForRole(role: string): string[] {
  const roleData = getRoleByValue(role);
  return roleData ? roleData.permissions : [];
}

// Permission Management Interfaces
export interface PermissionCategory {
  id: string;
  name: string;
  icon: string; // Icon name for dynamic import
  description: string;
  permissions: Permission[];
}

export interface Permission {
  id: string;
  name: string;
  description: string;
}

// Permission categories data
export const permissionCategories: PermissionCategory[] = [
  {
    id: "shipments",
    name: "Shipment Management",
    icon: "Package",
    description: "Manage shipments, tracking, and delivery operations",
    permissions: [
      {
        id: "read:shipments",
        name: "View Shipments",
        description: "Can view shipment details and status",
      },
      {
        id: "write:shipments",
        name: "Create Shipments",
        description: "Can create new shipments",
      },
      {
        id: "edit:shipments",
        name: "Edit Shipments",
        description: "Can modify existing shipments",
      },
      {
        id: "delete:shipments",
        name: "Delete Shipments",
        description: "Can remove shipments from system",
      },
      {
        id: "bulk:shipments",
        name: "Bulk Operations",
        description: "Can perform bulk shipment operations",
      },
    ],
  },
  {
    id: "users",
    name: "User Management",
    icon: "Users",
    description: "Manage user accounts, roles, and permissions",
    permissions: [
      {
        id: "read:users",
        name: "View Users",
        description: "Can view user profiles and information",
      },
      {
        id: "write:users",
        name: "Create Users",
        description: "Can create new user accounts",
      },
      {
        id: "edit:users",
        name: "Edit Users",
        description: "Can modify user information",
      },
      {
        id: "delete:users",
        name: "Delete Users",
        description: "Can remove user accounts",
      },
      {
        id: "manage:permissions",
        name: "Manage Permissions",
        description: "Can assign and modify user permissions",
      },
    ],
  },
  {
    id: "reports",
    name: "Reports & Analytics",
    icon: "BarChart3",
    description: "Access to reports, analytics, and business intelligence",
    permissions: [
      {
        id: "read:reports",
        name: "View Reports",
        description: "Can access basic reports and analytics",
      },
      {
        id: "export:reports",
        name: "Export Reports",
        description: "Can export reports in various formats",
      },
      {
        id: "create:reports",
        name: "Create Reports",
        description: "Can create custom reports",
      },
      {
        id: "admin:reports",
        name: "Admin Reports",
        description: "Can access administrative reports",
      },
    ],
  },
  {
    id: "billing",
    name: "Billing & Finance",
    icon: "CreditCard",
    description: "Manage billing, invoices, and financial operations",
    permissions: [
      {
        id: "read:billing",
        name: "View Billing",
        description: "Can view billing information and invoices",
      },
      {
        id: "create:invoices",
        name: "Create Invoices",
        description: "Can generate invoices for customers",
      },
      {
        id: "manage:payments",
        name: "Manage Payments",
        description: "Can process and manage payments",
      },
      {
        id: "admin:finance",
        name: "Admin Finance",
        description: "Can access financial administration",
      },
    ],
  },
  {
    id: "partners",
    name: "Partner Management",
    icon: "Globe",
    description: "Manage courier partners and external integrations",
    permissions: [
      {
        id: "read:partners",
        name: "View Partners",
        description: "Can view partner information",
      },
      {
        id: "manage:partners",
        name: "Manage Partners",
        description: "Can add, edit, and remove partners",
      },
      {
        id: "partner:rates",
        name: "Partner Rates",
        description: "Can manage partner pricing and rates",
      },
      {
        id: "partner:contracts",
        name: "Partner Contracts",
        description: "Can manage partner agreements",
      },
    ],
  },
  {
    id: "system",
    name: "System Administration",
    icon: "Server",
    description: "System configuration and administrative functions",
    permissions: [
      {
        id: "system:config",
        name: "System Config",
        description: "Can modify system configuration",
      },
      {
        id: "system:logs",
        name: "System Logs",
        description: "Can access system logs and monitoring",
      },
      {
        id: "system:backup",
        name: "System Backup",
        description: "Can manage system backups",
      },
      {
        id: "system:security",
        name: "System Security",
        description: "Can manage security settings",
      },
    ],
  },
];

// Enhanced user data with additional fields for permissions page
export interface EnhancedUser extends User {
  phone?: string;
  company?: string;
  department?: string;
  position?: string;
  permissions?: string[];
}

// Enhanced mock users with additional data
export const enhancedMockUsers: EnhancedUser[] = [
  {
    id: "1",
    name: "Alice Johnson",
    email: "alice@techcorp.com",
    role: "admin",
    status: "active",
    lastLogin: "2024-08-18T09:30:00Z",
    shipmentsCount: 45,
    phone: "+91 98765 43210",
    company: "TechCorp Solutions",
    department: "Engineering",
    position: "Senior Developer",
    permissions: [
      "read:shipments",
      "write:shipments",
      "read:reports",
      "manage:users",
    ],
  },
  {
    id: "2",
    name: "Bob Smith",
    email: "bob@fashionstore.com",
    role: "client",
    status: "active",
    lastLogin: "2024-08-17T14:20:00Z",
    shipmentsCount: 23,
    phone: "+91 98765 43211",
    company: "Fashion Store",
    department: "Sales",
    position: "Sales Manager",
    permissions: ["read:shipments", "write:shipments", "read:reports"],
  },
  {
    id: "3",
    name: "Carol Davis",
    email: "carol@logistics.com",
    role: "operations",
    status: "active",
    lastLogin: "2024-08-18T08:15:00Z",
    shipmentsCount: 156,
    phone: "+91 98765 43212",
    company: "Logistics Corp",
    department: "Operations",
    position: "Operations Manager",
    permissions: [
      "read:shipments",
      "edit:shipments",
      "read:reports",
      "read:partners",
    ],
  },
  {
    id: "4",
    name: "David Wilson",
    email: "david@support.com",
    role: "support",
    status: "inactive",
    lastLogin: "2024-08-15T16:45:00Z",
    shipmentsCount: 12,
    phone: "+91 98765 43213",
    company: "Support Services",
    department: "Customer Support",
    position: "Support Specialist",
    permissions: ["read:shipments", "read:users", "read:reports"],
  },
  {
    id: "5",
    name: "Eva Brown",
    email: "eva@electronics.com",
    role: "client",
    status: "suspended",
    lastLogin: "2024-08-10T11:30:00Z",
    shipmentsCount: 8,
    phone: "+91 98765 43214",
    company: "Electronics Hub",
    department: "E-commerce",
    position: "E-commerce Manager",
    permissions: ["read:shipments"],
  },
];

// Partner-related constants
export const COVERAGE_OPTIONS = [
  "North India",
  "South India",
  "East India",
  "West India",
  "Central India",
  "Northeast India",
  "Himalayan Region",
  "Coastal Areas",
  "Metro Cities",
  "Tier 2 Cities",
];

export const SERVICE_OPTIONS = [
  "Express Delivery",
  "Standard Delivery",
  "Same Day Delivery",
  "Next Day Delivery",
  "COD",
  "Prepaid",
  "Insurance",
  "Signature Required",
  "Fragile Handling",
  "Temperature Controlled",
];

export const PARTNER_TYPES = [
  { value: "courier", label: "Courier" },
  { value: "logistics", label: "Logistics" },
  { value: "warehouse", label: "Warehouse" },
  { value: "customs", label: "Customs" },
];

export const PARTNER_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
];

export const RATING_OPTIONS = [
  { value: 1, label: "1 Star" },
  { value: 2, label: "2 Stars" },
  { value: 3, label: "3 Stars" },
  { value: 4, label: "4 Stars" },
  { value: 5, label: "5 Stars" },
];

// Remittance interfaces
export interface Remittance {
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
  manifestDate: string;
  deliveryDate: string;
}

export interface RemittanceFilter {
  retailer?: string;
  status?: Remittance["status"];
  dateRange?: {
    start: string;
    end: string;
  };
}

// Mock remittance data
export const mockRemittances: Remittance[] = [
  {
    id: "1",
    outlet: "RG ENTERPRISES",
    refNo: "2506300237101587",
    awbNumber: "25095210204035",
    receiver: "Pradeep",
    courier: "Delhivery",
    weight: 26.4,
    amount: 7900.0,
    status: "pending",
    createdAt: "2024-08-27T10:30:00Z",
    manifestDate: "2024-08-27",
    deliveryDate: "2024-08-29",
  },
  {
    id: "2",
    outlet: "RG ENTERPRISES",
    refNo: "2507171219282397",
    awbNumber: "25095210209576",
    receiver: "Raneeta chatterjee",
    courier: "Delhivery",
    weight: 92.42,
    amount: 15000.0,
    status: "pending",
    createdAt: "2024-08-27T11:15:00Z",
    manifestDate: "2024-08-27",
    deliveryDate: "2024-08-30",
  },
  {
    id: "3",
    outlet: "RG ENTERPRISES",
    refNo: "2507180312024924",
    awbNumber: "25095210210980",
    receiver: "v vijaya lakshmi",
    courier: "Delhivery",
    weight: 179.0,
    amount: 27710.0,
    status: "pending",
    createdAt: "2024-08-27T12:00:00Z",
    manifestDate: "2024-08-27",
    deliveryDate: "2024-08-31",
  },
  {
    id: "4",
    outlet: "RG ENTERPRISES",
    refNo: "2507251145157710",
    awbNumber: "25095210212612",
    receiver: "Pydisri kanuri",
    courier: "Delhivery",
    weight: 170.14,
    amount: 27680.0,
    status: "pending",
    createdAt: "2024-08-27T13:45:00Z",
    manifestDate: "2024-08-27",
    deliveryDate: "2024-09-01",
  },
  {
    id: "5",
    outlet: "RG ENTERPRISES",
    refNo: "2508021255184695",
    awbNumber: "25095210213824",
    receiver: "Bhavya sri",
    courier: "Delhivery",
    weight: 31.68,
    amount: 9600.0,
    status: "pending",
    createdAt: "2024-08-27T14:20:00Z",
    manifestDate: "2024-08-27",
    deliveryDate: "2024-09-02",
  },
  {
    id: "6",
    outlet: "RG ENTERPRISES",
    refNo: "2508020117189573",
    awbNumber: "25095210213780",
    receiver: "Dr mohd akram Quresh",
    courier: "Delhivery",
    weight: 41.62,
    amount: 13600.0,
    status: "pending",
    createdAt: "2024-08-27T15:10:00Z",
    manifestDate: "2024-08-27",
    deliveryDate: "2024-09-03",
  },
  {
    id: "7",
    outlet: "RG ENTERPRISES",
    refNo: "2508030923451234",
    awbNumber: "25095210214567",
    receiver: "Priya Sharma",
    courier: "Delhivery",
    weight: 15.25,
    amount: 4500.0,
    status: "settled",
    createdAt: "2024-08-26T09:30:00Z",
    settledAt: "2024-08-27T10:00:00Z",
    manifestDate: "2024-08-26",
    deliveryDate: "2024-08-28",
  },
  {
    id: "8",
    outlet: "RG ENTERPRISES",
    refNo: "2508041430228765",
    awbNumber: "25095210215678",
    receiver: "Rajesh Kumar",
    courier: "Delhivery",
    weight: 28.75,
    amount: 8200.0,
    status: "settled",
    createdAt: "2024-08-25T14:30:00Z",
    settledAt: "2024-08-26T11:15:00Z",
    manifestDate: "2024-08-25",
    deliveryDate: "2024-08-27",
  },
];

// Mock retailers for filter dropdown
export const mockRetailers = [
  "RG ENTERPRISES",
  "ABC TRADERS",
  "XYZ COMMERCE",
  "PQR STORES",
  "LMN BUSINESS",
];

// Remittance utility functions
export function getRemittanceStatusColor(status: Remittance["status"]): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "settled":
      return "bg-green-100 text-green-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function formatWeight(weight: number): string {
  return `${weight.toFixed(2)}KG`;
}

export function formatAmount(amount: number): string {
  return `₹ ${amount.toFixed(2)}`;
}

// Outlet interfaces
export interface Outlet {
  id: string;
  outletCode: string;
  outletName: string;
  retailerName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  status: "active" | "inactive" | "suspended" | "pending";
  type: "retail" | "wholesale" | "ecommerce" | "franchise";
  businessHours: string;
  gstNumber?: string;
  panNumber?: string;
  bankDetails?: {
    accountNumber: string;
    ifscCode: string;
    bankName: string;
  };
  performance: {
    totalShipments: number;
    monthlyRevenue: number;
    successRate: number;
    avgDeliveryTime: number;
  };
  createdAt: string;
  lastUpdated: string;
  assignedCouriers: string[];
  serviceAreas: string[];
}

export interface OutletShipment {
  id: string;
  outletId: string;
  outletName: string;
  trackingNumber: string;
  referenceNumber: string;
  customerName: string;
  destination: string;
  status: "pending" | "in_transit" | "delivered" | "cancelled" | "delayed";
  weight: number;
  value: number;
  courierPartner: string;
  createdAt: string;
  estimatedDelivery: string;
  actualDelivery?: string;
}

// Mock outlet data
export const mockOutlets: Outlet[] = [
  {
    id: "outlet-1",
    outletCode: "OUT001",
    outletName: "RG ENTERPRISES - Main Branch",
    retailerName: "RG ENTERPRISES",
    contactPerson: "Rajesh Gupta",
    phone: "+91 98765 43210",
    email: "rajesh@rgenterprises.com",
    address: "123 Main Street, Sector 15",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    status: "active",
    type: "retail",
    businessHours: "9:00 AM - 8:00 PM",
    gstNumber: "27AABFR1234M1Z5",
    panNumber: "AABFR1234M",
    bankDetails: {
      accountNumber: "1234567890",
      ifscCode: "SBIN0001234",
      bankName: "State Bank of India",
    },
    performance: {
      totalShipments: 1247,
      monthlyRevenue: 45780,
      successRate: 94.2,
      avgDeliveryTime: 2.3,
    },
    createdAt: "2024-01-15T10:30:00Z",
    lastUpdated: "2024-08-21T14:20:00Z",
    assignedCouriers: ["Delhivery", "Blue Dart", "DTDC"],
    serviceAreas: ["Mumbai", "Thane", "Navi Mumbai"],
  },
  {
    id: "outlet-2",
    outletCode: "OUT002",
    outletName: "RG ENTERPRISES - Andheri",
    retailerName: "RG ENTERPRISES",
    contactPerson: "Priya Sharma",
    phone: "+91 98765 43211",
    email: "priya@rgenterprises.com",
    address: "456 Andheri West, Near Station",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400058",
    status: "active",
    type: "retail",
    businessHours: "8:30 AM - 7:30 PM",
    gstNumber: "27AABFR1234M1Z6",
    panNumber: "AABFR1234N",
    bankDetails: {
      accountNumber: "0987654321",
      ifscCode: "HDFC0001234",
      bankName: "HDFC Bank",
    },
    performance: {
      totalShipments: 892,
      monthlyRevenue: 32150,
      successRate: 96.8,
      avgDeliveryTime: 2.1,
    },
    createdAt: "2024-02-20T11:15:00Z",
    lastUpdated: "2024-08-21T13:45:00Z",
    assignedCouriers: ["Delhivery", "FedEx", "Aramex"],
    serviceAreas: ["Andheri", "Bandra", "Juhu"],
  },
  {
    id: "outlet-3",
    outletCode: "OUT003",
    outletName: "ABC TRADERS - Central",
    retailerName: "ABC TRADERS",
    contactPerson: "Amit Patel",
    phone: "+91 98765 43212",
    email: "amit@abctraders.com",
    address: "789 Central Plaza, MG Road",
    city: "Delhi",
    state: "Delhi",
    pincode: "110001",
    status: "active",
    type: "wholesale",
    businessHours: "8:00 AM - 9:00 PM",
    gstNumber: "07AABCA1234M1Z7",
    panNumber: "AABCA1234P",
    performance: {
      totalShipments: 1567,
      monthlyRevenue: 67890,
      successRate: 92.5,
      avgDeliveryTime: 2.8,
    },
    createdAt: "2024-01-10T09:45:00Z",
    lastUpdated: "2024-08-21T12:30:00Z",
    assignedCouriers: ["Blue Dart", "DTDC", "UPS"],
    serviceAreas: ["Delhi", "Noida", "Gurgaon"],
  },
  {
    id: "outlet-4",
    outletCode: "OUT004",
    outletName: "XYZ COMMERCE - Online Hub",
    retailerName: "XYZ COMMERCE",
    contactPerson: "Sneha Reddy",
    phone: "+91 98765 43213",
    email: "sneha@xyzcommerce.com",
    address: "321 Tech Park, Electronic City",
    city: "Bangalore",
    state: "Karnataka",
    pincode: "560100",
    status: "active",
    type: "ecommerce",
    businessHours: "24/7",
    gstNumber: "29AABXY1234M1Z8",
    panNumber: "AABXY1234R",
    performance: {
      totalShipments: 2341,
      monthlyRevenue: 89250,
      successRate: 97.1,
      avgDeliveryTime: 1.9,
    },
    createdAt: "2024-03-05T14:20:00Z",
    lastUpdated: "2024-08-21T15:10:00Z",
    assignedCouriers: ["Delhivery", "Blue Dart", "FedEx", "DHL"],
    serviceAreas: ["Bangalore", "Mysore", "Mangalore"],
  },
  {
    id: "outlet-5",
    outletCode: "OUT005",
    outletName: "PQR STORES - Franchise",
    retailerName: "PQR STORES",
    contactPerson: "Kumar Singh",
    phone: "+91 98765 43214",
    email: "kumar@pqrstores.com",
    address: "654 Mall Road, Sector 22",
    city: "Chandigarh",
    state: "Punjab",
    pincode: "160022",
    status: "pending",
    type: "franchise",
    businessHours: "10:00 AM - 6:00 PM",
    gstNumber: "04AABPQ1234M1Z9",
    panNumber: "AABPQ1234S",
    performance: {
      totalShipments: 0,
      monthlyRevenue: 0,
      successRate: 0,
      avgDeliveryTime: 0,
    },
    createdAt: "2024-08-15T16:30:00Z",
    lastUpdated: "2024-08-21T10:45:00Z",
    assignedCouriers: ["Blue Dart", "DTDC"],
    serviceAreas: ["Chandigarh", "Mohali", "Panchkula"],
  },
  {
    id: "outlet-6",
    outletCode: "OUT006",
    outletName: "LMN BUSINESS - Warehouse",
    retailerName: "LMN BUSINESS",
    contactPerson: "Lakshmi Devi",
    phone: "+91 98765 43215",
    email: "lakshmi@lmnbusiness.com",
    address: "987 Industrial Area, Phase 2",
    city: "Chennai",
    state: "Tamil Nadu",
    pincode: "600032",
    status: "inactive",
    type: "wholesale",
    businessHours: "6:00 AM - 4:00 PM",
    gstNumber: "33AABLM1234M1Z0",
    panNumber: "AABLM1234D",
    performance: {
      totalShipments: 445,
      monthlyRevenue: 15670,
      successRate: 89.3,
      avgDeliveryTime: 3.2,
    },
    createdAt: "2024-04-12T08:15:00Z",
    lastUpdated: "2024-08-20T17:20:00Z",
    assignedCouriers: ["DTDC", "Aramex"],
    serviceAreas: ["Chennai", "Vellore", "Salem"],
  },
];

// Mock outlet shipments data
export const mockOutletShipments: OutletShipment[] = [
  {
    id: "os-1",
    outletId: "outlet-1",
    outletName: "RG ENTERPRISES - Main Branch",
    trackingNumber: "LOG2024001",
    referenceNumber: "REF001234",
    customerName: "John Smith",
    destination: "New York, USA",
    status: "in_transit",
    weight: 2.5,
    value: 1200,
    courierPartner: "DHL Express",
    createdAt: "2024-08-15T10:30:00Z",
    estimatedDelivery: "2024-08-20T15:00:00Z",
  },
  {
    id: "os-2",
    outletId: "outlet-1",
    outletName: "RG ENTERPRISES - Main Branch",
    trackingNumber: "LOG2024002",
    referenceNumber: "REF001235",
    customerName: "Sarah Johnson",
    destination: "London, UK",
    status: "delivered",
    weight: 1.2,
    value: 450,
    courierPartner: "FedEx",
    createdAt: "2024-08-14T14:20:00Z",
    estimatedDelivery: "2024-08-18T12:00:00Z",
    actualDelivery: "2024-08-18T11:30:00Z",
  },
  {
    id: "os-3",
    outletId: "outlet-2",
    outletName: "RG ENTERPRISES - Andheri",
    trackingNumber: "LOG2024003",
    referenceNumber: "REF001236",
    customerName: "Mike Chen",
    destination: "Toronto, Canada",
    status: "pending",
    weight: 5.8,
    value: 2800,
    courierPartner: "UPS",
    createdAt: "2024-08-16T09:15:00Z",
    estimatedDelivery: "2024-08-22T10:30:00Z",
  },
  {
    id: "os-4",
    outletId: "outlet-3",
    outletName: "ABC TRADERS - Central",
    trackingNumber: "LOG2024004",
    referenceNumber: "REF001237",
    customerName: "Emma Wilson",
    destination: "Sydney, Australia",
    status: "delayed",
    weight: 0.8,
    value: 85,
    courierPartner: "Aramex",
    createdAt: "2024-08-13T16:45:00Z",
    estimatedDelivery: "2024-08-19T14:20:00Z",
  },
  {
    id: "os-5",
    outletId: "outlet-4",
    outletName: "XYZ COMMERCE - Online Hub",
    trackingNumber: "LOG2024005",
    referenceNumber: "REF001238",
    customerName: "David Brown",
    destination: "Berlin, Germany",
    status: "cancelled",
    weight: 3.2,
    value: 1850,
    courierPartner: "DHL Express",
    createdAt: "2024-08-12T11:30:00Z",
    estimatedDelivery: "2024-08-17T09:00:00Z",
  },
];

// Outlet utility functions
export function getOutletStatusColor(status: Outlet["status"]): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800";
    case "inactive":
      return "bg-gray-100 text-gray-800";
    case "suspended":
      return "bg-red-100 text-red-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getOutletTypeColor(type: Outlet["type"]): string {
  switch (type) {
    case "retail":
      return "bg-blue-100 text-blue-800";
    case "wholesale":
      return "bg-green-100 text-green-800";
    case "ecommerce":
      return "bg-purple-100 text-purple-800";
    case "franchise":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getOutletTypeIcon(type: Outlet["type"]) {
  switch (type) {
    case "retail":
      return "Store";
    case "wholesale":
      return "Warehouse";
    case "ecommerce":
      return "ShoppingCart";
    case "franchise":
      return "Building2";
    default:
      return "Store";
  }
}

// Outlet constants
export const OUTLET_TYPES = [
  { value: "retail", label: "Retail Store" },
  { value: "wholesale", label: "Wholesale" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "franchise", label: "Franchise" },
];

export const OUTLET_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
];

export const COURIER_OPTIONS = [
  "Delhivery",
  "Blue Dart",
  "DTDC",
  "FedEx",
  "DHL Express",
  "UPS",
  "Aramex",
  "Ecom Express",
];
