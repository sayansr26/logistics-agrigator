import { baseApi } from "../baseApi";

// Types
export interface Service {
  id: string;
  name: string;
  displayName: string;
  status: "running" | "stopped" | "degraded" | "maintenance";
  port: number;
  version: string;
  uptime?: number;
  healthEndpoint?: string;
  description?: string;
  configuration?: ServiceConfiguration;
  statistics?: ServiceStatistics;
  lastHealthCheck?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceConfiguration {
  environment: string;
  features: {
    caching: boolean;
    rateLimiting: boolean;
    monitoring: boolean;
    webhooks: boolean;
  };
  limits: {
    maxRequestsPerMinute: number;
    maxConnections: number;
    timeout: number;
  };
  dependencies: string[];
}

export interface ServiceStatistics {
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
  errorRate: number;
  uptime: number;
  memory: {
    used: string;
    limit: string;
    percentage: string;
  };
  cpu: {
    usage: number;
    cores: number;
  };
}

export interface ServiceHealth {
  status: "healthy" | "degraded" | "unhealthy";
  components: {
    database: string;
    redis: string;
    externalAPI: string;
  };
  lastCheck: string;
  uptime: number;
  memory: any;
}

export interface GetServicesParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface CreateServiceInput {
  name: string;
  displayName: string;
  port: number;
  version: string;
  healthEndpoint: string;
  description?: string;
  configuration?: Partial<ServiceConfiguration>;
}

export interface UpdateServiceInput {
  displayName?: string;
  port?: number;
  version?: string;
  healthEndpoint?: string;
  description?: string;
  configuration?: Partial<ServiceConfiguration>;
  isActive?: boolean;
}

// Mock data generator for development
const generateMockServices = (): Service[] => [
  {
    id: "srv_1",
    name: "api-gateway",
    displayName: "API Gateway",
    status: "running",
    port: 3001,
    version: "1.2.0",
    uptime: 86400,
    healthEndpoint: "/health",
    description: "Central API gateway for routing and authentication",
    isActive: true,
    configuration: {
      environment: "development",
      features: {
        caching: true,
        rateLimiting: true,
        monitoring: true,
        webhooks: false,
      },
      limits: {
        maxRequestsPerMinute: 1000,
        maxConnections: 500,
        timeout: 30000,
      },
      dependencies: [],
    },
    statistics: {
      totalRequests: 15420,
      successRate: 99.2,
      averageResponseTime: 45,
      errorRate: 0.8,
      uptime: 86400,
      memory: {
        used: "125MB",
        limit: "512MB",
        percentage: "24.4%",
      },
      cpu: {
        usage: 12.5,
        cores: 2,
      },
    },
    lastHealthCheck: new Date().toISOString(),
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "srv_2",
    name: "auth-service",
    displayName: "Authentication Service",
    status: "running",
    port: 3002,
    version: "2.0.1",
    uptime: 86400,
    healthEndpoint: "/health",
    description: "JWT authentication and user management",
    isActive: true,
    configuration: {
      environment: "development",
      features: {
        caching: true,
        rateLimiting: true,
        monitoring: true,
        webhooks: true,
      },
      limits: {
        maxRequestsPerMinute: 500,
        maxConnections: 200,
        timeout: 10000,
      },
      dependencies: ["redis", "postgresql"],
    },
    statistics: {
      totalRequests: 8234,
      successRate: 99.8,
      averageResponseTime: 23,
      errorRate: 0.2,
      uptime: 86400,
      memory: {
        used: "89MB",
        limit: "256MB",
        percentage: "34.8%",
      },
      cpu: {
        usage: 8.2,
        cores: 1,
      },
    },
    lastHealthCheck: new Date().toISOString(),
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "srv_3",
    name: "shipment-service",
    displayName: "Shipment Management",
    status: "running",
    port: 3004,
    version: "1.5.3",
    uptime: 43200,
    healthEndpoint: "/health",
    description: "Shipment creation, tracking, and management",
    isActive: true,
    configuration: {
      environment: "development",
      features: {
        caching: true,
        rateLimiting: false,
        monitoring: true,
        webhooks: true,
      },
      limits: {
        maxRequestsPerMinute: 800,
        maxConnections: 300,
        timeout: 20000,
      },
      dependencies: ["postgresql", "redis", "partner-service"],
    },
    statistics: {
      totalRequests: 12567,
      successRate: 98.5,
      averageResponseTime: 67,
      errorRate: 1.5,
      uptime: 43200,
      memory: {
        used: "178MB",
        limit: "512MB",
        percentage: "34.8%",
      },
      cpu: {
        usage: 15.3,
        cores: 2,
      },
    },
    lastHealthCheck: new Date().toISOString(),
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "srv_4",
    name: "partner-service",
    displayName: "Partner Integration",
    status: "degraded",
    port: 3005,
    version: "1.3.2",
    uptime: 3600,
    healthEndpoint: "/health",
    description: "Courier partner integration and rate management",
    isActive: true,
    configuration: {
      environment: "development",
      features: {
        caching: true,
        rateLimiting: true,
        monitoring: true,
        webhooks: false,
      },
      limits: {
        maxRequestsPerMinute: 600,
        maxConnections: 250,
        timeout: 15000,
      },
      dependencies: ["postgresql", "external-api"],
    },
    statistics: {
      totalRequests: 5421,
      successRate: 92.3,
      averageResponseTime: 124,
      errorRate: 7.7,
      uptime: 3600,
      memory: {
        used: "201MB",
        limit: "512MB",
        percentage: "39.3%",
      },
      cpu: {
        usage: 22.7,
        cores: 2,
      },
    },
    lastHealthCheck: new Date().toISOString(),
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "srv_5",
    name: "wallet-service",
    displayName: "Wallet & Payments",
    status: "stopped",
    port: 3006,
    version: "1.1.0",
    uptime: 0,
    healthEndpoint: "/health",
    description: "Payment processing and wallet management",
    isActive: false,
    configuration: {
      environment: "development",
      features: {
        caching: false,
        rateLimiting: true,
        monitoring: true,
        webhooks: true,
      },
      limits: {
        maxRequestsPerMinute: 300,
        maxConnections: 150,
        timeout: 10000,
      },
      dependencies: ["postgresql", "redis", "payment-gateway"],
    },
    lastHealthCheck: new Date().toISOString(),
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: new Date().toISOString(),
  },
];

// API endpoints
export const serviceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get services list
    getServices: builder.query<
      { data: { services: Service[]; pagination: any } },
      GetServicesParams | void
    >({
      query: (params) => ({
        url: "/services",
        method: "GET",
        params,
      }),
      // Use mock data for development
      transformResponse: (response: any, meta, arg) => {
        // For development, return mock data
        const mockServices = generateMockServices();
        const { page = 1, limit = 10, search, status } = arg || {};

        let filtered = [...mockServices];

        // Apply filters
        if (search) {
          filtered = filtered.filter(
            (s) =>
              s.name.toLowerCase().includes(search.toLowerCase()) ||
              s.displayName.toLowerCase().includes(search.toLowerCase()),
          );
        }

        if (status && status !== "all") {
          filtered = filtered.filter((s) => s.status === status);
        }

        // Apply pagination
        const start = (page - 1) * limit;
        const paginatedServices = filtered.slice(start, start + limit);

        return {
          data: {
            services: paginatedServices,
            pagination: {
              page,
              limit,
              total: filtered.length,
              totalPages: Math.ceil(filtered.length / limit),
            },
          },
        };
      },
      providesTags: ["Service"],
    }),

