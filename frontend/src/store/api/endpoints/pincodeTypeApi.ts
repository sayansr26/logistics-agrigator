import { baseApi } from "../baseApi";

// Types for Pincode Types (Simplified)
export interface PincodeType {
  id: string; // UUID
  name: string; // e.g., "COD", "Max Weight"
  type: "yes_no" | "number"; // Type classification
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GetPincodeTypesParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export interface CreatePincodeTypeInput {
  name: string;
  type: "yes_no" | "number";
  isActive?: boolean;
}

export interface UpdatePincodeTypeInput {
  name?: string;
  type?: "yes_no" | "number";
  isActive?: boolean;
}

// API endpoints for Pincode Types
// Through API gateway: /api/v1/pincode-types routes to partner-service

export const pincodeTypeApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get pincode types list
    getPincodeTypes: builder.query<
      { data: PincodeType[]; meta?: any },
      GetPincodeTypesParams | void
    >({
      query: (params) => ({
        url: "/api/v1/pincode-types",
        method: "GET",
        params: params || {},
      }),
      transformResponse: (response: any) => {
        // Backend returns: { status, data: { pincodeTypes: [...], pagination: {...} } }
        return {
          data: response.data?.pincodeTypes || [],
          meta: { pagination: response.data?.pagination },
        };
      },
      providesTags: ["PincodeType"],
    }),

    // Get pincode type by ID
    getPincodeTypeById: builder.query<{ data: PincodeType }, string>({
      query: (id) => ({
        url: `/api/v1/pincode-types/${id}`,
        method: "GET",
      }),
      transformResponse: (response: any) => ({
        data: response.data,
      }),
      providesTags: (result, error, id) => [{ type: "PincodeType", id }],
    }),

    // Create pincode type
    createPincodeType: builder.mutation<
      { data: PincodeType },
      CreatePincodeTypeInput
    >({
      query: (data) => ({
        url: "/api/v1/pincode-types",
        method: "POST",
        body: data,
      }),
      transformResponse: (response: any) => ({
        data: response.data,
      }),
      invalidatesTags: ["PincodeType"],
    }),

    // Update pincode type
    updatePincodeType: builder.mutation<
      { data: PincodeType },
      { id: string; data: UpdatePincodeTypeInput }
    >({
      query: ({ id, data }) => ({
        url: `/api/v1/pincode-types/${id}`,
        method: "PUT",
        body: data,
      }),
      transformResponse: (response: any) => ({
        data: response.data,
      }),
      invalidatesTags: (result, error, { id }) => [
        "PincodeType",
        { type: "PincodeType", id },
      ],
    }),

    // Delete (soft delete) pincode type
    deletePincodeType: builder.mutation<{ data: { success: boolean } }, string>(
      {
        query: (id) => ({
          url: `/api/v1/pincode-types/${id}`,
          method: "DELETE",
        }),
        invalidatesTags: ["PincodeType"],
      },
    ),
  }),
  overrideExisting: false,
});

// Export hooks
export const {
  useGetPincodeTypesQuery,
  useGetPincodeTypeByIdQuery,
  useCreatePincodeTypeMutation,
  useUpdatePincodeTypeMutation,
  useDeletePincodeTypeMutation,
} = pincodeTypeApi;
