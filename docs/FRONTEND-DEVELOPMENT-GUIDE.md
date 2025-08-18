# Frontend Development Guide

## 🎯 **Quick Start for Frontend Developers**

### **Your Responsibilities**
- **Next.js 14 Application**: React-based user interface with TypeScript
- **Authentication Integration**: Connect UI to backend auth services
- **Dashboard Development**: Main application interface and navigation
- **Form Development**: User input with validation and error handling
- **State Management**: Global application state with Zustand
- **Responsive Design**: Mobile-first approach with Tailwind CSS

### **What You DON'T Touch**
- ❌ **Backend Services**: Never modify files in `backend/` directory
- ❌ **Database Schemas**: No changes to Prisma schemas or migrations
- ❌ **Docker Services**: Backend service configurations in `docker-compose.yml`
- ❌ **API Endpoints**: Backend route definitions and controllers
- ❌ **Shared Utilities**: Backend-specific utilities in `shared/lib/`

---

## 📂 **Frontend Project Structure**

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router (Your Main Work Area)
│   │   ├── (auth)/            # 🟢 Authentication pages - WORK HERE
│   │   │   ├── login/         # Login form and validation
│   │   │   ├── register/      # Registration workflow
│   │   │   └── forgot-password/ # Password reset flow
│   │   ├── dashboard/         # 🟢 Main application - WORK HERE
│   │   │   ├── page.tsx       # Dashboard homepage
│   │   │   ├── shipments/     # Shipment management UI
│   │   │   ├── clients/       # Client management (Admin/Finance)
│   │   │   └── settings/      # User settings and preferences
│   │   ├── globals.css        # 🟢 Global styles - MODIFY AS NEEDED
│   │   ├── layout.tsx         # 🟢 Root layout - WORK HERE
│   │   └── page.tsx           # 🟢 Landing page - ENHANCE
│   ├── components/            # 🟢 Reusable UI components - WORK HERE
│   │   ├── ui/               # Base UI components
│   │   ├── forms/            # Form components with validation
│   │   ├── layout/           # Layout components (Header, Sidebar)
│   │   └── dashboard/        # Dashboard-specific components
│   ├── lib/                  # 🟢 Frontend utilities - WORK HERE
│   │   ├── api.ts           # API client configuration
│   │   ├── auth.ts          # Authentication utilities
│   │   ├── utils.ts         # General utility functions
│   │   └── validations.ts   # Zod validation schemas
│   ├── store/               # 🟢 Global state management - WORK HERE
│   │   ├── auth.ts         # Authentication state
│   │   ├── user.ts         # User profile state
│   │   └── dashboard.ts    # Dashboard state
│   ├── hooks/               # 🟢 Custom React hooks - WORK HERE
│   │   ├── useAuth.ts      # Authentication hook
│   │   ├── useApi.ts       # API client hook
│   │   └── useLocalStorage.ts # Local storage hook
│   └── types/               # 🟢 TypeScript definitions - WORK HERE
│       ├── auth.ts         # Authentication types
│       ├── user.ts         # User and client types
│       └── api.ts          # API response types
├── public/                  # 🟢 Static assets - ADD ASSETS HERE
│   ├── images/             # Images, logos, icons
│   └── icons/              # Custom icons and graphics
├── package.json            # 🔄 Dependencies (coordinate changes)
├── tailwind.config.js      # 🟢 Tailwind configuration - MODIFY
├── next.config.js          # 🔄 Next.js config (coordinate changes)
└── tsconfig.json           # 🔄 TypeScript config (coordinate changes)
```

**Legend:**
- 🟢 **Work Here**: Your primary development areas
- 🔄 **Coordinate**: Discuss changes with team before modifying
- ❌ **Don't Touch**: Backend-only areas

---

## 🚀 **Development Workflow**

### **1. Environment Setup**
```bash
# Start development environment
docker-compose up

# Your frontend will be available at:
# http://localhost:3000

