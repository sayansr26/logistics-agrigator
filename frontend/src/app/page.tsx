"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  Package,
  PackageCheck,
  Wallet,
  Layers,
  RefreshCcw,
  Boxes,
  MapPin,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Sparkles,
  Route,
  Users,
  Banknote,
  ShieldCheck,
  Store,
  Building2,
  Headphones,
  ScanLine,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { DistanceDemo } from "@/components/home/distance-demo";

/* ------------------------------------------------------------------ */
/*  Scoped brand tokens + helpers (teal / graphite / signal-amber)     */
/* ------------------------------------------------------------------ */
const BRAND_CSS = `
.sub{
  --ground:#F5F8F7; --panel:#FFFFFF; --panel2:#EDF3F1; --line:#DEE7E3; --line2:#CBD8D2;
  --ink:#0B1114; --ink2:#3A464A; --muted:#66757A;
  --brand:#0AA396; --brand2:#12C4B4; --brandDeep:#097B71;
  --money:#C67D24; --money2:#E0963A; --good:#1E9C57; --bad:#D0424D;
  --grain:0.035;
  background:var(--ground); color:var(--ink);
}
.dark .sub{
  --ground:#070A0D; --panel:#0E151A; --panel2:#131D23; --line:#1E2A31; --line2:#2A3A42;
  --ink:#E9F1EF; --ink2:#AEBEC0; --muted:#7B8B8E;
  --brand:#2BD6C5; --brand2:#43E2D2; --brandDeep:#12B7A7;
  --money:#EAA24E; --money2:#F3B66B; --good:#37C079; --bad:#F0656F;
  --grain:0.05;
}
.sub .tink{color:var(--ink)} .sub .t2{color:var(--ink2)} .sub .tmut{color:var(--muted)}
.sub .tbrand{color:var(--brand)} .sub .tmoney{color:var(--money)}
.sub .bpanel{background:var(--panel)} .sub .bpanel2{background:var(--panel2)} .sub .bground{background:var(--ground)}
.sub .brd{border-color:var(--line)} .sub .brd2{border-color:var(--line2)}
.sub .gtext{background:linear-gradient(96deg,var(--brand),var(--brand2) 60%,var(--money));-webkit-background-clip:text;background-clip:text;color:transparent}
.sub .gbrand{background:linear-gradient(135deg,var(--brandDeep),var(--brand))}
.sub .btnb{background:linear-gradient(135deg,var(--brandDeep),var(--brand));color:#fff;border:none}
.sub .btnb:hover{filter:brightness(1.06)}
.sub .mono{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-variant-numeric:tabular-nums}
.sub .card{background:var(--panel);border:1px solid var(--line)}
.sub .glass{background:color-mix(in srgb,var(--panel) 78%,transparent);border:1px solid var(--line);backdrop-filter:blur(14px)}
.sub .hair{border-color:var(--line)}
.sub .dotline{background-image:radial-gradient(circle at 1px 1px,color-mix(in srgb,var(--muted) 40%,transparent) 1px,transparent 0);background-size:22px 22px}
.sub .grain::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:0;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");opacity:var(--grain);mix-blend-mode:overlay}
@keyframes sub-marq{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.sub .marq{animation:sub-marq 26s linear infinite}
@keyframes sub-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.sub .float{animation:sub-float 6s ease-in-out infinite}
@keyframes sub-dash{to{stroke-dashoffset:-1000}}
.sub .routing{stroke-dasharray:7 10;animation:sub-dash 9s linear infinite}
@media (prefers-reduced-motion: reduce){.sub .marq,.sub .float,.sub .routing{animation:none}}
`;

/* ------------------------------------------------------------------ */
/*  Motion helpers                                                     */
/* ------------------------------------------------------------------ */
const EASE = [0.22, 1, 0.36, 1] as const;
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};

/* ------------------------------------------------------------------ */
/*  Content                                                            */
/* ------------------------------------------------------------------ */
const COURIERS = ["Delhivery", "Blue Dart", "DTDC", "Ecom Express", "XpressBees", "Shadowfax", "Ekart", "DHL", "FedEx", "India Post"];

