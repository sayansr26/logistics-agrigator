"use client";

import { useState } from "react";
import { JOURNEY_STEPS } from "../content";

export function JourneySection() {
  const [active, setActive] = useState(3);

  return (
    <div className="w-full max-w-[1240px]">
      <div className="max-w-[700px]">
        <span className="eyebrow eyebrow-orange">THE JOURNEY</span>
        <h2 className="mt-4 text-[clamp(27px,min(3.6vw,5.6vh),50px)] font-bold leading-[1.05] tracking-[-0.035em]">
          A parcel&apos;s whole life, in eight beats
        </h2>
        <p className="mt-3 text-[15.5px] leading-relaxed text-white/65">
          Every operational step from the moment an order lands until the
          cash-on-delivery is settled back to the shipper.
        </p>
      </div>
      <div className="relative mt-[38px]">
        <div
          className="absolute left-6 right-6 top-[22px] hidden h-px lg:block"
          style={{
            background:
              "linear-gradient(90deg,rgba(22,104,214,0),#1668D6,#F04E23,rgba(240,78,35,0))",
          }}
        />
        <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {JOURNEY_STEPS.map((step, i) => {
            const on = i <= active;
            const current = i === active;
            return (
              <button
                key={step.title}
                onClick={() => setActive(i)}
                aria-pressed={current}
                className="cursor-pointer rounded-[20px] px-3.5 pb-5 pt-4 text-left backdrop-blur-[22px] transition-[transform,background] [transition-duration:220ms] hover:-translate-y-[5px]"
                style={{
                  background: current
                    ? "rgba(255,255,255,.13)"
                    : "rgba(255,255,255,.05)",
                  border: `1px solid ${current ? "rgba(255,255,255,.24)" : "rgba(255,255,255,.11)"}`,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,.22)",
                }}
              >
                <div
                  className="grotesk flex h-[42px] w-[42px] items-center justify-center rounded-[14px] text-sm font-bold"
                  style={{
                    background: on
                      ? current
                        ? "#F04E23"
                        : "rgba(22,104,214,.85)"
                      : "rgba(255,255,255,.07)",
                    color: on ? "#fff" : "rgba(255,255,255,.45)",
                    border: `1px solid ${on ? "transparent" : "rgba(255,255,255,.16)"}`,
                    boxShadow: current
                      ? "0 0 28px -4px rgba(240,78,35,.95)"
                      : "none",
                  }}
                >
                  {i + 1}
                </div>
                <div
                  className="mt-3.5 text-[13.5px] font-semibold"
                  style={{ color: on ? "#fff" : "rgba(255,255,255,.6)" }}
                >
                  {step.title}
                </div>
                <div className="mt-1.5 text-xs leading-normal text-white/[.45]">
                  {step.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
