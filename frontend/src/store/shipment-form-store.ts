import { create } from "zustand";
import { persist } from "zustand/middleware";
import { z } from "zod";
import { type ShipmentFormValues } from "@/lib/validations/shipment";

interface ShipmentFormState extends ShipmentFormValues {
  currentStep: number;
  setField: <K extends keyof ShipmentFormValues>(
    field: K,
    value: ShipmentFormValues[K],
  ) => void;
  setCurrentStep: (step: number) => void;
  resetForm: () => void;
  addBox: () => void;
  removeBox: (boxId: string) => void;
  updateBox: (
    boxId: string,
    field: "length" | "height" | "width",
    value: string,
  ) => void;
  errors: Partial<Record<keyof ShipmentFormValues, string>>;
  setErrors: (
    errors: Partial<Record<keyof ShipmentFormValues, string>>,
  ) => void;
  validateStep: (step: number) => boolean;
}

const initialState: ShipmentFormValues = {
  referenceNo: "",
  actualWeight: "",
  pickupAddress: "",
  productDescription: "",
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
  eWayBillNo: "",
  invoiceNo: "",
  invoiceAmt: "",
  invoiceDate: "",
  attachment: null,
  boxes: [
    {
      id: "box-1",
      length: "",
      height: "",
      width: "",
    },
  ],
};

import { shipmentFormSchema } from "@/lib/validations/shipment";

export const useShipmentFormStore = create<ShipmentFormState>()(
  persist(
    (set, get) => ({
      ...initialState,
      currentStep: 1,
      errors: {},
      setField: (field, value) => {
        set((state) => ({ ...state, [field]: value }));
        // Clear error for this field
        set((state) => ({
          errors: {
            ...state.errors,
            [field]: undefined,
          },
        }));
      },
      setCurrentStep: (step) => set({ currentStep: step }),
      resetForm: () => set({ ...initialState, currentStep: 1, errors: {} }),
      addBox: () =>
        set((state) => ({
          boxes: [
            ...state.boxes,
            {
              id: `box-${state.boxes.length + 1}`,
              length: "",
              height: "",
              width: "",
            },
          ],
        })),
      removeBox: (boxId) =>
        set((state) => ({
          boxes:
            state.boxes.length > 1
              ? state.boxes.filter((box) => box.id !== boxId)
              : state.boxes,
        })),
      updateBox: (boxId, field, value) =>
        set((state) => ({
          boxes: state.boxes.map((box) =>
            box.id === boxId ? { ...box, [field]: value } : box,
          ),
        })),
      setErrors: (errors) => set({ errors }),
      validateStep: (step) => {
        const state = get();
        let fieldsToValidate: (keyof ShipmentFormValues)[] = [];

        // Define which fields to validate for each step
        switch (step) {
          case 1: // Docket Information
            fieldsToValidate = [
              "referenceNo",
              "actualWeight",
              "pickupAddress",
              "productDescription",
            ];
            break;
          case 2: // Delivery Location
            fieldsToValidate = [
              "phoneNumber",
              "receiverName",
              "address",
              "pincode",
              "area",
              "city",
              "state",
            ];
            break;
          case 3: // Invoices
            fieldsToValidate = ["invoiceNo", "invoiceAmt", "invoiceDate"];
            break;
          case 4: // Dimensions
            fieldsToValidate = ["boxes"];
            break;
          case 5: // Review - validate everything
            return shipmentFormSchema.safeParse(state).success;
        }

        if (fieldsToValidate.length === 0) {
          return true;
        }

        // Create a partial schema with only the fields for this step
        const partialSchema = z.object(
          Object.fromEntries(
            fieldsToValidate.map((field) => [
              field,
              shipmentFormSchema.shape[field],
            ]),
          ),
        );

        // Validate only the fields for this step
        const result = partialSchema.safeParse(
          Object.fromEntries(
            fieldsToValidate.map((field) => [field, state[field]]),
          ),
        );

        if (!result.success) {
          const errors = {};
          result.error.errors.forEach((error) => {
            errors[error.path[0]] = error.message;
          });
          set({ errors });
          return false;
        }

        // Clear errors for the validated fields
        set((state) => ({
          errors: Object.fromEntries(
            Object.entries(state.errors).filter(
              ([key]) =>
                !fieldsToValidate.includes(key as keyof ShipmentFormValues),
            ),
          ),
        }));

        return true;
      },
    }),
    {
      name: "shipment-form-storage",
    },
  ),
);
