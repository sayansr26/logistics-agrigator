"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/ui/form-error";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useShipmentFormStore } from "@/store/shipment-form-store";
import { CreateShipmentLayout } from "@/components/shipments/create/layout.jsx";
import {
  Package,
  FileText,
  Plus,
  Trash2,
  User,
  Building,
  MapPin,
  Truck,
  Calculator,
  Info,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Weight,
  Ruler,
  Globe,
  Phone,
  Mail,
  Home,
  RefreshCcw,
  Save,
} from "lucide-react";

export default function CreateShipmentPage() {
  const [isClient, setIsClient] = useState(false);
  const [activeSection, setActiveSection] = useState("docket");
  const {
    formData,
    invoices,
    setField,
    addInvoice,
    removeInvoice,
    updateInvoice,
    errors,
  } = useShipmentFormStore();

  const {
    referenceNo,
    actualWeight,
    pickupAddress,
    productDescription,
    length,
    width,
    height,
    volumetricWeight,
    packageType,
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
    isRTO,
    returnAddress,
    returnPincode,
    returnCity,
    returnState,
  } = formData;

  // Debug logging for stepper
  useEffect(() => {
    console.log("Stepper Debug:", {
      referenceNo,
      pickupAddress,
      productDescription,
      actualWeight,
      receiverName,
      address,
      pincode,
      city,
      state,
      invoicesLength: invoices.length,
    });
  }, [
    referenceNo,
    pickupAddress,
    productDescription,
    actualWeight,
    receiverName,
    address,
    pincode,
    city,
    state,
    invoices.length,
  ]);

  const [customReturnAddress, setCustomReturnAddress] = useState("");

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const submissionData = {
        ...formData,
        returnAddress:
          returnAddress === "custom" ? customReturnAddress : returnAddress,
      };

      console.log("Form data:", submissionData);
      console.log("Invoices:", invoices);

      if (
        !referenceNo ||
        !actualWeight ||
        !pickupAddress ||
        !productDescription
      ) {
        console.error("Required fields missing");
        return;
      }

      if (!isRTO) {
        if (
          !returnAddress ||
          (returnAddress === "custom" && !customReturnAddress)
        ) {
          console.error("Return address is required when RTO is unchecked");
          return;
        }
        if (!returnPincode || !returnCity || !returnState) {
          console.error(
            "Return address details are required when RTO is unchecked",
          );
          return;
        }
      }
    } catch (error) {
      console.error("Form submission failed:", error);
    }
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

  // Enhanced stepper logic with better completion detection
  const sections = [
    {
      id: "docket",
      label: "Docket Info",
      icon: Package,
      completed: !!(
        referenceNo &&
        pickupAddress &&
        productDescription &&
        actualWeight
      ),
      requiredFields: [
        "referenceNo",
        "pickupAddress",
        "productDescription",
        "actualWeight",
      ],
      completedFields: [
        referenceNo,
        pickupAddress,
        productDescription,
        actualWeight,
      ].filter(Boolean).length,
    },
    {
      id: "delivery",
      label: "Delivery Details",
      icon: User,
      completed: !!(receiverName && address && pincode && city && state),
      requiredFields: ["receiverName", "address", "pincode", "city", "state"],
      completedFields: [receiverName, address, pincode, city, state].filter(
        Boolean,
      ).length,
    },
    {
      id: "invoices",
      label: "Invoices",
      icon: FileText,
      completed: invoices.length > 0,
      requiredFields: ["invoices"],
      completedFields: invoices.length,
    },
  ];

  // Debug logging for sections
  useEffect(() => {
    console.log(
      "Sections Debug:",
      sections.map((section) => ({
        id: section.id,
        completed: section.completed,
        completedFields: section.completedFields,
        requiredFields: section.requiredFields.length,
      })),
    );
  }, [sections]);

  // Calculate overall progress
  const totalRequiredFields = sections.reduce(
    (sum, section) => sum + section.requiredFields.length,
    0,
  );
  const totalCompletedFields = sections.reduce(
    (sum, section) => sum + section.completedFields,
    0,
  );
  const progressPercentage =
    totalRequiredFields > 0
      ? Math.round((totalCompletedFields / totalRequiredFields) * 100)
      : 0;

  if (!isClient) {
    return null;
  }

  return (
    <CreateShipmentLayout>
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Enhanced Progress Indicator */}
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Shipment Progress
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Complete all required fields to create your shipment
              </p>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="text-sm mb-2">
                {sections.filter((s) => s.completed).length} of{" "}
                {sections.length} Complete
              </Badge>
              <div className="text-xs text-gray-500">
                Overall: {progressPercentage}% Complete
              </div>
            </div>
          </div>

          {/* Quick Navigation */}
          <div className="flex items-center space-x-2 mb-4">
            <span className="text-sm text-gray-600">Quick Jump:</span>
            {sections.map((section) => (
              <Button
                key={section.id}
                variant={activeSection === section.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveSection(section.id)}
                className={`text-xs ${
                  activeSection === section.id
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "hover:bg-gray-50"
                }`}
              >
                {section.icon && <section.icon className="h-3 w-3 mr-1" />}
                {section.label}
                {section.completed && (
                  <CheckCircle2 className="h-3 w-3 ml-1 text-green-500" />
                )}
              </Button>
            ))}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
            <div
              className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>

          <div className="flex items-center space-x-4">
            {sections.map((section, index) => (
              <React.Fragment key={section.id}>
                <div
                  className={`flex flex-col items-center space-y-2 cursor-pointer transition-all duration-200 ${
                    activeSection === section.id ? "scale-110" : ""
                  }`}
                  onClick={() => setActiveSection(section.id)}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-200 relative ${
                      section.completed
                        ? "bg-green-100 border-green-500 text-green-600"
                        : "bg-gray-50 border-gray-300 text-gray-400"
                    }`}
                  >
                    {section.completed ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <section.icon className="w-6 h-6" />
                    )}
                    {/* Progress indicator for partially completed sections */}
                    {!section.completed && section.completedFields > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-xs text-white font-bold">
                          {section.completedFields}
                        </span>
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium text-center ${
                      section.completed ? "text-green-600" : "text-gray-500"
                    }`}
                  >
                    {section.label}
                  </span>
                  {/* Field count indicator */}
                  <div className="text-xs text-gray-400 text-center">
                    {section.completedFields}/
                    {section.requiredFields.length === 1
                      ? "1"
                      : section.requiredFields.length}{" "}
                    fields
                  </div>
                  {/* Debug info in development */}
                  {process.env.NODE_ENV === "development" && (
                    <div className="text-xs text-gray-300 text-center">
                      {section.completed ? "✓" : "○"}
                    </div>
                  )}
                </div>
                {index < sections.length - 1 && (
                  <div className="flex-1 h-0.5 bg-gray-200 relative">
                    {section.completed && (
                      <div className="absolute inset-0 bg-green-500 transition-all duration-500"></div>
                    )}
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Docket Information Section */}
        <Card
          className={`transition-all duration-300 ${
            activeSection === "docket"
              ? "ring-2 ring-blue-500 shadow-lg scale-[1.02]"
              : ""
          }`}
        >
          {/* Active Section Indicator */}
          {activeSection === "docket" && (
            <div className="absolute -top-3 left-6 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
              Active Section
            </div>
          )}
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <CardTitle className="flex items-center space-x-3 text-blue-900">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <span className="text-xl">Docket Information</span>
                <p className="text-sm font-normal text-blue-700 mt-1">
                  Basic shipment details and package information
                </p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Reference and Weight Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label
                  htmlFor="referenceNo"
                  className="text-sm font-semibold text-gray-700 flex items-center space-x-2"
                >
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span>Reference Number *</span>
                </label>
                <Input
                  id="referenceNo"
                  placeholder="e.g., 250810021T1582"
                  value={referenceNo}
                  onChange={(e) => setField("referenceNo", e.target.value)}
                  className={`h-11 text-base ${errors.referenceNo ? "border-red-500 ring-red-200" : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"}`}
                />
                <FormError message={errors.referenceNo} />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="actualWeight"
                  className="text-sm font-semibold text-gray-700 flex items-center space-x-2"
                >
                  <Weight className="h-4 w-4 text-green-500" />
                  <span>Actual Weight (kg) *</span>
                </label>
                <Input
                  id="actualWeight"
                  type="number"
                  step="0.01"
                  placeholder="0.5"
                  value={actualWeight}
                  onChange={(e) => setField("actualWeight", e.target.value)}
                  className={`h-11 text-base ${errors.actualWeight ? "border-red-500 ring-red-200" : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"}`}
                />
                <FormError message={errors.actualWeight} />
              </div>
            </div>

            {/* Pickup Address Selection */}
            <div className="space-y-3">
              <label
                htmlFor="pickupAddress"
                className="text-sm font-semibold text-gray-700 flex items-center space-x-2"
              >
                <Building className="h-4 w-4 text-purple-500" />
                <span>Pickup Address *</span>
              </label>
              <select
                id="pickupAddress"
                value={pickupAddress}
                onChange={(e) => setField("pickupAddress", e.target.value)}
                className={`flex h-11 w-full items-center justify-between rounded-lg border bg-background px-4 py-2 text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                  errors.pickupAddress
                    ? "border-red-500 focus:ring-red-200"
                    : "border-gray-300 focus:ring-blue-200 focus:border-blue-500"
                }`}
              >
                <option value="">Select pickup address</option>
                {pickupAddresses.map((addr) => (
                  <option key={addr.value} value={addr.value}>
                    {addr.label}
                  </option>
                ))}
              </select>
              <FormError message={errors.pickupAddress} />

              {selectedPickup && (
                <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                  <div className="flex items-start space-x-3">
                    <Building className="h-5 w-5 text-purple-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-semibold text-purple-900">
                        {selectedPickup.details.warehouse}
                      </div>
                      <div className="text-sm text-purple-700 mt-1">
                        {selectedPickup.details.address}
                      </div>
                      <div className="text-xs text-purple-600 mt-1 font-mono">
                        {selectedPickup.details.fullAddress}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Product Description */}
            <div className="space-y-3">
              <label
                htmlFor="productDescription"
                className="text-sm font-semibold text-gray-700 flex items-center space-x-2"
              >
                <Package className="h-4 w-4 text-orange-500" />
                <span>Product Description *</span>
              </label>
              <Textarea
                id="productDescription"
                placeholder="Describe the contents of your package in detail..."
                value={productDescription}
                onChange={(e) => setField("productDescription", e.target.value)}
                className={`min-h-[80px] text-base resize-none ${errors.productDescription ? "border-red-500 ring-red-200" : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"}`}
                rows={3}
              />
              <FormError message={errors.productDescription} />
            </div>

            {/* Package Dimensions */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3 pb-2">
                <Ruler className="h-5 w-5 text-indigo-600" />
                <h3 className="font-semibold text-gray-900">
                  Package Dimensions
                </h3>
                <Badge variant="secondary" className="text-xs">
                  Required for accurate pricing
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    id: "length",
                    label: "Length",
                    placeholder: "10.0",
                    icon: "↔️",
                  },
                  {
                    id: "width",
                    label: "Width",
                    placeholder: "10.0",
                    icon: "↕️",
                  },
                  {
                    id: "height",
                    label: "Height",
                    placeholder: "10.0",
                    icon: "↗️",
                  },
                ].map((dim) => (
                  <div key={dim.id} className="space-y-2">
                    <label
                      htmlFor={dim.id}
                      className="text-sm font-medium text-gray-700 flex items-center space-x-2"
                    >
                      <span>{dim.icon}</span>
                      <span>{dim.label} (cm) *</span>
                    </label>
                    <Input
                      id={dim.id}
                      type="number"
                      step="0.1"
                      placeholder={dim.placeholder}
                      value={formData[dim.id]}
                      onChange={(e) => setField(dim.id, e.target.value)}
                      className={`h-11 text-base ${errors[dim.id] ? "border-red-500 ring-red-200" : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"}`}
                    />
                    <FormError message={errors[dim.id]} />
                  </div>
                ))}
              </div>
            </div>

            {/* RTO Option */}
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="isRTO"
                      checked={isRTO}
                      onChange={(e) => setField("isRTO", e.target.checked)}
                      className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    <label
                      htmlFor="isRTO"
                      className="text-sm font-semibold text-amber-900"
                    >
                      RTO address same as pickup address
                    </label>
                  </div>
                  <div className="text-xs text-amber-700 mt-2">
                    {isRTO
                      ? "✅ Return address will use pickup location"
                      : "⚠️ Return address must be specified separately"}
                  </div>
                </div>
              </div>
            </div>

            {/* Return Address Section */}
            {!isRTO && (
              <div className="space-y-4 p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center space-x-3">
                  <Building className="h-5 w-5 text-red-600" />
                  <h3 className="font-semibold text-red-900">
                    Return Address (RTO)
                  </h3>
                  <Badge variant="destructive" className="text-xs">
                    Required
                  </Badge>
                </div>

                <div className="space-y-3">
                  <label
                    htmlFor="returnAddress"
                    className="text-sm font-medium text-red-900"
                  >
                    Return Address *
                  </label>
                  <select
                    id="returnAddress"
                    value={returnAddress}
                    onChange={(e) => {
                      const selectedValue = e.target.value;
                      setField("returnAddress", selectedValue);

                      if (selectedValue === "warehouse-delhi") {
                        setField("returnPincode", "110001");
                        setField("returnCity", "Delhi");
                        setField("returnState", "Delhi");
                      } else if (selectedValue === "warehouse-mumbai") {
                        setField("returnPincode", "400001");
                        setField("returnCity", "Mumbai");
                        setField("returnState", "Maharashtra");
                      } else if (selectedValue === "warehouse-bangalore") {
                        setField("returnPincode", "560001");
                        setField("returnCity", "Bangalore");
                        setField("returnState", "Karnataka");
                      } else if (selectedValue === "warehouse-chennai") {
                        setField("returnPincode", "600001");
                        setField("returnCity", "Chennai");
                        setField("returnState", "Tamil Nadu");
                      } else if (selectedValue === "custom") {
                        setField("returnPincode", "");
                        setField("returnCity", "");
                        setField("returnState", "");
                        setCustomReturnAddress("");
                      }
                    }}
                    className="flex h-11 w-full items-center justify-between rounded-lg border border-red-300 bg-background px-4 py-2 text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-2"
                  >
                    <option value="">Select return address</option>
                    <option value="warehouse-delhi">
                      Warehouse Delhi - 110001 | Connaught Place, Delhi
                    </option>
                    <option value="warehouse-mumbai">
                      Warehouse Mumbai - 400001 | Andheri West, Mumbai
                    </option>
                    <option value="warehouse-bangalore">
                      Warehouse Bangalore - 560001 | MG Road, Bangalore
                    </option>
                    <option value="warehouse-chennai">
                      Warehouse Chennai - 600001 | T Nagar, Chennai
                    </option>
                    <option value="custom">Custom Address</option>
                  </select>
                  <FormError message={errors.returnAddress} />
                </div>

                {returnAddress === "custom" && (
                  <div className="space-y-3">
                    <label
                      htmlFor="customReturnAddress"
                      className="text-sm font-medium text-red-900"
                    >
                      Custom Return Address
                    </label>
                    <Textarea
                      id="customReturnAddress"
                      placeholder="Enter complete custom return address..."
                      value={customReturnAddress}
                      onChange={(e) => setCustomReturnAddress(e.target.value)}
                      className="min-h-[80px] text-base resize-none border-red-300 focus:border-red-500 focus:ring-red-200"
                      rows={3}
                    />
                    <FormError message={errors.returnAddress} />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery Information Section */}
        <Card
          className={`transition-all duration-300 ${
            activeSection === "delivery"
              ? "ring-2 ring-blue-500 shadow-lg scale-[1.02]"
              : ""
          }`}
        >
          {/* Active Section Indicator */}
          {activeSection === "delivery" && (
            <div className="absolute -top-3 left-6 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
              Active Section
            </div>
          )}
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
            <CardTitle className="flex items-center space-x-3 text-green-900">
              <div className="p-2 bg-green-100 rounded-lg">
                <User className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <span className="text-xl">Delivery Information</span>
                <p className="text-sm font-normal text-green-700 mt-1">
                  Recipient details and delivery address
                </p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Recipient Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <User className="h-5 w-5 text-green-600" />
                <span>Recipient Details</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label
                    htmlFor="receiverName"
                    className="text-sm font-semibold text-gray-700 flex items-center space-x-2"
                  >
                    <User className="h-4 w-4 text-green-500" />
                    <span>Receiver Name *</span>
                  </label>
                  <Input
                    id="receiverName"
                    placeholder="Enter receiver's full name"
                    value={receiverName}
                    onChange={(e) => setField("receiverName", e.target.value)}
                    className={`h-11 text-base ${errors.receiverName ? "border-red-500 ring-red-200" : "border-gray-300 focus:border-green-500 focus:ring-green-200"}`}
                  />
                  <FormError message={errors.receiverName} />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="phoneNumber"
                    className="text-sm font-semibold text-gray-700 flex items-center space-x-2"
                  >
                    <Phone className="h-4 w-4 text-green-500" />
                    <span>Phone Number *</span>
                  </label>
                  <Input
                    id="phoneNumber"
                    placeholder="+91 98765 43210"
                    value={phoneNumber}
                    onChange={(e) => setField("phoneNumber", e.target.value)}
                    className={`h-11 text-base ${errors.phoneNumber ? "border-red-500 ring-red-200" : "border-gray-300 focus:border-green-500 focus:ring-green-200"}`}
                  />
                  <FormError message={errors.phoneNumber} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label
                    htmlFor="alternatePhone"
                    className="text-sm font-medium text-gray-700 flex items-center space-x-2"
                  >
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span>Alternate Phone</span>
                  </label>
                  <Input
                    id="alternatePhone"
                    placeholder="+91 98765 43211"
                    value={alternatePhone}
                    onChange={(e) => setField("alternatePhone", e.target.value)}
                    className="h-11 text-base border-gray-300 focus:border-green-500 focus:ring-green-200"
                  />
                  <FormError message={errors.alternatePhone} />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="text-sm font-medium text-gray-700 flex items-center space-x-2"
                  >
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span>Email Address</span>
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="receiver@example.com"
                    value={email}
                    onChange={(e) => setField("email", e.target.value)}
                    className="h-11 text-base border-gray-300 focus:border-green-500 focus:ring-green-200"
                  />
                  <FormError message={errors.email} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Delivery Address */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-green-600" />
                <span>Delivery Address</span>
              </h3>

              <div className="space-y-3">
                <label
                  htmlFor="address"
                  className="text-sm font-semibold text-gray-700 flex items-center space-x-2"
                >
                  <Home className="h-4 w-4 text-green-500" />
                  <span>Complete Address *</span>
                </label>
                <Textarea
                  id="address"
                  placeholder="Enter complete delivery address including street, building, etc."
                  value={address}
                  onChange={(e) => setField("address", e.target.value)}
                  className={`min-h-[80px] text-base resize-none ${errors.address ? "border-red-500 ring-red-200" : "border-gray-300 focus:border-green-500 focus:ring-green-200"}`}
                  rows={3}
                />
                <FormError message={errors.address} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label
                    htmlFor="landmark"
                    className="text-sm font-medium text-gray-700"
                  >
                    Landmark
                  </label>
                  <Input
                    id="landmark"
                    placeholder="Near landmark"
                    value={landmark}
                    onChange={(e) => setField("landmark", e.target.value)}
                    className="h-11 text-base border-gray-300 focus:border-green-500 focus:ring-green-200"
                  />
                  <FormError message={errors.landmark} />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="pincode"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Pincode *
                  </label>
                  <Input
                    id="pincode"
                    placeholder="110001"
                    value={pincode}
                    onChange={(e) => setField("pincode", e.target.value)}
                    className={`h-11 text-base ${errors.pincode ? "border-red-500 ring-red-200" : "border-gray-300 focus:border-green-500 focus:ring-green-200"}`}
                  />
                  <FormError message={errors.pincode} />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="area"
                    className="text-sm font-medium text-gray-700"
                  >
                    Area
                  </label>
                  <Input
                    id="area"
                    placeholder="Area name"
                    value={area}
                    onChange={(e) => setField("area", e.target.value)}
                    className="h-11 text-base border-gray-300 focus:border-green-500 focus:ring-green-200"
                  />
                  <FormError message={errors.area} />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="city"
                    className="text-sm font-semibold text-gray-700"
                  >
                    City *
                  </label>
                  <Input
                    id="city"
                    placeholder="City name"
                    value={city}
                    onChange={(e) => setField("city", e.target.value)}
                    className={`h-11 text-base ${errors.city ? "border-red-500 ring-red-200" : "border-gray-300 focus:border-green-500 focus:ring-green-200"}`}
                  />
                  <FormError message={errors.city} />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="state"
                  className="text-sm font-semibold text-gray-700"
                >
                  State *
                </label>
                <Input
                  id="state"
                  placeholder="State name"
                  value={state}
                  onChange={(e) => setField("state", e.target.value)}
                  className={`h-11 text-base ${errors.state ? "border-red-500 ring-red-200" : "border-gray-300 focus:border-green-500 focus:ring-green-200"}`}
                />
                <FormError message={errors.state} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Details Section */}
        <Card
          className={`transition-all duration-300 ${
            activeSection === "invoices"
              ? "ring-2 ring-blue-500 shadow-lg scale-[1.02]"
              : ""
          }`}
        >
          {/* Active Section Indicator */}
          {activeSection === "invoices" && (
            <div className="absolute -top-3 left-6 bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-medium">
              Active Section
            </div>
          )}
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
            <CardTitle className="flex items-center space-x-3 text-purple-900">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <span className="text-xl">Invoice Details</span>
                <p className="text-sm font-normal text-purple-700 mt-1">
                  Commercial invoice information for customs
                </p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {invoices.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                  <FileText className="h-10 w-10 text-purple-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Invoices Added
                </h3>
                <p className="text-gray-500 mb-6">
                  Add invoice details to proceed with shipment creation
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addInvoice}
                  className="border-purple-300 text-purple-700 hover:bg-purple-50"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Invoice
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {invoices.map((invoice, index) => (
                  <div
                    key={invoice.id}
                    className="border-2 border-purple-200 rounded-xl p-6 bg-gradient-to-r from-purple-50 to-white"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-semibold text-purple-700">
                            {index + 1}
                          </span>
                        </div>
                        <h4 className="font-semibold text-purple-900">
                          Invoice #{index + 1}
                        </h4>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeInvoice(invoice.id)}
                        className="text-red-600 hover:text-red-700 border-red-300 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label
                          htmlFor={`invoiceNo-${invoice.id}`}
                          className="text-sm font-semibold text-gray-700"
                        >
                          Invoice Number *
                        </label>
                        <Input
                          id={`invoiceNo-${invoice.id}`}
                          placeholder="INV-2024-001"
                          value={invoice.invoiceNo}
                          onChange={(e) =>
                            updateInvoice(
                              invoice.id,
                              "invoiceNo",
                              e.target.value,
                            )
                          }
                          className="h-11 text-base border-purple-200 focus:border-purple-500 focus:ring-purple-200"
                        />
                      </div>

                      <div className="space-y-2">
                        <label
                          htmlFor={`invoiceDate-${invoice.id}`}
                          className="text-sm font-semibold text-gray-700"
                        >
                          Invoice Date *
                        </label>
                        <Input
                          id={`invoiceDate-${invoice.id}`}
                          type="date"
                          value={invoice.invoiceDate}
                          onChange={(e) =>
                            updateInvoice(
                              invoice.id,
                              "invoiceDate",
                              e.target.value,
                            )
                          }
                          className="h-11 text-base border-purple-200 focus:border-purple-500 focus:ring-purple-200"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="space-y-2">
                        <label
                          htmlFor={`invoiceAmt-${invoice.id}`}
                          className="text-sm font-semibold text-gray-700"
                        >
                          Invoice Amount *
                        </label>
                        <Input
                          id={`invoiceAmt-${invoice.id}`}
                          type="number"
                          step="0.01"
                          placeholder="1000.00"
                          value={invoice.invoiceAmt}
                          onChange={(e) =>
                            updateInvoice(
                              invoice.id,
                              "invoiceAmt",
                              e.target.value,
                            )
                          }
                          className="h-11 text-base border-purple-200 focus:border-purple-500 focus:ring-purple-200"
                        />
                      </div>

                      <div className="space-y-2">
                        <label
                          htmlFor={`eWayBillNo-${invoice.id}`}
                          className="text-sm font-medium text-gray-700"
                        >
                          E-Way Bill No
                        </label>
                        <Input
                          id={`eWayBillNo-${invoice.id}`}
                          placeholder="EWB123456789"
                          value={invoice.eWayBillNo}
                          onChange={(e) =>
                            updateInvoice(
                              invoice.id,
                              "eWayBillNo",
                              e.target.value,
                            )
                          }
                          className="h-11 text-base border-purple-200 focus:border-purple-500 focus:ring-purple-200"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label
                        htmlFor={`attachment-${invoice.id}`}
                        className="text-sm font-medium text-gray-700"
                      >
                        Invoice Attachment
                      </label>
                      <Input
                        id={`attachment-${invoice.id}`}
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          updateInvoice(invoice.id, "attachment", file);
                        }}
                        className="h-11 text-base border-purple-200 focus:border-purple-500 focus:ring-purple-200"
                      />
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addInvoice}
                  className="w-full h-12 text-base border-2 border-dashed border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-400"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add Another Invoice
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </CreateShipmentLayout>
  );
}
