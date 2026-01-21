import { baseApi } from "../baseApi";

// Types for Pincode Types
export interface PincodeType {
  id: string; // UUID
  name: string; // e.g., "Metro", "ODA", "Hill"
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  assignedPincodeCount?: number;
}

export interface PincodeTypeWithStats extends PincodeType {}

export interface GetPincodeTypesParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

// Create input requires pincodeCodes
export interface CreatePincodeTypeInput {
  name: string;
  description?: string;
  isActive?: boolean;
  pincodeCodes: string[]; // Required: at least one pincode
}

// Create response structure
export interface CreatePincodeTypeResult {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  assignedCount: number;
  summary: {
    totalPincodesRequested: number;
    validPincodes: number;
    missingPincodes: string[];
  };
}

export interface UpdatePincodeTypeInput {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface AssignPincodesInput {
  pincodeCodes: string[]; // Array of 6-digit pincode strings
}

export interface PincodeAssignment {
  id: string;
  pincodeId: string;
  typeId: string;
  assignedAt: string;
  assignedBy?: string;
  pincode: {
    id: string;
    code: string;
    name?: string;
    isActive: boolean;
  };
}

// API endpoints for Pincode Types
// Through API gateway: /api/v1/pincode-types routes to partner-service

export const pincodeTypeApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get pincode types list
    getPincodeTypes: builder.query<
      { data: PincodeTypeWithStats[]; meta?: any },
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
    getPincodeTypeById: builder.query<{ data: PincodeTypeWithStats }, string>({
      query: (id) => ({
        url: `/api/v1/pincode-types/${id}`,
        method: "GET",
      }),
      transformResponse: (response: any) => ({
        data: response.data,
      }),
      providesTags: (result, error, id) => [{ type: "PincodeType", id }],
    }),

    // Create pincode type(s) for one or more partners with mandatory pincode assignment
    createPincodeType: builder.mutation<
      { data: CreatePincodeTypeResult },
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

    // Assign pincodes to a type
    assignPincodesToType: builder.mutation<
      { data: { assigned: number; skipped: number; errors: string[] } },
      { id: string; data: AssignPincodesInput }
    >({
      query: ({ id, data }) => ({
        url: `/api/v1/pincode-types/${id}/assign`,
        method: "POST",
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

    // Unassign pincodes from a type
    unassignPincodesFromType: builder.mutation<
      { data: { unassigned: number } },
      { id: string; data: AssignPincodesInput }
    >({
      query: ({ id, data }) => ({
        url: `/api/v1/pincode-types/${id}/unassign`,
        method: "DELETE",
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

    // Get pincodes assigned to a type
    getPincodesByType: builder.query<
      { data: PincodeAssignment[]; meta?: any },
      { id: string; page?: number; limit?: number }
    >({
      query: ({ id, ...params }) => ({
        url: `/api/v1/pincode-types/${id}/pincodes`,
        method: "GET",
        params,
      }),
      transformResponse: (response: any) => ({
        // Backend returns: { data: { pincodes: [...], pagination: {...} } }
        data: response.data?.pincodes || [],
        meta: { pagination: response.data?.pagination },
      }),
      providesTags: (result, error, { id }) => [{ type: "PincodeType", id }],
    }),
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
  useAssignPincodesToTypeMutation,
  useUnassignPincodesFromTypeMutation,
  useGetPincodesByTypeQuery,
} = pincodeTypeApi;
