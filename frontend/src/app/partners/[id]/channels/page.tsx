"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Trash2,
  Pencil,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Key,
  Truck,
  Network,
  MoreVertical,
  Shield,
  GitBranch,
} from "lucide-react";
import { useGetPartnerByIdQuery } from "@/store/api/endpoints/partnersApi";
import {
  useListPartnerChannelsQuery,
  useCreateChannelsMutation,
  useUpdateChannelMutation,
  useTestChannelMutation,
  useDeleteChannelMutation,
  type ChannelConfig,
  type AggregatorType,
} from "@/store/api/endpoints/partnerChannelApi";
import { ServiceChannelsPanel } from "@/components/partners/service-channels-panel";
import { usePermission } from "@/hooks/usePermission";

// ===========================
// Constants & Types
// ===========================

const AGGREGATOR_OPTIONS: {
  value: string;
  label: string;
  description: string;
}[] = [
  {
    value: "DELHIVERY",
    label: "Delhivery (B2C)",
    description: "Express Parcel API — token auth",
  },
  {
    value: "DELHIVERY_B2B",
    label: "Delhivery B2B (LTL)",
    description: "Freight API — username/password (JWT)",
  },
  { value: "BLUEDART", label: "BlueDart", description: "BlueDart API" },
];

interface ChannelFormData {
  channelName: string;
  apiUrl: string;
  apiKey: string;
  isActive: boolean;
  isPrimary: boolean;
  priority: number;
  aggregatorType: AggregatorType;
  delhiveryClientName: string;
  licenseKey: string;
  loginId: string;
  customerCode: string;
  b2bUsername: string;
  b2bPassword: string;
  b2bClientId: string;
  webhookSecret: string;
}

const emptyForm: ChannelFormData = {
  channelName: "",
  apiUrl: "",
  apiKey: "",
  isActive: true,
  isPrimary: false,
  priority: 1,
  aggregatorType: "DELHIVERY",
  delhiveryClientName: "",
  licenseKey: "",
  loginId: "",
  customerCode: "",
  b2bUsername: "",
  b2bPassword: "",
  b2bClientId: "",
  webhookSecret: "",
};

// ===========================
// Helper Utilities
// ===========================

function buildChannelPayload(form: ChannelFormData): ChannelConfig {
  const base: ChannelConfig = {
    channelName: form.channelName.trim(),
    apiUrl: "",
    isActive: form.isActive,
    isPrimary: form.isPrimary,
    priority: form.priority,
    aggregatorType: form.aggregatorType,
    webhookSecret: form.webhookSecret.trim() || undefined,
  };

  switch (form.aggregatorType) {
    case "DELHIVERY":
      base.apiKey = form.apiKey.trim() || undefined;
      base.aggregatorConfig = {
        clientName: form.delhiveryClientName.trim(),
      };
      break;
    case "DELHIVERY_B2B":
      base.apiKey = undefined;
      base.aggregatorConfig = {
        username: form.b2bUsername.trim(),
        password: form.b2bPassword,
        clientId: form.b2bClientId.trim() || undefined,
      };
      break;
    case "BLUEDART":
      base.apiKey = undefined;
      base.aggregatorConfig = {
        licenseKey: form.licenseKey.trim(),
        loginId: form.loginId.trim(),
        customerCode: form.customerCode.trim(),
      };
      break;
    default:
      base.apiKey = form.apiKey.trim() || undefined;
      base.aggregatorConfig = {};
      break;
  }

  return base;
}

function channelToFormData(channel: ChannelConfig): ChannelFormData {
  const config = (channel.aggregatorConfig ?? {}) as Record<string, string>;
  return {
    channelName: channel.channelName,
    apiUrl: channel.apiUrl ?? "",
    apiKey: channel.apiKey ?? "",
    isActive: channel.isActive,
    isPrimary: channel.isPrimary,
    priority: channel.priority,
    aggregatorType: channel.aggregatorType ?? "DELHIVERY",
    delhiveryClientName: config.clientName ?? "",
    licenseKey: config.licenseKey ?? "",
    loginId: config.loginId ?? "",
    customerCode: config.customerCode ?? "",
    b2bUsername: config.username ?? "",
    b2bPassword: config.password ?? "",
    b2bClientId: config.clientId ?? "",
    webhookSecret: channel.webhookSecret ?? "",
  };
}

// ===========================
// Sub-components
// ===========================

