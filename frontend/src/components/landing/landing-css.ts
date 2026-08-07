/**
 * Scoped styles for the Subsolution landing page.
 *
 * `.sland` defines the design's dark glass token set AND the same utility
 * class names the old landing CSS exposed (`card`, `mono`, `tink`, `t2`,
 * `tmut`, `brd`, `btnb`, `tbrand`, `gtext`, …) so that `DistanceDemo`
 * renders in the new visual language without a single code change.
 *
 * `html.landing-snap` rules apply only while the deck layout is mounted —
 * the orchestrator toggles the class and removes it on unmount, so scroll
 * snapping never leaks into other routes.
 */
export const LANDING_CSS = `
.sland{
  --ground:#04080F;
  --panel:rgba(255,255,255,.07); --panel2:rgba(255,255,255,.04);
  --line:rgba(255,255,255,.14); --line2:rgba(255,255,255,.22);
  --ink:#FFFFFF; --ink2:rgba(255,255,255,.75); --muted:rgba(255,255,255,.55);
  --brand:#F04E23; --brand2:#FF7A45; --brandSoft:#FF8B5E;
  --blue:#1668D6; --blueSoft:#A9CDFF;
  --money:#FF8B5E; --good:#8FE6BE; --bad:#FF8A93;
  background:var(--ground); color:var(--ink);
  font-family:var(--font-plex),"IBM Plex Sans",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;
}
.sland h1,.sland h2,.sland h3,.sland .grotesk{font-family:var(--font-grotesk),"Space Grotesk",sans-serif}
.sland .mono{font-family:var(--font-plex-mono),"IBM Plex Mono",ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums}

.sland .tink{color:var(--ink)} .sland .t2{color:var(--ink2)} .sland .tmut{color:var(--muted)}
.sland .tbrand{color:var(--brandSoft)} .sland .tmoney{color:var(--money)}
.sland .brd{border-color:var(--line)} .sland .brd2{border-color:var(--line2)}
.sland .bpanel{background:var(--panel)} .sland .bpanel2{background:var(--panel2)}

.sland .card{
  background:var(--panel);border:1px solid var(--line);
  backdrop-filter:blur(18px) saturate(170%);-webkit-backdrop-filter:blur(18px) saturate(170%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.18);
}
.sland .glass{
  background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.2);
  backdrop-filter:blur(18px) saturate(170%);-webkit-backdrop-filter:blur(18px) saturate(170%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.25);
}
.sland .gtext{background:linear-gradient(100deg,#FF8B5E,#F04E23);-webkit-background-clip:text;background-clip:text;color:transparent}
.sland .btnb{
  background:linear-gradient(140deg,#FF7A45,#F04E23);color:#fff;border:none;
  box-shadow:0 18px 40px -16px rgba(240,78,35,.9),inset 0 1px 0 rgba(255,255,255,.35);
}
.sland .btnb:hover{filter:brightness(1.1)}
.sland .eyebrow{
  display:inline-flex;padding:6px 14px;border-radius:999px;
  font-family:var(--font-plex-mono),"IBM Plex Mono",monospace;
  font-size:11px;letter-spacing:.14em;font-weight:500;
}
.sland .eyebrow-orange{background:rgba(240,78,35,.16);border:1px solid rgba(240,78,35,.34);color:#FF9068}
.sland .eyebrow-blue{background:rgba(22,104,214,.22);border:1px solid rgba(120,180,255,.32);color:#A9CDFF}
.sland .eyebrow-plain{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.75)}

.sland input{color:var(--ink)}
.sland input::placeholder{color:rgba(255,255,255,.35)}
.sland select{background:transparent;color:var(--ink)}
.sland select option{background:#0B1420;color:#fff}
.sland a{text-decoration:none}

.sland .grid-overlay{
  background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);
  background-size:76px 76px;
  mask-image:radial-gradient(80% 70% at 50% 45%,#000,transparent);
  -webkit-mask-image:radial-gradient(80% 70% at 50% 45%,#000,transparent);
}

@keyframes sland-marq{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.sland .marq{animation:sland-marq 32s linear infinite}
@keyframes sland-pulse{0%,100%{opacity:1}50%{opacity:.25}}
.sland .pulse-dot{animation:sland-pulse 2.2s ease-in-out infinite}
@keyframes sland-drift{0%,100%{transform:scale(1.08) translate3d(0,0,0)}50%{transform:scale(1.14) translate3d(-1.5%,-1%,0)}}
.sland .drift{animation:sland-drift 34s ease-in-out infinite}
@keyframes sland-wheel{0%{transform:translateY(0);opacity:1}65%{transform:translateY(5px);opacity:0}100%{transform:translateY(0);opacity:0}}
.sland .wheel-dot{animation:sland-wheel 1.6s ease-out infinite}

@media (prefers-reduced-motion: reduce){
  .sland .marq,.sland .pulse-dot,.sland .drift,.sland .wheel-dot{animation:none}
}

html.landing-snap{
  scroll-snap-type:y mandatory;scroll-behavior:smooth;
  scrollbar-width:none;-ms-overflow-style:none;
}
html.landing-snap::-webkit-scrollbar,html.landing-snap body::-webkit-scrollbar{width:0;height:0;display:none}
html.landing-snap body{overflow-x:hidden}
`;
