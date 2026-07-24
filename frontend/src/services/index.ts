// Services Index
import { AuthApiService } from "./api/auth-api";
import { UserApiService } from "./api/user-api";
import { ZonesApiService } from "./api/zones-api";
import { ShipmentApiService } from "./api/shipment-api";
import { PartnersApiService } from "./api/partners-api";
import { GeographicalApiService } from "./api/geographical-api";
import { settlementApi } from "./api/settlement-api";
import { shipmentRerateApi } from "./api/shipment-rerate-api";

export { AuthApiService } from "./api/auth-api";
export { UserApiService } from "./api/user-api";
export { ZonesApiService } from "./api/zones-api";
export { ShipmentApiService } from "./api/shipment-api";
export { PartnersApiService } from "./api/partners-api";
export { GeographicalApiService } from "./api/geographical-api";
export { BaseApiService } from "./api/base-api";

// Service instances
export const authApiService = new AuthApiService();
export const userApiService = new UserApiService();
export const zonesApiService = new ZonesApiService();
export const shipmentApiService = new ShipmentApiService();
export const partnersApiService = new PartnersApiService();
export const geographicalApiService = new GeographicalApiService();

// Token synchronization utility
export const setTokenForAllServices = (token: string | null) => {
  authApiService.setAccessToken(token);
  userApiService.setAccessToken(token);
  zonesApiService.setAccessToken(token);
  shipmentApiService.setAccessToken(token);
  partnersApiService.setAccessToken(token);
  geographicalApiService.setAccessToken(token);
  settlementApi.setAccessToken(token);
  shipmentRerateApi.setAccessToken(token);
};

// Clear tokens from all services
export const clearTokensFromAllServices = () => {
  authApiService.setAccessToken(null);
  userApiService.setAccessToken(null);
  zonesApiService.setAccessToken(null);
  shipmentApiService.setAccessToken(null);
  partnersApiService.setAccessToken(null);
  geographicalApiService.setAccessToken(null);
  settlementApi.setAccessToken(null);
  shipmentRerateApi.setAccessToken(null);
};
