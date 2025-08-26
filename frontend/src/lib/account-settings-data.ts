// Account Settings Mock Data

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatar?: string;
  company: string;
  position: string;
  department: string;
  timezone: string;
  language: string;
  dateFormat: string;
  currency: string;
  lastLogin: string;
  accountCreated: string;
}

export interface NotificationPreferences {
  id: string;
  email: {
    enabled: boolean;
    types: {
      shipmentUpdates: boolean;
      billingNotifications: boolean;
      systemAlerts: boolean;
      marketingEmails: boolean;
    };
  };
  sms: {
    enabled: boolean;
    types: {
      shipmentUpdates: boolean;
      deliveryAlerts: boolean;
      urgentNotifications: boolean;
    };
  };
  push: {
    enabled: boolean;
    types: {
      shipmentUpdates: boolean;
      orderConfirmations: boolean;
      deliveryReminders: boolean;
      systemMaintenance: boolean;
    };
  };
  inApp: {
    enabled: boolean;
    types: {
      allNotifications: boolean;
      priorityOnly: boolean;
      summaryDigest: boolean;
    };
  };
}

export interface SecuritySettings {
  id: string;
  twoFactorEnabled: boolean;
  twoFactorMethod: "sms" | "email" | "authenticator" | "none";
  loginHistory: LoginAttempt[];
  activeSessions: ActiveSession[];
  passwordLastChanged: string;
  securityQuestions: SecurityQuestion[];
  apiKeys: ApiKey[];
}

export interface LoginAttempt {
  id: string;
  timestamp: string;
  ipAddress: string;
  location: string;
  device: string;
  browser: string;
  status: "success" | "failed" | "blocked";
  userAgent: string;
}

export interface ActiveSession {
  id: string;
  device: string;
  browser: string;
  location: string;
  ipAddress: string;
  lastActivity: string;
  isCurrent: boolean;
}

export interface SecurityQuestion {
  id: string;
  question: string;
  answer: string;
  isSet: boolean;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  lastUsed: string;
  createdAt: string;
  isActive: boolean;
}

export interface BillingSettings {
  id: string;
  billingAddress: Address;
  paymentMethods: PaymentMethod[];
  autoRecharge: {
    enabled: boolean;
    threshold: number;
    amount: number;
    paymentMethod: string;
  };
  invoicePreferences: {
    frequency: "monthly" | "quarterly" | "annually";
    format: "pdf" | "email" | "both";
    includeDetails: boolean;
  };
  taxSettings: {
    gstNumber: string;
    panNumber: string;
    taxExempt: boolean;
  };
}

export interface Address {
  street: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
}

