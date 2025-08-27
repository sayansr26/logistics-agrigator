"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  mockRemittances,
  formatWeight,
  formatAmount,
  type Remittance,
} from "@/lib/mock-data";
import {
  ArrowLeft,
  FileText,
  Package,
  User,
  Phone,
  Mail,
  DollarSign,
  Truck,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit,
  Download,
  Printer,
} from "lucide-react";
import Link from "next/link";

export default function RemittanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [remittance, setRemittance] = useState<Remittance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call to fetch remittance details
    const fetchRemittance = async () => {
      setLoading(true);
      try {
        // Find the remittance from mock data
        const foundRemittance = mockRemittances.find((r) => r.id === params.id);
        if (foundRemittance) {
          setRemittance(foundRemittance);
        } else {
          // Handle not found
          router.push("/remittance");
        }
      } catch (error) {
        // Error handling for remittance fetch
        router.push("/remittance");
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchRemittance();
    }
  }, [params.id, router]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!remittance) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">
              Remittance Not Found
            </h1>
            <p className="text-gray-600 mt-2">
              The requested remittance could not be found.
            </p>
            <Link href="/remittance">
              <Button className="mt-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Remittances
              </Button>
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "Remittance", href: "/remittance" },
    { title: `Remittance #${remittance.refNo}` },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "settled":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "cancelled":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "settled":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "cancelled":
        return "bg-red-100 text-red-800 hover:bg-red-100";
      case "pending":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Remittance Details
            </h1>
            <p className="text-muted-foreground mt-2">
              Comprehensive information about remittance #{remittance.refNo}
            </p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button size="sm">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>

        {/* Status Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {getStatusIcon(remittance.status)}
              <span>Status Overview</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <Badge
                  className={`${getStatusBadgeColor(remittance.status)} text-sm font-medium`}
                >
                  {remittance.status.charAt(0).toUpperCase() +
                    remittance.status.slice(1)}
                </Badge>
                <p className="text-sm text-muted-foreground mt-1">
                  Current Status
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {formatAmount(remittance.amount)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Remittance Amount
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{remittance.outlet}</p>
                <p className="text-sm text-muted-foreground">Outlet</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Basic Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Reference Number
                  </label>
                  <p className="text-lg font-semibold">{remittance.refNo}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    AWB Number
                  </label>
                  <p className="text-lg font-semibold">
                    {remittance.awbNumber}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Courier
                  </label>
                  <p className="text-lg font-semibold">{remittance.courier}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Weight
                  </label>
                  <p className="text-lg font-semibold">
                    {formatWeight(remittance.weight)}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Created Date
                  </label>
                  <p className="text-lg font-semibold">
                    {new Date(remittance.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Settled Date
                  </label>
                  <p className="text-lg font-semibold">
                    {remittance.settledAt
                      ? new Date(remittance.settledAt).toLocaleDateString()
                      : "Not settled yet"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Amount
                  </label>
                  <p className="text-2xl font-bold text-green-600">
                    {formatAmount(remittance.amount)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Receiver Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Receiver Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Receiver Name
                </label>
                <p className="text-lg font-semibold">{remittance.receiver}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center">
                    <Phone className="w-4 h-4 mr-2" />
                    Phone Number
                  </label>
                  <p className="text-lg font-semibold">+91 98765 43210</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center">
                    <Mail className="w-4 h-4 mr-2" />
                    Email
                  </label>
                  <p className="text-lg font-semibold">receiver@example.com</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Package Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <span>Package Details</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Weight</TableCell>
                  <TableCell>{formatWeight(remittance.weight)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Dimensions</TableCell>
                  <TableCell>30cm x 20cm x 15cm</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Package Type</TableCell>
                  <TableCell>Standard Package</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Contents</TableCell>
                  <TableCell>Electronics</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Declared Value</TableCell>
                  <TableCell>{formatAmount(remittance.amount)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Remittance Timeline</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Remittance Created</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(remittance.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Truck className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Package Delivered</p>
                  <p className="text-sm text-muted-foreground">
                    {remittance.settledAt
                      ? new Date(remittance.settledAt).toLocaleString()
                      : "Pending delivery"}
                  </p>
                </div>
              </div>
              {remittance.status === "settled" && (
                <>
                  <Separator />
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Payment Collected</p>
                      <p className="text-sm text-muted-foreground">
                        {remittance.settledAt
                          ? new Date(remittance.settledAt).toLocaleString()
                          : "Pending"}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Download Receipt
          </Button>
          {remittance.status === "pending" && (
            <Button className="bg-green-600 hover:bg-green-700 text-white">
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark as Settled
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
