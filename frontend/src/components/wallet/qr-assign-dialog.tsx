"use client";

import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { extractApiError, extractApiErrorCode, formatINR } from "@/lib/utils";
import { useListOutletsQuery } from "@/store/api/endpoints/outletApi";
import { useGetTopupPolicyQuery } from "@/store/api/endpoints/paymentApi";
import { useAssignQrCollectionMutation } from "@/store/api/endpoints/qrCollectionApi";
import type { QrCollection } from "@/store/api/endpoints/qrCollectionApi";

const MIN_REASON_LENGTH = 10;

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

export interface QrAssignDialogProps {
  open: boolean;
  collection: QrCollection | null;
  onClose: () => void;
  onDone: () => void;
}

/**
 * Manually attributes an unattributed static-QR collection to an outlet
 * wallet. Mirrors the manual-topup safeguards elsewhere in wallet: a
 * mandatory reason, and a maker-checker threshold above which the credit
 * needs superadmin approval instead of landing immediately.
 */
export function QrAssignDialog({
  open,
  collection,
  onClose,
  onDone,
}: QrAssignDialogProps) {
  const toast = useToast();
  const [walletUserId, setWalletUserId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: outletsData } = useListOutletsQuery(
    { limit: 100 },
    { skip: !open },
  );
  const outlets = outletsData?.data?.outlets || [];

  const { data: policy } = useGetTopupPolicyQuery(undefined, { skip: !open });
  const [assignCollection, { isLoading }] = useAssignQrCollectionMutation();

  useEffect(() => {
    if (open) {
      setWalletUserId("");
      setReason("");
      setError(null);
    }
  }, [open, collection?.id]);

  if (!collection) return null;

  const amount = collection.amount;
  const needsApproval =
    policy?.manualApprovalThreshold != null &&
    amount >= policy.manualApprovalThreshold;
  const reasonTooShort = reason.trim().length < MIN_REASON_LENGTH;

  const handleSubmit = async () => {
    if (!walletUserId || reasonTooShort) return;
    setError(null);
    try {
      const res = await assignCollection({
        id: collection.id,
        walletUserId,
        reason: reason.trim(),
      }).unwrap();

      if (res.requiresApproval) {
        toast.success(
          "Submitted for superadmin approval - the wallet has not been credited yet.",
        );
      } else {
        toast.success(`${formatINR(amount)} credited.`);
      }
      onDone();
    } catch (err) {
      const code = extractApiErrorCode(err);
      const fallback =
        code === "MANUAL_TOPUP_CAP_EXCEEDED"
          ? "This amount exceeds the manual top-up cap."
          : code === "QR_COLLECTION_NOT_ASSIGNABLE"
            ? "This collection is no longer in an assignable state."
            : code === "QR_COLLECTION_ALREADY_ASSIGNED"
              ? "This collection has already been assigned."
              : "Failed to assign this collection";
      setError(extractApiError(err, fallback));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign collection to an outlet</DialogTitle>
          <DialogDescription>
            Attributes this bank credit to an outlet&apos;s wallet. This is
            audited and cannot be undone once credited.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 rounded-md border bg-muted/40 p-3 text-sm">
          <SummaryRow label="UTR" value={collection.utr || "— (no UTR)"} />
          <SummaryRow label="Amount" value={formatINR(amount)} bold />
          <SummaryRow
            label="Payer"
            value={
              collection.payerName || collection.payerVpa
                ? `${collection.payerName ?? ""}${
                    collection.payerName && collection.payerVpa ? " · " : ""
                  }${collection.payerVpa ?? ""}`
                : "-"
            }
          />
          <SummaryRow
            label="QR identifier"
            value={collection.qrIdentifier || "-"}
          />
          <SummaryRow
            label="Received"
            value={formatDate(collection.receivedAt)}
          />
        </div>

        <div className="space-y-2">
          <Label>Outlet *</Label>
          <Select value={walletUserId} onValueChange={setWalletUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Select outlet" />
            </SelectTrigger>
            <SelectContent>
              {outlets.map((outlet: any) => (
                <SelectItem key={outlet.id} value={outlet.phone}>
                  {outlet.name} ({outlet.phone})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="qr-assign-reason">
            Reason{" "}
            <span className="font-normal text-muted-foreground">
              (required, min {MIN_REASON_LENGTH} characters)
            </span>
          </Label>
          <Textarea
            id="qr-assign-reason"
            placeholder="Why does this collection belong to this outlet? e.g. matched by phone/amount with the outlet's own records..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-[80px] text-sm"
          />
          <p
            className={`text-xs ${
              reasonTooShort
                ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground"
            }`}
          >
            {reason.trim().length}/{MIN_REASON_LENGTH} characters minimum
          </p>
        </div>

        {needsApproval && (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This will need superadmin approval before the wallet is credited.
            </AlertDescription>
          </Alert>
        )}

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
          <Button
            type="button"
            disabled={isLoading || !walletUserId || reasonTooShort}
            onClick={handleSubmit}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {needsApproval ? "Submit for approval" : "Assign & credit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`text-right ${bold ? "font-semibold" : ""}`}>
        {value}
      </span>
    </div>
  );
}
