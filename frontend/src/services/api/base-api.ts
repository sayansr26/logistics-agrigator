import { API_CONFIG, HTTP_STATUS, ERROR_CODES } from "@/constants/api";

export class BaseApiService {
  private baseURL: string;
  private timeout: number;

  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    this.timeout = API_CONFIG.TIMEOUT;
  }

  protected async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw this.createApiError(response);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("Request timeout");
        }
        throw error;
      }

      throw new Error("Network error");
    }
  }

  protected async get<T>(
    endpoint: string,
    options?: {
      params?: Record<string, any>;
      headers?: Record<string, string>;
    },
  ): Promise<T> {
    const queryString = options?.params
      ? `?${new URLSearchParams(options.params)}`
      : "";
    return this.request<T>(`${endpoint}${queryString}`, {
      headers: options?.headers,
    });
  }

  protected async post<T>(
    endpoint: string,
    data?: any,
    options?: { headers?: Record<string, string> },
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
      headers: options?.headers,
    });
  }

  protected async put<T>(
    endpoint: string,
    data?: any,
    options?: { headers?: Record<string, string> },
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
      headers: options?.headers,
    });
  }

  protected async delete<T>(
    endpoint: string,
    options?: { headers?: Record<string, string> },
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: "DELETE",
      headers: options?.headers,
    });
  }

  protected async patch<T>(
    endpoint: string,
    data?: any,
    options?: { headers?: Record<string, string> },
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
      headers: options?.headers,
    });
  }

  private createApiError(response: Response): Error {
    const status = response.status;
    let message = "Request failed";

    switch (status) {
      case HTTP_STATUS.BAD_REQUEST:
        message = "Bad request";
        break;
      case HTTP_STATUS.UNAUTHORIZED:
        message = "Unauthorized";
        break;
      case HTTP_STATUS.FORBIDDEN:
        message = "Forbidden";
        break;
      case HTTP_STATUS.NOT_FOUND:
        message = "Not found";
        break;
      case HTTP_STATUS.CONFLICT:
        message = "Conflict";
        break;
      case HTTP_STATUS.TOO_MANY_REQUESTS:
        message = "Too many requests";
        break;
      case HTTP_STATUS.INTERNAL_SERVER_ERROR:
        message = "Internal server error";
        break;
      case HTTP_STATUS.SERVICE_UNAVAILABLE:
        message = "Service unavailable";
        break;
      default:
        message = `Request failed with status ${status}`;
    }

    const error = new Error(message);
    (error as any).status = status;
    (error as any).statusText = response.statusText;

    return error;
  }
}
