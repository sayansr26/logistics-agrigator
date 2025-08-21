"use client";

import { useState } from "react";
import { CreateShipmentLayout } from "@/components/shipments/create/layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useShipmentFormStore } from "@/store/shipment-form-store";
import {
  Package,
  Truck,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  Plus,
  Eye,
  Edit,
  Trash2,
  Copy,
  ExternalLink,
  Search,
  Filter,
  Download,
  RefreshCw,
  HelpCircle,
  MessageSquare,
  Phone,
  Mail,
  User,
  Building,
  ChevronRight,
  ArrowRight,
  Check,
  Navigation,
  Layers,
  Smartphone,
  Monitor,
  Home,
  ChevronDown,
  Menu,
  FileText,
  Box,
} from "lucide-react";

export default function ReviewPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    currentStep,
    referenceNo,
    actualWeight,
    pickupAddress,
    productDescription,
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
    eWayBillNo,
    invoiceNo,
    invoiceAmt,
    invoiceDate,
    attachment,
    boxes,
    setStep,
  } = useShipmentFormStore();

  const handleStepChange = (step: number) => {
    setStep(step);
  };

  const handleSubmit = () => {
    // In real app, this would submit the shipment data via API
    // Submission logic would go here
  };

  return (
    <CreateShipmentLayout
      currentStep={currentStep}
      onStepChange={handleStepChange}
    >
      <div className="space-y-6">
        {/* Docket Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <span>Docket Information</span>
            </CardTitle>
            <CardDescription>
              Review your shipment details before creating
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Reference Number
                </label>
                <p className="text-sm font-medium mt-1">
                  {referenceNo || "Not provided"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Weight
                </label>
                <p className="text-sm font-medium mt-1">
                  {actualWeight ? `${actualWeight} kg` : "Not provided"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Pickup Address
                </label>
                <p className="text-sm font-medium mt-1">
                  {pickupAddress || "Not provided"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Product Description
                </label>
                <p className="text-sm font-medium mt-1">
                  {productDescription || "Not provided"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Location */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="h-5 w-5" />
              <span>Delivery Location</span>
            </CardTitle>
            <CardDescription>
              Receiver and delivery address information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Receiver Name
                </label>
                <p className="text-sm font-medium mt-1">
                  {receiverName || "Not provided"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Phone Number
                </label>
                <p className="text-sm font-medium mt-1">
                  {phoneNumber || "Not provided"}
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Address
                </label>
                <p className="text-sm font-medium mt-1">
                  {address
                    ? `${address}, ${area}, ${city}, ${state} ${pincode}`
                    : "Not provided"}
                </p>
              </div>
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
            <CardDescription>Invoice and e-way bill details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Invoice Number
                </label>
                <p className="text-sm font-medium mt-1">
                  {invoiceNo || "Not provided"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Invoice Amount
                </label>
                <p className="text-sm font-medium mt-1">
                  {invoiceAmt ? `$${invoiceAmt}` : "Not provided"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Invoice Date
                </label>
                <p className="text-sm font-medium mt-1">
                  {invoiceDate || "Not provided"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Box Dimensions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Box className="h-5 w-5" />
              <span>Box Dimensions</span>
            </CardTitle>
            <CardDescription>
              Package dimensions and specifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {boxes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No boxes added</p>
            ) : (
              boxes.map((box, index) => (
                <div key={box.id} className="border rounded-lg p-4 space-y-4">
                  <h4 className="font-medium text-sm">Box {index + 1}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Length
                      </label>
                      <p className="text-sm font-medium mt-1">
                        {box.length ? `${box.length} cm` : "Not provided"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Width
                      </label>
                      <p className="text-sm font-medium mt-1">
                        {box.width ? `${box.width} cm` : "Not provided"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Height
                      </label>
                      <p className="text-sm font-medium mt-1">
                        {box.height ? `${box.height} cm` : "Not provided"}
                      </p>
                    </div>
                  </div>
                  {box.length && box.height && box.width && (
                    <div className="bg-gray-50 p-3 rounded text-sm">
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
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </CreateShipmentLayout>
  );
}
