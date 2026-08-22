"use client";

import Link from "next/link";
import { NAV } from "../content";
import { LogoMark, Wordmark } from "./logo";

interface HeaderProps {
  activeIndex: number;
  /** Deck mode: scroll to panel index. Stacked mode: scroll to section id. */
  onNavigate: (index: number) => void;
  onHome: () => void;
}

/** Floating glass pill navbar — rendered in both deck and stacked modes. */
export function Header({ activeIndex, onNavigate, onHome }: HeaderProps) {
  return (
    <header className="pointer-events-none fixed left-0 right-0 top-5 z-[80] flex justify-center">
      <div className="glass pointer-events-auto flex items-center gap-3 rounded-full py-[9px] pl-[18px] pr-[9px] shadow-[0_20px_46px_-20px_rgba(0,0,0,.85)] md:gap-[22px]">
        <button
          onClick={onHome}
          className="flex items-center gap-[9px]"
          aria-label="Back to top"
        >
          <LogoMark size={28} />
          <Wordmark />
        </button>

        <div className="hidden h-5 w-px bg-white/[.18] md:block" />

        <nav className="hidden items-center gap-1 text-[13.5px] font-medium md:flex">
          {NAV.map((n) => {
            const active = activeIndex === n.index;
            return (
              <button
                key={n.label}
                onClick={() => onNavigate(n.index)}
                className={`rounded-full px-[13px] py-2 transition-all hover:bg-white/[.14] hover:text-white ${
                  active ? "bg-white/[.16] text-white" : "text-white/[.72]"
                }`}
              >
                {n.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {/* Customer-facing, not a panel route — recipients arriving here are
              not users and should reach tracking without signing in. */}
          <Link
            href="/track"
            className="px-2.5 py-2 text-[13.5px] font-medium text-white/[.82] transition hover:text-white"
          >
            Track
          </Link>
          <Link
            href="/auth/login"
            className="px-2.5 py-2 text-[13.5px] font-medium text-white/[.82] transition hover:text-white"
          >
            Log In
          </Link>
          <Link
            href="/auth/register"
            className="btnb rounded-full px-[18px] py-2.5 text-[13.5px] font-semibold"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