# API Gateway (for API calls):
# http://localhost:8000
```

### **2. Daily Development Routine**
```bash
# Check service status
curl http://localhost:8000/health

# Start your work in frontend directory
cd frontend/

# Install new dependencies (if needed)
npm install package-name

# Run type checking
npm run type-check

# Run linting
npm run lint

# Run tests
npm test
```

### **3. Hot Reload Development**
- **Frontend Changes**: Automatically reload at http://localhost:3000
- **API Changes**: Backend team handles, you just consume APIs
- **Environment Variables**: Check `.env.example` for required variables

---

## 📚 **Documentation You Need to Read**

### **Essential Reading (Before Starting)**
1. **Memory Bank**: `/memory-bank/README.md` - Project overview
2. **API Documentation**: `/docs/API-Specifications.md` - Available endpoints
3. **Project README**: `/README.md` - Quick start and setup

### **Reference Documentation**
- **User Roles & Permissions**: `/memory-bank/projectbrief.md` (search "User Roles")
- **Frontend Tech Stack**: `/memory-bank/techContext.md` (search "Frontend Technologies")
- **Current Progress**: `/memory-bank/progress.md` (search "Frontend")

### **API Integration Reference**
```javascript
// Base API configuration (already set up)
const API_BASE_URL = 'http://localhost:8000/api/v1';

// Available API endpoints:
POST /auth/register      // User registration
POST /auth/login         // User authentication  
POST /auth/refresh       // Token refresh
GET  /auth/me           // Current user profile
POST /auth/logout       // User logout

// Future endpoints (coming from backend team):
GET  /users/profile     // User profile management
GET  /clients/list      // Client list (Admin/Finance only)
POST /shipments/create  // Create shipment
GET  /shipments/list    // List shipments
```

---

## 🎨 **Design & UI Guidelines**

### **Design System**
- **Colors**: Use Tailwind CSS utility classes
- **Typography**: Defined in `globals.css` and Tailwind config
- **Spacing**: Use Tailwind spacing scale (4, 8, 16, 32px increments)
- **Components**: Build reusable components in `/src/components/ui/`

### **Responsive Design**
```javascript
// Mobile-first approach with Tailwind breakpoints
className="w-full md:w-1/2 lg:w-1/3"

// Breakpoints:
// sm: 640px and up
// md: 768px and up  
// lg: 1024px and up
// xl: 1280px and up
```

### **Component Structure**
```typescript
// Standard component pattern
interface ComponentProps {
  // Define props with TypeScript
}

