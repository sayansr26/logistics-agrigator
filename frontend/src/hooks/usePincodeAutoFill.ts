import { useEffect, useRef, useState } from "react";
import { useGetPincodeDetailsQuery } from "@/store/api/endpoints/geoApi";
import { extractPincodeGeo, isCompletePincode } from "@/lib/pincode";

export type PincodeFill = { city: string; state: string; area: string };

interface Options {
  pincode: string;
  current: PincodeFill;
  onFill: (patch: Partial<PincodeFill>) => void;
  debounceMs?: number;
}

/**
 * Watches `pincode`. When it matches /^\d{6}$/, debounces, then queries
 * /api/v1/geography/pincodes/:pincode and patches city/state/area.
 *
 * Only overwrites fields that are empty OR were last auto-filled by this hook,
 * so user edits stick.
 */
export function usePincodeAutoFill({
  pincode,
  current,
  onFill,
  debounceMs = 400,
}: Options) {
  const [debounced, setDebounced] = useState<string>("");
  const autoFilledRef = useRef<PincodeFill>({ city: "", state: "", area: "" });
  // Which pincode produced the values currently in autoFilledRef.
  const lastResolvedRef = useRef<string>("");

  useEffect(() => {
    // The details endpoint 400s on anything shorter than 6 digits, so there is
    // nothing useful to ask for until the pincode is complete.
    if (!isCompletePincode(pincode)) {
      setDebounced("");
      return;
    }
    const t = setTimeout(() => setDebounced(pincode), debounceMs);
    return () => clearTimeout(t);
  }, [pincode, debounceMs]);

  const { data, isFetching, isError } = useGetPincodeDetailsQuery(debounced, {
    skip: !debounced,
  });

  useEffect(() => {
    const payload: any = (data as any)?.data;
    if (!payload) return;

    const { city, state, area } = extractPincodeGeo(payload);

    const next: Partial<PincodeFill> = {};
    const canWrite = (field: keyof PincodeFill, value: string) => {
      if (!value) return false;
      // A freshly resolved pincode is authoritative. Once the pincode itself
      // changes, its city/state/area win over whatever was in the boxes —
      // otherwise correcting a pincode leaves the old city sitting there.
      if (debounced !== lastResolvedRef.current) return true;
      const cur = current[field] || "";
      const auto = autoFilledRef.current[field] || "";
      if (!cur) return true;
      if (cur === auto) return true;
      return false;
    };

    if (canWrite("city", city)) next.city = city;
    if (canWrite("state", state)) next.state = state;
    if (canWrite("area", area)) next.area = area;

    lastResolvedRef.current = debounced;

    if (Object.keys(next).length > 0) {
      autoFilledRef.current = {
        ...autoFilledRef.current,
        ...next,
      } as PincodeFill;
      onFill(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, debounced]);

  const notFound = !!debounced && isError;

  return { isFetching: !!debounced && isFetching, notFound };
}
