"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  mockInvoices,
  getInvoiceStatusColor,
  formatCurrency,
  formatDate,
} from "@/lib/mock-data";
import {
  ArrowLeft,
  Download,
  Printer,
  Share2,
  Copy,
  CheckCircle,
  Clock,
  XCircle,
  CreditCard,
  FileText,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Hash,
  Building,
  Mail,
  Phone,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

interface InvoiceDetailProps {
  invoice: any;
}

function InvoiceDetail({ invoice }: InvoiceDetailProps) {
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
      case "paid":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case "overdue":
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getDaysUntilDue = () => {
    const dueDate = new Date(invoice.dueDate);
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getDueStatus = () => {
    const daysUntilDue = getDaysUntilDue();
    if (invoice.status === "paid") return "Paid";
    if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)} days overdue`;
    if (daysUntilDue === 0) return "Due today";
    if (daysUntilDue === 1) return "Due tomorrow";
    return `Due in ${daysUntilDue} days`;
  };

  const getDueStatusColor = () => {
    const daysUntilDue = getDaysUntilDue();
    if (invoice.status === "paid") return "text-green-600";
    if (daysUntilDue < 0) return "text-red-600";
    if (daysUntilDue <= 3) return "text-orange-600";
    return "text-blue-600";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Invoice Details
            </h1>
            <p className="text-muted-foreground">
              Invoice: {invoice.invoiceNumber}
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
            Download PDF
          </Button>
          {invoice.status !== "paid" && (
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <CreditCard className="h-4 w-4 mr-2" />
              Pay Now
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Invoice Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                {getStatusIcon(invoice.status)}
                <span>Invoice Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Badge className={getInvoiceStatusColor(invoice.status)}>
                    {invoice.status.toUpperCase()}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-2">
                    {invoice.description}
                  </p>
                  <p
                    className={`text-sm font-medium mt-1 ${getDueStatusColor()}`}
                  >
                    {getDueStatus()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(invoice.amount)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Hash className="h-5 w-5" />
                <span>Invoice Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Invoice Number
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-mono">
                        {invoice.invoiceNumber}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(
                            invoice.invoiceNumber,
                            "invoiceNumber",
                          )
                        }
                      >
                        {copied === "invoiceNumber" ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Invoice ID
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-mono">{invoice.id}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(invoice.id, "id")}
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
                      Issued Date
                    </span>
                    <span className="text-sm">
                      {formatDate(invoice.issuedDate)}
                    </span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Due Date
                    </span>
                    <span className="text-sm">
                      {formatDate(invoice.dueDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Days Until Due
                    </span>
                    <span
                      className={`text-sm font-medium ${getDueStatusColor()}`}
                    >
                      {getDaysUntilDue()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Status
                    </span>
                    <Badge className={getInvoiceStatusColor(invoice.status)}>
                      {invoice.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Description */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Invoice Description</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">
                    {invoice.description}
                  </p>
                </div>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Service Period</h4>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(invoice.issuedDate)} -{" "}
                      {formatDate(invoice.dueDate)}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Payment Terms</h4>
                    <p className="text-sm text-muted-foreground">Net 30 days</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5" />
                <span>Payment Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Invoice Amount</p>
                      <p className="text-sm text-muted-foreground">
                        Total amount due
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-600">
                      {formatCurrency(invoice.amount)}
                    </p>
                  </div>
                </div>

                {invoice.status === "paid" && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Amount Paid</p>
                          <p className="text-sm text-muted-foreground">
                            Payment completed
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">
                          {formatCurrency(invoice.amount)}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {invoice.status === "overdue" && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                          <AlertTriangle className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Overdue Amount</p>
                          <p className="text-sm text-muted-foreground">
                            {Math.abs(getDaysUntilDue())} days overdue
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-red-600">
                          {formatCurrency(invoice.amount)}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building className="h-5 w-5" />
                <span>Company Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">From (Your Company)</h4>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Logistics Solutions Inc.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      123 Business Street
                      <br />
                      Suite 100
                      <br />
                      New York, NY 10001
                      <br />
                      United States
                    </p>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>billing@logistics.com</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>+1 (555) 123-4567</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-medium">To (Client)</h4>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Client Company Name</p>
                    <p className="text-sm text-muted-foreground">
                      456 Client Avenue
                      <br />
                      Business District
                      <br />
                      Los Angeles, CA 90210
                      <br />
                      United States
                    </p>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>accounts@clientcompany.com</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>+1 (555) 987-6543</span>
                    </div>
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
                Download PDF
              </Button>
              <Button className="w-full" variant="outline">
                <Printer className="h-4 w-4 mr-2" />
                Print Invoice
              </Button>
              <Button className="w-full" variant="outline">
                <Share2 className="h-4 w-4 mr-2" />
                Share Invoice
              </Button>
              <Button className="w-full" variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Online
              </Button>
              {invoice.status !== "paid" && (
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pay Now
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Invoice Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Invoice Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center mt-1">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Invoice Created</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(invoice.issuedDate)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center mt-1">
                    <Mail className="h-4 w-4 text-yellow-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Invoice Sent</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(invoice.issuedDate)}
                    </p>
                  </div>
                </div>
                {invoice.status === "paid" && (
                  <div className="flex items-start space-x-3">
                    <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center mt-1">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Payment Received</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(invoice.dueDate)}
                      </p>
                    </div>
                  </div>
                )}
                {invoice.status === "overdue" && (
                  <div className="flex items-start space-x-3">
                    <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center mt-1">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Payment Overdue</p>
                      <p className="text-xs text-muted-foreground">
                        {Math.abs(getDaysUntilDue())} days past due
                      </p>
                    </div>
                  </div>
                )}
                {invoice.status === "pending" && (
                  <div className="flex items-start space-x-3">
                    <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center mt-1">
                      <Clock className="h-4 w-4 text-yellow-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Awaiting Payment</p>
                      <p className="text-xs text-muted-foreground">
                        Due {formatDate(invoice.dueDate)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Methods</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button className="w-full" variant="outline">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Credit Card
                </Button>
                <Button className="w-full" variant="outline">
                  <Building className="h-4 w-4 mr-2" />
                  Bank Transfer
                </Button>
                <Button className="w-full" variant="outline">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Digital Wallet
                </Button>
                <Button className="w-full" variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Check
                </Button>
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
                  If you have questions about this invoice, our billing team is
                  here to help.
                </p>
                <Button className="w-full" variant="outline">
                  <Mail className="h-4 w-4 mr-2" />
                  Contact Billing
                </Button>
                <Button className="w-full" variant="outline">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Report Issue
                </Button>
                <div className="text-xs text-muted-foreground">
                  <p>Billing Support:</p>
                  <p>+1 (555) 123-4567</p>
                  <p>billing@logistics.com</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const invoiceId = params.id as string;
    const foundInvoice = mockInvoices.find((i) => i.id === invoiceId);

    if (foundInvoice) {
      setInvoice(foundInvoice);
    } else {
      // Handle invoice not found
      router.push("/wallet");
    }
    setLoading(false);
  }, [params.id, router]);

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Wallet & Billing", href: "/wallet" },
    { title: "Invoice Details" },
  ];

  if (loading) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-muted-foreground">
              Loading invoice details...
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!invoice) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invoice Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The invoice you&apos;re looking for doesn&apos;t exist or has been
              removed.
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
        <InvoiceDetail invoice={invoice} />
      </div>
    </DashboardLayout>
  );
}
