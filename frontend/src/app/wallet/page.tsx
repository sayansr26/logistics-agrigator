"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
  mockTransactions,
  mockInvoices,
  getTransactionStatusColor,
  getInvoiceStatusColor,
  formatCurrency,
  formatDate,
  type Transaction,
  type Invoice,
} from "@/lib/mock-data";
import {
  CreditCard,
  Wallet,
  Plus,
  Download,
  RefreshCw,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  TrendingDown,
  DollarSign,
  FileText,
  Clock,
} from "lucide-react";

export default function WalletPage() {
  const [activeTab, setActiveTab] = useState<"transactions" | "invoices">(
    "transactions",
  );
  const [searchTerm, setSearchTerm] = useState("");

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Wallet & Billing" },
  ];

  // Filter transactions based on search term
  const filteredTransactions = mockTransactions.filter(
    (transaction) =>
      // transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.transactionDetails.reference
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      transaction.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.awbLrn.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Filter invoices based on search term
  const filteredInvoices = mockInvoices.filter(
    (invoice) =>
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.description.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Calculate wallet statistics
  const walletBalance = 2450.75;
  const monthlySpent = mockTransactions
    .filter((t) => t.debit > 0 && t.transactionDetails.status === "completed")
    .reduce((sum, t) => sum + t.debit, 0);
  const pendingAmount = mockTransactions
    .filter((t) => t.transactionDetails.status === "pending")
    .reduce((sum, t) => sum + (t.credit > 0 ? t.credit : -t.debit), 0);

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
              <Wallet className="h-8 w-8 text-logistics-600" />
              <span>Wallet & Billing</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage your wallet balance, transactions, and billing information
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Money
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex space-x-4">
            <Button
              variant={activeTab === "transactions" ? "default" : "outline"}
              onClick={() => setActiveTab("transactions")}
              className="flex items-center space-x-2"
            >
              <CreditCard className="h-4 w-4" />
              <span>Transactions</span>
            </Button>
            <Button
              variant={activeTab === "invoices" ? "default" : "outline"}
              onClick={() => setActiveTab("invoices")}
              className="flex items-center space-x-2"
            >
              <FileText className="h-4 w-4" />
              <span>Invoices</span>
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${activeTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Wallet Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Wallet Balance
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(walletBalance)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Monthly Spent
                  </p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(monthlySpent)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-12 w-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Pending Amount
                  </p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {formatCurrency(Math.abs(pendingAmount))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Pending Invoices
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {mockInvoices.filter((i) => i.status !== "paid").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Content Card */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center space-x-2">
                {activeTab === "transactions" ? (
                  <>
                    <CreditCard className="h-5 w-5" />
                    <span>Transaction History</span>
                  </>
                ) : (
                  <>
                    <FileText className="h-5 w-5" />
                    <span>Invoices & Billing</span>
                  </>
                )}
              </CardTitle>
              <CardDescription>
                {activeTab === "transactions"
                  ? "View all your wallet transactions and payments"
                  : "Manage your invoices and billing information"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {activeTab === "transactions" ? (
              <Table>
                <TableCaption>
                  {searchTerm
                    ? `Filtered transactions for "${searchTerm}"`
                    : "Recent wallet transactions"}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transcation ID</TableHead>
                    <TableHead>ACCOUNT DETAILS</TableHead>
                    <TableHead>ORDER ID</TableHead>
                    <TableHead>AWB / LRN</TableHead>
                    <TableHead>WEIGHT & ZONE</TableHead>
                    {/* <TableHead>Description</TableHead> */}
                    <TableHead>CREDIT</TableHead>
                    <TableHead>DEBIT</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">
                            {transaction.transactionDetails.date}
                          </div>
                          <div className="text-muted-foreground">
                            {transaction.transactionDetails.time}
                          </div>
                          <div className="mt-1">
                            <Badge
                              className={getTransactionStatusColor(
                                transaction.transactionDetails.status,
                              )}
                            >
                              {transaction.transactionDetails.status}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Ref: {transaction.transactionDetails.reference}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">
                            {transaction.accountDetails.accountNumber}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {transaction.orderId || "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {transaction.awbLrn || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {transaction.weightZone.weight > 0 ? (
                            <>
                              <div className="font-medium">
                                {transaction.weightZone.weight} kg
                              </div>
                              <div className="text-muted-foreground">
                                Zone {transaction.weightZone.zone}
                              </div>
                            </>
                          ) : (
                            "-"
                          )}
                        </div>
                      </TableCell>
                      {/* <TableCell>
                        <div className="text-sm max-w-xs">
                          {transaction.description}
                        </div>
                      </TableCell> */}
                      <TableCell>
                        {transaction.credit > 0 ? (
                          <div className="font-medium text-green-600">
                            {formatCurrency(transaction.credit)}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {transaction.debit > 0 ? (
                          <div className="font-medium text-red-600">
                            {formatCurrency(transaction.debit)}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="mr-2 h-4 w-4" />
                              Download Receipt
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableCaption>
                  {searchTerm
                    ? `Filtered invoices for "${searchTerm}"`
                    : "Your billing invoices"}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.invoiceNumber}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {invoice.description}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Issued: {formatDate(invoice.issuedDate)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(invoice.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={getInvoiceStatusColor(invoice.status)}
                        >
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(invoice.dueDate)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              View Invoice
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="mr-2 h-4 w-4" />
                              Download PDF
                            </DropdownMenuItem>
                            {invoice.status !== "paid" && (
                              <DropdownMenuItem>
                                <CreditCard className="mr-2 h-4 w-4" />
                                Pay Now
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
