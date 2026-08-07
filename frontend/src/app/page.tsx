import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Subsolution — Ship anywhere. Settle every rupee.",
  description:
    "Book across 75+ couriers, track live, re-rate weights and settle every rupee of COD — from one panel.",
};

export default function HomePage() {
  return <LandingPage />;
}
