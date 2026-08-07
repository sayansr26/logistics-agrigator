"use client";

import { type ComponentType } from "react";
import { PanelFit } from "./panel-fit";
import type { ScrollDeck } from "./use-scroll-deck";

export interface SectionDef {
  id: string;
  label: string;
  Component: ComponentType;
}

/**
 * Desktop deck layout: N × 100vh scroll-snap spacers give the page its
 * height, while all visuals render inside a fixed, perspective viewport
 * where the rAF loop (use-scroll-deck) flies panels through 3D space.
 */
export function Deck({
  sections,
  deck,
}: {
  sections: SectionDef[];
  deck: ScrollDeck;
}) {
  return (
    <div className="relative z-10 w-full">
      {sections.map((s) => (
        <div
          key={s.id}
          style={{
            height: "100vh",
            scrollSnapAlign: "start",
            scrollSnapStop: "always",
          }}
        />
      ))}

      <div
        className="fixed inset-0 overflow-hidden"
        style={{ perspective: "1500px", perspectiveOrigin: "50% 45%" }}
      >
        <div
          className="absolute inset-0"
          style={{ transformStyle: "preserve-3d", contain: "layout" }}
        >
          {sections.map((s, i) => (
            <section
              key={s.id}
              ref={deck.registerPanel(i)}
              aria-label={s.label}
              className="absolute inset-0"
              style={{ willChange: "transform, opacity" }}
            >
              <PanelFit>
                <s.Component />
              </PanelFit>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
