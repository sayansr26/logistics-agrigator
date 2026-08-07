import { ROLES } from "../content";

export function RolesSection() {
  return (
    <div className="w-full max-w-[1240px]">
      <div className="max-w-[660px]">
        <span className="eyebrow eyebrow-blue">WHO IT&apos;S FOR</span>
        <h2 className="mt-4 text-[clamp(27px,min(3.6vw,5.6vh),50px)] font-bold leading-[1.05] tracking-[-0.035em]">
          A cockpit for every person
        </h2>
        <p className="mt-3 text-[15.5px] leading-relaxed text-white/65">
          What you see and can touch depends on your role.
        </p>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
        {ROLES.map((r) => (
          <div
            key={r.name}
            className="card rounded-[20px] px-[18px] pb-[22px] pt-5 transition-[transform,background] [transition-duration:220ms] hover:-translate-y-[5px] hover:bg-white/[.13]"
          >
            <div
              className="h-[34px] w-[34px] rounded-xl"
              style={{ background: r.tint, border: `1px solid ${r.ring}` }}
            />
            <div className="grotesk mt-4 text-base font-semibold">{r.name}</div>
            <div className="mt-1.5 text-xs leading-normal text-white/55">
              {r.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
