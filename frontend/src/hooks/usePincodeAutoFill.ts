import { useEffect, useRef, useState } from "react";
import { useGetPincodeDetailsQuery } from "@/store/api/endpoints/geoApi";

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

  useEffect(() => {
    if (!/^\d{6}$/.test(pincode)) {
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
    // Backend returns either { data: { pincode, hierarchy } } (older) or
    // a flat pincode record with nested area.city.state (current). Handle both.
    const hierarchy = payload.hierarchy;
    const area =
      hierarchy?.area?.name || payload.area?.name || payload.areaName || "";
    const city =
      hierarchy?.city?.name || payload.area?.city?.name || "";
    const state =
      hierarchy?.state?.name ||
      payload.state?.name ||
      payload.area?.city?.state?.name ||
      "";

    const next: Partial<PincodeFill> = {};
    const canWrite = (field: keyof PincodeFill, value: string) => {
      if (!value) return false;
      const cur = current[field] || "";
      const auto = autoFilledRef.current[field] || "";
      if (!cur) return true;
      if (cur === auto) return true;
      return false;
    };

    if (canWrite("city", city)) next.city = city;
    if (canWrite("state", state)) next.state = state;
    if (canWrite("area", area)) next.area = area;

    if (Object.keys(next).length > 0) {
      autoFilledRef.current = { ...autoFilledRef.current, ...next } as PincodeFill;
      onFill(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const notFound = !!debounced && isError;

  return { isFetching: !!debounced && isFetching, notFound };
}
