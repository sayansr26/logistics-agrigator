"use client";

import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  PageHeader,
  PageContainer,
  StatsCard,
  StatsGrid,
  DataTable,
} from "@/components/shared";
import {
  Truck,
  Globe,
  IndianRupee,
  MapPin,
  CheckCircle,
  XCircle,
  Plus,
  Eye,
  Settings,
  ScrollText,
  ArrowRight,
} from "lucide-react";
import { useGetPartnersQuery } from "@/store/api/endpoints/partnersApi";
import { useGetZonesQuery } from "@/store/api/endpoints/zonesApi";
import { useGetChargesTypesQuery } from "@/store/api/endpoints/chargesTypeApi";

export default function DashboardPage() {
  // Fetch real data from APIs
  const { data: partnersData, isLoading: partnersLoading } =
    useGetPartnersQuery({});
  const { data: zonesData, isLoading: zonesLoading } = useGetZonesQuery({});
  const { data: chargesData, isLoading: chargesLoading } =
    useGetChargesTypesQuery({});

  const partners = partnersData?.data?.partners || [];
  const zones = zonesData?.data?.zones || [];
  const chargesTypes = chargesData?.data || [];

  const activePartners = partners.filter((p) => p.isActive);
  const isLoading = partnersLoading || zonesLoading || chargesLoading;

  // Define columns for partners table
  const partnerColumns = [
    {
      key: "name",
      header: "Partner",
      render: (partner) => (
        <Link
          href={`/partners/${partner.id}`}
          className="font-medium hover:underline"
        >
          {partner.displayName || partner.name}
        </Link>
      ),
    },
    {
      key: "code",
      header: "Code",
      render: (partner) => (
        <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
          {partner.code}
        </code>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      render: (partner) =>
        partner.isActive ? (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        ) : (
          <Badge variant="secondary">
            <XCircle className="h-3 w-3 mr-1" />
            Inactive
          </Badge>
        ),
    },
    {
      key: "channelMode",
      header: "Channel Mode",
      render: (partner) => (
        <Badge variant="outline">{partner.channelMode || "SINGLE"}</Badge>
      ),
    },
    {
      key: "pincodes",
      header: "Pincodes",
      render: (partner) => (
        <div className="flex items-center">
          <MapPin className="h-3 w-3 mr-1 text-muted-foreground" />
          {partner._count?.pincodeAssigns || 0}
        </div>
      ),
    },
  ];

  // Quick actions for navigation
  const quickActions = [
    {
      title: "Add Partner",
      description: "Create a new courier partner",
      href: "/partners/add",
      icon: Plus,
      color: "text-blue-600",
    },
    {
      title: "Manage Zones",
      description: "Configure delivery zones",
      href: "/zones",
      icon: Globe,
      color: "text-green-600",
    },
    {
      title: "Charges Types",
      description: "Set up charge configurations",
      href: "/charges-types",
      icon: IndianRupee,
      color: "text-purple-600",
    },
    {
      title: "Audit Logs",
      description: "View system activity",
      href: "/audit-logs",
      icon: ScrollText,
      color: "text-orange-600",
    },
  ];

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <PageContainer>
          <PageHeader
            title="Dashboard"
            description="Platform overview and quick actions"
            primaryAction={{
              label: "Add Partner",
              href: "/partners/add",
            }}
          />

          {/* Key Metrics */}
          <StatsGrid columns={4}>
            <StatsCard
              title="Courier Partners"
              value={partners.length}
              description={`${activePartners.length} active`}
              icon={Truck}
              isLoading={partnersLoading}
            />
            <StatsCard
              title="Active Partners"
              value={activePartners.length}
              description="Ready for operations"
              icon={CheckCircle}
              iconColor="text-green-500"
              isLoading={partnersLoading}
            />
            <StatsCard
              title="Zones"
              value={zones.length}
              description="Delivery zones configured"
              icon={Globe}
              isLoading={zonesLoading}
            />
            <StatsCard
              title="Charges Types"
              value={chargesTypes.length}
              description="Charge configurations"
              icon={IndianRupee}
              isLoading={chargesLoading}
            />
          </StatsGrid>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Partners Overview */}
            <div className="lg:col-span-2">
              <DataTable
                title="Courier Partners"
                description="Overview of all configured courier partners"
                columns={partnerColumns}
                data={partners.slice(0, 5)}
                keyField="id"
                isLoading={isLoading}
                emptyMessage="No partners configured yet"
                emptyIcon={
                  <Truck className="h-12 w-12 text-muted-foreground mb-4" />
                }
                emptyAction={
                  <Button asChild>
                    <Link href="/partners/add">
                      <Plus className="mr-2 h-4 w-4" />
                      Add First Partner
                    </Link>
                  </Button>
                }
                headerActions={
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/partners">
                      <Eye className="mr-2 h-4 w-4" />
                      View All
                    </Link>
                  </Button>
                }
              />
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks and navigation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {quickActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex items-center p-3 rounded-lg border hover:bg-muted transition-colors group"
                  >
                    <div
                      className={`p-2 rounded-lg bg-muted mr-3 ${action.color}`}
                    >
                      <action.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{action.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {action.description}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
              <CardDescription>
                Configuration status of your logistics platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
                    <Truck className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Partners</p>
                    <p className="text-2xl font-bold">
                      {activePartners.length}/{partners.length}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Active / Total
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                    <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Zones</p>
                    <p className="text-2xl font-bold">{zones.length}</p>
                    <p className="text-xs text-muted-foreground">Configured</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900">
                    <IndianRupee className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Charges</p>
                    <p className="text-2xl font-bold">{chargesTypes.length}</p>
                    <p className="text-xs text-muted-foreground">
                      Charge Types
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </PageContainer>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
