"use client";

/**
 * Charge prompt playground — ready-to-use AI drafter prompts, one per charge
 * archetype.
 *
 * The drafter's system prompt already carries the engine contract, the existing
 * charge codes and the partner's zone UUIDs; a description only has to pin down
 * what the model would otherwise guess. Each template below spells out the three
 * things that fail SILENTLY when guessed wrong — the applyStage, the config
 * shape, and the phase — so a drafted config actually reaches a quote.
 *
 * Shapes here mirror services/chargeEngine/calculators.js. Rupee figures are
 * starting points: the picker loads them into the textarea so they can be edited
 * before drafting.
 */

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, AlertTriangle, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PromptTemplate {
  id: string;
  label: string;
  /** Charge category badge, matches the engine's CATEGORY_VALUES. */
  category: string;
  /** Compact contract line shown under the title. */
  meta: string;
  /** One sentence on when to reach for this archetype. */
  when: string;
  /** The silent failure this template's wording is written to prevent. */
  pitfall: string;
  prompt: string;
}

export const CHARGE_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "insurance",
    label: "Insurance",
    category: "VAS",
    meta: "BOOKING_OPTION · phase 500 · PERCENT_WITH_MIN + optionsBy",
    when: "One booking question selects between rate tiers of the same charge.",
    pitfall:
      "With optionsBy set, the config is indexed by the answer. A flat {percent, minAmount} makes the lookup undefined and the charge vanishes with no error.",
    prompt: `Create one new VAS charge called "Insurance Charge", code INSURANCE_CHARGE,
applied at the BOOKING_OPTION stage with phase 500.

It must ask the customer exactly one booking question at booking time:
a "select" with key "insuranceType", label "Insurance Type", and two options —
value OWNER_RISK labelled "Owner Risk", and value CARRIER_RISK labelled "Carrier Risk".
The question has no default, so the customer can skip insurance entirely.

Compute it with method PERCENT_WITH_MIN on basis INVOICE_VALUE, and set
"optionsBy": "insuranceType" so the rate is chosen by the customer's answer.
The config must therefore be keyed by option value, not flat:
Owner Risk = 0.1 percent with a minimum of 50 rupees, and
Carrier Risk = 0.6 percent with a minimum of 200 rupees.

Flags: taxable true, fuelApplicable false. Active.
Do not create separate OWNER_RISK_CHARGE or CARRIER_RISK_CHARGE definitions —
this single definition covers both options through optionsBy.`,
  },
  {
    id: "packaging",
    label: "Packaging",
    category: "VAS",
    meta: "BOOKING_OPTION · phase 400 · OPTION_RATE + perBox",
    when: "Add-ons priced as a fixed amount per choice, optionally per box.",
    pitfall:
      "Leaving an option out of the rates map is how you make it free — the calculator returns null for a missing or non-positive rate.",
    prompt: `Create one new VAS charge called "Packaging Charge", code PACKAGING_CHARGE,
applied at the BOOKING_OPTION stage with phase 400.

Ask exactly one booking question: a "select" with key "packagingType",
label "Packaging", with three options — value NONE labelled "No extra packaging",
value BUBBLE_WRAP labelled "Bubble wrap", and value WOODEN_CRATE labelled
"Wooden crate". No default, so the customer can skip it.

Compute it with method OPTION_RATE on basis ANSWER_VALUE with
"answerPath": "packagingType". The rate is charged per box, so set "perBox": true.
Rates: BUBBLE_WRAP = 40 rupees per box, WOODEN_CRATE = 250 rupees per box.
Do not put NONE in the rates map — an option with no rate must add nothing.

Flags: taxable true, fuelApplicable false. Active.`,
  },
  {
    id: "appointment",
    label: "Appointment",
    category: "VAS",
    meta: "BOOKING_OPTION · phase 400 · FLAT + followUp",
    when: "Opting in reveals a detail field — a slot, a window, a declared value.",
    pitfall:
      "A question with a followUp stores its answer as {enabled: value}. Conditions must read answers.<key>.enabled — answers.<key> is an object, always truthy, so the charge applies even when declined.",
    prompt: `Create one new VAS charge called "Appointment Delivery", code APPOINTMENT_DELIVERY,
applied at the BOOKING_OPTION stage with phase 400.

Ask one booking question: a "boolean" with key "appointmentDelivery",
label "Schedule a delivery appointment". Add a followUp shown when the answer is
true: key "slot", label "Preferred slot", type "datetime".

Compute it with method FLAT on basis NONE. The config is a flat 250 rupees.

Because the question has a followUp, the answer is stored as an object, so gate
the charge on the nested flag: conditions all — fact "answers.appointmentDelivery.enabled",
op "truthy".

Flags: taxable true, fuelApplicable false. Active.`,
  },
  {
    id: "fragile",
    label: "Fragile handling",
    category: "VAS",
    meta: "QUOTE · phase 400 · FLAT gated on isFragile",
    when: "The booking form already collects the answer — gate on the fact, don't ask again.",
    pitfall:
      "Do not give this a bookingQuestion or the BOOKING_OPTION stage. The create-shipment form already has a 'This shipment contains fragile items' checkbox, which arrives as the isFragile fact; a question would ask the customer the same thing twice and the two answers could disagree.",
    prompt: `Create one new VAS charge called "Fragile Handling Charge", code FRAGILE_HANDLING_CHARGE,
applied at the QUOTE stage with phase 400.

It has NO booking question. The create-shipment form already collects this with its
"This shipment contains fragile items" checkbox, which reaches the engine as the
isFragile fact — do not ask the customer a second time.

Gate it on that fact: conditions all — fact "isFragile", op "truthy".

Compute it with method FLAT on basis NONE. The config is a flat 75 rupees per
shipment.

Flags: fuelApplicable true, taxable true. Active.

(To scale it by weight instead of a flat fee, switch to method PER_UNIT on basis
CHARGEABLE_WEIGHT with "perUnit": 10, "unitSize": 1, "minAmount": 75, and keep the
same isFragile condition.)`,
  },
  {
    id: "cod",
    label: "COD fee",
    category: "COD",
    meta: "QUOTE · phase 500 · PERCENT_WITH_MIN",
    when: "Percentage-with-floor on the collected amount, gated to COD shipments.",
    pitfall:
      "COD_PERCENT_WITH_MIN may already exist. The drafter reuses existing codes rather than duplicating, so expect an empty definitions list and a config against the existing one.",
    prompt: `Create one new COD charge called "COD Collection Fee", code COD_COLLECTION_FEE,
applied at the QUOTE stage with phase 500. It has no booking question.

Compute it with method PERCENT_WITH_MIN on basis COD_AMOUNT. The config is flat,
not keyed: 2 percent with a minimum of 35 rupees.

Apply it only to cash-on-delivery shipments: conditions all — fact "paymentType",
op "eq", value "COD".

Flags: taxable true, fuelApplicable false. Active.`,
  },
  {
    id: "base-freight",
    label: "Base freight",
    category: "BASE",
    meta: "QUOTE · phase 100 · rate card",
    when: "The partner's tariff table. One rate card covering every distance band.",
    pitfall:
      "Give the rate and the minimum freight separately, and include a worked example per band. The examples are replayed through the real pricing engine — if they do not reproduce, the card is rejected before it can misprice anything.",
    prompt: `Set up base freight for this partner.

Billing unit: 1 kg. (This is the slab the weight is rounded up to, not a rate.)

Zone A: 0 to 50 km — rate 26 per kg, minimum freight 130
Zone B: 51 to 500 km — rate 32 per kg, minimum freight 160
Zone C: 501 to 1400 km — rate 38 per kg, minimum freight 180
Zone D: above 1400 km — rate 46 per kg, minimum freight 220

Freight = MAX(zone minimum, CEILING(chargeable weight / billing unit) x zone rate)

Worked examples:
30 km, 3 kg -> 130
350 km, 8 kg -> 256
900 km, 4 kg -> 180
1800 km, 10 kg -> 460`,
  },
  {
    id: "oda",
    label: "Special surcharge",
    category: "SURCHARGE",
    meta: "QUOTE · phase 300 · PER_UNIT + perSide",
    when: "Location-driven surcharges: ODA, hill area, metro, North East.",
    pitfall:
      "The side.pincodeType fact only resolves when aggregation.perSide is true — that is what splits evaluation into a pickup pass and a delivery pass. Without it the charge can bill twice, or never fire.",
    prompt: `Create one new SURCHARGE called "Out of Delivery Area Charge", code ODA_CHARGE,
applied at the QUOTE stage with phase 300. It has no booking question.

Compute it with method PER_UNIT on basis CHARGEABLE_WEIGHT. The config is
5 rupees per 0.5 kg unit with a 100 rupee minimum, so
"perUnit": 5, "unitSize": 0.5, "minAmount": 100.

It applies when either the pickup or the delivery pincode is tagged ODA:
conditions any — fact "side.pincodeType.ODA", op "truthy".

Evaluate it separately for each side and keep only the higher of the two:
aggregation with group "ODA", strategy "HIGHEST", perSide true.

Flags: fuelApplicable true, taxable true. Active.`,
  },
  {
    id: "fuel",
    label: "Fuel / GST",
    category: "SURCHARGE",
    meta: "QUOTE · phase 600 · RATE_ADJUSTMENT",
    when: "Anything priced off the running total rather than the shipment.",
    pitfall:
      "The subtotal only contains lines from earlier phases. A subtotal charge placed too early quietly prices an incomplete basket.",
    prompt: `Create one new SURCHARGE called "Fuel Surcharge", code FUEL_SURCHARGE,
applied at the QUOTE stage with phase 600. It has no booking question.

Compute it with method RATE_ADJUSTMENT on basis SUBTOTAL with
"subtotalOf": "FUEL_APPLICABLE", so it prices only the lines whose own flags mark
them fuelApplicable. The config is 18 percent with no flat extra:
"percent": 18, "flatExtra": 0.

Flags: fuelApplicable false — it must never price itself — and taxable true. Active.

For GST use the same shape at phase 900 with category TAX and
"subtotalOf": "PRE_TAX", but note GST_18_PERCENT already exists, so reuse it.`,
  },
  {
    id: "demurrage",
    label: "Demurrage",
    category: "EVENT",
    meta: "EVENT · phase 950 · PER_UNIT_TIME",
    when: "Time-accrued charges billed after the fact: storage, detention, waiting.",
    pitfall:
      "Basis picks the config key: CHARGEABLE_WEIGHT reads perKgPerDay, anything else reads perUnit. A perUnit value under a weight basis is read as zero and the charge disappears.",
    prompt: `Create one new EVENT charge called "Storage Demurrage", code STORAGE_DEMURRAGE,
applied at the EVENT stage with phase 950. It has no booking question.

Compute it with method PER_UNIT_TIME on basis CHARGEABLE_WEIGHT, so it bills by
weight per day. The config is 2 rupees per kg per day after 3 free days, with a
50 rupee floor: "perKgPerDay": 2, "freeUnits": 3, "minAmount": 50.

The day count comes from the event units recorded against the shipment, not from
the booking form.

Flags: taxable true, fuelApplicable false. Active.`,
  },
  {
    id: "discount",
    label: "Outlet discount",
    category: "DISCOUNT",
    meta: "QUOTE · phase 800 · DISCOUNT tiers",
    when: "Tiered by the booking outlet's badge. Emitted as a negative line.",
    pitfall:
      "No condition is needed for the badge — the calculator returns null when the shipment has no outletBadge or no matching tier. A badge missing from tiers is simply not discounted.",
    prompt: `Create one new DISCOUNT called "Outlet Loyalty Discount", code OUTLET_BADGE_DISCOUNT,
applied at the QUOTE stage with phase 800. It has no booking question.

Compute it with method DISCOUNT on basis SUBTOTAL with "subtotalOf": "PRE_TAX".
The config is keyed by the outlet's badge, with a type per tier:
"tiers": {
  "SILVER":   { "type": "PERCENTAGE", "value": 2 },
  "GOLD":     { "type": "PERCENTAGE", "value": 4 },
  "PLATINUM": { "type": "FLAT",       "value": 150 }
}

It applies only when the shipment carries an outlet badge; shipments without one
get no discount at all. The engine emits it as a negative line and never discounts
below zero.

Flags: taxable false, fuelApplicable false. Active.`,
  },
];

