"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { extractApiError, extractApiErrorCode, formatINR } from "@/lib/utils";
import {
  useApproveManualTopupMutation,
  useRejectManualTopupMutation,
} from "@/store/api/endpoints/paymentApi";
import type { ManualTopupRequestData } from "@/store/api/endpoints/paymentApi";

const MIN_REJECT_REMARKS_LENGTH = 10;

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

export interface ApprovalDecisionDialogProps {
  open: boolean;
  action: "approve" | "reject";
  approval: ManualTopupRequestData | null;
  onClose: () => void;
  onDone: () => void;
}

/**
 * Confirms an approve/reject decision on a manual top-up request.
 *
 * A note is optional for approve and required (min `MIN_REJECT_REMARKS_LENGTH`
 * characters) for reject. Backend errors - notably 403 `SELF_APPROVAL_FORBIDDEN`
 * and 409 `ALREADY_REVIEWED` - are surfaced verbatim in the error alert rather
 * than being re-worded here.
 */
export function ApprovalDecisionDialog({
  open,
  action,
  approval,
  onClose,
  onDone,
}: ApprovalDecisionDialogProps) {
  const toast = useToast();
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [approveTopup, { isLoading: approving }] =
    useApproveManualTopupMutation();
  const [rejectTopup, { isLoading: rejecting }] =
    useRejectManualTopupMutation();
  const isLoading = approving || rejecting;

  // Reset local state whenever the dialog is (re)opened for a request.
  useEffect(() => {
    if (open) {
      setRemarks("");
      setError(null);
    }
  }, [open, approval?.id]);

  const isReject = action === "reject";
  const remarksTooShort =
    isReject && remarks.trim().length < MIN_REJECT_REMARKS_LENGTH;

  const handleSubmit = async () => {
    if (!approval) return;
    setError(null);

    try {
      if (isReject) {
        await rejectTopup({
          id: approval.id,
          reviewRemarks: remarks.trim(),
        }).unwrap();
        toast.success("Top-up request rejected");
      } else {
        const body: { id: string; reviewRemarks?: string } = {
          id: approval.id,
        };
        const trimmed = remarks.trim();
        if (trimmed) body.reviewRemarks = trimmed;
        await approveTopup(body).unwrap();
        toast.success("Top-up request approved");
      }
      onDone();
    } catch (err: any) {
      const code = extractApiErrorCode(err);
      const fallback =
        code === "SELF_APPROVAL_FORBIDDEN"
          ? "You cannot approve your own top-up request."
          : code === "ALREADY_REVIEWED"
            ? "This request has already been reviewed."
            : "Failed to submit decision";
      setError(extractApiError(err, fallback));
    }
  };

  if (!approval) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isReject ? "Reject top-up request" : "Approve top-up request"}
          </DialogTitle>
          <DialogDescription>
            {isReject
              ? "This will reject the manual top-up request. A note explaining why is required."
              : "This will approve the manual top-up request and credit the wallet."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 rounded-md border bg-muted/40 p-3 text-sm">
          <div className="flex items-start justify-between gap-4">
            <span className="text-muted-foreground shrink-0">Customer</span>
            <span className="text-right font-medium">
              {approval.clientCode || approval.walletUserId}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="text-muted-foreground shrink-0">Amount</span>
            <span className="text-right font-semibold">
              {formatINR(approval.amount)}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="text-muted-foreground shrink-0">Reason</span>
            <span className="text-right">{approval.reason || "-"}</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="text-muted-foreground shrink-0">
              External reference
            </span>
            <span className="text-right font-mono text-xs">
              {approval.externalReference || "-"}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="text-muted-foreground shrink-0">Requested by</span>
            <span className="text-right">{approval.requestedBy}</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="text-muted-foreground shrink-0">Requested at</span>
            <span className="text-right">
              {formatDate(approval.requestedAt)}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="review-remarks" className="text-xs">
            Note{" "}
            <span className="font-normal text-muted-foreground">
              {isReject
                ? `(required, min ${MIN_REJECT_REMARKS_LENGTH} characters)`
                : "(optional)"}
            </span>
          </Label>
          <Textarea
            id="review-remarks"
            placeholder={
              isReject
                ? "Explain why this request is being rejected..."
                : "Add an optional note..."
            }
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="min-h-[90px] text-sm"
          />
          {isReject && (
            <p
              className={`text-xs ${
                remarksTooShort
                  ? "text-red-600 dark:text-red-400"
                  : "text-muted-foreground"
              }`}
            >
              {remarks.trim().length}/{MIN_REJECT_REMARKS_LENGTH} characters
              minimum
            </p>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          {isReject ? (
            <Button
              variant="destructive"
              onClick={handleSubmit}
              disabled={isLoading || remarksTooShort}
            >
              {rejecting ? "Rejecting..." : "Reject"}
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {approving
                ? "Approving..."
                : `Approve ${formatINR(approval.amount)}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
