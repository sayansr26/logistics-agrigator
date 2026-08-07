import { DistanceDemo } from "@/components/home/distance-demo";

/**
 * Panel 03 — the design's "free tool" panel. The interactive calculator is
 * the existing, fully-wired DistanceDemo (real /api/v1/geography APIs); it
 * picks up the new visual language through the .sland token-parity classes.
 */
export function CalculatorSection() {
  return (
    <div className="w-full max-w-[1020px]">
      <div className="text-center">
        <span className="eyebrow eyebrow-orange">FREE TOOL • NO SIGN-UP</span>
        <h2 className="mt-4 text-[clamp(27px,min(3.6vw,5.6vh),48px)] font-bold leading-[1.05] tracking-[-0.035em]">
          Distance Calculator
        </h2>
        <p className="mx-auto mt-3 max-w-[620px] text-[15.5px] leading-relaxed text-white/65">
          Straight-line distance anywhere in India—by pincode, city, state, area
          or coordinates. The same geo engine powers routing and zone pricing
          inside Subsolution.
        </p>
      </div>
      <div className="mt-7">
        <DistanceDemo />
      </div>
    </div>
  );
}
