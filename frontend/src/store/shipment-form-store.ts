import { create } from "zustand";

interface Box {
  id: string;
  length: string;
  height: string;
  width: string;
}

interface ShipmentFormState {
  currentStep: number;

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

  // Invoice form fields
  eWayBillNo: string;
  invoiceNo: string;
  invoiceAmt: string;
  invoiceDate: string;
  attachment: File | null;
  // Additional invoice fields
  invoiceType: string;
  paymentTerms: string;
  currency: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  sellerGSTIN: string;
  buyerGSTIN: string;
  hsnCode: string;
  sacCode: string;

  // Multiple invoices support
  invoices: Array<{
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
  }>;

  // Dimensions form fields
  boxes: Box[];

  // Form data (for other steps)
  formData: Record<string, any>;
  errors: Record<string, string>;

  // Methods
  setStep: (_step: number) => void;
  setField: (_field: string, _value: any) => void;
  updateField: (_field: string, _value: any) => void;
  setErrors: (_errors: Record<string, string>) => void;
  resetForm: () => void;

  // Box management methods
  addBox: () => void;
  removeBox: (_id: string) => void;
  updateBox: (_id: string, _field: keyof Box, _value: string) => void;

  // Invoice management methods
  addInvoice: () => void;
  removeInvoice: (_id: string) => void;
  updateInvoice: (_id: string, _field: string, _value: any) => void;
}

export const useShipmentFormStore = create<ShipmentFormState>((set, _get) => ({
  currentStep: 1,

  // Initialize docket form fields
  referenceNo: "",
  actualWeight: "",
  pickupAddress: "",
  productDescription: "",

  // Initialize delivery form fields
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

  // Initialize RTO and return address fields
  isRTO: true,
  returnAddress: "",
  returnPincode: "",
  returnCity: "",
  returnState: "",

  // Initialize invoice form fields
  eWayBillNo: "",
  invoiceNo: "",
  invoiceAmt: "",
  invoiceDate: "",
  attachment: null,
  // Initialize additional invoice fields
  invoiceType: "",
  paymentTerms: "",
  currency: "INR",
  taxAmount: "",
  discountAmount: "",
  totalAmount: "",
  sellerGSTIN: "",
  buyerGSTIN: "",
  hsnCode: "",
  sacCode: "",

  // Initialize multiple invoices
  invoices: [],

  // Initialize dimensions form fields
  boxes: [],

  formData: {},
  errors: {},

  setStep: (step: number) => set({ currentStep: step }),

  setField: (field: string, value: any) =>
    set((state) => ({
      [field]: value,
      // Clear error for this field when value is set
      errors: { ...state.errors, [field]: "" },
    })),

  updateField: (field: string, value: any) =>
    set((state) => ({
      formData: { ...state.formData, [field]: value },
    })),

  setErrors: (errors: Record<string, string>) => set({ errors }),

  resetForm: () =>
    set({
      currentStep: 1,
      // Reset docket fields
      referenceNo: "",
      actualWeight: "",
      pickupAddress: "",
      productDescription: "",
      // Reset delivery fields
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
      // Reset RTO and return address fields
      isRTO: true,
      returnAddress: "",
      returnPincode: "",
      returnCity: "",
      returnState: "",
      // Reset invoice fields
      eWayBillNo: "",
      invoiceNo: "",
      invoiceAmt: "",
      invoiceDate: "",
      attachment: null,
      // Reset additional invoice fields
      invoiceType: "",
      paymentTerms: "",
      currency: "INR",
      taxAmount: "",
      discountAmount: "",
      totalAmount: "",
      sellerGSTIN: "",
      buyerGSTIN: "",
      hsnCode: "",
      sacCode: "",
      // Reset multiple invoices
      invoices: [],
      // Reset dimensions fields
      boxes: [],
      formData: {},
      errors: {},
    }),

  // Box management methods
  addBox: () =>
    set((state) => ({
      boxes: [
        ...state.boxes,
        {
          id: `box-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
          id: `invoice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
        },
      ],
    })),

  removeInvoice: (id: string) =>
    set((state) => ({
      invoices: state.invoices.filter((invoice) => invoice.id !== id),
    })),

  updateInvoice: (id: string, field: string, value: any) =>
    set((state) => ({
      invoices: state.invoices.map((invoice) =>
        invoice.id === id ? { ...invoice, [field]: value } : invoice,
      ),
    })),
}));
