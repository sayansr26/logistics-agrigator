"use client";

import React, { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Wallet,
  CreditCard,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Plus,
  Minus,
  RotateCcw,
  Settings,
  Loader2,
  AlertCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X,
  Shuffle,
  IndianRupee,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
  Link2,
  ShieldCheck,
  Banknote,
} from "lucide-react";
import {
  useGetClientWalletsQuery,
  useGetClientTransactionsQuery,
  useDebitWalletMutation,
  useRefundWalletMutation,
  useUpdateWalletUserStatusMutation,
  useLazyGetOrCreateWalletQuery,
  useSyncWalletsMutation,
  useGetMyWalletInfoQuery,
  useGetMyTransactionsQuery,
  useGetMyStatisticsQuery,
} from "@/store/api/endpoints/walletApi";
import { useListOutletsQuery } from "@/store/api/endpoints/outletApi";
import {
  useGetTopupPolicyQuery,
  useCreateManualTopupMutation,
  useCreatePaymentLinkMutation,
  useGetPendingApprovalsQuery,
} from "@/store/api/endpoints/paymentApi";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { usePaymentProvider } from "@/hooks/usePaymentProvider";
import { AddMoneyButton } from "@/components/wallet/add-money-button";
import { PaymentLinksTab } from "@/components/wallet/payment-links-tab";
import { TopupApprovalsTab } from "@/components/wallet/topup-approvals-tab";
import { QrCollectionsTab } from "@/components/wallet/qr-collections-tab";
import { QrUnattributedTab } from "@/components/wallet/qr-unattributed-tab";
import { PaymentStatusChip } from "@/components/wallet/payment-status-chip";
import { CopyButton } from "@/components/wallet/copy-button";
import { useGetUnattributedQrCollectionsQuery } from "@/store/api/endpoints/qrCollectionApi";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { formatINR, extractApiError } from "@/lib/utils";

