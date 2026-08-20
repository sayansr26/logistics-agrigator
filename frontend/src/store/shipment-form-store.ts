import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { VasAnswers } from "@/lib/utils/vas";
import type { PartnerQuote } from "@/store/api/endpoints/shipmentApi";

export interface Box {
  id: string;
  length: string;
  height: string;
  width: string;
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
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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
  boxes: [{ id: `box-${uid()}`, length: "", height: "", width: "" }],
  hasHydrated: false,
  invoices: [],

  vasAnswers: {} as VasAnswers,

  markupType: null as MarkupType | null,
  markupValue: "",

  selectedPartnerId: "",
  selectedQuote: null as PartnerQuote | null,
  quoteToken: "",

  errors: {} as FormErrors,
  lastSavedAt: null as number | null,
};

export const useShipmentFormStore = create<ShipmentFormState>()(
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
          boxes: [{ id: `box-${uid()}`, length: "", height: "", width: "" }],
        }),

      addBox: () => {
        set((s) => ({
          boxes: [
            ...s.boxes,
            { id: `box-${uid()}`, length: "", height: "", width: "" },
          ],
        }));
        scheduleDraftSaved(set);
      },

      removeBox: (id) => {
        set((s) => ({ boxes: s.boxes.filter((b) => b.id !== id) }));
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

      // Clamps 1-100, grows/trims boxes[] (trim from the end so filled rows
      // keep their index), and — for B2B — grows/trims invoices[] to match
      // so box count and invoice row count stay in lockstep.
      setNumberOfBoxes: (count) => {
        set((s) => {
          const clamped = Math.max(1, Math.min(100, Math.round(count) || 1));

          let boxes = s.boxes;
          if (clamped > boxes.length) {
            boxes = [
              ...boxes,
              ...Array.from({ length: clamped - boxes.length }, () => ({
                id: `box-${uid()}`,
                length: "",
                height: "",
                width: "",
              })),
            ];
          } else if (clamped < boxes.length) {
            boxes = boxes.slice(0, clamped);
          }

          let invoices = s.invoices;
          if (s.shipmentType === "B2B") {
            if (clamped > invoices.length) {
              invoices = [
                ...invoices,
                ...Array.from({ length: clamped - invoices.length }, () => ({
                  id: `inv-${uid()}`,
                  eWayBillNo: "",
                  invoiceNo: "",
                  invoiceAmt: "",
                  invoiceDate: "",
                  attachment: null,
                  attachmentUrl: "",
                })),
              ];
            } else if (clamped < invoices.length) {
              invoices = invoices.slice(0, clamped);
            }
          }

          return { numberOfBoxes: clamped, boxes, invoices };
        });
        scheduleDraftSaved(set);
      },

      addInvoice: () => {
        set((s) => ({
          invoices: [
            ...s.invoices,
            {
              id: `inv-${uid()}`,
              eWayBillNo: "",
              invoiceNo: "",
              invoiceAmt: "",
              invoiceDate: "",
              attachment: null,
              attachmentUrl: "",
            },
          ],
        }));
        scheduleDraftSaved(set);
      },

      removeInvoice: (id) => {
        set((s) => ({ invoices: s.invoices.filter((inv) => inv.id !== id) }));
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
        if (!s.pickupAddress) errs.pickupAddress = "Pickup address is required";
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
    }),
    {
      name: "shipment-form-draft",
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
        state?.pruneEmptyInvoices();
        state?.setHasHydrated(true);
      },
    },
  ),
);
