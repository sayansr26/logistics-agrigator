"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import {
  ArrowLeft,
  Upload,
  AlertTriangle,
  HelpCircle,
  MessageSquare,
  User,
  Clock,
  FileText,
  Send,
  Save,
  Plus,
  CheckCircle,
} from "lucide-react";

// Import mock data
import { mockShipments, mockUsers, getPriorityColor } from "@/lib/mock-data.ts";

const initialFormData = {
  ticketType: "support",
  priority: "medium",
  category: "",
  subject: "",
  description: "",
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  customerAddress: "",
  trackingNumber: "",
  courierPartner: "",
  origin: "",
  destination: "",
  issueType: "",
  attachments: [],
  internalNotes: "",
  assignTo: "",
  estimatedResolution: "",
  notifyCustomer: true,
  notifyTeam: true,
  preferredContactMethod: "email",
};

// Enhanced ticket categories with descriptions
const ticketCategories = {
  support: [
    {
      value: "Technical Issue",
      label: "Technical Issue",
      description: "Software, API, or system problems",
    },
    {
      value: "Account Access",
      label: "Account Access",
      description: "Login, permissions, or account issues",
    },
    {
      value: "Billing & Payment",
      label: "Billing & Payment",
      description: "Invoices, charges, or payment problems",
    },
    {
      value: "Feature Request",
      label: "Feature Request",
      description: "New functionality suggestions",
    },
    {
      value: "General Inquiry",
      label: "General Inquiry",
      description: "General questions or information",
    },
    {
      value: "Training & Support",
      label: "Training & Support",
      description: "User training or documentation help",
    },
    {
      value: "Integration Help",
      label: "Integration Help",
      description: "Third-party platform integration",
    },
    {
      value: "Performance Issue",
      label: "Performance Issue",
      description: "Slow response times or system lag",
    },
  ],
  dispute: [
    {
      value: "Delivery Delay",
      label: "Delivery Delay",
      description: "Shipment arrived later than expected",
    },
    {
      value: "Package Damage",
      label: "Package Damage",
      description: "Items damaged during transit",
    },
    {
      value: "Wrong Address",
      label: "Wrong Address",
      description: "Delivered to incorrect location",
    },
    {
      value: "Missing Package",
      label: "Missing Package",
      description: "Package not received",
    },
    {
      value: "Billing Dispute",
      label: "Billing Dispute",
      description: "Incorrect charges or fees",
    },
    {
      value: "Service Quality",
      label: "Service Quality",
      description: "Poor delivery service experience",
    },
    {
      value: "Refund Request",
      label: "Refund Request",
      description: "Request for payment refund",
    },
    {
      value: "Courier Issue",
      label: "Courier Issue",
      description: "Problems with courier partner",
    },
  ],
};

// Enhanced issue types with descriptions
const issueTypes = [
  {
    value: "Late Delivery",
    label: "Late Delivery",
    description: "Shipment delayed beyond expected date",
  },
  {
    value: "Package Damaged",
    label: "Package Damaged",
    description: "Physical damage to package contents",
  },
  {
    value: "Wrong Address",
    label: "Wrong Address",
    description: "Delivered to incorrect address",
  },
  {
    value: "Package Lost",
    label: "Package Lost",
    description: "Shipment cannot be located",
  },
  {
    value: "Delivery Attempt Failed",
    label: "Delivery Attempt Failed",
    description: "Multiple delivery attempts unsuccessful",
  },
  {
    value: "Customs Issue",
    label: "Customs Issue",
    description: "Problems with customs clearance",
  },
  {
    value: "Billing Error",
    label: "Billing Error",
    description: "Incorrect charges or duplicate billing",
  },
  {
    value: "Service Not Available",
    label: "Service Not Available",
    description: "Requested service unavailable in area",
  },
  {
    value: "Other",
    label: "Other",
    description: "Other issues not listed above",
  },
];

