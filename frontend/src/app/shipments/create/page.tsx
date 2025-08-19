"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Package,
  ArrowLeft,
  Save,
  Send,
  MapPin,
  User,
  CreditCard,
  Calendar,
  Truck,
  Weight,
  FileText,
  Upload,
  Plus,
  Trash2,
} from "lucide-react";

interface BoxDimension {
  id: string;
  length: string;
  height: string;
  width: string;
}

interface ShipmentFormData {
  // Docket Information
  referenceNo: string;
  actualWeight: string;
  pickupAddress: string;
  productDescription: string;

  // Delivery Location Information
  phoneNumber: string;
  alternatePhone: string;
  email: string;
  receiverName: string;
  address: string;
  landmark: string;
  pincode: string;
  area: string;
  city: string;
  state: string;

  // Invoices
  eWayBillNo: string;
  invoiceNo: string;
  invoiceAmt: string;
  invoiceDate: string;
  attachment: File | null;

  // Dimensions
  boxes: BoxDimension[];
}

export default function CreateShipmentPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Shipments", href: "/shipments" },
    { title: "Create Shipment" },
  ];

  const [formData, setFormData] = useState<ShipmentFormData>({
    referenceNo: "",
    actualWeight: "",
    pickupAddress: "",
    productDescription: "",
    phoneNumber: "",
    alternatePhone: "",
    email: "",
    receiverName: "",
    address: "",
    landmark: "",
    pincode: "",
    area: "",
    city: "",
    state: "",
    eWayBillNo: "",
    invoiceNo: "",
    invoiceAmt: "",
    invoiceDate: "",
    attachment: null,
    boxes: [
      {
        id: "box-1",
        length: "",
        height: "",
        width: "",
      },
    ],
  });

  const handleInputChange = (field: keyof ShipmentFormData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData((prev) => ({
      ...prev,
      attachment: file,
    }));
  };

  const handleBoxDimensionChange = (
    boxId: string,
    field: keyof BoxDimension,
    value: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      boxes: prev.boxes.map((box) =>
        box.id === boxId ? { ...box, [field]: value } : box,
      ),
    }));
  };

  const addNewBox = () => {
    const newBoxId = `box-${formData.boxes.length + 1}`;
    setFormData((prev) => ({
      ...prev,
      boxes: [
        ...prev.boxes,
        {
          id: newBoxId,
          length: "",
          height: "",
          width: "",
        },
      ],
    }));
  };

  const removeBox = (boxId: string) => {
    if (formData.boxes.length > 1) {
      setFormData((prev) => ({
        ...prev,
        boxes: prev.boxes.filter((box) => box.id !== boxId),
      }));
    }
  };

  const handleSubmit = async (action: "save" | "create" | "resetForm") => {
    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    if (action === "create") {
      // Generate tracking number and redirect to shipments page
      console.log("Creating shipment:", formData);
      router.push("/shipments?created=true");
    } else if (action === "save") {
      // Save as draft
      console.log("Saving draft:", formData);
    } else if (action === "resetForm") {
      // Reset form
      console.log("Resetting form:", formData);
    }

    setIsSubmitting(false);
  };

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button> */}
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
                <Package className="h-8 w-8 text-logistics-600" />
                <span>Create New Shipment</span>
              </h1>
              <p className="text-muted-foreground mt-2">
                Fill in the details below to create a new shipment
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={() => handleSubmit("resetForm")}
              disabled={isSubmitting}
            >
              <Save className="h-4 w-4 mr-2" />
              Reset Form
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSubmit("save")}
              disabled={isSubmitting}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button
              onClick={() => handleSubmit("create")}
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="h-4 w-4 mr-2" />
              {isSubmitting ? "Creating..." : "Create Shipment"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Docket Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Docket Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="referenceNo">Reference No*</Label>
                  <Input
                    id="referenceNo"
                    placeholder="250810021T1582"
                    value={formData.referenceNo}
                    onChange={(e) =>
                      handleInputChange("referenceNo", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="actualWeight">Actual Weight(Kg)*</Label>
                  <Input
                    id="actualWeight"
                    placeholder="Actual Weight"
                    value={formData.actualWeight}
                    onChange={(e) =>
                      handleInputChange("actualWeight", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pickupAddress">Select Pickup Address*</Label>
                <Select
                  value={formData.pickupAddress}
                  onValueChange={(value) =>
                    handleInputChange("pickupAddress", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="StartUP-Sample-5005/110032" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="startup-Sample-5005">
                      StartUP-Sample-5005/110032
                    </SelectItem>
                    <SelectItem value="warehouse-mumbai">
                      Warehouse Mumbai
                    </SelectItem>
                    <SelectItem value="warehouse-delhi">
                      Warehouse Delhi
                    </SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground mt-1">
                  <div className="font-medium">
                    Warehouse: StartUP-Sample-5005
                  </div>
                  <div>Delhi, Delhi, 110032</div>
                  <div>110032 | west gorakh park gali no-3 shahdara</div>
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <input
                    type="checkbox"
                    id="rtoAddress"
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="rtoAddress" className="text-sm">
                    RTO address same as pickup address.
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="productDescription">Product Description*</Label>
                <Textarea
                  id="productDescription"
                  placeholder="Enter Product Description"
                  value={formData.productDescription}
                  onChange={(e) =>
                    handleInputChange("productDescription", e.target.value)
                  }
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Delivery Location Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="h-5 w-5" />
                <span>Delivery Location Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number*</Label>
                  <Input
                    id="phoneNumber"
                    placeholder="Phone Number"
                    value={formData.phoneNumber}
                    onChange={(e) =>
                      handleInputChange("phoneNumber", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alternatePhone">Alternate Phone No</Label>
                  <Input
                    id="alternatePhone"
                    placeholder="Alternate Phone"
                    value={formData.alternatePhone}
                    onChange={(e) =>
                      handleInputChange("alternatePhone", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="receiverName">Receiver Name*</Label>
                <Input
                  id="receiverName"
                  placeholder="Receiver Name"
                  value={formData.receiverName}
                  onChange={(e) =>
                    handleInputChange("receiverName", e.target.value)
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Address*</Label>
                  <Textarea
                    id="address"
                    placeholder="Address"
                    value={formData.address}
                    onChange={(e) =>
                      handleInputChange("address", e.target.value)
                    }
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="landmark">Landmark</Label>
                  <Input
                    id="landmark"
                    placeholder="Landmark"
                    value={formData.landmark}
                    onChange={(e) =>
                      handleInputChange("landmark", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode*</Label>
                  <Input
                    id="pincode"
                    placeholder="Pincode"
                    value={formData.pincode}
                    onChange={(e) =>
                      handleInputChange("pincode", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="area">Area*</Label>
                  <Input
                    id="area"
                    placeholder="Area"
                    value={formData.area}
                    onChange={(e) => handleInputChange("area", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City*</Label>
                  <Input
                    id="city"
                    placeholder="City Name"
                    value={formData.city}
                    onChange={(e) => handleInputChange("city", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State*</Label>
                  <Input
                    id="state"
                    placeholder="State"
                    value={formData.state}
                    onChange={(e) => handleInputChange("state", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Invoices */}
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
                    value={formData.eWayBillNo}
                    onChange={(e) =>
                      handleInputChange("eWayBillNo", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoiceNo">Invoice No.*</Label>
                  <Input
                    id="invoiceNo"
                    placeholder="520875"
                    value={formData.invoiceNo}
                    onChange={(e) =>
                      handleInputChange("invoiceNo", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoiceAmt">Invoice Amt*</Label>
                  <Input
                    id="invoiceAmt"
                    placeholder="Invoice Amount"
                    value={formData.invoiceAmt}
                    onChange={(e) =>
                      handleInputChange("invoiceAmt", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoiceDate">Invoice Date*</Label>
                  <Input
                    id="invoiceDate"
                    type="date"
                    placeholder="16-06-2025"
                    value={formData.invoiceDate}
                    onChange={(e) =>
                      handleInputChange("invoiceDate", e.target.value)
                    }
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
                    onClick={() =>
                      document.getElementById("attachment")?.click()
                    }
                    className="flex items-center space-x-2"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Choose File</span>
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {formData.attachment
                      ? formData.attachment.name
                      : "No file chosen"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dimensions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <span>Dimensions</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addNewBox}
                  className="flex items-center space-x-1"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Box</span>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>No. of Boxes: {formData.boxes.length}</Label>
                <div className="text-sm text-muted-foreground">
                  Total boxes in this shipment
                </div>
              </div>

              {formData.boxes.map((box, index) => (
                <div key={box.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Box {index + 1}</h4>
                    {formData.boxes.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeBox(box.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`length-${box.id}`}>Length(Cm)*</Label>
                      <Input
                        id={`length-${box.id}`}
                        placeholder="10"
                        value={box.length}
                        onChange={(e) =>
                          handleBoxDimensionChange(
                            box.id,
                            "length",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`height-${box.id}`}>Height(Cm)*</Label>
                      <Input
                        id={`height-${box.id}`}
                        placeholder="9"
                        value={box.height}
                        onChange={(e) =>
                          handleBoxDimensionChange(
                            box.id,
                            "height",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`width-${box.id}`}>Width(Cm)*</Label>
                      <Input
                        id={`width-${box.id}`}
                        placeholder="10"
                        value={box.width}
                        onChange={(e) =>
                          handleBoxDimensionChange(
                            box.id,
                            "width",
                            e.target.value,
                          )
                        }
                      />
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
              ))}

              {/* <div className="mt-6 pt-6 border-t">
                <Button 
                  onClick={() => handleSubmit('create')}
                  disabled={isSubmitting}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Creating Shipment...' : 'Create Shipment'}
                </Button>
              </div> */}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
