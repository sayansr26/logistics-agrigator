# Services Architecture

This document describes the new service layer architecture that provides proper separation of concerns between UI components and business logic.

## 🏗️ **Architecture Overview**

```
frontend/src/
├── services/           # Service layer (API calls, business logic)
│   ├── api/           # API services
│   │   ├── base-api.ts        # Base API service class
│   │   ├── auth-api.ts        # Authentication API service
│   │   └── index.ts           # Service exports
│   └── index.ts       # Main services index
├── types/             # TypeScript type definitions
│   └── auth.ts        # Authentication types
├── constants/         # Configuration constants
│   └── api.ts         # API configuration
├── store/             # State management (Zustand)
├── hooks/             # Custom React hooks
└── components/        # UI components
```

## 🔧 **Service Layer Structure**

### **1. Base API Service (`services/api/base-api.ts`)**

The foundation class that handles common HTTP operations:

- **HTTP Methods**: GET, POST, PUT, DELETE, PATCH
- **Error Handling**: Standardized error responses
- **Timeout Management**: Configurable request timeouts
- **Request Abortion**: AbortController for request cancellation

```typescript
import { BaseApiService } from "@/services/api/base-api";

export class CustomApiService extends BaseApiService {
  // Inherit all HTTP methods and error handling
  async getData() {
    return this.get<DataResponse>("/api/endpoint");
  }
}
```

### **2. Specialized API Services (`services/api/auth-api.ts`)**

Service-specific classes that extend BaseApiService:

- **Authentication**: Token management
- **Headers**: Automatic auth header injection
- **Business Logic**: Service-specific operations

```typescript
import { AuthApiService } from "@/services/api/auth-api";

const authService = new AuthApiService();
await authService.login(credentials);
```

### **3. Service Index (`services/index.ts`)**

Centralized export of all services and instances:

```typescript
import { authApiService } from "@/services";

// Use the service instance directly
await authApiService.login(credentials);
```

## 📝 **Type Definitions (`types/`)**

Centralized TypeScript interfaces for type safety:

```typescript
import { User, LoginCredentials } from "@/types/auth";

interface LoginFormProps {
  onSubmit: (credentials: LoginCredentials) => Promise<void>;
}
```

## ⚙️ **Constants (`constants/`)**

Configuration and endpoint constants:

```typescript
import { API_ENDPOINTS, API_CONFIG } from "@/constants/api";

// Use constants instead of hardcoded strings
const response = await fetch(API_ENDPOINTS.AUTH.LOGIN);
```

## 🔄 **Data Flow**

```
UI Component → Hook → Store → Service → API
     ↑                                    ↓
     ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
```

### **Example Flow:**

1. **Component**: User clicks login button
2. **Hook**: `useAuth().login()` is called
3. **Store**: `authStore.login()` updates state
4. **Service**: `authApiService.login()` makes API call
5. **API**: Backend responds with user data
6. **Service**: Processes response
7. **Store**: Updates authentication state
8. **Hook**: Component re-renders with new state

## 🚀 **Benefits of New Architecture**

### **1. Separation of Concerns**

- **UI Components**: Only handle presentation and user interaction
- **Services**: Handle API calls and business logic
- **Store**: Manages application state
- **Types**: Ensures type safety across the application

### **2. Maintainability**

- **Single Responsibility**: Each service has one purpose
- **Easy Testing**: Services can be tested independently
- **Code Reusability**: Services can be used across components

### **3. Scalability**

- **Easy to Add**: New services follow the same pattern
- **Consistent Interface**: All services have the same base methods
- **Error Handling**: Centralized error management

### **4. Type Safety**

- **TypeScript Interfaces**: Clear contracts between layers
- **Compile-time Checks**: Catch errors before runtime
- **IntelliSense**: Better developer experience

## 📋 **Creating New Services**

### **Step 1: Define Types**

```typescript
// types/shipment.ts
export interface Shipment {
  id: string;
  trackingNumber: string;
  status: string;
  // ... other properties
}
```

### **Step 2: Create Service Class**

