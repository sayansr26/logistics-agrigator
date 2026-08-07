import { SETUP_STEPS } from "../content";

export function SetupSection() {
  return (
    <div className="w-full max-w-[1240px]">
      <div className="max-w-[660px]">
        <span className="eyebrow eyebrow-plain">GETTING STARTED</span>
        <h2 className="mt-4 text-[clamp(27px,min(3.6vw,5.6vh),50px)] font-bold leading-[1.05] tracking-[-0.035em]">
          Set it up once, then run it every day
        </h2>
      </div>
      <div className="mt-7 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {SETUP_STEPS.map((s) => (
          <div
            key={s.n}
            className="card flex items-start gap-[15px] rounded-[20px] p-[22px] transition-transform [transition-duration:220ms] hover:-translate-y-[5px]"
          >
            <div className="btnb grotesk flex h-8 w-8 flex-none items-center justify-center rounded-[11px] text-[13px] font-bold">
              {s.n}
            </div>
            <div>
              <div className="grotesk text-base font-semibold tracking-[-0.015em]">
                {s.title}
              </div>
              <p className="mt-1.5 text-[13px] leading-normal text-white/60">
                {s.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="glass mt-[18px] flex items-center gap-[13px] rounded-[18px] px-[22px] py-4">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F04E23] text-[13px] font-bold text-white"
          style={{ boxShadow: "0 0 20px -2px rgba(240,78,35,.9)" }}
        >
          ✓
        </span>
        <span className="text-[15px] font-medium">
          Setup done. Everything is now ready to ship.
        </span>
      </div>
    </div>
  );
}