export default function Component({ prop1, prop2 }: ComponentProps) {
  // Component logic
  
  return (
    <div className="tailwind-classes">
      {/* JSX content */}
    </div>
  );
}
```

---

## 🔐 **Authentication Integration**

### **Current Status** 
- ✅ **Backend Auth Service**: Fully operational with JWT + RBAC
- 🔄 **Frontend Integration**: Your primary task for Week 2

### **Authentication Flow to Implement**
```typescript
// 1. Login Form Component
const LoginForm = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        // Store tokens
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        
        // Update global auth state
        setAuthState(data.data.user);
        
        // Redirect to dashboard
        router.push('/dashboard');
      }
    } catch (error) {
      // Handle error
    }
  };
};
```

### **Global Auth State Management**
```typescript
// src/store/auth.ts - Zustand store
import { create } from 'zustand';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: (user) => set({ user, isAuthenticated: true }),
  logout: () => set({ user: null, isAuthenticated: false })
}));
```

### **Protected Route Pattern**
```typescript
// src/components/ProtectedRoute.tsx
export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  if (requiredRole && user?.role !== requiredRole) {
    return <div>Access Denied</div>;
  }
  
  return <>{children}</>;
}
```

---

## 🎯 **Current Tasks & Priorities**

### **Week 2 Tasks (Your Focus)**

#### **High Priority (Start Here)**
1. **Login/Register Forms**
   - **File**: `/src/app/(auth)/login/page.tsx`
   - **Requirements**: Form validation, error handling, JWT storage
   - **API**: `POST /auth/login`, `POST /auth/register`
   - **Success Criteria**: Successful authentication and token storage

2. **Authentication State Management**
   - **File**: `/src/store/auth.ts`
   - **Requirements**: Zustand store for global auth state
   - **Integration**: Connect with login forms and protected routes
   - **Success Criteria**: Persistent auth state across page refreshes

3. **Dashboard Layout**
   - **File**: `/src/app/dashboard/layout.tsx`
   - **Requirements**: Navigation sidebar, header with user menu
   - **Features**: Role-based navigation, logout functionality
   - **Success Criteria**: Complete dashboard structure with navigation

#### **Medium Priority (After Auth)**
1. **User Profile Management**
   - **File**: `/src/app/dashboard/profile/page.tsx`
   - **Requirements**: Edit profile, change password, view audit logs
   - **API**: `GET /auth/me`, `PUT /users/profile`

2. **Protected Route Implementation**
   - **File**: `/src/components/ProtectedRoute.tsx`
   - **Requirements**: Role-based access control for pages
   - **Integration**: Apply to all dashboard routes

3. **API Client Setup**
   - **File**: `/src/lib/api.ts`
   - **Requirements**: Axios configuration with JWT interceptors
   - **Features**: Auto token refresh, error handling

#### **Low Priority (Future)**
1. **Shipment Management UI** (awaits backend Shipment Service)
2. **Client Management UI** (awaits backend User Service completion)
3. **Platform Integration UI** (awaits backend Platform Service)

### **What to Avoid Until Ready**
- ❌ **Shipment Forms**: Backend Shipment Service not ready
- ❌ **Platform Connections**: Backend Platform Service not ready  
- ❌ **Support Ticketing**: Backend Support Service not ready
- ❌ **Advanced Analytics**: Requires all backend services

---

## 🔧 **Development Tools & Commands**

### **Essential Commands**
```bash
# Development server with hot reload
npm run dev

# Type checking
npm run type-check

# Linting and formatting
npm run lint
npm run lint:fix

# Testing
npm test
npm run test:watch

# Build for production
npm run build
npm start
```

### **Debugging Tools**
- **React DevTools**: Browser extension for component debugging
- **Zustand DevTools**: State management debugging
- **Network Tab**: Monitor API requests and responses
- **Console Logs**: Use sparingly, prefer React DevTools

### **Code Quality Tools**
- **ESLint**: Automatic linting on save
- **Prettier**: Code formatting
- **TypeScript**: Compile-time type checking
- **Husky**: Pre-commit hooks (configured)

---

## 🤝 **Working with Backend Team**

### **Communication Protocol**
1. **API Changes**: Backend team will update API documentation
2. **New Endpoints**: Check `/docs/API-Specifications.md` for updates
3. **Breaking Changes**: Backend team will notify via project updates
4. **Testing**: Use Postman/curl to test endpoints before integration

### **API Integration Pattern**
```typescript
// Standard API call pattern
const apiCall = async (endpoint: string, options?: RequestInit) => {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options?.headers
    }
  });
  
  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }
  
  return response.json();
};
```

### **Error Handling with Backend**
```typescript
// Handle backend error responses
try {
  const data = await apiCall('/auth/login', { 
    method: 'POST', 
    body: JSON.stringify(loginData) 
  });
} catch (error) {
  if (error.response?.status === 401) {
    // Unauthorized - redirect to login
    router.push('/login');
  } else if (error.response?.status === 403) {
    // Forbidden - show access denied
    setError('Access denied');
  } else {
    // Other errors
    setError('Something went wrong');
  }
}
```

---

## 📋 **Testing Guidelines**

### **Testing Strategy**
- **Unit Tests**: Component logic and utility functions
- **Integration Tests**: API integration and form submissions
- **E2E Tests**: Critical user flows (login, dashboard navigation)

### **Testing Tools**
```json
{
  "jest": "Testing framework",
  "@testing-library/react": "Component testing utilities",
  "@testing-library/jest-dom": "DOM testing matchers",
  "msw": "API mocking for tests"
}
```

### **Test Examples**
```typescript
// Component test example
test('renders login form', () => {
  render(<LoginForm />);
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
});

