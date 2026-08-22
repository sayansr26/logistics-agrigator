"use client";

/**
 * Invoice document view.
 *
 * This renders the invoice as the document itself — the same layout as the
 * generated PDF — rather than as a dashboard panel about an invoice. That is
 * deliberate: an invoice is a thing people print, file and send on, so the page
 * should be recognisable as that artefact.
 *
 * Printing is first-class: `@media print` drops the app chrome and the action
 * bar, so Cmd-P / Save-as-PDF produces a clean invoice with no sidebar,
 * breadcrumbs or buttons bleeding into the page.
 */

import { useParams } from "next/navigation";
import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Button } from "@/components/ui/button";
import { LogoMark, Wordmark } from "@/components/landing/chrome/logo";
import {
  useGetInvoiceQuery,
  useDownloadInvoicePdfMutation,
} from "@/store/api/endpoints/invoiceApi";

/** Supplier identity. Mirrors invoicePdfService.js on the backend. */
const SUPPLIER = {
  address: "401, Pooja Complex, Veer Savarkar Block, Shakarpur, Delhi 110092",
  phone: "+91 98105 92557",
  email: "support@subsolution.in",
  website: "subsolution.in",
  // Mirrors PLATFORM_GSTIN on the backend, which has no default on purpose —
  // an invented GSTIN on a tax invoice is a compliance problem.
  gstin: process.env.NEXT_PUBLIC_PLATFORM_GSTIN || "GSTIN NOT CONFIGURED",
};

