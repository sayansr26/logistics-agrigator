import { baseApi } from "../baseApi";

// Types for Logistics Service Types (COD, Prepaid, Express, etc.)
export interface Service {
  id: string; // UUID
  name: string; // e.g., "COD", "PREPAID", "EXPRESS"
  displayName: string; // e.g., "Cash on Delivery"
  category: "LOGISTICS" | "PAYMENT" | "LOCATION" | "SPECIAL";
  description?: string;
  isAvailable: boolean;
  baseCharge: string;
  sortOrder: number;
  additionalInfo?: any;
  createdAt: string;
  updatedAt: string;
}

export interface GetServicesParams {
  page?: number;
  limit?: number;
  status?: "ACTIVE" | "INACTIVE" | "ALL";
  category?: "LOGISTICS" | "PAYMENT" | "LOCATION" | "SPECIAL";
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface CreateServiceInput {
  name: string;
  displayName: string;
  category: "LOGISTICS" | "PAYMENT" | "LOCATION" | "SPECIAL";
  description?: string;
  isAvailable?: boolean;
  baseCharge?: string;
  sortOrder?: number;
  additionalInfo?: any;
}

export interface UpdateServiceInput {
  displayName?: string;
  category?: "LOGISTICS" | "PAYMENT" | "LOCATION" | "SPECIAL";
  description?: string;
  isAvailable?: boolean;
  baseCharge?: string;
  sortOrder?: number;
  additionalInfo?: any;
}

// Mock data generator for development - Logistics Service Types
const generateMockServices = (): Service[] => [
  {
    id: 1,
    name: "COD",
    displayName: "Cash on Delivery",
    category: "PAYMENT",
    description: "Cash payment at the time of delivery",
    isAvailable: true,
    baseCharge: "0",
    sortOrder: 1,
    additionalInfo: {
      processingTime: "Same day",
      supportedCouriers: ["all"],
    },
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    name: "PREPAID",
    displayName: "Prepaid Service",
    category: "PAYMENT",
    description: "Payment made in advance before shipment",
    isAvailable: true,
    baseCharge: "0",
    sortOrder: 2,
    additionalInfo: {
      processingTime: "Instant",
      supportedCouriers: ["all"],
    },
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: new Date().toISOString(),
  },
  {
    id: 3,
    name: "EXPRESS",
    displayName: "Express Delivery",
    category: "LOGISTICS",
    description: "Fast delivery service with guaranteed time slots",
    isAvailable: true,
    baseCharge: "50",
    sortOrder: 3,
    additionalInfo: {
      deliveryTime: "Same day or next day",
      cutoffTime: "14:00",
    },
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: new Date().toISOString(),
  },
  {
    id: 4,
    name: "STANDARD",
    displayName: "Standard Delivery",
    category: "LOGISTICS",
    description: "Regular delivery service with standard timing",
    isAvailable: true,
    baseCharge: "0",
    sortOrder: 4,
    additionalInfo: {
      deliveryTime: "3-5 business days",
    },
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: new Date().toISOString(),
  },
  {
    id: 5,
    name: "PICKUP",
    displayName: "Pickup Service",
    category: "LOCATION",
    description: "Package pickup from customer location",
    isAvailable: true,
    baseCharge: "0",
    sortOrder: 5,
    additionalInfo: {
      availableSlots: ["10:00-12:00", "14:00-16:00", "16:00-18:00"],
    },
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: new Date().toISOString(),
  },
];

// API endpoints - Service Types are in partner-service under /api/service-types
// Through API gateway: /api/v1/service-types routes to partner-service /api/service-types

export const serviceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get service types list
    getServices: builder.query<
      { data: Service[]; meta?: any },
      GetServicesParams | void
    >({
      query: (params) => ({
        url: "/api/v1/service-types",
        method: "GET",
        params: params || {},
      }),
      transformResponse: (response: any) => {
        // Backend returns {success, message, data: [...], meta: {...}}
        return {
          data: response.data || [],
          meta: response.meta,
        };
      },
      providesTags: ["Service"],
    }),

    // Get service by ID
    getServiceById: builder.query<{ data: Service }, string>({
      query: (id) => ({
        url: `/api/v1/service-types/${id}`,
        method: "GET",
      }),
      transformResponse: (response: any) => ({
        data: response.data,
      }),
      providesTags: (result, error, id) => [{ type: "Service", id }],
    }),

    // Create service type
    createService: builder.mutation<{ data: Service }, CreateServiceInput>({
      query: (data) => ({
        url: "/api/v1/service-types",
        method: "POST",
        body: data,
      }),
      transformResponse: (response: any) => ({
        data: response.data,
      }),
      invalidatesTags: ["Service"],
    }),

    // Update service type
    updateService: builder.mutation<
      { data: Service },
      { id: string; data: UpdateServiceInput }
    >({
      query: ({ id, data }) => ({
        url: `/api/v1/service-types/${id}`,
        method: "PUT",
        body: data,
      }),
      transformResponse: (response: any) => ({
        data: response.data,
      }),
      invalidatesTags: (result, error, { id }) => [
        "Service",
        { type: "Service", id },
      ],
    }),

    // Delete service type
    deleteService: builder.mutation<{ data: { success: boolean } }, string>({
      query: (id) => ({
        url: `/api/v1/service-types/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Service"],
    }),
  }),
  overrideExisting: false,
});

// Export hooks
export const {
  useGetServicesQuery,
  useGetServiceByIdQuery,
  useCreateServiceMutation,
  useUpdateServiceMutation,
  useDeleteServiceMutation,
} = serviceApi;
