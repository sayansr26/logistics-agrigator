import { baseApi } from "../baseApi";

// Types for partner pincode assignment
export interface PincodeTypeValue {
  pincodeTypeId: string;
  value: string;
}

export interface PartnerPincodeAssignRequest {
  pincodeId: string;
  pincodeTypeValues?: PincodeTypeValue[];
}

export interface PartnerPincodeUpdateRequest {
  pincodeTypeValues?: PincodeTypeValue[];
  isActive?: boolean;
}

export interface PartnerPincode {
  id: string;
  partnerId: string;
  pincodeId: string;
  pincodeCode: string;
  city: string | null;
  state: string | null;
  typeValues: Record<string, string>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PincodeType {
  id: string;
  name: string;
  type: "yes_no" | "number";
  isActive: boolean;
}

export interface PincodesListResponse {
  pincodes: PartnerPincode[];
  pincodeTypes: PincodeType[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ImportResult {
  partnerId: string;
  partnerName: string;
  imported: Array<{
    row: number;
    pincodeCode: string;
    assignmentId: string;
  }>;
  errors: Array<{
    row: number;
    pincodeCode: string;
    error: string;
  }>;
  summary: {
    total: number;
    imported: number;
    failed: number;
  };
}

// RTK Query API for partner pincodes
export const partnerPincodesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get assigned pincodes for a partner
    getPartnerPincodes: builder.query<
      PincodesListResponse,
      {
        partnerId: string;
        params?: {
          page?: number;
          limit?: number;
          search?: string;
          isActive?: boolean;
          sortBy?: string;
          sortOrder?: string;
        };
      }
    >({
      query: ({ partnerId, params = {} }) => ({
        url: `/api/v1/partners/${partnerId}/pincodes`,
        params,
      }),
      transformResponse: (response: any): PincodesListResponse =>
        response?.data || response,
      providesTags: (result) => [
        { type: "PartnerPincode" as const, id: "LIST" },
        ...(result?.pincodes || []).map((p) => ({
          type: "PartnerPincode" as const,
          id: p.id,
        })),
      ],
    }),

    // Get specific pincode assignment by ID
    getPartnerPincodeById: builder.query<
      PartnerPincode,
      { partnerId: string; assignmentId: string }
    >({
      query: ({ partnerId, assignmentId }) => ({
        url: `/api/v1/partners/${partnerId}/pincodes/${assignmentId}`,
      }),
      providesTags: (_result, _error, { assignmentId }) => [
        { type: "PartnerPincode", id: assignmentId },
      ],
    }),

    // Assign pincode to partner
    assignPartnerPincode: builder.mutation<
      PartnerPincode,
      { partnerId: string; data: PartnerPincodeAssignRequest }
    >({
      query: ({ partnerId, data }) => ({
        url: `/api/v1/partners/${partnerId}/pincodes`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: [{ type: "PartnerPincode", id: "LIST" }],
    }),

    // Update pincode assignment
    updatePartnerPincode: builder.mutation<
      PartnerPincode,
      {
        partnerId: string;
        assignmentId: string;
        data: PartnerPincodeUpdateRequest;
      }
    >({
      query: ({ partnerId, assignmentId, data }) => ({
        url: `/api/v1/partners/${partnerId}/pincodes/${assignmentId}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_result, _error, { assignmentId }) => [
        { type: "PartnerPincode", id: "LIST" },
        { type: "PartnerPincode", id: assignmentId },
      ],
    }),

    // Delete pincode assignment
    deletePartnerPincode: builder.mutation<
      void,
      { partnerId: string; assignmentId: string }
    >({
      query: ({ partnerId, assignmentId }) => ({
        url: `/api/v1/partners/${partnerId}/pincodes/${assignmentId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { assignmentId }) => [
        { type: "PartnerPincode", id: "LIST" },
        { type: "PartnerPincode", id: assignmentId },
      ],
    }),

    // Import pincodes from Excel
    importPartnerPincodes: builder.mutation<
      ImportResult,
      { partnerId: string; file: File }
    >({
      query: ({ partnerId, file }) => {
        const formData = new FormData();
        formData.append("file", file);
        return {
          url: `/api/v1/partners/${partnerId}/pincodes/import`,
          method: "POST",
          body: formData,
        };
      },
      // Extract data from API response { status, data, meta }
      transformResponse: (response: any): ImportResult =>
        response?.data || response,
      invalidatesTags: [{ type: "PartnerPincode", id: "LIST" }],
    }),

    // Export pincodes to Excel
    exportPartnerPincodes: builder.query<
      Blob,
      { partnerId: string; isActive?: boolean }
    >({
      query: ({ partnerId, isActive }) => ({
        url: `/api/v1/partners/${partnerId}/pincodes/export`,
        params: isActive !== undefined ? { isActive } : undefined,
        responseHandler: (response) => response.blob(),
      }),
      // Don't cache Blob to avoid non-serializable value in Redux state
      keepUnusedDataFor: 0,
    }),

    // Download pincode template
    downloadPincodeTemplate: builder.query<Blob, void>({
      query: () => ({
        url: "/api/v1/partners/pincodes/template",
        responseHandler: (response) => response.blob(),
      }),
      // Don't cache Blob to avoid non-serializable value in Redux state
      keepUnusedDataFor: 0,
    }),
  }),
});

// Export hooks
export const {
  useGetPartnerPincodesQuery,
  useLazyGetPartnerPincodesQuery,
  useGetPartnerPincodeByIdQuery,
  useAssignPartnerPincodeMutation,
  useUpdatePartnerPincodeMutation,
  useDeletePartnerPincodeMutation,
  useImportPartnerPincodesMutation,
  useExportPartnerPincodesQuery,
  useLazyExportPartnerPincodesQuery,
  useDownloadPincodeTemplateQuery,
  useLazyDownloadPincodeTemplateQuery,
} = partnerPincodesApi;
