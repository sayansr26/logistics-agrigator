"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useGetServiceByIdQuery,
  useGetServiceHealthQuery,
  useStartServiceMutation,
  useStopServiceMutation,
  useRestartServiceMutation,
  useDeleteServiceMutation,
} from "@/store/api/endpoints/serviceApi";
import {
  Server,
  Settings,
  Power,
  RefreshCw,
  Edit,
  Trash2,
  ChevronLeft,
  Activity,
  Clock,
  Cpu,
  HardDrive,
  Zap,
  Globe,
  Database,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Play,
  Pause,
  Terminal,
  Info,
  Package,
  Layers,
  Network,
} from "lucide-react";

// Helper function to get status color
const getServiceStatusColor = (status: string) => {
  switch (status) {
    case "running":
      return "bg-green-100 text-green-800 border-green-200";
    case "stopped":
      return "bg-gray-100 text-gray-800 border-gray-200";
    case "degraded":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "maintenance":
      return "bg-blue-100 text-blue-800 border-blue-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

// Helper function to format uptime
const formatUptime = (seconds?: number) => {
  if (!seconds) return "N/A";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

// Helper function to get health status color
const getHealthStatusColor = (status: string) => {
  switch (status) {
    case "healthy":
      return "text-green-600 bg-green-50";
    case "degraded":
      return "text-yellow-600 bg-yellow-50";
    case "unhealthy":
      return "text-red-600 bg-red-50";
    default:
      return "text-gray-600 bg-gray-50";
  }
};

export default function ServiceDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const serviceId = params.id as string;

  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "Service Types", href: "/services" },
    { title: "Service Type Details" },
  ];

  // State management
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedAction, setSelectedAction] = useState<
    "start" | "stop" | "restart" | null
  >(null);

  // RTK Query - Fetch service details
  const {
    data: serviceData,
    isLoading: isLoadingService,
    error: serviceError,
    refetch: refetchService,
  } = useGetServiceByIdQuery(serviceId);

  // RTK Query - Fetch service health
  const {
    data: healthData,
    isLoading: isLoadingHealth,
    error: healthError,
    refetch: refetchHealth,
  } = useGetServiceHealthQuery(serviceId);

  // RTK Query mutations
  const [startService, { isLoading: isStarting }] = useStartServiceMutation();
  const [stopService, { isLoading: isStopping }] = useStopServiceMutation();
  const [restartService, { isLoading: isRestarting }] =
    useRestartServiceMutation();
  const [deleteService, { isLoading: isDeleting }] = useDeleteServiceMutation();

  const service = serviceData?.data;
  const health = healthData?.data;

  // Open action confirmation dialog
  const openActionDialog = (action: "start" | "stop" | "restart") => {
    setSelectedAction(action);
    setShowActionDialog(true);
  };

  // Close action confirmation dialog
  const closeActionDialog = () => {
    setShowActionDialog(false);
    setSelectedAction(null);
  };

  // Handle service action
  const handleConfirmAction = async () => {
    if (!selectedAction || !service) return;

    try {
      switch (selectedAction) {
        case "start":
          await startService(service.id).unwrap();
          break;
        case "stop":
          await stopService(service.id).unwrap();
          break;
        case "restart":
          await restartService(service.id).unwrap();
          break;
      }
      closeActionDialog();
      refetchService();
      refetchHealth();
    } catch (error) {
      console.error(`Failed to ${selectedAction} service:`, error);
    }
  };

  // Handle delete service
  const handleConfirmDelete = async () => {
    if (!service) return;

    try {
      await deleteService(service.id).unwrap();
      router.push("/services?success=service-deleted");
    } catch (error) {
      console.error("Failed to delete service:", error);
    }
  };

  // Loading state
  if (isLoadingService) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
              <p className="text-muted-foreground">
                Loading service details...
              </p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (serviceError || !service) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <Card className="w-full max-w-md">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <AlertCircle className="h-12 w-12 text-red-600 mx-auto" />
                  <h3 className="text-lg font-semibold">Service Not Found</h3>
                  <p className="text-sm text-muted-foreground">
                    The requested service could not be found.
                  </p>
                  <Button onClick={() => router.push("/services")}>
                    Back to Services
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/services")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="space-y-1">
              <h1 className="text-3xl font-bold text-foreground">
                {service.displayName}
              </h1>
              <p className="text-muted-foreground">{service.name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {service.status === "stopped" && (
              <Button
                variant="outline"
                className="flex items-center space-x-2"
                onClick={() => openActionDialog("start")}
                disabled={isStarting}
              >
                <Play className="h-4 w-4" />
                <span>Start</span>
              </Button>
            )}
            {service.status === "running" && (
              <>
                <Button
                  variant="outline"
                  className="flex items-center space-x-2"
                  onClick={() => openActionDialog("stop")}
                  disabled={isStopping}
                >
                  <Pause className="h-4 w-4" />
                  <span>Stop</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex items-center space-x-2"
                  onClick={() => openActionDialog("restart")}
                  disabled={isRestarting}
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Restart</span>
                </Button>
              </>
            )}
            <Button
              variant="outline"
              className="flex items-center space-x-2"
              onClick={() => router.push(`/services/${service.id}/edit`)}
              disabled
            >
              <Edit className="h-4 w-4" />
              <span>Edit</span>
            </Button>
            <Button
              variant="outline"
              className="flex items-center space-x-2 text-red-600 hover:text-red-700"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting || service.name === "api-gateway"}
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete</span>
            </Button>
          </div>
        </div>

        {/* Service Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Activity className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Status
                  </p>
                  <Badge className={getServiceStatusColor(service.status)}>
                    {service.status === "running" && (
                      <Power className="mr-1 h-3 w-3" />
                    )}
                    {service.status === "stopped" && (
                      <Pause className="mr-1 h-3 w-3" />
                    )}
                    {service.status === "degraded" && (
                      <AlertTriangle className="mr-1 h-3 w-3" />
                    )}
                    {service.status === "maintenance" && (
                      <Settings className="mr-1 h-3 w-3" />
                    )}
                    {service.status.charAt(0).toUpperCase() +
                      service.status.slice(1)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Uptime
                  </p>
                  <p className="text-xl font-bold">
                    {formatUptime(service.uptime)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Globe className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Port
                  </p>
                  <p className="text-xl font-bold font-mono">{service.port}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Package className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Version
                  </p>
                  <p className="text-xl font-bold font-mono">
                    v{service.version}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different sections */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
            <TabsTrigger value="statistics">Statistics</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Info className="h-5 w-5" />
                  <span>Service Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Service Name
                    </p>
                    <p className="font-mono">{service.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Display Name
                    </p>
                    <p>{service.displayName}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Port
                    </p>
                    <p className="font-mono">{service.port}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Version
                    </p>
                    <p className="font-mono">v{service.version}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Health Endpoint
                    </p>
                    <p className="font-mono">
                      {service.healthEndpoint || "/health"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Active
                    </p>
                    <Badge variant={service.isActive ? "default" : "secondary"}>
                      {service.isActive ? "Yes" : "No"}
                    </Badge>
                  </div>
                </div>
                {service.description && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Description
                    </p>
                    <p className="text-sm">{service.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Health Tab */}
          <TabsContent value="health" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Health Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingHealth ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : health ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {health.status === "healthy" && (
                          <CheckCircle className="h-8 w-8 text-green-600" />
                        )}
                        {health.status === "degraded" && (
                          <AlertTriangle className="h-8 w-8 text-yellow-600" />
                        )}
                        {health.status === "unhealthy" && (
                          <XCircle className="h-8 w-8 text-red-600" />
                        )}
                        <div>
                          <p className="text-lg font-semibold">
                            Overall Health
                          </p>
                          <p
                            className={`text-sm ${getHealthStatusColor(health.status)}`}
                          >
                            {health.status.charAt(0).toUpperCase() +
                              health.status.slice(1)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          Last Check
                        </p>
                        <p className="text-sm font-mono">
                          {new Date(health.lastCheck).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Component Health */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <Database className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm font-medium">Database</p>
                          </div>
                          <div
                            className={`mt-2 px-2 py-1 rounded-md text-sm ${getHealthStatusColor(health.components?.database || "unknown")}`}
                          >
                            {health.components?.database || "Unknown"}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <HardDrive className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm font-medium">Redis</p>
                          </div>
                          <div
                            className={`mt-2 px-2 py-1 rounded-md text-sm ${getHealthStatusColor(health.components?.redis || "unknown")}`}
                          >
                            {health.components?.redis || "Unknown"}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm font-medium">External API</p>
                          </div>
                          <div
                            className={`mt-2 px-2 py-1 rounded-md text-sm ${getHealthStatusColor(health.components?.externalAPI || "unknown")}`}
                          >
                            {health.components?.externalAPI || "Unknown"}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Health information not available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configuration Tab */}
          <TabsContent value="configuration" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>Configuration</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {service.configuration ? (
                  <div className="space-y-6">
                    {/* Environment */}
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Environment
                      </p>
                      <Badge variant="outline" className="text-sm">
                        {service.configuration.environment}
                      </Badge>
                    </div>

                    {/* Features */}
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Features
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {Object.entries(service.configuration.features).map(
                          ([feature, enabled]) => (
                            <div
                              key={feature}
                              className={`flex items-center space-x-2 p-2 rounded-md ${
                                enabled ? "bg-green-50" : "bg-gray-50"
                              }`}
                            >
                              {enabled ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-gray-400" />
                              )}
                              <span className="text-sm capitalize">
                                {feature.replace(/([A-Z])/g, " $1").trim()}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    </div>

                    {/* Limits */}
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Limits
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-3 bg-gray-50 rounded-md">
                          <p className="text-xs text-muted-foreground">
                            Max Requests/Min
                          </p>
                          <p className="text-lg font-semibold">
                            {service.configuration.limits.maxRequestsPerMinute}
                          </p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-md">
                          <p className="text-xs text-muted-foreground">
                            Max Connections
                          </p>
                          <p className="text-lg font-semibold">
                            {service.configuration.limits.maxConnections}
                          </p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-md">
                          <p className="text-xs text-muted-foreground">
                            Timeout (ms)
                          </p>
                          <p className="text-lg font-semibold">
                            {service.configuration.limits.timeout}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Dependencies */}
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Dependencies
                      </p>
                      {service.configuration.dependencies.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {service.configuration.dependencies.map((dep) => (
                            <Badge key={dep} variant="secondary">
                              <Layers className="mr-1 h-3 w-3" />
                              {dep}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No dependencies
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Configuration information not available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="statistics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Performance Statistics</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {service.statistics ? (
                  <div className="space-y-6">
                    {/* Request Statistics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <Zap className="h-4 w-4 text-blue-600" />
                            <p className="text-xs text-muted-foreground">
                              Total Requests
                            </p>
                          </div>
                          <p className="text-2xl font-bold">
                            {service.statistics.totalRequests.toLocaleString()}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <p className="text-xs text-muted-foreground">
                              Success Rate
                            </p>
                          </div>
                          <p className="text-2xl font-bold text-green-600">
                            {service.statistics.successRate}%
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <p className="text-xs text-muted-foreground">
                              Error Rate
                            </p>
                          </div>
                          <p className="text-2xl font-bold text-red-600">
                            {service.statistics.errorRate}%
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <Clock className="h-4 w-4 text-orange-600" />
                            <p className="text-xs text-muted-foreground">
                              Avg Response
                            </p>
                          </div>
                          <p className="text-2xl font-bold">
                            {service.statistics.averageResponseTime}ms
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Resource Usage */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {service.statistics.memory && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center space-x-2">
                              <HardDrive className="h-4 w-4" />
                              <span>Memory Usage</span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Used</span>
                                <span className="font-mono">
                                  {service.statistics.memory.used}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Limit</span>
                                <span className="font-mono">
                                  {service.statistics.memory.limit}
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                                <div
                                  className="bg-blue-600 h-2.5 rounded-full"
                                  style={{
                                    width: service.statistics.memory.percentage,
                                  }}
                                ></div>
                              </div>
                              <p className="text-xs text-muted-foreground text-right">
                                {service.statistics.memory.percentage} used
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      {service.statistics.cpu && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center space-x-2">
                              <Cpu className="h-4 w-4" />
                              <span>CPU Usage</span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Usage</span>
                                <span className="font-mono">
                                  {service.statistics.cpu.usage}%
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Cores</span>
                                <span className="font-mono">
                                  {service.statistics.cpu.cores}
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                                <div
                                  className={`h-2.5 rounded-full ${
                                    service.statistics.cpu.usage > 80
                                      ? "bg-red-600"
                                      : service.statistics.cpu.usage > 50
                                        ? "bg-yellow-600"
                                        : "bg-green-600"
                                  }`}
                                  style={{
                                    width: `${service.statistics.cpu.usage}%`,
                                  }}
                                ></div>
                              </div>
                              <p className="text-xs text-muted-foreground text-right">
                                {service.statistics.cpu.usage}% of{" "}
                                {service.statistics.cpu.cores} cores
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Statistics information not available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Confirmation Dialog */}
        <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                {selectedAction === "start" && (
                  <Play className="h-5 w-5 text-green-600" />
                )}
                {selectedAction === "stop" && (
                  <Pause className="h-5 w-5 text-yellow-600" />
                )}
                {selectedAction === "restart" && (
                  <RefreshCw className="h-5 w-5 text-blue-600" />
                )}
                <span>Confirm Action</span>
              </DialogTitle>
              <DialogDescription className="pt-4">
                <div className="space-y-3">
                  <p className="text-base">
                    Are you sure you want to{" "}
                    <span className="font-semibold">{selectedAction}</span> this
                    service?
                  </p>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm font-medium">
                      {service?.displayName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {service?.name}
                    </p>
                  </div>
                  {selectedAction === "stop" && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-700">
                        <strong>Warning:</strong> Stopping this service may
                        affect dependent services.
                      </p>
                    </div>
                  )}
                  {selectedAction === "restart" && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-700">
                        The service will be temporarily unavailable during
                        restart.
                      </p>
                    </div>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={closeActionDialog}
                disabled={isStarting || isStopping || isRestarting}
              >
                Cancel
              </Button>
              <Button
                variant={selectedAction === "stop" ? "destructive" : "default"}
                onClick={handleConfirmAction}
                disabled={isStarting || isStopping || isRestarting}
                className={
                  selectedAction === "start"
                    ? "bg-green-600 hover:bg-green-700"
                    : selectedAction === "restart"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : ""
                }
              >
                {isStarting || isStopping || isRestarting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {selectedAction === "start" && "Start Service"}
                    {selectedAction === "stop" && "Stop Service"}
                    {selectedAction === "restart" && "Restart Service"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Trash2 className="h-5 w-5 text-red-600" />
                <span>Confirm Deletion</span>
              </DialogTitle>
              <DialogDescription className="pt-4">
                <div className="space-y-4">
                  <p className="text-base font-semibold text-red-700">
                    Are you sure you want to permanently delete this service?
                  </p>
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800 font-medium">
                      {service?.displayName}
                    </p>
                    <p className="text-xs text-red-600 mt-1">{service?.name}</p>
                  </div>
                  <div className="p-4 bg-red-100 border-2 border-red-300 rounded-lg">
                    <p className="text-sm text-red-900 font-semibold mb-2">
                      ⚠️ Warning: This action cannot be undone!
                    </p>
                    <ul className="text-sm text-red-800 list-disc list-inside space-y-1">
                      <li>
                        The service configuration will be permanently deleted
                      </li>
                      <li>All service data and logs will be removed</li>
                      <li>Dependent services may be affected</li>
                    </ul>
                  </div>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Service
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
