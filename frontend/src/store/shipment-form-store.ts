import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { VasAnswers } from "@/lib/utils/vas";
import type { PartnerQuote } from "@/store/api/endpoints/shipmentApi";

export interface Box {
  id: string;
  length: string;
  height: string;
  width: string;
  /**
   * How many physical boxes share these dimensions. One row with count 5 is
   * five identical boxes; rows of 2 and 3 are two groups. The sum across rows
   * never exceeds numberOfBoxes.
   */
  count: number;
}

export interface Invoice {
  id: string;
  eWayBillNo: string;
  invoiceNo: string;
  invoiceAmt: string;
  invoiceDate: string;
  attachment: File | null;
  attachmentUrl: string;
}

export interface FormErrors {
  [key: string]: string;
}

export type MarkupType = "FLAT" | "PERCENTAGE";

export interface ShipmentFormState {
  // Step tracking
  currentStep: number;

  // Docket fields
  referenceNo: string;
  actualWeight: string;
  shipmentType: "B2B" | "B2C";
  shipmentDirection: "FORWARD" | "REVERSE";
  paymentType: "PREPAID" | "COD";
  codAmount: string;
  /** "ALL" quotes every service type instead of filtering to one. */
  serviceType: "ALL" | "STANDARD" | "EXPRESS" | "ECONOMY";
  outletId: string;
  outletUserId: string;
  /** Display name of the selected outlet, for labels like the wallet card. */
  outletName: string;
  pickupAddress: string;
  pickupAddressId: string;
  rtoAddressId: string;
  deliveryAddressId: string;
  billingSameAsDelivery: boolean;
  billingAddressId: string;
  productDescription: string;
  hsnCode: string;
  gstPercentage: string;
  isFragile: boolean;
  rtoSameAsPickup: boolean;

  // Order details (new)
  poNumber: string;
  poExpiryDate: string;
  ewayNotRequired: boolean;

  // Delivery fields
  phoneNumber: string;
  alternatePhone: string;
  email: string;
  receiverName: string;
  address: string;
  landmark: string;
  pincode: string;
  area: string;
  city: string;
  state: string;

  // True once the persisted draft has been rehydrated from localStorage.
  // Effects that auto-mutate collections must wait for this, or they race
  // the draft and append duplicate rows.
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  pruneEmptyInvoices: () => void;

  // Number of boxes drives both the dimension rows and (for B2B) invoice
  // rows. B2C stays locked to 1.
  numberOfBoxes: number;
  dimensionUnit: "CM" | "INCH";
  setNumberOfBoxes: (count: number) => void;

  // Collections
  boxes: Box[];
  invoices: Invoice[];

  // Dynamic VAS answers, keyed by chargeCode
  vasAnswers: VasAnswers;

  // Outlet markup (applied at booking, on top of the system price)
  markupType: MarkupType | null;
  markupValue: string;

  // Partner selection (Step 2 -> Step 3)
  selectedPartnerId: string;
  selectedQuote: PartnerQuote | null;
  quoteToken: string;

  // Validation errors
  errors: FormErrors;

  // Draft-saved indicator (debounced)
  lastSavedAt: number | null;

  // Setters
  setStep: (step: number) => void;
  setField: (field: string, value: unknown) => void;
  regenerateReferenceNo: () => void;
  setError: (field: string, error: string) => void;
  clearError: (field: string) => void;
  setErrors: (errors: FormErrors) => void;
  clearAllErrors: () => void;
  resetForm: () => void;

  // Box management
  addBox: () => void;
  removeBox: (id: string) => void;
  updateBox: (id: string, field: keyof Box, value: string) => void;
  /** Set how many physical boxes a dimension row covers (clamped to what's free). */
  setBoxCount: (id: string, count: number) => void;

  // Invoice management
  addInvoice: () => void;
  removeInvoice: (id: string) => void;
  updateInvoice: (
    id: string,
    field: keyof Invoice,
    value: Invoice[keyof Invoice],
  ) => void;

  // VAS answer management
  setVasValue: (chargeCode: string, value: unknown) => void;
  setVasFollowUp: (chargeCode: string, key: string, value: unknown) => void;

  // Partner selection
  selectQuote: (quote: PartnerQuote) => void;
  clearSelectedQuote: () => void;

  // Validation
  validateDocket: () => boolean;
  validateDelivery: () => boolean;
  validateStep1: () => boolean;

