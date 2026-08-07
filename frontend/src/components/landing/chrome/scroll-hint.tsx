"use client";

/** Bottom-center pill inviting the first scroll — fades once the deck moves. */
export function ScrollHint({ visible }: { visible: boolean }) {
  return (
    <div
      className="pointer-events-none fixed bottom-[22px] left-0 right-0 z-[80] flex justify-center transition-opacity [transition-duration:400ms]"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div className="flex items-center gap-2.5 rounded-full border border-white/[.16] bg-white/[.08] px-4 py-2 text-xs text-white/70 backdrop-blur-[20px]">
        <svg
          width="14"
          height="20"
          viewBox="0 0 14 20"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="1"
            y="1"
            width="12"
            height="18"
            rx="6"
            stroke="rgba(255,255,255,.55)"
            strokeWidth="1.5"
          />
          <circle className="wheel-dot" cx="7" cy="6" r="1.6" fill="#F04E23" />
        </svg>
        Scroll to move through the operation
      </div>
    </div>
  );
}