    // Get service by ID
    getServiceById: builder.query<{ data: Service }, string>({
      query: (id) => ({
        url: `/services/${id}`,
        method: "GET",
      }),
      // Use mock data for development
      transformResponse: (response: any, meta, id) => {
        const mockServices = generateMockServices();
        const service = mockServices.find((s) => s.id === id);
        if (!service) {
          throw new Error("Service not found");
        }
        return { data: service };
      },
      providesTags: (result, error, id) => [{ type: "Service", id }],
    }),

    // Get service health
    getServiceHealth: builder.query<{ data: ServiceHealth }, string>({
      query: (id) => ({
        url: `/services/${id}/health`,
        method: "GET",
      }),
      // Use mock data for development
      transformResponse: (response: any, meta, id) => {
        return {
          data: {
            status: "healthy",
            components: {
              database: "healthy",
              redis: "healthy",
              externalAPI: "healthy",
            },
            lastCheck: new Date().toISOString(),
            uptime: 86400,
            memory: {
              used: 125829120,
              total: 536870912,
              percentage: 23.4,
            },
          },
        };
      },
      providesTags: (result, error, id) => [{ type: "ServiceHealth", id }],
    }),

    // Get service statistics
    getServiceStatistics: builder.query<{ data: ServiceStatistics }, string>({
      query: (id) => ({
        url: `/services/${id}/statistics`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: "ServiceStatistics", id }],
    }),

