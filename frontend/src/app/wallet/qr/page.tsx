"use client";

import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Printer,
  QrCode,
  RefreshCw,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PaymentStatusChip } from "@/components/wallet/payment-status-chip";
import { CopyButton } from "@/components/wallet/copy-button";
import { formatINR } from "@/lib/utils";
import {
  useGetMyOutletQrQuery,
  useGetMyQrCollectionsQuery,
} from "@/store/api/endpoints/qrCollectionApi";
import { usePaymentProvider } from "@/hooks/usePaymentProvider";

const PAGE_SIZE = 20;

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function OutletQrPage() {
  // The whole page hangs off the CCAvenue static UPI QR channel. With it off
  // there is no QR to print and nothing can be credited, so the page says so
  // instead of showing "no QR provisioned" — which reads as a provisioning
  // request the account manager cannot fulfil while the channel is disabled.
  const { isStaticQrAvailable, isLoading: providerLoading } =
    usePaymentProvider();
  const qrChannelOff = !providerLoading && !isStaticQrAvailable;

  const {
    data: qr,
    isLoading: qrLoading,
    error: qrError,
    refetch: refetchQr,
  } = useGetMyOutletQrQuery(undefined, { skip: !isStaticQrAvailable });

  // The endpoint 404s when the outlet has no QR provisioned yet - that's an
  // expected empty state, not a failure, so it gets its own branch below
  // rather than the generic "failed to load" error card.
  const qrNotProvisioned =
    (qrError as { status?: number } | undefined)?.status === 404;
  const qrFailedToLoad = !!qrError && !qrNotProvisioned;

  const [page, setPage] = useState(0);
  const {
    data: creditsData,
    isLoading: creditsLoading,
    error: creditsError,
  } = useGetMyQrCollectionsQuery(
    { page, size: PAGE_SIZE },
    { skip: !isStaticQrAvailable },
  );
  const credits = creditsData?.data ?? [];
  const pagination = creditsData?.pagination;

  const handlePrint = () => window.print();

  if (qrChannelOff) {
    return (
      <DashboardLayout
        customBreadcrumbs={[
          { title: "Dashboard", href: "/dashboard" },
          { title: "Wallet & Billing", href: "/wallet" },
          { title: "My QR Code" },
        ]}
      >
        <div className="max-w-2xl mx-auto space-y-6 p-6">
          <Card>
            <CardContent className="text-center py-12">
              <QrCode className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium">
                UPI QR top-up is not available
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                The QR collection channel is currently switched off. Use the
                wallet top-up options on the Wallet page instead.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      customBreadcrumbs={[
        { title: "Dashboard", href: "/dashboard" },
        { title: "Wallet & Billing", href: "/wallet" },
        { title: "My QR Code" },
      ]}
    >
      {/* Print-only styles: hide everything except the dedicated print block. */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #outlet-qr-print-block,
          #outlet-qr-print-block * {
            visibility: visible;
          }
          #outlet-qr-print-block {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 24px;
          }
        }
      `}</style>

      <div className="max-w-2xl mx-auto space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2.5">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950">
                <QrCode className="h-5 w-5" />
              </div>
              My QR Code
            </h1>
            <p className="text-sm text-muted-foreground">
              Anyone can scan and pay any amount; it credits your wallet
              automatically, usually within a minute.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => refetchQr()}
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            {qr && (
              <Button size="sm" className="h-8 text-xs" onClick={handlePrint}>
                <Printer className="h-3.5 w-3.5 mr-1.5" />
                Print
              </Button>
            )}
          </div>
        </div>

        {qrFailedToLoad && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-sm text-destructive">
                Failed to load your QR code. Please try again later.
              </p>
            </CardContent>
          </Card>
        )}

        {/* QR Card */}
        <Card>
          <CardContent className="pt-6 pb-6">
            {qrLoading ? (
              <div className="flex items-center justify-center gap-2 py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Loading your QR code...
                </span>
              </div>
            ) : !qr || qrNotProvisioned ? (
              <div className="text-center py-12">
                <QrCode className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-medium">No QR code provisioned</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ask your account manager to enable UPI QR top-up.
                </p>
              </div>
            ) : (
              <div id="outlet-qr-print-block" className="space-y-4">
                {qr.mode === "TEST" && (
                  <Alert variant="warning" className="print:hidden">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Test QR — payments to this code will not credit your
                      wallet.
                    </AlertDescription>
                  </Alert>
                )}

                <p className="hidden text-center text-lg font-semibold print:block">
                  {qr.outletName || qr.label || "Scan to pay"}
                </p>

                <div className="flex flex-col items-center gap-4">
                  {qr.qrImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qr.qrImageUrl}
                      alt="UPI QR code"
                      className="h-64 w-64 rounded-lg border object-contain p-2 print:h-72 print:w-72"
                    />
                  ) : qr.qrPayload ? (
                    <div className="w-full space-y-2">
                      <Alert variant="info" className="print:hidden">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          No scannable QR image is on file for this code yet —
                          only the raw payload string. Rendering an actual QR
                          client-side would need a QR-generation library (none
                          is installed in this project), so it&apos;s shown
                          below as copyable text instead.
                        </AlertDescription>
                      </Alert>
                      <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3">
                        <code className="flex-1 break-all font-mono text-xs">
                          {qr.qrPayload}
                        </code>
                        <CopyButton value={qr.qrPayload} label="Copy payload" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-64 w-64 items-center justify-center rounded-lg border border-dashed text-center text-xs text-muted-foreground">
                      No QR image or payload on file for this code.
                    </div>
                  )}

                  {qr.vpa && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">
                        {qr.vpa}
                      </span>
                      <CopyButton value={qr.vpa} label="Copy VPA" />
                    </div>
                  )}

                  {qr.label && (
                    <p className="text-xs text-muted-foreground print:hidden">
                      {qr.label}
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent QR-sourced credits */}
        <Card className="print:hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Credits from this QR</CardTitle>
            <CardDescription>
              Wallet credits reconciled from payments made to your QR code.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {creditsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin mr-2 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Loading credits...
                </span>
              </div>
            ) : creditsError ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Failed to load credits
                </p>
              </div>
            ) : credits.length === 0 ? (
              <div className="text-center py-12">
                <QrCode className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No QR payments received yet.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-6">Received</TableHead>
                        <TableHead>UTR</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Payer</TableHead>
                        <TableHead className="pr-6">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {credits.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="pl-6 whitespace-nowrap text-sm text-muted-foreground">
                            {formatDate(c.receivedAt)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {c.utr || "-"}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatINR(c.amount)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {c.payerName || c.payerVpa || "-"}
                          </TableCell>
                          <TableCell className="pr-6">
                            <PaymentStatusChip status={c.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {pagination && pagination.total_pages > 1 && (
                  <div className="flex items-center justify-between px-6 py-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      Page {pagination.current_page + 1} of{" "}
                      {pagination.total_pages}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!pagination.has_previous}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!pagination.has_next}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
