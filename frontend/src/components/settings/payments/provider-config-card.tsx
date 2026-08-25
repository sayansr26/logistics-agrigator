"use client";

import { useEffect, useId, useState } from "react";
import {
  CreditCard,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useToast } from "@/components/ui/toast";
import { CopyButton } from "@/components/wallet/copy-button";
import { cn, extractApiError, formatINR } from "@/lib/utils";
import {
  SecretField,
  buildSecretPayload,
  type SecretFieldState,
} from "./secret-field";
import {
  useUpdatePaymentProviderMutation,
  useTestPaymentProviderMutation,
  useUpdateTopupPolicyMutation,
  type PaymentProviderConfig,
  type ProviderCredentialState,
  type PaymentMode,
  type TestConnectionResponse,
  type WalletTopupPolicy,
} from "@/store/api/endpoints/paymentApi";

// ============================================
// Local types
// ============================================

type SecretField =
  | "testKeyId"
  | "testKeySecret"
  | "testWebhookSecret"
  | "liveKeyId"
  | "liveKeySecret"
  | "liveWebhookSecret";

interface ProviderFormState {
  isEnabled: boolean;
  mode: PaymentMode;
  currency: string;
  minAmount: string;
  maxAmount: string;
  quickAmountsText: string;
  paymentLinkExpiryHours: string;
}

interface PolicyFormState {
  manualMaxPerTransaction: string;
  manualApprovalThreshold: string;
}

interface BlockingOrder {
  orderId: string;
  walletUserId: string;
  amount: number;
  status: string;
  createdAt: string;
}

interface ModeBlockers {
  orders: BlockingOrder[];
  total: number;
}

interface ProviderConfigCardProps {
  config: PaymentProviderConfig;
  policy?: WalletTopupPolicy;
}

// ============================================
// Helpers
// ============================================

function deriveForm(config: PaymentProviderConfig): ProviderFormState {
  return {
    isEnabled: config.isEnabled,
    mode: config.mode,
    currency: config.currency,
    minAmount: String(config.minAmount ?? ""),
    maxAmount: String(config.maxAmount ?? ""),
    quickAmountsText: (config.quickAmounts || []).join(", "),
    paymentLinkExpiryHours: String(config.paymentLinkExpiryHours ?? ""),
  };
}

function derivePolicyForm(policy?: WalletTopupPolicy): PolicyFormState {
  return {
    manualMaxPerTransaction:
      policy?.manualMaxPerTransaction != null
        ? String(policy.manualMaxPerTransaction)
        : "",
    manualApprovalThreshold:
      policy?.manualApprovalThreshold != null
        ? String(policy.manualApprovalThreshold)
        : "",
  };
}

function initSecrets(): Record<SecretField, SecretFieldState> {
  const empty: SecretFieldState = { editing: false, value: "" };
  return {
    testKeyId: { ...empty },
    testKeySecret: { ...empty },
    testWebhookSecret: { ...empty },
    liveKeyId: { ...empty },
    liveKeySecret: { ...empty },
    liveWebhookSecret: { ...empty },
  };
}

function parseQuickAmounts(text: string): number[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "")
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function apiErrorMessage(err: any, fallback: string): string {
  return extractApiError(err, fallback);
}

function validateProviderForm(
  form: ProviderFormState,
  policyForm: PolicyFormState,
): string[] {
  const errors: string[] = [];

  const min = Number(form.minAmount);
  const max = Number(form.maxAmount);

  if (!(min > 0)) errors.push("Minimum recharge must be greater than 0.");
  if (!(max > min))
    errors.push("Maximum recharge must be greater than the minimum recharge.");

  const quickAmounts = parseQuickAmounts(form.quickAmountsText);
  const outOfRange = quickAmounts.filter((n) => n < min || n > max);
  if (min > 0 && max > min && outOfRange.length > 0) {
    errors.push(
      `Quick amounts must fall between ${formatINR(min)} and ${formatINR(max)}: ${outOfRange
        .map((n) => formatINR(n))
        .join(", ")} out of range.`,
    );
  }

  const expiry = Number(form.paymentLinkExpiryHours);
  if (!(expiry >= 1 && expiry <= 720)) {
    errors.push("Payment link expiry must be between 1 and 720 hours.");
  }

  const cap = Number(policyForm.manualMaxPerTransaction);
  if (!(cap > 0)) errors.push("Manual top-up cap must be greater than 0.");

  const threshold = Number(policyForm.manualApprovalThreshold);
  if (!(threshold > 0))
    errors.push("Maker-checker threshold must be greater than 0.");

  return errors;
}

