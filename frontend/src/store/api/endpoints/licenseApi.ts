import { baseApi } from "../baseApi";

/**
 * License Management API Endpoints
 *
 * All license endpoints route through API Gateway (port 3001)
 */

interface License {
  id: string;
  licenseKey: string;
  type: string;
  status: string;
  expiresAt: string;
  clientId?: string;
  createdAt: string;
}

interface LicensesListResponse {
  status: string;
  message: string;
  data: {
    licenses: License[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
    };
  };
}

export const licenseApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Get Licenses - Fetch list of available licenses
     */
    getLicenses: builder.query<
      LicensesListResponse,
      { page?: number; limit?: number; status?: string } | void
    >({
      query: (params = {}) => ({
        url: "/api/v1/licenses",
        params,
      }),
      providesTags: ["License"],
    }),
  }),
});

export const { useGetLicensesQuery } = licenseApi;

export type { License, LicensesListResponse };
