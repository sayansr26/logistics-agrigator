"use client";

import { useEffect, useRef } from "react";
import { LANDING_CSS } from "./landing-css";
import { SECTION_IDS, PANEL_LABELS } from "./content";
import { useMediaQuery, useScrollDeck } from "./use-scroll-deck";
import { LandingNavContext } from "./nav-context";
import { Deck, type SectionDef } from "./deck";
import { Background } from "./background";
import { Header } from "./chrome/header";
import { DotNav } from "./chrome/dot-nav";
import { ScrollHint } from "./chrome/scroll-hint";
import { HeroSection } from "./sections/hero";
import { NetworkSection } from "./sections/network";
import { CalculatorSection } from "./sections/calculator";
import { JourneySection } from "./sections/journey";
import { PlatformSection } from "./sections/platform";
import { SetupSection } from "./sections/setup";
import { RolesSection } from "./sections/roles";
import { FaqSection } from "./sections/faq";
import { GetStartedSection } from "./sections/get-started";

const SECTIONS: SectionDef[] = [
  { id: SECTION_IDS[0], label: PANEL_LABELS[0], Component: HeroSection },
  { id: SECTION_IDS[1], label: PANEL_LABELS[1], Component: NetworkSection },
  { id: SECTION_IDS[2], label: PANEL_LABELS[2], Component: CalculatorSection },
  { id: SECTION_IDS[3], label: PANEL_LABELS[3], Component: JourneySection },
  { id: SECTION_IDS[4], label: PANEL_LABELS[4], Component: PlatformSection },
  { id: SECTION_IDS[5], label: PANEL_LABELS[5], Component: SetupSection },
  { id: SECTION_IDS[6], label: PANEL_LABELS[6], Component: RolesSection },
  { id: SECTION_IDS[7], label: PANEL_LABELS[7], Component: FaqSection },
  { id: SECTION_IDS[8], label: PANEL_LABELS[8], Component: GetStartedSection },
];

/**
 * Orchestrator. SSR + small screens + reduced-motion render the stacked
 * document; desktop upgrades to the 3D scroll deck after mount.
 */
export function LandingPage() {
  const wide = useMediaQuery("(min-width: 1024px)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const deckMode = wide && !reducedMotion;

  const deck = useScrollDeck(deckMode);
  const { goTo, activeIndex, showHint } = deck;

  // scroll-snap must exist only while the deck is mounted on this route
  useEffect(() => {
    if (!deckMode) return;
    document.documentElement.classList.add("landing-snap");
    return () => document.documentElement.classList.remove("landing-snap");
  }, [deckMode]);

  // switching layout modes invalidates the scroll position
  const prevMode = useRef(deckMode);
  useEffect(() => {
    if (prevMode.current !== deckMode) {
      prevMode.current = deckMode;
      window.scrollTo(0, 0);
    }
  }, [deckMode]);

  const navigate = (index: number) => {
    if (deckMode) {
      goTo(index);
    } else {
      document
        .getElementById(SECTIONS[index]?.id)
        ?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <LandingNavContext.Provider value={navigate}>
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />
      <div className="sland min-h-screen">
        <Background blobRef={deckMode ? deck.blobRef : undefined} />
        <Header
          activeIndex={deckMode ? activeIndex : -1}
          onNavigate={navigate}
          onHome={() => navigate(0)}
        />

        {deckMode ? (
          <>
            <Deck sections={SECTIONS} deck={deck} />
            <DotNav activeIndex={activeIndex} goTo={goTo} />
            <ScrollHint visible={showHint} />
          </>
        ) : (
          <main className="relative z-10">
            {SECTIONS.map((s, i) => (
              <section
                key={s.id}
                id={s.id}
                className={`flex scroll-mt-24 justify-center px-5 py-14 sm:px-8 ${i === 0 ? "pt-32" : ""}`}
              >
                <s.Component />
              </section>
            ))}
          </main>
        )}
      </div>
    </LandingNavContext.Provider>
  );
}
