"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useShipmentFormStore } from "@/store/shipment-form-store";
import { CheckCircle, Package, MapPin, FileText, Box } from "lucide-react";

export function ReviewForm() {
  const {
    referenceNo,
    actualWeight,
    pickupAddress,
    productDescription,
    phoneNumber,
    email,
    receiverName,
    address,
    pincode,
    city,
    state,
    eWayBillNo,
    invoiceNo,
    invoiceAmt,
    invoiceDate,
    boxes,
  } = useShipmentFormStore();

  const formatAddress = () => {
    const parts = [address, city, state, pincode].filter(Boolean);
    return parts.join(", ");
  };

  const totalVolume = boxes.reduce((total, box) => {
    const l = parseFloat(box.length) || 0;
    const w = parseFloat(box.width) || 0;
    const h = parseFloat(box.height) || 0;
    return total + l * w * h;
  }, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span>Review Shipment Details</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Please review all the information before creating your shipment
          </p>
        </CardContent>
      </Card>

      {/* Docket Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Package className="h-5 w-5" />
            <span>Docket Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium text-muted-foreground">
                Reference No
              </span>
              <p className="font-medium">{referenceNo || "Not provided"}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground">
                Weight
              </span>
              <p className="font-medium">
                {actualWeight ? `${actualWeight} kg` : "Not provided"}
              </p>
            </div>
          </div>
          <div>
            <span className="text-sm font-medium text-muted-foreground">
              Pickup Address
            </span>
            <p className="font-medium">{pickupAddress || "Not provided"}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-muted-foreground">
              Product Description
            </span>
            <p className="font-medium">
              {productDescription || "Not provided"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="h-5 w-5" />
            <span>Delivery Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium text-muted-foreground">
                Receiver Name
              </span>
              <p className="font-medium">{receiverName || "Not provided"}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground">
                Phone
              </span>
              <p className="font-medium">{phoneNumber || "Not provided"}</p>
            </div>
          </div>
          <div>
            <span className="text-sm font-medium text-muted-foreground">
              Email
            </span>
            <p className="font-medium">{email || "Not provided"}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-muted-foreground">
              Delivery Address
            </span>
            <p className="font-medium">{formatAddress() || "Not provided"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Invoice Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium text-muted-foreground">
                Invoice No
              </span>
              <p className="font-medium">{invoiceNo || "Not provided"}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground">
                Amount
              </span>
              <p className="font-medium">
                {invoiceAmt ? `₹${invoiceAmt}` : "Not provided"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium text-muted-foreground">
                Invoice Date
              </span>
              <p className="font-medium">{invoiceDate || "Not provided"}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground">
                E-Way Bill
              </span>
              <p className="font-medium">{eWayBillNo || "Not provided"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Package Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Box className="h-5 w-5" />
            <span>Package Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {boxes.length === 0 ? (
            <p className="text-muted-foreground">No packages added</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Total Packages
                </span>
                <Badge variant="secondary">{boxes.length}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Total Volume
                </span>
                <Badge variant="secondary">{totalVolume.toFixed(2)} cm³</Badge>
              </div>
              <div className="space-y-2">
                {boxes.map((box, index) => (
                  <div
                    key={box.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <span className="text-sm">Package {index + 1}</span>
                    <span className="text-sm text-muted-foreground">
                      {box.length} × {box.width} × {box.height} cm
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