// API integration test
test('handles successful login', async () => {
  // Mock API response
  server.use(
    rest.post('/api/v1/auth/login', (req, res, ctx) => {
      return res(ctx.json({ status: 'success', data: mockUser }));
    })
  );
  
  // Test component behavior
  // ...
});
```

---

## ⚠️ **Common Pitfalls & Solutions**

### **Authentication Issues**
```typescript
// Problem: Token expiry not handled
// Solution: Implement automatic token refresh
const refreshToken = async () => {
  const refresh = localStorage.getItem('refreshToken');
  const response = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${refresh}` }
  });
  
  if (response.ok) {
    const data = await response.json();
    localStorage.setItem('accessToken', data.data.accessToken);
    return data.data.accessToken;
  } else {
    // Refresh failed, redirect to login
    localStorage.clear();
    window.location.href = '/login';
  }
};
```

### **State Management Issues**
```typescript
// Problem: State not persisting across page refreshes
// Solution: Use localStorage with Zustand persist middleware
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false })
    }),
    { name: 'auth-storage' }
  )
);
```

### **API Integration Issues**
```typescript
// Problem: CORS errors in development
// Solution: Use Next.js API routes as proxy
// pages/api/auth/[...slug].ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slug } = req.query;
  const apiUrl = `${API_BASE_URL}/auth/${Array.isArray(slug) ? slug.join('/') : slug}`;
  
  const response = await fetch(apiUrl, {
    method: req.method,
    headers: req.headers,
    body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
  });
  
  const data = await response.json();
  res.status(response.status).json(data);
}
```

---

## 🎯 **Success Criteria for Week 2**

### **Must Complete**
- [ ] **Login Form**: Functional authentication with error handling
- [ ] **Registration Form**: User registration with validation
- [ ] **Auth State Management**: Global authentication state with Zustand
- [ ] **Protected Routes**: Role-based access control implementation
- [ ] **Dashboard Layout**: Basic navigation and user interface

### **Should Complete** 
- [ ] **User Profile**: View and edit profile information
- [ ] **API Client**: Centralized API communication with token management
- [ ] **Error Handling**: Comprehensive error states and user feedback
- [ ] **Responsive Design**: Mobile-friendly interface

### **Nice to Have**
- [ ] **Form Validation**: Advanced validation with Zod schemas
- [ ] **Loading States**: Skeleton screens and loading indicators
- [ ] **Toast Notifications**: User feedback for actions
- [ ] **Dark Mode**: Theme switching capability

---

## 📞 **Getting Help**

### **When You're Stuck**
1. **Check Memory Bank**: `/memory-bank/` for project context
2. **Review API Docs**: `/docs/API-Specifications.md` for endpoints
3. **Test Backend**: Use curl/Postman to verify API functionality
4. **Check Network Tab**: Debug API calls in browser dev tools

### **Escalation Process**
1. **Self-Debug**: Use React DevTools and console logs
2. **Documentation**: Check project docs and memory bank
3. **Team Discussion**: Bring specific questions to team
4. **Code Review**: Submit PR for feedback and guidance

### **Resources**
- **Next.js Docs**: https://nextjs.org/docs
- **React Docs**: https://react.dev
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Zustand**: https://github.com/pmndrs/zustand

---

**Frontend Development Status**: ✅ **Ready for Week 2 Development**  
**Primary Focus**: Authentication Integration & Dashboard Layout  
**Success Target**: Complete user authentication flow with protected routes