```typescript
// services/api/shipment-api.ts
import { BaseApiService } from "./base-api";
import { API_ENDPOINTS } from "@/constants/api";
import { Shipment } from "@/types/shipment";

export class ShipmentApiService extends BaseApiService {
  async getShipments(): Promise<Shipment[]> {
    return this.get<Shipment[]>(API_ENDPOINTS.SHIPMENTS.BASE);
  }

  async createShipment(data: Partial<Shipment>): Promise<Shipment> {
    return this.post<Shipment>(API_ENDPOINTS.SHIPMENTS.CREATE, data);
  }
}
```

### **Step 3: Export Service**

```typescript
// services/index.ts
export { ShipmentApiService } from "./api/shipment-api";
export const shipmentApiService = new ShipmentApiService();
```

### **Step 4: Use in Store**

```typescript
// store/shipment-store.ts
import { shipmentApiService } from "@/services";

export const useShipmentStore = create((set) => ({
  shipments: [],
  fetchShipments: async () => {
    const data = await shipmentApiService.getShipments();
    set({ shipments: data });
  },
}));
```

## 🧪 **Testing Services**

### **Unit Testing Services**

```typescript
// __tests__/services/auth-api.test.ts
import { AuthApiService } from "@/services/api/auth-api";

describe("AuthApiService", () => {
  let authService: AuthApiService;

  beforeEach(() => {
    authService = new AuthApiService();
  });

  it("should login user with valid credentials", async () => {
    const credentials = { email: "test@example.com", password: "password" };
    const result = await authService.login(credentials);
    expect(result.status).toBe("success");
  });
});
```

### **Mocking Services**

```typescript
// __mocks__/services/auth-api.ts
export const mockAuthApiService = {
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
};
```

## 🔒 **Security Features**

### **1. Token Management**

- **Automatic Injection**: Auth headers added automatically
- **Token Refresh**: Automatic token renewal
- **Secure Storage**: Tokens stored in Zustand persist

### **2. Error Handling**

- **HTTP Status Codes**: Proper error categorization
- **User-Friendly Messages**: Clear error messages for users
- **Logging**: Error logging for debugging

### **3. Request Validation**

- **Input Validation**: Zod schemas for form validation
- **Type Safety**: TypeScript interfaces for API contracts
- **Response Validation**: Runtime validation of API responses

## 📱 **Usage Examples**

### **In Components**

```typescript
// components/LoginForm.tsx
import { useAuth } from "@/hooks/useAuth";

export function LoginForm() {
  const { login, isLoading, error } = useAuth();

  const handleSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password, data.rememberMe);
      // Redirect on success
    } catch (error) {
      // Error handled by store
    }
  };
}
```

### **In Hooks**

```typescript
// hooks/useShipments.ts
import { useShipmentStore } from "@/store/shipment-store";

export function useShipments() {
  const { shipments, fetchShipments } = useShipmentStore();

  useEffect(() => {
    fetchShipments();
  }, []);

  return { shipments, refetch: fetchShipments };
}
```

### **In Stores**

```typescript
// store/auth-store.ts
import { authApiService } from "@/services";

export const useAuthStore = create((set) => ({
  login: async (credentials) => {
    const response = await authApiService.login(credentials);
    // Handle response and update state
  },
}));
```

## 🎯 **Best Practices**

### **1. Service Design**

- ✅ Extend BaseApiService for new services
- ✅ Use constants for endpoints and configuration
- ✅ Implement proper error handling
- ✅ Add TypeScript interfaces for all data

### **2. State Management**

- ✅ Keep services stateless
- ✅ Use stores for application state
- ✅ Implement proper loading states
- ✅ Handle errors gracefully

### **3. Component Usage**

- ✅ Use hooks to access services
- ✅ Don't call services directly in components
- ✅ Implement proper loading and error states
- ✅ Use TypeScript for all props and state

### **4. Testing**

- ✅ Test services independently
- ✅ Mock services in component tests
- ✅ Test error scenarios
- ✅ Validate type safety

This architecture provides a clean, maintainable, and scalable foundation for your frontend application while maintaining proper separation of concerns and type safety.
