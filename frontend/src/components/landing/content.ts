/**
 * All landing-page copy, transcribed from the approved Subsolution design
 * (claude.ai/design project "Logistics Aggregator Landing Page").
 * Sections read from here only — no copy lives inside components.
 */

export const PANEL_LABELS = [
  "Hero",
  "Network",
  "Calculator",
  "Journey",
  "Platform",
  "Setup",
  "Roles",
  "FAQ",
  "Start",
] as const;

export const PANEL_COUNT = PANEL_LABELS.length;

/** Header nav: label + target panel index (deck) / section id (stacked). */
export const NAV = [
  { label: "Calculator", index: 2 },
  { label: "Journey", index: 3 },
  { label: "Platform", index: 4 },
  { label: "Setup", index: 5 },
  { label: "FAQ", index: 7 },
] as const;

export const SECTION_IDS = [
  "hero",
  "network",
  "calculator",
  "journey",
  "platform",
  "setup",
  "roles",
  "faq",
  "get-started",
] as const;

export const HERO = {
  badge: "AI-powered shipping & COD control tower · India",
  chips: [
    "AI carrier selection",
    "Predictive RTO risk",
    "Auto COD reconciliation",
  ],
  sub: "Subsolution runs the whole operation from one panel—AI picks the right courier out of 75+, tracks parcels live, re-weighs and re-prices them automatically, and chases every rupee of cash-on-delivery back to the shipper.",
  stats: [
    { value: "75+", label: "Courier partners" },
    { value: "8", label: "User roles" },
    { value: "T+1", label: "COD settlement", accent: true },
    { value: "100%", label: "Wallet traceability" },
  ],
  mockUrl: "app.subsolution.in/delivery-surface",
  mockNav: [
    "Delivery Surface",
    "COD Settlement",
    "Wallet",
    "Shipments",
    "Couriers",
  ],
  mockRows: [
    {
      awb: "AWB 7741 0092",
      courier: "Delhivery",
      status: "Delivered",
      bg: "rgba(120,225,180,.22)",
      fg: "#8FE6BE",
    },
    {
      awb: "AWB 7741 0093",
      courier: "Blue Dart",
      status: "In transit",
      bg: "rgba(120,180,255,.22)",
      fg: "#A9CDFF",
    },
    {
      awb: "AWB 7741 0094",
      courier: "XpressBees",
      status: "Re-weighed",
      bg: "rgba(255,140,100,.22)",
      fg: "#FFAE8A",
    },
    {
      awb: "AWB 7741 0095",
      courier: "Ekart",
      status: "Picked up",
      bg: "rgba(255,255,255,.14)",
      fg: "rgba(255,255,255,.75)",
    },
  ],
};

export const MARQUEE_COURIERS = [
  "Delhivery",
  "Blue Dart",
  "DTDC",
  "Ecom Express",
  "XpressBees",
  "Shadowfax",
  "Ekart",
  "DHL",
  "FedEx",
  "India Post",
];

export const JOURNEY_STEPS = [
  { title: "Order In", desc: "Channel or CSV drops the order." },
  { title: "Book", desc: "AWB generated against the picked rate." },
  { title: "Pick Carrier", desc: "Cheapest or fastest, by pin code." },
  { title: "Wallet Debit", desc: "Freight held from the prepaid wallet." },
  { title: "Pickup", desc: "Manifest handed to the courier." },
  { title: "In Transit", desc: "Live scans pushed to the surface." },
  { title: "Delivered", desc: "POD captured and stamped." },
  { title: "COD Collected", desc: "Reconciled, approved, remitted T+1." },
];

export const FEATURES = [
  {
    n: "01",
    title: "Book across 75+ couriers",
    desc: "Choose from every serviceable courier by pin code and select the cheapest or fastest in one click.",
  },
  {
    n: "02",
    title: "Automatic weight re-rating",
    desc: "When a courier re-weighs a parcel, profit and cost are automatically recalculated.",
  },
  {
    n: "03",
    title: "COD remittance & settlement",
    desc: "Import courier reports, reconcile money received and approve release.",
  },
  {
    n: "04",
    title: "Prepaid wallet",
    desc: "Fees deducted from the wallet and reconciled automatically, down to the rupee.",
  },
  {
    n: "05",
    title: "Carrier channels by weight",
    desc: "Route shipments automatically based on configured weight and zone rules.",
  },
  {
    n: "06",
    title: "Bulk operations",
    desc: "Create large batches and update thousands of shipments together.",
  },
];

export const SETUP_STEPS = [
  {
    n: "1",
    title: "Create your team",
    desc: "Invite users and hand each one a role.",
  },
  {
    n: "2",
    title: "Add courier partners",
    desc: "Connect accounts and pull live rate cards.",
  },
  {
    n: "3",
    title: "Configure zones",
    desc: "Map pin codes to zones and service levels.",
  },
  {
    n: "4",
    title: "Build your pricing",
    desc: "Set margins per courier, weight and zone.",
  },
  {
    n: "5",
    title: "Fund the wallet",
    desc: "Top up once; freight is drawn automatically.",
  },
  {
    n: "6",
    title: "Set settlement rules",
    desc: "Define the COD cycle and approval chain.",
  },
];

export const ROLES = [
  {
    name: "Admin",
    desc: "Full control of every surface.",
    tint: "rgba(120,180,255,.28)",
    ring: "rgba(120,180,255,.4)",
  },
  {
    name: "Client",
    desc: "Books, tracks and sees own COD.",
    tint: "rgba(255,140,100,.28)",
    ring: "rgba(255,140,100,.4)",
  },
  {
    name: "Finance",
    desc: "Reconciles and releases money.",
    tint: "rgba(120,225,180,.24)",
    ring: "rgba(120,225,180,.36)",
  },
  {
    name: "Sales",
    desc: "Rate cards, margins, accounts.",
    tint: "rgba(180,160,255,.26)",
    ring: "rgba(180,160,255,.38)",
  },
  {
    name: "Support",
    desc: "Tickets, scans, escalations.",
    tint: "rgba(255,150,180,.24)",
    ring: "rgba(255,150,180,.36)",
  },
  {
    name: "Outlet",
    desc: "Counter booking and handover.",
    tint: "rgba(255,255,255,.16)",
    ring: "rgba(255,255,255,.28)",
  },
];

export const FAQS = [
  {
    q: "What can Subsolution actually do?",
    a: "It books shipments across 75+ couriers, tracks them live, re-rates them when weights change, and settles cash-on-delivery back to the shipper — all from one panel.",
  },
  {
    q: "How do I get started?",
    a: "Create your team, connect courier accounts, configure zones and pricing, fund the wallet and set settlement rules. Most operations are live within an afternoon.",
  },
  {
    q: "What happens when a courier re-weighs a parcel?",
    a: "The new weight is ingested from the courier report, cost and selling price are recalculated against your rate card, and the difference is posted to the wallet automatically.",
  },
  {
    q: "How does COD settlement work?",
    a: "Courier remittance reports are imported and matched against delivered shipments. Once reconciled, finance approves release and the payout goes out on the T+1 cycle.",
  },
  {
    q: "Can settlements run on their own?",
    a: "Yes. Set a cycle, a threshold and an approval chain — matched remittances release without anyone touching them.",
  },
  {
    q: "Does everyone see everything?",
    a: "No. Eight roles each get a scoped cockpit: clients see only their shipments, finance sees money, support sees scans and tickets.",
  },
];

export const TAGLINE = "Your Trusted Partner in Supply Chain Solutions";
