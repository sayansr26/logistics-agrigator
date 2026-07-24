"use client";

import { useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Trash2,
  Pencil,
  Loader2,
  AlertCircle,
  GitBranch,
  KeyRound,
} from "lucide-react";
import {
  useListServiceChannelsQuery,
  useCreateServiceChannelsMutation,
  useUpdateServiceChannelMutation,
  useDeleteServiceChannelMutation,
  type ServiceChannel,
  type ServiceChannelInput,
  type ChannelBusinessType,
  type ChannelServiceType,
  type ChannelPaymentMode,
} from "@/store/api/endpoints/serviceChannelApi";
import { type ChannelConfig } from "@/store/api/endpoints/partnerChannelApi";

const BUSINESS_TYPES: { value: ChannelBusinessType; label: string }[] = [
  { value: "BOTH", label: "B2B + B2C" },
  { value: "B2C", label: "B2C only" },
  { value: "B2B", label: "B2B only" },
];

const SERVICE_TYPES: ChannelServiceType[] = ["SURFACE", "AIR", "EXPRESS"];
const PAYMENT_MODES: ChannelPaymentMode[] = ["COD", "PREPAID"];

interface ChannelFormState {
  channelName: string;
  accountRef: string;
  businessType: ChannelBusinessType;
  serviceType: ChannelServiceType;
  minWeight: string;
  maxWeight: string;
  minOrderAmount: string;
  maxOrderAmount: string;
  paymentModes: ChannelPaymentMode[];
  channelConfigId: string;
  isActive: boolean;
  priority: number;
}

const emptyForm: ChannelFormState = {
  channelName: "",
  accountRef: "",
  businessType: "BOTH",
  serviceType: "SURFACE",
  minWeight: "0",
  maxWeight: "",
  minOrderAmount: "",
  maxOrderAmount: "",
  paymentModes: [],
  channelConfigId: "",
  isActive: true,
  priority: 1,
};

function toNumberOrNull(value: string): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatRange(
  min: string | number | null,
  max: string | number | null,
  unit: string,
): string {
  const minN = min === null || min === undefined ? null : Number(min);
  const maxN = max === null || max === undefined ? null : Number(max);
  if ((minN === null || minN === 0) && maxN === null) return "Any";
  if (maxN === null) return `${minN}${unit}+`;
  return `${minN ?? 0}–${maxN}${unit}`;
}

function channelToForm(channel: ServiceChannel): ChannelFormState {
  return {
    channelName: channel.channelName,
    accountRef: channel.accountRef,
    businessType: channel.businessType ?? "BOTH",
    serviceType: channel.serviceType ?? "SURFACE",
    minWeight: String(channel.minWeight ?? 0),
    maxWeight:
      channel.maxWeight === null || channel.maxWeight === undefined
        ? ""
        : String(channel.maxWeight),
    minOrderAmount:
      channel.minOrderAmount === null || channel.minOrderAmount === undefined
        ? ""
        : String(channel.minOrderAmount),
    maxOrderAmount:
      channel.maxOrderAmount === null || channel.maxOrderAmount === undefined
        ? ""
        : String(channel.maxOrderAmount),
    paymentModes: channel.paymentModes ?? [],
    channelConfigId: channel.channelConfigId ?? "",
    isActive: channel.isActive,
    priority: channel.priority,
  };
}

