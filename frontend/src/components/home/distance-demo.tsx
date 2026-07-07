"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, animate, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  MapPin,
  ArrowRight,
  Loader2,
  Navigation,
  AlertCircle,
  Route,
  Hash,
  Building2,
  Map as MapIcon,
  Compass,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
interface GeoItem {
  id: string;
  name: string;
}
interface NormResult {
  distance: number;
  distanceMiles: number;
  method: string;
  fromLabel: string;
  fromSub: string;
  toLabel: string;
  toSub: string;
}

type Mode = "pincode" | "city" | "state" | "area" | "coordinates";

const MODES: { id: Mode; label: string; icon: typeof Hash }[] = [
  { id: "pincode", label: "Pincode", icon: Hash },
  { id: "city", label: "City", icon: Building2 },
  { id: "state", label: "State", icon: MapPin },
  { id: "area", label: "Area", icon: Navigation },
  { id: "coordinates", label: "Lat / Lng", icon: MapIcon },
];

const PRESETS = [
  { label: "Delhi → Mumbai", from: "110001", to: "400001" },
  { label: "Bengaluru → Chennai", from: "560001", to: "600001" },
  { label: "Kolkata → Pune", from: "700001", to: "411001" },
];

const EASE = [0.22, 1, 0.36, 1] as const;
const isPin = (v: string) => /^\d{6}$/.test(v.trim());
const isNum = (v: string) => v.trim() !== "" && !Number.isNaN(Number(v));

async function getJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const json = await res.json();
  if (!res.ok || json?.status !== "success") {
    throw new Error(json?.error?.message || json?.message || "Request failed");
  }
  return json;
}
const nameOf = (list: GeoItem[], id: string) => list.find((x) => x.id === id)?.name || "";

/* ------------------------------------------------------------------ */
/*  Count-up                                                          */
/* ------------------------------------------------------------------ */
function CountUp({ to, decimals = 0 }: { to: number; decimals?: number }) {
  const [val, setVal] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) {
      setVal(to);
      return;
    }
    const controls = animate(0, to, { duration: 1.1, ease: EASE, onUpdate: (v) => setVal(v) });
    return () => controls.stop();
  }, [to, reduce]);
  return <>{val.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}

/* ------------------------------------------------------------------ */
/*  Field primitives                                                  */
/* ------------------------------------------------------------------ */
const inputCls =
  "card mono w-full rounded-xl px-3.5 py-3 text-base outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand)_35%,transparent)]";
const selectCls =
  "card w-full appearance-none rounded-xl px-3.5 py-3 text-sm outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand)_35%,transparent)] disabled:opacity-50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="tmut mb-1.5 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

