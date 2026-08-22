"use client";

import { useEffect, useState } from "react";

/**
 * True only after the first client render has committed.
 *
 * Use it to gate anything whose value comes from the browser — a zustand
 * `persist` store backed by localStorage, `window`, `Date.now()`, `Math.random()`.
 * The server has none of that, so it renders the store's DEFAULT_STATE while the
 * browser renders the restored draft, and React throws
 * "Text content does not match server-rendered HTML" and falls back to client
 * rendering for the whole root.
 *
 * The flag is false on the server AND on the first client render, so the two
 * agree; the effect then flips it and the real values render in a second pass.
 */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
