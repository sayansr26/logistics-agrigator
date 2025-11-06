import { baseApi } from "../baseApi";

/**
 * Geographical Data API Endpoints
 *
 * All geographical endpoints route through API Gateway (port 3001)
 */

// ===========================
// Request/Response Interfaces
// ===========================

interface GeoEntity {
  id: string;
  name: string;
  code?: string;
  type: "state" | "city" | "area" | "pincode";
  parentId?: string;
  isActive: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface CreateGeoEntityRequest {
  name: string;
  code?: string;
  type: "state" | "city" | "area" | "pincode";
  parentId?: string;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

interface UpdateGeoEntityRequest {
  name?: string;
  code?: string;
  type?: "state" | "city" | "area" | "pincode";
  parentId?: string;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

interface GeoEntityResponse {
  status: string;
  message: string;
  data: {
    entity: GeoEntity;
  };
}

interface GeoEntitiesListResponse {
  status: string;
  message: string;
  data: {
    entities: GeoEntity[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

interface State {
  id: string;
  name: string;
  code: string;
  status: boolean; // Backend uses 'status' not 'isActive'
  createdAt: string;
  updatedAt: string;
}

interface StatesResponse {
  status: string;
  data: State[]; // Backend returns array directly
  meta: {
    timestamp: string;
  };
}

interface City {
  id: string;
  name: string;
  stateId: string;
  code: string;
  status: boolean; // Backend uses 'status' not 'isActive'
  state?: {
    id: string;
    name: string;
    code: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface CitiesResponse {
  status: string;
  data: City[]; // Backend returns array directly
  meta: {
    timestamp: string;
    pagination?: {
      page: number;
      limit: number;
    };
  };
}

interface Area {
  id: string;
  name: string;
  cityId: string;
  status: boolean; // Backend uses 'status' not 'isActive'
  city?: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface AreasResponse {
  status: string;
  data: Area[]; // Backend returns array directly
  meta: {
    timestamp: string;
    pagination?: {
      page: number;
      limit: number;
    };
  };
}

interface Pincode {
  id: string;
  code: string; // Backend uses 'code' not 'pincode'
  stateId: string;
  cityId: string;
  areaId?: string;
  status: boolean;
  state?: {
    id: string;
    name: string;
    code: string;
  };
  city?: {
    id: string;
    name: string;
  };
  area?: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface PincodesResponse {
  status: string;
  data: Pincode[]; // Backend returns array directly
  meta: {
    timestamp: string;
    pagination?: {
      page: number;
      limit: number;
    };
  };
}

interface PincodeDetailsResponse {
  status: string;
  message: string;
  data: {
    pincode: Pincode;
    hierarchy: {
      state: State;
      city: City;
      area?: Area;
    };
  };
}

interface SearchGeoRequest {
  query: string;
  type?: "state" | "city" | "area" | "pincode";
  limit?: number;
}

interface SearchGeoResponse {
  status: string;
  message: string;
  data: {
    results: Array<{
      id: string;
      name: string;
      type: string;
      fullPath: string;
      pincode?: string;
    }>;
  };
}

interface HierarchyResponse {
  status: string;
  message: string;
  data: {
    hierarchy: Array<{
      state: State;
      cities: Array<{
        city: City;
        areas: Area[];
        pincodes: Pincode[];
      }>;
    }>;
  };
}

interface GetGeoEntitiesParams {
  page?: number;
  limit?: number;
  type?: "state" | "city" | "area" | "pincode";
  parentId?: string;
  isActive?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface GetCitiesParams {
  stateId?: string;
  page?: number;
  limit?: number;
  search?: string;
}

interface GetAreasParams {
  cityId?: string;
  page?: number;
  limit?: number;
  search?: string;
}

interface GetPincodesParams {
  cityId?: string;
  areaId?: string;
  stateId?: string;
  pincode?: string;
  page?: number;
  limit?: number;
  search?: string;
}

// ===========================
// RTK Query API Definition
// ===========================

export const geoApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Create Geo Entity - Create a new geographical entity
     */
    createGeoEntity: builder.mutation<
      GeoEntityResponse,
      CreateGeoEntityRequest
    >({
      query: (entityData) => ({
        url: "/api/v1/geographical",
        method: "POST",
        body: entityData,
      }),
      invalidatesTags: [{ type: "Geo", id: "LIST" }],
    }),

    /**
     * Get Geo Entities - Fetch list of geographical entities
     */
    getGeoEntities: builder.query<
      GeoEntitiesListResponse,
      GetGeoEntitiesParams | void
    >({
      query: (params = {}) => ({
        url: "/api/v1/geographical",
        params,
      }),
      providesTags: (result) =>
        result?.data?.entities
          ? [
              ...result.data.entities.map(({ id }) => ({
                type: "Geo" as const,
                id,
              })),
              { type: "Geo", id: "LIST" },
            ]
          : [{ type: "Geo", id: "LIST" }],
    }),

    /**
     * Get Geo Entity by ID - Fetch single geographical entity details
     */
    getGeoEntityById: builder.query<GeoEntityResponse, string>({
      query: (entityId) => `/api/v1/geographical/${entityId}`,
      providesTags: (result, error, id) => [{ type: "Geo", id }],
    }),

    /**
     * Update Geo Entity - Update geographical entity information
     */
    updateGeoEntity: builder.mutation<
      GeoEntityResponse,
      { id: string; data: UpdateGeoEntityRequest }
    >({
      query: ({ id, data }) => ({
        url: `/api/v1/geographical/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Geo", id },
        { type: "Geo", id: "LIST" },
      ],
    }),

    /**
     * Delete Geo Entity - Delete a geographical entity
     */
    deleteGeoEntity: builder.mutation<void, string>({
      query: (entityId) => ({
        url: `/api/v1/geographical/${entityId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => [
        { type: "Geo", id },
        { type: "Geo", id: "LIST" },
      ],
    }),

    /**
     * Get States - Fetch all states
     */
    getStates: builder.query<StatesResponse, void>({
      query: () => "/api/v1/geography/states",
      providesTags: [{ type: "Geo", id: "STATES" }],
    }),

    /**
     * Search States - Search states by name or code
     */
    searchStates: builder.query<
      StatesResponse,
      { name?: string; code?: string; page?: number; limit?: number }
    >({
      query: (params) => ({
        url: "/api/v1/geography/states/search",
        params,
      }),
      providesTags: [{ type: "Geo", id: "STATES_SEARCH" }],
    }),

    /**
     * Get Cities - Fetch cities (optionally filtered by state)
     */
    getCities: builder.query<CitiesResponse, GetCitiesParams | void>({
      query: (params = {}) => ({
        url: "/api/v1/geography/cities",
        params,
      }),
      providesTags: [{ type: "Geo", id: "CITIES" }],
    }),

    /**
     * Get Areas - Fetch areas (optionally filtered by city/state)
     */
    getAreas: builder.query<AreasResponse, GetAreasParams | void>({
      query: (params = {}) => ({
        url: "/api/v1/geography/areas",
        params,
      }),
      providesTags: [{ type: "Geo", id: "AREAS" }],
    }),

    /**
     * Get Pincodes - Fetch pincodes with filters
     */
    getPincodes: builder.query<PincodesResponse, GetPincodesParams | void>({
      query: (params = {}) => ({
        url: "/api/v1/geography/pincodes",
        params,
      }),
      providesTags: [{ type: "Geo", id: "PINCODES" }],
    }),

    /**
     * Get Pincode Details - Fetch detailed information for a pincode
     */
    getPincodeDetails: builder.query<PincodeDetailsResponse, string>({
      query: (pincode) => `/api/v1/geography/pincodes/${pincode}`,
      providesTags: (result, error, pincode) => [
        { type: "Geo", id: `PINCODE-${pincode}` },
      ],
    }),

    /**
     * Search Pincodes - Search pincodes with multiple criteria
     */
    searchPincodes: builder.query<
      PincodesResponse,
      { code?: string; city?: string; state?: string; district?: string }
    >({
      query: (params) => ({
        url: "/api/v1/geography/pincodes/search",
        params,
      }),
      providesTags: [{ type: "Geo", id: "PINCODES_SEARCH" }],
    }),

    /**
     * Get Geographical Hierarchy - Get complete hierarchy
     */
    getGeoHierarchy: builder.query<
      HierarchyResponse,
      { stateId?: string; cityId?: string }
    >({
      query: (params) => ({
        url: "/api/v1/geographical/hierarchy",
        params,
      }),
      providesTags: [{ type: "Geo", id: "HIERARCHY" }],
    }),

    /**
     * Toggle State Status - Toggle state active/inactive status
     */
    toggleStateStatus: builder.mutation<
      {
        status: string;
        data: State;
        meta: { timestamp: string; message: string };
      },
      string
    >({
      query: (stateId) => ({
        url: `/api/v1/geography/states/${stateId}/toggle-status`,
        method: "PATCH",
      }),
      invalidatesTags: [{ type: "Geo", id: "STATES" }],
    }),

    /**
     * Toggle City Status - Toggle city active/inactive status
     */
    toggleCityStatus: builder.mutation<
      {
        status: string;
        data: City;
        meta: { timestamp: string; message: string };
      },
      string
    >({
      query: (cityId) => ({
        url: `/api/v1/geography/cities/${cityId}/toggle-status`,
        method: "PATCH",
      }),
      invalidatesTags: [{ type: "Geo", id: "CITIES" }],
    }),

    /**
     * Toggle Area Status - Toggle area active/inactive status
     */
    toggleAreaStatus: builder.mutation<
      {
        status: string;
        data: Area;
        meta: { timestamp: string; message: string };
      },
      string
    >({
      query: (areaId) => ({
        url: `/api/v1/geography/areas/${areaId}/toggle-status`,
        method: "PATCH",
      }),
      invalidatesTags: [{ type: "Geo", id: "AREAS" }],
    }),

    /**
     * Toggle Pincode Status - Toggle pincode active/inactive status
     */
    togglePincodeStatus: builder.mutation<
      {
        status: string;
        data: Pincode;
        meta: { timestamp: string; message: string };
      },
      string
    >({
      query: (pincodeId) => ({
        url: `/api/v1/geography/pincodes/${pincodeId}/toggle-status`,
        method: "PATCH",
      }),
      invalidatesTags: [{ type: "Geo", id: "PINCODES" }],
    }),
  }),
});

// ===========================
// Export Hooks
// ===========================

export const {
  useCreateGeoEntityMutation,
  useGetGeoEntitiesQuery,
  useGetGeoEntityByIdQuery,
  useUpdateGeoEntityMutation,
  useDeleteGeoEntityMutation,
  useGetStatesQuery,
  useGetCitiesQuery,
  useGetAreasQuery,
  useGetPincodesQuery,
  useGetPincodeDetailsQuery,
  useSearchGeoMutation,
  useGetGeoHierarchyQuery,
  useToggleStateStatusMutation,
  useToggleCityStatusMutation,
  useToggleAreaStatusMutation,
  useTogglePincodeStatusMutation,
} = geoApi;

// ===========================
// Export Types
// ===========================

export type {
  GeoEntity,
  CreateGeoEntityRequest,
  UpdateGeoEntityRequest,
  GeoEntityResponse,
  GeoEntitiesListResponse,
  State,
  StatesResponse,
  City,
  CitiesResponse,
  Area,
  AreasResponse,
  Pincode,
  PincodesResponse,
  PincodeDetailsResponse,
  SearchGeoRequest,
  SearchGeoResponse,
  HierarchyResponse,
  GetGeoEntitiesParams,
  GetCitiesParams,
  GetAreasParams,
  GetPincodesParams,
};