function GeoSelect({
  label,
  value,
  onChange,
  items,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: GeoItem[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <div className="relative">
        <select className={selectCls} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
          <option value="">{disabled ? "—" : placeholder}</option>
          {items.map((it) => (
            <option key={it.id} value={it.id}>{it.name}</option>
          ))}
        </select>
        <span className="tmut pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs">▾</span>
      </div>
    </Field>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export function DistanceDemo() {
  const [mode, setMode] = useState<Mode>("pincode");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NormResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // pincode
  const [fromPin, setFromPin] = useState("");
  const [toPin, setToPin] = useState("");
  // coordinates
  const [fLat, setFLat] = useState("");
  const [fLng, setFLng] = useState("");
  const [tLat, setTLat] = useState("");
  const [tLng, setTLng] = useState("");
  // geo ids
  const [fState, setFState] = useState("");
  const [tState, setTState] = useState("");
  const [fCity, setFCity] = useState("");
  const [tCity, setTCity] = useState("");
  const [fArea, setFArea] = useState("");
  const [tArea, setTArea] = useState("");
  // lists
  const [states, setStates] = useState<GeoItem[]>([]);
  const [fCities, setFCities] = useState<GeoItem[]>([]);
  const [tCities, setTCities] = useState<GeoItem[]>([]);
  const [fAreas, setFAreas] = useState<GeoItem[]>([]);
  const [tAreas, setTAreas] = useState<GeoItem[]>([]);

  const needGeo = mode === "city" || mode === "state" || mode === "area";

  // load states once when a geo mode is first used
  useEffect(() => {
    if (!needGeo || states.length) return;
    getJson("/api/v1/geography/states?page=1&limit=100")
      .then((j) => setStates(j.data || []))
      .catch(() => setError("Couldn't load the state list. Please retry."));
  }, [needGeo, states.length]);

  const loadCities = useCallback(async (stateId: string, side: "f" | "t") => {
    if (!stateId) return;
    const j = await getJson(`/api/v1/geography/cities?page=1&limit=300&stateId=${stateId}`);
    (side === "f" ? setFCities : setTCities)(j.data || []);
  }, []);
  const loadAreas = useCallback(async (cityId: string, side: "f" | "t") => {
    if (!cityId) return;
    const j = await getJson(`/api/v1/geography/areas?page=1&limit=400&cityId=${cityId}`);
    (side === "f" ? setFAreas : setTAreas)(j.data || []);
  }, []);

  // cascading: state -> cities
  useEffect(() => { setFCity(""); setFArea(""); setFAreas([]); setFCities([]); if (fState && needGeo) loadCities(fState, "f").catch(() => {}); }, [fState, needGeo, loadCities]);
  useEffect(() => { setTCity(""); setTArea(""); setTAreas([]); setTCities([]); if (tState && needGeo) loadCities(tState, "t").catch(() => {}); }, [tState, needGeo, loadCities]);
  // cascading: city -> areas (area mode only)
  useEffect(() => { setFArea(""); setFAreas([]); if (fCity && mode === "area") loadAreas(fCity, "f").catch(() => {}); }, [fCity, mode, loadAreas]);
  useEffect(() => { setTArea(""); setTAreas([]); if (tCity && mode === "area") loadAreas(tCity, "t").catch(() => {}); }, [tCity, mode, loadAreas]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setResult(null);
  };

  const ready =
    mode === "pincode" ? isPin(fromPin) && isPin(toPin)
    : mode === "state" ? !!fState && !!tState
    : mode === "city" ? !!fCity && !!tCity
    : mode === "area" ? !!fArea && !!tArea
    : isNum(fLat) && isNum(fLng) && isNum(tLat) && isNum(tLng);

  const calculate = async (override?: { fromPin: string; toPin: string }) => {
    setError(null);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const base = { signal: ctrl.signal, method: "POST", headers: { "Content-Type": "application/json" } } as const;

    let url = "";
    let body: unknown = {};
    let labels = { fromLabel: "", fromSub: "", toLabel: "", toSub: "" };

    if (mode === "pincode") {
      const fp = override?.fromPin ?? fromPin;
      const tp = override?.toPin ?? toPin;
      if (!isPin(fp) || !isPin(tp)) { setError("Enter two valid 6-digit pincodes."); return; }
      url = "/api/v1/geography/distance/pincode-to-pincode";
      body = { fromPincode: fp.trim(), toPincode: tp.trim() };
      labels = { fromLabel: fp, fromSub: "Pincode", toLabel: tp, toSub: "Pincode" };
    } else if (mode === "state") {
      url = "/api/v1/geography/distance/state-to-state";
      body = { fromStateId: fState, toStateId: tState };
      labels = { fromLabel: nameOf(states, fState), fromSub: "State", toLabel: nameOf(states, tState), toSub: "State" };
    } else if (mode === "city") {
      url = "/api/v1/geography/distance/city-to-city";
      body = { fromCityId: fCity, toCityId: tCity };
      labels = { fromLabel: nameOf(fCities, fCity), fromSub: nameOf(states, fState), toLabel: nameOf(tCities, tCity), toSub: nameOf(states, tState) };
    } else if (mode === "area") {
      url = "/api/v1/geography/distance/area-to-area";
      body = { fromAreaId: fArea, toAreaId: tArea };
      labels = { fromLabel: nameOf(fAreas, fArea), fromSub: nameOf(fCities, fCity), toLabel: nameOf(tAreas, tArea), toSub: nameOf(tCities, tCity) };
    } else {
      url = "/api/v1/geography/distance/coordinates";
      body = { from: { latitude: +fLat, longitude: +fLng }, to: { latitude: +tLat, longitude: +tLng } };
      labels = { fromLabel: `${(+fLat).toFixed(2)}, ${(+fLng).toFixed(2)}`, fromSub: "Coordinates", toLabel: `${(+tLat).toFixed(2)}, ${(+tLng).toFixed(2)}`, toSub: "Coordinates" };
    }

    setLoading(true);
    setResult(null);
    try {
      const j = await getJson(url, { ...base, body: JSON.stringify(body) });
      const d = j.data || {};
      // prefer resolved location names when the API returns them (pincode/coords)
      const fromLabel = d.fromLocation?.city || labels.fromLabel;
      const toLabel = d.toLocation?.city || labels.toLabel;
      const fromSub = d.fromLocation?.state ? `${d.fromLocation.state} · ${labels.fromSub}` : labels.fromSub;
      const toSub = d.toLocation?.state ? `${d.toLocation.state} · ${labels.toSub}` : labels.toSub;
      setResult({
        distance: Number(d.distance) || 0,
        distanceMiles: Number(d.distanceMiles) || 0,
        method: d.calculationMethod || "haversine",
        fromLabel, fromSub, toLabel, toSub,
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Couldn't calculate that distance. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const runPreset = (p: (typeof PRESETS)[number]) => {
    setMode("pincode");
    setFromPin(p.from);
    setToPin(p.to);
    calculate({ fromPin: p.from, toPin: p.to });
  };

  return (
    <div className="card relative overflow-hidden rounded-[26px] p-6 shadow-2xl sm:p-8" style={{ boxShadow: "0 40px 90px -50px rgba(0,0,0,0.45)" }}>
      <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full opacity-20 blur-[70px]" style={{ background: "var(--brand)" }} />

      {/* mode tabs */}
      <div className="relative mb-6 flex flex-wrap gap-1.5">
        {MODES.map((m) => {
          const Icon = m.icon;
          const on = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => switchMode(m.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ${on ? "btnb shadow" : "brd t2 border hover:text-[var(--brand)]"}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="relative grid gap-6 lg:grid-cols-[1fr_1.05fr] lg:gap-10">
        {/* ---- inputs ---- */}
        <div>
          {mode === "pincode" && (
            <div className="flex items-stretch gap-2">
              <Field label="From pincode">
                <input inputMode="numeric" maxLength={6} value={fromPin}
                  onChange={(e) => setFromPin(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && ready && calculate()}
                  placeholder="110001" className={`${inputCls} tracking-widest`} aria-label="From pincode" />
              </Field>
              <div className="flex items-end pb-3">
                <span className="grid h-9 w-9 place-items-center rounded-full" style={{ background: "color-mix(in srgb,var(--brand) 14%,transparent)" }}><ArrowRight className="tbrand h-4 w-4" /></span>
              </div>
              <Field label="To pincode">
                <input inputMode="numeric" maxLength={6} value={toPin}
                  onChange={(e) => setToPin(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && ready && calculate()}
                  placeholder="400001" className={`${inputCls} tracking-widest`} aria-label="To pincode" />
              </Field>
            </div>
          )}

          {mode === "state" && (
            <div className="grid grid-cols-2 gap-3">
              <GeoSelect label="From state" value={fState} onChange={setFState} items={states} placeholder="Select state" />
              <GeoSelect label="To state" value={tState} onChange={setTState} items={states} placeholder="Select state" />
            </div>
          )}

          {mode === "city" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <GeoSelect label="From state" value={fState} onChange={setFState} items={states} placeholder="Select state" />
                <GeoSelect label="From city" value={fCity} onChange={setFCity} items={fCities} placeholder="Select city" disabled={!fState} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <GeoSelect label="To state" value={tState} onChange={setTState} items={states} placeholder="Select state" />
                <GeoSelect label="To city" value={tCity} onChange={setTCity} items={tCities} placeholder="Select city" disabled={!tState} />
              </div>
            </div>
          )}

          {mode === "area" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <GeoSelect label="From state" value={fState} onChange={setFState} items={states} placeholder="State" />
                <GeoSelect label="City" value={fCity} onChange={setFCity} items={fCities} placeholder="City" disabled={!fState} />
                <GeoSelect label="Area" value={fArea} onChange={setFArea} items={fAreas} placeholder="Area" disabled={!fCity} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <GeoSelect label="To state" value={tState} onChange={setTState} items={states} placeholder="State" />
                <GeoSelect label="City" value={tCity} onChange={setTCity} items={tCities} placeholder="City" disabled={!tState} />
                <GeoSelect label="Area" value={tArea} onChange={setTArea} items={tAreas} placeholder="Area" disabled={!tCity} />
              </div>
            </div>
          )}

          {mode === "coordinates" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="From latitude"><input className={inputCls} inputMode="decimal" placeholder="28.6139" value={fLat} onChange={(e) => setFLat(e.target.value)} /></Field>
                <Field label="From longitude"><input className={inputCls} inputMode="decimal" placeholder="77.2090" value={fLng} onChange={(e) => setFLng(e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="To latitude"><input className={inputCls} inputMode="decimal" placeholder="19.0760" value={tLat} onChange={(e) => setTLat(e.target.value)} /></Field>
                <Field label="To longitude"><input className={inputCls} inputMode="decimal" placeholder="72.8777" value={tLng} onChange={(e) => setTLng(e.target.value)} /></Field>
              </div>
            </div>
          )}

          <Button onClick={() => calculate()} disabled={!ready || loading} className="btnb mt-4 h-12 w-full text-base shadow-lg disabled:opacity-50">
            {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Calculating…</> : <><Compass className="mr-2 h-5 w-5" />Calculate distance</>}
          </Button>

          {mode === "pincode" && (
            <div className="mt-4 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.label} onClick={() => runPreset(p)} className="brd t2 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:border-[var(--brand)] hover:text-[var(--brand)]">{p.label}</button>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm" style={{ background: "color-mix(in srgb,var(--bad) 12%,transparent)", color: "var(--bad)" }}>
              <AlertCircle className="h-4 w-4 shrink-0" />{error}
            </div>
          )}
        </div>

        {/* ---- result ---- */}
        <div className="brd relative min-h-[240px] rounded-2xl border bg-[var(--panel2)] p-5">
          <AnimatePresence mode="wait">
            {!result && !loading && (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="tmut flex h-full min-h-[210px] flex-col items-center justify-center gap-3 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: "color-mix(in srgb,var(--brand) 12%,transparent)" }}><Route className="tbrand h-6 w-6" /></span>
                <p className="text-sm">Choose a method and two locations<br />to see the straight-line distance.</p>
              </motion.div>
            )}
            {loading && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-full min-h-[210px] items-center justify-center"><Loader2 className="tbrand h-7 w-7 animate-spin" /></motion.div>
            )}
            {result && !loading && (
              <motion.div key="result" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EASE }}>
                <svg viewBox="0 0 320 70" className="mb-4 h-16 w-full" aria-hidden="true">
                  <motion.path d="M18 52 Q160 -14 302 52" fill="none" stroke="var(--brand)" strokeWidth="2" strokeDasharray="4 6" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: EASE }} />
                  <circle cx="18" cy="52" r="5" fill="var(--brand)" />
                  <circle cx="302" cy="52" r="5" fill="var(--money)" />
                </svg>

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="tmut text-[11px] uppercase tracking-wide">From</div>
                    <div className="tink truncate text-sm font-bold capitalize">{(result.fromLabel || "—").toLowerCase()}</div>
                    <div className="tmut mono truncate text-xs capitalize">{(result.fromSub || "").toLowerCase()}</div>
                  </div>
                  <MapPin className="tbrand mt-1 h-4 w-4 shrink-0" />
                  <div className="min-w-0 text-right">
                    <div className="tmut text-[11px] uppercase tracking-wide">To</div>
                    <div className="tink truncate text-sm font-bold capitalize">{(result.toLabel || "—").toLowerCase()}</div>
                    <div className="tmut mono truncate text-xs capitalize">{(result.toSub || "").toLowerCase()}</div>
                  </div>
                </div>

                <div className="mt-5 flex items-end justify-between rounded-xl bg-[var(--panel)] p-4" style={{ border: "1px solid var(--line)" }}>
                  <div>
                    <div className="tmut text-xs">Distance</div>
                    <div className="tink mono text-4xl font-extrabold leading-none tracking-tight">
                      <span className="gtext"><CountUp to={result.distance} decimals={0} /></span>
                      <span className="tmut ml-1 text-base font-semibold">km</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="tmut mono text-sm"><CountUp to={result.distanceMiles} decimals={0} /> mi</div>
                    <div className="tmut mt-1 text-[11px] capitalize">{result.method === "haversine" ? "straight-line" : result.method}</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