export interface PaymentMethod {
  id: string;
  type: "credit_card" | "debit_card" | "net_banking" | "upi" | "wallet";
  name: string;
  maskedNumber: string;
  expiryDate?: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface IntegrationSettings {
  id: string;
  shopify: {
    enabled: boolean;
    storeUrl: string;
    apiKey: string;
    webhookUrl: string;
    lastSync: string;
    autoSync: boolean;
  };
  woocommerce: {
    enabled: boolean;
    storeUrl: string;
    apiKey: string;
    webhookUrl: string;
    lastSync: string;
    autoSync: boolean;
  };
  customApi: {
    enabled: boolean;
    endpoint: string;
    apiKey: string;
    webhookUrl: string;
    lastSync: string;
  };
}

export interface DataExportSettings {
  id: string;
  exportHistory: ExportRecord[];
  scheduledExports: ScheduledExport[];
  dataRetention: {
    shipments: number; // days
    orders: number;
    invoices: number;
    logs: number;
  };
}

export interface ExportRecord {
  id: string;
  type: "shipments" | "orders" | "invoices" | "reports";
  format: "csv" | "excel" | "json" | "pdf";
  status: "completed" | "processing" | "failed";
  createdAt: string;
  completedAt?: string;
  downloadUrl?: string;
  recordCount: number;
}

export interface ScheduledExport {
  id: string;
  name: string;
  type: "shipments" | "orders" | "invoices" | "reports";
  format: "csv" | "excel" | "json" | "pdf";
  frequency: "daily" | "weekly" | "monthly";
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time: string; // HH:MM format
  recipients: string[];
  isActive: boolean;
  lastRun?: string;
  nextRun: string;
}

// Mock data for account settings
export const mockUserProfile: UserProfile = {
  id: "user-1",
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@techcorp.com",
  phone: "+91 98765 43210",
  avatar:
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&auto=format",
  company: "TechCorp Solutions",
  position: "Senior Logistics Manager",
  department: "Operations",
  timezone: "Asia/Kolkata",
  language: "English",
  dateFormat: "DD/MM/YYYY",
  currency: "INR",
  lastLogin: "2024-08-21T10:30:00Z",
  accountCreated: "2023-01-15T09:00:00Z",
};

export const mockNotificationPreferences: NotificationPreferences = {
  id: "notif-1",
  email: {
    enabled: true,
    types: {
      shipmentUpdates: true,
      billingNotifications: true,
      systemAlerts: true,
      marketingEmails: false,
    },
  },
  sms: {
    enabled: true,
    types: {
      shipmentUpdates: true,
      deliveryAlerts: true,
      urgentNotifications: true,
    },
  },
  push: {
    enabled: true,
    types: {
      shipmentUpdates: true,
      orderConfirmations: true,
      deliveryReminders: true,
      systemMaintenance: true,
    },
  },
  inApp: {
    enabled: true,
    types: {
      allNotifications: true,
      priorityOnly: false,
      summaryDigest: true,
    },
  },
};

export const mockSecuritySettings: SecuritySettings = {
  id: "security-1",
  twoFactorEnabled: true,
  twoFactorMethod: "authenticator",
  passwordLastChanged: "2024-07-15T14:30:00Z",
  loginHistory: [
    {
      id: "login-1",
      timestamp: "2024-08-21T10:30:00Z",
      ipAddress: "192.168.1.100",
      location: "Mumbai, India",
      device: "MacBook Pro",
      browser: "Chrome 120.0",
      status: "success",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
    {
      id: "login-2",
      timestamp: "2024-08-20T15:45:00Z",
      ipAddress: "192.168.1.100",
      location: "Mumbai, India",
      device: "iPhone 15",
      browser: "Safari Mobile",
      status: "success",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    },
    {
      id: "login-3",
      timestamp: "2024-08-19T09:15:00Z",
      ipAddress: "203.45.67.89",
      location: "Delhi, India",
      device: "Windows PC",
      browser: "Edge 120.0",
      status: "failed",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  ],
  activeSessions: [
    {
      id: "session-1",
      device: "MacBook Pro",
      browser: "Chrome 120.0",
      location: "Mumbai, India",
      ipAddress: "192.168.1.100",
      lastActivity: "2024-08-21T10:30:00Z",
      isCurrent: true,
    },
    {
      id: "session-2",
      device: "iPhone 15",
      browser: "Safari Mobile",
      location: "Mumbai, India",
      ipAddress: "192.168.1.100",
      lastActivity: "2024-08-20T15:45:00Z",
      isCurrent: false,
    },
  ],
  securityQuestions: [
    {
      id: "q1",
      question: "What was your first pet's name?",
      answer: "Buddy",
      isSet: true,
    },
    {
      id: "q2",
      question: "In which city were you born?",
      answer: "Mumbai",
      isSet: true,
    },
    {
      id: "q3",
      question: "What was your mother's maiden name?",
      answer: "Smith",
      isSet: false,
    },
  ],
  apiKeys: [
    {
      id: "api-1",
      name: "Production API Key",
      key: "sk_live_1234567890abcdef",
      permissions: ["read:shipments", "write:shipments", "read:reports"],
      lastUsed: "2024-08-21T08:15:00Z",
      createdAt: "2024-01-15T10:00:00Z",
      isActive: true,
    },
    {
      id: "api-2",
      name: "Development API Key",
      key: "sk_test_9876543210fedcba",
      permissions: ["read:shipments"],
      lastUsed: "2024-08-18T14:30:00Z",
      createdAt: "2024-03-20T11:00:00Z",
      isActive: true,
    },
  ],
};

export const mockBillingSettings: BillingSettings = {
  id: "billing-1",
  billingAddress: {
    street: "123 Tech Park, Andheri West",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400058",
    country: "India",
    isDefault: true,
  },
  paymentMethods: [
    {
      id: "pm-1",
      type: "credit_card",
      name: "HDFC Credit Card",
      maskedNumber: "**** **** **** 1234",
      expiryDate: "12/26",
      isDefault: true,
      isActive: true,
    },
    {
      id: "pm-2",
      type: "debit_card",
      name: "SBI Debit Card",
      maskedNumber: "**** **** **** 5678",
      expiryDate: "08/25",
      isDefault: false,
      isActive: true,
    },
    {
      id: "pm-3",
      type: "upi",
      name: "UPI ID",
      maskedNumber: "john.doe@hdfc",
      isDefault: false,
      isActive: true,
    },
  ],
  autoRecharge: {
    enabled: true,
    threshold: 1000,
    amount: 5000,
    paymentMethod: "pm-1",
  },
  invoicePreferences: {
    frequency: "monthly",
    format: "both",
    includeDetails: true,
  },
  taxSettings: {
    gstNumber: "27AAACJ1234K1Z5",
    panNumber: "AAACJ1234K",
    taxExempt: false,
  },
};

export const mockIntegrationSettings: IntegrationSettings = {
  id: "integration-1",
  shopify: {
    enabled: true,
    storeUrl: "techcorp.myshopify.com",
    apiKey: "shp_1234567890abcdef",
    webhookUrl: "https://api.logistics.com/webhooks/shopify",
    lastSync: "2024-08-21T10:30:00Z",
    autoSync: true,
  },
  woocommerce: {
    enabled: false,
    storeUrl: "",
    apiKey: "",
    webhookUrl: "",
    lastSync: "",
    autoSync: false,
  },
  customApi: {
    enabled: true,
    endpoint: "https://api.techcorp.com/logistics",
    apiKey: "custom_1234567890abcdef",
    webhookUrl: "https://api.logistics.com/webhooks/custom",
    lastSync: "2024-08-20T16:45:00Z",
  },
};

export const mockDataExportSettings: DataExportSettings = {
  id: "export-1",
  exportHistory: [
    {
      id: "exp-1",
      type: "shipments",
      format: "excel",
      status: "completed",
      createdAt: "2024-08-20T14:00:00Z",
      completedAt: "2024-08-20T14:05:00Z",
      downloadUrl: "/downloads/shipments_20240820.xlsx",
      recordCount: 1247,
    },
    {
      id: "exp-2",
      type: "reports",
      format: "pdf",
      status: "completed",
      createdAt: "2024-08-19T09:00:00Z",
      completedAt: "2024-08-19T09:02:00Z",
      downloadUrl: "/downloads/monthly_report_202408.pdf",
      recordCount: 1,
    },
    {
      id: "exp-3",
      type: "orders",
      format: "csv",
      status: "processing",
      createdAt: "2024-08-21T11:00:00Z",
      recordCount: 892,
    },
  ],
  scheduledExports: [
    {
      id: "sched-1",
      name: "Weekly Shipment Report",
      type: "shipments",
      format: "excel",
      frequency: "weekly",
      dayOfWeek: 1, // Monday
      time: "09:00",
      recipients: ["john.doe@techcorp.com", "ops@techcorp.com"],
      isActive: true,
      lastRun: "2024-08-19T09:00:00Z",
      nextRun: "2024-08-26T09:00:00Z",
    },
    {
      id: "sched-2",
      name: "Monthly Invoice Summary",
      type: "invoices",
      format: "pdf",
      frequency: "monthly",
      dayOfMonth: 1,
      time: "08:00",
      recipients: ["finance@techcorp.com"],
      isActive: true,
      lastRun: "2024-08-01T08:00:00Z",
      nextRun: "2024-09-01T08:00:00Z",
    },
  ],
  dataRetention: {
    shipments: 1095, // 3 years
    orders: 1095,
    invoices: 1825, // 5 years
    logs: 365, // 1 year
  },
};

// Utility functions for account settings
export function getTwoFactorMethodLabel(method: string): string {
  switch (method) {
    case "sms":
      return "SMS";
    case "email":
      return "Email";
    case "authenticator":
      return "Authenticator App";
    case "none":
      return "Disabled";
    default:
      return "Unknown";
  }
}

export function getTwoFactorMethodIcon(method: string): string {
  switch (method) {
    case "sms":
      return "📱";
    case "email":
      return "📧";
    case "authenticator":
      return "🔐";
    case "none":
      return "❌";
    default:
      return "❓";
  }
}

export function getLoginStatusColor(status: string): string {
  switch (status) {
    case "success":
      return "bg-green-100 text-green-800";
    case "failed":
      return "bg-red-100 text-red-800";
    case "blocked":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getPaymentMethodIcon(type: string): string {
  switch (type) {
    case "credit_card":
      return "💳";
    case "debit_card":
      return "💳";
    case "net_banking":
      return "🏦";
    case "upi":
      return "📱";
    case "wallet":
      return "👛";
    default:
      return "💰";
  }
}

export function getExportStatusColor(status: string): string {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800";
    case "processing":
      return "bg-blue-100 text-blue-800";
    case "failed":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function getIntegrationStatusColor(enabled: boolean): string {
  return enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800";
}

export function getIntegrationStatusIcon(enabled: boolean): string {
  return enabled ? "✅" : "❌";
}
