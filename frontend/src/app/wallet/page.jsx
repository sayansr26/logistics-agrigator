"use client";

import { useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
  mockTransactions,
  mockInvoices,
  getInvoiceStatusColor,
  formatCurrency,
  formatDate,
} from "@/lib/mock-data.ts";
import {
  CreditCard,
  Wallet,
  TrendingDown,
  Clock,
  Download,
  RefreshCw,
  Plus,
  MoreHorizontal,
  Eye,
  Search,
  Filter,
  FileText,
  X,
  Calendar,
} from "lucide-react";

export default function WalletPage() {
  const [activeTab, setActiveTab] = useState("transactions");
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [accountFilter, setAccountFilter] = useState("all");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState("all");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Wallet & Billing" },
  ];

  // Get unique accounts, zones, and transaction types for filters
  const uniqueAccounts = Array.from(
    new Set(mockTransactions.map((t) => t.accountDetails.accountNumber)),
  );
  const uniqueZones = Array.from(
    new Set(
      mockTransactions.map((t) => t.weightZone.zone).filter((zone) => zone),
    ),
  );
  // const uniqueTransactionTypes = ["credit", "debit", "both"];

  // Filter transactions based on all filters
  const filteredTransactions = mockTransactions.filter((transaction) => {
    // Search term filter
    const matchesSearch =
      transaction.transactionDetails.reference
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      transaction.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.awbLrn.toLowerCase().includes(searchTerm.toLowerCase());

    // Account filter
    const matchesAccount =
      accountFilter === "all" ||
      transaction.accountDetails.accountNumber === accountFilter;

    // Transaction type filter
    const matchesTransactionType = (() => {
      if (transactionTypeFilter === "all") return true;
      if (transactionTypeFilter === "credit") return transaction.credit > 0;
      if (transactionTypeFilter === "debit") return transaction.debit > 0;
      if (transactionTypeFilter === "both")
        return transaction.credit > 0 && transaction.debit > 0;
      return true;
    })();

    // Zone filter
    const matchesZone =
      zoneFilter === "all" || transaction.weightZone.zone === zoneFilter;

    // Date range filter
    const transactionDate = new Date(transaction.transactionDetails.date);
    const matchesDateRange = (() => {
      if (!startDate && !endDate) return true;
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        return transactionDate >= start && transactionDate <= end;
      }
      if (startDate) {
        const start = new Date(startDate);
        return transactionDate >= start;
      }
      if (endDate) {
        const end = new Date(endDate);
        return transactionDate <= end;
      }
      return true;
    })();

    return (
      matchesSearch &&
      matchesAccount &&
      matchesTransactionType &&
      matchesZone &&
      matchesDateRange
    );
  });

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

  // Calculate closing account balance (current balance + pending transactions)
  const closingAccountBalance = walletBalance + pendingAmount;

  // Calculate running balance for each transaction
  const calculateRunningBalance = (transactions) => {
    let runningBalance = walletBalance;
    return transactions
      .map((transaction, _index) => {
        // For display purposes, we'll calculate backwards from current balance
        // This gives a more realistic view of the balance at each point in time
        const transactionImpact = transaction.credit - transaction.debit;
        runningBalance -= transactionImpact; // Subtract because we're going backwards
        return {
          ...transaction,
          runningBalance: runningBalance,
        };
      })
      .reverse(); // Reverse to show chronological order with correct balances
  };

  const transactionsWithBalance = calculateRunningBalance(filteredTransactions);

  // Clear all filters
  const clearFilters = () => {
    setAccountFilter("all");
    setTransactionTypeFilter("all");
    setZoneFilter("all");
    setStartDate("");
    setEndDate("");
  };

  // Check if any filters are active
  const hasActiveFilters =
    accountFilter !== "all" ||
    transactionTypeFilter !== "all" ||
    zoneFilter !== "all" ||
    startDate ||
    endDate;

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
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 text-xs">
                  {
                    [
                      accountFilter,
                      transactionTypeFilter,
                      zoneFilter,
                      startDate,
                      endDate,
                    ].filter((f) => f !== "all" && f).length
                  }
                </Badge>
              )}
            </Button>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filters Section */}
        {showFilters && activeTab === "transactions" && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Filters</CardTitle>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Account Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Account</label>
                  <Select
                    value={accountFilter}
                    onValueChange={setAccountFilter}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Accounts</SelectItem>
                      {uniqueAccounts.map((account) => (
                        <SelectItem key={account} value={account}>
                          {account}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Transaction Type Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Transaction Type
                  </label>
                  <Select
                    value={transactionTypeFilter}
                    onValueChange={setTransactionTypeFilter}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="credit">Credit Only</SelectItem>
                      <SelectItem value="debit">Debit Only</SelectItem>
                      <SelectItem value="both">Credit & Debit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Zone Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Zone</label>
                  <Select value={zoneFilter} onValueChange={setZoneFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select zone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Zones</SelectItem>
                      {uniqueZones.map((zone) => (
                        <SelectItem key={zone} value={zone}>
                          Zone {zone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Start Date */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* End Date */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Wallet Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Wallet Balance */}
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

          {/* Closing Account Balance */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Closing Account
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(closingAccountBalance)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Spent */}
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

          {/* Pending Amount */}
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

          {/* Pending Invoices */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <FileText className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Pending Invoices
                  </p>
                  <p className="text-2xl font-bold text-purple-600">
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
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="ml-2">
                        {filteredTransactions.length} results
                      </Badge>
                    )}
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
                  {searchTerm || hasActiveFilters
                    ? `Filtered transactions${searchTerm ? ` for "${searchTerm}"` : ""}`
                    : "Recent wallet transactions"}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transcation</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Order ID / Reference</TableHead>
                    <TableHead>AWB / LRN</TableHead>
                    <TableHead>Weight & Zone</TableHead>
                    <TableHead>Credit</TableHead>
                    <TableHead>Debit</TableHead>
                    <TableHead>Closing Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactionsWithBalance.map((transaction) => (
                    <TableRow
                      key={transaction.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        (window.location.href = `/wallet/transactions/${transaction.id}`)
                      }
                    >
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">
                            {transaction.transactionDetails.date}
                          </div>
                          <div className="text-muted-foreground">
                            {transaction.transactionDetails.time}
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
                        {transaction.orderId ||
                          transaction.transactionDetails.reference ||
                          "-"}
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
                      <TableCell>
                        <div className="font-medium text-gray-900">
                          {formatCurrency(transaction.runningBalance)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = `/wallet/transactions/${transaction.id}`;
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => e.stopPropagation()}
                            >
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
                    <TableRow
                      key={invoice.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        (window.location.href = `/wallet/invoices/${invoice.id}`)
                      }
                    >
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
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = `/wallet/invoices/${invoice.id}`;
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Invoice
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Download PDF
                            </DropdownMenuItem>
                            {invoice.status !== "paid" && (
                              <DropdownMenuItem
                                onClick={(e) => e.stopPropagation()}
                              >
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
