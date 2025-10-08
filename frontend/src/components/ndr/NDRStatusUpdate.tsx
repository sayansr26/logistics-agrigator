"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormError } from "@/components/ui/form-error";
import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { useUpdateNDRStatus } from "@/hooks/useNDR";
import { NDRReport } from "@/types/shipment";

const statusUpdateSchema = z.object({
  status: z.enum(["resolved", "escalated"]),
  resolution: z.string().optional(),
});

type StatusUpdateData = z.infer<typeof statusUpdateSchema>;

interface NDRStatusUpdateProps {
  ndr: NDRReport;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export function NDRStatusUpdate({
  ndr,
  onSuccess,
  onCancel,
  className,
}: NDRStatusUpdateProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const { updateStatus, updating, error, clearError } = useUpdateNDRStatus();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<StatusUpdateData>({
    resolver: zodResolver(statusUpdateSchema),
    defaultValues: {
      status: "resolved",
      resolution: "",
    },
  });

  const selectedStatus = watch("status");

  const onSubmit = async (data: StatusUpdateData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    clearError();

    try {
      const result = await updateStatus(ndr.id, data.status, data.resolution);

      if (result.success) {
        setSubmitSuccess(true);
        setTimeout(() => {
          onSuccess?.();
        }, 1500);
      } else {
        setSubmitError(result.error || "Failed to update NDR status");
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to update NDR status",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    onCancel?.();
  };

  if (submitSuccess) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">
              NDR status updated successfully!
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            <span>Update NDR Status</span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={isSubmitting || updating}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* NDR Info */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">NDR Details</h3>
          <div className="space-y-1 text-sm text-gray-600">
            <p>
              <span className="font-medium">Shipment ID:</span> {ndr.shipmentId}
            </p>
            <p>
              <span className="font-medium">Reason:</span> {ndr.reason}
            </p>
            <p>
              <span className="font-medium">Description:</span>{" "}
              {ndr.description}
            </p>
            <p>
              <span className="font-medium">Reported:</span>{" "}
              {new Date(ndr.reportedAt).toLocaleString()}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Status Selection */}
          <div className="space-y-2">
            <label htmlFor="status" className="text-sm font-medium">
              New Status *
            </label>
            <Select
              onValueChange={(value) =>
                setValue("status", value as "resolved" | "escalated")
              }
            >
              <SelectTrigger className={errors.status ? "border-red-500" : ""}>
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resolved">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Resolved</span>
                  </div>
                </SelectItem>
                <SelectItem value="escalated">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span>Escalated</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {errors.status && (
              <p className="text-sm text-red-500">{errors.status.message}</p>
            )}
          </div>

          {/* Resolution Details */}
          {selectedStatus === "resolved" && (
            <div className="space-y-2">
              <label htmlFor="resolution" className="text-sm font-medium">
                Resolution Details *
              </label>
              <Textarea
                id="resolution"
                {...register("resolution")}
                placeholder="Describe how the issue was resolved"
                rows={4}
                className={errors.resolution ? "border-red-500" : ""}
              />
              {errors.resolution && (
                <p className="text-sm text-red-500">
                  {errors.resolution.message}
                </p>
              )}
            </div>
          )}

          {selectedStatus === "escalated" && (
            <div className="space-y-2">
              <label htmlFor="resolution" className="text-sm font-medium">
                Escalation Notes (Optional)
              </label>
              <Textarea
                id="resolution"
                {...register("resolution")}
                placeholder="Add any notes about the escalation"
                rows={4}
                className={errors.resolution ? "border-red-500" : ""}
              />
              {errors.resolution && (
                <p className="text-sm text-red-500">
                  {errors.resolution.message}
                </p>
              )}
            </div>
          )}

          {/* Error Display */}
          {(error || submitError) && (
            <FormError message={error || submitError || ""} />
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting || updating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isSubmitting || updating}
              className="min-w-[120px]"
            >
              {isSubmitting || updating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Status"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
