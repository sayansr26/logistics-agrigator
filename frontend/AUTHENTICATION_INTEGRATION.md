# Authentication Integration Guide

This document describes how the frontend authentication system integrates with the backend authentication service.

## Overview

The frontend now integrates with the real authentication API from the backend auth service running at `http://103.17.193.231:3002`. The integration includes:

- **Login functionality** with real API calls
- **User registration** with proper validation
- **JWT token management** with automatic refresh
- **Role-based access control** (RBAC)
- **Protected routes** with authentication guards
- **User profile management**

## API Endpoints Used

Based on the Swagger documentation at `http://103.17.193.231:3002/api-docs/`, the following endpoints are integrated:

### Authentication Endpoints

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user info
- `GET /api/auth/profile` - Get enhanced user profile

### Request/Response Format

The API follows a standard response format:

```typescript
// Success Response
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "client",
      "clientId": "CLIENT_001",
      "permissions": ["own_shipments", "tracking", "wallet_view"]
    },
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token"
  }
}

// Error Response
{
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

## Frontend Components

### 1. API Client (`src/lib/api-client.ts`)

Handles HTTP requests to the backend services with automatic token management.

```typescript
import { apiClient } from "@/lib/api-client";

// Set token for authenticated requests
apiClient.setToken(accessToken);

// Make authenticated requests
const response = await apiClient.post("/api/auth/login", credentials);
```

### 2. Authentication Store (`src/store/auth-store.ts`)

Zustand store managing authentication state and API calls.

```typescript
import { useAuthStore } from "@/store/auth-store";

const { login, register, logout, user, isAuthenticated } = useAuthStore();
```

### 3. Authentication Hook (`src/hooks/useAuth.ts`)

Custom hook providing authentication functionality and user context.

```typescript
import { useAuth } from "@/hooks/useAuth";

const { user, login, isRole, hasPermission, requireAuth } = useAuth();
```

### 4. Protected Route Component (`src/components/auth/ProtectedRoute.tsx`)

Component that ensures users are authenticated before accessing protected pages.

```typescript
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

<ProtectedRoute requiredRole="admin">
  <AdminPanel />
</ProtectedRoute>
```

### 5. User Profile Component (`src/components/auth/UserProfile.tsx`)

Dropdown menu showing user information and logout functionality.

```typescript
import { UserProfile } from "@/components/auth/UserProfile";

<UserProfile />
```

## Usage Examples

### Login Page Integration

```typescript
// src/app/auth/login/page.tsx
const { login, isLoading, error } = useAuth();

async function onSubmit(data: LoginFormValues) {
  try {
    await login(data.email, data.password, data.rememberMe);
    router.push("/dashboard");
  } catch (error) {
    // Error is handled by the auth store
    console.error("Login failed:", error);
  }
}
```

### Registration Page Integration

```typescript
// src/app/auth/register/page.tsx
const { register } = useAuth();

async function onSubmit(data: RegisterFormValues) {
  const userData = {
    email: data.email,
    password: data.password,
    name: `${data.firstName} ${data.lastName}`,
    role: "client",
    clientId: data.companyName.toUpperCase().replace(/\s+/g, "_"),
  };

  await register(userData);
  router.push("/dashboard");
}
```

### Protected Dashboard

```typescript
// src/app/dashboard/page.tsx
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div>Dashboard content for authenticated users</div>
    </ProtectedRoute>
  );
}
```

### Role-Based Access Control

```typescript
// src/app/admin/page.tsx
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function AdminPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <div>Admin-only content</div>
    </ProtectedRoute>
  );
}
```

## Environment Configuration

Create a `.env.local` file in the frontend directory:

```bash
# Copy from env.example
cp env.example .env.local

# Update the API base URL if needed
NEXT_PUBLIC_API_BASE_URL=http://103.17.193.231:3002
```

## User Roles and Permissions

The system supports the following user roles:

- **admin**: Full access to all features
- **finance**: Access to financial operations and reports
- **operations**: Access to shipment and partner management
- **client**: Access to own shipments and basic features
- **support**: Access to support and user management

### Permission Examples

```typescript
const { hasPermission, isRole } = useAuth();

// Check specific permissions
if (hasPermission("wallet_access")) {
  // Show wallet features
}

// Check roles
if (isRole("admin")) {
  // Show admin features
}
```

## Error Handling

The authentication system provides comprehensive error handling:

- **Validation errors** from form inputs
- **API errors** from backend services
- **Network errors** for connection issues
- **Authentication errors** for invalid credentials

Errors are displayed in the UI and logged to the console for debugging.

## Security Features

- **JWT tokens** with automatic refresh
- **Secure token storage** in Zustand persist
- **Automatic logout** on token expiration
- **Role-based access control** (RBAC)
- **Protected routes** with authentication guards
- **Input validation** with Zod schemas

## Testing the Integration

1. **Start the backend services**:

   ```bash
   cd backend
   docker-compose up auth-service
   ```

2. **Start the frontend**:

   ```bash
   cd frontend
   pnpm dev
   ```

3. **Test authentication**:
   - Navigate to `/auth/login`
   - Use demo credentials or register a new account
   - Verify successful login and redirect to dashboard
   - Test logout functionality

4. **Verify API calls**:
   - Check browser Network tab for API requests
   - Verify JWT tokens are stored and sent with requests
   - Test protected routes access

## Troubleshooting

### Common Issues

1. **CORS errors**: Ensure backend CORS is configured for frontend domain
2. **API connection**: Verify backend service is running and accessible
3. **Token storage**: Check browser storage for JWT tokens
4. **Role permissions**: Verify user has required role/permissions

### Debug Mode

Enable debug mode in `.env.local`:

```bash
NEXT_PUBLIC_DEBUG_MODE=true
NEXT_PUBLIC_LOG_LEVEL=debug
```

This will provide additional logging for authentication operations.

## Future Enhancements

- **Two-factor authentication** (2FA) support
- **Social login** integration
- **Password reset** functionality
- **Session management** improvements
- **Multi-tenant** support enhancements
