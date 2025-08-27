"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/ui/form-error";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useShipmentFormStore } from "@/store/shipment-form-store";
import { CreateShipmentLayout } from "@/components/shipments/create/layout";
import { Package, FileText, Plus, Trash2, User, Building } from "lucide-react";

export default function CreateShipmentPage() {
  const [isClient, setIsClient] = useState(false);
  const {
    // Docket fields
    referenceNo,
    actualWeight,
    pickupAddress,
    productDescription,

    // Delivery fields
    phoneNumber,
    alternatePhone,
    email,
    receiverName,
    address,
    landmark,
    pincode,
    area,
    city,
    state,

    // RTO fields
    isRTO,
    returnAddress,
    returnPincode,
    returnCity,
    returnState,

    // Invoice fields
    invoices,

    // Methods
    setField,
    addInvoice,
    removeInvoice,
    updateInvoice,
    errors,
  } = useShipmentFormStore();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    // TODO: Implement form submission logic
  };

  const pickupAddresses = [
    {
      value: "startup-Sample-5005",
      label: "StartUP-Sample-5005/110032",
      details: {
        warehouse: "StartUP-Sample-5005",
        address: "Delhi, Delhi, 110032",
        fullAddress: "110032 | west gorakh park gali no-3 shahdara",
      },
    },
    {
      value: "warehouse-mumbai",
      label: "Warehouse Mumbai",
      details: {
        warehouse: "Warehouse Mumbai",
        address: "Mumbai, Maharashtra, 400001",
        fullAddress: "400001 | Andheri West, Mumbai",
      },
    },
    {
      value: "warehouse-delhi",
      label: "Warehouse Delhi",
      details: {
        warehouse: "Warehouse Delhi",
        address: "Delhi, Delhi, 110001",
        fullAddress: "110001 | Connaught Place, Delhi",
      },
    },
  ];

  const selectedPickup = pickupAddresses.find(
    (addr) => addr.value === pickupAddress,
  );

  if (!isClient) {
    return null;
  }

  return (
    <CreateShipmentLayout>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Docket Information Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <span>Docket Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="referenceNo">Reference No*</Label>
                <Input
                  id="referenceNo"
                  placeholder="250810021T1582"
                  value={referenceNo}
                  onChange={(e) => setField("referenceNo", e.target.value)}
                  className={errors.referenceNo ? "border-red-500" : ""}
                />
                <FormError message={errors.referenceNo} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actualWeight">Actual Weight (Kg)*</Label>
                <Input
                  id="actualWeight"
                  type="number"
                  step="0.01"
                  placeholder="0.5"
                  value={actualWeight}
                  onChange={(e) => setField("actualWeight", e.target.value)}
                  className={errors.actualWeight ? "border-red-500" : ""}
                />
                <FormError message={errors.actualWeight} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pickupAddress">Select Pickup Address*</Label>
              <Select
                value={pickupAddress}
                onValueChange={(value) => setField("pickupAddress", value)}
              >
                <SelectTrigger
                  className={errors.pickupAddress ? "border-red-500" : ""}
                >
                  <SelectValue placeholder="Select pickup address" />
                </SelectTrigger>
                <SelectContent>
                  {pickupAddresses.map((addr) => (
                    <SelectItem key={addr.value} value={addr.value}>
                      {addr.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormError message={errors.pickupAddress} />

              {selectedPickup && (
                <div className="text-xs text-gray-600 mt-2 p-3 bg-gray-50 rounded-md">
                  <div className="font-medium">
                    {selectedPickup.details.warehouse}
                  </div>
                  <div>{selectedPickup.details.address}</div>
                  <div>{selectedPickup.details.fullAddress}</div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="productDescription">Product Description*</Label>
              <Textarea
                id="productDescription"
                placeholder="Enter detailed product description"
                value={productDescription}
                onChange={(e) => setField("productDescription", e.target.value)}
                className={errors.productDescription ? "border-red-500" : ""}
                rows={3}
              />
              <FormError message={errors.productDescription} />
            </div>

            {/* RTO Option moved to docket section */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isRTO"
                  checked={isRTO}
                  onChange={(e) => {
                    setField("isRTO", e.target.checked);
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="isRTO" className="text-sm font-medium">
                  RTO address same as pickup address
                </Label>
              </div>
              <div className="text-xs text-gray-500">
                Current RTO state:{" "}
                {isRTO
                  ? "Checked (Return address hidden)"
                  : "Unchecked (Return address visible)"}
              </div>
            </div>

            {/* Return Address Section - Only show when RTO is unchecked */}
            {!isRTO && (
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Building className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-800">
                    Return Address (RTO Unchecked)
                  </span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="returnAddress">Return Address*</Label>
                  <Textarea
                    id="returnAddress"
                    placeholder="Enter return address"
                    value={returnAddress}
                    onChange={(e) => setField("returnAddress", e.target.value)}
                    className={errors.returnAddress ? "border-red-500" : ""}
                    rows={3}
                  />
                  <FormError message={errors.returnAddress} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="returnPincode">Return Pincode*</Label>
                    <Input
                      id="returnPincode"
                      placeholder="110001"
                      value={returnPincode}
                      onChange={(e) =>
                        setField("returnPincode", e.target.value)
                      }
                      className={errors.returnPincode ? "border-red-500" : ""}
                    />
                    <FormError message={errors.returnPincode} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="returnCity">Return City*</Label>
                    <Input
                      id="returnCity"
                      placeholder="City name"
                      value={returnCity}
                      onChange={(e) => setField("returnCity", e.target.value)}
                      className={errors.returnCity ? "border-red-500" : ""}
                    />
                    <FormError message={errors.returnCity} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="returnState">Return State*</Label>
                    <Input
                      id="returnState"
                      placeholder="State name"
                      value={returnState}
                      onChange={(e) => setField("returnState", e.target.value)}
                      className={errors.returnState ? "border-red-500" : ""}
                    />
                    <FormError message={errors.returnState} />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery Information Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Delivery Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="receiverName">Receiver Name*</Label>
                <Input
                  id="receiverName"
                  placeholder="Enter receiver name"
                  value={receiverName}
                  onChange={(e) => setField("receiverName", e.target.value)}
                  className={errors.receiverName ? "border-red-500" : ""}
                />
                <FormError message={errors.receiverName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number*</Label>
                <Input
                  id="phoneNumber"
                  placeholder="+91 98765 43210"
                  value={phoneNumber}
                  onChange={(e) => setField("phoneNumber", e.target.value)}
                  className={errors.phoneNumber ? "border-red-500" : ""}
                />
                <FormError message={errors.phoneNumber} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="alternatePhone">Alternate Phone</Label>
                <Input
                  id="alternatePhone"
                  placeholder="+91 98765 43211"
                  value={alternatePhone}
                  onChange={(e) => setField("alternatePhone", e.target.value)}
                  className={errors.alternatePhone ? "border-red-500" : ""}
                />
                <FormError message={errors.alternatePhone} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="receiver@example.com"
                  value={email}
                  onChange={(e) => setField("email", e.target.value)}
                  className={errors.email ? "border-red-500" : ""}
                />
                <FormError message={errors.email} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Delivery Address*</Label>
              <Textarea
                id="address"
                placeholder="Enter complete delivery address"
                value={address}
                onChange={(e) => setField("address", e.target.value)}
                className={errors.address ? "border-red-500" : ""}
                rows={3}
              />
              <FormError message={errors.address} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="landmark">Landmark</Label>
                <Input
                  id="landmark"
                  placeholder="Near landmark"
                  value={landmark}
                  onChange={(e) => setField("landmark", e.target.value)}
                  className={errors.landmark ? "border-red-500" : ""}
                />
                <FormError message={errors.landmark} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode*</Label>
                <Input
                  id="pincode"
                  placeholder="110001"
                  value={pincode}
                  onChange={(e) => setField("pincode", e.target.value)}
                  className={errors.pincode ? "border-red-500" : ""}
                />
                <FormError message={errors.pincode} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="area">Area</Label>
                <Input
                  id="area"
                  placeholder="Area name"
                  value={area}
                  onChange={(e) => setField("area", e.target.value)}
                  className={errors.area ? "border-red-500" : ""}
                />
                <FormError message={errors.area} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City*</Label>
                <Input
                  id="city"
                  placeholder="City name"
                  value={city}
                  onChange={(e) => setField("city", e.target.value)}
                  className={errors.city ? "border-red-500" : ""}
                />
                <FormError message={errors.city} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State*</Label>
              <Input
                id="state"
                placeholder="State name"
                value={state}
                onChange={(e) => setField("state", e.target.value)}
                className={errors.state ? "border-red-500" : ""}
              />
              <FormError message={errors.state} />
            </div>
          </CardContent>
        </Card>

        {/* Invoice Details Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Invoice Details</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {invoices.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No invoices added yet</p>
              </div>
            )}

            {invoices.map((invoice, index) => (
              <div key={invoice.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Invoice #{index + 1}</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeInvoice(invoice.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`invoiceType-${invoice.id}`}>
                      Invoice Type
                    </Label>
                    <Select
                      value={invoice.invoiceType}
                      onValueChange={(value) =>
                        updateInvoice(invoice.id, "invoiceType", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select invoice type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tax">Tax Invoice</SelectItem>
                        <SelectItem value="bill">Bill of Supply</SelectItem>
                        <SelectItem value="debit">Debit Note</SelectItem>
                        <SelectItem value="credit">Credit Note</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`invoiceNo-${invoice.id}`}>
                      Invoice Number*
                    </Label>
                    <Input
                      id={`invoiceNo-${invoice.id}`}
                      placeholder="INV-2024-001"
                      value={invoice.invoiceNo}
                      onChange={(e) =>
                        updateInvoice(invoice.id, "invoiceNo", e.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`invoiceDate-${invoice.id}`}>
                      Invoice Date*
                    </Label>
                    <Input
                      id={`invoiceDate-${invoice.id}`}
                      type="date"
                      value={invoice.invoiceDate}
                      onChange={(e) =>
                        updateInvoice(invoice.id, "invoiceDate", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`invoiceAmt-${invoice.id}`}>
                      Invoice Amount*
                    </Label>
                    <Input
                      id={`invoiceAmt-${invoice.id}`}
                      type="number"
                      step="0.01"
                      placeholder="1000.00"
                      value={invoice.invoiceAmt}
                      onChange={(e) =>
                        updateInvoice(invoice.id, "invoiceAmt", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`currency-${invoice.id}`}>Currency</Label>
                    <Select
                      value={invoice.currency}
                      onValueChange={(value) =>
                        updateInvoice(invoice.id, "currency", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INR">INR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`eWayBillNo-${invoice.id}`}>
                      E-Way Bill No
                    </Label>
                    <Input
                      id={`eWayBillNo-${invoice.id}`}
                      placeholder="EWB123456789"
                      value={invoice.eWayBillNo}
                      onChange={(e) =>
                        updateInvoice(invoice.id, "eWayBillNo", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`attachment-${invoice.id}`}>
                      Invoice Attachment
                    </Label>
                    <Input
                      id={`attachment-${invoice.id}`}
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        updateInvoice(invoice.id, "attachment", file);
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={addInvoice}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Invoice
            </Button>
          </CardContent>
        </Card>
      </form>
    </CreateShipmentLayout>
  );
}
