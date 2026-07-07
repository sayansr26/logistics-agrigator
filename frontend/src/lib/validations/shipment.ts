import * as z from "zod";

export const boxDimensionSchema = z.object({
  id: z.string(),
  length: z.string().min(1, "Length is required"),
  height: z.string().min(1, "Height is required"),
  width: z.string().min(1, "Width is required"),
});

export const shipmentFormSchema = z.object({
  // Docket Information
  referenceNo: z.string().min(1, "Reference number is required"),
  actualWeight: z.string().min(1, "Actual weight is required"),
  pickupAddress: z.string().min(1, "Pickup address is required"),
  productDescription: z.string().min(1, "Product description is required"),

  // Delivery Location Information
  phoneNumber: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  alternatePhone: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^[6-9]\d{9}$/.test(v),
      "Enter a valid 10-digit Indian mobile number",
    ),
  email: z.string().email("Invalid email address").optional(),
  receiverName: z
    .string()
    .min(2, "Receiver name must be at least 2 characters"),
  address: z.string().min(10, "Address must be at least 10 characters"),
  landmark: z.string().optional(),
  pincode: z.string().min(6, "Pincode must be 6 digits"),
  area: z.string().min(1, "Area is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),

  // Invoices
  eWayBillNo: z.string().optional(),
  invoiceNo: z.string().min(1, "Invoice number is required"),
  invoiceAmt: z.string().min(1, "Invoice amount is required"),
  invoiceDate: z.string().min(1, "Invoice date is required"),
  attachment: z.any().optional(), // File type

  // Dimensions
  boxes: z.array(boxDimensionSchema).min(1, "At least one box is required"),
});

export type ShipmentFormValues = z.infer<typeof shipmentFormSchema>;
