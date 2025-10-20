# Frontend Error Handling Guide

## Overview

The frontend application has a comprehensive error handling system that provides:

- **Graceful error recovery** with React ErrorBoundary
- **User-friendly error messages** for all API errors
- **Automatic toast notifications** for API operations
- **Type-safe error parsing** from RTK Query
- **Development-friendly logging**
- **Production-ready error reporting**

## Architecture

### Error Handling Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Error Sources                            │
├─────────────────────────────────────────────────────────────┤
│  1. API Errors (RTK Query)                                  │
│  2. React Component Errors                                  │
│  3. Network/Connection Errors                               │
│  4. Validation Errors                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Error Handlers                             │
├─────────────────────────────────────────────────────────────┤
│  • Error Middleware (RTK Query errors)                      │
│  • Error Boundary (React component errors)                  │
│  • Error Handler Utilities (parsing & mapping)              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   User Feedback                              │
├─────────────────────────────────────────────────────────────┤
│  • Toast Notifications (API errors & success)               │
│  • Error Fallback UI (component errors)                     │
│  • Inline Validation Errors (form fields)                   │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Error Handler Utilities

**File**: `src/utils/errorHandler.ts`

Centralized error parsing and mapping utilities.

#### Key Functions

```typescript
// Parse RTK Query errors
const parsedError = parseRTKError(error);
// Returns: { message: string, code: string, details?: any, statusCode?: number }

// Get user-friendly error message
const message = getErrorMessage(error);

// Check error type
if (isAuthError(error)) {
  /* Handle 401 */
}
if (isAuthorizationError(error)) {
  /* Handle 403 */
}
if (isValidationError(error)) {
  /* Handle 400 */
}
if (isServerError(error)) {
  /* Handle 500+ */
}
if (isNetworkError(error)) {
  /* Handle network errors */
}

// Log errors (dev only)
logError(error, "Component Name");

// Create error report for support
const report = createErrorReport(error, userContext);
```

#### Error Code Mapping

The system maps 30+ backend error codes to user-friendly messages:

| Error Code         | HTTP Status | User Message                                        |
| ------------------ | ----------- | --------------------------------------------------- |
| `NO_TOKEN`         | 401         | "Please log in to continue"                         |
| `INVALID_TOKEN`    | 401         | "Your session has expired. Please log in again"     |
| `FORBIDDEN`        | 403         | "You don't have permission to access this resource" |
| `VALIDATION_ERROR` | 400         | "Please check your input and try again"             |
| `NOT_FOUND`        | 404         | "The requested resource was not found"              |
| `INTERNAL_ERROR`   | 500         | "An unexpected error occurred. Please try again"    |
| `NETWORK_ERROR`    | 0           | "Network error. Please check your connection"       |

### 2. Error Boundary

**File**: `src/components/ErrorBoundary.tsx`

React error boundary to catch component errors.

#### Basic Usage

```tsx
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Wrap your app or specific components
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>;
```

#### Custom Fallback UI

```tsx
<ErrorBoundary
  fallback={(error, resetError) => (
    <div>
      <h1>Custom Error UI</h1>
      <p>{error.message}</p>
      <button onClick={resetError}>Retry</button>
    </div>
  )}
>
  <YourComponent />
</ErrorBoundary>
```

#### Higher-Order Component

```tsx
import { withErrorBoundary } from "@/components/ErrorBoundary";

const SafeComponent = withErrorBoundary(MyComponent);
```

#### Manual Error Throwing

```tsx
import { useErrorHandler } from "@/components/ErrorBoundary";

function MyComponent() {
  const throwError = useErrorHandler();

  const handleClick = () => {
    try {
      // Some operation
    } catch (error) {
      throwError(error);
    }
  };
}
```

### 3. Error Fallback UI

**File**: `src/components/ErrorFallback.tsx`

User-friendly error display components.

#### Full Page Error

```tsx
import { ErrorFallback } from "@/components/ErrorFallback";

<ErrorFallback
  error={error}
  resetError={() => {
    // Reset error state
  }}
/>;
```

Features:

- Error message display
- Stack trace (development only)
- Support information
- "Try Again" button
- "Return to Dashboard" button

#### Minimal Inline Error

```tsx
import { MinimalErrorFallback } from "@/components/ErrorFallback";

<MinimalErrorFallback error={error} resetError={resetError} />;
```

### 4. Error Middleware

**File**: `src/store/middleware/errorMiddleware.ts`

Redux middleware to intercept RTK Query errors.

#### Features

- **Automatic Toast Notifications**: Shows error toasts for all API errors
- **401 Handling**: Clears auth state and redirects to login
- **403 Handling**: Shows permission denied notification
- **500+ Handling**: Shows server error and logs for monitoring
- **Network Error Handling**: Shows connection error

