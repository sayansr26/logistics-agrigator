"use client";

import Link from "next/link";
import { HERO } from "../content";
import { useLandingNav } from "../nav-context";

function StatCard({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="card rounded-[18px] px-[15px] pb-[17px] pt-[15px]">
      <div
        className={`grotesk text-[28px] font-bold tracking-[-0.03em] ${accent ? "text-[#FF8B5E]" : ""}`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs text-white/[.58]">{label}</div>
    </div>
  );
}

function MockDashboard() {
  return (
    <div className="relative">
      <div
        className="absolute -inset-x-4 -top-8 bottom-3 rounded-[44px] blur-[56px]"
        style={{
          background:
            "linear-gradient(150deg,rgba(22,104,214,.55),rgba(240,78,35,.35))",
        }}
      />
      <div className="glass relative overflow-hidden rounded-3xl shadow-[0_50px_100px_-40px_rgba(0,0,0,.85)]">
        <div className="flex items-center gap-2 border-b border-white/[.12] px-4 py-3">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-[9px] w-[9px] rounded-full bg-white/25"
            />
          ))}
          <span className="mono ml-2 text-[11px] text-white/50">
            {HERO.mockUrl}
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,150,110,.4)] bg-gradient-to-br from-[rgba(255,122,69,.35)] to-[rgba(240,78,35,.25)] px-2.5 py-1 text-[10.5px] font-semibold tracking-[.04em] text-[#FFC3A8]">
            <span className="pulse-dot h-[5px] w-[5px] rounded-full bg-[#FF8B5E]" />
            AI ENGINE ON
          </span>
        </div>
        <div className="grid grid-cols-[136px_1fr] max-sm:grid-cols-1">
          <div className="flex flex-col gap-[3px] border-r border-white/[.12] p-3 pt-4 max-sm:hidden">
            <div className="px-2 pb-[7px] text-[10px] font-semibold tracking-[.12em] text-white/40">
              OPERATIONS
            </div>
            {HERO.mockNav.map((item, i) => (
              <div
                key={item}
                className={`rounded-[9px] p-2 text-[12.5px] ${i === 0 ? "bg-white/[.16] font-semibold text-white" : "text-white/60"}`}
              >
                {item}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-[11px] p-4">
            <div className="flex gap-2.5">
              <div className="flex-1 rounded-[14px] border border-white/[.14] bg-white/[.05] px-3 py-[11px]">
                <div className="text-[10.5px] text-white/50">Balance</div>
                <div className="grotesk mt-0.5 text-[19px] font-bold tracking-[-0.02em]">
                  ₹4,82,150
                </div>
              </div>
              <div className="flex-1 rounded-[14px] border border-white/[.14] bg-white/[.05] px-3 py-[11px]">
                <div className="text-[10.5px] text-white/50">
                  COD in transit
                </div>
                <div className="grotesk mt-0.5 text-[19px] font-bold tracking-[-0.02em] text-[#FF8B5E]">
                  ₹1,96,400
                </div>
              </div>
            </div>
            <div className="overflow-hidden rounded-[14px] border border-white/[.14] bg-white/[.04]">
              <div className="flex items-center justify-between border-b border-white/[.1] px-3 py-2.5">
                <span className="text-xs font-semibold">Shipment summary</span>
                <span className="mono text-[10px] text-white/[.45]">TODAY</span>
              </div>
              {HERO.mockRows.map((row) => (
                <div
                  key={row.awb}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-2.5 border-b border-white/[.07] px-3 py-2"
                >
                  <span className="mono text-[11px] text-white/75">
                    {row.awb}
                  </span>
                  <span className="text-[11px] text-white/50">
                    {row.courier}
                  </span>
                  <span
                    className="rounded-full px-[9px] py-[3px] text-[10.5px] font-semibold"
                    style={{ background: row.bg, color: row.fg }}
                  >
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
            <div className="rounded-[14px] border border-white/[.14] bg-white/[.04] p-3">
              <div className="flex justify-between text-[11.5px] text-white/55">
                <span>Wallet traceability</span>
                <span className="font-semibold text-white">100%</span>
              </div>
              <div className="mt-2 h-[7px] overflow-hidden rounded-full bg-white/[.12]">
                <div className="h-full w-full bg-gradient-to-r from-[#1668D6] to-[#F04E23]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroSection() {
  const navigate = useLandingNav();
  return (
    <div className="grid w-full max-w-[1240px] items-center gap-[52px] lg:grid-cols-[1.04fr_.96fr]">
      <div>
        <div className="glass inline-flex items-center gap-[9px] rounded-full py-[7px] pl-[11px] pr-[15px] text-[12.5px] font-medium">
          <span
            className="pulse-dot h-[7px] w-[7px] rounded-full bg-[#F04E23]"
            style={{ boxShadow: "0 0 10px #F04E23" }}
          />
          <span className="text-white/[.84]">{HERO.badge}</span>
        </div>
        <h1
          className="mt-[22px] text-[clamp(34px,min(5.2vw,7.4vh),72px)] font-bold leading-none tracking-[-0.04em] [text-wrap:balance]"
          style={{ textShadow: "0 4px 40px rgba(0,0,0,.5)" }}
        >
          Ship anywhere.
          <br />
          Settle <span className="gtext">every rupee</span>.
        </h1>
        <p className="mt-5 max-w-[520px] text-[clamp(14.5px,1.15vw,17.5px)] leading-relaxed text-white/70 [text-wrap:pretty]">
          {HERO.sub}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {HERO.chips.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center gap-[7px] rounded-full border border-white/[.16] bg-white/[.08] px-3 py-1.5 text-xs text-white/[.78] backdrop-blur-[18px]"
            >
              <span className="h-[5px] w-[5px] rounded-full bg-[#FF8B5E]" />
              {chip}
            </span>
          ))}
        </div>
        <div className="mt-[clamp(16px,2.6vh,26px)] flex flex-wrap gap-3">
          <Link
            href="/auth/register"
            className="btnb rounded-full px-7 py-[15px] text-[15px] font-semibold"
          >
            Start shipping
          </Link>
          <button
            onClick={() => navigate(3)}
            className="glass rounded-full px-[26px] py-[15px] text-[15px] font-semibold text-white transition hover:bg-white/[.18]"
          >
            See how it works
          </button>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {HERO.stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
      </div>

      <div className="max-lg:hidden">
        <MockDashboard />
      </div>
    </div>
  );
}