function AggregatorConfigFields({
  aggregatorType,
  form,
  onChange,
}: {
  aggregatorType: AggregatorType;
  form: ChannelFormData;
  onChange: (field: keyof ChannelFormData, value: string) => void;
}) {
  if (aggregatorType === "DELHIVERY") {
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="apiKey">
            API Token <span className="text-red-500">*</span>
          </Label>
          <Input
            id="apiKey"
            type="password"
            placeholder="Enter Delhivery API token"
            value={form.apiKey}
            onChange={(e) => onChange("apiKey", e.target.value)}
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground">
            Delhivery One API access token (Authorization: Token &lt;token&gt;)
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="delhiveryClientName">
            Client Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="delhiveryClientName"
            type="text"
            placeholder="Exact Delhivery One registered client name"
            value={form.delhiveryClientName}
            onChange={(e) => onChange("delhiveryClientName", e.target.value)}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Must exactly match the registered client/seller name in Delhivery
            One
          </p>
        </div>
      </div>
    );
  }

  if (aggregatorType === "DELHIVERY_B2B") {
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="b2bUsername">
            API Username <span className="text-red-500">*</span>
          </Label>
          <Input
            id="b2bUsername"
            type="text"
            placeholder="Delhivery B2B API username"
            value={form.b2bUsername}
            onChange={(e) => onChange("b2bUsername", e.target.value)}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            LTL API credential (separate from B2C token; JWT login)
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="b2bPassword">
            API Password <span className="text-red-500">*</span>
          </Label>
          <Input
            id="b2bPassword"
            type="password"
            placeholder="Delhivery B2B API password"
            value={form.b2bPassword}
            onChange={(e) => onChange("b2bPassword", e.target.value)}
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground">
            Set via the LTL forgot-password flow — not the Delhivery One panel
            password
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="b2bClientId">Client ID</Label>
          <Input
            id="b2bClientId"
            type="text"
            placeholder="Optional — B2B client/warehouse ID"
            value={form.b2bClientId}
            onChange={(e) => onChange("b2bClientId", e.target.value)}
            autoComplete="off"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Pickup location is chosen per shipment during booking — it must match
          a warehouse registered in Delhivery One (no warehouse config needed
          here).
        </p>
      </div>
    );
  }

  if (aggregatorType === "BLUEDART") {
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="licenseKey">
            License Key <span className="text-red-500">*</span>
          </Label>
          <Input
            id="licenseKey"
            type="password"
            placeholder="Enter BlueDart license key"
            value={form.licenseKey}
            onChange={(e) => onChange("licenseKey", e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loginId">
            Login ID <span className="text-red-500">*</span>
          </Label>
          <Input
            id="loginId"
            type="text"
            placeholder="Enter BlueDart login ID"
            value={form.loginId}
            onChange={(e) => onChange("loginId", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="customerCode">
            Customer Code <span className="text-red-500">*</span>
          </Label>
          <Input
            id="customerCode"
            type="text"
            placeholder="Enter BlueDart customer code"
            value={form.customerCode}
            onChange={(e) => onChange("customerCode", e.target.value)}
          />
        </div>
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      No additional configuration required for this aggregator type.
    </p>
  );
}

function ChannelCard({
  channel,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  channel: ChannelConfig;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (channel: ChannelConfig) => void;
  onDelete: (channelId: string) => void;
}) {
  const aggregatorType = channel.aggregatorType ?? "NONE";
  const config = (channel.aggregatorConfig ?? {}) as Record<string, string>;

  const credentialStatus = (() => {
    if (aggregatorType === "DELHIVERY") {
      return channel.apiKey ? "API Token configured" : "API Token missing";
    }
    if (aggregatorType === "DELHIVERY_B2B") {
      return config.username && config.password
        ? `B2B login: ${config.username}`
        : "B2B credentials incomplete";
    }
    if (aggregatorType === "BLUEDART") {
      if (config.loginId && config.customerCode) {
        return `Login: ${config.loginId} | Customer: ${config.customerCode}`;
      }
      return "Credentials incomplete";
    }
    return channel.apiKey ? "API Key configured" : "No credentials";
  })();

  const isCredentialSet =
    aggregatorType === "DELHIVERY"
      ? !!channel.apiKey
      : aggregatorType === "DELHIVERY_B2B"
        ? !!(config.username && config.password)
        : aggregatorType === "BLUEDART"
          ? !!(config.loginId && config.customerCode)
          : !!channel.apiKey;

  return (
    <Card className="group relative">
      <CardContent className="p-5">
        {/* Row 1: Name + Actions */}
        <div className="flex items-start justify-between mb-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base">{channel.channelName}</h3>
              {channel.isPrimary && (
                <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0">
                  Primary
                </Badge>
              )}
            </div>
            <Badge
              variant="outline"
              className={`text-[11px] px-2 py-0.5 ${
                aggregatorType === "DELHIVERY"
                  ? "border-blue-200 text-blue-700 bg-blue-50"
                  : aggregatorType === "BLUEDART"
                    ? "border-indigo-200 text-indigo-700 bg-indigo-50"
                    : "border-gray-200 text-gray-600"
              }`}
            >
              <Truck className="h-3 w-3 mr-1" />
              {aggregatorType}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5">
            {channel.isActive ? (
              <Badge
                variant="outline"
                className="border-green-200 text-green-700 bg-green-50 text-[11px] px-2 py-0.5"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
                <XCircle className="h-3 w-3 mr-1" />
                Inactive
              </Badge>
            )}
            {(canEdit || canDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  {canEdit && (
                    <DropdownMenuItem onClick={() => onEdit(channel)}>
                      <Pencil className="h-3.5 w-3.5 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <DropdownMenuItem
                      onClick={() => channel.id && onDelete(channel.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Row 2: Credentials */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Key
            className={`h-3.5 w-3.5 shrink-0 ${isCredentialSet ? "text-green-500" : "text-orange-400"}`}
          />
          <span className="truncate">{credentialStatus}</span>
        </div>

        {/* Row 3: Meta */}
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Network className="h-3 w-3" />
            Priority {channel.priority}
          </span>
          {channel.webhookSecret && (
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Webhook set
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ===========================
// Main Page Component
// ===========================

export default function ManageChannelsPage() {
  const params = useParams();
  const partnerId = params.id as string;

  const [activeTab, setActiveTab] = useState("routing");
  const [showDialog, setShowDialog] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ChannelConfig | null>(
    null,
  );
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(
    null,
  );
  const [form, setForm] = useState<ChannelFormData>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const { hasPermission } = usePermission();
  const canCreate = hasPermission("partner", "create", "all");
  const canEdit = hasPermission("partner", "update", "all");
  const canDelete = hasPermission("partner", "delete", "all");

  const { data: partnerData, isLoading: isLoadingPartner } =
    useGetPartnerByIdQuery(partnerId, { skip: !partnerId });

  const {
    data: channelsData,
    isLoading: isLoadingChannels,
    error: channelsError,
    refetch,
  } = useListPartnerChannelsQuery(partnerId, { skip: !partnerId });

  const [createChannels, { isLoading: isCreating }] =
    useCreateChannelsMutation();
  const [updateChannel, { isLoading: isUpdating }] = useUpdateChannelMutation();
  const [deleteChannel, { isLoading: isDeleting }] = useDeleteChannelMutation();
  const [testChannel, { isLoading: isTesting }] = useTestChannelMutation();

  const partner = partnerData?.data?.partner;
  const channels = channelsData?.data?.channels ?? [];
  const isSaving = isCreating || isUpdating;

  // Form helpers
  function handleFieldChange(field: keyof ChannelFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormError(null);
    setTestResult(null);
  }

  function handleAggregatorChange(value: string) {
    setForm((prev) => ({
      ...prev,
      aggregatorType: value,
      apiUrl: "",
      apiKey: "",
      delhiveryClientName: "",
      licenseKey: "",
      loginId: "",
      customerCode: "",
      b2bUsername: "",
      b2bPassword: "",
      b2bClientId: "",
    }));
    setFormError(null);
    setTestResult(null);
  }

  function openAddDialog() {
    setEditingChannel(null);
    setForm(emptyForm);
    setFormError(null);
    setTestResult(null);
    setShowDialog(true);
  }

  function openEditDialog(channel: ChannelConfig) {
    setEditingChannel(channel);
    setForm(channelToFormData(channel));
    setFormError(null);
    setTestResult(null);
    setShowDialog(true);
  }

  function closeDialog() {
    setShowDialog(false);
    setEditingChannel(null);
    setForm(emptyForm);
    setFormError(null);
    setTestResult(null);
  }

  // Validate only the credential fields needed for a live connection test
  function validateCredentialsForTest(): string | null {
    if (form.aggregatorType === "DELHIVERY") {
      if (!form.apiKey.trim()) return "Enter the API Token to test.";
      if (!form.delhiveryClientName.trim())
        return "Enter the Client Name to test.";
    }
    if (form.aggregatorType === "DELHIVERY_B2B") {
      if (!form.b2bUsername.trim()) return "Enter the API Username to test.";
      if (!form.b2bPassword) return "Enter the API Password to test.";
    }
    if (form.aggregatorType === "BLUEDART") {
      if (!form.licenseKey.trim()) return "Enter the License Key to test.";
      if (!form.loginId.trim()) return "Enter the Login ID to test.";
      if (!form.customerCode.trim()) return "Enter the Customer Code to test.";
    }
    return null;
  }

  async function handleTest() {
    const credentialError = validateCredentialsForTest();
    if (credentialError) {
      setTestResult(null);
      setFormError(credentialError);
      return;
    }

    setFormError(null);
    setTestResult(null);

    const payload = buildChannelPayload(form);

    try {
      const response = await testChannel({
        aggregatorType: payload.aggregatorType ?? form.aggregatorType,
        apiUrl: payload.apiUrl || undefined,
        apiKey: payload.apiKey,
        aggregatorConfig: payload.aggregatorConfig,
      }).unwrap();
      setTestResult({
        success: response.data.success,
        message: response.data.message,
      });
    } catch (err: unknown) {
      const errorMessage =
        err &&
        typeof err === "object" &&
        "data" in err &&
        err.data &&
        typeof err.data === "object" &&
        "error" in err.data &&
        err.data.error &&
        typeof err.data.error === "object" &&
        "message" in err.data.error
          ? String((err.data.error as { message: string }).message)
          : "Connection test failed. Please try again.";
      setTestResult({ success: false, message: errorMessage });
    }
  }

  // Validation
  function validateForm(): string | null {
    if (!form.channelName.trim()) return "Channel name is required.";

    if (form.aggregatorType === "DELHIVERY") {
      if (!editingChannel && !form.apiKey.trim())
        return "API Token is required for Delhivery.";
      if (!form.delhiveryClientName.trim())
        return "Client Name is required for Delhivery.";
    }

    if (form.aggregatorType === "DELHIVERY_B2B") {
      if (!form.b2bUsername.trim())
        return "API Username is required for Delhivery B2B.";
      if (!editingChannel && !form.b2bPassword)
        return "API Password is required for Delhivery B2B.";
    }

    if (form.aggregatorType === "BLUEDART") {
      if (!editingChannel && !form.licenseKey.trim())
        return "License Key is required for BlueDart.";
      if (!form.loginId.trim()) return "Login ID is required for BlueDart.";
      if (!form.customerCode.trim())
        return "Customer Code is required for BlueDart.";
    }

    return null;
  }

  // Mutations
  async function handleSave() {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const payload = buildChannelPayload(form);

    try {
      if (editingChannel?.id) {
        await updateChannel({
          partnerId,
          channelId: editingChannel.id,
          updates: payload,
        }).unwrap();
      } else {
        await createChannels({
          partnerId,
          channels: [payload],
        }).unwrap();
      }
      closeDialog();
    } catch (err: unknown) {
      const errorMessage =
        err &&
        typeof err === "object" &&
        "data" in err &&
        err.data &&
        typeof err.data === "object" &&
        "message" in err.data
          ? String((err.data as { message: string }).message)
          : "An error occurred. Please try again.";
      setFormError(errorMessage);
    }
  }

  async function handleDelete() {
    if (!deletingChannelId) return;
    try {
      await deleteChannel({ partnerId, channelId: deletingChannelId }).unwrap();
      setDeletingChannelId(null);
    } catch {
      setDeletingChannelId(null);
    }
  }

  // Breadcrumbs
  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Courier Partners", href: "/partners" },
    { title: partner?.name ?? "Partner", href: `/partners/${partnerId}` },
    { title: "Channels" },
  ];

  // Loading
  if (isLoadingPartner || isLoadingChannels) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  // Error
  if (channelsError) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-96">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Failed to Load Channels
            </h3>
            <p className="text-muted-foreground mb-4 text-sm">
              Could not load channel configurations.
            </p>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const activeCount = channels.filter((c) => c.isActive).length;
  const primaryChannel = channels.find((c) => c.isPrimary);

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Channels</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Routing rules and API credentials for{" "}
            <span className="font-medium text-foreground">
              {partner?.displayName ?? partner?.name}
            </span>
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="routing">
              <GitBranch className="h-4 w-4 mr-1.5" />
              Routing Channels
            </TabsTrigger>
            <TabsTrigger value="credentials">
              <Key className="h-4 w-4 mr-1.5" />
              Credential Accounts
            </TabsTrigger>
          </TabsList>

          {/* Routing (rule-based) channels */}
          <TabsContent value="routing" className="mt-4">
            <ServiceChannelsPanel
              partnerId={partnerId}
              credentialAccounts={channels}
              canCreate={canCreate}
              canEdit={canEdit}
              canDelete={canDelete}
              onRequestCreateCredential={() => {
                setActiveTab("credentials");
                openAddDialog();
              }}
            />
          </TabsContent>

          {/* Credential accounts (API keys / logins) */}
          <TabsContent value="credentials" className="mt-4 space-y-4">
            <div className="flex items-start justify-between">
              <p className="text-sm text-muted-foreground max-w-2xl">
                API credentials this partner books with. A credential account
                can be shared by multiple routing channels (e.g. one Delhivery
                B2C token used by several weight slabs).
              </p>
              {canCreate && (
                <Button onClick={openAddDialog} size="sm">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Credential Account
                </Button>
              )}
            </div>

            {/* Summary */}
            {channels.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {channels.length} account{channels.length !== 1 && "s"}
                </span>
                <span className="text-border">|</span>
                <span>{activeCount} active</span>
                {primaryChannel && (
                  <>
                    <span className="text-border">|</span>
                    <span>
                      Primary:{" "}
                      <span className="text-foreground font-medium">
                        {primaryChannel.channelName}
                      </span>
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Channel Grid */}
            {channels.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {channels.map((channel, index) => (
                  <ChannelCard
                    key={channel.id ?? index}
                    channel={channel}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onEdit={openEditDialog}
                    onDelete={(id) => setDeletingChannelId(id)}
                  />
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Network className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold mb-1">
                    No Credential Accounts Yet
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-xs mb-5">
                    Add a credential account to connect this partner to a
                    courier API.
                  </p>
                  {canCreate && (
                    <Button onClick={openAddDialog} size="sm">
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add Credential Account
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={closeDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingChannel
                ? "Edit Credential Account"
                : "Add Credential Account"}
            </DialogTitle>
            <DialogDescription>
              {editingChannel
                ? "Update courier API credentials."
                : "Configure a new set of courier API credentials."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="channelName">
                Channel Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="channelName"
                placeholder="e.g. Delhivery Primary, BlueDart Backup"
                value={form.channelName}
                onChange={(e) =>
                  handleFieldChange("channelName", e.target.value)
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="aggregatorType">
                Courier Aggregator <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.aggregatorType}
                onValueChange={handleAggregatorChange}
              >
                <SelectTrigger id="aggregatorType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGGREGATOR_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        — {opt.description}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <AggregatorConfigFields
              aggregatorType={form.aggregatorType}
              form={form}
              onChange={handleFieldChange}
            />

            <div className="space-y-1.5">
              <Label htmlFor="webhookSecret">Webhook Secret</Label>
              <Input
                id="webhookSecret"
                type="password"
                placeholder="Optional — for verifying courier webhooks"
                value={form.webhookSecret}
                onChange={(e) =>
                  handleFieldChange("webhookSecret", e.target.value)
                }
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                min={1}
                max={100}
                value={form.priority}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    priority: Math.max(1, parseInt(e.target.value) || 1),
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Lower number = higher priority
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-1">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="isActive"
                  checked={form.isActive}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({
                      ...prev,
                      isActive: checked === true,
                    }))
                  }
                />
                <div>
                  <Label htmlFor="isActive" className="cursor-pointer">
                    Active
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Channel will be used for routing shipments
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="isPrimary"
                  checked={form.isPrimary}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({
                      ...prev,
                      isPrimary: checked === true,
                    }))
                  }
                />
                <div>
                  <Label htmlFor="isPrimary" className="cursor-pointer">
                    Primary Channel
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Default channel for this partner
                  </p>
                </div>
              </div>
            </div>

            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            {testResult && (
              <Alert
                variant={testResult.success ? "default" : "destructive"}
                className={
                  testResult.success
                    ? "border-green-200 bg-green-50 text-green-800"
                    : undefined
                }
              >
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  {testResult.success ? "Connection OK — " : "Test failed — "}
                  {testResult.message}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={isSaving || isTesting}
              className="mr-auto"
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Network className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
            <Button
              variant="outline"
              onClick={closeDialog}
              disabled={isSaving || isTesting}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || isTesting}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingChannel ? "Save Changes" : "Add Channel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingChannelId}
        onOpenChange={(open) => {
          if (!open) setDeletingChannelId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Channel?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this channel. Existing shipments
              won't be affected, but future routing will no longer use it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
