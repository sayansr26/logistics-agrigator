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
  isActive: boolean;
}

interface StatesResponse {
  status: string;
  message: string;
  data: {
    states: State[];
  };
}

interface City {
  id: string;
  name: string;
  stateId: string;
  stateName?: string;
  isActive: boolean;
}

interface CitiesResponse {
  status: string;
  message: string;
  data: {
    cities: City[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
    };
  };
}

interface Area {
  id: string;
  name: string;
  cityId: string;
  cityName?: string;
  isActive: boolean;
}

interface AreasResponse {
  status: string;
  message: string;
  data: {
    areas: Area[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
    };
  };
}

interface Pincode {
  id: string;
  pincode: string;
  areaId?: string;
  areaName?: string;
  cityId: string;
  cityName: string;
  stateId: string;
  stateName: string;
  isActive: boolean;
}

interface PincodesResponse {
  status: string;
  message: string;
  data: {
    pincodes: Pincode[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
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
      query: () => "/api/v1/geographical/states",
      providesTags: [{ type: "Geo", id: "STATES" }],
    }),

    /**
     * Get Cities - Fetch cities (optionally filtered by state)
     */
    getCities: builder.query<CitiesResponse, GetCitiesParams | void>({
      query: (params = {}) => ({
        url: "/api/v1/geographical/cities",
        params,
      }),
      providesTags: [{ type: "Geo", id: "CITIES" }],
    }),

    /**
     * Get Areas - Fetch areas (optionally filtered by city)
     */
    getAreas: builder.query<AreasResponse, GetAreasParams | void>({
      query: (params = {}) => ({
        url: "/api/v1/geographical/areas",
        params,
      }),
      providesTags: [{ type: "Geo", id: "AREAS" }],
    }),

    /**
     * Get Pincodes - Fetch pincodes with filters
     */
    getPincodes: builder.query<PincodesResponse, GetPincodesParams | void>({
      query: (params = {}) => ({
        url: "/api/v1/geographical/pincodes",
        params,
      }),
      providesTags: [{ type: "Geo", id: "PINCODES" }],
    }),

    /**
     * Get Pincode Details - Fetch detailed information for a pincode
     */
    getPincodeDetails: builder.query<PincodeDetailsResponse, string>({
      query: (pincode) => `/api/v1/geographical/pincodes/${pincode}`,
      providesTags: (result, error, pincode) => [
        { type: "Geo", id: `PINCODE-${pincode}` },
      ],
    }),

    /**
     * Search Geographical Data - Search across all geographical entities
     */
    searchGeo: builder.mutation<SearchGeoResponse, SearchGeoRequest>({
      query: (searchData) => ({
        url: "/api/v1/geographical/search",
        method: "POST",
        body: searchData,
      }),
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