const JOURNEY = [
  { icon: Package, label: "Order in", sub: "store / manual", kind: "key" },
  { icon: PackageCheck, label: "Book", sub: "address · weight", kind: "key" },
  { icon: Route, label: "Pick carrier", sub: "compare rates", kind: "" },
  { icon: Wallet, label: "Wallet debit", sub: "fee held", kind: "money" },
  { icon: Truck, label: "Pickup", sub: "AWB printed", kind: "" },
  { icon: MapPin, label: "In transit", sub: "live tracking", kind: "" },
  { icon: CheckCircle2, label: "Delivered", sub: "proof captured", kind: "key" },
  { icon: Banknote, label: "COD collected", sub: "cash at door", kind: "money" },
  { icon: ScanLine, label: "Reconcile", sub: "match & verify", kind: "money" },
  { icon: Sparkles, label: "Settled", sub: "paid to shipper", kind: "money" },
];

const FEATURES = [
  { icon: Route, title: "Book across 75+ couriers", body: "One screen ranks every serviceable courier by price and speed. Pick the cheapest or fastest in a click." },
  { icon: RefreshCcw, title: "Automatic weight re-rating", body: "When a courier re-weighs, charges, profit and the wallet update together — refund the old, charge the new." },
  { icon: Banknote, title: "COD remittance & settlement", body: "Import courier reports, auto-reconcile every rupee, and pay shippers through a clean verify → approve → release trail." },
  { icon: Wallet, title: "Prepaid wallet", body: "Fees are held from a wallet and reconciled automatically. Every debit, refund and COD credit is traceable." },
  { icon: Layers, title: "Carrier channels by weight", body: "One courier, many accounts. Set weight slabs once and every parcel routes to the right account automatically." },
  { icon: Boxes, title: "Bulk operations", body: "Create shipments or update weights for thousands of parcels from one spreadsheet, with a pass/fail report." },
];

const STEPS = [
  { n: "01", title: "Create your team", body: "Invite staff, assign roles, add your outlets and warehouses." },
  { n: "02", title: "Add courier partners", body: "Enter each courier's credentials so the panel can book, label and track." },
  { n: "03", title: "Set carrier accounts", body: "Define weight slabs so parcels route to the right account on their own." },
  { n: "04", title: "Build your pricing", body: "Zones, charge rules and discounts — with courier cost so profit is tracked." },
  { n: "05", title: "Fund the wallet", body: "Load a balance; every booking holds its fee here." },
  { n: "06", title: "Set settlement rules", body: "Choose a cycle — daily · weekly · T+1 · T+2 — and how COD is paid out." },
];

const ROLES = [
  { icon: ShieldCheck, title: "Admin", body: "Runs the platform — couriers, pricing, roles and everything below." },
  { icon: Building2, title: "Client", body: "The company on the licence. Owns its team, wallet and shipments." },
  { icon: Banknote, title: "Finance", body: "Reconciles COD, verifies and releases every settlement." },
  { icon: Users, title: "Sales", body: "Books and manages shipments for assigned customers." },
  { icon: Headphones, title: "Support", body: "Handles tracking and failed-delivery cases." },
  { icon: Store, title: "Outlet", body: "The shipper — books its own parcels, sees only its own money." },
];

const FAQS = [
  { q: "What can Subsolution actually do?", a: "It runs the whole shipping operation from one place: book parcels across 75+ couriers, track them live, re-price them when the courier re-weighs, and chase every rupee of cash-on-delivery back to the shipper with a full audit trail." },
  { q: "How do I get started?", a: "Six steps, in order: create your team, add courier partners, set carrier accounts by weight slab, build your pricing, fund the wallet, then set your COD settlement rules. Each one unlocks the next — you can't ship before couriers, pricing and a funded wallet exist." },
  { q: "What happens when a courier re-weighs a parcel?", a: "Enter (or bulk-upload) the new weight. Subsolution recalculates the selling price, courier cost and profit, then squares the wallet automatically — refunding the old fee and charging the new one, so the shipper is only ever out the correct amount." },
  { q: "How does cash-on-delivery get back to the shipper?", a: "Import the courier's COD report, run auto-reconcile to match every collection to its parcel, resolve anything short/excess/missing, then generate a settlement and move it through verify → approve → release. Pay out to wallet, bank or UPI." },
  { q: "Can settlements run on their own?", a: "Yes. Configure a settlement cycle (daily, weekly, T+1 or T+2) per customer or across the board, and turn on auto-release so scheduled payouts happen without a manual click. Keep manual release for exceptions." },
  { q: "Does everyone see everything?", a: "No. Access is fenced by role. Finance lives in settlements; a warehouse outlet only ever sees its own parcels and wallet. Give each person their own login so access — and the audit trail — stays clean." },
];

