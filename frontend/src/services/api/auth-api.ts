import { BaseApiService } from "./base-api";
import { API_ENDPOINTS } from "@/constants/api";
import {
  LoginCredentials,
  RegisterData,
  AuthResponse,
  UserProfileResponse,
  LogoutResponse,
} from "@/types/auth";

export class AuthApiService extends BaseApiService {
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

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return this.post<AuthResponse>(API_ENDPOINTS.AUTH.LOGIN, credentials);
  }

  async register(userData: RegisterData): Promise<AuthResponse> {
    return this.post<AuthResponse>(API_ENDPOINTS.AUTH.REGISTER, userData);
  }

  async logout(
    accessToken?: string,
    refreshToken?: string,
  ): Promise<LogoutResponse> {
    const headers = this.getAuthHeaders();

    return this.post<LogoutResponse>(
      API_ENDPOINTS.AUTH.LOGOUT,
      { accessToken, refreshToken },
      { headers },
    );
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    return this.post<AuthResponse>(API_ENDPOINTS.AUTH.REFRESH, {
      refreshToken,
    });
  }

  async getCurrentUser(): Promise<UserProfileResponse> {
    return this.get<UserProfileResponse>(API_ENDPOINTS.AUTH.ME);
  }

  async getUserProfile(): Promise<UserProfileResponse> {
    return this.get<UserProfileResponse>(API_ENDPOINTS.AUTH.PROFILE);
  }

  async updateUserProfile(
    profileId: string,
    updateData: any,
  ): Promise<UserProfileResponse> {
    return this.put<UserProfileResponse>(
      `${API_ENDPOINTS.USERS.BASE}/profiles/${profileId}`,
      updateData,
    );
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
