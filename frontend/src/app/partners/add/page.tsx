"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Star, MapPin, DollarSign, Phone, Save } from "lucide-react";

interface PartnerFormData {
  name: string;
  type: string;
  status: string;
  rating: number;
  deliveryTime: string;
  coverage: string[];
  services: string[];
  baseRate: number;
  perKgRate: number;
  fuelSurcharge: number;
  email: string;
  phone: string;
  address: string;
  website: string;
}

const COVERAGE_OPTIONS = [
  "North India",
  "South India",
  "East India",
  "West India",
  "Central India",
  "Northeast India",
  "Himalayan Region",
  "Coastal Areas",
  "Metro Cities",
  "Tier 2 Cities",
];

const SERVICE_OPTIONS = [
  "Express Delivery",
  "Standard Delivery",
  "Same Day Delivery",
  "Next Day Delivery",
  "COD",
  "Prepaid",
  "Insurance",
  "Signature Required",
  "Fragile Handling",
  "Temperature Controlled",
];

export default function AddPartnerPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<PartnerFormData>({
    name: "",
    type: "",
    status: "pending",
    rating: 5,
    deliveryTime: "",
    coverage: [],
    services: [],
    baseRate: 0,
    perKgRate: 0,
    fuelSurcharge: 0,
    email: "",
    phone: "",
    address: "",
    website: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (
    field: keyof PartnerFormData,
    value: string | number | string[],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleCoverageToggle = (coverage: string) => {
    setFormData((prev) => ({
      ...prev,
      coverage: prev.coverage.includes(coverage)
        ? prev.coverage.filter((c) => c !== coverage)
        : [...prev.coverage, coverage],
    }));
  };

  const handleServiceToggle = (service: string) => {
    setFormData((prev) => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter((s) => s !== service)
        : [...prev.services, service],
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Partner name is required";
    if (!formData.type) newErrors.type = "Partner type is required";
    if (!formData.deliveryTime.trim())
      newErrors.deliveryTime = "Delivery time is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    if (!formData.phone.trim()) newErrors.phone = "Phone is required";
    if (!formData.address.trim()) newErrors.address = "Address is required";
    if (formData.coverage.length === 0)
      newErrors.coverage = "At least one coverage area is required";
    if (formData.services.length === 0)
      newErrors.services = "At least one service is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // In a real app, this would call an API

      // Redirect back to partners list
      router.push("/partners");
    } catch (error) {
      // Handle error appropriately in production
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push("/partners");
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          {/* <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Partners
          </Button> */}
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Add New Partner
            </h1>
            <p className="text-muted-foreground">
              Create a new courier partner for your logistics network
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Star className="h-5 w-5 text-blue-600" />
                  <span>Basic Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Partner Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        handleInputChange("name", e.target.value)
                      }
                      placeholder="Enter partner name"
                      className={errors.name ? "border-red-500" : ""}
                    />
                    {errors.name && (
                      <p className="text-sm text-red-500">{errors.name}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Partner Type *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) =>
                        handleInputChange("type", value)
                      }
                    >
                      <SelectTrigger
                        className={errors.type ? "border-red-500" : ""}
                      >
                        <SelectValue placeholder="Select partner type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="courier">Courier</SelectItem>
                        <SelectItem value="logistics">Logistics</SelectItem>
                        <SelectItem value="warehouse">Warehouse</SelectItem>
                        <SelectItem value="customs">Customs</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.type && (
                      <p className="text-sm text-red-500">{errors.type}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) =>
                        handleInputChange("status", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rating">Rating</Label>
                    <Select
                      value={formData.rating.toString()}
                      onValueChange={(value) =>
                        handleInputChange("rating", parseInt(value))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <SelectItem key={rating} value={rating.toString()}>
                            {rating} Star{rating !== 1 ? "s" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deliveryTime">Delivery Time *</Label>
                    <Input
                      id="deliveryTime"
                      value={formData.deliveryTime}
                      onChange={(e) =>
                        handleInputChange("deliveryTime", e.target.value)
                      }
                      placeholder="e.g., 2-3 business days"
                      className={errors.deliveryTime ? "border-red-500" : ""}
                    />
                    {errors.deliveryTime && (
                      <p className="text-sm text-red-500">
                        {errors.deliveryTime}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Coverage & Services */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5 text-green-600" />
                  <span>Coverage & Services</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>Coverage Areas *</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {COVERAGE_OPTIONS.map((coverage) => (
                      <Badge
                        key={coverage}
                        variant={
                          formData.coverage.includes(coverage)
                            ? "default"
                            : "outline"
                        }
                        className={`cursor-pointer hover:bg-blue-50 ${
                          formData.coverage.includes(coverage)
                            ? "bg-blue-600"
                            : ""
                        }`}
                        onClick={() => handleCoverageToggle(coverage)}
                      >
                        {coverage}
                      </Badge>
                    ))}
                  </div>
                  {errors.coverage && (
                    <p className="text-sm text-red-500">{errors.coverage}</p>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Services Offered *</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {SERVICE_OPTIONS.map((service) => (
                      <Badge
                        key={service}
                        variant={
                          formData.services.includes(service)
                            ? "default"
                            : "outline"
                        }
                        className={`cursor-pointer hover:bg-green-50 ${
                          formData.services.includes(service)
                            ? "bg-green-600"
                            : ""
                        }`}
                        onClick={() => handleServiceToggle(service)}
                      >
                        {service}
                      </Badge>
                    ))}
                  </div>
                  {errors.services && (
                    <p className="text-sm text-red-500">{errors.services}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5 text-yellow-600" />
                  <span>Pricing Structure</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="baseRate">Base Rate (₹)</Label>
                    <Input
                      id="baseRate"
                      type="number"
                      value={formData.baseRate}
                      onChange={(e) =>
                        handleInputChange(
                          "baseRate",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="perKgRate">Per KG Rate (₹)</Label>
                    <Input
                      id="perKgRate"
                      type="number"
                      value={formData.perKgRate}
                      onChange={(e) =>
                        handleInputChange(
                          "perKgRate",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fuelSurcharge">Fuel Surcharge (%)</Label>
                    <Input
                      id="fuelSurcharge"
                      type="number"
                      value={formData.fuelSurcharge}
                      onChange={(e) =>
                        handleInputChange(
                          "fuelSurcharge",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Phone className="h-5 w-5 text-purple-600" />
                  <span>Contact Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        handleInputChange("email", e.target.value)
                      }
                      placeholder="partner@example.com"
                      className={errors.email ? "border-red-500" : ""}
                    />
                    {errors.email && (
                      <p className="text-sm text-red-500">{errors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        handleInputChange("phone", e.target.value)
                      }
                      placeholder="+91 98765 43210"
                      className={errors.phone ? "border-red-500" : ""}
                    />
                    {errors.phone && (
                      <p className="text-sm text-red-500">{errors.phone}</p>
                    )}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Address *</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) =>
                        handleInputChange("address", e.target.value)
                      }
                      placeholder="Enter complete address"
                      rows={3}
                      className={errors.address ? "border-red-500" : ""}
                    />
                    {errors.address && (
                      <p className="text-sm text-red-500">{errors.address}</p>
                    )}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={formData.website}
                      onChange={(e) =>
                        handleInputChange("website", e.target.value)
                      }
                      placeholder="https://partner-website.com"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Form Actions */}
            <div className="flex items-center justify-end space-x-4 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Adding Partner...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Add Partner
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
