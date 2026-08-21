"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Store,
  Trash2,
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { PageContainer, PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/hooks/useRole";
import {
  useLazyListOutletsQuery,
  useListOutletsQuery,
} from "@/store/api/endpoints/outletApi";
import type { Outlet } from "@/store/api/endpoints/outletApi";
import {
  AVAILABLE_SCOPES,
  useCreateApiCredentialMutation,
  useGetApiCredentialsQuery,
  useRevokeApiCredentialMutation,
  useRotateApiCredentialMutation,
  type ApiCredential,
} from "@/store/api/endpoints/apiCredentialsApi";

/** Scopes pre-selected for a new credential: everything a booking flow needs. */
const DEFAULT_SCOPES = AVAILABLE_SCOPES.map((s) => s.value);

export default function ApiCredentialsPage() {
  const toast = useToast();
  const { hasRole } = useRole();
  const isSuperadmin = hasRole(["superadmin"]);

  const { data, isLoading, isError } = useGetApiCredentialsQuery({
    includeRevoked: true,
  });
  const [createCredential, { isLoading: isCreating }] =
    useCreateApiCredentialMutation();
  const [rotateCredential] = useRotateApiCredentialMutation();
  const [revokeCredential] = useRevokeApiCredentialMutation();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [selectedOutlet, setSelectedOutlet] = useState<Outlet | null>(null);
  const [scopes, setScopes] = useState<string[]>(DEFAULT_SCOPES);

  // Outlet picker (superadmin only) — same first-page-plus-server-search
  // pattern as the booking wizard's outlet select, so large installs whose
  // outlets fall outside the first page are still findable by typing.
  const { data: outletsData, isLoading: outletsLoading } = useListOutletsQuery(
    { isActive: true, limit: 100 },
    { skip: !isSuperadmin || !createOpen },
  );
  const [triggerOutletSearch] = useLazyListOutletsQuery();
  const [outletResults, setOutletResults] = useState<Outlet[]>([]);
  const [outletSearching, setOutletSearching] = useState(false);
  const outletDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (outletDebounce.current) clearTimeout(outletDebounce.current);
    },
    [],
  );

  const outlets = useMemo(() => {
    const byId = new Map<string, Outlet>();
    for (const o of outletsData?.data?.outlets || []) byId.set(o.id, o);
    for (const o of outletResults) byId.set(o.id, o);
    return Array.from(byId.values());
  }, [outletsData, outletResults]);

  const handleOutletQueryChange = (query: string) => {
    if (outletDebounce.current) clearTimeout(outletDebounce.current);
    if (!query || query.trim().length < 2) {
      setOutletResults([]);
      return;
    }
    outletDebounce.current = setTimeout(async () => {
      setOutletSearching(true);
      try {
        const result = await triggerOutletSearch({
          isActive: true,
          limit: 50,
          search: query.trim(),
        }).unwrap();
        setOutletResults(result?.data?.outlets || []);
      } catch {
        // ignore — SearchableSelect just shows "no results"
      } finally {
        setOutletSearching(false);
      }
    }, 300);
  };

  /** The one-time secret, held only in memory until the dialog is dismissed. */
  const [revealed, setRevealed] = useState<{
    clientId: string;
    clientSecret: string;
  } | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiCredential | null>(null);

  const credentials = data?.data ?? [];

  const toggleScope = (value: string) =>
    setScopes((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
    );

  const resetForm = () => {
    setName("");
    setSelectedOutlet(null);
    setOutletResults([]);
    setScopes(DEFAULT_SCOPES);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Give the credential a name");
      return;
    }
    if (isSuperadmin && !selectedOutlet) {
      toast.error("Select the outlet this credential should act as");
      return;
    }

    try {
      const result = await createCredential({
        name: name.trim(),
        ...(isSuperadmin && selectedOutlet
          ? { outletId: selectedOutlet.id }
          : {}),
        scopes,
      }).unwrap();

      setCreateOpen(false);
      resetForm();
      setRevealed({
        clientId: result.data.clientId,
        clientSecret: result.data.clientSecret,
      });
    } catch {
      // errorMiddleware already surfaces the toast
    }
  };

  const handleRotate = async (credential: ApiCredential) => {
    try {
      const result = await rotateCredential(credential.id).unwrap();
      setRevealed({
        clientId: result.data.clientId,
        clientSecret: result.data.clientSecret,
      });
    } catch {
      /* handled by errorMiddleware */
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await revokeCredential(revokeTarget.id).unwrap();
      toast.success(`"${revokeTarget.name}" revoked`);
      setRevokeTarget(null);
    } catch {
      /* handled by errorMiddleware */
    }
  };

  return (
    <DashboardLayout>
      <PageContainer>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 w-fit">
          <Link href="/developers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to docs
          </Link>
        </Button>

        <PageHeader
          title="API Credentials"
          description="Keys for the External Shipment API and the MCP server. Each credential acts as one outlet."
          primaryAction={{
            label: "Create credential",
            onClick: () => setCreateOpen(true),
          }}
        />

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : isError ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Could not load credentials. Refresh to try again.
              </div>
            ) : credentials.length === 0 ? (
              <div className="flex flex-col items-center gap-3 p-12 text-center">
                <KeyRound className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">No API credentials yet</p>
                  <p className="text-sm text-muted-foreground">
                    Create one to start using the External Shipment API.
                  </p>
                </div>
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create credential
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Client ID</TableHead>
                      <TableHead>Scopes</TableHead>
                      <TableHead>Last used</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {credentials.map((credential) => {
                      const revoked = Boolean(credential.revokedAt);
                      return (
                        <TableRow key={credential.id}>
                          <TableCell className="font-medium">
                            {credential.name}
                          </TableCell>
                          <TableCell>
                            <code className="font-mono text-xs">
                              {credential.clientId}
                            </code>
                            <div className="text-xs text-muted-foreground">
                              secret &hellip;{credential.secretLast4}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {credential.scopes.length} scope
                              {credential.scopes.length === 1 ? "" : "s"}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {credential.lastUsedAt
                              ? new Date(
                                  credential.lastUsedAt,
                                ).toLocaleDateString()
                              : "Never"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={revoked ? "outline" : "default"}>
                              {revoked ? "Revoked" : "Active"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {!revoked && (
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRotate(credential)}
                                  title="Rotate secret"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setRevokeTarget(credential)}
                                  title="Revoke"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create */}
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create API credential</DialogTitle>
              <DialogDescription>
                The client secret is shown once, immediately after creation.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cred-name">Name</Label>
                <Input
                  id="cred-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Warehouse ERP"
                />
              </div>

              {isSuperadmin && (
                <div className="space-y-2">
                  <Label htmlFor="cred-outlet">Outlet</Label>
                  {outletsLoading ? (
                    <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading outlets&hellip;
                    </div>
                  ) : outlets.length === 0 && !selectedOutlet ? (
                    <div className="flex items-center gap-2 rounded-lg border border-border p-2 text-xs text-muted-foreground">
                      <AlertCircle className="h-3.5 w-3.5" />
                      No active outlets found.
                    </div>
                  ) : (
                    <SearchableSelect<Outlet>
                      inputId="cred-outlet"
                      options={outlets}
                      value={selectedOutlet}
                      onSelect={setSelectedOutlet}
                      onQueryChange={handleOutletQueryChange}
                      loading={outletSearching}
                      getOptionText={(o) => `${o.name} ${o.email} ${o.phone}`}
                      getDisplayText={(o) => `${o.name} (${o.email})`}
                      placeholder="Search or select outlet…"
                      icon={<Store className="h-3.5 w-3.5" />}
                      noResults="No outlets match your search"
                      renderOption={(o) => (
                        <div>
                          <div className="font-semibold text-foreground">
                            {o.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {o.email} &middot; {o.phone}
                          </div>
                        </div>
                      )}
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    The credential acts as this outlet and is scoped to its
                    shipments.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Scopes</Label>
                <div className="space-y-2 rounded-md border p-3">
                  {AVAILABLE_SCOPES.map((scope) => (
                    <label
                      key={scope.value}
                      className="flex cursor-pointer items-start gap-3"
                    >
                      <Checkbox
                        checked={scopes.includes(scope.value)}
                        onCheckedChange={() => toggleScope(scope.value)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {scope.label}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {scope.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating ? "Creating…" : "Create credential"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* One-time secret reveal */}
        <Dialog
          open={Boolean(revealed)}
          onOpenChange={(open) => !open && setRevealed(null)}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Copy your client secret</DialogTitle>
              <DialogDescription>
                This is the only time the secret is shown. Store it somewhere
                safe before closing this dialog.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <SecretField label="Client ID" value={revealed?.clientId ?? ""} />
              <SecretField
                label="Client Secret"
                value={revealed?.clientSecret ?? ""}
              />

              <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-xs text-amber-900 dark:text-amber-200">
                  Treat the secret like a password. If it leaks, rotate or
                  revoke this credential immediately &mdash; revoking
                  invalidates every token already issued from it.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setRevealed(null)}>
                I&apos;ve saved it
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Revoke confirmation */}
        <Dialog
          open={Boolean(revokeTarget)}
          onOpenChange={(open) => !open && setRevokeTarget(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Revoke credential</DialogTitle>
              <DialogDescription>
                Revoking &ldquo;{revokeTarget?.name}&rdquo; immediately breaks
                every integration using it, including tokens already issued.
                This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRevokeTarget(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleRevoke}>
                Revoke credential
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </DashboardLayout>
  );
}

function SecretField({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy — select the text and copy manually");
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-md border bg-muted px-3 py-2 font-mono text-xs">
          {value}
        </code>
        <Button size="sm" variant="outline" onClick={copy} className="shrink-0">
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
