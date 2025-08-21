"use client";

import { CreateShipmentLayout } from "@/components/shipments/create/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useShipmentFormStore } from "@/store/shipment-form-store";
import { FileText, Upload } from "lucide-react";

export default function InvoicesPage() {
  const {
    eWayBillNo,
    invoiceNo,
    invoiceAmt,
    invoiceDate,
    attachment,
    setField,
  } = useShipmentFormStore();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setField("attachment", file);
  };

  return (
    <CreateShipmentLayout>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Invoices</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="eWayBillNo">E-Way bill no.</Label>
              <Input
                id="eWayBillNo"
                placeholder="E-Way bill no."
                value={eWayBillNo}
                onChange={(e) => setField("eWayBillNo", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoiceNo">Invoice No.*</Label>
              <Input
                id="invoiceNo"
                placeholder="520875"
                value={invoiceNo}
                onChange={(e) => setField("invoiceNo", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoiceAmt">Invoice Amt*</Label>
              <Input
                id="invoiceAmt"
                placeholder="Invoice Amount"
                value={invoiceAmt}
                onChange={(e) => setField("invoiceAmt", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoiceDate">Invoice Date*</Label>
              <Input
                id="invoiceDate"
                type="date"
                placeholder="16-06-2025"
                value={invoiceDate}
                onChange={(e) => setField("invoiceDate", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="attachment">Attachment</Label>
            <div className="flex items-center space-x-2">
              <input
                type="file"
                id="attachment"
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById("attachment")?.click()}
                className="flex items-center space-x-2"
              >
                <Upload className="h-4 w-4" />
                <span>Choose File</span>
              </Button>
              <span className="text-sm text-muted-foreground">
                {attachment ? attachment.name : "No file chosen"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </CreateShipmentLayout>
  );
}
