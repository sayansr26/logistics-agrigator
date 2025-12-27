"use client";

import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetCustomerByIdQuery,
  type CustomerType,
} from "@/store/api/endpoints/customerApi";
import {
  User,
  Store,
  MapPin,
  Phone,
  Mail,
  Edit,
  ArrowLeft,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

// Helper functions
const getCustomerTypeBadge = (type: CustomerType) => {
  if (type === "B2C") {
    return (
      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
        <User className="w-3 h-3 mr-1" />
        B2C (Direct)
      </Badge>
    );
  }
  return (
    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
      <Store className="w-3 h-3 mr-1" />
      B2B (Outlet)
    </Badge>
  );
};

const getStatusBadge = (isActive: boolean) => {
  if (isActive) {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
        <CheckCircle className="w-3 h-3 mr-1" />
        Active
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
      <XCircle className="w-3 h-3 mr-1" />
      Inactive
    </Badge>
  );
};

const formatDate = (dateString: string) => {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export default function CustomerDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const { data, isLoading, error } = useGetCustomerByIdQuery(customerId, {
    skip: !customerId,
  });

  const customer = data?.data?.customer || null;

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Customers", href: "/customers" },
    { title: customer?.name || "Customer Details" },
  ];

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (error || !customer) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Customer Not Found</h2>
          <p className="text-muted-foreground mb-6">
            The customer you&apos;re looking for doesn&apos;t exist or has been
            removed.
          </p>
          <Button onClick={() => router.push("/customers")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const isB2BCustomer = customer.customerType === "B2B";

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                {isB2BCustomer ? (
                  <Store className="h-6 w-6 text-primary" />
                ) : (
                  <User className="h-6 w-6 text-primary" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold">{customer.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  {getCustomerTypeBadge(customer.customerType)}
                  {getStatusBadge(customer.isActive)}
                </div>
              </div>
            </div>
          </div>
          <Button onClick={() => router.push(`/customers/${customerId}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Customer
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{customer.email}</p>
                </div>
              </div>
              {customer.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{customer.phone}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Address Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {customer.address ||
              customer.city ||
              customer.state ||
              customer.pincode ? (
                <div>
                  {customer.address && (
                    <p className="font-medium">{customer.address}</p>
                  )}
                  <p className="text-muted-foreground">
                    {[customer.city, customer.state, customer.pincode]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  {customer.country && (
                    <p className="text-sm text-muted-foreground">
                      {customer.country}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No address provided
                </p>
              )}
            </CardContent>
          </Card>

          {/* Linked Outlet (only for B2B customers) */}
          {isB2BCustomer && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  Linked Outlet
                </CardTitle>
              </CardHeader>
              <CardContent>
                {customer.outlet ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Outlet Name
                      </p>
                      <p className="font-medium">{customer.outlet.name}</p>
                    </div>
                    {customer.outlet.code && (
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Outlet Code
                        </p>
                        <p className="font-medium">{customer.outlet.code}</p>
                      </div>
                    )}
                    <Button variant="outline" asChild className="mt-2">
                      <Link href={`/outlets/${customer.outlet.id}`}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Outlet Details
                      </Link>
                    </Button>
                  </div>
                ) : customer.outletId ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Outlet ID</p>
                    <p className="font-mono text-sm">{customer.outletId}</p>
                    <Button variant="outline" asChild className="mt-2">
                      <Link href={`/outlets/${customer.outletId}`}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Outlet
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No outlet linked
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Timeline / Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">{formatDate(customer.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="font-medium">{formatDate(customer.updatedAt)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
