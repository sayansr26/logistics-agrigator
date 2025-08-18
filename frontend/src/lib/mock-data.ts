// Mock data for logistics application

export interface Shipment {
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

// Generate mock shipments
export const mockShipments: Shipment[] = [
  {
    id: "1",
    trackingNumber: "LOG2024001",
    senderName: "TechCorp Inc.",
    receiverName: "John Smith",
    origin: "Mumbai, India",
    destination: "New York, USA",
    status: "in_transit",
    priority: "high",
    weight: 2.5,
    value: 1200,
    createdAt: "2024-08-15T10:30:00Z",
    estimatedDelivery: "2024-08-20T15:00:00Z",
    courierPartner: "DHL Express",
  },
  {
    id: "2",
    trackingNumber: "LOG2024002",
    senderName: "Fashion Store",
    receiverName: "Sarah Johnson",
    origin: "Delhi, India",
    destination: "London, UK",
    status: "delivered",
    priority: "medium",
    weight: 1.2,
    value: 450,
    createdAt: "2024-08-14T14:20:00Z",
    estimatedDelivery: "2024-08-18T12:00:00Z",
    courierPartner: "FedEx",
  },
  {
    id: "3",
    trackingNumber: "LOG2024003",
    senderName: "Electronics Hub",
    receiverName: "Mike Chen",
    origin: "Bangalore, India",
    destination: "Toronto, Canada",
    status: "pending",
    priority: "low",
    weight: 5.8,
    value: 2800,
    createdAt: "2024-08-16T09:15:00Z",
    estimatedDelivery: "2024-08-22T10:30:00Z",
    courierPartner: "UPS",
  },
  {
    id: "4",
    trackingNumber: "LOG2024004",
    senderName: "BookWorld",
    receiverName: "Emma Wilson",
    origin: "Chennai, India",
    destination: "Sydney, Australia",
    status: "delayed",
    priority: "medium",
    weight: 0.8,
    value: 85,
    createdAt: "2024-08-13T16:45:00Z",
    estimatedDelivery: "2024-08-19T14:20:00Z",
    courierPartner: "Aramex",
  },
  {
    id: "5",
    trackingNumber: "LOG2024005",
    senderName: "Gadget Store",
    receiverName: "David Brown",
    origin: "Hyderabad, India",
    destination: "Berlin, Germany",
    status: "cancelled",
    priority: "urgent",
    weight: 3.2,
    value: 1850,
    createdAt: "2024-08-12T11:30:00Z",
    estimatedDelivery: "2024-08-17T09:00:00Z",
    courierPartner: "DHL Express",
  },
  {
    id: "6",
    trackingNumber: "LOG2024006",
    senderName: "Artisan Crafts",
    receiverName: "Lisa Garcia",
    origin: "Pune, India",
    destination: "Mexico City, Mexico",
    status: "in_transit",
    priority: "high",
    weight: 1.5,
    value: 650,
    createdAt: "2024-08-16T13:20:00Z",
    estimatedDelivery: "2024-08-21T16:45:00Z",
    courierPartner: "FedEx",
  },
  {
    id: "7",
    trackingNumber: "LOG2024007",
    senderName: "Sports Equipment Co.",
    receiverName: "Tom Anderson",
    origin: "Kolkata, India",
    destination: "Tokyo, Japan",
    status: "delivered",
    priority: "low",
    weight: 4.7,
    value: 980,
    createdAt: "2024-08-11T08:15:00Z",
    estimatedDelivery: "2024-08-16T11:30:00Z",
    courierPartner: "UPS",
  },
  {
    id: "8",
    trackingNumber: "LOG2024008",
    senderName: "Home Decor Ltd.",
    receiverName: "Anna Martinez",
    origin: "Ahmedabad, India",
    destination: "Paris, France",
    status: "pending",
    priority: "medium",
    weight: 2.1,
    value: 320,
    createdAt: "2024-08-17T07:45:00Z",
    estimatedDelivery: "2024-08-23T13:15:00Z",
    courierPartner: "Aramex",
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
    currency: "USD",
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
