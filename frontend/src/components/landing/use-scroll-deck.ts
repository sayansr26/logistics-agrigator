"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { PANEL_COUNT } from "./content";

/** SSR-safe media query — server snapshot is `false`, so the stacked layout
 *  is what gets server-rendered and hydrated; the deck upgrades after mount. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export interface ScrollDeck {
  /** ref callback: registerPanel(i) attaches panel i's DOM node to the loop */
  registerPanel: (index: number) => (el: HTMLElement | null) => void;
  /** ref for the parallax blob layer (transform driven per frame) */
  blobRef: (el: HTMLElement | null) => void;
  goTo: (index: number) => void;
  activeIndex: number;
  showHint: boolean;
}

/**
 * Scroll progress p = scrollY / viewportHeight drives every panel's 3D
 * transform (the design's exact math). p is intentionally NOT React state:
 * the rAF loop writes styles straight to the panel DOM nodes; only the
 * derived activeIndex / showHint booleans trigger re-renders.
 */
export function useScrollDeck(enabled: boolean): ScrollDeck {
  const panelsRef = useRef<(HTMLElement | null)[]>([]);
  const blobElRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showHint, setShowHint] = useState(true);

  const update = useCallback(() => {
    rafRef.current = null;
    const vh = window.innerHeight || 1;
    const p = window.scrollY / vh;

    panelsRef.current.forEach((el, i) => {
      if (!el) return;
      const d = p - i;
      const a = Math.min(Math.abs(d), 1.6);
      const ease = Math.pow(a, 1.25);
      const op = a < 1 ? Math.max(0, 1 - Math.pow(a, 1.5)) : 0;
      el.style.transform = `translate3d(0, ${(-d * 16).toFixed(2)}vh, ${(-ease * 620).toFixed(0)}px) rotateX(${(d * 20).toFixed(2)}deg) scale(${(1 - ease * 0.1).toFixed(3)})`;
      el.style.opacity = op.toFixed(3);
      el.style.pointerEvents = a < 0.35 ? "auto" : "none";
      el.style.zIndex = String(30 - Math.round(a * 10));
      // fully-faded panels leave compositing and the tab order entirely
      el.style.visibility = op === 0 ? "hidden" : "visible";
    });

    if (blobElRef.current) {
      blobElRef.current.style.transform = `translate3d(${(-p * 2.2).toFixed(2)}%, ${(-p * 1.6).toFixed(2)}%, 0) scale(${(1 + p * 0.02).toFixed(3)})`;
    }

    const idx = Math.min(PANEL_COUNT - 1, Math.max(0, Math.round(p)));
    setActiveIndex((prev) => (prev === idx ? prev : idx));
    setShowHint((prev) => {
      const next = p < 0.35;
      return prev === next ? prev : next;
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const schedule = () => {
      if (rafRef.current == null)
        rafRef.current = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [enabled, update]);

  const registerPanel = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      panelsRef.current[index] = el;
    },
    [],
  );
  const blobRef = useCallback((el: HTMLElement | null) => {
    blobElRef.current = el;
  }, []);

  const goTo = useCallback((index: number) => {
    window.scrollTo({
      top: index * (window.innerHeight || 0),
      behavior: "smooth",
    });
  }, []);

  return { registerPanel, blobRef, goTo, activeIndex, showHint };
}
