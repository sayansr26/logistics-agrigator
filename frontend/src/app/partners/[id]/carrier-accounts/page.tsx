"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  carrierAccountsApi,
  CarrierAccount,
  CarrierAccountInput,
  CarrierServiceType,
} from "@/services/api/carrier-accounts-api";
import { useAppSelector } from "@/store/hooks";
import { RefreshCw, Plus, Trash2 } from "lucide-react";

const SERVICE_TYPES: CarrierServiceType[] = ["SURFACE", "AIR", "EXPRESS"];

const emptyForm: CarrierAccountInput = {
  channelName: "",
  accountRef: "",
  serviceType: "SURFACE",
  minWeight: 0,
  maxWeight: undefined,
  priority: 1,
  isActive: true,
};

export default function CarrierAccountsPage() {
  const params = useParams();
  const partnerId = String(params?.id || "");
  const [accounts, setAccounts] = useState<CarrierAccount[]>([]);
  const [form, setForm] = useState<CarrierAccountInput>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accessToken = useAppSelector((s) => s.auth.token);

  const load = useCallback(async () => {
    if (!partnerId || !accessToken) return; // wait for auth token to hydrate
    setLoading(true);
    setError(null);
    try {
      carrierAccountsApi.setAccessToken(accessToken);
      const res = await carrierAccountsApi.list(partnerId);
      setAccounts(res.data?.accounts || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load carrier accounts");
    } finally {
      setLoading(false);
    }
  }, [partnerId, accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const addAccount = async () => {
    setError(null);
    if (!form.channelName.trim() || !form.accountRef.trim()) {
      setError("Channel name and account reference are required.");
      return;
    }
    setSaving(true);
    try {
      await carrierAccountsApi.create(partnerId, [
        {
          ...form,
          minWeight: Number(form.minWeight) || 0,
          maxWeight:
            form.maxWeight === undefined || form.maxWeight === null || String(form.maxWeight) === ""
              ? null
              : Number(form.maxWeight),
          priority: Number(form.priority) || 1,
        },
      ]);
      setForm(emptyForm);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create carrier account");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (a: CarrierAccount) => {
    try {
      await carrierAccountsApi.update(a.id, { isActive: !a.isActive });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    }
  };

  const removeAccount = async (a: CarrierAccount) => {
    try {
      await carrierAccountsApi.remove(a.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Carrier Accounts</h1>
            <p className="text-muted-foreground">
              Weight-slab shipping channels / accounts for this carrier (e.g. Surface A 0–5kg → Account 1)
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {error && <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

        <Card>
          <CardHeader>
            <CardTitle>Add Carrier Account</CardTitle>
            <CardDescription>Define a weight slab and the account used for it</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-6">
              <div className="md:col-span-2">
                <Label>Channel Name</Label>
                <Input
                  placeholder="Delhivery Surface A"
                  value={form.channelName}
                  onChange={(e) => setForm({ ...form, channelName: e.target.value })}
                />
              </div>
              <div>
                <Label>Account Ref</Label>
                <Input
                  placeholder="Account 1"
                  value={form.accountRef}
                  onChange={(e) => setForm({ ...form, accountRef: e.target.value })}
                />
              </div>
              <div>
                <Label>Service</Label>
                <Select
                  value={form.serviceType}
                  onValueChange={(v) => setForm({ ...form, serviceType: v as CarrierServiceType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Min Wt (kg)</Label>
                <Input
                  type="number"
                  value={form.minWeight ?? 0}
                  onChange={(e) => setForm({ ...form, minWeight: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Max Wt (kg)</Label>
                <Input
                  type="number"
                  placeholder="∞"
                  value={form.maxWeight ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, maxWeight: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={addAccount} disabled={saving}>
                <Plus className="mr-2 h-4 w-4" />
                {saving ? "Adding…" : "Add Account"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
            <CardDescription>{accounts.length} account(s) configured</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Weight Slab</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No carrier accounts yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {accounts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.channelName}</TableCell>
                      <TableCell>{a.accountRef}</TableCell>
                      <TableCell>{a.serviceType}</TableCell>
                      <TableCell>
                        {Number(a.minWeight)}–{a.maxWeight === null ? "∞" : Number(a.maxWeight)} kg
                      </TableCell>
                      <TableCell>{a.priority}</TableCell>
                      <TableCell>
                        <Badge
                          className={a.isActive ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}
                          variant="outline"
                        >
                          {a.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => toggleActive(a)}>
                            {a.isActive ? "Disable" : "Enable"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => removeAccount(a)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
