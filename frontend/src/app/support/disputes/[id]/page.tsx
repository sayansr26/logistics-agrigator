"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  Edit,
  FileText,
  MapPin,
  MessageCircle,
  Phone,
  Mail,
  Truck,
  Package,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageSquare,
  PhoneCall,
  Mail as MailIcon,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  mockDisputes,
  getDisputeStatusColor,
  formatDate,
} from "@/lib/mock-data";
import { useRouter } from "next/navigation";

interface DisputeDetailProps {
  params: { id: string };
}

export default function DisputeDetailPage({ params }: DisputeDetailProps) {
  const router = useRouter();
  const { id } = params;
  const [isEditing, setIsEditing] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [showSensitiveInfo, setShowSensitiveInfo] = useState(false);

  // Find the dispute by ID (in real app, this would be an API call)
  const dispute = mockDisputes.find((d) => d.id === id);

  if (!dispute) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Dispute Not Found
              </h2>
              <p className="text-gray-600 mb-6">
                The dispute you&apos;re looking for doesn&apos;t exist or has
                been removed.
              </p>
              <Button onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Support & Disputes", href: "/support" },
    { title: `Dispute #${dispute.disputeNumber}` },
  ];

  const handleStatusUpdate = (newStatus: string) => {
    // In real app, this would update the dispute status via API
    // Status update logic would go here
  };

  const handleAddComment = () => {
    if (newComment.trim()) {
      // In real app, this would add a comment via API
      // Comment addition logic would go here
      setNewComment("");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Disputes</span>
            </Button> */}
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center space-x-3">
                <AlertTriangle className="h-8 w-8 text-red-600" />
                <span>Dispute #{dispute.disputeNumber}</span>
                <Badge className={getDisputeStatusColor(dispute.status)}>
                  {dispute.status}
                </Badge>
              </h1>
              <p className="text-muted-foreground mt-2">
                Tracking: {dispute.trackingNumber} • Created{" "}
                {formatDate(dispute.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Details
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Edit className="h-4 w-4 mr-2" />
              {isEditing ? "Cancel Edit" : "Edit"}
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <MessageCircle className="h-4 w-4 mr-2" />
              Contact Customer
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Dispute Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Dispute Overview</span>
                </CardTitle>
                <CardDescription>
                  Basic information about this dispute case
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Issue Type
                    </label>
                    <p className="text-sm font-medium mt-1">
                      {dispute.issueType}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Priority
                    </label>
                    <Badge
                      variant="outline"
                      className={
                        dispute.priority === "high" ||
                        dispute.priority === "urgent"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : dispute.priority === "medium"
                            ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                            : "border-green-200 bg-green-50 text-green-700"
                      }
                    >
                      {dispute.priority}
                    </Badge>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Reason
                    </label>
                    <p className="text-sm mt-1 text-gray-700 bg-gray-50 p-3 rounded-md">
                      {dispute.reason}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipment Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <span>Shipment Details</span>
                </CardTitle>
                <CardDescription>
                  Information about the disputed shipment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Truck className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium">Tracking Number</p>
                        <p className="text-sm text-muted-foreground">
                          {dispute.trackingNumber}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(dispute.trackingNumber)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">Origin</span>
                      </div>
                      <p className="text-sm text-gray-700 ml-6">
                        {dispute.origin}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium">Destination</span>
                      </div>
                      <p className="text-sm text-gray-700 ml-6">
                        {dispute.destination}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg">
                    <Truck className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">Courier Partner</p>
                      <p className="text-sm text-muted-foreground">
                        {dispute.courierPartner}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Customer Information</span>
                </CardTitle>
                <CardDescription>
                  Contact details and customer profile
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <User className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium">{dispute.customerName}</p>
                        <p className="text-sm text-muted-foreground">
                          Customer Name
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">Email</span>
                      </div>
                      <div className="flex items-center space-x-2 ml-6">
                        <p className="text-sm text-gray-700">
                          {dispute.customerEmail}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(dispute.customerEmail)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">Phone</span>
                      </div>
                      <div className="flex items-center space-x-2 ml-6">
                        <p className="text-sm text-gray-700">
                          {dispute.customerPhone}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(dispute.customerPhone)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 pt-2">
                    <Button variant="outline" size="sm">
                      <MailIcon className="h-4 w-4 mr-2" />
                      Send Email
                    </Button>
                    <Button variant="outline" size="sm">
                      <PhoneCall className="h-4 w-4 mr-2" />
                      Call Customer
                    </Button>
                    <Button variant="outline" size="sm">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Send SMS
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline & Comments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Timeline & Updates</span>
                </CardTitle>
                <CardDescription>
                  Track the progress and communication history
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Add Comment */}
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Add a comment or update..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="min-h-[100px]"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setShowSensitiveInfo(!showSensitiveInfo)
                          }
                        >
                          {showSensitiveInfo ? (
                            <EyeOff className="h-4 w-4 mr-2" />
                          ) : (
                            <Eye className="h-4 w-4 mr-2" />
                          )}
                          {showSensitiveInfo ? "Hide" : "Show"} Sensitive Info
                        </Button>
                      </div>
                      <Button
                        onClick={handleAddComment}
                        disabled={!newComment.trim()}
                      >
                        Add Comment
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Timeline Items */}
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">
                            Dispute Created
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(dispute.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Customer reported issue with shipment{" "}
                          {dispute.trackingNumber}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-yellow-600 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">
                            Status Updated
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(dispute.lastUpdated)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Dispute status changed to {dispute.status}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Right Column */}
          <div className="space-y-6">
            {/* Status Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5" />
                  <span>Status Management</span>
                </CardTitle>
                <CardDescription>
                  Update dispute status and priority
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Current Status
                  </label>
                  <Badge
                    className={`mt-2 ${getDisputeStatusColor(dispute.status)}`}
                  >
                    {dispute.status}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Update Status
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusUpdate("in_progress")}
                      className="text-xs"
                    >
                      In Progress
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusUpdate("resolved")}
                      className="text-xs"
                    >
                      Resolved
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusUpdate("closed")}
                      className="text-xs"
                    >
                      Closed
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusUpdate("open")}
                      className="text-xs"
                    >
                      Reopen
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Quick Actions
                  </label>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => handleStatusUpdate("resolved")}
                    >
                      <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                      Mark as Resolved
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => handleStatusUpdate("closed")}
                    >
                      <XCircle className="h-4 w-4 mr-2 text-gray-600" />
                      Close Dispute
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Key Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Key Information</span>
                </CardTitle>
                <CardDescription>
                  Important dates and identifiers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Created</span>
                  </div>
                  <p className="text-sm text-gray-700 ml-6">
                    {formatDate(dispute.createdAt)}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Last Updated</span>
                  </div>
                  <p className="text-sm text-gray-700 ml-6">
                    {formatDate(dispute.lastUpdated)}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium">Dispute ID</span>
                  </div>
                  <div className="flex items-center space-x-2 ml-6">
                    <p className="text-sm text-gray-700 font-mono">
                      {dispute.id}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(dispute.id)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Related Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageCircle className="h-5 w-5" />
                  <span>Communication</span>
                </CardTitle>
                <CardDescription>Quick communication actions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <MailIcon className="h-4 w-4 mr-2" />
                  Send Update Email
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send SMS Update
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <PhoneCall className="h-4 w-4 mr-2" />
                  Schedule Call
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
