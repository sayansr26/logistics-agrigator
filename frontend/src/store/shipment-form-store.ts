import { create } from "zustand";

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
  serviceType: "STANDARD" | "EXPRESS" | "ECONOMY";
  outletId: string;
  outletUserId: string;
  pickupAddress: string;
  pickupAddressId: string;
  productDescription: string;
  hsnCode: string;
  gstPercentage: string;
  isFragile: boolean;
  rtoSameAsPickup: boolean;

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

  // Collections
  boxes: Box[];
  invoices: Invoice[];

  // Validation errors
  errors: FormErrors;

  // Setters
  setStep: (step: number) => void;
  setField: (field: string, value: unknown) => void;
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

  // Validation
  validateDocket: () => boolean;
  validateDelivery: () => boolean;
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export const useShipmentFormStore = create<ShipmentFormState>((set, get) => ({
  currentStep: 1,

  referenceNo: "",
  actualWeight: "",
  shipmentType: "B2C",
  shipmentDirection: "FORWARD",
  paymentType: "PREPAID",
  codAmount: "",
  serviceType: "STANDARD",
  outletId: "",
  outletUserId: "",
  pickupAddress: "",
  pickupAddressId: "",
  productDescription: "",
  hsnCode: "",
  gstPercentage: "",
  isFragile: false,
  rtoSameAsPickup: true,

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

  boxes: [{ id: `box-${uid()}`, length: "", height: "", width: "" }],
  invoices: [],

  errors: {},

  setStep: (step) => set({ currentStep: step }),

  setField: (field, value) =>
    set((s) => ({
      ...s,
      [field]: value,
      errors: { ...s.errors, [field]: "" },
    })),

  setError: (field, error) =>
    set((s) => ({ errors: { ...s.errors, [field]: error } })),

  clearError: (field) => set((s) => ({ errors: { ...s.errors, [field]: "" } })),

  setErrors: (errors) => set({ errors }),

  clearAllErrors: () => set({ errors: {} }),

  resetForm: () =>
    set({
      currentStep: 1,
      referenceNo: "",
      actualWeight: "",
      shipmentType: "B2C",
      shipmentDirection: "FORWARD",
      paymentType: "PREPAID",
      codAmount: "",
      serviceType: "STANDARD",
      outletId: "",
      outletUserId: "",
      pickupAddress: "",
      pickupAddressId: "",
      productDescription: "",
      hsnCode: "",
      gstPercentage: "",
      isFragile: false,
      rtoSameAsPickup: true,
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
      boxes: [{ id: `box-${uid()}`, length: "", height: "", width: "" }],
      invoices: [],
      errors: {},
    }),

  addBox: () =>
    set((s) => ({
      boxes: [
        ...s.boxes,
        { id: `box-${uid()}`, length: "", height: "", width: "" },
      ],
    })),

  removeBox: (id) =>
    set((s) => ({ boxes: s.boxes.filter((b) => b.id !== id) })),

  updateBox: (id, field, value) =>
    set((s) => ({
      boxes: s.boxes.map((b) => (b.id === id ? { ...b, [field]: value } : b)),
    })),

  addInvoice: () =>
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
    })),

  removeInvoice: (id) =>
    set((s) => ({ invoices: s.invoices.filter((inv) => inv.id !== id) })),

  updateInvoice: (id, field, value) =>
    set((s) => ({
      invoices: s.invoices.map((inv) =>
        inv.id === id ? { ...inv, [field]: value } : inv,
      ),
    })),

  validateDocket: () => {
    const s = get();
    const errs: FormErrors = {};
    if (!s.referenceNo.trim()) errs.referenceNo = "Reference No is required";
    if (!s.actualWeight.trim() || parseFloat(s.actualWeight) <= 0)
      errs.actualWeight = "Valid weight is required";
    if (!s.pickupAddress) errs.pickupAddress = "Pickup address is required";
    if (!s.productDescription.trim())
      errs.productDescription = "Product description is required";
    set({ errors: errs });
    return Object.keys(errs).length === 0;
  },

  validateDelivery: () => {
    const s = get();
    const errs: FormErrors = {};
    if (!s.phoneNumber.trim()) errs.phoneNumber = "Phone number is required";
    if (!s.receiverName.trim()) errs.receiverName = "Receiver name is required";
    if (!s.address.trim()) errs.address = "Address is required";
    if (!s.pincode.trim() || !/^\d{6}$/.test(s.pincode))
      errs.pincode = "Valid 6-digit pincode is required";
    if (!s.city.trim()) errs.city = "City is required";
    if (!s.state.trim()) errs.state = "State is required";
    set({ errors: errs });
    return Object.keys(errs).length === 0;
  },
}));
