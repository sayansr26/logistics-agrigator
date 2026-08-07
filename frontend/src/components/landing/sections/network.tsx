import { MARQUEE_COURIERS } from "../content";

export function NetworkSection() {
  const items = [...MARQUEE_COURIERS, ...MARQUEE_COURIERS];
  return (
    <div className="glass w-full max-w-[1120px] overflow-hidden rounded-[32px] px-6 py-[clamp(38px,6vh,64px)] text-center shadow-[0_50px_110px_-50px_rgba(0,0,0,.9)] sm:px-12">
      <div className="mono text-[11px] tracking-[.18em] text-white/[.45]">
        BOOKING LIVE ACROSS
      </div>
      <h2 className="mt-4 text-[clamp(27px,min(3.6vw,5.6vh),50px)] font-bold leading-[1.05] tracking-[-0.035em]">
        One panel. Seventy-five carriers.
      </h2>
      <p className="mx-auto mt-3.5 max-w-[600px] text-base leading-relaxed text-white/[.66]">
        Every serviceable courier by pin code, rate-compared and booked without
        leaving the surface.
      </p>
      <div
        className="-mx-6 mt-10 overflow-hidden sm:-mx-12"
        style={{
          maskImage:
            "linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)",
          WebkitMaskImage:
            "linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)",
        }}
      >
        <div className="marq flex w-max">
          {items.map((name, i) => (
            <div
              key={`${name}-${i}`}
              className="flex items-center gap-2.5 px-[26px]"
            >
              <div className="h-6 w-6 rounded-lg border border-white/[.14] bg-white/[.14]" />
              <span className="grotesk whitespace-nowrap text-[17px] font-semibold tracking-[-0.01em] text-white/[.62]">
                {name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