const CATEGORY_TONE: Record<string, string> = {
  VAS: "border-primary/40 text-primary",
  COD: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  BASE: "border-sky-500/40 text-sky-600 dark:text-sky-400",
  SURCHARGE: "border-violet-500/40 text-violet-600 dark:text-violet-400",
  EVENT: "border-teal-500/40 text-teal-600 dark:text-teal-400",
  DISCOUNT: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
};

interface PromptTemplatesProps {
  /** Loads the chosen prompt into the AI Assist textarea. */
  onUse: (prompt: string) => void;
  className?: string;
}

/**
 * A row of one-click starters plus a browsable library. Choosing a template
 * fills the description box so it can be edited before drafting — nothing is
 * submitted on click.
 */
export function PromptTemplates({ onUse, className }: PromptTemplatesProps) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = useMemo(
    () => CHARGE_PROMPT_TEMPLATES.find((t) => t.id === activeId) || null,
    [activeId],
  );

  const use = (template: PromptTemplate) => {
    onUse(template.prompt);
    setOpen(false);
    setActiveId(null);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Start from
        </span>
        {CHARGE_PROMPT_TEMPLATES.slice(0, 6).map((t) => (
          <Button
            key={t.id}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-full px-3 text-xs font-normal"
            onClick={() => use(t)}
          >
            {t.label}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setOpen(true)}
        >
          <BookOpen className="mr-1.5 h-3.5 w-3.5" />
          All {CHARGE_PROMPT_TEMPLATES.length} templates
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setActiveId(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Charge prompt templates</DialogTitle>
            <DialogDescription>
              One per charge archetype. Each is written to pin down the settings
              that fail silently when the drafter guesses — the stage, the
              config shape and the phase. Pick one to load it for editing.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-2">
              {CHARGE_PROMPT_TEMPLATES.map((t) => {
                const isOpen = activeId === t.id;
                return (
                  <div
                    key={t.id}
                    className="rounded-md border bg-card transition-colors hover:border-primary/40"
                  >
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 p-3 text-left"
                      onClick={() => setActiveId(isOpen ? null : t.id)}
                      aria-expanded={isOpen}
                    >
                      <span className="min-w-0 space-y-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{t.label}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              CATEGORY_TONE[t.category],
                            )}
                          >
                            {t.category}
                          </Badge>
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {t.when}
                        </span>
                        <span className="block font-mono text-[10px] text-muted-foreground/80">
                          {t.meta}
                        </span>
                      </span>
                      <Badge
                        variant="secondary"
                        className="shrink-0 text-[10px]"
                      >
                        {isOpen ? "Hide" : "View"}
                      </Badge>
                    </button>

                    {isOpen && (
                      <div className="space-y-3 border-t px-3 pb-3 pt-3">
                        <div className="flex gap-2 rounded-md border border-amber-300/60 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <p className="m-0">{t.pitfall}</p>
                        </div>
                        <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 font-mono text-[11px] leading-relaxed">
                          {t.prompt}
                        </pre>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => use(t)}
                          className="w-full sm:w-auto"
                        >
                          <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" />
                          Use this prompt
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