const STATS = [
  { v: "75+", l: "courier partners" },
  { v: "8", l: "user roles" },
  { v: "T+1", l: "COD settlement" },
  { v: "100%", l: "wallet traceability" },
];

/* ------------------------------------------------------------------ */
/*  Brand mark                                                         */
/* ------------------------------------------------------------------ */
function Mark({ size = 34 }: { size?: number }) {
  return (
    <span
      className="gbrand grid place-items-center rounded-[11px] text-white shadow-lg"
      style={{ width: size, height: size, boxShadow: "0 8px 22px -8px var(--brand)" }}
    >
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5" cy="6" r="2" /><circle cx="19" cy="18" r="2" />
        <path d="M7 6h6a4 4 0 0 1 0 8H11a4 4 0 0 0 0 8" opacity="0" />
        <path d="M7 6h5a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h8" />
      </svg>
    </span>
  );
}

function Eyebrow({ index, children }: { index: string; children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-center gap-2.5">
      <span className="mono tbrand text-xs font-semibold">{index}</span>
      <span className="hair h-px w-6 border-t" />
      <span className="mono tmut text-xs font-semibold uppercase tracking-[0.2em]">{children}</span>
    </div>
  );
}

function SectionHead({ index, eyebrow, title, sub }: { index: string; eyebrow: string; title: string; sub?: string }) {
  return (
    <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} className="mx-auto max-w-2xl text-center">
      <motion.div variants={fadeUp}><Eyebrow index={index}>{eyebrow}</Eyebrow></motion.div>
      <motion.h2 variants={fadeUp} className="tink text-balance text-3xl font-extrabold tracking-tight sm:text-[2.6rem] sm:leading-[1.08]">{title}</motion.h2>
      {sub && <motion.p variants={fadeUp} className="t2 mx-auto mt-4 max-w-xl text-lg">{sub}</motion.p>}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */
export default function HomePage() {
  const reduce = useReducedMotion();

  return (
    <div className="sub min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: BRAND_CSS }} />

      {/* ---------------- Header ---------------- */}
      <header className="glass fixed inset-x-0 top-0 z-50 border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Mark />
            <span className="tink text-lg font-extrabold tracking-tight">Subsolution</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            {[["Distance Calculator", "#try"], ["Journey", "#journey"], ["Platform", "#features"], ["Setup", "#how"], ["FAQ", "#faq"]].map(([label, href]) => (
              <a key={href} href={href} className="t2 text-sm font-medium transition-colors hover:opacity-70">{label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild className="tink hidden sm:inline-flex hover:bg-[var(--panel2)]"><Link href="/auth/login">Log in</Link></Button>
            <Button asChild className="btnb group h-10 px-5 shadow-lg"><Link href="/auth/login">Get started<ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></Link></Button>
          </div>
        </div>
      </header>

      {/* ---------------- Hero (asymmetric) ---------------- */}
      <section className="grain relative overflow-hidden pt-28 pb-20 sm:pt-36">
        <div className="dotline pointer-events-none absolute inset-0 -z-10 opacity-[0.5] [mask-image:radial-gradient(80%_60%_at_30%_10%,black,transparent)]" />
        <div className="pointer-events-none absolute -left-40 top-0 -z-10 h-[34rem] w-[34rem] rounded-full opacity-30 blur-[120px]" style={{ background: "radial-gradient(circle,var(--brand),transparent 65%)" }} />
        <div className="pointer-events-none absolute -right-32 top-40 -z-10 h-[26rem] w-[26rem] rounded-full opacity-25 blur-[120px]" style={{ background: "radial-gradient(circle,var(--money),transparent 65%)" }} />

        <div className="container relative mx-auto grid items-center gap-14 px-4 lg:grid-cols-[1.05fr_0.95fr]">
          {/* left copy */}
          <motion.div variants={stagger} initial="hidden" animate="show">
            <motion.div variants={fadeUp}>
              <span className="glass tmut inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm">
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: "var(--brand)" }} /><span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "var(--brand)" }} /></span>
                Shipping &amp; COD control tower · India
              </span>
            </motion.div>

            <motion.h1 variants={fadeUp} className="tink mt-6 text-[2.7rem] font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-6xl">
              Ship anywhere.<br />Settle <span className="gtext">every rupee.</span>
            </motion.h1>

            <motion.p variants={fadeUp} className="t2 mt-6 max-w-xl text-lg leading-relaxed">
              <b className="tink">Subsolution</b> runs the whole operation from one panel — book across 75+ couriers,
              track parcels live, re-weigh and re-price them automatically, and chase every rupee of
              cash-on-delivery back to the shipper.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-9 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild className="btnb group h-12 px-7 text-base shadow-xl"><Link href="/auth/login">Start shipping<ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" /></Link></Button>
              <Button size="lg" variant="outline" asChild className="brd2 tink h-12 bg-transparent px-7 text-base hover:bg-[var(--panel2)]"><a href="#journey">See how it works<ArrowUpRight className="ml-1.5 h-4 w-4" /></a></Button>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-11 grid max-w-lg grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.l}>
                  <div className="mono gtext text-2xl font-extrabold tracking-tight">{s.v}</div>
                  <div className="tmut mt-0.5 text-xs">{s.l}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* right: live product mock */}
          <motion.div initial={{ opacity: 0, y: 40, rotateX: 8 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.15 }} className="relative [perspective:1200px]">
            <div className={reduce ? "" : "float"}>
              {/* route backdrop */}
              <svg className="pointer-events-none absolute -inset-6 -z-0 h-[calc(100%+3rem)] w-[calc(100%+3rem)]" viewBox="0 0 400 380" fill="none" aria-hidden="true">
                <path id="subroute" d="M40 60 C 140 20, 180 160, 300 120 S 380 300, 250 330" stroke="var(--brand)" strokeWidth="2" className="routing" opacity="0.45" />
                <circle cx="40" cy="60" r="4" fill="var(--brand)" /><circle cx="250" cy="330" r="4" fill="var(--money)" />
                {!reduce && (
                  <circle r="5" fill="var(--brand2)">
                    <animateMotion dur="6s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                      <mpath href="#subroute" />
                    </animateMotion>
                  </circle>
                )}
              </svg>

              {/* card: shipment */}
              <div className="card relative z-10 rounded-2xl p-5 shadow-2xl" style={{ boxShadow: "0 40px 80px -40px rgba(0,0,0,0.5)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="gbrand grid h-8 w-8 place-items-center rounded-lg text-white"><Truck className="h-4 w-4" /></span>
                    <div><div className="tink text-sm font-bold">Delhivery Surface</div><div className="mono tmut text-[11px]">AWB 3491 0022 8817</div></div>
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "color-mix(in srgb,var(--good) 16%,transparent)", color: "var(--good)" }}>In transit</span>
                </div>
                <div className="brd my-4 flex items-center justify-between rounded-xl border bg-[var(--panel2)] px-3.5 py-3">
                  <div><div className="tmut text-[11px]">From</div><div className="tink mono text-sm font-semibold">560001</div></div>
                  <div className="tbrand flex-1 px-3"><div className="hair border-t border-dashed" /></div>
                  <MapPin className="tbrand h-4 w-4" />
                  <div className="tbrand flex-1 px-3"><div className="hair border-t border-dashed" /></div>
                  <div className="text-right"><div className="tmut text-[11px]">To</div><div className="tink mono text-sm font-semibold">400053</div></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[["Weight", "3.0 kg"], ["Selling", "₹98"], ["Profit", "₹31"]].map(([k, v]) => (
                    <div key={k} className="brd rounded-lg border bg-[var(--panel2)] px-2.5 py-2">
                      <div className="tmut text-[10px] uppercase tracking-wide">{k}</div>
                      <div className="tink mono text-sm font-bold">{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* card: settlement (offset) */}
              <div className="glass absolute -bottom-10 -left-6 z-20 w-[62%] rounded-2xl p-4 shadow-2xl sm:-left-10">
                <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: "color-mix(in srgb,var(--money) 18%,transparent)", color: "var(--money)" }}><Banknote className="h-4 w-4" /></span><span className="tink text-xs font-bold">COD Settlement</span><span className="mono tmut ml-auto text-[10px]">STL-4471</span></div>
                <div className="mt-3 flex items-end justify-between">
                  <div><div className="tmut text-[10px]">Net payable</div><div className="tink mono text-xl font-extrabold">₹1,24,850</div></div>
                  <span className="rounded-full px-2 py-1 text-[10px] font-bold" style={{ background: "color-mix(in srgb,var(--good) 18%,transparent)", color: "var(--good)" }}>Released</span>
                </div>
                <div className="mt-3 flex gap-1.5">
                  {["Draft", "Verify", "Approve", "Release"].map((s, i) => (
                    <div key={s} className="flex-1"><div className="h-1 rounded-full" style={{ background: i <= 3 ? "var(--good)" : "var(--line2)" }} /><div className="tmut mt-1 text-[8px]">{s}</div></div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* courier ticker */}
        <div className="relative mt-24 overflow-hidden py-5" style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[var(--ground)] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[var(--ground)] to-transparent" />
          <div className="marq flex w-max items-center gap-12">
            {[...COURIERS, ...COURIERS].map((c, i) => (
              <span key={i} className="tmut flex items-center gap-2 text-sm font-semibold whitespace-nowrap"><Truck className="tbrand h-4 w-4" />{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Live demo: distance calculator ---------------- */}
      <section id="try" className="grain relative py-24">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(60%_50%_at_50%_50%,black,transparent)]">
          <div className="dotline absolute inset-0 opacity-40" />
        </div>
        <div className="container mx-auto px-4">
          <SectionHead
            index="00"
            eyebrow="Free tool · no sign-up"
            title="Distance Calculator"
            sub="Straight-line distance anywhere in India — by pincode, city, state, area or coordinates. The same geo engine that powers rating and zone pricing inside Subsolution."
          />
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="mx-auto mt-12 max-w-4xl"
          >
            <DistanceDemo />
          </motion.div>
        </div>
      </section>

      {/* ---------------- Journey ---------------- */}
      <section id="journey" className="py-24">
        <div className="container mx-auto px-4">
          <SectionHead index="01" eyebrow="The journey" title="A parcel's whole life, in ten beats" sub="Teal stops are where a person acts; amber stops are where money moves. Everything after delivery is getting cash safely back to the shipper." />
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={stagger} className="mt-14 overflow-x-auto pb-4">
            <div className="relative mx-auto flex min-w-[920px] items-start justify-between gap-2 px-2">
              <div className="brd2 absolute left-8 right-8 top-7 border-t border-dashed" />
              <motion.div aria-hidden className="absolute left-8 top-[27px] h-0.5" style={{ background: "linear-gradient(90deg,var(--brand),var(--money))" }} initial={{ width: "0%" }} whileInView={{ width: "calc(100% - 4rem)" }} viewport={{ once: true }} transition={{ duration: 1.4, ease: EASE }} />
              {!reduce && <motion.span aria-hidden className="absolute top-[22px] z-10 h-3 w-3 rounded-full" style={{ background: "var(--brand2)", boxShadow: "0 0 0 4px color-mix(in srgb,var(--brand) 35%,transparent)" }} animate={{ left: ["2rem", "calc(100% - 2.75rem)"] }} transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.5 }} />}
              {JOURNEY.map((s) => {
                const Icon = s.icon;
                const cls = s.kind === "key" ? "gbrand border-transparent text-white" : s.kind === "money" ? "card tmoney" : "card tbrand";
                return (
                  <motion.div key={s.label} variants={fadeUp} className="relative z-[1] flex flex-1 flex-col items-center text-center">
                    <div className={`grid h-14 w-14 place-items-center rounded-2xl border ${cls}`} style={s.kind === "money" ? { borderColor: "color-mix(in srgb,var(--money) 45%,var(--line))" } : undefined}><Icon className="h-6 w-6" /></div>
                    <div className="tink mt-3 text-sm font-semibold">{s.label}</div>
                    <div className="tmut mt-0.5 text-xs">{s.sub}</div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section id="features" className="bpanel2 border-y py-24 brd">
        <div className="container mx-auto px-4">
          <SectionHead index="02" eyebrow="The platform" title="Everything the operation needs" sub="From the first booking to the final payout — the capabilities that run the day." />
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={stagger} className="mx-auto mt-14 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <motion.div key={f.title} variants={fadeUp} whileHover={reduce ? undefined : { y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 22 }} className="card group relative overflow-hidden rounded-2xl p-6">
                  <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-[0.12] blur-2xl transition-opacity group-hover:opacity-25" style={{ background: "var(--brand)" }} />
                  <span className="gbrand inline-grid h-12 w-12 place-items-center rounded-xl text-white shadow-lg"><Icon className="h-6 w-6" /></span>
                  <h3 className="tink mt-5 text-lg font-bold tracking-tight">{f.title}</h3>
                  <p className="t2 mt-2 text-sm leading-relaxed">{f.body}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ---------------- Setup ---------------- */}
      <section id="how" className="py-24">
        <div className="container mx-auto px-4">
          <SectionHead index="03" eyebrow="Getting started" title="Set it up once, then run it every day" sub="Six steps, in order — each one unlocks the next. You can't ship before couriers, pricing and a funded wallet exist." />
          <motion.ol initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={stagger} className="mx-auto mt-14 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s) => (
              <motion.li key={s.n} variants={fadeUp} className="card relative overflow-hidden rounded-2xl p-6">
                <span className="mono absolute right-4 top-3 text-4xl font-extrabold opacity-[0.08]">{s.n}</span>
                <span className="gtext mono text-sm font-bold">STEP {s.n}</span>
                <h3 className="tink mt-2 text-base font-bold tracking-tight">{s.title}</h3>
                <p className="t2 mt-2 text-sm leading-relaxed">{s.body}</p>
              </motion.li>
            ))}
          </motion.ol>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease: EASE }} className="mx-auto mt-8 flex max-w-5xl items-center gap-3 rounded-2xl border p-4 text-sm" style={{ background: "color-mix(in srgb,var(--good) 10%,transparent)", borderColor: "color-mix(in srgb,var(--good) 30%,transparent)" }}>
            <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: "var(--good)" }} />
            <span className="t2"><b className="tink">Setup done.</b> With a team, couriers, pricing and a funded wallet in place, you're ready to ship — everything else is day-to-day.</span>
          </motion.div>
        </div>
      </section>

      {/* ---------------- Roles ---------------- */}
      <section className="bpanel2 border-y py-24 brd">
        <div className="container mx-auto px-4">
          <SectionHead index="04" eyebrow="Who it's for" title="A cockpit for every person" sub="What you see and can touch depends on your role. Access is fenced off automatically." />
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={stagger} className="mx-auto mt-14 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ROLES.map((r) => {
              const Icon = r.icon;
              return (
                <motion.div key={r.title} variants={fadeUp} className="card flex items-start gap-4 rounded-2xl p-5">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: "color-mix(in srgb,var(--brand) 14%,transparent)", color: "var(--brand)" }}><Icon className="h-5 w-5" /></span>
                  <div><h3 className="tink font-bold tracking-tight">{r.title}</h3><p className="t2 mt-1 text-sm">{r.body}</p></div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section id="faq" className="py-24">
        <div className="container mx-auto px-4">
          <SectionHead index="05" eyebrow="Questions" title="Frequently asked" />
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.6, ease: EASE }} className="mx-auto mt-12 max-w-3xl">
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((f, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="card mb-3 rounded-2xl px-5 data-[state=open]:brd2">
                  <AccordionTrigger className="tink py-5 text-left text-base font-semibold hover:no-underline">{f.q}</AccordionTrigger>
                  <AccordionContent className="t2 pb-5 text-[15px] leading-relaxed">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="px-4 py-20">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.7, ease: EASE }} className="grain container relative mx-auto overflow-hidden rounded-[28px] px-6 py-16 text-center shadow-2xl" style={{ background: "linear-gradient(135deg,var(--brandDeep),var(--brand) 55%,var(--money))" }}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(40%_60%_at_15%_0%,rgba(255,255,255,0.22),transparent),radial-gradient(40%_70%_at_92%_100%,rgba(0,0,0,0.18),transparent)]" />
          <div className="relative">
            <h2 className="text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Ready to ship smarter?</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/85">Get your team, couriers and wallet set up in an afternoon — then let Subsolution run booking, re-rating and COD settlement for you.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild className="group h-12 bg-white px-8 text-base font-semibold text-[var(--brandDeep)] hover:bg-white/90"><Link href="/auth/login">Get started<ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" /></Link></Button>
              <Button size="lg" variant="outline" asChild className="h-12 border-white/40 bg-white/10 px-8 text-base text-white hover:bg-white/20 hover:text-white"><Link href="/auth/login">Log in</Link></Button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t py-12 brd">
        <div className="container mx-auto flex flex-col items-center justify-between gap-6 px-4 sm:flex-row">
          <div className="flex items-center gap-2.5"><Mark size={30} /><span className="tink font-bold tracking-tight">Subsolution</span></div>
          <p className="tmut text-sm">Multi-courier shipping &amp; COD control tower · Built for Indian e-commerce.</p>
          <div className="flex items-center gap-4 text-sm">
            <a href="#features" className="t2 hover:opacity-70">Platform</a>
            <a href="#faq" className="t2 hover:opacity-70">FAQ</a>
            <Link href="/auth/login" className="tbrand font-medium hover:underline">Log in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