// ============================================
// Credentials panel (test or live)
// ============================================

function CredentialsPanel({
  title,
  cred,
  keyIdState,
  onKeyIdChange,
  keySecretState,
  onKeySecretChange,
  webhookSecretState,
  onWebhookSecretChange,
}: {
  title: string;
  cred: ProviderCredentialState;
  keyIdState: SecretFieldState;
  onKeyIdChange: (next: SecretFieldState) => void;
  keySecretState: SecretFieldState;
  onKeySecretChange: (next: SecretFieldState) => void;
  webhookSecretState: SecretFieldState;
  onWebhookSecretChange: (next: SecretFieldState) => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h4 className="text-sm font-semibold text-muted-foreground">{title}</h4>
      <SecretField
        label="Key ID"
        isSet={!!cred.keyId}
        maskedValue={cred.keyId}
        revealable
        required
        state={keyIdState}
        onChange={onKeyIdChange}
        placeholder="rzp_test_XXXXXXXXXXXX"
      />
      <SecretField
        label="Key Secret"
        isSet={cred.keySecretSet}
        maskedValue={cred.keySecretMasked}
        required
        state={keySecretState}
        onChange={onKeySecretChange}
      />
      <SecretField
        label="Webhook Secret"
        isSet={cred.webhookSecretSet}
        maskedValue={null}
        state={webhookSecretState}
        onChange={onWebhookSecretChange}
        hint="Paste the signing secret shown when you register the webhook below."
      />
    </div>
  );
}

// ============================================
// Main card
// ============================================

