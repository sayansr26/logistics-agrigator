import { baseApi } from "../baseApi";

/**
 * Shipment Tax Invoice API Endpoints
 *
 * All invoice endpoints route through API Gateway (port 3001) to the
 * shipment-service (`backend/shipment-service/controllers/invoiceController.js`).
 *
 * Response envelope (see `shared/lib/response.js`):
 *  - APIResponse.success(data, meta)   -> { status, data, meta: { timestamp, ...meta } }
 *  - APIResponse.paginated(data, pag)  -> { status, data, meta: { timestamp, pagination } }
 *
 * NOTE: pagination lives under `meta.pagination`, NOT `data.pagination` -
 * `listInvoices` uses `APIResponse.paginated`, unlike some other list
 * endpoints in this service that nest pagination inside `data`.
 */

export type InvoiceType = "TAX_INVOICE" | "CREDIT_NOTE" | "DEBIT_NOTE";
export type InvoiceStatus = "ISSUED" | "CANCELLED";
export type SupplyType = "INTRA" | "INTER";

export interface InvoiceLineItem {
  name: string;
  amount: number;
}

export interface Invoice {
  id: string;
  shipmentId: string;
  invoiceType: InvoiceType;
  invoiceNumber: string;
  financialYear: string;
  status: InvoiceStatus;
  issueDate: string;

  originalInvoiceId: string | null;
  financialAdjustmentId: string | null;

  outletId: string | null;
  clientId: string | null;
  billedName: string;
  billedGstin: string | null;
  billedAddressLine1: string | null;
  billedAddressLine2: string | null;
  billedCity: string | null;
  billedState: string | null;
  billedStateCode: string | null;
  billedPincode: string | null;

  // Shipment snapshot — what is being billed for.
  orderId: string | null;
  awbNumber: string | null;
  partnerName: string | null;
  serviceType: string | null;
  shipmentDate: string | null;
  originCity: string | null;
  originPincode: string | null;
  destinationCity: string | null;
  destinationPincode: string | null;
  chargeableWeight: number | null;

  placeOfSupplyState: string;
  placeOfSupplyStateCode: string;
  supplyType: SupplyType;

  taxableValue: number;
  cgstRate: number | null;
  cgstAmount: number | null;
  sgstRate: number | null;
  sgstAmount: number | null;
  igstRate: number | null;
  igstAmount: number | null;
  totalAmount: number;
  hsnSacCode: string;

  lineItems: InvoiceLineItem[];

  pdfUrl: string | null;

  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoicePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface IssueInvoiceResponse {
  status: string;
  data: { invoice: Invoice };
  meta: { timestamp: string; message?: string };
}

export interface GetInvoiceResponse {
  status: string;
  data: { invoice: Invoice };
  meta: { timestamp: string; message?: string };
}

export interface ListInvoicesParams {
  outletId?: string;
  clientId?: string;
  shipmentId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: InvoiceStatus;
  invoiceType?: InvoiceType;
  page?: number;
  limit?: number;
}

export interface ListInvoicesResponse {
  status: string;
  data: { invoices: Invoice[] };
  meta: { timestamp: string; pagination: InvoicePagination };
}

export interface IssueNoteResponse {
  status: string;
  data: { note: Invoice | null };
  meta: { timestamp: string; message?: string };
}

export const invoiceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * POST /api/v1/invoices/shipments/:shipmentId/issue
     * Issues (or idempotently returns the existing) tax invoice for a shipment.
     */
    issueInvoice: builder.mutation<IssueInvoiceResponse, string>({
      query: (shipmentId) => ({
        url: `/api/v1/invoices/shipments/${shipmentId}/issue`,
        method: "POST",
      }),
      invalidatesTags: (result, error, shipmentId) => [
        { type: "Shipment", id: shipmentId },
        "Shipment",
      ],
    }),

    /**
     * GET /api/v1/invoices/:id
     */
    getInvoice: builder.query<GetInvoiceResponse, string>({
      query: (id) => `/api/v1/invoices/${id}`,
      providesTags: (result, error, id) => [
        { type: "Shipment", id: `invoice-${id}` },
      ],
    }),

    /**
     * GET /api/v1/invoices
     */
    listInvoices: builder.query<
      ListInvoicesResponse,
      ListInvoicesParams | void
    >({
      query: (params) => {
        const search = new URLSearchParams();
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
              search.set(key, String(value));
            }
          });
        }
        const qs = search.toString();
        return `/api/v1/invoices${qs ? `?${qs}` : ""}`;
      },
      providesTags: (result) =>
        result?.data?.invoices
          ? [
              ...result.data.invoices.map((invoice) => ({
                type: "Shipment" as const,
                id: `invoice-${invoice.id}`,
              })),
              { type: "Shipment" as const, id: "INVOICE_LIST" },
            ]
          : [{ type: "Shipment" as const, id: "INVOICE_LIST" }],
    }),

    /**
     * POST /api/v1/invoices/notes
     * Issues a credit/debit note correcting an already-issued tax invoice,
     * or returns { note: null } if there is nothing to correct.
     */
    issueNote: builder.mutation<
      IssueNoteResponse,
      { financialAdjustmentId: string }
    >({
      query: (body) => ({
        url: "/api/v1/invoices/notes",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Shipment" as const, id: "INVOICE_LIST" }],
    }),

    /**
     * GET /api/v1/invoices/:id/pdf
     * Streams the invoice PDF. Response handled as a Blob so the caller can
     * trigger a browser download the same way `downloadLabel` does elsewhere
     * in this app (see `shipmentApi.ts`).
     */
    downloadInvoicePdf: builder.mutation<Blob, string>({
      query: (id) => ({
        url: `/api/v1/invoices/${id}/pdf`,
        method: "GET",
        responseHandler: (response) => response.blob(),
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useIssueInvoiceMutation,
  useGetInvoiceQuery,
  useListInvoicesQuery,
  useIssueNoteMutation,
  useDownloadInvoicePdfMutation,
} = invoiceApi;
