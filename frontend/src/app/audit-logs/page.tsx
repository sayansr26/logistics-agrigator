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
import { PageContainer, PageHeader } from "@/components/shared";
import {
  useGetAdminAuditLogsQuery,
  useGetAdminRuntimeLogsQuery,
  useGetClientAuditLogsQuery,
  useGetAvailableAuditActionsQuery,
  type AuditEvent,
  type RuntimeLogLine,
} from "@/store/api/endpoints/logsApi";
import { useAppSelector } from "@/store/hooks";
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
} from "lucide-react";

export default function AuditLogsPage() {
  const { user, token } = useAppSelector((state) => state.auth);

  const getRoleFromToken = (token: string | null) => {
    if (!token) return null;
    try {
      const payload = token.split(".")[1];
      return JSON.parse(atob(payload)).role || null;
    } catch {
      return null;
    }
  };

  const tokenRole = getRoleFromToken(token);
  const isSuperadmin =
    tokenRole === "superadmin" || user?.role === "superadmin";
  const isRoleDetermined = token !== null && tokenRole !== null;

  const [activeTab, setActiveTab] = useState<"audit" | "runtime">("audit");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedAction, setSelectedAction] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedResource, setSelectedResource] = useState<string>("");
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursors, setPrevCursors] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditEvent | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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

  const {
    data: adminAuditData,
    isLoading: isLoadingAdminAudit,
    isError: isAuditError,
    refetch: refetchAdminAudit,
  } = useGetAdminAuditLogsQuery(queryParams, {
    skip: !isRoleDetermined || !isSuperadmin || activeTab !== "audit",
  });
  const {
    data: clientAuditData,
    isLoading: isLoadingClientAudit,
    refetch: refetchClientAudit,
  } = useGetClientAuditLogsQuery(queryParams, {
    skip: !isRoleDetermined || isSuperadmin || activeTab !== "audit",
  });
  const { data: availableActionsData, isLoading: isLoadingActions } =
    useGetAvailableAuditActionsQuery(undefined, {
      skip: activeTab !== "audit",
    });
  const {
    data: runtimeData,
    isLoading: isLoadingRuntime,
    isError: isRuntimeError,
    refetch: refetchRuntime,
  } = useGetAdminRuntimeLogsQuery(queryParams, {
    skip: !isRoleDetermined || !isSuperadmin || activeTab !== "runtime",
  });

  const availableActions = availableActionsData?.data?.actions || {};
  const allActionList = availableActionsData?.data?.allActions || [];
  const auditData = isSuperadmin ? adminAuditData : clientAuditData;
  const auditLogs = auditData?.data || [];
  const auditPagination = auditData?.pagination;
  const runtimeLogs = runtimeData?.data || [];

  const formatDateTime = (dateString: string) =>
    new Date(dateString).toLocaleString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const handleNextPage = () => {
    if (auditPagination?.nextCursor) {
      setPrevCursors([...prevCursors, nextCursor || ""]);
      setNextCursor(auditPagination.nextCursor);
    }
  };

  const handlePrevPage = () => {
    if (prevCursors.length > 0) {
      const newPrevCursors = [...prevCursors];
      setNextCursor(newPrevCursors.pop() || null);
      setPrevCursors(newPrevCursors);
    }
  };

  const handleFilterChange = () => {
    setNextCursor(null);
    setPrevCursors([]);
  };

  const categories = [
    "CRUD",
    "AUTH",
    "USER",
    "PROFILE",
    "CLIENT",
    "OUTLET",
    "ADDRESS",
    "INVITATION",
    "SHIPMENT",
    "NDR",
    "LABEL_MANIFEST",
    "PICKUP",
    "PARTNER",
    "PINCODE",
    "WALLET",
    "LICENSE",
    "SUPPORT",
    "SYSTEM",
  ];
  const resources = [
    "User",
    "Client",
    "Outlet",
    "UserProfile",
    "Address",
    "UserInvitation",
    "Shipment",
    "Partner",
    "PartnerChannel",
    "PincodeType",
    "Wallet",
    "WalletTransaction",
    "PayoutRequest",
    "License",
    "LicenseActivation",
    "SupportTicket",
    "NDRCase",
    "PickupSchedule",
    "ShippingLabel",
    "Manifest",
  ];
  const services = [
    "auth-service",
    "user-service",
    "shipment-service",
    "partner-service",
    "wallet-service",
    "license-service",
  ];

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeader
          title="Audit Logs"
          description={
            isSuperadmin
              ? "View system-wide audit trail and runtime logs"
              : "View your organization's audit trail"
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>System Logs</CardTitle>
            <CardDescription>
              {isSuperadmin
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
                {isSuperadmin && (
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
                    {services.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s
                          .replace("-", " ")
                          .replace(/\b\w/g, (c) => c.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {activeTab === "audit" && (
                  <>
                    <Select
                      value={selectedCategory}
                      onValueChange={(v) => {
                        setSelectedCategory(v);
                        setSelectedAction("");
                        handleFilterChange();
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={selectedAction || "all"}
                      onValueChange={(v) => {
                        setSelectedAction(v === "all" ? "" : v);
                        handleFilterChange();
                      }}
                      disabled={isLoadingActions}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            isLoadingActions ? "Loading..." : "Action"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Actions</SelectItem>
                        {(selectedCategory === "all"
                          ? allActionList
                          : availableActions[selectedCategory] || []
                        ).map((action: string) => (
                          <SelectItem key={action} value={action}>
                            {action
                              .replace(/_/g, " ")
                              .toLowerCase()
                              .replace(/\b\w/g, (c) => c.toUpperCase())}
                          </SelectItem>
                        ))}
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
                        {resources.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
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
                        isSuperadmin
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
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[180px]">Timestamp</TableHead>
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
                                  onClick={() => {
                                    setSelectedLog(log);
                                    setIsDialogOpen(true);
                                  }}
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

              {/* Runtime Logs Tab */}
              {isSuperadmin && (
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
                  ) : runtimeLogs.length === 0 ? (
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
                    <p className="text-sm font-medium">
                      {selectedLog.resource}
                    </p>
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
                      <p className="text-sm font-mono break-all">
                        {selectedLog.resourceId}
                      </p>
                    </div>
                  )}
                  {selectedLog.ipAddress && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        IP Address
                      </Label>
                      <p className="text-sm font-mono">
                        {selectedLog.ipAddress}
                      </p>
                    </div>
                  )}
                </div>
                {selectedLog.changes && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Changes
                    </Label>
                    <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.changes, null, 2)}
                    </pre>
                  </div>
                )}
                {selectedLog.metadata && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Metadata
                    </Label>
                    <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageContainer>
    </DashboardLayout>
  );
}
