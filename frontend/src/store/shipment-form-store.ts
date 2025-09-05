import { create } from "zustand";

// Type definitions
export interface Box {
  id: string;
  length: string;
  height: string;
  width: string;
}

export interface Invoice {
  id: string;
  invoiceType: string;
  invoiceNo: string;
  invoiceDate: string;
  invoiceAmt: string;
  currency: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  eWayBillNo: string;
  attachment: File | null;
  sellerGSTIN: string;
  buyerGSTIN: string;
  hsnCode: string;
  sacCode: string;
  paymentTerms: string;
}

export interface ShipmentFormData {
  // Docket form fields
  referenceNo: string;
  actualWeight: string;
  pickupAddress: string;
  productDescription: string;

  // Delivery form fields
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

  // RTO and Return Address fields
  isRTO: boolean;
  returnAddress: string;
  returnPincode: string;
  returnCity: string;
  returnState: string;

  // Dimensions form fields
  length: string;
  width: string;
  height: string;
  volumetricWeight: string;
  packageType: string;
}

export interface FormErrors {
  [key: string]: string;
}

export interface ShipmentFormState {
  // Form state
  currentStep: number;
  formData: ShipmentFormData;
  errors: FormErrors;

  // Collections
  boxes: Box[];
  invoices: Invoice[];

  // Methods
  setStep: (step: number) => void;
  setField: <K extends keyof ShipmentFormData>(
    field: K,
    value: ShipmentFormData[K],
  ) => void;
  setError: (field: string, error: string) => void;
  clearError: (field: string) => void;
  setErrors: (errors: FormErrors) => void;
  clearAllErrors: () => void;
  resetForm: () => void;

  // Box management methods
  addBox: () => void;
  removeBox: (id: string) => void;
  updateBox: (id: string, field: keyof Box, value: string) => void;

  // Invoice management methods
  addInvoice: () => void;
  removeInvoice: (id: string) => void;
  updateInvoice: (
    id: string,
    field: keyof Invoice,
    value: Invoice[keyof Invoice],
  ) => void;
}

// Initial form data
const initialFormData: ShipmentFormData = {
  // Docket form fields
  referenceNo: "",
  actualWeight: "",
  pickupAddress: "",
  productDescription: "",

  // Delivery form fields
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

  // RTO and Return Address fields
  isRTO: false,
  returnAddress: "",
  returnPincode: "",
  returnCity: "",
  returnState: "",

  // Dimensions form fields
  length: "",
  width: "",
  height: "",
  volumetricWeight: "",
  packageType: "",
};

// Initial state
const initialState = {
  currentStep: 1,
  formData: initialFormData,
  errors: {},
  boxes: [],
  invoices: [],
};

export const useShipmentFormStore = create<ShipmentFormState>((set) => ({
  ...initialState,

  setStep: (step: number) => set({ currentStep: step }),

  setField: <K extends keyof ShipmentFormData>(
    field: K,
    value: ShipmentFormData[K],
  ) =>
    set((state) => ({
      formData: { ...state.formData, [field]: value },
      errors: { ...state.errors, [field]: "" },
    })),

  setError: (field: string, error: string) =>
    set((state) => ({
      errors: { ...state.errors, [field]: error },
    })),

  clearError: (field: string) =>
    set((state) => ({
      errors: { ...state.errors, [field]: "" },
    })),

  setErrors: (errors: FormErrors) => set({ errors }),

  clearAllErrors: () => set({ errors: {} }),

  resetForm: () =>
    set({
      ...initialState,
      currentStep: 1,
    }),

  // Box management methods
  addBox: () =>
    set((state) => ({
      boxes: [
        ...state.boxes,
        {
          id: `box-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          length: "",
          height: "",
          width: "",
        },
      ],
    })),

  removeBox: (id: string) =>
    set((state) => ({
      boxes: state.boxes.filter((box) => box.id !== id),
    })),

  updateBox: (id: string, field: keyof Box, value: string) =>
    set((state) => ({
      boxes: state.boxes.map((box) =>
        box.id === id ? { ...box, [field]: value } : box,
      ),
    })),

  // Invoice management methods
  addInvoice: () =>
    set((state) => ({
      invoices: [
        ...state.invoices,
        {
          id: `invoice-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          invoiceType: "",
          invoiceNo: "",
          invoiceDate: "",
          invoiceAmt: "",
          currency: "INR",
          taxAmount: "",
          discountAmount: "",
          totalAmount: "",
          eWayBillNo: "",
          attachment: null,
          sellerGSTIN: "",
          buyerGSTIN: "",
          hsnCode: "",
          sacCode: "",
          paymentTerms: "",
        },
      ],
    })),

  removeInvoice: (id: string) =>
    set((state) => ({
      invoices: state.invoices.filter((invoice) => invoice.id !== id),
    })),

  updateInvoice: (
    id: string,
    field: keyof Invoice,
    value: Invoice[keyof Invoice],
  ) =>
    set((state) => ({
      invoices: state.invoices.map((invoice) =>
        invoice.id === id ? { ...invoice, [field]: value } : invoice,
      ),
    })),
}));
