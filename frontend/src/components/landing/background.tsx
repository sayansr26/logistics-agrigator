"use client";

import { useState } from "react";

/**
 * Fixed backdrop, bottom to top:
 *   1. solid #04080F ground (from .sland)
 *   2. optional hero photo with the 34s drift animation
 *      — drop the image exported from the design project into
 *        frontend/public/landing/hero-bg.jpg to enable this layer;
 *        while the file is missing the gradient look below stands alone.
 *   3. dark vertical gradient overlay
 *   4. two radial color blobs, parallaxed by scroll (ref from use-scroll-deck)
 *   5. 76px grid lines with a radial mask
 */
export function Background({
  blobRef,
}: {
  blobRef?: (el: HTMLElement | null) => void;
}) {
  const [photoOk, setPhotoOk] = useState(true);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {photoOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/landing/hero-bg.jpg"
          alt=""
          onError={() => setPhotoOk(false)}
          className="drift absolute inset-[-6%] h-[112%] w-[112%] max-w-none object-cover"
          style={{ objectPosition: "center 66%", filter: "saturate(1.05)" }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg,rgba(4,8,15,.72) 0%,rgba(4,8,15,.82) 45%,rgba(4,8,15,.92) 100%)",
        }}
      />
      <div
        ref={blobRef}
        className="absolute inset-0 transition-transform duration-300 ease-linear"
        style={{
          background:
            "radial-gradient(46% 40% at 16% 24%,rgba(22,104,214,.5),transparent 70%),radial-gradient(42% 36% at 86% 74%,rgba(240,78,35,.32),transparent 70%)",
        }}
      />
      <div className="grid-overlay absolute inset-0" />
    </div>
  );
}
