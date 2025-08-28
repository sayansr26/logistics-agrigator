"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";
import { useShipmentFormStore } from "@/store/shipment-form-store";
import { FileText } from "lucide-react";

export function InvoiceDetails() {
  const {
    eWayBillNo,
    invoiceNo,
    invoiceAmt,
    invoiceDate,
    attachment,
    setField,
    errors,
  } = useShipmentFormStore();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setField("attachment", file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5" />
          <span>Invoice Details</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="eWayBillNo">E-Way Bill No</Label>
            <Input
              id="eWayBillNo"
              placeholder="Enter E-Way Bill number"
              value={eWayBillNo}
              onChange={(e) => setField("eWayBillNo", e.target.value)}
              className={errors.eWayBillNo ? "border-red-500" : ""}
            />
            <FormError message={errors.eWayBillNo} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoiceNo">Invoice No*</Label>
            <Input
              id="invoiceNo"
              placeholder="Enter invoice number"
              value={invoiceNo}
              onChange={(e) => setField("invoiceNo", e.target.value)}
              className={errors.invoiceNo ? "border-red-500" : ""}
            />
            <FormError message={errors.invoiceNo} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="invoiceAmt">Invoice Amount*</Label>
            <Input
              id="invoiceAmt"
              type="number"
              placeholder="Enter invoice amount"
              value={invoiceAmt}
              onChange={(e) => setField("invoiceAmt", e.target.value)}
              className={errors.invoiceAmt ? "border-red-500" : ""}
            />
            <FormError message={errors.invoiceAmt} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoiceDate">Invoice Date*</Label>
            <Input
              id="invoiceDate"
              type="date"
              value={invoiceDate}
              onChange={(e) => setField("invoiceDate", e.target.value)}
              className={errors.invoiceDate ? "border-red-500" : ""}
            />
            <FormError message={errors.invoiceDate} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="attachment">Invoice Attachment</Label>
          <Input
            id="attachment"
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            className={errors.attachment ? "border-red-500" : ""}
          />
          <FormError message={errors.attachment} />
          <div className="text-xs text-muted-foreground mt-1">
            Supported formats: PDF, DOC, DOCX, JPG, JPEG, PNG
          </div>
          {attachment && (
            <div className="mt-2 p-2 bg-gray-50 rounded border">
              <span className="text-sm font-medium">Selected file:</span>{" "}
              <span className="text-sm text-gray-600">{attachment.name}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