  // Edit mode
  /**
   * Id of the shipment this form is editing, or "" for the create wizard.
   * The edit wizard re-hydrates whenever this stops matching the shipment in
   * the URL, so navigating between steps keeps the in-progress draft while
   * opening a different shipment starts clean.
   */
  editingShipmentId: string;
  /** Replace the whole form with a saved shipment's stored values. */
  hydrateFromShipment: (shipment: HydratableShipment) => void;
}

/**
 * The subset of the shipment detail response the form can be rebuilt from.
 * Kept structural rather than importing the API's `Shipment` so the store
 * stays independent of the RTK layer.
 */
export interface HydratableShipment {
  id: string;
  orderId: string;
  outletId?: string | null;
  walletUserId?: string | null;
  shipmentType?: string | null;
  shipmentDirection?: string | null;
  serviceType?: string | null;
  paymentType?: string | null;
  codAmount?: number | null;
  codBaseAmount?: number | null;
  weight?: number | null;
  numberOfBoxes?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  description?: string | null;
  value?: number | null;
  fragile?: boolean | null;
  productDescription?: string | null;
  hsnCode?: string | null;
  gstPercentage?: number | null;
  specialInstructions?: string | null;

  pickupAddressId?: string | null;
  deliveryAddressId?: string | null;
  rtoAddressId?: string | null;
  billingAddressId?: string | null;
  rtoSameAsPickup?: boolean | null;
  billingSameAsDelivery?: boolean | null;

  deliveryName?: string | null;
  deliveryPhone?: string | null;
  deliveryEmail?: string | null;
  deliveryLine1?: string | null;
  deliveryLandmark?: string | null;
  deliveryCity?: string | null;
  deliveryState?: string | null;
  deliveryPincode?: string | null;

  markupType?: string | null;
  markupValue?: number | null;

  partnerId?: string | null;
  quoteSnapshot?: Record<string, unknown> | null;

  vasSelections?: Array<{ chargeCode: string; answer: unknown }> | null;
  boxes?: Array<{
    boxNumber: number;
    length: number;
    width: number;
    height: number;
  }> | null;
  invoices?: Array<{
    eWayBillNo?: string | null;
    invoiceNo: string;
    invoiceAmt: number;
    invoiceDate: string;
    attachmentUrl?: string | null;
  }> | null;
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function makeBox(count: number = 1): Box {
  return { id: `box-${uid()}`, length: "", height: "", width: "", count };
}

function makeInvoice(): Invoice {
  return {
    id: `inv-${uid()}`,
    eWayBillNo: "",
    invoiceNo: "",
    invoiceAmt: "",
    invoiceDate: "",
    attachment: null,
    attachmentUrl: "",
  };
}

/** Box count of a row, tolerating drafts persisted before counts existed. */
export function boxCount(box: Box): number {
  const n = Math.round(Number(box.count));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Physical boxes already claimed by the dimension rows. */
export function assignedBoxCount(boxes: Box[]): number {
  return boxes.reduce((sum, b) => sum + boxCount(b), 0);
}

/**
 * Expand the grouped rows into one entry per physical box, padding with the
 * last row's dimensions if the groups cover fewer boxes than `total`.
 */
export function expandBoxes(boxes: Box[], total: number): Box[] {
  const expanded: Box[] = [];
  for (const box of boxes) {
    for (let i = 0; i < boxCount(box); i += 1) expanded.push(box);
  }
  if (expanded.length === 0) return [];

  const last = expanded[expanded.length - 1];
  while (expanded.length < total) expanded.push(last);
  return expanded.slice(0, total);
}

/**
 * Fit the grouping to `total` boxes: rows keep their counts while budget
 * lasts, rows past the budget are dropped, and any remainder lands on the
 * last row. The first row therefore absorbs the whole shipment by default -
 * "5 boxes, all the same" - and the user splits it by adding rows.
 */
function fitBoxesTo(boxes: Box[], total: number): Box[] {
  const source = boxes.length > 0 ? boxes : [makeBox()];
  const fitted: Box[] = [];
  let remaining = total;

  for (const box of source) {
    if (remaining <= 0) break;
    const count = Math.min(boxCount(box), remaining);
    fitted.push({ ...box, count });
    remaining -= count;
  }

  if (fitted.length === 0) fitted.push(makeBox(total));
  else if (remaining > 0) {
    const last = fitted[fitted.length - 1];
    fitted[fitted.length - 1] = { ...last, count: last.count + remaining };
  }

  return fitted;
}

function generateReferenceNo(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const random = Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, "0");
  return `${yy}${mm}${dd}${hh}${mi}${ss}${random}`;
}

/** Module-level debounce so rapid keystrokes don't spam `lastSavedAt` updates. */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleDraftSaved(set: (patch: Partial<ShipmentFormState>) => void) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => set({ lastSavedAt: Date.now() }), 600);
}