#### Configuration

Already configured in `src/store/index.ts`:

```typescript
middleware: (getDefaultMiddleware) =>
  getDefaultMiddleware()
    .concat(baseApi.middleware)
    .concat(errorMiddleware)
    .concat(successMiddleware);
```

### 5. Toast Notifications

**File**: `src/components/ui/toast.tsx`

Toast notification system for user feedback.

#### Usage with Hook

```tsx
import { useToast } from "@/components/ui/toast";

function MyComponent() {
  const toast = useToast();

  const handleSuccess = () => {
    toast.success("Operation completed successfully");
  };

  const handleError = () => {
    toast.error("Something went wrong");
  };

  const handleWarning = () => {
    toast.warning("Please review your input");
  };

  const handleInfo = () => {
    toast.info("Processing your request");
  };
}
```

#### Toast Types

1. **Success** (green): Operation completed successfully
2. **Error** (red): Operation failed
3. **Warning** (yellow): Caution or review needed
4. **Info** (blue): Informational messages

#### Auto-Dismiss

Toasts automatically dismiss after a duration:

- Success: 4000ms (4 seconds)
- Error: 6000ms (6 seconds)
- Warning: 5000ms (5 seconds)
- Info: 4000ms (4 seconds)

Users can also manually close toasts with the X button.

## Usage Examples

### Example 1: API Error Handling (Automatic)

```tsx
import { useCreateShipmentMutation } from "@/store/api/endpoints/shipmentApi";

function CreateShipment() {
  const [createShipment, { isLoading, error }] = useCreateShipmentMutation();

  const handleSubmit = async (data) => {
    try {
      await createShipment(data).unwrap();
      // Success toast shown automatically by successMiddleware
    } catch (err) {
      // Error toast shown automatically by errorMiddleware
      // No need to manually handle toast
      console.log("Mutation failed", err);
    }
  };

  // Error is also available for inline display
  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      {error && <div className="text-red-500">{getErrorMessage(error)}</div>}
      <button disabled={isLoading}>Submit</button>
    </form>
  );
}
```

### Example 2: Manual Toast Notifications

```tsx
import { useToast } from "@/components/ui/toast";

function FileUpload() {
  const toast = useToast();

  const handleUpload = async (file) => {
    if (file.size > 5000000) {
      toast.warning("File size exceeds 5MB limit");
      return;
    }

    try {
      await uploadFile(file);
      toast.success("File uploaded successfully");
    } catch (error) {
      toast.error("File upload failed. Please try again");
    }
  };
}
```

### Example 3: Component Error Boundary

```tsx
import { ErrorBoundary } from "@/components/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Send to error tracking service
        console.error("Error caught:", error);
      }}
    >
      <Dashboard />
    </ErrorBoundary>
  );
}
```

### Example 4: Handling Validation Errors

```tsx
import { useCreateUserMutation } from "@/store/api/endpoints/userApi";
import { formatValidationErrors } from "@/utils/errorHandler";

function CreateUser() {
  const [createUser, { error }] = useCreateUserMutation();

  const handleSubmit = async (data) => {
    try {
      await createUser(data).unwrap();
    } catch (err) {
      // Error middleware shows toast, but we can also display inline
    }
  };

  // Display validation errors inline
  const validationErrors =
    error && isValidationError(error)
      ? formatValidationErrors(parseRTKError(error).details)
      : [];

  return (
    <form onSubmit={handleSubmit}>
      {validationErrors.map((msg, i) => (
        <div key={i} className="text-red-500 text-sm">
          {msg}
        </div>
      ))}
      {/* Form fields */}
    </form>
  );
}
```

## Error Scenarios

### Scenario 1: Session Expired (401)

**User Action**: Tries to access protected resource

**System Response**:

1. Error middleware intercepts 401 error
2. Shows toast: "Your session has expired. Please log in again"
3. Clears auth tokens from localStorage
4. Redirects to `/auth/login?expired=true`

### Scenario 2: Permission Denied (403)

**User Action**: Tries to access restricted feature

**System Response**:

1. Error middleware intercepts 403 error
2. Shows toast: "You don't have permission to access this resource"
3. User stays on current page
4. Can contact admin for access

### Scenario 3: Server Error (500)

**User Action**: Submits a form

**System Response**:

1. Error middleware intercepts 500 error
2. Shows toast: "An unexpected error occurred. Please try again"
3. Logs error to console (dev) or monitoring service (prod)
4. Form remains filled for retry

### Scenario 4: Network Error

**User Action**: Makes API request while offline

**System Response**:

1. Error middleware detects network error
2. Shows toast: "Network error. Please check your connection"
3. User can retry when connection is restored

### Scenario 5: Component Crash