export function ServiceChannelsPanel({
  partnerId,
  credentialAccounts,
  canCreate,
  canEdit,
  canDelete,
  onRequestCreateCredential,
}: {
  partnerId: string;
  credentialAccounts: ChannelConfig[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onRequestCreateCredential: () => void;
}) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ServiceChannel | null>(
    null,
  );
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(
    null,
  );
  const [form, setForm] = useState<ChannelFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    data: channelsData,
    isLoading,
    error,
    refetch,
  } = useListServiceChannelsQuery(partnerId, { skip: !partnerId });

  const [createChannels, { isLoading: isCreating }] =
    useCreateServiceChannelsMutation();
  const [updateChannel, { isLoading: isUpdating }] =
    useUpdateServiceChannelMutation();
  const [deleteChannel, { isLoading: isDeleting }] =
    useDeleteServiceChannelMutation();

  const channels = channelsData?.data?.accounts ?? [];
  const isSaving = isCreating || isUpdating;

  const credentialNameById = new Map(
    credentialAccounts.filter((c) => c.id).map((c) => [c.id as string, c]),
  );

  function openAddDialog() {
    setEditingChannel(null);
    setForm(emptyForm);
    setFormError(null);
    setShowDialog(true);
  }

  function openEditDialog(channel: ServiceChannel) {
    setEditingChannel(channel);
    setForm(channelToForm(channel));
    setFormError(null);
    setShowDialog(true);
  }

  function closeDialog() {
    setShowDialog(false);
    setEditingChannel(null);
    setForm(emptyForm);
    setFormError(null);
  }

  function togglePaymentMode(mode: ChannelPaymentMode) {
    setForm((prev) => ({
      ...prev,
      paymentModes: prev.paymentModes.includes(mode)
        ? prev.paymentModes.filter((m) => m !== mode)
        : [...prev.paymentModes, mode],
    }));
    setFormError(null);
  }

  function validateForm(): string | null {
    if (!form.channelName.trim()) return "Channel name is required.";
    if (!form.accountRef.trim()) return "Account reference is required.";
    if (!form.channelConfigId)
      return "Select a credential account for this channel.";

    const minW = toNumberOrNull(form.minWeight) ?? 0;
    const maxW = toNumberOrNull(form.maxWeight);
    if (maxW !== null && maxW < minW)
      return "Max weight must be greater than or equal to min weight.";

    const minA = toNumberOrNull(form.minOrderAmount);
    const maxA = toNumberOrNull(form.maxOrderAmount);
    if (minA !== null && maxA !== null && maxA < minA)
      return "Max order amount must be greater than or equal to min order amount.";

    return null;
  }

  function buildPayload(): ServiceChannelInput {
    return {
      channelName: form.channelName.trim(),
      accountRef: form.accountRef.trim(),
      businessType: form.businessType,
      serviceType: form.serviceType,
      minWeight: toNumberOrNull(form.minWeight) ?? 0,
      maxWeight: toNumberOrNull(form.maxWeight),
      minOrderAmount: toNumberOrNull(form.minOrderAmount),
      maxOrderAmount: toNumberOrNull(form.maxOrderAmount),
      paymentModes: form.paymentModes,
      channelConfigId: form.channelConfigId || null,
      isActive: form.isActive,
      priority: form.priority,
    };
  }

  async function handleSave() {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const payload = buildPayload();

    try {
      if (editingChannel?.id) {
        await updateChannel({
          partnerId,
          channelId: editingChannel.id,
          updates: payload,
        }).unwrap();
      } else {
        await createChannels({ partnerId, accounts: [payload] }).unwrap();
      }
      closeDialog();
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
          : "An error occurred. Please try again.";
      setFormError(errorMessage);
    }
  }

  async function handleDelete() {
    if (!deletingChannelId) return;
    try {
      await deleteChannel({ partnerId, channelId: deletingChannelId }).unwrap();
    } finally {
      setDeletingChannelId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64">
          <AlertCircle className="h-10 w-10 text-red-500 mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            Could not load routing channels.
          </p>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Rules decide which account books each shipment: business type, weight
          slab, order amount, and payment mode are matched in priority order.
          Partners without routing channels keep using their primary credential
          account.
        </p>
        {canCreate && (
          <Button onClick={openAddDialog} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Add Routing Channel
          </Button>
        )}
      </div>

      {channels.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <GitBranch className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">No Routing Channels</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-5">
              Add channels like &ldquo;Delhivery B2C&rdquo; (0–100 kg) or
              &ldquo;Delhivery B2B Heavy&rdquo; (100 kg+) to route shipments to
              the right account automatically.
            </p>
            {canCreate && (
              <Button onClick={openAddDialog} size="sm">
                <Plus className="h-4 w-4 mr-1.5" />
                Add Routing Channel
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Order Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Credential</TableHead>
                  <TableHead>Status</TableHead>
                  {(canEdit || canDelete) && (
                    <TableHead className="w-20 text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((channel) => {
                  const credential = channel.channelConfigId
                    ? credentialNameById.get(channel.channelConfigId)
                    : null;
                  return (
                    <TableRow key={channel.id}>
                      <TableCell>
                        <div className="font-medium">{channel.channelName}</div>
                        <div className="text-xs text-muted-foreground">
                          {channel.accountRef}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            channel.businessType === "B2B"
                              ? "border-purple-200 text-purple-700 bg-purple-50"
                              : channel.businessType === "B2C"
                                ? "border-blue-200 text-blue-700 bg-blue-50"
                                : "border-gray-200 text-gray-600"
                          }
                        >
                          {channel.businessType === "BOTH"
                            ? "B2B + B2C"
                            : channel.businessType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {channel.serviceType}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatRange(
                          channel.minWeight,
                          channel.maxWeight,
                          " kg",
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatRange(
                          channel.minOrderAmount,
                          channel.maxOrderAmount,
                          "",
                        ) === "Any"
                          ? "Any"
                          : `₹${formatRange(channel.minOrderAmount, channel.maxOrderAmount, "")}`}
                      </TableCell>
                      <TableCell className="text-sm">
                        {channel.paymentModes?.length
                          ? channel.paymentModes.join(", ")
                          : "All"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {channel.priority}
                      </TableCell>
                      <TableCell className="text-sm">
                        {credential ? (
                          <span className="flex items-center gap-1.5">
                            <KeyRound className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            <span className="truncate max-w-[140px]">
                              {credential.channelName}
                            </span>
                          </span>
                        ) : (
                          <span className="text-orange-500 text-xs">
                            Not linked
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {channel.isActive ? (
                          <Badge className="border-green-200 text-green-700 bg-green-50 border">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      {(canEdit || canDelete) && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEditDialog(channel)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-600"
                                onClick={() => setDeletingChannelId(channel.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={closeDialog}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingChannel ? "Edit Routing Channel" : "Add Routing Channel"}
            </DialogTitle>
            <DialogDescription>
              Define when this account should be used for a shipment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="scChannelName">
                  Channel Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="scChannelName"
                  placeholder="e.g. Delhivery B2B Heavy"
                  value={form.channelName}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, channelName: e.target.value }));
                    setFormError(null);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scAccountRef">
                  Account Reference <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="scAccountRef"
                  placeholder="e.g. Account 2"
                  value={form.accountRef}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, accountRef: e.target.value }));
                    setFormError(null);
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Business Type</Label>
                <Select
                  value={form.businessType}
                  onValueChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      businessType: v as ChannelBusinessType,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map((bt) => (
                      <SelectItem key={bt.value} value={bt.value}>
                        {bt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Service Mode</Label>
                <Select
                  value={form.serviceType}
                  onValueChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      serviceType: v as ChannelServiceType,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((st) => (
                      <SelectItem key={st} value={st}>
                        {st}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="scMinWeight">Min Weight (kg)</Label>
                <Input
                  id="scMinWeight"
                  type="number"
                  min={0}
                  step="0.001"
                  value={form.minWeight}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, minWeight: e.target.value }));
                    setFormError(null);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scMaxWeight">Max Weight (kg)</Label>
                <Input
                  id="scMaxWeight"
                  type="number"
                  min={0}
                  step="0.001"
                  placeholder="Blank = no limit"
                  value={form.maxWeight}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, maxWeight: e.target.value }));
                    setFormError(null);
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="scMinAmount">Min Order Amount (₹)</Label>
                <Input
                  id="scMinAmount"
                  type="number"
                  min={0}
                  placeholder="Blank = no minimum"
                  value={form.minOrderAmount}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, minOrderAmount: e.target.value }));
                    setFormError(null);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scMaxAmount">Max Order Amount (₹)</Label>
                <Input
                  id="scMaxAmount"
                  type="number"
                  min={0}
                  placeholder="Blank = no maximum"
                  value={form.maxOrderAmount}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, maxOrderAmount: e.target.value }));
                    setFormError(null);
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Payment Modes</Label>
              <div className="flex items-center gap-6 pt-1">
                {PAYMENT_MODES.map((mode) => (
                  <div key={mode} className="flex items-center gap-2">
                    <Checkbox
                      id={`scPay-${mode}`}
                      checked={form.paymentModes.includes(mode)}
                      onCheckedChange={() => togglePaymentMode(mode)}
                    />
                    <Label htmlFor={`scPay-${mode}`} className="cursor-pointer">
                      {mode}
                    </Label>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  None selected = all modes
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>
                Credential Account <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.channelConfigId || undefined}
                onValueChange={(v) => {
                  if (v === "__create__") {
                    closeDialog();
                    onRequestCreateCredential();
                    return;
                  }
                  setForm((p) => ({ ...p, channelConfigId: v }));
                  setFormError(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select credential account" />
                </SelectTrigger>
                <SelectContent>
                  {credentialAccounts
                    .filter((c) => c.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id as string}>
                        <span className="font-medium">{c.channelName}</span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          — {c.aggregatorType}
                        </span>
                      </SelectItem>
                    ))}
                  <SelectItem value="__create__">
                    <span className="text-primary">
                      + Create new credential account…
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                API credentials this channel books with (e.g. Delhivery B2C
                token vs Delhivery B2B login)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="scPriority">Priority</Label>
                <Input
                  id="scPriority"
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
                  Lower number = matched first
                </p>
              </div>
              <div className="flex items-center gap-3 pb-1">
                <Checkbox
                  id="scIsActive"
                  checked={form.isActive}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, isActive: checked === true }))
                  }
                />
                <Label htmlFor="scIsActive" className="cursor-pointer">
                  Active
                </Label>
              </div>
            </div>

            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeDialog} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
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
            <AlertDialogTitle>Delete Routing Channel?</AlertDialogTitle>
            <AlertDialogDescription>
              Shipments will no longer route to this account. Booked shipments
              keep their history.
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
    </div>
  );
}
