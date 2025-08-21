"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreateShipmentLayout } from "@/components/shipments/create/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useShipmentFormStore } from "@/store/shipment-form-store";
import {
  Package,
  MapPin,
  FileText,
  Box,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";

export default function ReviewPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formData = useShipmentFormStore();

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // TODO: Implement actual API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      router.push("/shipments?created=true");
    } catch (error) {
      console.error("Error creating shipment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const SectionTitle = ({
    icon: Icon,
    title,
  }: {
    icon: any;
    title: string;
  }) => (
    <div className="flex items-center space-x-2 text-lg font-medium">
      <Icon className="h-5 w-5" />
      <span>{title}</span>
    </div>
  );

  const Field = ({ label, value }: { label: string; value: string }) => (
    <div className="space-y-1">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{value || "-"}</dd>
    </div>
  );

  return (
    <CreateShipmentLayout>
      <div className="space-y-6">
        {/* Docket Information */}
        <Card>
          <CardHeader>
            <CardTitle>
              <SectionTitle icon={Package} title="Docket Information" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <Field label="Reference No" value={formData.referenceNo} />
              <Field label="Actual Weight" value={formData.actualWeight} />
              <Field label="Pickup Address" value={formData.pickupAddress} />
              <Field
                label="Product Description"
                value={formData.productDescription}
              />
            </div>
          </CardContent>
        </Card>

        {/* Delivery Location */}
        <Card>
          <CardHeader>
            <CardTitle>
              <SectionTitle
                icon={MapPin}
                title="Delivery Location Information"
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <Field label="Phone Number" value={formData.phoneNumber} />
              <Field label="Alternate Phone" value={formData.alternatePhone} />
              <Field label="Email" value={formData.email} />
              <Field label="Receiver Name" value={formData.receiverName} />
              <div className="col-span-2">
                <Field label="Address" value={formData.address} />
              </div>
              <Field label="Landmark" value={formData.landmark} />
              <Field label="Pincode" value={formData.pincode} />
              <Field label="Area" value={formData.area} />
              <Field label="City" value={formData.city} />
              <Field label="State" value={formData.state} />
            </div>
          </CardContent>
        </Card>

        {/* Invoices */}
        <Card>
          <CardHeader>
            <CardTitle>
              <SectionTitle icon={FileText} title="Invoice Details" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <Field label="E-Way Bill No" value={formData.eWayBillNo} />
              <Field label="Invoice No" value={formData.invoiceNo} />
              <Field label="Invoice Amount" value={formData.invoiceAmt} />
              <Field label="Invoice Date" value={formData.invoiceDate} />
              <Field
                label="Attachment"
                value={
                  formData.attachment
                    ? formData.attachment.name
                    : "No file attached"
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Dimensions */}
        <Card>
          <CardHeader>
            <CardTitle>
              <SectionTitle icon={Box} title="Package Dimensions" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="text-sm font-medium">
                Total Boxes: {formData.boxes.length}
              </div>
              <div className="grid gap-6">
                {formData.boxes.map((box, index) => (
                  <div key={box.id} className="border rounded-lg p-4">
                    <h4 className="font-medium mb-4">Box {index + 1}</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <Field label="Length (cm)" value={box.length} />
                      <Field label="Height (cm)" value={box.height} />
                      <Field label="Width (cm)" value={box.width} />
                      {box.length && box.height && box.width && (
                        <div className="col-span-3 bg-gray-50 p-3 rounded">
                          <span className="font-medium">Volume: </span>
                          <span>
                            {(
                              parseFloat(box.length) *
                              parseFloat(box.height) *
                              parseFloat(box.width)
                            ).toFixed(2)}{" "}
                            cm³
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {/* <div className="flex items-center justify-between pt-6">
          <Button
            variant="outline"
            onClick={() => router.push("/shipments/create/dimensions")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dimensions
          </Button>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => formData.resetForm()}
              disabled={isSubmitting}
            >
              Reset Form
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {isSubmitting ? "Creating Shipment..." : "Create Shipment"}
            </Button>
          </div>
        </div> */}
      </div>
    </CreateShipmentLayout>
  );
}
