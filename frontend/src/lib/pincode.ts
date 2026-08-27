/**
 * Pincode lookup helpers.
 *
 * GET /api/v1/geography/pincodes/:code has been served in two shapes over time:
 *
 *   older   { data: { pincode: {...}, hierarchy: { state, city, area } } }
 *   current { data: { code, district, areaName, stateId,
 *                     area: { name, city: { name, state: { id, name } } },
 *                     state: { id, name } } }
 *
 * Reading only the older shape silently yields empty strings — the request
 * succeeds, nothing fills in, and it looks like the API was never called.
 * Every caller must go through this extractor so the two shapes stay handled
 * in exactly one place.
 */

export interface PincodeGeo {
  city: string;
  state: string;
  area: string;
  stateId: string | null;
  cityId: string | null;
}

const EMPTY: PincodeGeo = {
  city: "",
  state: "",
  area: "",
  stateId: null,
  cityId: null,
};

/** Accepts the raw `data` payload from getPincodeDetails, in either shape. */
export function extractPincodeGeo(payload: any): PincodeGeo {
  if (!payload) return EMPTY;

  const hierarchy = payload.hierarchy;
  const nested = payload.pincode ?? payload;

  const area =
    hierarchy?.area?.name || payload.area?.name || nested?.areaName || "";

  const city =
    hierarchy?.city?.name || payload.area?.city?.name || nested?.district || "";

  const state =
    hierarchy?.state?.name ||
    payload.state?.name ||
    payload.area?.city?.state?.name ||
    "";

  const stateId =
    hierarchy?.state?.id ||
    payload.state?.id ||
    payload.area?.city?.state?.id ||
    nested?.stateId ||
    null;

  const cityId =
    hierarchy?.city?.id ||
    payload.area?.city?.id ||
    payload.area?.cityId ||
    nested?.cityId ||
    null;

  return { city, state, area, stateId, cityId };
}

/**
 * Indian pincodes are exactly 6 digits, and the details endpoint 400s on
 * anything shorter — so the lookup can only fire at 6.
 */
export const PINCODE_LENGTH = 6;

/** Suggestion search is a prefix match and is useful well before 6 digits. */
export const PINCODE_SUGGEST_MIN = 3;

export const isCompletePincode = (value: string) =>
  /^\d{6}$/.test(String(value ?? "").trim());
