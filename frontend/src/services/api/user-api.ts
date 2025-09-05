import { BaseApiService } from "./base-api";
import { API_ENDPOINTS } from "@/constants/api";

export interface UserProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  companyName?: string;
  designation?: string;
  department?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  billingAddress?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  preferences?: Record<string, any>;
  timezone?: string;
  language: string;
  clientId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileResponse {
  status: "success" | "error";
  data?: {
    profile: UserProfile;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  companyName?: string;
  designation?: string;
  department?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  billingAddress?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  preferences?: Record<string, any>;
  timezone?: string;
  language?: string;
}

export class UserApiService extends BaseApiService {
  private accessToken: string | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  async getMyProfile(): Promise<UserProfileResponse> {
    return this.get<UserProfileResponse>(`${API_ENDPOINTS.USERS.PROFILE}/me`);
  }

  async getProfile(profileId: string): Promise<UserProfileResponse> {
    return this.get<UserProfileResponse>(
      `${API_ENDPOINTS.USERS.PROFILE}/${profileId}`,
    );
  }

  async updateProfile(
    profileId: string,
    updateData: UpdateProfileData,
  ): Promise<UserProfileResponse> {
    return this.put<UserProfileResponse>(
      `${API_ENDPOINTS.USERS.PROFILE}/${profileId}`,
      updateData,
    );
  }

  async createProfile(
    profileData: Omit<UserProfile, "id" | "createdAt" | "updatedAt">,
  ): Promise<UserProfileResponse> {
    return this.post<UserProfileResponse>(
      `${API_ENDPOINTS.USERS.PROFILE}`,
      profileData,
    );
  }

  async deleteProfile(
    profileId: string,
  ): Promise<{
    status: "success" | "error";
    data?: { message: string };
    error?: { code: string; message: string };
  }> {
    return this.delete(`${API_ENDPOINTS.USERS.PROFILE}/${profileId}`);
  }

  // Override the request method to include auth headers
  protected async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const authHeaders = this.getAuthHeaders();

    return super.request<T>(endpoint, {
      ...options,
      headers: {
        ...authHeaders,
        ...options.headers,
      },
    });
  }
}
