"use client";

import { useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useGetAdminAuditLogsQuery,
  useGetAdminRuntimeLogsQuery,
  useGetClientAuditLogsQuery,
  type AuditEvent,
  type RuntimeLogLine,
} from "@/store/api/endpoints/logsApi";
import { useAppSelector } from "@/store/hooks";
import { useRole } from "@/hooks/useRole";
import {
  FileText,
  ScrollText,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Code,
  Server,
  Calendar,
  Filter,
  X,
} from "lucide-react";

export default function AuditLogsPage() {
  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "Audit Logs" },
  ];

  const { user, token, isAuthenticated } = useAppSelector(
    (state) => state.auth,
  );

  // Check role from JWT token first (most reliable source)
  const getRoleFromToken = (token: string | null) => {
    if (!token) return null;
    try {
      const payload = token.split(".")[1];
      const decoded = JSON.parse(atob(payload));
      return decoded.role || null;
    } catch {
      return null;
    }
  };

  const tokenRole = getRoleFromToken(token);
  const isSuperadminFromToken = tokenRole === "superadmin";

  // Also check from user object as backup
  const isSuperadminFromUser = user?.role === "superadmin";

  // Use token role as primary source (always available after login)
  const actuallyIsSuperadmin = isSuperadminFromToken || isSuperadminFromUser;

  console.log("[AuditLogsPage] Role check:", {
    tokenRole,
    isSuperadminFromToken,
    userRole: user?.role,
    isSuperadminFromUser,
    actuallyIsSuperadmin,
    hasUser: !!user,
    hasToken: !!token,
    isAuthenticated,
  });

  // State for filters
  const [activeTab, setActiveTab] = useState<"audit" | "runtime">("audit");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedAction, setSelectedAction] = useState<string>("");
  const [selectedResource, setSelectedResource] = useState<string>("");
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursors, setPrevCursors] = useState<string[]>([]);

  // State for log details dialog
  const [selectedLog, setSelectedLog] = useState<AuditEvent | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Build query params
  const queryParams = {
    limit: 50,
    cursor: nextCursor || undefined,
    search: searchTerm || undefined,
    service: selectedService || undefined,
    action: selectedAction || undefined,
    resource: selectedResource || undefined,
    level: selectedLevel || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };

  // Don't make any API calls until we know the user's role from token
  // This prevents both client and admin queries from running on initial render
  const isRoleDetermined = token !== null && tokenRole !== null;

  // RTK Query hooks - only run after role is determined
  const {
    data: adminAuditData,
    isLoading: isLoadingAdminAudit,
    isError: isAuditError,
    refetch: refetchAdminAudit,
  } = useGetAdminAuditLogsQuery(queryParams, {
    skip: !isRoleDetermined || !actuallyIsSuperadmin || activeTab !== "audit",
  });

  const {
    data: clientAuditData,
    isLoading: isLoadingClientAudit,
    refetch: refetchClientAudit,
  } = useGetClientAuditLogsQuery(queryParams, {
    skip: !isRoleDetermined || actuallyIsSuperadmin || activeTab !== "audit",
  });

  const {
    data: runtimeData,
    isLoading: isLoadingRuntime,
    isError: isRuntimeError,
    refetch: refetchRuntime,
  } = useGetAdminRuntimeLogsQuery(queryParams, {
    skip: !isRoleDetermined || !actuallyIsSuperadmin || activeTab !== "runtime",
  });

  // Get appropriate data based on user role and tab
  const auditData = actuallyIsSuperadmin ? adminAuditData : clientAuditData;
  const auditLogs = auditData?.data || [];
  const auditPagination = auditData?.pagination;
  const runtimeLogs = runtimeData?.data || [];

  // Format date/time
  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Handle next page
  const handleNextPage = () => {
    if (auditPagination?.nextCursor) {
      setPrevCursors([...prevCursors, nextCursor || ""]);
      setNextCursor(auditPagination.nextCursor);
    }
  };

  // Handle previous page
  const handlePrevPage = () => {
    if (prevCursors.length > 0) {
      const newPrevCursors = [...prevCursors];
      const previousCursor = newPrevCursors.pop();
      setPrevCursors(newPrevCursors);
      setNextCursor(previousCursor || null);
    }
  };

  // Reset pagination when filters change
  const handleFilterChange = () => {
    setNextCursor(null);
    setPrevCursors([]);
  };

  // Handle viewing log details
  const handleViewDetails = (log: AuditEvent) => {
    setSelectedLog(log);
    setIsDialogOpen(true);
  };

  // Handle closing dialog
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedLog(null);
  };

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Audit Logs
            </h1>
            <p className="text-muted-foreground">
              {actuallyIsSuperadmin
                ? "View system-wide audit trail and runtime logs"
                : "View your organization's audit trail"}
            </p>
          </div>
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader>
            <CardTitle>System Logs</CardTitle>
            <CardDescription>
              {actuallyIsSuperadmin
                ? "Monitor all system activities and debug issues"
                : "Track changes and activities in your organization"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "audit" | "runtime")}
            >
              <TabsList className="mb-4">
                <TabsTrigger value="audit" className="gap-2">
                  <ScrollText className="h-4 w-4" />
                  Audit Trail
                </TabsTrigger>
                {actuallyIsSuperadmin && (
                  <TabsTrigger value="runtime" className="gap-2">
                    <Server className="h-4 w-4" />
                    Runtime Logs
                  </TabsTrigger>
                )}
              </TabsList>

              {/* Filters */}
              <div className="mb-6 grid gap-4 md:grid-cols-4 lg:grid-cols-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      handleFilterChange();
                    }}
                    className="pl-9"
                  />
                </div>

                <Select
                  value={selectedService || "all"}
                  onValueChange={(v) => {
                    setSelectedService(v === "all" ? "" : v);
                    handleFilterChange();
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Service" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Services</SelectItem>
                    <SelectItem value="auth-service">Auth Service</SelectItem>
                    <SelectItem value="user-service">User Service</SelectItem>
                    <SelectItem value="shipment-service">
                      Shipment Service
                    </SelectItem>
                    <SelectItem value="partner-service">
                      Partner Service
                    </SelectItem>
                    <SelectItem value="wallet-service">
                      Wallet Service
                    </SelectItem>
                    <SelectItem value="license-service">
                      License Service
                    </SelectItem>
                  </SelectContent>
                </Select>

                {activeTab === "audit" && (
                  <>
                    <Select
                      value={selectedAction || "all"}
                      onValueChange={(v) => {
                        setSelectedAction(v === "all" ? "" : v);
                        handleFilterChange();
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Action" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Actions</SelectItem>
                        <SelectItem value="CREATE">Create</SelectItem>
                        <SelectItem value="UPDATE">Update</SelectItem>
                        <SelectItem value="DELETE">Delete</SelectItem>
                        <SelectItem value="LOGIN">Login</SelectItem>
                        <SelectItem value="LOGOUT">Logout</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={selectedResource || "all"}
                      onValueChange={(v) => {
                        setSelectedResource(v === "all" ? "" : v);
                        handleFilterChange();
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Resource" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Resources</SelectItem>
                        <SelectItem value="User">Users</SelectItem>
                        <SelectItem value="Client">Clients</SelectItem>
                        <SelectItem value="Shipment">Shipments</SelectItem>
                        <SelectItem value="Partner">Partners</SelectItem>
                        <SelectItem value="Wallet">Wallet</SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                )}

                {activeTab === "runtime" && (
                  <Select
                    value={selectedLevel || "all"}
                    onValueChange={(v) => {
                      setSelectedLevel(v === "all" ? "" : v);
                      handleFilterChange();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Log Level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="warn">Warning</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="debug">Debug</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    handleFilterChange();
                  }}
                />

                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    handleFilterChange();
                  }}
                />
              </div>

              {/* Audit Trail Tab */}
              <TabsContent value="audit">
                {isLoadingAdminAudit || isLoadingClientAudit ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : isAuditError ? (
                  <div className="flex flex-col items-center justify-center py-12 text-red-500">
                    <AlertCircle className="h-8 w-8 mb-2" />
                    <p>Failed to load audit logs</p>
                    <Button
                      variant="outline"
                      onClick={() =>
                        actuallyIsSuperadmin
                          ? refetchAdminAudit()
                          : refetchClientAudit()
                      }
                      className="mt-4"
                    >
                      Retry
                    </Button>
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">No audit logs found</p>
                    <p className="text-sm">Try adjusting your filters</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[180px]">
                              Timestamp
                            </TableHead>
                            <TableHead>Service</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Resource</TableHead>
                            <TableHead>User ID</TableHead>
                            <TableHead className="w-[100px]">Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditLogs.map((log: AuditEvent) => (
                            <TableRow key={log.id}>
                              <TableCell className="text-sm">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  {formatDateTime(log.timestamp)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{log.service}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    log.action === "DELETE"
                                      ? "destructive"
                                      : log.action === "CREATE"
                                        ? "default"
                                        : "secondary"
                                  }
                                >
                                  {log.action}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {log.resource}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {log.userId?.slice(0, 8) || "System"}...
                              </TableCell>
                              <TableCell>
                                {(log.changes || log.metadata) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => handleViewDetails(log)}
                                  >
                                    <Code className="h-3 w-3 mr-1" />
                                    View
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {auditLogs.length} logs
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handlePrevPage}
                          disabled={prevCursors.length === 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleNextPage}
                          disabled={!auditPagination?.hasMore}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>

              {/* Runtime Logs Tab (Superadmin Only) */}
              {actuallyIsSuperadmin && (
                <TabsContent value="runtime">
                  {isLoadingRuntime ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : isRuntimeError ? (
                    <div className="flex flex-col items-center justify-center py-12 text-red-500">
                      <AlertCircle className="h-8 w-8 mb-2" />
                      <p>Failed to load runtime logs</p>
                      <Button
                        variant="outline"
                        onClick={() => refetchRuntime()}
                        className="mt-4"
                      >
                        Retry
                      </Button>
                    </div>
                  ) : !Array.isArray(runtimeLogs) ||
                    runtimeLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Server className="h-12 w-12 mb-4 opacity-50" />
                      <p className="text-lg font-medium">
                        No runtime logs found
                      </p>
                      <p className="text-sm">Try adjusting your filters</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {runtimeLogs.map((serviceData: any) => (
                        <Card key={serviceData.service}>
                          <CardHeader className="py-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Server className="h-4 w-4" />
                              {serviceData.service}
                              <Badge variant="secondary" className="ml-auto">
                                {serviceData.logs?.length || 0} lines
                              </Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="bg-muted rounded-md p-3 font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
                              {serviceData.logs?.map(
                                (log: RuntimeLogLine, idx: number) => (
                                  <div
                                    key={idx}
                                    className="whitespace-pre-wrap"
                                  >
                                    {log.raw ||
                                      `[${log.line}] ${log.parsed?.message || ""}`}
                                  </div>
                                ),
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Log Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Audit Log Details
            </DialogTitle>
            <DialogDescription>
              Detailed information about this audit event
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Timestamp
                  </Label>
                  <p className="text-sm font-medium">
                    {formatDateTime(selectedLog.timestamp)}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Service
                  </Label>
                  <p className="text-sm font-medium">{selectedLog.service}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Action
                  </Label>
                  <Badge
                    variant={
                      selectedLog.action === "DELETE"
                        ? "destructive"
                        : selectedLog.action === "CREATE"
                          ? "default"
                          : "secondary"
                    }
                  >
                    {selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Resource
                  </Label>
                  <p className="text-sm font-medium">{selectedLog.resource}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    User ID
                  </Label>
                  <p className="text-sm font-mono text-muted-foreground">
                    {selectedLog.userId || "System"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Client ID
                  </Label>
                  <p className="text-sm font-mono text-muted-foreground">
                    {selectedLog.clientId || "N/A"}
                  </p>
                </div>
                {selectedLog.resourceId && (
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">
                      Resource ID
                    </Label>
                    <p className="text-sm font-mono text-xs break-all">
                      {selectedLog.resourceId}
                    </p>
                  </div>
                )}
                {selectedLog.ipAddress && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      IP Address
                    </Label>
                    <p className="text-sm font-mono">{selectedLog.ipAddress}</p>
                  </div>
                )}
                {selectedLog.userAgent && (
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">
                      User Agent
                    </Label>
                    <p className="text-sm text-muted-foreground break-all">
                      {selectedLog.userAgent}
                    </p>
                  </div>
                )}
              </div>

              {/* Changes */}
              {selectedLog.changes &&
                Object.keys(selectedLog.changes).length > 0 && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">
                      Changes
                    </Label>
                    <div className="bg-muted rounded-md p-3">
                      <pre className="text-xs overflow-x-auto">
                        {JSON.stringify(selectedLog.changes, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

              {/* Metadata */}
              {selectedLog.metadata &&
                Object.keys(selectedLog.metadata).length > 0 && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">
                      Metadata
                    </Label>
                    <div className="bg-muted rounded-md p-3">
                      <pre className="text-xs overflow-x-auto">
                        {JSON.stringify(selectedLog.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