const formatCurrency = (amount) => {
  if (amount == null) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStatusColor = (status) => {
  switch (status?.toUpperCase()) {
    case "ACTIVE":
      return "bg-green-100 text-green-800 border-green-200";
    case "SUSPENDED":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "BLOCKED":
      return "bg-red-100 text-red-800 border-red-200";
    case "CLOSED":
      return "bg-gray-100 text-gray-800 border-gray-200";
    case "COMPLETED":
      return "bg-green-100 text-green-800 border-green-200";
    case "PENDING":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "FAILED":
      return "bg-red-100 text-red-800 border-red-200";
    case "CANCELLED":
      return "bg-gray-100 text-gray-800 border-gray-200";
    default:
      return "bg-blue-100 text-blue-800 border-blue-200";
  }
};

const getTransactionTypeBadge = (type) => {
  switch (type?.toUpperCase()) {
    case "TOP_UP":
    case "TOPUP":
      return {
        label: "Topup",
        icon: "up",
        className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      };
    case "DEBIT":
      return {
        label: "Debit",
        icon: "down",
        className: "bg-red-500/10 text-red-500 border-red-500/20",
      };
    case "REFUND":
      return {
        label: "Refund",
        icon: "return",
        className: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      };
    default:
      return {
        label: type || "Unknown",
        icon: null,
        className: "bg-muted text-muted-foreground border-border",
      };
  }
};

// Dynamic key-value remarks builder
function RemarksBuilder({ remarks, onChange }) {
  const entries = Object.entries(remarks || {});

  const addRow = () => {
    const newKey = `key${entries.length + 1}`;
    onChange({ ...remarks, [newKey]: "" });
  };

  const removeRow = (key) => {
    const updated = { ...remarks };
    delete updated[key];
    onChange(updated);
  };

  const updateKey = (oldKey, newKey) => {
    if (oldKey === newKey) return;
    const updated = {};
    for (const [k, v] of Object.entries(remarks)) {
      if (k === oldKey) {
        updated[newKey] = v;
      } else {
        updated[k] = v;
      }
    }
    onChange(updated);
  };

  const updateValue = (key, value) => {
    onChange({ ...remarks, [key]: value });
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Remarks (Key-Value)</Label>
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-2 items-center">
          <Input
            placeholder="Key"
            defaultValue={key}
            onBlur={(e) => updateKey(key, e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Value"
            value={value}
            onChange={(e) => updateValue(key, e.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeRow(key)}
            className="shrink-0 text-red-500 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addRow}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Remark
      </Button>
    </div>
  );
}

// Generate a unique reference ID
function generateReferenceId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 9);
  return `ref_${ts}_${rand}`;
}

// Canned reasons for a manual (offline) top-up. These get audited, so a
// Select beats free text; "Other" reveals a free-text input instead. The
// submitted reason must be >= 10 chars (backend Joi minimum) — the `full`
// sentence is what actually gets submitted for each canned option.
const TOPUP_REASONS = [
  {
    value: "bank_transfer",
    label: "Bank transfer received",
    full: "Bank transfer received — UTR on record",
  },
  {
    value: "cheque",
    label: "Cheque deposit",
    full: "Cheque deposit — cheque number on record",
  },
  {
    value: "cash",
    label: "Cash collection",
    full: "Cash collection — physical receipt issued",
  },
  {
    value: "correction",
    label: "Correction or adjustment",
    full: "Correction or adjustment to wallet balance",
  },
  {
    value: "promotional",
    label: "Promotional credit",
    full: "Promotional credit issued to customer",
  },
  { value: "other", label: "Other", full: null },
];

const LINK_EXPIRY_OPTIONS = [
  { value: "24", label: "24 hours" },
  { value: "48", label: "48 hours" },
  { value: "168", label: "7 days" },
];

// Transaction Modal (Topup / Debit / Refund)
function TransactionModal({
  open,
  onClose,
  type,
  prefilledUserId,
  onSubmit,
  isLoading,
  error,
}) {
  const { data: outletsData } = useListOutletsQuery({ limit: 100 });
  const outlets = outletsData?.data?.outlets || outletsData?.outlets || [];

  // Fetch transactions for refund dropdown (only when type is refund and user is selected)
  const [selectedUserId, setSelectedUserId] = useState(prefilledUserId || "");
  const { data: txData } = useGetClientTransactionsQuery(
    { userId: selectedUserId, size: 100 },
    { skip: type !== "refund" || !selectedUserId },
  );
  const transactions = txData?.data || [];

  const [form, setForm] = useState({
    userId: prefilledUserId || "",
    amount: "",
    reference_id: "",
    description: "",
    metadata: "",
    transaction_id: "",
    remarks: {},
  });

  // --- Payment-gateway additions (topup only) ---
  const isTopup = type === "topup";
  const toast = useToast();
  const { isAvailable: providerAvailable } = usePaymentProvider();
  const showLinkOption = isTopup && providerAvailable;
  const [topupMode, setTopupMode] = useState("manual"); // "manual" | "link"
  const { data: policy } = useGetTopupPolicyQuery(undefined, {
    skip: !isTopup,
  });

  const [reasonPreset, setReasonPreset] = useState("");
  const [reasonOther, setReasonOther] = useState("");
  const [externalReference, setExternalReference] = useState("");

  const [linkReason, setLinkReason] = useState("");
  const [linkExpiryHours, setLinkExpiryHours] = useState("");
  const [linkResult, setLinkResult] = useState(null);

  const [createManualTopup, { isLoading: submittingManual }] =
    useCreateManualTopupMutation();
  const [createPaymentLink, { isLoading: submittingLink }] =
    useCreatePaymentLinkMutation();
  const [manualError, setManualError] = useState(null);
  const [linkError, setLinkError] = useState(null);

  const resolvedReason =
    reasonPreset === "other"
      ? reasonOther.trim()
      : TOPUP_REASONS.find((r) => r.value === reasonPreset)?.full || "";

  const manualCap = policy?.manualMaxPerTransaction;
  const manualAmountNum = parseFloat(form.amount);
  const exceedsManualCap =
    isTopup &&
    topupMode === "manual" &&
    manualCap != null &&
    !Number.isNaN(manualAmountNum) &&
    manualAmountNum > manualCap;

  const needsApproval =
    isTopup &&
    topupMode === "manual" &&
    policy?.manualApprovalThreshold != null &&
    !Number.isNaN(manualAmountNum) &&
    manualAmountNum >= policy.manualApprovalThreshold;

  const handleOutletChange = (v) => {
    setSelectedUserId(v);
    setForm({ ...form, userId: v, transaction_id: "", amount: "" });
  };

  const handleTransactionSelect = (txId) => {
    const tx = transactions.find((t) => String(t.id) === txId);
    if (tx) {
      setForm({
        ...form,
        transaction_id: txId,
        amount: String(tx.amount),
      });
    }
  };

  // Debit / Refund submission — unchanged from before the payments work.
  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      userId: form.userId,
      amount: parseFloat(form.amount),
      currency: "INR",
      reference_id: form.reference_id,
    };
    if (form.description) payload.description = form.description;
    if (form.metadata) {
      payload.metadata = form.metadata;
    }
    if (Object.keys(form.remarks).length > 0) payload.remarks = form.remarks;
    if (type === "refund" && form.transaction_id) {
      payload.transaction_id = parseInt(form.transaction_id);
    }
    onSubmit(payload);
  };

  // Manual credit submission — bypasses onSubmit/handleTransaction entirely,
  // since it needs its own response handling (PENDING_APPROVAL messaging).
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setManualError(null);
    const amount = parseFloat(form.amount);
    const payload = {
      walletUserId: form.userId,
      amount,
      currency: "INR",
      reason: resolvedReason,
      externalReference: externalReference.trim(),
    };
    try {
      const res = await createManualTopup(payload).unwrap();
      if (res?.status === "PENDING_APPROVAL") {
        toast.success("Top-up submitted for superadmin approval.");
      } else {
        toast.success(`${formatINR(amount)} credited.`);
      }
      onClose();
    } catch (err) {
      setManualError(extractApiError(err, "Failed to submit top-up"));
    }
  };

  // Payment-link submission — modal stays open on success to show the link.
  const handleLinkSubmit = async (e) => {
    e.preventDefault();
    setLinkError(null);
    const payload = {
      walletUserId: form.userId,
      amount: parseFloat(form.amount),
      currency: "INR",
      description: linkReason.trim(),
      ...(linkExpiryHours && { expiryHours: Number(linkExpiryHours) }),
    };
    try {
      const res = await createPaymentLink(payload).unwrap();
      setLinkResult(res);
    } catch (err) {
      setLinkError(extractApiError(err, "Failed to create payment link"));
    }
  };

  const title = isTopup
    ? "Topup Wallet"
    : type === "debit"
      ? "Debit Wallet"
      : "Refund Wallet";

  const description = isTopup
    ? topupMode === "link"
      ? "Generate a payment link to share with the outlet"
      : "Manually credit funds to the outlet's wallet"
    : type === "debit"
      ? "Deduct funds from the user's wallet"
      : "Refund a transaction to the user's wallet";

  const outletField = (
    <div className="space-y-2">
      <Label>Outlet *</Label>
      <Select value={form.userId} onValueChange={handleOutletChange} required>
        <SelectTrigger>
          <SelectValue placeholder="Select outlet" />
        </SelectTrigger>
        <SelectContent>
          {outlets.map((outlet) => (
            <SelectItem key={outlet.id} value={outlet.phone}>
              {outlet.name} ({outlet.phone})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const modeToggle = isTopup && showLinkOption && (
    <div className="flex gap-1 rounded-md border bg-muted/40 p-1">
      <button
        type="button"
        onClick={() => setTopupMode("manual")}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
          topupMode === "manual"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Banknote className="h-3.5 w-3.5" />
        Manual credit
      </button>
      <button
        type="button"
        onClick={() => setTopupMode("link")}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
          topupMode === "link"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Link2 className="h-3.5 w-3.5" />
        Send payment link
      </button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {modeToggle}

        {isTopup ? (
          topupMode === "link" ? (
            linkResult ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Payment Link</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={linkResult.shortUrl}
                      className="flex-1 font-mono text-xs"
                    />
                    <CopyButton value={linkResult.shortUrl} label="Copy link" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <PaymentStatusChip status="PENDING" />
                  {linkResult.expiresAt && (
                    <span className="text-xs text-muted-foreground">
                      Expires {formatDate(linkResult.expiresAt)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Nothing has been sent to the customer — share this link
                  yourself.
                </p>
                <DialogFooter>
                  <CopyButton
                    value={linkResult.shortUrl}
                    label="Copy link"
                    size="sm"
                  />
                  <Button type="button" onClick={onClose}>
                    Done
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <form onSubmit={handleLinkSubmit} className="space-y-4">
                {outletField}
                <div className="space-y-2">
                  <Label>Amount *</Label>
                  <Input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) =>
                      setForm({ ...form, amount: e.target.value })
                    }
                    placeholder="Enter amount"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reason *</Label>
                  <Input
                    required
                    value={linkReason}
                    onChange={(e) => setLinkReason(e.target.value)}
                    placeholder="What is this payment for?"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Link expires in</Label>
                  <Select
                    value={linkExpiryHours || "default"}
                    onValueChange={(v) =>
                      setLinkExpiryHours(v === "default" ? "" : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Provider default" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Provider default</SelectItem>
                      {LINK_EXPIRY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {linkError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{linkError}</AlertDescription>
                  </Alert>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submittingLink}>
                    {submittingLink && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Generate Payment Link
                  </Button>
                </DialogFooter>
              </form>
            )
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              {outletField}
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input
                  required
                  type="number"
                  min="0.01"
                  max={manualCap || undefined}
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder={
                    manualCap
                      ? `Enter amount (max ${formatINR(manualCap)})`
                      : "Enter amount"
                  }
                />
                {exceedsManualCap && (
                  <p className="text-xs font-medium text-destructive">
                    Exceeds the manual top-up cap of {formatINR(manualCap)}.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Reason *</Label>
                <Select
                  value={reasonPreset}
                  onValueChange={setReasonPreset}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {TOPUP_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {reasonPreset === "other" && (
                  <Input
                    required
                    minLength={10}
                    value={reasonOther}
                    onChange={(e) => setReasonOther(e.target.value)}
                    placeholder="Describe the reason (min 10 characters)"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>External Reference *</Label>
                <Input
                  required
                  minLength={3}
                  value={externalReference}
                  onChange={(e) => setExternalReference(e.target.value)}
                  placeholder="UTR / cheque no. / receipt no."
                />
                <p className="text-xs text-muted-foreground">
                  The bank or receipt reference that proves this money was
                  received.
                </p>
              </div>
              {needsApproval && !exceedsManualCap && (
                <Alert variant="warning">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This credit needs superadmin approval. The wallet will not
                    be credited until it is approved.
                  </AlertDescription>
                </Alert>
              )}
              {manualError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{manualError}</AlertDescription>
                </Alert>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingManual || exceedsManualCap}
                >
                  {submittingManual && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {needsApproval ? "Submit for approval" : "Credit Wallet"}
                </Button>
              </DialogFooter>
            </form>
          )
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {outletField}
            {type === "refund" && (
              <div className="space-y-2">
                <Label>Transaction to Refund *</Label>
                <Select
                  value={form.transaction_id}
                  onValueChange={handleTransactionSelect}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        selectedUserId
                          ? "Select transaction"
                          : "Select outlet first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {transactions
                      .filter((tx) => tx.type === "DEBIT")
                      .map((tx) => (
                        <SelectItem key={tx.id} value={String(tx.id)}>
                          #{tx.id} - {tx.type} - {formatCurrency(tx.amount)} (
                          {new Date(tx.createdAt).toLocaleDateString()})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                required
                type="number"
                min="0.01"
                max="10000"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="Enter amount (max 10,000)"
                readOnly={type === "refund" && !!form.transaction_id}
              />
            </div>
            <div className="space-y-2">
              <Label>Reference ID *</Label>
              <div className="flex gap-2">
                <Input
                  required
                  value={form.reference_id}
                  onChange={(e) =>
                    setForm({ ...form, reference_id: e.target.value })
                  }
                  placeholder="Unique reference ID"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setForm({ ...form, reference_id: generateReferenceId() })
                  }
                  title="Generate Reference ID"
                >
                  <Shuffle className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Optional description"
              />
            </div>
            <div className="space-y-2">
              <Label>Metadata</Label>
              <Input
                value={form.metadata}
                onChange={(e) => setForm({ ...form, metadata: e.target.value })}
                placeholder='e.g. {"orderId":"123"} or plain text'
              />
            </div>
            <RemarksBuilder
              remarks={form.remarks}
              onChange={(remarks) => setForm({ ...form, remarks })}
            />
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {title}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Update Status Modal
function UpdateStatusModal({
  open,
  onClose,
  prefilledUserId,
  onSubmit,
  isLoading,
}) {
  const { data: outletsData } = useListOutletsQuery({ limit: 100 });
  const outlets = outletsData?.data?.outlets || outletsData?.outlets || [];

  const [form, setForm] = useState({
    userId: prefilledUserId || "",
    status: "ACTIVE",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { userId: form.userId, status: form.status };
    onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Update Wallet Status</DialogTitle>
          <DialogDescription>
            Change the wallet status for a user
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Outlet *</Label>
            <Select
              value={form.userId}
              onValueChange={(v) => setForm({ ...form, userId: v })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select outlet" />
              </SelectTrigger>
              <SelectContent>
                {outlets.map((outlet) => (
                  <SelectItem key={outlet.id} value={outlet.phone}>
                    {outlet.name} ({outlet.phone})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status *</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="BLOCKED">Blocked</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Status
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Create Wallet Modal
function CreateWalletModal({ open, onClose, onSuccess }) {
  const { data: outletsData } = useListOutletsQuery(
    { limit: 100 },
    { skip: !open },
  );
  const allOutlets = outletsData?.data?.outlets || outletsData?.outlets || [];

  // Fetch existing wallets to filter out outlets that already have wallets
  const { data: walletsData } = useGetClientWalletsQuery(
    { page: 0, size: 100 },
    { skip: !open },
  );
  const existingUserIds = new Set(
    (walletsData?.data || []).map((w) => w.user_id),
  );
  const outlets = allOutlets.filter((o) => !existingUserIds.has(o.phone));

  const [selectedUserId, setSelectedUserId] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [triggerGetOrCreate, { isLoading }] = useLazyGetOrCreateWalletQuery();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    try {
      const data = await triggerGetOrCreate({
        userId: selectedUserId,
      }).unwrap();
      setResult(data);
    } catch (err) {
      setError(err?.data?.message || err?.message || "Failed to create wallet");
    }
  };

  const handleClose = () => {
    if (result) onSuccess?.();
    setSelectedUserId("");
    setResult(null);
    setError("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Wallet</DialogTitle>
          <DialogDescription>
            Create a new wallet for an outlet. If a wallet already exists, it
            will be returned.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
              Wallet ready for{" "}
              <span className="font-mono font-semibold">{selectedUserId}</span>
              {result?.balance != null && (
                <span> — Balance: {formatCurrency(result.balance)}</span>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Outlet *</Label>
              <Select
                value={selectedUserId}
                onValueChange={(v) => setSelectedUserId(v)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select outlet" />
                </SelectTrigger>
                <SelectContent>
                  {outlets.map((outlet) => (
                    <SelectItem key={outlet.id} value={outlet.phone}>
                      {outlet.name} ({outlet.phone})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !selectedUserId}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Wallet
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Sync Wallets Modal
function SyncWalletsModal({ open, onClose, onSuccess }) {
  const { data: outletsData, isLoading: outletsLoading } = useListOutletsQuery(
    { limit: 100 },
    { skip: !open },
  );
  const outlets = outletsData?.data?.outlets || outletsData?.outlets || [];

  const { data: walletsData, isLoading: walletsLoading } =
    useGetClientWalletsQuery({ page: 0, size: 100 }, { skip: !open });
  const wallets = walletsData?.data || [];

  const [syncWallets, { isLoading: syncing }] = useSyncWalletsMutation();
  const [result, setResult] = useState(null);

  const existingUserIds = new Set(wallets.map((w) => w.user_id));
  const missingOutlets = outlets.filter((o) => !existingUserIds.has(o.phone));

  const loading = outletsLoading || walletsLoading;

  const handleSync = async () => {
    if (missingOutlets.length === 0) return;
    setResult(null);
    try {
      const res = await syncWallets({
        userIds: missingOutlets.map((o) => o.phone),
      }).unwrap();
      setResult(res);
    } catch (err) {
      setResult({ error: err?.data?.message || "Sync failed" });
    }
  };

  const handleClose = () => {
    if (result && !result.error) onSuccess?.();
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sync Wallets</DialogTitle>
          <DialogDescription>
            Create wallets for all outlets that don't have one yet. Processed in
            batches to avoid overloading the system.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
            <span className="text-sm text-muted-foreground">
              Loading outlets & wallets...
            </span>
          </div>
        ) : result ? (
          <div className="space-y-3">
            {result.error ? (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
                {result.error}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-sm space-y-1">
                  <p className="font-medium text-green-800">Sync Complete</p>
                  <p>
                    Total processed: <strong>{result.total}</strong>
                  </p>
                  <p className="text-green-700">
                    Created: <strong>{result.created}</strong>
                  </p>
                  <p className="text-blue-700">
                    Already existed: <strong>{result.existing}</strong>
                  </p>
                  {result.failed > 0 && (
                    <p className="text-red-700">
                      Failed: <strong>{result.failed}</strong>
                    </p>
                  )}
                </div>
                {result.details?.failed?.length > 0 && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs">
                    <p className="font-medium text-red-800 mb-1">
                      Failed items:
                    </p>
                    {result.details.failed.map((f, i) => (
                      <p key={i} className="text-red-700">
                        {f.userId}: {f.error}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted text-center">
                <p className="text-xs text-muted-foreground">Total Outlets</p>
                <p className="text-xl font-bold">{outlets.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted text-center">
                <p className="text-xs text-muted-foreground">Have Wallet</p>
                <p className="text-xl font-bold text-green-600">
                  {outlets.length - missingOutlets.length}
                </p>
              </div>
            </div>

            {missingOutlets.length === 0 ? (
              <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm text-center">
                All outlets already have wallets!
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  <strong>{missingOutlets.length}</strong> outlet(s) without a
                  wallet:
                </p>
                <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1">
                  {missingOutlets.map((o) => (
                    <div key={o.id} className="text-xs flex justify-between">
                      <span>{o.name}</span>
                      <span className="font-mono text-muted-foreground">
                        {o.phone}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSync}
                disabled={syncing || missingOutlets.length === 0}
              >
                {syncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {syncing
                  ? "Syncing..."
                  : `Sync ${missingOutlets.length} Wallet(s)`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ===========================
// Outlet Wallet View (Read-only: stats + transactions)
// ===========================

function OutletWalletView() {
  const [page, setPage] = useState(0);
  const pageSize = 10;

  // Fetch outlet's own wallet data
  const {
    data: walletInfo,
    isLoading: walletLoading,
    error: walletError,
  } = useGetMyWalletInfoQuery();

  const { data: statsData, isLoading: statsLoading } =
    useGetMyStatisticsQuery();

  const { data: txData, isLoading: txLoading } = useGetMyTransactionsQuery({
    page,
    size: pageSize,
  });

  const wallet = walletInfo?.data?.wallet || walletInfo?.wallet;
  const stats = statsData?.statistics || statsData;
  const transactions = txData?.data || [];
  const pagination = txData?.pagination;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Wallet</h1>
            <p className="text-sm text-muted-foreground">
              Balance, transactions & activity overview
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AddMoneyButton size="sm" />
            {wallet && (
              <Badge
                className={`${getStatusColor(wallet.status)} border px-3 py-1 text-xs font-semibold`}
                variant="outline"
              >
                {wallet.status}
              </Badge>
            )}
          </div>
        </div>

        {/* Error State */}
        {walletError && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-sm text-destructive">
                Failed to load wallet information. Please try again later.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Balance + Quick Stats Row */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Balance — spans 2 cols */}
          <Card className="lg:col-span-2 bg-gradient-to-br from-primary/5 via-transparent to-transparent border-primary/20">
            <CardContent className="pt-6 pb-5">
              {walletLoading ? (
                <div className="flex items-center gap-2 h-[72px]">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground text-sm">
                    Loading balance...
                  </span>
                </div>
              ) : wallet ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-md bg-primary/10">
                      <Wallet className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Available Balance
                    </p>
                  </div>
                  <p className="text-4xl font-bold tracking-tight">
                    {formatCurrency(wallet.balance)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {wallet.currency || "INR"} &middot; Updated{" "}
                    {formatDate(wallet.updatedAt)}
                  </p>
                  {wallet?.status === "ACTIVE" && (
                    <AddMoneyButton className="mt-4 w-full" size="lg" />
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-4">
                  No wallet found. Contact your administrator.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Top-ups */}
          <Card>
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-md bg-emerald-500/10">
                  <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">
                  Top-ups
                </p>
              </div>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(stats?.top_up_stats?.total_amount || 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.top_up_stats?.count || 0} transactions
              </p>
            </CardContent>
          </Card>

          {/* Debits */}
          <Card>
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-md bg-red-500/10">
                  <ArrowDownRight className="h-4 w-4 text-red-600" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">
                  Debits
                </p>
              </div>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(stats?.debit_stats?.total_amount || 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.debit_stats?.count || 0} transactions
              </p>
            </CardContent>
          </Card>

          {/* Refunds */}
          <Card>
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-md bg-purple-500/10">
                  <RotateCcw className="h-4 w-4 text-purple-600" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">
                  Refunds
                </p>
              </div>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(stats?.refund_stats?.total_amount || 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.refund_stats?.count || 0} transactions
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Last 30 Days Summary — compact inline bar */}
        {stats?.last_30_days && (
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Last 30 Days</span>
                  <span className="text-xs text-muted-foreground">
                    ({formatDate(stats.last_30_days.period_start)} –{" "}
                    {formatDate(stats.last_30_days.period_end)})
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-lg font-bold">
                      {stats.last_30_days.total_transactions}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Txns
                    </p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div className="text-center">
                    <p className="text-lg font-bold">
                      {formatCurrency(stats.last_30_days.total_amount)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Volume
                    </p>
                  </div>
                  {stats.last_30_days.breakdown_by_type &&
                    Object.entries(stats.last_30_days.breakdown_by_type).map(
                      ([type, info]) => {
                        const isCredit = type === "TOP_UP" || type === "REFUND";
                        return (
                          <React.Fragment key={type}>
                            <div className="h-8 w-px bg-border" />
                            <div className="text-center">
                              <p
                                className={`text-lg font-bold ${isCredit ? "text-emerald-600" : "text-red-600"}`}
                              >
                                {formatCurrency(info.total_amount)}
                              </p>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                {type.replace("_", " ")} ({info.count})
                              </p>
                            </div>
                          </React.Fragment>
                        );
                      },
                    )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Transaction History */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Transaction History</CardTitle>
              {pagination && (
                <span className="text-xs text-muted-foreground">
                  {pagination.total_elements} total transactions
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {txLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin mr-2 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Loading transactions...
                </span>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No transactions yet
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-6">Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Before</TableHead>
                        <TableHead className="text-right">After</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="pr-6">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => {
                        const isCredit =
                          tx.type === "TOP_UP" || tx.type === "REFUND";
                        const badge = getTransactionTypeBadge(tx.type);
                        return (
                          <TableRow key={tx.id}>
                            <TableCell className="pl-6 whitespace-nowrap text-sm text-muted-foreground">
                              {formatDate(tx.createdAt)}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${badge.className}`}
                              >
                                {badge.icon === "up" && (
                                  <ArrowUpRight className="h-3 w-3" />
                                )}
                                {badge.icon === "down" && (
                                  <ArrowDownRight className="h-3 w-3" />
                                )}
                                {badge.icon === "return" && (
                                  <RotateCcw className="h-3 w-3" />
                                )}
                                {badge.label}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              <span
                                className={
                                  isCredit ? "text-emerald-600" : "text-red-600"
                                }
                              >
                                {isCredit ? "+" : "-"}
                                {formatCurrency(tx.amount)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                              {formatCurrency(tx.balanceBefore)}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums font-medium">
                              {formatCurrency(tx.balanceAfter)}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground max-w-[140px] truncate">
                              {tx.referenceId || "—"}
                            </TableCell>
                            <TableCell className="pr-6">
                              <Badge
                                className={`${getStatusColor(tx.status)} border text-[10px] font-medium`}
                                variant="outline"
                              >
                                {tx.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
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

// ===========================
// Admin Wallet Page (existing)
// ===========================

function AdminWalletPage() {
  // Deep link from a shipment's wallet-transaction list: /wallet?userId=<phone>
  // lands directly on that holder's filtered transactions.
  const searchParams = useSearchParams();
  const linkedUserId = searchParams.get("userId") || "";
  // ?referenceId=<shipment id> narrows to one shipment's wallet history — the
  // wallet matches it as a substring of reference_id.
  const linkedReferenceId = searchParams.get("referenceId") || "";

  // ?tab= makes the tabs (including the new Payment Links / Approvals ones)
  // deep-linkable, e.g. /wallet?tab=approvals.
  const tabParam = searchParams.get("tab") || "";
  const [activeTab, setActiveTab] = useState(
    tabParam ||
      (linkedUserId || linkedReferenceId ? "transactions" : "wallets"),
  );

  // Wallet tab state
  const [walletPage, setWalletPage] = useState(0);
  const [walletFilters, setWalletFilters] = useState({
    userId: "",
    status: "",
    minBalance: "",
    maxBalance: "",
  });

  // Transaction tab state
  const [txPage, setTxPage] = useState(0);
  const [txFilters, setTxFilters] = useState({
    type: "",
    status: "",
    userId: linkedUserId,
    referenceId: linkedReferenceId,
  });

  // Modal state
  const [modal, setModal] = useState({ open: false, type: null, userId: "" });
  const [modalError, setModalError] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const toast = useToast();
  const { isRole } = useRole();
  const { isAvailable: paymentAvailable } = usePaymentProvider();
  const { data: pendingApprovalsData } = useGetPendingApprovalsQuery(
    { page: 0, size: 1 },
    { skip: !isRole("superadmin") },
  );
  const pendingApprovalsCount =
    pendingApprovalsData?.pagination?.total_elements ?? 0;

  // QR tabs are shown to admins only; the unattributed count is fetched
  // regardless of which tab is active so the badge is visible without
  // opening the tab (that's the whole point of the queue).
  const isAdminRole = isRole("superadmin") || isRole("admin");
  const { data: unattributedQrData } = useGetUnattributedQrCollectionsQuery(
    { page: 0, size: 1 },
    { skip: !isAdminRole },
  );
  const unattributedQrCount =
    unattributedQrData?.pagination?.total_elements ?? 0;

  // RTK Query
  const {
    data: walletsData,
    isLoading: walletsLoading,
    error: walletsError,
    refetch: refetchWallets,
  } = useGetClientWalletsQuery({
    page: walletPage,
    size: 10,
    ...(walletFilters.userId && { userId: walletFilters.userId }),
    ...(walletFilters.status && { status: walletFilters.status }),
    ...(walletFilters.minBalance && {
      minBalance: parseFloat(walletFilters.minBalance),
    }),
    ...(walletFilters.maxBalance && {
      maxBalance: parseFloat(walletFilters.maxBalance),
    }),
  });

  const {
    data: txData,
    isLoading: txLoading,
    error: txError,
    refetch: refetchTx,
  } = useGetClientTransactionsQuery({
    page: txPage,
    size: 10,
    ...(txFilters.type && { type: txFilters.type }),
    ...(txFilters.status && { status: txFilters.status }),
    ...(txFilters.userId && { userId: txFilters.userId }),
    ...(txFilters.referenceId && { referenceId: txFilters.referenceId }),
  });

  const [debitWallet, { isLoading: debiting }] = useDebitWalletMutation();
  const [refundWallet, { isLoading: refunding }] = useRefundWalletMutation();
  const [updateStatus, { isLoading: updatingStatus }] =
    useUpdateWalletUserStatusMutation();

  const wallets = walletsData?.data || [];
  const walletStats = walletsData?.stats || {};
  const walletPagination = walletsData?.pagination || {};

  const transactions = txData?.data || [];
  const txStats = txData?.stats || {};
  const txPagination = txData?.pagination || {};

  // Outlet phone → name lookup
  const { data: outletsData } = useListOutletsQuery({ limit: 100 });
  const outletMap = useMemo(() => {
    const outlets = outletsData?.data?.outlets || outletsData?.outlets || [];
    const map = {};
    outlets.forEach((o) => {
      map[o.phone] = o.name;
    });
    return map;
  }, [outletsData]);

  const openModal = (type, userId = "") => {
    setModalError(null);
    setModal({ open: true, type, userId });
  };

  const closeModal = () => {
    setModal({ open: false, type: null, userId: "" });
    setModalError(null);
  };

  // Debit/refund only. Top-ups deliberately do NOT route through here: the
  // TransactionModal submits them via useCreateManualTopupMutation /
  // useCreatePaymentLinkMutation so it can render its own PENDING_APPROVAL and
  // payment-link result states. The legacy /wallet/admin/topup mutation is not
  // wired up on this page any more — it bypasses the manual-credit safeguards
  // (mandatory reason + external reference, per-transaction cap, superadmin
  // maker-checker above the threshold), so there must be no path back to it.
  const handleTransaction = async (payload) => {
    setModalError(null);
    try {
      if (modal.type === "debit") {
        await debitWallet(payload).unwrap();
        toast.success("Wallet debited successfully.");
      } else if (modal.type === "refund") {
        await refundWallet(payload).unwrap();
        toast.success("Refund processed successfully.");
      }
      closeModal();
    } catch (err) {
      setModalError(extractApiError(err, "Transaction failed"));
    }
  };

  const handleUpdateStatus = async (payload) => {
    try {
      await updateStatus(payload).unwrap();
      closeModal();
    } catch (err) {
      console.error("Status update failed:", err);
    }
  };

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Wallet Management" },
  ];

  const isTransactionModal =
    modal.type === "topup" || modal.type === "debit" || modal.type === "refund";
  const isStatusModal = modal.type === "status";
  const transactionLoading = debiting || refunding;

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2.5">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-blue-50 text-blue-600">
                <Wallet className="h-5 w-5" />
              </div>
              Wallet Management
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage client wallets and transactions
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Utility actions */}
            <div className="flex items-center gap-1.5 border-r pr-3 mr-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() =>
                  activeTab === "wallets" ? refetchWallets() : refetchTx()
                }
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setSyncModalOpen(true)}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Sync
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setCreateModalOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                New Wallet
              </Button>
            </div>

            {/* Primary transaction actions */}
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                onClick={() => openModal("topup")}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Topup
              </Button>
              <Button
                size="sm"
                className="h-8 bg-red-600 hover:bg-red-700 text-white shadow-sm"
                onClick={() => openModal("debit")}
              >
                <Minus className="h-3.5 w-3.5 mr-1.5" />
                Debit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-blue-500/40 text-blue-500 hover:bg-blue-500/10 hover:text-blue-400"
                onClick={() => openModal("refund")}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Refund
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-2 border-b">
          <button
            onClick={() => setActiveTab("wallets")}
            className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "wallets"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Wallet className="inline h-4 w-4 mr-1.5" />
            Wallets
          </button>
          <button
            onClick={() => setActiveTab("transactions")}
            className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "transactions"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <CreditCard className="inline h-4 w-4 mr-1.5" />
            Transactions
          </button>
          {paymentAvailable && (
            <button
              onClick={() => setActiveTab("payment-links")}
              className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "payment-links"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Link2 className="inline h-4 w-4 mr-1.5" />
              Payment Links
            </button>
          )}
          {isRole("superadmin") && (
            <button
              onClick={() => setActiveTab("approvals")}
              className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors inline-flex items-center ${
                activeTab === "approvals"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldCheck className="inline h-4 w-4 mr-1.5" />
              Approvals
              {pendingApprovalsCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 h-5 px-1.5 text-[10px]"
                >
                  {pendingApprovalsCount}
                </Badge>
              )}
            </button>
          )}
          {isAdminRole && (
            <button
              onClick={() => setActiveTab("qr-collections")}
              className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "qr-collections"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <QrCode className="inline h-4 w-4 mr-1.5" />
              QR Collections
            </button>
          )}
          {isAdminRole && (
            <button
              onClick={() => setActiveTab("qr-unattributed")}
              className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors inline-flex items-center ${
                activeTab === "qr-unattributed"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <HelpCircle className="inline h-4 w-4 mr-1.5" />
              Unattributed
              {unattributedQrCount > 0 && (
                <Badge
                  variant="default"
                  className="ml-1.5 h-5 bg-amber-500 px-1.5 text-[10px] text-white hover:bg-amber-600"
                >
                  {unattributedQrCount}
                </Badge>
              )}
            </button>
          )}
        </div>

        {/* WALLETS TAB */}
        {activeTab === "wallets" && (
          <>
            {/* Wallet Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Total Wallets</p>
                  <p className="text-2xl font-bold">
                    {walletStats.total_wallets ?? "-"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    Active Wallets
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {walletStats.active_wallets ?? "-"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Total Balance</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {walletStats.total_balance != null
                      ? formatCurrency(walletStats.total_balance)
                      : "-"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    Average Balance
                  </p>
                  <p className="text-2xl font-bold">
                    {walletStats.average_balance != null
                      ? formatCurrency(walletStats.average_balance)
                      : "-"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Wallet Filters */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">User ID</Label>
                    <Input
                      placeholder="Filter by user ID"
                      value={walletFilters.userId}
                      onChange={(e) =>
                        setWalletFilters({
                          ...walletFilters,
                          userId: e.target.value,
                        })
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <Select
                      value={walletFilters.status || "all"}
                      onValueChange={(v) =>
                        setWalletFilters({
                          ...walletFilters,
                          status: v === "all" ? "" : v,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="SUSPENDED">Suspended</SelectItem>
                        <SelectItem value="BLOCKED">Blocked</SelectItem>
                        <SelectItem value="CLOSED">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Min Balance</Label>
                    <Input
                      type="number"
                      placeholder="Min balance"
                      value={walletFilters.minBalance}
                      onChange={(e) =>
                        setWalletFilters({
                          ...walletFilters,
                          minBalance: e.target.value,
                        })
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Max Balance</Label>
                    <Input
                      type="number"
                      placeholder="Max balance"
                      value={walletFilters.maxBalance}
                      onChange={(e) =>
                        setWalletFilters({
                          ...walletFilters,
                          maxBalance: e.target.value,
                        })
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Wallets Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-base">
                  <Wallet className="h-4 w-4" />
                  <span>Client Wallets</span>
                  {walletPagination.total_elements != null && (
                    <Badge variant="secondary" className="ml-2">
                      {walletPagination.total_elements} total
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {walletsLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : walletsError ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center p-4">
                    <AlertCircle className="h-10 w-10 text-red-500 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Failed to load wallets
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={refetchWallets}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Retry
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Outlet</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {wallets.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center text-muted-foreground py-10"
                          >
                            No wallets found
                          </TableCell>
                        </TableRow>
                      ) : (
                        wallets.map((wallet) => (
                          <TableRow key={wallet.id}>
                            <TableCell>
                              {outletMap[wallet.user_id] && (
                                <div className="text-sm font-medium">
                                  {outletMap[wallet.user_id]}
                                </div>
                              )}
                              <div className="font-mono text-xs text-muted-foreground">
                                {wallet.user_id}
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold">
                              {formatCurrency(wallet.balance)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={`text-xs border ${getStatusColor(wallet.status)}`}
                              >
                                {wallet.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDate(wallet.created_at)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDate(wallet.updated_at)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() =>
                                    openModal("status", wallet.user_id)
                                  }
                                  title="Update Status"
                                >
                                  <Settings className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-green-600"
                                  onClick={() =>
                                    openModal("topup", wallet.user_id)
                                  }
                                  title="Topup"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-red-600"
                                  onClick={() =>
                                    openModal("debit", wallet.user_id)
                                  }
                                  title="Debit"
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-blue-600"
                                  onClick={() =>
                                    openModal("refund", wallet.user_id)
                                  }
                                  title="Refund"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}

                {/* Wallet Pagination */}
                {walletPagination.total_pages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      Page {walletPagination.current_page + 1} of{" "}
                      {walletPagination.total_pages} (
                      {walletPagination.total_elements} total)
                    </p>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setWalletPage((p) => Math.max(0, p - 1))}
                        disabled={!walletPagination.has_previous}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setWalletPage((p) => p + 1)}
                        disabled={!walletPagination.has_next}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* TRANSACTIONS TAB */}
        {activeTab === "transactions" && (
          <>
            {/* Transaction Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    Total Transactions
                  </p>
                  <p className="text-2xl font-bold">
                    {txStats.total_transactions ?? "-"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-start space-x-2">
                  <TrendingUp className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Topup</p>
                    <p className="text-xl font-bold text-green-600">
                      {txStats.total_topup_amount != null
                        ? formatCurrency(txStats.total_topup_amount)
                        : "-"}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-start space-x-2">
                  <TrendingDown className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Debit</p>
                    <p className="text-xl font-bold text-red-600">
                      {txStats.total_debit_amount != null
                        ? formatCurrency(txStats.total_debit_amount)
                        : "-"}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Total Refund</p>
                  <p className="text-xl font-bold text-blue-600">
                    {txStats.total_refund_amount != null
                      ? formatCurrency(txStats.total_refund_amount)
                      : "-"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Transaction Filters */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">User ID</Label>
                    <Input
                      placeholder="Filter by user ID"
                      value={txFilters.userId}
                      onChange={(e) =>
                        setTxFilters({ ...txFilters, userId: e.target.value })
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Shipment / Reference</Label>
                    <Input
                      placeholder="Shipment ID or reference"
                      value={txFilters.referenceId}
                      onChange={(e) =>
                        setTxFilters({
                          ...txFilters,
                          referenceId: e.target.value,
                        })
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={txFilters.type || "all"}
                      onValueChange={(v) =>
                        setTxFilters({
                          ...txFilters,
                          type: v === "all" ? "" : v,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="TOPUP">Topup</SelectItem>
                        <SelectItem value="DEBIT">Debit</SelectItem>
                        <SelectItem value="REFUND">Refund</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <Select
                      value={txFilters.status || "all"}
                      onValueChange={(v) =>
                        setTxFilters({
                          ...txFilters,
                          status: v === "all" ? "" : v,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="COMPLETED">Completed</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="FAILED">Failed</SelectItem>
                        <SelectItem value="CANCELLED">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Transactions Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-base">
                  <CreditCard className="h-4 w-4" />
                  <span>Client Transactions</span>
                  {txPagination.total_elements != null && (
                    <Badge variant="secondary" className="ml-2">
                      {txPagination.total_elements} total
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {txLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : txError ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center p-4">
                    <AlertCircle className="h-10 w-10 text-red-500 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Failed to load transactions
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={refetchTx}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Retry
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Outlet</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Balance Before</TableHead>
                          <TableHead>Balance After</TableHead>
                          <TableHead>Reference ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={9}
                              className="text-center text-muted-foreground py-10"
                            >
                              No transactions found
                            </TableCell>
                          </TableRow>
                        ) : (
                          transactions.map((tx) => (
                            <TableRow key={tx.id}>
                              <TableCell className="text-xs font-mono">
                                {tx.id}
                              </TableCell>
                              <TableCell>
                                {outletMap[tx.userId] && (
                                  <div className="text-sm font-medium">
                                    {outletMap[tx.userId]}
                                  </div>
                                )}
                                <div className="font-mono text-xs text-muted-foreground">
                                  {tx.userId}
                                </div>
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  const badge = getTransactionTypeBadge(
                                    tx.type,
                                  );
                                  return (
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${badge.className}`}
                                    >
                                      {badge.icon === "up" && (
                                        <TrendingUp className="h-3 w-3" />
                                      )}
                                      {badge.icon === "down" && (
                                        <TrendingDown className="h-3 w-3" />
                                      )}
                                      {badge.icon === "return" && (
                                        <RotateCcw className="h-3 w-3" />
                                      )}
                                      {badge.label}
                                    </span>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="font-semibold">
                                {formatCurrency(tx.amount)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatCurrency(tx.balanceBefore)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatCurrency(tx.balanceAfter)}
                              </TableCell>
                              <TableCell className="font-mono text-xs max-w-[140px] truncate">
                                {tx.referenceId || "-"}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={`text-xs border ${getStatusColor(tx.status)}`}
                                >
                                  {tx.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {formatDate(tx.createdAt)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Transaction Pagination */}
                {txPagination.total_pages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      Page {txPagination.current_page + 1} of{" "}
                      {txPagination.total_pages} ({txPagination.total_elements}{" "}
                      total)
                    </p>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTxPage((p) => Math.max(0, p - 1))}
                        disabled={!txPagination.has_previous}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTxPage((p) => p + 1)}
                        disabled={!txPagination.has_next}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* PAYMENT LINKS TAB */}
        {activeTab === "payment-links" && paymentAvailable && (
          <PaymentLinksTab outletMap={outletMap} />
        )}

        {/* APPROVALS TAB */}
        {activeTab === "approvals" && isRole("superadmin") && (
          <TopupApprovalsTab outletMap={outletMap} />
        )}

        {/* QR COLLECTIONS TAB */}
        {activeTab === "qr-collections" && isAdminRole && (
          <QrCollectionsTab outletMap={outletMap} />
        )}

        {/* QR UNATTRIBUTED TAB */}
        {activeTab === "qr-unattributed" && isAdminRole && (
          <QrUnattributedTab outletMap={outletMap} />
        )}

        {/* Transaction Modal */}
        {isTransactionModal && (
          <TransactionModal
            open={modal.open}
            onClose={closeModal}
            type={modal.type}
            prefilledUserId={modal.userId}
            onSubmit={handleTransaction}
            isLoading={transactionLoading}
            error={modalError}
          />
        )}

        {/* Update Status Modal */}
        {isStatusModal && (
          <UpdateStatusModal
            open={modal.open}
            onClose={closeModal}
            prefilledUserId={modal.userId}
            onSubmit={handleUpdateStatus}
            isLoading={updatingStatus}
          />
        )}

        {/* Create Wallet Modal */}
        <CreateWalletModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={refetchWallets}
        />

        {/* Sync Wallets Modal */}
        <SyncWalletsModal
          open={syncModalOpen}
          onClose={() => setSyncModalOpen(false)}
          onSuccess={refetchWallets}
        />
      </div>
    </DashboardLayout>
  );
}

// ===========================
// Default Export - Route between Outlet and Admin views
// ===========================

export default function WalletPage() {
  const { user, isLoading } = useAuth();

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Pre-existing routing gap (not introduced by the payments work): this used
  // to be `role === "outlet" ? Outlet : Admin`, which meant a `client` or
  // `affiliate` user landed in the ADMIN view with manual credit controls.
  // Only these roles actually manage other holders' wallets.
  const ADMIN_WALLET_ROLES = ["superadmin", "admin", "accounts"];
  const isAdminView = ADMIN_WALLET_ROLES.includes(user?.role);
  return isAdminView ? <AdminWalletPage /> : <OutletWalletView />;
}
