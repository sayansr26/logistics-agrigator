"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  mockTransactions,
  getTransactionStatusColor,
  formatCurrency,
} from "@/lib/mock-data";
import {
  Download,
  Printer,
  Share2,
  Copy,
  CheckCircle,
  Clock,
  XCircle,
  CreditCard,
  Wallet,
  Package,
  Hash,
  Truck,
  Scale,
  Navigation,
  FileText,
  AlertCircle,
} from "lucide-react";

interface TransactionDetailProps {
  transaction: any;
}

function TransactionDetail({ transaction }: TransactionDetailProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to copy text: ", err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getTransactionType = () => {
    if (transaction.credit > 0 && transaction.debit > 0) {
      return "Credit & Debit";
    } else if (transaction.credit > 0) {
      return "Credit";
    } else if (transaction.debit > 0) {
      return "Debit";
    }
    return "N/A";
  };

  const getTransactionDescription = () => {
    if (transaction.credit > 0 && transaction.debit === 0) {
      return "Wallet top-up or refund";
    } else if (transaction.debit > 0 && transaction.credit === 0) {
      return "Shipment charges or service fee";
    } else if (transaction.credit > 0 && transaction.debit > 0) {
      return "Partial refund or adjustment";
    }
    return "Transaction";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Transaction Details
            </h1>
            <p className="text-muted-foreground">
              Reference: {transaction.transactionDetails.reference}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Transaction Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Transaction Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                {getStatusIcon(transaction.transactionDetails.status)}
                <span>Transaction Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Badge
                    className={getTransactionStatusColor(
                      transaction.transactionDetails.status,
                    )}
                  >
                    {transaction.transactionDetails.status.toUpperCase()}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-2">
                    {getTransactionDescription()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">
                    {transaction.credit > 0 ? (
                      <span className="text-green-600">
                        +{formatCurrency(transaction.credit)}
                      </span>
                    ) : (
                      <span className="text-red-600">
                        -{formatCurrency(transaction.debit)}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {getTransactionType()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transaction Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Hash className="h-5 w-5" />
                <span>Transaction Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Transaction ID
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-mono">
                        {transaction.id}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(transaction.id, "id")}
                      >
                        {copied === "id" ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Reference Number
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-mono">
                        {transaction.transactionDetails.reference}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(
                            transaction.transactionDetails.reference,
                            "reference",
                          )
                        }
                      >
                        {copied === "reference" ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Date & Time
                    </span>
                    <span className="text-sm">
                      {transaction.transactionDetails.date} at{" "}
                      {transaction.transactionDetails.time}
                    </span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Account Number
                    </span>
                    <span className="text-sm font-medium">
                      {transaction.accountDetails.accountNumber}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Order ID
                    </span>
                    <span className="text-sm">
                      {transaction.orderId || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      AWB/LRN
                    </span>
                    <span className="text-sm">
                      {transaction.awbLrn || "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipment Details (if applicable) */}
          {transaction.orderId && transaction.awbLrn && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <span>Shipment Details</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Order ID</p>
                        <p className="text-sm text-muted-foreground">
                          {transaction.orderId}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">AWB/LRN</p>
                        <p className="text-sm text-muted-foreground">
                          {transaction.awbLrn}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Scale className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Weight</p>
                        <p className="text-sm text-muted-foreground">
                          {transaction.weightZone.weight} kg
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Navigation className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Zone</p>
                        <p className="text-sm text-muted-foreground">
                          Zone {transaction.weightZone.zone}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Financial Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5" />
                <span>Financial Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Credit Amount</p>
                      <p className="text-sm text-muted-foreground">
                        Money added to wallet
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(transaction.credit)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Debit Amount</p>
                      <p className="text-sm text-muted-foreground">
                        Money deducted from wallet
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-red-600">
                      {formatCurrency(transaction.debit)}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Net Impact</p>
                      <p className="text-sm text-muted-foreground">
                        Total change in wallet balance
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-600">
                      {transaction.credit > transaction.debit ? "+" : ""}
                      {formatCurrency(transaction.credit - transaction.debit)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Receipt
              </Button>
              <Button className="w-full" variant="outline">
                <Printer className="h-4 w-4 mr-2" />
                Print Receipt
              </Button>
              <Button className="w-full" variant="outline">
                <Share2 className="h-4 w-4 mr-2" />
                Share Transaction
              </Button>
              {transaction.transactionDetails.status === "pending" && (
                <Button className="w-full" variant="outline">
                  <Clock className="h-4 w-4 mr-2" />
                  Track Status
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Transaction Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Transaction Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center mt-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Transaction Created</p>
                    <p className="text-xs text-muted-foreground">
                      {transaction.transactionDetails.date} at{" "}
                      {transaction.transactionDetails.time}
                    </p>
                  </div>
                </div>
                {transaction.transactionDetails.status === "completed" && (
                  <div className="flex items-start space-x-3">
                    <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center mt-1">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        Transaction Completed
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {transaction.transactionDetails.date} at{" "}
                        {transaction.transactionDetails.time}
                      </p>
                    </div>
                  </div>
                )}
                {transaction.transactionDetails.status === "pending" && (
                  <div className="flex items-start space-x-3">
                    <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center mt-1">
                      <Clock className="h-4 w-4 text-yellow-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Processing</p>
                      <p className="text-xs text-muted-foreground">
                        Transaction is being processed
                      </p>
                    </div>
                  </div>
                )}
                {transaction.transactionDetails.status === "failed" && (
                  <div className="flex items-start space-x-3">
                    <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center mt-1">
                      <XCircle className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Transaction Failed</p>
                      <p className="text-xs text-muted-foreground">
                        Please contact support for assistance
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Support Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  If you have questions about this transaction, our support team
                  is here to help.
                </p>
                <Button className="w-full" variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Contact Support
                </Button>
                <Button className="w-full" variant="outline">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Report Issue
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function TransactionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [transaction, setTransaction] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const transactionId = params.id as string;
    const foundTransaction = mockTransactions.find(
      (t) => t.id === transactionId,
    );

    if (foundTransaction) {
      setTransaction(foundTransaction);
    } else {
      // Handle transaction not found
      router.push("/wallet");
    }
    setLoading(false);
  }, [params.id, router]);

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Wallet & Billing", href: "/wallet" },
    { title: "Transaction Details" },
  ];

  if (loading) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-muted-foreground">
              Loading transaction details...
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!transaction) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              Transaction Not Found
            </h2>
            <p className="text-muted-foreground mb-4">
              The transaction you&apos;re looking for doesn&apos;t exist or has
              been removed.
            </p>
            <Button onClick={() => router.push("/wallet")}>
              Back to Wallet
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto">
        <TransactionDetail transaction={transaction} />
      </div>
    </DashboardLayout>
  );
}
