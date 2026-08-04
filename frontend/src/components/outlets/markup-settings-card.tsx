"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  Percent,
  IndianRupee,
  Save,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useGetMyOutletQuery,
  useUpdateMyMarkupMutation,
} from "@/store/api/endpoints/outletApi";

type MarkupType = "FLAT" | "PERCENTAGE";

/**
 * Outlet-facing card for setting the default markup applied at booking
 * whenever a shipment omits an explicit `markup`. Values are capped
 * server-side against the client/admin-configured maxMarkupFlat /
 * maxMarkupPercent - a 400 MARKUP_CAP_EXCEEDED surfaces inline.
 */
export function MarkupSettingsCard() {
  const { data, isLoading, isError } = useGetMyOutletQuery();
  const [updateMyMarkup, { isLoading: isSaving }] = useUpdateMyMarkupMutation();

  const outlet = data?.data?.outlet;

  const [markupType, setMarkupType] = useState<MarkupType>("PERCENTAGE");
  const [markupValue, setMarkupValue] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!outlet) return;
    setMarkupType((outlet.defaultMarkupType as MarkupType) || "PERCENTAGE");
    setMarkupValue(
      outlet.defaultMarkupValue !== null &&
        outlet.defaultMarkupValue !== undefined
        ? String(outlet.defaultMarkupValue)
        : "",
    );
  }, [outlet]);

  // isError covers the case where the caller has no outlet profile (e.g.
  // an admin previewing the earnings page) - render nothing rather than
  // an error card in that scenario.
  if (isError) return null;

  const cap =
    markupType === "FLAT" ? outlet?.maxMarkupFlat : outlet?.maxMarkupPercent;
  const capNum = cap !== null && cap !== undefined ? Number(cap) : null;

  const handleSave = async () => {
    setFormError(null);
    setSuccess(false);

    const trimmed = markupValue.trim();
    if (trimmed === "") {
      setFormError("Enter a markup value");
      return;
    }
    const value = Number(trimmed);
    if (Number.isNaN(value) || value < 0) {
      setFormError("Enter a valid, non-negative markup value");
      return;
    }

    try {
      await updateMyMarkup({ markupType, markupValue: value }).unwrap();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setFormError(
        err?.data?.error?.message ||
          "Failed to update markup preference. Please try again.",
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Markup Preference</CardTitle>
        <CardDescription>
          Default markup applied to your bookings when a shipment doesn&apos;t
          set its own markup.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="space-y-2">
                <Label>Markup Type</Label>
                <div className="inline-flex rounded-md border p-1">
                  <button
                    type="button"
                    onClick={() => setMarkupType("PERCENTAGE")}
                    className={cn(
                      "flex items-center gap-1 rounded px-3 py-1.5 text-sm font-medium transition-colors",
                      markupType === "PERCENTAGE"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Percent className="h-3.5 w-3.5" />
                    Percentage
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarkupType("FLAT")}
                    className={cn(
                      "flex items-center gap-1 rounded px-3 py-1.5 text-sm font-medium transition-colors",
                      markupType === "FLAT"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <IndianRupee className="h-3.5 w-3.5" />
                    Flat
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="markup-value">
                  {markupType === "FLAT" ? "Amount (₹)" : "Percentage (%)"}
                </Label>
                <Input
                  id="markup-value"
                  type="number"
                  min={0}
                  step="0.01"
                  value={markupValue}
                  onChange={(e) => setMarkupValue(e.target.value)}
                  placeholder={markupType === "FLAT" ? "e.g. 25" : "e.g. 5"}
                  className="w-40"
                />
              </div>

              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
            </div>

            {capNum !== null && (
              <p className="text-xs text-muted-foreground">
                Capped by your client/admin at{" "}
                <span className="font-medium">
                  {markupType === "FLAT" ? `₹${capNum}` : `${capNum}%`}
                </span>
                .
              </p>
            )}

            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert variant="success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Markup preference updated successfully.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
