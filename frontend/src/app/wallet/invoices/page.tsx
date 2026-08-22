"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useListInvoicesQuery,
  useDownloadInvoicePdfMutation,
  type Invoice,
  type InvoiceStatus,
  type InvoiceType,
} from "@/store/api/endpoints/invoiceApi";
import { formatEnumLabel } from "@/lib/utils/shipment-status";
import {
  FileText,
  AlertCircle,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

const ITEMS_PER_PAGE = 20;
const ALL = "ALL";

const INVOICE_TYPES: InvoiceType[] = [
  "TAX_INVOICE",
  "CREDIT_NOTE",
  "DEBIT_NOTE",
];
const INVOICE_STATUSES: InvoiceStatus[] = ["ISSUED", "CANCELLED"];

function formatCurrency(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getInvoiceTypeColor(type: InvoiceType): string {
  switch (type) {
    case "TAX_INVOICE":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "CREDIT_NOTE":
      return "bg-green-100 text-green-800 border-green-200";
    case "DEBIT_NOTE":
      return "bg-orange-100 text-orange-800 border-orange-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

function getInvoiceStatusColor(status: InvoiceStatus): string {
  return status === "ISSUED"
    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
    : "bg-red-100 text-red-800 border-red-200";
}

export default function InvoicesPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [invoiceType, setInvoiceType] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [currentPage, setCurrentPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Wallet & Billing", href: "/wallet" },
    { title: "Tax Invoices" },
  ];

  const queryParams = useMemo(
    () => ({
      page: currentPage,
      limit: ITEMS_PER_PAGE,
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(invoiceType !== ALL
        ? { invoiceType: invoiceType as InvoiceType }
        : {}),
      ...(status !== ALL ? { status: status as InvoiceStatus } : {}),
    }),
    [currentPage, dateFrom, dateTo, invoiceType, status],
  );

  const { data, isLoading, isFetching, error, refetch } =
    useListInvoicesQuery(queryParams);

  const [downloadInvoicePdf] = useDownloadInvoicePdfMutation();

  const invoices = data?.data?.invoices ?? [];
  const pagination = data?.meta?.pagination;
  const totalPages = pagination?.totalPages ?? 0;
  const totalRecords = pagination?.total ?? 0;

  const handlePageChange = (page: number) => {
    if (page < 1 || (totalPages > 0 && page > totalPages)) return;
    setCurrentPage(page);
  };

  const handleFilterChange = () => setCurrentPage(1);

  const handleDownload = async (invoice: Invoice) => {
    setDownloadingId(invoice.id);
    try {
      const blob = await downloadInvoicePdf(invoice.id).unwrap();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice.invoiceNumber.replace(/[/\\]/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Error is surfaced by RTK Query global error handling.
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
              <FileText className="h-8 w-8 text-logistics-600" />
              <span>Tax Invoices</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Tax invoices, credit notes, and debit notes issued for your
              shipments
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="px-3"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Invoice History</span>
                </CardTitle>
                <CardDescription>
                  {totalRecords} invoice{totalRecords === 1 ? "" : "s"} found
                </CardDescription>
              </div>
              <div className="flex items-end flex-wrap gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">From</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      handleFilterChange();
                    }}
                    className="w-40"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">To</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      handleFilterChange();
                    }}
                    className="w-40"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={invoiceType}
                    onValueChange={(value) => {
                      setInvoiceType(value);
                      handleFilterChange();
                    }}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All types</SelectItem>
                      {INVOICE_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {formatEnumLabel(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={status}
                    onValueChange={(value) => {
                      setStatus(value);
                      handleFilterChange();
                    }}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All statuses</SelectItem>
                      {INVOICE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {formatEnumLabel(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-10 w-10 text-red-500 mb-3" />
                <p className="text-lg font-medium text-foreground">
                  Failed to load invoices
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Check your connection and try again.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => refetch()}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
                </Button>
              </div>
            ) : isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 flex-1" />
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                ))}
              </div>
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-lg font-medium text-foreground">
                  No invoices found
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Tax invoices appear here once they are issued for a shipment.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableCaption>
                      A list of your tax invoices, credit notes, and debit notes
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice Number</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Shipment</TableHead>
                        <TableHead>Issue Date</TableHead>
                        <TableHead className="text-right">
                          Total Amount
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">
                            <Link
                              href={`/wallet/invoices/${invoice.id}`}
                              className="hover:underline text-logistics-700"
                            >
                              {invoice.invoiceNumber}
                            </Link>
                            <div className="text-xs text-muted-foreground">
                              FY {invoice.financialYear}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={getInvoiceTypeColor(
                                invoice.invoiceType,
                              )}
                            >
                              {formatEnumLabel(invoice.invoiceType)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/shipments/${invoice.shipmentId}`}
                              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
                            >
                              {invoice.shipmentId.slice(0, 8)}...
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </TableCell>
                          <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(invoice.totalAmount)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={getInvoiceStatusColor(invoice.status)}
                            >
                              {formatEnumLabel(invoice.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(invoice)}
                              disabled={downloadingId === invoice.id}
                            >
                              <Download className="h-4 w-4 mr-1.5" />
                              {downloadingId === invoice.id
                                ? "Downloading..."
                                : "PDF"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination - server-side */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <div className="text-sm text-muted-foreground">
                      Page {pagination?.page ?? currentPage} of {totalPages} (
                      {totalRecords} total)
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1 || isFetching}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages || isFetching}
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