function money(n: number | null | undefined) {
  return `₹${Number(n ?? 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const DOC_TITLE: Record<string, string> = {
  TAX_INVOICE: "TAX INVOICE",
  CREDIT_NOTE: "CREDIT NOTE",
  DEBIT_NOTE: "DEBIT NOTE",
};

export default function InvoiceDocumentPage() {
  const params = useParams<{ id: string }>();
  const invoiceId = params.id;

  const { data, isLoading, error } = useGetInvoiceQuery(invoiceId, {
    skip: !invoiceId,
  });
  const invoice = data?.data?.invoice;
  const [downloadInvoicePdf, { isLoading: downloading }] =
    useDownloadInvoicePdfMutation();

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Wallet & Billing", href: "/wallet" },
    { title: "Invoices", href: "/wallet/invoices" },
    { title: invoice?.invoiceNumber || "Invoice" },
  ];

  const handleDownload = async () => {
    if (!invoice) return;
    try {
      const blob = await downloadInvoicePdf(invoice.id).unwrap();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice.invoiceNumber.replace(/[/\\]/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // RTK error middleware surfaces a toast
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="mx-auto max-w-4xl p-6">
          <div className="h-[600px] animate-pulse rounded-xl bg-muted" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !invoice) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="mx-auto max-w-4xl p-6">
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="text-sm font-medium">Invoice not found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              It may have been removed, or you may not have access to it.
            </p>
            <Link href="/wallet/invoices">
              <Button variant="outline" size="sm" className="mt-4">
                Back to invoices
              </Button>
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const isIgst = invoice.igstAmount !== null;

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      {/* Print rules.
          Hide by VISIBILITY on everything, then re-show the sheet — do NOT hide
          by tag name. An earlier version hid `header`, which also matched this
          document's own supplier/title block and printed an invoice with no
          brand, no title and no invoice number. Visibility-based scoping cannot
          make that mistake: whatever is inside .invoice-sheet always prints. */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 14mm;
          }
          body {
            background: #fff !important;
          }
          body * {
            visibility: hidden !important;
          }
          .invoice-sheet,
          .invoice-sheet * {
            visibility: visible !important;
          }
          .invoice-sheet {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #fff !important;
          }
          /* Ink-friendly: force text black, but keep the brand mark orange so
             the printed sheet still reads as ours. */
          .invoice-sheet *:not(.keep-accent):not(.keep-accent *) {
            color: #000 !important;
          }
          .invoice-sheet .keep-accent,
          .invoice-sheet .keep-accent * {
            color: #f04e23 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Actions — not part of the document */}
        <div className="no-print mb-4 flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            title="Print or save as PDF"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={downloading}>
            <Download className="mr-2 h-4 w-4" />
            {downloading ? "Preparing…" : "Download PDF"}
          </Button>
        </div>

        {/* The document */}
        <article className="invoice-sheet rounded-xl border bg-card p-8 shadow-sm sm:p-10">
          {/* Supplier + document title */}
          <header className="flex flex-wrap items-start justify-between gap-6 border-b pb-6">
            <div className="flex items-start gap-3">
              {/* keep-accent survives the print stylesheet's black-ink rule, so
                  the mark and "SUB" stay brand orange on paper. */}
              <span className="keep-accent">
                <LogoMark size={34} />
              </span>
              <div>
                {/* The wordmark prints black. Only the mark keeps its colour —
                    scoping the accent to part of the wordmark would need a
                    selector that also catches "Solution". */}
                <Wordmark
                  className="text-[20px]"
                  secondaryClassName="text-foreground"
                />
                <p className="mt-1 max-w-[18rem] text-xs leading-relaxed text-muted-foreground">
                  {SUPPLIER.address}
                </p>
                <p className="text-xs text-muted-foreground">
                  {SUPPLIER.phone} · {SUPPLIER.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  {SUPPLIER.website}
                </p>
                <p className="mt-0.5 font-mono text-xs font-semibold">
                  GSTIN: {SUPPLIER.gstin}
                </p>
              </div>
            </div>

            <div className="text-right">
              <h1 className="text-xl font-bold tracking-tight">
                {DOC_TITLE[invoice.invoiceType] || "TAX INVOICE"}
              </h1>
              <p className="mt-1 font-mono text-sm font-semibold">
                {invoice.invoiceNumber}
              </p>
              <p className="text-xs text-muted-foreground">
                Issued {formatDate(invoice.issueDate)}
              </p>
              <p className="text-xs text-muted-foreground">
                FY {invoice.financialYear}
              </p>
            </div>
          </header>

          {/* Billed to + supply details */}
          <section className="grid gap-6 border-b py-6 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Billed to
              </p>
              <p className="mt-1.5 text-sm font-semibold">
                {invoice.billedName}
              </p>
              {invoice.billedGstin && (
                <p className="font-mono text-xs text-muted-foreground">
                  GSTIN: {invoice.billedGstin}
                </p>
              )}
              {(invoice.billedAddressLine1 ||
                invoice.billedCity ||
                invoice.billedPincode) && (
                <p className="mt-1 max-w-[20rem] text-xs leading-relaxed text-muted-foreground">
                  {[
                    invoice.billedAddressLine1,
                    invoice.billedAddressLine2,
                    invoice.billedCity,
                    invoice.billedState,
                    invoice.billedPincode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
            </div>

            <dl className="space-y-1.5 text-xs sm:text-right">
              <div className="flex justify-between sm:justify-end sm:gap-3">
                <dt className="text-muted-foreground">Place of supply</dt>
                <dd className="font-medium">
                  {invoice.placeOfSupplyState} ({invoice.placeOfSupplyStateCode}
                  )
                </dd>
              </div>
              <div className="flex justify-between sm:justify-end sm:gap-3">
                <dt className="text-muted-foreground">Supply type</dt>
                <dd className="font-medium">
                  {invoice.supplyType === "INTRA"
                    ? "Intra-state (CGST + SGST)"
                    : "Inter-state (IGST)"}
                </dd>
              </div>
              <div className="flex justify-between sm:justify-end sm:gap-3">
                <dt className="text-muted-foreground">HSN / SAC</dt>
                <dd className="font-mono font-medium">{invoice.hsnSacCode}</dd>
              </div>
            </dl>
          </section>

          {/* What is being billed for. Without this the invoice carried only an
              internal shipment UUID, which the recipient cannot reconcile
              against anything they hold. */}
          <section className="border-b py-6">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Shipment details
            </p>
            <dl className="mt-2 grid gap-x-8 gap-y-1.5 text-xs sm:grid-cols-2">
              {invoice.orderId && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Order ID</dt>
                  <dd className="font-mono font-semibold">
                    <Link
                      href={`/shipments/${invoice.shipmentId}`}
                      className="text-blue-600 hover:underline print:text-black"
                    >
                      {invoice.orderId}
                    </Link>
                  </dd>
                </div>
              )}
              {invoice.awbNumber && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">AWB / Tracking no</dt>
                  <dd className="font-mono font-semibold">
                    {invoice.awbNumber}
                  </dd>
                </div>
              )}
              {invoice.partnerName && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Courier</dt>
                  <dd className="font-medium">{invoice.partnerName}</dd>
                </div>
              )}
              {invoice.serviceType && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Service</dt>
                  <dd className="font-medium">{invoice.serviceType}</dd>
                </div>
              )}
              {(invoice.originCity || invoice.destinationCity) && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Route</dt>
                  <dd className="text-right font-medium">
                    {invoice.originCity || "—"}
                    {invoice.originPincode && ` (${invoice.originPincode})`}
                    {" → "}
                    {invoice.destinationCity || "—"}
                    {invoice.destinationPincode &&
                      ` (${invoice.destinationPincode})`}
                  </dd>
                </div>
              )}
              {invoice.chargeableWeight !== null && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Chargeable weight</dt>
                  <dd className="font-medium">
                    {Number(invoice.chargeableWeight)} kg
                  </dd>
                </div>
              )}
              {invoice.shipmentDate && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Shipment date</dt>
                  <dd className="font-medium">
                    {formatDate(invoice.shipmentDate)}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* Line items */}
          <section className="py-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 font-semibold">Description</th>
                  <th className="pb-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((li, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2.5">{li.name}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      {money(li.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Tax summary */}
            <div className="mt-6 flex justify-end">
              <dl className="w-full max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Taxable value</dt>
                  <dd className="tabular-nums">
                    {money(invoice.taxableValue)}
                  </dd>
                </div>

                {isIgst ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      IGST ({invoice.igstRate}%)
                    </dt>
                    <dd className="tabular-nums">
                      {money(invoice.igstAmount)}
                    </dd>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">
                        CGST ({invoice.cgstRate}%)
                      </dt>
                      <dd className="tabular-nums">
                        {money(invoice.cgstAmount)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">
                        SGST ({invoice.sgstRate}%)
                      </dt>
                      <dd className="tabular-nums">
                        {money(invoice.sgstAmount)}
                      </dd>
                    </div>
                  </>
                )}

                <div className="flex justify-between border-t pt-2 text-base font-bold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{money(invoice.totalAmount)}</dd>
                </div>
              </dl>
            </div>
          </section>

          <footer className="border-t pt-4 text-[10px] leading-relaxed text-muted-foreground">
            <p>
              This is a system-generated{" "}
              {DOC_TITLE[invoice.invoiceType]?.toLowerCase() || "document"} and
              does not require a signature. Place of supply and supplier state
              are derived from the shipment&apos;s pickup and billing addresses;
              please have your accounts team verify before GST filing.
            </p>
          </footer>
        </article>
      </div>
    </DashboardLayout>
  );
}