/**
 * Collapse the stored per-box rows (one row per physical box) back into the
 * grouped rows the dimensions section edits, merging runs of identical
 * dimensions into a single row with a count.
 */
function groupStoredBoxes(
  stored: Array<{ length: number; width: number; height: number }>,
): Box[] {
  if (stored.length === 0) return [makeBox()];

  const grouped: Box[] = [];
  for (const row of stored) {
    const last = grouped[grouped.length - 1];
    const sameAsLast =
      last &&
      last.length === String(row.length) &&
      last.width === String(row.width) &&
      last.height === String(row.height);

    if (sameAsLast) {
      last.count += 1;
    } else {
      grouped.push({
        id: `box-${uid()}`,
        length: String(row.length),
        width: String(row.width),
        height: String(row.height),
        count: 1,
      });
    }
  }
  return grouped;
}

/**
 * Invert `buildVasSelections`: a follow-up answer arrives as
 * `{enabled: true, ...followUps}` and everything else as a bare scalar.
 */
function vasAnswersFromSelections(
  selections: Array<{ chargeCode: string; answer: unknown }>,
): VasAnswers {
  const answers: VasAnswers = {};
  for (const sel of selections) {
    if (
      sel.answer &&
      typeof sel.answer === "object" &&
      !Array.isArray(sel.answer)
    ) {
      const { enabled, ...followUpValues } = sel.answer as Record<
        string,
        unknown
      >;
      answers[sel.chargeCode] = {
        value: enabled ?? true,
        followUpValues,
      };
    } else {
      answers[sel.chargeCode] = { value: sel.answer };
    }
  }
  return answers;
}

/** ISO timestamp -> the `yyyy-mm-dd` a date input expects. */
function toDateInputValue(iso?: string | null): string {
  if (!iso) return "";
  return String(iso).slice(0, 10);
}

const DEFAULT_STATE = {
  currentStep: 1,

  referenceNo: "",
  actualWeight: "",
  shipmentType: "B2C" as const,
  shipmentDirection: "FORWARD" as const,
  paymentType: "PREPAID" as const,
  codAmount: "",
  serviceType: "ALL" as const,
  outletId: "",
  outletUserId: "",
  outletName: "",
  pickupAddress: "",
  pickupAddressId: "",
  rtoAddressId: "",
  deliveryAddressId: "",
  billingSameAsDelivery: true,
  billingAddressId: "",
  productDescription: "",
  hsnCode: "",
  gstPercentage: "",
  isFragile: false,
  rtoSameAsPickup: true,

  poNumber: "",
  poExpiryDate: "",
  ewayNotRequired: false,

  phoneNumber: "",
  alternatePhone: "",
  email: "",
  receiverName: "",
  address: "",
  landmark: "",
  pincode: "",
  area: "",
  city: "",
  state: "",

  numberOfBoxes: 1,
  dimensionUnit: "CM" as const,
  boxes: [makeBox()],
  hasHydrated: false,
  invoices: [makeInvoice()],

  vasAnswers: {} as VasAnswers,

  markupType: null as MarkupType | null,
  markupValue: "",

  selectedPartnerId: "",
  selectedQuote: null as PartnerQuote | null,
  quoteToken: "",

  errors: {} as FormErrors,
  lastSavedAt: null as number | null,

  editingShipmentId: "",
};

/**
 * Builds an independent form store persisted under its own localStorage key.
 *
 * The create wizard and the edit wizard run the exact same components against
 * two separate instances, so opening an existing shipment for editing never
 * clobbers a half-finished new-shipment draft (and vice versa). Components
 * reach whichever instance their route provides via `useShipmentForm()`.
 */
