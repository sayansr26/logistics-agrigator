"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormError } from "@/components/ui/form-error";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useCreateNDR } from "@/hooks/useNDR";
import { useNDRReasons } from "@/hooks/useNDR";

const ndrSchema = z.object({
  shipmentId: z.string().min(1, "Shipment ID is required"),
  reason: z.string().min(1, "Reason is required"),
  reasonCode: z.string().min(1, "Reason code is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
});

type NDRFormData = z.infer<typeof ndrSchema>;

interface NDRFormProps {
  shipmentId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export function NDRForm({
  shipmentId,
  onSuccess,
  onCancel,
  className,
}: NDRFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const { createNDR, creating, error, clearError } = useCreateNDR();
  const { ndrReasons, loading: reasonsLoading } = useNDRReasons();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<NDRFormData>({
    resolver: zodResolver(ndrSchema),
    defaultValues: {
      shipmentId: shipmentId || "",
      reason: "",
      reasonCode: "",
      description: "",
    },
  });

  const selectedReason = watch("reason");

  // Update reason code when reason changes
  useEffect(() => {
    if (selectedReason && ndrReasons.length > 0) {
      const reason = ndrReasons.find((r) => r.description === selectedReason);
      if (reason) {
        setValue("reasonCode", reason.code);
      }
    }
  }, [selectedReason, ndrReasons, setValue]);

  const onSubmit = async (data: NDRFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    clearError();

    try {
      const result = await createNDR(data);

      if (result.success) {
        setSubmitSuccess(true);
        setTimeout(() => {
          onSuccess?.();
        }, 1500);
      } else {
        setSubmitError(result.error || "Failed to create NDR");
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to create NDR",
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
            <span className="font-medium">NDR created successfully!</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          <span>Create Non-Delivery Report</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Shipment ID */}
          <div className="space-y-2">
            <label htmlFor="shipmentId" className="text-sm font-medium">
              Shipment ID *
            </label>
            <Input
              id="shipmentId"
              {...register("shipmentId")}
              placeholder="Enter shipment ID"
              disabled={!!shipmentId}
              className={errors.shipmentId ? "border-red-500" : ""}
            />
            {errors.shipmentId && (
              <p className="text-sm text-red-500">
                {errors.shipmentId.message}
              </p>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <label htmlFor="reason" className="text-sm font-medium">
              Reason *
            </label>
            <Select onValueChange={(value) => setValue("reason", value)}>
              <SelectTrigger className={errors.reason ? "border-red-500" : ""}>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {reasonsLoading ? (
                  <SelectItem value="loading" disabled>
                    Loading reasons...
                  </SelectItem>
                ) : (
                  ndrReasons.map((reason) => (
                    <SelectItem key={reason.id} value={reason.description}>
                      {reason.description}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {errors.reason && (
              <p className="text-sm text-red-500">{errors.reason.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description *
            </label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Provide detailed description of the non-delivery issue"
              rows={4}
              className={errors.description ? "border-red-500" : ""}
            />
            {errors.description && (
              <p className="text-sm text-red-500">
                {errors.description.message}
              </p>
            )}
          </div>

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
              disabled={isSubmitting || creating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isSubmitting || creating}
              className="min-w-[120px]"
            >
              {isSubmitting || creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create NDR"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
