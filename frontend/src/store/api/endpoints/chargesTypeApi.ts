import { baseApi } from "../baseApi";

// Types for Charges Types (Partner-specific)
export interface ChargesType {
  id: string; // UUID
  partnerId: string; // CUID
  name: string; // e.g., "COD Charge", "Freight"
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  partner?: {
    id: string;
    name: string;
    displayName?: string;
    code: string;
  };
}

export interface GetChargesTypesParams {
  page?: number;
  limit?: number;
  partnerId?: string; // Filter by partner
  search?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface CreateChargesTypeInput {
  partnerId: string; // Required - partner CUID
  name: string; // Required - charge type name
  isActive?: boolean;
}

export interface UpdateChargesTypeInput {
  name?: string;
  isActive?: boolean;
}

// API endpoints for Charges Types
// Through API gateway: /api/v1/charges-types routes to partner-service

export const chargesTypeApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get charges types list
    getChargesTypes: builder.query<
      { data: ChargesType[]; meta?: any },
      GetChargesTypesParams | void
    >({
      query: (params) => ({
        url: "/api/v1/charges-types",
        method: "GET",
        params: params || {},
      }),
      transformResponse: (response: any) => {
        // Backend returns: { status, data: { chargesTypes: [...], pagination: {...} } }
        return {
          data: response.data?.chargesTypes || [],
          meta: { pagination: response.data?.pagination },
        };
      },
      providesTags: ["ChargesType"],
    }),

    // Get charges type by ID
    getChargesTypeById: builder.query<{ data: ChargesType }, string>({
      query: (id) => ({
        url: `/api/v1/charges-types/${id}`,
        method: "GET",
      }),
      transformResponse: (response: any) => ({
        data: response.data,
      }),
      providesTags: (result, error, id) => [{ type: "ChargesType", id }],
    }),

    // Create charges type
    createChargesType: builder.mutation<
      { data: ChargesType },
      CreateChargesTypeInput
    >({
      query: (data) => ({
        url: "/api/v1/charges-types",
        method: "POST",
        body: data,
      }),
      transformResponse: (response: any) => ({
        data: response.data,
      }),
      invalidatesTags: ["ChargesType"],
    }),

    // Update charges type
    updateChargesType: builder.mutation<
      { data: ChargesType },
      { id: string; data: UpdateChargesTypeInput }
    >({
      query: ({ id, data }) => ({
        url: `/api/v1/charges-types/${id}`,
        method: "PUT",
        body: data,
      }),
      transformResponse: (response: any) => ({
        data: response.data,
      }),
      invalidatesTags: (result, error, { id }) => [
        "ChargesType",
        { type: "ChargesType", id },
      ],
    }),

    // Delete (soft delete) charges type
    deleteChargesType: builder.mutation<{ data: { success: boolean } }, string>(
      {
        query: (id) => ({
          url: `/api/v1/charges-types/${id}`,
          method: "DELETE",
        }),
        invalidatesTags: ["ChargesType"],
      },
    ),
  }),
  overrideExisting: false,
});

// Export hooks
export const {
  useGetChargesTypesQuery,
  useGetChargesTypeByIdQuery,
  useCreateChargesTypeMutation,
  useUpdateChargesTypeMutation,
  useDeleteChargesTypeMutation,
} = chargesTypeApi;
