"use client";

import { PANEL_LABELS } from "../content";

/** Right-edge vertical dot navigation — deck mode only. */
export function DotNav({
  activeIndex,
  goTo,
}: {
  activeIndex: number;
  goTo: (i: number) => void;
}) {
  return (
    <div className="fixed right-[26px] top-1/2 z-[80] flex -translate-y-1/2 flex-col items-end gap-[11px]">
      {PANEL_LABELS.map((label, i) => {
        const active = i === activeIndex;
        return (
          <button
            key={label}
            onClick={() => goTo(i)}
            aria-label={label}
            aria-current={active ? "true" : undefined}
            className="flex cursor-pointer items-center gap-[9px]"
          >
            <span
              className={`mono text-[10px] tracking-[.06em] transition-colors duration-300 ${
                active ? "text-white/[.85]" : "text-transparent"
              }`}
            >
              {active ? label : ""}
            </span>
            <span
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: active ? 26 : 12,
                background: active ? "#F04E23" : "rgba(255,255,255,.28)",
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
