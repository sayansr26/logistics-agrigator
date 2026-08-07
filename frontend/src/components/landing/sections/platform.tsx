import { FEATURES } from "../content";

export function PlatformSection() {
  return (
    <div className="w-full max-w-[1240px]">
      <div className="max-w-[660px]">
        <span className="eyebrow eyebrow-blue">THE PLATFORM</span>
        <h2 className="mt-4 text-[clamp(27px,min(3.6vw,5.6vh),50px)] font-bold leading-[1.05] tracking-[-0.035em]">
          Everything the operation needs
        </h2>
        <p className="mt-3 text-[15.5px] leading-relaxed text-white/65">
          From the first booking to the final payout—the capabilities that run
          the day.
        </p>
      </div>
      <div className="mt-[30px] grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.n}
            className="card group relative overflow-hidden rounded-[22px] px-[22px] pb-[26px] pt-6 shadow-[0_30px_60px_-44px_rgba(0,0,0,.9)] transition-[transform,background] [transition-duration:220ms] hover:-translate-y-1.5 hover:bg-white/[.12]"
          >
            <div className="absolute left-0 right-0 top-0 h-0.5 bg-gradient-to-r from-[#1668D6] to-[#F04E23] opacity-90" />
            <div className="mono flex h-[38px] w-[38px] items-center justify-center rounded-[13px] border border-white/[.16] bg-white/[.12] text-[12.5px] font-medium text-[#FF9068]">
              {f.n}
            </div>
            <h3 className="mt-4 text-[18.5px] font-semibold tracking-[-0.02em]">
              {f.title}
            </h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-white/60 [text-wrap:pretty]">
              {f.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
