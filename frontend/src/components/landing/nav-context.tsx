"use client";

import { createContext, useContext } from "react";

/**
 * Lets content-only sections trigger navigation (e.g. Hero's "See how it
 * works", the footer links) without knowing whether the page is currently
 * a scroll deck (goTo panel index) or a stacked document (scrollIntoView).
 */
export const LandingNavContext = createContext<(index: number) => void>(
  () => {},
);

export const useLandingNav = () => useContext(LandingNavContext);
