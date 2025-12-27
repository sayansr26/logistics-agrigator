"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  ArrowLeft,
  Mail,
  Phone,
  AlertCircle,
  Search,
  Building2,
} from "lucide-react";
import Link from "next/link";
import { useGetOutletByIdQuery, useGetCustomersQuery } from "@/store/api/endpoints/customerApi";

export default function OutletCustomersPage() {
  const params = useParams();
  const router = useRouter();
  const outletId = params.id;

  // State
  const [searchQuery, setSearchQuery] = useState("");

  // API hooks
  const { data: outletData, isLoading: isOutletLoading } = useGetOutletByIdQuery(outletId, {
    skip: !outletId,
  });

  // Fetch customers for this outlet using RTK Query
  const { 
    data: customersData, 
    isLoading: isLoadingCustomers,
  } = useGetCustomersQuery(
    { outletId, customerType: "B2B" },
    { skip: !outletId }
  );

  const outlet = outletData?.data?.outlet || outletData?.data?.customer;
  const customers = customersData?.data?.customers || [];

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Outlets", href: "/outlets" },
    { title: outlet?.name || "Outlet", href: `/outlets/${outletId}` },
    { title: "Customers" },
  ];

  // Filter customers by search query
  const filteredCustomers = customers.filter(customer => {
    const query = searchQuery.toLowerCase();
    return (
      customer.name?.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query) ||
      customer.phone?.includes(query)
    );
  });

  // Loading state
  if (isOutletLoading) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Not found state
  if (!outlet) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-6xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-4">Outlet Not Found</h2>
              <p className="text-muted-foreground mb-6">
                The outlet you&apos;re looking for doesn&apos;t exist.
              </p>
              <Button asChild>
                <Link href="/outlets">Back to Outlets</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Outlet Customers</h1>
            <p className="text-muted-foreground mt-1">
              {outlet.name} - {outlet.code}
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href={`/outlets/${outletId}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Outlet
            </Link>
          </Button>
        </div>

        {/* Search and Stats */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Badge variant="outline" className="text-sm">
            {customers.length} B2B Customer{customers.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Customers List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              B2B Customers
            </CardTitle>
            <CardDescription>
              Business customers associated with this outlet
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingCustomers ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">
                  {searchQuery ? "No Customers Found" : "No Customers Yet"}
                </h3>
                <p className="text-muted-foreground">
                  {searchQuery
                    ? "Try adjusting your search query."
                    : "No B2B customers are associated with this outlet."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div className="font-medium">{customer.name}</div>
                        {customer.businessType && (
                          <div className="text-sm text-muted-foreground">
                            {customer.businessType}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3" />
                            {customer.email || "—"}
                          </span>
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {customer.phone || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {customer.city && customer.state
                            ? `${customer.city}, ${customer.state}`
                            : customer.city || customer.state || "—"}
                        </div>
                        {customer.pincode && (
                          <div className="text-xs text-muted-foreground">
                            {customer.pincode}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={customer.isActive !== false ? "success" : "secondary"}>
                          {customer.isActive !== false ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