**User Action**: Renders component with runtime error

**System Response**:

1. ErrorBoundary catches error
2. Shows ErrorFallback UI with:
   - User-friendly message
   - Stack trace (dev only)
   - "Try Again" button to reset
   - "Return to Dashboard" button
3. Logs error to console

## Best Practices

### DO ✅

1. **Let the middleware handle common errors**
   - 401, 403, 500 errors are handled automatically
   - No need to manually show toasts for these

2. **Use inline validation errors for forms**
   - Show field-specific errors next to inputs
   - Use `formatValidationErrors()` for backend validation

3. **Log errors in development**
   - Use `logError(error, "ComponentName")` for debugging

4. **Wrap risky components with ErrorBoundary**
   - Third-party integrations
   - Complex visualizations
   - Experimental features

5. **Provide context in error reports**
   - Include user context when creating error reports
   - Help support team diagnose issues

### DON'T ❌

1. **Don't show multiple toasts for the same error**
   - Middleware already shows toast for API errors
   - Avoid duplicate notifications

2. **Don't show technical error messages to users**
   - Always map to user-friendly messages
   - Save technical details for logs

3. **Don't ignore errors silently**
   - Always provide user feedback
   - At minimum, log the error

4. **Don't block user interaction on non-critical errors**
   - Show error notification
   - Allow user to continue or retry

5. **Don't use ErrorBoundary for data fetching errors**
   - Use RTK Query error handling instead
   - ErrorBoundary is for component rendering errors

## Testing

### Manual Testing Checklist

- [ ] **401 Error**: Delete auth token, make API call
  - ✅ Should show "Session expired" toast
  - ✅ Should redirect to login

- [ ] **403 Error**: Call endpoint without permission
  - ✅ Should show "Permission denied" toast
  - ✅ Should stay on current page

- [ ] **500 Error**: Trigger server error
  - ✅ Should show "Unexpected error" toast
  - ✅ Should log error

- [ ] **Network Error**: Disconnect and make API call
  - ✅ Should show "Network error" toast

- [ ] **Validation Error**: Submit invalid form data
  - ✅ Should show inline field errors
  - ✅ Should not show toast (400 errors)

- [ ] **Component Error**: Throw error in component
  - ✅ Should show ErrorFallback UI
  - ✅ Should have "Try Again" button
  - ✅ Should have "Return to Dashboard" button

- [ ] **Success Notification**: Create/update entity
  - ✅ Should show success toast
  - ✅ Should auto-dismiss after 4 seconds

- [ ] **Toast Manual Close**: Click X button
  - ✅ Should immediately dismiss toast

### Automated Testing

```typescript
// Example test for error handling
import { renderHook } from "@testing-library/react";
import { useToast } from "@/components/ui/toast";

describe("Toast Notifications", () => {
  it("should show success toast", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.success("Test success");
    });

    expect(screen.getByText("Test success")).toBeInTheDocument();
  });
});
```

## Integration with Error Monitoring

For production deployments, integrate with error monitoring services:

### Sentry Integration (Example)

```typescript
// src/utils/errorReporting.ts
import * as Sentry from "@sentry/nextjs";

export function reportError(error: any, context?: any) {
  if (process.env.NODE_ENV === "production") {
    Sentry.captureException(error, {
      extra: context,
    });
  }
}

// Update ErrorBoundary.tsx
componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
  // ... existing code ...
  reportError(error, { componentStack: errorInfo.componentStack });
}
```

## Troubleshooting

### Issue: Toasts not appearing

**Solution**: Ensure `<ToastContainer />` is in your layout

```tsx
// src/app/layout.tsx
<ReduxProvider>
  <ErrorBoundary>
    {children}
    <ToastContainer /> {/* Required */}
  </ErrorBoundary>
</ReduxProvider>
```

### Issue: ErrorBoundary not catching errors

**Solution**: ErrorBoundary only catches rendering errors, not:

- Event handlers (use try-catch)
- Async code (use try-catch or RTK Query)
- Server-side rendering errors

### Issue: Error messages not user-friendly

**Solution**: Add custom error code mapping in `errorHandler.ts`

```typescript
const ERROR_MESSAGES: Record<string, string> = {
  // Add your custom error codes
  CUSTOM_ERROR_CODE: "User-friendly message",
};
```

## Summary

The error handling system provides:

✅ **Comprehensive coverage**: API errors, component errors, network errors
✅ **User-friendly**: Clear messages, helpful actions
✅ **Developer-friendly**: Detailed logging, stack traces in dev
✅ **Production-ready**: Error reporting, monitoring integration
✅ **Type-safe**: Full TypeScript support
✅ **Automatic**: Most errors handled without manual code

For questions or issues, contact the development team.
