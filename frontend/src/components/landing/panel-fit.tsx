"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";

/**
 * Port of the design's `data-fit` behavior: if a panel's content is taller
 * than the viewport space available, scale it down uniformly so every panel
 * always fits inside its 100vh slide (short laptop screens included).
 */
export function PanelFit({ children }: { children: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const fit = useCallback(() => {
    const box = boxRef.current;
    const el = innerRef.current;
    if (!box || !el) return;
    el.style.transform = "none";
    const cs = getComputedStyle(box);
    const avail =
      box.clientHeight -
      parseFloat(cs.paddingTop || "0") -
      parseFloat(cs.paddingBottom || "0");
    const h = el.scrollHeight;
    if (!avail || !h) return;
    const k = Math.min(1, avail / h);
    el.style.transformOrigin = "center center";
    el.style.transform = k < 0.999 ? `scale(${k.toFixed(4)})` : "none";
  }, []);

  useEffect(() => {
    fit();
    const timers = [120, 400, 1200].map((t) => window.setTimeout(fit, t));
    window.addEventListener("resize", fit);
    if (document.fonts?.ready) document.fonts.ready.then(fit).catch(() => {});
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", fit);
    };
  }, [fit]);

  return (
    <div
      ref={boxRef}
      className="flex h-full w-full items-center justify-center px-11 pb-[clamp(40px,6vh,64px)] pt-[clamp(88px,11vh,120px)]"
    >
      <div ref={innerRef} className="flex w-full justify-center">
        {children}
      </div>
    </div>
  );
}
