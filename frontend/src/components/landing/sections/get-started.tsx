"use client";

import Link from "next/link";
import { TAGLINE } from "../content";
import { LogoMark, Wordmark } from "../chrome/logo";
import { useLandingNav } from "../nav-context";

export function GetStartedSection() {
  const navigate = useLandingNav();
  return (
    <div className="glass relative w-full max-w-[1080px] overflow-hidden rounded-[32px] shadow-[0_60px_120px_-50px_rgba(0,0,0,.95)]">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 90% at 15% 20%,rgba(240,78,35,.35),transparent 70%),radial-gradient(50% 80% at 90% 90%,rgba(22,104,214,.35),transparent 70%)",
        }}
      />
      <div className="relative px-7 pb-[46px] pt-12 sm:px-14 sm:pt-16">
        <h2 className="max-w-[600px] text-[clamp(28px,min(3.8vw,5.8vh),50px)] font-bold leading-[1.04] tracking-[-0.035em]">
          Ready to ship smarter?
        </h2>
        <p className="mt-4 max-w-[600px] text-base leading-relaxed text-white/70 [text-wrap:pretty]">
          Get your team, couriers and wallet set up in an afternoon—then let
          Subsolution run booking, re-rating and COD settlement for you.
        </p>
        <div className="mt-[clamp(18px,3vh,28px)] flex flex-wrap gap-3">
          <Link
            href="/auth/register"
            className="btnb rounded-full px-[30px] py-[15px] text-[15px] font-semibold"
          >
            Get Started
          </Link>
          <Link
            href="/auth/login"
            className="rounded-full border border-white/[.24] bg-white/[.1] px-7 py-[15px] text-[15px] font-semibold text-white transition hover:bg-white/[.2]"
          >
            Log In
          </Link>
        </div>
        <div className="mt-11 flex flex-wrap items-center justify-between gap-8 border-t border-white/[.14] pt-6">
          <div className="flex items-center gap-3">
            <LogoMark size={36} />
            <div>
              <Wordmark className="text-lg" />
              <div className="mt-0.5 text-xs text-white/50">{TAGLINE}</div>
            </div>
          </div>
          <div className="flex gap-6 text-[13.5px] font-medium">
            <button
              onClick={() => navigate(4)}
              className="text-white/70 transition hover:text-white"
            >
              Platform
            </button>
            <button
              onClick={() => navigate(7)}
              className="text-white/70 transition hover:text-white"
            >
              FAQ
            </button>
            <Link
              href="/auth/login"
              className="text-white/70 transition hover:text-white"
            >
              Log In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