// Enhanced courier partners with logos/colors
const courierPartners = [
  { value: "DTDC", label: "DTDC Express", color: "bg-blue-100 text-blue-800" },
  {
    value: "Blue Dart",
    label: "Blue Dart Express",
    color: "bg-blue-100 text-blue-800",
  },
  {
    value: "FedEx",
    label: "FedEx Express",
    color: "bg-purple-100 text-purple-800",
  },
  {
    value: "DHL",
    label: "DHL Express",
    color: "bg-yellow-100 text-yellow-800",
  },
  {
    value: "Amazon Logistics",
    label: "Amazon Logistics",
    color: "bg-orange-100 text-orange-800",
  },
  {
    value: "Delhivery",
    label: "Delhivery",
    color: "bg-green-100 text-green-800",
  },
  {
    value: "Ecom Express",
    label: "Ecom Express",
    color: "bg-red-100 text-red-800",
  },
  {
    value: "XpressBees",
    label: "XpressBees",
    color: "bg-indigo-100 text-indigo-800",
  },
  {
    value: "Shadowfax",
    label: "Shadowfax",
    color: "bg-gray-100 text-gray-800",
  },
  { value: "Other", label: "Other", color: "bg-gray-100 text-gray-800" },
];

// Enhanced team members with roles
const teamMembers = [
  {
    value: "Support Team",
    label: "Support Team",
    role: "General support inquiries",
  },
  {
    value: "Operations Team",
    label: "Operations Team",
    role: "Shipment and logistics issues",
  },
  {
    value: "Technical Team",
    label: "Technical Team",
    role: "Software and system problems",
  },
  {
    value: "Billing Team",
    label: "Billing Team",
    role: "Payment and invoice issues",
  },
  {
    value: "Senior Support",
    label: "Senior Support",
    role: "Complex or escalated cases",
  },
  { value: "Team Lead", label: "Team Lead", role: "Urgent or priority cases" },
];

// Enhanced resolution timelines
const resolutionTimelines = [
  { value: "1-2 hours", label: "1-2 hours", description: "Critical issues" },
  {
    value: "4-8 hours",
    label: "4-8 hours",
    description: "High priority issues",
  },
  {
    value: "1-2 days",
    label: "1-2 days",
    description: "Medium priority issues",
  },
  { value: "3-5 days", label: "3-5 days", description: "Standard issues" },
  { value: "1 week", label: "1 week", description: "Low priority issues" },
];