function createShipmentFormStore(persistKey: string) {
  return create<ShipmentFormState>()(
    persist(
      (set, get) => ({
        ...DEFAULT_STATE,
        referenceNo: generateReferenceNo(),

        setStep: (step) => set({ currentStep: step }),

        setField: (field, value) => {
          set((s) => ({
            ...s,
            [field]: value,
            errors: { ...s.errors, [field]: "" },
          }));
          scheduleDraftSaved(set);
        },

        regenerateReferenceNo: () =>
          set((s) => ({
            referenceNo: generateReferenceNo(),
            errors: { ...s.errors, referenceNo: "" },
          })),

        setError: (field, error) =>
          set((s) => ({ errors: { ...s.errors, [field]: error } })),

        clearError: (field) =>
          set((s) => ({ errors: { ...s.errors, [field]: "" } })),

        setErrors: (errors) => set({ errors }),

        clearAllErrors: () => set({ errors: {} }),

        setHasHydrated: (value) => set({ hasHydrated: value }),

        resetForm: () =>
          set({
            ...DEFAULT_STATE,
            referenceNo: generateReferenceNo(),
            boxes: [makeBox()],
          }),

        // A new group can only be added while boxes are still unassigned - the
        // rows describe how the numberOfBoxes physical boxes are grouped, so
        // their counts can never add up to more than that.
        addBox: () => {
          set((s) => {
            if (assignedBoxCount(s.boxes) >= s.numberOfBoxes) return s;
            return { boxes: [...s.boxes, makeBox()] };
          });
          scheduleDraftSaved(set);
        },

        removeBox: (id) => {
          set((s) => {
            if (s.boxes.length <= 1) return s;
            return { boxes: s.boxes.filter((b) => b.id !== id) };
          });
          scheduleDraftSaved(set);
        },

        // Clamped to what is still unassigned, so the groups can never claim
        // more boxes than the shipment has.
        setBoxCount: (id, value) => {
          set((s) => {
            const others = s.boxes
              .filter((b) => b.id !== id)
              .reduce((sum, b) => sum + boxCount(b), 0);
            const available = Math.max(1, s.numberOfBoxes - others);
            const next = Math.max(
              1,
              Math.min(available, Math.round(value) || 1),
            );
            return {
              boxes: s.boxes.map((b) =>
                b.id === id ? { ...b, count: next } : b,
              ),
            };
          });
          scheduleDraftSaved(set);
        },

        updateBox: (id, field, value) => {
          set((s) => ({
            boxes: s.boxes.map((b) =>
              b.id === id ? { ...b, [field]: value } : b,
            ),
          }));
          scheduleDraftSaved(set);
        },

        // Clamps 1-100 and refits the grouping: the dimension rows describe how
        // those boxes are grouped, so their counts are rescaled rather than one
        // row being created per box. Invoice rows are capped at the box count
        // (several boxes may share one invoice, never the other way round).
        setNumberOfBoxes: (count) => {
          set((s) => {
            const clamped = Math.max(1, Math.min(100, Math.round(count) || 1));
            const boxes = fitBoxesTo(s.boxes, clamped);
            const invoices =
              s.invoices.length > clamped
                ? s.invoices.slice(0, clamped)
                : s.invoices;

            return { numberOfBoxes: clamped, boxes, invoices };
          });
          scheduleDraftSaved(set);
        },

        // One invoice can cover several boxes, so the row count is capped at the
        // number of boxes rather than tied to it.
        addInvoice: () => {
          set((s) => {
            if (s.invoices.length >= s.numberOfBoxes) return s;
            return { invoices: [...s.invoices, makeInvoice()] };
          });
          scheduleDraftSaved(set);
        },

        removeInvoice: (id) => {
          set((s) => {
            if (s.invoices.length <= 1) return s;
            return { invoices: s.invoices.filter((inv) => inv.id !== id) };
          });
          scheduleDraftSaved(set);
        },

        // Drop fully-empty invoice rows beyond the first. Heals drafts that
        // accumulated duplicate blank rows (pre-hydration append race in an
        // earlier build) without touching rows the user actually filled in.
        pruneEmptyInvoices: () => {
          set((s) => {
            const hasData = (inv: Invoice) =>
              Boolean(
                inv.eWayBillNo ||
                inv.invoiceNo ||
                inv.invoiceAmt ||
                inv.invoiceDate ||
                inv.attachmentUrl,
              );
            const pruned = s.invoices.filter(
              (inv, idx) => idx === 0 || hasData(inv),
            );
            return pruned.length === s.invoices.length
              ? s
              : { ...s, invoices: pruned };
          });
        },

        updateInvoice: (id, field, value) => {
          set((s) => ({
            invoices: s.invoices.map((inv) =>
              inv.id === id ? { ...inv, [field]: value } : inv,
            ),
          }));
          scheduleDraftSaved(set);
        },

        setVasValue: (chargeCode, value) => {
          set((s) => ({
            vasAnswers: {
              ...s.vasAnswers,
              [chargeCode]: { ...s.vasAnswers[chargeCode], value },
            },
          }));
          scheduleDraftSaved(set);
        },

        setVasFollowUp: (chargeCode, key, value) => {
          set((s) => ({
            vasAnswers: {
              ...s.vasAnswers,
              [chargeCode]: {
                value: s.vasAnswers[chargeCode]?.value,
                followUpValues: {
                  ...s.vasAnswers[chargeCode]?.followUpValues,
                  [key]: value,
                },
              },
            },
          }));
          scheduleDraftSaved(set);
        },

        selectQuote: (quote) =>
          set({
            selectedPartnerId: quote.partnerId,
            selectedQuote: quote,
            quoteToken: quote.quoteToken || "",
          }),

        clearSelectedQuote: () =>
          set({ selectedPartnerId: "", selectedQuote: null, quoteToken: "" }),

        validateDocket: () => {
          const s = get();
          const errs: FormErrors = {};
          if (!s.referenceNo.trim())
            errs.referenceNo = "Reference No is required";
          if (!s.actualWeight.trim() || parseFloat(s.actualWeight) <= 0)
            errs.actualWeight = "Valid weight is required";
          if (!s.pickupAddress)
            errs.pickupAddress = "Pickup address is required";
          if (!s.rtoSameAsPickup && !s.rtoAddressId)
            errs.rtoAddressId = "RTO address is required";
          if (!s.productDescription.trim())
            errs.productDescription = "Product description is required";
          if (
            s.paymentType === "COD" &&
            (!s.codAmount || parseFloat(s.codAmount) <= 0)
          )
            errs.codAmount = "COD collectable amount is required";
          set((state) => ({ errors: { ...state.errors, ...errs } }));
          return Object.keys(errs).length === 0;
        },

        // Delivery is now select-only from the address book (DELIVERY type).
        // The legacy phone/receiverName/address/pincode/city/state fields are
        // synced from the selected address on select (see address-section.tsx)
        // and kept only so payload builders don't need a second source of
        // truth — validation just confirms a delivery (and, when applicable,
        // billing) address was actually picked.
        validateDelivery: () => {
          const s = get();
          const errs: FormErrors = {};
          if (!s.deliveryAddressId)
            errs.deliveryAddressId = "A delivery address is required";
          if (!s.billingSameAsDelivery && !s.billingAddressId)
            errs.billingAddressId = "A billing address is required";
          set((state) => ({ errors: { ...state.errors, ...errs } }));
          return Object.keys(errs).length === 0;
        },

        validateStep1: () => {
          const s = get();
          s.clearAllErrors();
          const docketOk = s.validateDocket();
          const deliveryOk = s.validateDelivery();
          return docketOk && deliveryOk;
        },

        // Rebuild the whole form from a saved shipment. Starts from
        // DEFAULT_STATE so nothing leaks in from a previous draft, and keeps
        // the shipment's own reference number rather than minting a new one.
        hydrateFromShipment: (shipment) => {
          const storedBoxes = shipment.boxes || [];
          const numberOfBoxes = Math.max(
            1,
            Math.min(100, shipment.numberOfBoxes || 1),
          );

          // Older shipments predate the per-box rows; fall back to the single
          // dimension triple stored on the shipment itself.
          const boxes =
            storedBoxes.length > 0
              ? groupStoredBoxes(storedBoxes)
              : [
                  {
                    id: `box-${uid()}`,
                    length:
                      shipment.length != null ? String(shipment.length) : "",
                    width: shipment.width != null ? String(shipment.width) : "",
                    height:
                      shipment.height != null ? String(shipment.height) : "",
                    count: numberOfBoxes,
                  },
                ];

          const invoices =
            shipment.invoices && shipment.invoices.length > 0
              ? shipment.invoices.map((inv) => ({
                  id: `inv-${uid()}`,
                  eWayBillNo: inv.eWayBillNo || "",
                  invoiceNo: inv.invoiceNo || "",
                  invoiceAmt:
                    inv.invoiceAmt != null ? String(inv.invoiceAmt) : "",
                  invoiceDate: toDateInputValue(inv.invoiceDate),
                  attachment: null,
                  attachmentUrl: inv.attachmentUrl || "",
                }))
              : [makeInvoice()];

          // The stored codAmount includes the outlet markup; the form edits the
          // base the customer was quoted on.
          const codBase =
            shipment.codBaseAmount != null
              ? shipment.codBaseAmount
              : shipment.codAmount;

          set({
            ...DEFAULT_STATE,
            editingShipmentId: shipment.id,
            hasHydrated: true,

            referenceNo: shipment.orderId || "",
            actualWeight:
              shipment.weight != null ? String(shipment.weight) : "",
            shipmentType: shipment.shipmentType === "B2B" ? "B2B" : "B2C",
            shipmentDirection:
              shipment.shipmentDirection === "REVERSE" ? "REVERSE" : "FORWARD",
            paymentType: shipment.paymentType === "COD" ? "COD" : "PREPAID",
            codAmount: codBase != null ? String(codBase) : "",
            serviceType:
              shipment.serviceType === "EXPRESS" ||
              shipment.serviceType === "ECONOMY" ||
              shipment.serviceType === "STANDARD"
                ? shipment.serviceType
                : "ALL",
            outletId: shipment.outletId || "",
            outletUserId: shipment.walletUserId || "",

            pickupAddress: shipment.pickupAddressId || "",
            pickupAddressId: shipment.pickupAddressId || "",
            rtoAddressId: shipment.rtoAddressId || "",
            deliveryAddressId: shipment.deliveryAddressId || "",
            billingSameAsDelivery: shipment.billingSameAsDelivery !== false,
            billingAddressId: shipment.billingAddressId || "",
            rtoSameAsPickup: shipment.rtoSameAsPickup !== false,

            productDescription: shipment.productDescription || "",
            hsnCode: shipment.hsnCode || "",
            gstPercentage:
              shipment.gstPercentage != null
                ? String(shipment.gstPercentage)
                : "",
            isFragile: Boolean(shipment.fragile),

            // Legacy delivery mirror fields, synced from the stored snapshot
            phoneNumber: shipment.deliveryPhone || "",
            email: shipment.deliveryEmail || "",
            receiverName: shipment.deliveryName || "",
            address: shipment.deliveryLine1 || "",
            landmark: shipment.deliveryLandmark || "",
            pincode: shipment.deliveryPincode || "",
            city: shipment.deliveryCity || "",
            state: shipment.deliveryState || "",

            numberOfBoxes,
            // Dimensions are persisted in centimetres.
            dimensionUnit: "CM",
            boxes,
            invoices,

            vasAnswers: vasAnswersFromSelections(shipment.vasSelections || []),

            markupType:
              shipment.markupType === "FLAT" ||
              shipment.markupType === "PERCENTAGE"
                ? shipment.markupType
                : null,
            markupValue:
              shipment.markupValue != null ? String(shipment.markupValue) : "",

            // The stored quote is stale the moment anything changes, so step 2
            // always re-quotes rather than pre-selecting the old partner.
            selectedPartnerId: "",
            selectedQuote: null,
            quoteToken: "",
          });
        },
      }),
      {
        name: persistKey,
        storage: createJSONStorage(() => localStorage),
        // Errors are transient/derived; File objects can't survive JSON
        // round-tripping (and shouldn't - user re-attaches on reload).
        partialize: (state) => ({
          ...state,
          errors: {},
          // Hydration status is runtime-only — persisting it would mark a
          // fresh page load as "already hydrated" before rehydration runs.
          hasHydrated: false,
          invoices: state.invoices.map((inv) => ({ ...inv, attachment: null })),
        }),
        merge: (persisted, current) => ({
          ...current,
          ...(persisted as Partial<ShipmentFormState>),
          errors: {},
          hasHydrated: false,
        }),
        onRehydrateStorage: () => (state) => {
          // Outlet markup is retired. Drafts saved while the markup section
          // still existed carry a value that nothing can clear any more, and it
          // would keep pricing into every quote — so drop just those two fields
          // on load. Everything else in the draft is left untouched.
          if (state && (state.markupType || state.markupValue)) {
            state.markupType = null;
            state.markupValue = "";
          }
          state?.pruneEmptyInvoices();
          // Drafts saved before dimension rows carried a count have one row per
          // box and no `count` field — refitting normalises them in place.
          state?.setNumberOfBoxes(state.numberOfBoxes);
          state?.setHasHydrated(true);
        },
      },
    ),
  );
}

export type ShipmentFormStoreApi = ReturnType<typeof createShipmentFormStore>;

/** Store backing the create wizard (/shipments/create/*). */
export const useShipmentFormStore = createShipmentFormStore(
  "shipment-form-draft",
);

/** Store backing the edit wizard (/shipments/[id]/edit/*). */
export const useShipmentEditFormStore = createShipmentFormStore(
  "shipment-edit-draft",
);
