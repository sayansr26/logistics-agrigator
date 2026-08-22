/** The SUB Solution mark + wordmark, straight from the design's inline SVG. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-label="SUB Solution"
    >
      <path
        d="M52 14 L32 14 C16 14 16 30 32 32 C48 34 48 50 32 50 L12 50"
        stroke="#F04E23"
        strokeWidth="11"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M51 2 L64 14 L51 26 Z" fill="#F04E23" />
      <path d="M13 38 L0 50 L13 62 Z" fill="#F04E23" />
    </svg>
  );
}

export function Wordmark({
  className = "text-[17px]",
  // "Solution" is white on the landing page's dark canvas. Anywhere that
  // follows the app theme (the public tracking page) must pass a token colour
  // instead, or the word disappears on a light background.
  secondaryClassName = "text-white",
}: {
  className?: string;
  secondaryClassName?: string;
}) {
  return (
    <span
      className={`grotesk font-bold tracking-[-0.02em] text-[#F04E23] ${className}`}
    >
      SUB
      <span className={`font-semibold ${secondaryClassName}`}> Solution</span>
    </span>
  );
}
