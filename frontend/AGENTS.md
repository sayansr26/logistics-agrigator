# Frontend AGENTS.md

## Frontend Development Guide

### Technology Stack

- **Next.js 14** with App Router
- **TypeScript** strict mode
- **Tailwind CSS** for styling
- **Shadcn/ui** component library
- **Zustand** for state management
- **React Hook Form** for form handling

### Development Commands

```bash
# Frontend development
cd frontend
pnpm install
pnpm run dev          # Start development server
pnpm run build        # Production build
pnpm run lint         # ESLint checking
pnpm run type-check   # TypeScript validation
```

### Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── auth/              # Authentication pages
│   │   ├── dashboard/         # Main dashboard
│   │   ├── shipments/         # Shipment management
│   │   ├── orders/            # Order management
│   │   ├── support/           # Support system
│   │   └── wallet/            # Wallet management
│   ├── components/            # Reusable components
│   │   ├── ui/               # Shadcn/ui components
│   │   ├── layout/           # Layout components
│   │   └── shipments/        # Feature-specific components
│   ├── lib/                  # Utilities and configurations
│   │   ├── utils.ts          # Utility functions
│   │   └── validations/      # Form validation schemas
│   └── store/                # Zustand state management
└── components.json           # Shadcn/ui configuration
```

### Code Style Guidelines

#### TypeScript Standards

```typescript
// Use strict TypeScript
interface User {
  id: string;
  email: string;
  role: "admin" | "client" | "operations";
}

// Prefer type inference where possible
const users = await fetchUsers(); // Type inferred

// Use proper error handling
try {
  const result = await apiCall();
  return result;
} catch (error) {
  console.error("API call failed:", error);
  throw error;
}
```

#### Component Patterns

```tsx
// Use functional components with TypeScript
interface Props {
  title: string;
  onSubmit: (data: FormData) => void;
}

export function MyComponent({ title, onSubmit }: Props) {
  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold">{title}</h1>
    </div>
  );
}
```

#### Styling with Tailwind

```tsx
// Use Tailwind utility classes
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm">
  <h2 className="text-lg font-medium text-gray-900">Title</h2>
  <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
    Action
  </button>
</div>
```

### State Management with Zustand

```typescript
// Store definition
interface ShipmentStore {
  shipments: Shipment[];
  loading: boolean;
  fetchShipments: () => Promise<void>;
  createShipment: (data: CreateShipmentData) => Promise<void>;
}

export const useShipmentStore = create<ShipmentStore>((set, get) => ({
  shipments: [],
  loading: false,
  fetchShipments: async () => {
    set({ loading: true });
    try {
      const shipments = await api.getShipments();
      set({ shipments, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },
  createShipment: async (data) => {
    const shipment = await api.createShipment(data);
    set((state) => ({
      shipments: [...state.shipments, shipment],
    }));
  },
}));
```

### API Integration

#### API Client Setup

```typescript
// lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

class ApiClient {
  private async request<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  async getShipments(): Promise<Shipment[]> {
    return this.request<Shipment[]>("/api/v1/shipments");
  }
}

export const api = new ApiClient();
```

### Form Handling

```tsx
// Use React Hook Form with TypeScript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const shipmentSchema = z.object({
  fromAddress: z.string().min(1, "From address is required"),
  toAddress: z.string().min(1, "To address is required"),
  weight: z.number().min(0.1, "Weight must be at least 0.1 kg"),
});

type ShipmentFormData = z.infer<typeof shipmentSchema>;

export function ShipmentForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ShipmentFormData>({
    resolver: zodResolver(shipmentSchema),
  });

  const onSubmit = async (data: ShipmentFormData) => {
    try {
      await api.createShipment(data);
      // Handle success
    } catch (error) {
      // Handle error
    }
  };

  return <form onSubmit={handleSubmit(onSubmit)}>{/* Form fields */}</form>;
}
```

### Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### Component Testing

```typescript
// __tests__/components/Button.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });
});
```

### Environment Configuration

```bash
# .env.local (development)
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_ENV=development

# .env.production (production)
NEXT_PUBLIC_API_URL=https://api.logistics.com
NEXT_PUBLIC_APP_ENV=production
```

### Build and Deployment

```bash
# Development build
pnpm run dev

# Production build
pnpm run build
pnpm run start

# Static export (if needed)
pnpm run export
```

### Performance Optimization

#### Image Optimization

```tsx
import Image from "next/image";

<Image
  src="/logo.png"
  alt="Company Logo"
  width={200}
  height={100}
  priority // For above-the-fold images
/>;
```

#### Code Splitting

```tsx
// Dynamic imports for large components
import dynamic from "next/dynamic";

const HeavyComponent = dynamic(() => import("./HeavyComponent"), {
  loading: () => <div>Loading...</div>,
});
```

### Accessibility Guidelines

- Use semantic HTML elements
- Provide proper ARIA labels
- Ensure keyboard navigation works
- Maintain color contrast ratios
- Test with screen readers

### Available UI Components

See `AVAILABLE-COMPONENTS.md` for detailed component documentation and usage examples.

### Navigation Structure

See `NAVIGATION-STRUCTURE.md` for the complete application navigation hierarchy and routing patterns.
