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

export function getRoleColor(role: User["role"]): string {
  switch (role) {
    case "admin":
      return "bg-purple-100 text-purple-800";
    case "client":
      return "bg-blue-100 text-blue-800";
    case "operations":
      return "bg-green-100 text-green-800";
    case "support":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getUserStatusColor(status: User["status"]): string {
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
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
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
