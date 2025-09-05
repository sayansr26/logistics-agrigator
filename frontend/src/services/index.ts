// Services Index
import { AuthApiService } from "./api/auth-api";
import { UserApiService } from "./api/user-api";

export { AuthApiService } from "./api/auth-api";
export { UserApiService } from "./api/user-api";
export { BaseApiService } from "./api/base-api";

// Service instances
export const authApiService = new AuthApiService();
export const userApiService = new UserApiService();