export default function NewTicketPage() {
  const router = useRouter();
  const [formData, setFormData] = useState(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [activeStep, setActiveStep] = useState(1);
  const [showDraftSaved, setShowDraftSaved] = useState(false);
  const [stepValidation, setStepValidation] = useState({
    step1: false,
    step2: false,
    step3: false,
  });

  // Load draft on component mount
  useEffect(() => {
    const savedDraft = localStorage.getItem("ticketDraft");
    if (savedDraft) {
      try {
        const parsedDraft = JSON.parse(savedDraft);
        setFormData(parsedDraft);
        validateStep(1, parsedDraft);
        validateStep(2, parsedDraft);
        validateStep(3, parsedDraft);
      } catch (error) {
        // Error loading draft - silently continue
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Support & Disputes", href: "/support" },
    { title: "New Ticket" },
  ];

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    // Validate current step when data changes
    validateStep(activeStep, { ...formData, [field]: value });
  };

  const validateStep = (step, data) => {
    const newStepValidation = { ...stepValidation };

    switch (step) {
      case 1:
        newStepValidation.step1 = !!(
          data.subject.trim() &&
          data.description.trim() &&
          data.description.trim().length >= 50
        );
        break;
      case 2:
        newStepValidation.step2 = !!(
          data.customerName.trim() && data.customerEmail.trim()
        );
        if (data.ticketType === "dispute") {
          newStepValidation.step2 =
            newStepValidation.step2 &&
            !!(
              data.trackingNumber.trim() &&
              data.courierPartner.trim() &&
              data.issueType.trim()
            );
        }
        break;
      case 3:
        newStepValidation.step3 = true; // Step 3 is always valid as it's optional
        break;
    }

    setStepValidation(newStepValidation);
  };

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files || []);
    setFormData((prev) => ({
      ...prev,
      attachments: [...prev.attachments, ...files],
    }));
  };

  const removeAttachment = (index) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    // Basic validation
    if (!formData.subject.trim()) newErrors.subject = "Subject is required";
    if (!formData.description.trim())
      newErrors.description = "Description is required";
    if (formData.description.trim().length < 50)
      newErrors.description = "Description must be at least 50 characters";
    if (!formData.customerName.trim())
      newErrors.customerName = "Customer name is required";
    if (!formData.customerEmail.trim())
      newErrors.customerEmail = "Customer email is required";

    // Email validation
    if (
      formData.customerEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customerEmail)
    ) {
      newErrors.customerEmail = "Invalid email format";
    }

    // Phone validation
    if (
      formData.customerPhone &&
      !/^[0-9+\-\s()]{10,15}$/.test(formData.customerPhone)
    ) {
      newErrors.customerPhone = "Invalid phone number";
    }

    // Dispute-specific validation
    if (formData.ticketType === "dispute") {
      if (!formData.trackingNumber.trim())
        newErrors.trackingNumber = "Tracking number is required";
      if (!formData.courierPartner.trim())
        newErrors.courierPartner = "Courier partner is required";
      if (!formData.issueType.trim())
        newErrors.issueType = "Issue type is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Clear draft after successful submission
      localStorage.removeItem("ticketDraft");

      // Success - redirect to support page
      router.push("/support");
    } catch (error) {
      // Error creating ticket - silently handle
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = () => {
    // Save form data to localStorage or state management
    localStorage.setItem("ticketDraft", JSON.stringify(formData));
    setShowDraftSaved(true);
    // Hide notification after 3 seconds
    setTimeout(() => setShowDraftSaved(false), 3000);
  };

  const handleStepChange = (newStep) => {
    if (newStep > activeStep) {
      // Validate current step before proceeding
      if (activeStep === 1 && !stepValidation.step1) {
        validateStep(1, formData);
        return;
      }
      if (activeStep === 2 && !stepValidation.step2) {
        validateStep(2, formData);
        return;
      }
    }
    setActiveStep(newStep);
  };

  const getStepStatus = (step) => {
    if (step < activeStep) return "completed";
    if (step === activeStep) return "active";
    return "pending";
  };

  const getStepValidationStatus = (step) => {
    switch (step) {
      case 1:
        return stepValidation.step1;
      case 2:
        return stepValidation.step2;
      case 3:
        return stepValidation.step3;
      default:
        return false;
    }
  };

  // Auto-fill customer data from mock data if available
  const handleCustomerSearch = (searchTerm) => {
    const customer = mockUsers.find(
      (user) =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    if (customer) {
      setFormData((prev) => ({
        ...prev,
        customerName: customer.name,
        customerEmail: customer.email,
      }));
    }
  };

  // Auto-fill shipment data from mock data if available
  const handleTrackingSearch = (trackingNumber) => {
    const shipment = mockShipments.find((s) =>
      s.trackingNumber.toLowerCase().includes(trackingNumber.toLowerCase()),
    );

    if (shipment) {
      setFormData((prev) => ({
        ...prev,
        origin: shipment.origin,
        destination: shipment.destination,
        courierPartner: shipment.courierPartner,
      }));
    }
  };

  function getTicketTypeIcon(ticketType) {
    if (ticketType === "support") {
      return <HelpCircle className="w-4 h-4 text-blue-600" />;
    } else if (ticketType === "dispute") {
      return <AlertTriangle className="w-4 h-4 text-red-600" />;
    }
    return null;
  }

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
              <Plus className="h-8 w-8 text-logistics-600" />
              <span>Create New Ticket</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Submit a new support ticket or dispute for customer assistance
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleSaveDraft}>
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </div>

        {/* Success Notification */}
        {showDraftSaved && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                <span className="text-sm font-medium text-green-800">
                  Draft saved successfully!
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enhanced Progress Steps */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-x-8">
              {[1, 2, 3].map((step) => {
                const status = getStepStatus(step);
                const isCompleted = status === "completed";
                const isActive = status === "active";
                const isValid = getStepValidationStatus(step);

                return (
                  <div key={step} className="flex items-center space-x-3">
                    <div className="relative">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                          isCompleted
                            ? "bg-green-600 text-white"
                            : isActive
                              ? "bg-logistics-600 text-white ring-4 ring-logistics-100"
                              : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle className="w-6 h-6" />
                        ) : (
                          step
                        )}
                      </div>
                      {isValid && !isCompleted && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col">
                      <span
                        className={`text-sm font-medium transition-colors duration-300 ${
                          isCompleted
                            ? "text-green-600"
                            : isActive
                              ? "text-logistics-600"
                              : "text-muted-foreground"
                        }`}
                      >
                        {step === 1
                          ? "Basic Info"
                          : step === 2
                            ? "Details"
                            : "Review"}
                      </span>
                      <span
                        className={`text-xs transition-colors duration-300 ${
                          isCompleted
                            ? "text-green-500"
                            : isActive
                              ? "text-logistics-500"
                              : "text-muted-foreground"
                        }`}
                      >
                        {isCompleted
                          ? "Completed"
                          : isActive
                            ? "In Progress"
                            : "Pending"}
                      </span>
                    </div>

                    {step < 3 && (
                      <div
                        className={`w-20 h-1 rounded-full transition-all duration-300 ${
                          isCompleted
                            ? "bg-green-600"
                            : step < activeStep
                              ? "bg-logistics-600"
                              : "bg-gray-200"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Basic Information */}
          {activeStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Basic Information</span>
                  {stepValidation.step1 && (
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-700 border-green-200"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Valid
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Select the type of ticket and provide basic details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Ticket Type Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                      formData.ticketType === "support"
                        ? "border-logistics-600 bg-logistics-50 shadow-md"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => handleInputChange("ticketType", "support")}
                  >
                    <div className="flex items-center space-x-3">
                      <HelpCircle
                        className={`w-6 h-6 ${
                          formData.ticketType === "support"
                            ? "text-logistics-600"
                            : "text-muted-foreground"
                        }`}
                      />
                      <div>
                        <h3 className="font-medium text-foreground">
                          Support Ticket
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          General support and assistance
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                      formData.ticketType === "dispute"
                        ? "border-logistics-600 bg-logistics-50 shadow-md"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => handleInputChange("ticketType", "dispute")}
                  >
                    <div className="flex items-center space-x-3">
                      <AlertTriangle
                        className={`w-6 h-6 ${
                          formData.ticketType === "dispute"
                            ? "text-logistics-600"
                            : "text-muted-foreground"
                        }`}
                      />
                      <div>
                        <h3 className="font-medium text-foreground">Dispute</h3>
                        <p className="text-sm text-muted-foreground">
                          Issue with shipment or service
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Priority and Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority Level</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) =>
                        handleInputChange("priority", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <Badge className={getPriorityColor(formData.priority)}>
                      {formData.priority.charAt(0).toUpperCase() +
                        formData.priority.slice(1)}{" "}
                      Priority
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) =>
                        handleInputChange("category", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {ticketCategories[formData.ticketType].map(
                          (category) => (
                            <SelectItem
                              key={category.value}
                              value={category.value}
                            >
                              <div className="flex flex-col">
                                <span>{category.label}</span>
                                <span className="text-xs text-muted-foreground">
                                  {category.description}
                                </span>
                              </div>
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Subject and Description */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject *</Label>
                    <Input
                      id="subject"
                      placeholder="Brief description of the issue"
                      value={formData.subject}
                      onChange={(e) =>
                        handleInputChange("subject", e.target.value)
                      }
                      className={errors.subject ? "border-red-500" : ""}
                    />
                    {errors.subject && (
                      <p className="text-sm text-red-600">{errors.subject}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      placeholder="Provide detailed information about the issue..."
                      rows={4}
                      value={formData.description}
                      onChange={(e) =>
                        handleInputChange("description", e.target.value)
                      }
                      className={errors.description ? "border-red-500" : ""}
                    />
                    <div className="flex items-center justify-between">
                      {errors.description && (
                        <p className="text-sm text-red-600">
                          {errors.description}
                        </p>
                      )}
                      <span
                        className={`text-xs ${
                          formData.description.length < 50
                            ? "text-muted-foreground"
                            : formData.description.length < 100
                              ? "text-yellow-600"
                              : "text-green-600"
                        }`}
                      >
                        {formData.description.length} characters
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Customer & Shipment Details */}
          {activeStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Customer & Shipment Details</span>
                  {stepValidation.step2 && (
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-700 border-green-200"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Valid
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Provide customer information and shipment details if
                  applicable
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Customer Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-foreground">
                    Customer Information
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerName">Customer Name *</Label>
                      <Input
                        id="customerName"
                        placeholder="Full name"
                        value={formData.customerName}
                        onChange={(e) => {
                          handleInputChange("customerName", e.target.value);
                          handleCustomerSearch(e.target.value);
                        }}
                        className={errors.customerName ? "border-red-500" : ""}
                      />
                      {errors.customerName && (
                        <p className="text-sm text-red-600">
                          {errors.customerName}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="customerEmail">Email *</Label>
                      <Input
                        id="customerEmail"
                        type="email"
                        placeholder="customer@example.com"
                        value={formData.customerEmail}
                        onChange={(e) =>
                          handleInputChange("customerEmail", e.target.value)
                        }
                        className={errors.customerEmail ? "border-red-500" : ""}
                      />
                      {errors.customerEmail && (
                        <p className="text-sm text-red-600">
                          {errors.customerEmail}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerPhone">Phone Number</Label>
                      <Input
                        id="customerPhone"
                        placeholder="+91 98765 43210"
                        value={formData.customerPhone}
                        onChange={(e) =>
                          handleInputChange("customerPhone", e.target.value)
                        }
                        className={errors.customerPhone ? "border-red-500" : ""}
                      />
                      {errors.customerPhone && (
                        <p className="text-sm text-red-600">
                          {errors.customerPhone}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="preferredContactMethod">
                        Preferred Contact Method
                      </Label>
                      <Select
                        value={formData.preferredContactMethod}
                        onValueChange={(value) =>
                          handleInputChange("preferredContactMethod", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="phone">Phone</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customerAddress">Address</Label>
                    <Textarea
                      id="customerAddress"
                      placeholder="Full address"
                      rows={2}
                      value={formData.customerAddress}
                      onChange={(e) =>
                        handleInputChange("customerAddress", e.target.value)
                      }
                    />
                  </div>
                </div>

                {/* Shipment Information (for disputes) */}
                {formData.ticketType === "dispute" && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-foreground">
                        Shipment Information
                      </h3>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="trackingNumber">
                            Tracking Number *
                          </Label>
                          <Input
                            id="trackingNumber"
                            placeholder="Enter tracking number"
                            value={formData.trackingNumber}
                            onChange={(e) => {
                              handleInputChange(
                                "trackingNumber",
                                e.target.value,
                              );
                              handleTrackingSearch(e.target.value);
                            }}
                            className={
                              errors.trackingNumber ? "border-red-500" : ""
                            }
                          />
                          {errors.trackingNumber && (
                            <p className="text-sm text-red-600">
                              {errors.trackingNumber}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="courierPartner">
                            Courier Partner *
                          </Label>
                          <Select
                            value={formData.courierPartner}
                            onValueChange={(value) =>
                              handleInputChange("courierPartner", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select courier" />
                            </SelectTrigger>
                            <SelectContent>
                              {courierPartners.map((courier) => (
                                <SelectItem
                                  key={courier.value}
                                  value={courier.value}
                                >
                                  <div className="flex items-center space-x-2">
                                    <Badge className={courier.color}>
                                      {courier.label}
                                    </Badge>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errors.courierPartner && (
                            <p className="text-sm text-red-600">
                              {errors.courierPartner}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="origin">Origin</Label>
                          <Input
                            id="origin"
                            placeholder="Origin city"
                            value={formData.origin}
                            onChange={(e) =>
                              handleInputChange("origin", e.target.value)
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="destination">Destination</Label>
                          <Input
                            id="destination"
                            placeholder="Destination city"
                            value={formData.destination}
                            onChange={(e) =>
                              handleInputChange("destination", e.target.value)
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="issueType">Issue Type *</Label>
                        <Select
                          value={formData.issueType}
                          onValueChange={(value) =>
                            handleInputChange("issueType", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select issue type" />
                          </SelectTrigger>
                          <SelectContent>
                            {issueTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                <div className="flex flex-col">
                                  <span>{type.label}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {type.description}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.issueType && (
                          <p className="text-sm text-red-600">
                            {errors.issueType}
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Additional Details & Review */}
          {activeStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="h-5 w-5" />
                  <span>Additional Details & Review</span>
                  {stepValidation.step3 && (
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-700 border-green-200"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Valid
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Add attachments, internal notes, and review your ticket
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Attachments */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-foreground">
                    Attachments
                  </h3>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-logistics-400 transition-colors">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Upload relevant files (images, documents, etc.)
                    </p>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                    />
                    <Label htmlFor="file-upload" className="cursor-pointer">
                      <Button variant="outline" type="button">
                        Choose Files
                      </Button>
                    </Label>
                  </div>

                  {/* File List */}
                  {formData.attachments.length > 0 && (
                    <div className="space-y-2">
                      {formData.attachments.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium text-foreground">
                              {file.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({(file.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAttachment(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Internal Notes */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-foreground">
                    Internal Notes
                  </h3>
                  <Textarea
                    placeholder="Add internal notes for the team (not visible to customer)"
                    rows={3}
                    value={formData.internalNotes}
                    onChange={(e) =>
                      handleInputChange("internalNotes", e.target.value)
                    }
                  />
                </div>

                {/* Assignment & Timeline */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="assignTo">Assign To</Label>
                    <Select
                      value={formData.assignTo}
                      onValueChange={(value) =>
                        handleInputChange("assignTo", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select team member" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamMembers.map((member) => (
                          <SelectItem key={member.value} value={member.value}>
                            <div className="flex flex-col">
                              <span>{member.label}</span>
                              <span className="text-xs text-muted-foreground">
                                {member.role}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="estimatedResolution">
                      Estimated Resolution
                    </Label>
                    <Select
                      value={formData.estimatedResolution}
                      onValueChange={(value) =>
                        handleInputChange("estimatedResolution", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select timeline" />
                      </SelectTrigger>
                      <SelectContent>
                        {resolutionTimelines.map((timeline) => (
                          <SelectItem
                            key={timeline.value}
                            value={timeline.value}
                          >
                            <div className="flex flex-col">
                              <span>{timeline.label}</span>
                              <span className="text-xs text-muted-foreground">
                                {timeline.description}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Communication Preferences */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-foreground">
                    Communication Preferences
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="notifyCustomer"
                        checked={formData.notifyCustomer}
                        onCheckedChange={(checked) =>
                          handleInputChange("notifyCustomer", checked)
                        }
                      />
                      <Label htmlFor="notifyCustomer">
                        Notify customer about ticket updates
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="notifyTeam"
                        checked={formData.notifyTeam}
                        onCheckedChange={(checked) =>
                          handleInputChange("notifyTeam", checked)
                        }
                      />
                      <Label htmlFor="notifyTeam">
                        Notify team members about new ticket
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Ticket Summary */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-foreground">
                    Ticket Summary
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Type:
                      </span>
                      <div className="flex items-center space-x-2">
                        {getTicketTypeIcon(formData.ticketType)}
                        <Badge variant="outline">
                          {formData.ticketType === "support"
                            ? "Support Ticket"
                            : "Dispute"}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Priority:
                      </span>
                      <Badge className={getPriorityColor(formData.priority)}>
                        {formData.priority.charAt(0).toUpperCase() +
                          formData.priority.slice(1)}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Category:
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {formData.category || "Not selected"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Customer:
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {formData.customerName || "Not provided"}
                      </span>
                    </div>

                    {formData.ticketType === "dispute" && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Tracking:
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {formData.trackingNumber || "Not provided"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleStepChange(activeStep - 1)}
              disabled={activeStep === 1}
            >
              Previous
            </Button>

            <div className="flex items-center space-x-3">
              {activeStep < 3 ? (
                <Button
                  type="button"
                  onClick={() => handleStepChange(activeStep + 1)}
                  className="flex items-center space-x-2"
                  disabled={!getStepValidationStatus(activeStep)}
                >
                  <span>Next</span>
                  <ArrowLeft className="w-4 h-4 rotate-180" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center space-x-2 bg-logistics-600 hover:bg-logistics-700"
                >
                  {isSubmitting ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      <span>Creating Ticket...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Create Ticket</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>

        {/* Help Information */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <HelpCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="space-y-2">
                <h3 className="font-medium text-blue-900">Need Help?</h3>
                <p className="text-sm text-blue-800">
                  If you need assistance creating a ticket or have questions
                  about the process, please contact our support team at{" "}
                  <a
                    href="mailto:support@logistics.com"
                    className="underline hover:text-blue-900"
                  >
                    support@logistics.com
                  </a>{" "}
                  or call us at{" "}
                  <a
                    href="tel:+91-1800-123-4567"
                    className="underline hover:text-blue-900"
                  >
                    +91-1800-123-4567
                  </a>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