export function ProviderConfigCard({
  config,
  policy,
}: ProviderConfigCardProps) {
  const toast = useToast();
  const baseId = useId();

  const [updateProvider, { isLoading: isSavingProvider }] =
    useUpdatePaymentProviderMutation();
  const [updateTopupPolicy, { isLoading: isSavingPolicy }] =
    useUpdateTopupPolicyMutation();
  const [testProvider, { isLoading: isTesting }] =
    useTestPaymentProviderMutation();

  const [form, setForm] = useState<ProviderFormState>(() => deriveForm(config));
  const [policyForm, setPolicyForm] = useState<PolicyFormState>(() =>
    derivePolicyForm(policy),
  );
  const [secrets, setSecrets] =
    useState<Record<SecretField, SecretFieldState>>(initSecrets());

  const [dirty, setDirty] = useState(false);
  const [pendingMode, setPendingMode] = useState<PaymentMode | null>(null);
  const [modeBlockers, setModeBlockers] = useState<ModeBlockers | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(
    null,
  );
  const [testError, setTestError] = useState<string | null>(null);

  // Resync local drafts from the server whenever the underlying data changes
  // (initial load, or a refetch after a successful save) - but only while
  // there are no unsaved edits, so a background refetch never clobbers what
  // the operator is mid-way through typing.
  useEffect(() => {
    if (!dirty) setForm(deriveForm(config));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.updatedAt, config.isEnabled, config.mode]);

  useEffect(() => {
    if (!dirty) setPolicyForm(derivePolicyForm(policy));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policy?.manualMaxPerTransaction, policy?.manualApprovalThreshold]);

  const markChanged = () => {
    setDirty(true);
    // A stale green tick must never survive an edit.
    setTestResult(null);
    setTestError(null);
    setModeBlockers(null);
    setError(null);
  };

  const updateForm = (patch: Partial<ProviderFormState>) => {
    markChanged();
    setForm((f) => ({ ...f, ...patch }));
  };

  const updatePolicyForm = (patch: Partial<PolicyFormState>) => {
    markChanged();
    setPolicyForm((p) => ({ ...p, ...patch }));
  };

  const updateSecret = (field: SecretField, next: SecretFieldState) => {
    markChanged();
    setSecrets((s) => ({ ...s, [field]: next }));
  };

  const handleModeClick = (target: PaymentMode) => {
    if (target === form.mode) return;
    if (target === "LIVE") {
      setPendingMode("LIVE");
    } else {
      updateForm({ mode: target });
    }
  };

  const liveKeyIdPresent =
    !!config.live.keyId ||
    (secrets.liveKeyId.editing && secrets.liveKeyId.value.trim() !== "");
  const liveKeySecretPresent =
    config.live.keySecretSet ||
    (secrets.liveKeySecret.editing &&
      secrets.liveKeySecret.value.trim() !== "");
  const liveWebhookSecretPresent =
    config.live.webhookSecretSet ||
    (secrets.liveWebhookSecret.editing &&
      secrets.liveWebhookSecret.value.trim() !== "");
  const hasLiveCredentials =
    liveKeyIdPresent && liveKeySecretPresent && liveWebhookSecretPresent;

  const confirmGoLive = () => {
    setPendingMode(null);
    updateForm({ mode: "LIVE" });
  };

  const handleReset = () => {
    setForm(deriveForm(config));
    setPolicyForm(derivePolicyForm(policy));
    setSecrets(initSecrets());
    setDirty(false);
    setFormErrors([]);
    setError(null);
    setModeBlockers(null);
    setTestResult(null);
    setTestError(null);
  };

  const handleSave = async () => {
    setError(null);
    setModeBlockers(null);

    const errors = validateProviderForm(form, policyForm);
    setFormErrors(errors);
    if (errors.length > 0) return;

    try {
      await updateProvider({
        provider: config.provider,
        isEnabled: form.isEnabled,
        mode: form.mode,
        currency: form.currency,
        minAmount: Number(form.minAmount),
        maxAmount: Number(form.maxAmount),
        quickAmounts: parseQuickAmounts(form.quickAmountsText),
        paymentLinkExpiryHours: Number(form.paymentLinkExpiryHours),
        ...buildSecretPayload(secrets),
      }).unwrap();
    } catch (err: any) {
      if (err?.data?.error?.code === "PENDING_ORDERS_BLOCK_MODE_SWITCH") {
        const details = err?.data?.error?.details || {};
        setModeBlockers({
          orders: details.blockingOrders || [],
          total: details.total ?? (details.blockingOrders || []).length,
        });
        setError(
          "Cannot switch to LIVE mode while TEST-mode payments are still open.",
        );
      } else {
        setError(apiErrorMessage(err, "Failed to save payment settings"));
      }
      return;
    }

    try {
      await updateTopupPolicy({
        manualMaxPerTransaction: Number(policyForm.manualMaxPerTransaction),
        manualApprovalThreshold: Number(policyForm.manualApprovalThreshold),
      }).unwrap();
    } catch (err: any) {
      setError(
        apiErrorMessage(
          err,
          "Payment provider saved, but the top-up policy failed to save",
        ),
      );
      return;
    }

    toast.success("Payment settings saved");
    setSecrets(initSecrets());
    setTestResult(null);
    setTestError(null);
    setDirty(false);
  };

  // Deliberately never sends the in-flight `secrets` state here - a test
  // endpoint that could accept typed-but-unsaved credentials would turn it
  // into a secret-echo vector. It only ever exercises what is already
  // persisted server-side, which is also why it's disabled below while any
  // credential edit is unsaved.
  const handleTestConnection = async () => {
    setTestError(null);
    try {
      const res = await testProvider(config.provider).unwrap();
      setTestResult(res);
    } catch (err: any) {
      setTestResult(null);
      setTestError(apiErrorMessage(err, "Connection test failed"));
    }
  };

  const hasUnsavedSecretEdits = Object.values(secrets).some((s) => s.editing);
  const capNum = Number(policyForm.manualMaxPerTransaction);
  const thresholdNum = Number(policyForm.manualApprovalThreshold);
  const thresholdAboveCap =
    capNum > 0 && thresholdNum > 0 && thresholdNum > capNum;
  const isSaving = isSavingProvider || isSavingPolicy;

  const modeBadgeClass =
    config.mode === "LIVE"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300";

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        {/* 1. Header */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <CreditCard className="h-6 w-6 text-muted-foreground" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">Razorpay</h2>
                  <Badge variant="outline" className={modeBadgeClass}>
                    {config.mode}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Last updated {formatDateTime(config.updatedAt)}
                  {config.updatedBy ? ` by ${config.updatedBy}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label
                htmlFor={`${baseId}-enabled`}
                className="text-sm text-muted-foreground"
              >
                {form.isEnabled ? "Enabled" : "Disabled"}
              </Label>
              <Switch
                id={`${baseId}-enabled`}
                checked={form.isEnabled}
                onCheckedChange={(checked) =>
                  updateForm({ isEnabled: checked })
                }
              />
            </div>
          </div>

          {config.mode === "LIVE" && config.isEnabled && (
            <Alert className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                LIVE mode — real payments are being processed.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Separator />

        {/* 2. Mode */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Mode</h3>
          <div className="inline-flex rounded-md border p-1">
            <button
              type="button"
              onClick={() => handleModeClick("TEST")}
              className={cn(
                "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                form.mode === "TEST"
                  ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Test
            </button>
            <button
              type="button"
              onClick={() => handleModeClick("LIVE")}
              className={cn(
                "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                form.mode === "LIVE"
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Live
            </button>
          </div>

          {modeBlockers && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p>
                  {modeBlockers.total} payment
                  {modeBlockers.total === 1 ? "" : "s"} are still open in TEST
                  mode. They must settle or expire before switching.
                </p>
                {modeBlockers.orders.length > 0 && (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order ID</TableHead>
                          <TableHead>Wallet User</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {modeBlockers.orders.map((o) => (
                          <TableRow key={o.orderId}>
                            <TableCell className="font-mono text-xs">
                              {o.orderId}
                            </TableCell>
                            <TableCell className="text-xs">
                              {o.walletUserId}
                            </TableCell>
                            <TableCell className="text-xs">
                              {formatINR(o.amount)}
                            </TableCell>
                            <TableCell className="text-xs">
                              {o.status}
                            </TableCell>
                            <TableCell className="text-xs">
                              {formatDateTime(o.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <AlertDialog
          open={pendingMode === "LIVE"}
          onOpenChange={(open) => !open && setPendingMode(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Switch Razorpay to LIVE mode?</AlertDialogTitle>
              <AlertDialogDescription>
                Real money will be charged to customers&apos; cards from the
                moment you save. Verify the live key ID and webhook secret are
                correct and that the webhook URL is registered in the Razorpay
                dashboard.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {!hasLiveCredentials && (
              <p className="text-sm text-destructive">
                Enter live credentials first.
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingMode(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmGoLive}
                disabled={!hasLiveCredentials}
                className="bg-red-600 hover:bg-red-700"
              >
                Yes, go LIVE
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Separator />

        {/* 3. Credentials */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Credentials</h3>
          {form.mode === "TEST" ? (
            <>
              <CredentialsPanel
                title="Test credentials"
                cred={config.test}
                keyIdState={secrets.testKeyId}
                onKeyIdChange={(n) => updateSecret("testKeyId", n)}
                keySecretState={secrets.testKeySecret}
                onKeySecretChange={(n) => updateSecret("testKeySecret", n)}
                webhookSecretState={secrets.testWebhookSecret}
                onWebhookSecretChange={(n) =>
                  updateSecret("testWebhookSecret", n)
                }
              />
              <Accordion type="single" collapsible>
                <AccordionItem value="live-credentials">
                  <AccordionTrigger className="text-sm font-semibold">
                    Live credentials
                  </AccordionTrigger>
                  <AccordionContent>
                    <CredentialsPanel
                      title="Live credentials"
                      cred={config.live}
                      keyIdState={secrets.liveKeyId}
                      onKeyIdChange={(n) => updateSecret("liveKeyId", n)}
                      keySecretState={secrets.liveKeySecret}
                      onKeySecretChange={(n) =>
                        updateSecret("liveKeySecret", n)
                      }
                      webhookSecretState={secrets.liveWebhookSecret}
                      onWebhookSecretChange={(n) =>
                        updateSecret("liveWebhookSecret", n)
                      }
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </>
          ) : (
            <>
              <CredentialsPanel
                title="Live credentials"
                cred={config.live}
                keyIdState={secrets.liveKeyId}
                onKeyIdChange={(n) => updateSecret("liveKeyId", n)}
                keySecretState={secrets.liveKeySecret}
                onKeySecretChange={(n) => updateSecret("liveKeySecret", n)}
                webhookSecretState={secrets.liveWebhookSecret}
                onWebhookSecretChange={(n) =>
                  updateSecret("liveWebhookSecret", n)
                }
              />
              <Accordion type="single" collapsible>
                <AccordionItem value="test-credentials">
                  <AccordionTrigger className="text-sm font-semibold">
                    Test credentials
                  </AccordionTrigger>
                  <AccordionContent>
                    <CredentialsPanel
                      title="Test credentials"
                      cred={config.test}
                      keyIdState={secrets.testKeyId}
                      onKeyIdChange={(n) => updateSecret("testKeyId", n)}
                      keySecretState={secrets.testKeySecret}
                      onKeySecretChange={(n) =>
                        updateSecret("testKeySecret", n)
                      }
                      webhookSecretState={secrets.testWebhookSecret}
                      onWebhookSecretChange={(n) =>
                        updateSecret("testWebhookSecret", n)
                      }
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </>
          )}
        </div>

        <Separator />

        {/* 4. Webhook */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Webhook</h3>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={config.webhookUrl}
              className="font-mono text-xs"
            />
            <CopyButton
              value={config.webhookUrl}
              label="Copy webhook URL"
              size="icon"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {config.webhookEvents.map((evt) => (
              <Badge
                key={evt}
                variant="secondary"
                className="font-mono text-[11px]"
              >
                {evt}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Register this URL in Razorpay Dashboard → Settings → Webhooks,
            subscribe to these events, and paste the signing secret above.
          </p>
        </div>

        <Separator />

        {/* 5. Amount rules */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Amount rules</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${baseId}-min`}>Minimum recharge</Label>
              <Input
                id={`${baseId}-min`}
                type="number"
                min={0}
                value={form.minAmount}
                onChange={(e) => updateForm({ minAmount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${baseId}-max`}>Maximum recharge</Label>
              <Input
                id={`${baseId}-max`}
                type="number"
                min={0}
                value={form.maxAmount}
                onChange={(e) => updateForm({ maxAmount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`${baseId}-quick`}>Quick amount chips</Label>
              <Input
                id={`${baseId}-quick`}
                value={form.quickAmountsText}
                placeholder="500, 1000, 2000, 5000"
                onChange={(e) =>
                  updateForm({ quickAmountsText: e.target.value })
                }
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {parseQuickAmounts(form.quickAmountsText).map((amt, idx) => (
                  <Badge key={idx} variant="secondary">
                    {formatINR(amt)}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${baseId}-expiry`}>
                Payment link expiry (hours)
              </Label>
              <Input
                id={`${baseId}-expiry`}
                type="number"
                min={1}
                max={720}
                value={form.paymentLinkExpiryHours}
                onChange={(e) =>
                  updateForm({ paymentLinkExpiryHours: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${baseId}-cap`}>Manual top-up cap</Label>
              <Input
                id={`${baseId}-cap`}
                type="number"
                min={0}
                value={policyForm.manualMaxPerTransaction}
                onChange={(e) =>
                  updatePolicyForm({ manualMaxPerTransaction: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${baseId}-threshold`}>
                Maker-checker threshold
              </Label>
              <Input
                id={`${baseId}-threshold`}
                type="number"
                min={0}
                value={policyForm.manualApprovalThreshold}
                onChange={(e) =>
                  updatePolicyForm({ manualApprovalThreshold: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Manual credits over{" "}
                {formatINR(Number(policyForm.manualApprovalThreshold) || 0)} go
                to the approvals queue for superadmin sign-off.
              </p>
              {thresholdAboveCap && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  This threshold is above the manual top-up cap — approvals can
                  never be triggered.
                </p>
              )}
            </div>
          </div>
        </div>

        {(formErrors.length > 0 || error) && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {formErrors.length > 0 ? (
                <ul className="list-disc space-y-1 pl-4">
                  {formErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              ) : (
                error
              )}
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        {/* 6. Footer */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting || hasUnsavedSecretEdits}
            >
              {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Test connection
            </Button>
            {hasUnsavedSecretEdits && (
              <p className="text-xs text-muted-foreground">
                Save your changes first — the test uses the stored credentials.
              </p>
            )}
            {testResult &&
              (testResult.ok ? (
                <p className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Connected
                  {testResult.accountHint ? ` · ${testResult.accountHint}` : ""}
                  {testResult.latencyMs != null
                    ? ` · ${testResult.latencyMs} ms`
                    : ""}
                </p>
              ) : (
                <p className="flex items-center gap-1.5 text-sm text-red-700 dark:text-red-400">
                  <XCircle className="h-4 w-4" />
                  {testResult.message}
                </p>
              ))}
            {testError && (
              <p className="flex items-center gap-1.5 text-sm text-red-700 dark:text-red-400">
                <XCircle className="h-4 w-4" />
                {testError}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={!dirty}
            >
              Reset
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!dirty || isSaving}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