    // Create service
    createService: builder.mutation<{ data: Service }, CreateServiceInput>({
      query: (data) => ({
        url: "/services",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Service"],
    }),

    // Update service
    updateService: builder.mutation<
      { data: Service },
      { id: string; data: UpdateServiceInput }
    >({
      query: ({ id, data }) => ({
        url: `/services/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        "Service",
        { type: "Service", id },
      ],
    }),

    // Update service configuration
    updateServiceConfiguration: builder.mutation<
      { data: ServiceConfiguration },
      { id: string; configuration: Partial<ServiceConfiguration> }
    >({
      query: ({ id, configuration }) => ({
        url: `/services/${id}/configuration`,
        method: "PATCH",
        body: configuration,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Service", id },
        { type: "ServiceConfiguration", id },
      ],
    }),

    // Start service
    startService: builder.mutation<{ data: { success: boolean } }, string>({
      query: (id) => ({
        url: `/services/${id}/start`,
        method: "POST",
      }),
      invalidatesTags: (result, error, id) => [
        "Service",
        { type: "Service", id },
      ],
    }),

    // Stop service
    stopService: builder.mutation<{ data: { success: boolean } }, string>({
      query: (id) => ({
        url: `/services/${id}/stop`,
        method: "POST",
      }),
      invalidatesTags: (result, error, id) => [
        "Service",
        { type: "Service", id },
      ],
    }),

    // Restart service
    restartService: builder.mutation<{ data: { success: boolean } }, string>({
      query: (id) => ({
        url: `/services/${id}/restart`,
        method: "POST",
      }),
      invalidatesTags: (result, error, id) => [
        "Service",
        { type: "Service", id },
        { type: "ServiceHealth", id },
      ],
    }),

    // Delete service
    deleteService: builder.mutation<{ data: { success: boolean } }, string>({
      query: (id) => ({
        url: `/services/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Service"],
    }),

    // Perform maintenance
    performMaintenance: builder.mutation<
      { data: { success: boolean } },
      { id: string; type: string }
    >({
      query: ({ id, type }) => ({
        url: `/services/${id}/maintenance`,
        method: "POST",
        body: { type },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Service", id },
        { type: "ServiceHealth", id },
      ],
    }),
  }),
  overrideExisting: false,
});

// Export hooks
export const {
  useGetServicesQuery,
  useGetServiceByIdQuery,
  useGetServiceHealthQuery,
  useGetServiceStatisticsQuery,
  useCreateServiceMutation,
  useUpdateServiceMutation,
  useUpdateServiceConfigurationMutation,
  useStartServiceMutation,
  useStopServiceMutation,
  useRestartServiceMutation,
  useDeleteServiceMutation,
  usePerformMaintenanceMutation,
} = serviceApi;
