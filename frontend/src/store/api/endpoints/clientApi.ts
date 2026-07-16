import { baseApi } from "../baseApi";

/**
 * Client Management API Endpoints
 *
 * All client endpoints route through API Gateway (port 3001)
 */

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  licenseId?: string;
  isActive: boolean;
  createdAt: string;
}

interface ClientsListResponse {
  status: string;
  message: string;
  data: {
    clients: Client[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
    };
  };
}

export const clientApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Get Clients - Fetch list of clients
     */
    getClients: builder.query<
      ClientsListResponse,
      { page?: number; limit?: number; isActive?: boolean } | void
    >({
      query: (arg) => {
        const params: { page?: number; limit?: number; isActive?: boolean } =
          arg || {};
        return {
          url: "/api/v1/clients",
          params,
        };
      },
      providesTags: ["Client"],
    }),
  }),
});

export const { useGetClientsQuery } = clientApi;

export type { Client, ClientsListResponse };
