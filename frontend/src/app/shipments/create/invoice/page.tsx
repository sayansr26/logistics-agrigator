"use client";

import React, { useEffect } from "react";
import { CreateShipmentLayout } from "@/components/shipments/create/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useShipmentFormStore } from "@/store/shipment-form-store";
import { FileText, Plus, Trash2, Upload } from "lucide-react";

export default function InvoicesPage() {
  const { invoices, addInvoice, removeInvoice, updateInvoice } =
    useShipmentFormStore();

  useEffect(() => {
    if (invoices.length === 0) addInvoice();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <CreateShipmentLayout>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Invoices</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addInvoice}
              className="gap-1 text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-950"
            >
              <Plus className="h-4 w-4" />
              Add Row
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Header labels */}
          <div className="hidden md:grid md:grid-cols-[1fr_1fr_1fr_1fr_1fr_40px] gap-3 text-xs font-medium text-muted-foreground">
            <span>E-Way Bill No.</span>
            <span>Invoice No.*</span>
            <span>Invoice Amt*</span>
            <span>Invoice Date*</span>
            <span>Attachment</span>
            <span />
          </div>

          {invoices.map((inv, idx) => (
            <div
              key={inv.id}
              className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1fr_1fr_40px] gap-3 items-end border-b pb-4 last:border-0 last:pb-0"
            >
              <div className="space-y-1">
                <Label className="md:hidden text-xs">E-Way Bill No.</Label>
                <Input
                  placeholder="E-Way bill no."
                  value={inv.eWayBillNo}
                  onChange={(e) =>
                    updateInvoice(inv.id, "eWayBillNo", e.target.value)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="md:hidden text-xs">Invoice No.*</Label>
                <Input
                  placeholder="SBKD/25-26/55"
                  value={inv.invoiceNo}
                  onChange={(e) =>
                    updateInvoice(inv.id, "invoiceNo", e.target.value)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="md:hidden text-xs">Invoice Amt*</Label>
                <Input
                  type="number"
                  placeholder="18360"
                  value={inv.invoiceAmt}
                  onChange={(e) =>
                    updateInvoice(inv.id, "invoiceAmt", e.target.value)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="md:hidden text-xs">Invoice Date*</Label>
                <Input
                  type="date"
                  value={inv.invoiceDate}
                  onChange={(e) =>
                    updateInvoice(inv.id, "invoiceDate", e.target.value)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="md:hidden text-xs">Attachment</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    id={`file-${inv.id}`}
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      updateInvoice(inv.id, "attachment", file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() =>
                      document.getElementById(`file-${inv.id}`)?.click()
                    }
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    {inv.attachment
                      ? (inv.attachment as File).name.substring(0, 12) + "..."
                      : "Choose File"}
                  </Button>
                </div>
              </div>
              <div>
                {invoices.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeInvoice(inv.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 p-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          {invoices.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No invoices added. Click &quot;Add Row&quot; to add an invoice.
            </div>
          )}
        </CardContent>
      </Card>
    </CreateShipmentLayout>
  );
}
