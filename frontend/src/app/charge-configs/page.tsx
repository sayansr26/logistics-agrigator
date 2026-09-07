"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { PageHeader, PageContainer } from "@/components/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Loader2,
  AlertCircle,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Wand2,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Inbox,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PromptTemplates } from "@/components/charges/prompt-templates";
import {
  useGetPartnersQuery,
  type Partner,
} from "@/store/api/endpoints/partnersApi";
import { useListServiceChannelsQuery } from "@/store/api/endpoints/serviceChannelApi";
import {
  useGetChargeConfigsQuery,
  useGetChargeDefinitionsQuery,
  useCreateChargeConfigMutation,
  useUpdateChargeConfigMutation,
  useDeleteChargeConfigMutation,
  useDraftChargeConfigFromTextMutation,
  useGetAiSuggestionsQuery,
  useApproveAiSuggestionMutation,
  useRejectAiSuggestionMutation,
  useRunAnomalyScanMutation,
  type ChargeConfig,
  type ChargeDefinition,
  type AiSuggestion,
  type AnomalyFinding,
  type ApplySuggestionResult,
} from "@/store/api/endpoints/chargesApi";

// ============================================
// HELPERS
// ============================================

function isAiUnavailable(err: any): boolean {
  return (
    err?.status === 503 ||
    err?.data?.error?.code === "AI_UNAVAILABLE" ||
    err?.originalStatus === 503
  );
}

function apiErrorMessage(err: any, fallback: string): string {
  if (isAiUnavailable(err)) return "AI assistant unavailable right now.";
  return err?.data?.error?.message || fallback;
}

function tryParseJson(
  text: string,
  fieldLabel: string,
): { ok: true; value: any } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch (e) {
    return { ok: false, error: `Invalid JSON in ${fieldLabel}` };
  }
}

const SEVERITY_STYLES: Record<string, string> = {
  HIGH: "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  MEDIUM:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  LOW: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
};

const KIND_LABELS: Record<string, string> = {
  CONFIG_FROM_NL: "NL Draft",
  LEGACY_IMPORT: "Legacy Import",
  ANOMALY: "Anomaly Scan",
};

// ============================================
// SUGGESTION CARD (shared by AI panel + inbox)
// ============================================

function SuggestionCard({
  suggestion,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
  results,
}: {
  suggestion: AiSuggestion;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
  results?: ApplySuggestionResult | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const payload = suggestion.suggestion;
  const isPending = suggestion.status === "PENDING";
  const applyErrors = suggestion.validation?.applyErrors || [];

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-muted-foreground hover:text-foreground"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          <Badge variant="outline">
            {KIND_LABELS[suggestion.kind] || suggestion.kind}
          </Badge>
          <Badge
            variant={
              suggestion.status === "APPLIED"
                ? "default"
                : suggestion.status === "REJECTED"
                  ? "destructive"
                  : "secondary"
            }
          >
            {suggestion.status}
          </Badge>
          {suggestion.modelUsed && (
            <span className="text-xs text-muted-foreground">
              {suggestion.modelUsed}
            </span>
          )}
        </div>
        {isPending && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onReject}
              disabled={isApproving || isRejecting}
            >
              {isRejecting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <XCircle className="mr-1.5 h-3.5 w-3.5" />
              )}
              Reject
            </Button>
            <Button
              size="sm"
              onClick={onApprove}
              disabled={isApproving || isRejecting}
            >
              {isApproving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Approve
            </Button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="space-y-3 pl-6">
          {payload.understanding && (
            <p className="text-sm">{payload.understanding}</p>
          )}

          {/* Anything the prompt asked for that the system did not act on.
              Deliberately ABOVE the config preview: this is the answer to "why
              did it ignore my instruction?", and it used to be invisible. */}
          {payload.unsupported && payload.unsupported.length > 0 && (
            <Alert className="border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="mb-1 font-semibold">
                  Not applied from your prompt
                </p>
                <ul className="list-disc space-y-1 pl-4">
                  {payload.unsupported.map((u, i) => (
                    <li key={i}>
                      <span className="font-medium">{u.request}</span>
                      <span className="text-amber-800 dark:text-amber-300">
                        {" "}
                        — {u.reason}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs">
                  These are read as instructions but have no field in the charge
                  contract. Configure them separately, or rephrase and re-draft.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* What the model understood, before code turned it into UUIDs. */}
          {payload.rateCards && payload.rateCards.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Rate card read from your prompt
              </p>
              {payload.rateCards.map((rc, idx) => (
                <div key={idx} className="rounded-md bg-muted p-2 text-xs">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {rc.chargeName || "Base freight"}
                    </span>
                    {rc.channel ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {rc.channel}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        partner-wide
                      </Badge>
                    )}
                    <span className="text-muted-foreground">
                      billing unit {rc.billingUnitKg ?? 1} kg
                    </span>
                  </div>
                  <ul className="space-y-0.5">
                    {(rc.bands || []).map((b, i) => (
                      <li key={i} className="text-muted-foreground">
                        {b.zone ? `${b.zone}: ` : ""}
                        {b.fromKm}-{b.toKm ?? "\u221e"} km · ₹{b.ratePerUnit}
                        {b.minFreight ? ` · min ₹${b.minFreight}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Worked examples re-priced through the real engine. */}
          {payload.replay && payload.replay.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Your examples, re-priced by the engine
              </p>
              {payload.replay.map((r, idx) => (
                <div key={idx} className="rounded-md bg-muted p-2 text-xs">
                  {r.results.length === 0 ? (
                    <p className="text-muted-foreground">
                      No worked examples in the prompt — nothing to verify.
                      Include a few and they get checked automatically.
                    </p>
                  ) : (
                    <ul className="space-y-0.5">
                      {r.results.map((x, i) => (
                        <li
                          key={i}
                          className={
                            x.pass
                              ? "text-green-700 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }
                        >
                          {x.distanceKm}km / {x.weightKg}kg — expected ₹
                          {x.expectedFreight}, engine gives{" "}
                          {x.actualFreight === null
                            ? `nothing (${x.reason})`
                            : `₹${x.actualFreight}`}{" "}
                          {x.pass ? "✓" : "✗"}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {payload.configs && payload.configs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Proposed Configs
              </p>
              {payload.configs.map((cfg, idx) => (
                <div key={idx} className="rounded-md bg-muted p-2">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="font-mono text-[10px]"
                    >
                      {cfg.chargeDefinitionCode}
                    </Badge>
                  </div>
                  <pre className="max-h-40 overflow-auto text-xs leading-relaxed">
                    {JSON.stringify(cfg.config, null, 2)}
                  </pre>
                  {cfg.conditions ? (
                    <>
                      <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
                        conditions
                      </p>
                      <pre className="max-h-32 overflow-auto text-xs leading-relaxed">
                        {JSON.stringify(cfg.conditions, null, 2)}
                      </pre>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {payload.findings && payload.findings.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Findings
              </p>
              <AnomalyFindingsList findings={payload.findings} />
            </div>
          )}

          {payload.encoderWarnings && payload.encoderWarnings.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc space-y-1 pl-4">
                  {payload.encoderWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {payload.warnings && payload.warnings.length > 0 && (
            <Alert className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc space-y-1 pl-4">
                  {payload.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {applyErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc space-y-1 pl-4">
                  {applyErrors.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {results && (
            <div className="space-y-1 text-sm">
              {(() => {
                const created = results.configs.filter(
                  (c) => c.action === "CREATED",
                );
                const updated = results.configs.filter(
                  (c) => c.action === "UPDATED",
                );
                return (
                  <>
                    {created.length > 0 && (
                      <p className="text-green-700 dark:text-green-400">
                        Created {created.length} config
                        {created.length === 1 ? "" : "s"}:{" "}
                        {created.map((c) => c.code).join(", ")}
                      </p>
                    )}
                    {/* An update replaces live pricing — say so explicitly. */}
                    {updated.length > 0 && (
                      <p className="text-amber-700 dark:text-amber-400">
                        Replaced {updated.length} existing config
                        {updated.length === 1 ? "" : "s"}:{" "}
                        {updated
                          .map(
                            (c) =>
                              `${c.code} (v${c.previousVersion} → v${c.version})`,
                          )
                          .join(", ")}
                      </p>
                    )}
                  </>
                );
              })()}
              {results.definitions.filter((d) => d.action === "CREATED")
                .length > 0 && (
                <p className="text-green-700 dark:text-green-400">
                  Created{" "}
                  {
                    results.definitions.filter((d) => d.action === "CREATED")
                      .length
                  }{" "}
                  definition
                  {results.definitions.filter((d) => d.action === "CREATED")
                    .length === 1
                    ? ""
                    : "s"}
                </p>
              )}
              {results.warnings?.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc space-y-1 pl-4">
                      {results.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              {results.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc space-y-1 pl-4">
                      {results.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AnomalyFindingsList({ findings }: { findings: AnomalyFinding[] }) {
  return (
    <div className="space-y-2">
      {findings.map((f, idx) => (
        <div
          key={idx}
          className={cn(
            "rounded-md border p-3 text-sm",
            SEVERITY_STYLES[f.severity] || SEVERITY_STYLES.LOW,
          )}
        >
          <div className="mb-1 flex items-center gap-2">
            <Badge variant="outline" className="bg-transparent">
              {f.severity}
            </Badge>
            <span className="font-mono text-xs font-semibold">
              {f.chargeCode}
            </span>
          </div>
          <p>{f.issue}</p>
          <p className="mt-1 text-xs opacity-80">Suggestion: {f.suggestion}</p>
        </div>
      ))}
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

/**
 * Radix <Select> cannot hold value="", so partner-wide gets an explicit
 * sentinel that is mapped back to `undefined` at the request boundary.
 */
const ALL_CHANNELS = "__ALL__";

export default function ChargeConfigsPage() {
  const searchParams = useSearchParams();
  // Deep link from the partners list/detail actions: /charge-configs?partnerId=…
  const partnerIdFromUrl = searchParams.get("partnerId") || "";
  const [selectedPartnerId, setSelectedPartnerId] =
    useState<string>(partnerIdFromUrl);

  const { data: partnersData, isLoading: partnersLoading } =
    useGetPartnersQuery({ limit: 100 });
  const partners: Partner[] = partnersData?.data?.partners || [];

  // Follow the URL when it changes (deep link), else auto-select the first
  // partner once the list loads.
  useEffect(() => {
    if (partnerIdFromUrl) {
      setSelectedPartnerId(partnerIdFromUrl);
      return;
    }
    if (!selectedPartnerId && partners.length > 0) {
      setSelectedPartnerId(partners[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partners.length, partnerIdFromUrl]);

  // Channel scope for AI drafting. "" means partner-wide; Radix <Select> cannot
  // hold an empty value, so the sentinel below stands in for it in the UI.
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const { data: channelsData, isLoading: channelsLoading } =
    useListServiceChannelsQuery(selectedPartnerId, {
      skip: !selectedPartnerId,
    });
  const channels = channelsData?.data?.accounts || [];

  // Reset the channel whenever the partner changes — a stale channel from
  // partner A submitted for partner B is rejected by the backend FK check and
  // fails the whole draft.
  useEffect(() => {
    setSelectedChannelId("");
  }, [selectedPartnerId]);

  const {
    data: configsData,
    isLoading: configsLoading,
    error: configsError,
    refetch: refetchConfigs,
  } = useGetChargeConfigsQuery(
    { partnerId: selectedPartnerId, limit: 100 },
    { skip: !selectedPartnerId },
  );
  const configs: ChargeConfig[] = configsData?.data?.configs || [];

  const { data: definitionsData } = useGetChargeDefinitionsQuery({
    limit: 100,
  });
  const definitions: ChargeDefinition[] =
    definitionsData?.data?.definitions || [];

  const [createConfig, { isLoading: isCreating }] =
    useCreateChargeConfigMutation();
  const [updateConfig, { isLoading: isUpdating }] =
    useUpdateChargeConfigMutation();
  const [deleteConfig, { isLoading: isDeleting }] =
    useDeleteChargeConfigMutation();

  // ---- Create / Edit dialog state ----
  const [formOpen, setFormOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ChargeConfig | null>(null);
  const [formDefinitionId, setFormDefinitionId] = useState("");
  const [formConfigText, setFormConfigText] = useState("{}");
  const [formConditionsText, setFormConditionsText] = useState("");
  const [formPriority, setFormPriority] = useState("100");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreateDialog = () => {
    setEditingConfig(null);
    setFormDefinitionId("");
    setFormConfigText("{}");
    setFormConditionsText("");
    setFormPriority("100");
    setFormIsActive(true);
    setFormError(null);
    setFormOpen(true);
  };

  const openEditDialog = (config: ChargeConfig) => {
    setEditingConfig(config);
    setFormDefinitionId(config.chargeDefinitionId);
    setFormConfigText(JSON.stringify(config.config, null, 2));
    setFormConditionsText(
      config.conditions ? JSON.stringify(config.conditions, null, 2) : "",
    );
    setFormPriority(String(config.priority ?? 100));
    setFormIsActive(config.isActive);
    setFormError(null);
    setFormOpen(true);
  };

  const handleFormSubmit = async () => {
    setFormError(null);

    if (!editingConfig && !formDefinitionId) {
      setFormError("Select a charge definition");
      return;
    }

    const configResult = tryParseJson(formConfigText, "config");
    if (configResult.ok === false) {
      setFormError(configResult.error);
      return;
    }
    const conditionsResult = tryParseJson(formConditionsText, "conditions");
    if (conditionsResult.ok === false) {
      setFormError(conditionsResult.error);
      return;
    }

    const priorityNum =
      formPriority.trim() === "" ? undefined : Number(formPriority);

    try {
      if (editingConfig) {
        await updateConfig({
          id: editingConfig.id,
          data: {
            config: configResult.value ?? {},
            conditions: conditionsResult.value ?? null,
            isActive: formIsActive,
            priority: priorityNum,
          },
        }).unwrap();
      } else {
        await createConfig({
          partnerId: selectedPartnerId,
          chargeDefinitionId: formDefinitionId,
          config: configResult.value ?? {},
          conditions: conditionsResult.value,
          priority: priorityNum,
          isActive: formIsActive,
        }).unwrap();
      }
      setFormOpen(false);
    } catch (err: any) {
      setFormError(apiErrorMessage(err, "Failed to save charge config"));
    }
  };

  // ---- Delete confirm state ----
  const [configToDelete, setConfigToDelete] = useState<ChargeConfig | null>(
    null,
  );
  const handleDelete = async () => {
    if (!configToDelete) return;
    try {
      await deleteConfig(configToDelete.id).unwrap();
    } catch {
      // errorMiddleware surfaces the toast
    } finally {
      setConfigToDelete(null);
    }
  };

  // ---- AI draft-from-text ----
  const [aiDescription, setAiDescription] = useState("");
  const [draft, setDraft] = useState<AiSuggestion | null>(null);
  const [draftValidationProblems, setDraftValidationProblems] = useState<
    string[]
  >([]);
  const [draftResults, setDraftResults] =
    useState<ApplySuggestionResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const [draftFromText, { isLoading: isDrafting }] =
    useDraftChargeConfigFromTextMutation();
  const [approveSuggestion, { isLoading: isApproving }] =
    useApproveAiSuggestionMutation();
  const [rejectSuggestion, { isLoading: isRejecting }] =
    useRejectAiSuggestionMutation();

  const handleGenerateDraft = async () => {
    setAiError(null);
    setDraft(null);
    setDraftResults(null);
    if (!aiDescription.trim()) {
      setAiError("Describe the charge you want to configure");
      return;
    }
    try {
      const res = await draftFromText({
        description: aiDescription,
        partnerId: selectedPartnerId || undefined,
        channelId: selectedChannelId || undefined,
      }).unwrap();
      setDraft(res.data.suggestion);
      setDraftValidationProblems(res.data.validationProblems || []);
    } catch (err: any) {
      setAiError(apiErrorMessage(err, "Failed to generate a draft"));
    }
  };

  const handleApproveDraft = async () => {
    if (!draft) return;
    setAiError(null);
    try {
      const res = await approveSuggestion(draft.id).unwrap();
      setDraft(res.data.suggestion);
      setDraftResults(res.data.results);
    } catch (err: any) {
      setAiError(apiErrorMessage(err, "Failed to approve suggestion"));
    }
  };

  const handleRejectDraft = async () => {
    if (!draft) return;
    setAiError(null);
    try {
      const res = await rejectSuggestion({ id: draft.id }).unwrap();
      setDraft(res.data.suggestion);
    } catch (err: any) {
      setAiError(apiErrorMessage(err, "Failed to reject suggestion"));
    }
  };

  // ---- Anomaly scan ----
  const [anomalyFindings, setAnomalyFindings] = useState<
    AnomalyFinding[] | null
  >(null);
  const [anomalyScannedCount, setAnomalyScannedCount] = useState<number | null>(
    null,
  );
  const [anomalyError, setAnomalyError] = useState<string | null>(null);
  const [runAnomalyScan, { isLoading: isScanning }] =
    useRunAnomalyScanMutation();

  const handleRunAnomalyScan = async () => {
    setAnomalyError(null);
    setAnomalyFindings(null);
    if (!selectedPartnerId) return;
    try {
      const res = await runAnomalyScan({
        partnerId: selectedPartnerId,
      }).unwrap();
      setAnomalyFindings(res.data.findings || []);
      setAnomalyScannedCount(res.data.scannedConfigs);
    } catch (err: any) {
      setAnomalyError(apiErrorMessage(err, "Failed to run anomaly scan"));
    }
  };

  // ---- Suggestion inbox ----
  const {
    data: inboxData,
    isLoading: inboxLoading,
    refetch: refetchInbox,
  } = useGetAiSuggestionsQuery({ status: "PENDING", limit: 20 });
  const inboxSuggestions: AiSuggestion[] = inboxData?.data?.suggestions || [];

  const [inboxActionId, setInboxActionId] = useState<string | null>(null);
  const handleInboxApprove = async (id: string) => {
    setInboxActionId(id);
    try {
      await approveSuggestion(id).unwrap();
      refetchInbox();
    } catch {
      // errorMiddleware surfaces the toast
    } finally {
      setInboxActionId(null);
    }
  };
  const handleInboxReject = async (id: string) => {
    setInboxActionId(id);
    try {
      await rejectSuggestion({ id }).unwrap();
      refetchInbox();
    } catch {
      // errorMiddleware surfaces the toast
    } finally {
      setInboxActionId(null);
    }
  };

  const selectedPartner = partners.find((p) => p.id === selectedPartnerId);

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeader
          title="Charge Configs"
          description="Per-partner charge configuration, powered by AI assist"
        />

        {/* Partner selector */}
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center">
            <Label className="shrink-0 text-sm font-medium">Partner</Label>
            <Select
              value={selectedPartnerId}
              onValueChange={setSelectedPartnerId}
              disabled={partnersLoading}
            >
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="Select a partner" />
              </SelectTrigger>
              <SelectContent>
                {partners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.displayName || p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {partnersLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}

            <Label className="shrink-0 text-sm font-medium sm:ml-4">
              Channel
            </Label>
            <Select
              value={selectedChannelId || ALL_CHANNELS}
              onValueChange={(v) =>
                setSelectedChannelId(v === ALL_CHANNELS ? "" : v)
              }
              disabled={!selectedPartnerId || channelsLoading}
            >
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue placeholder="All channels (partner-wide)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CHANNELS}>
                  All channels (partner-wide)
                </SelectItem>
                {channels.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.channelName} · {c.minWeight}-{c.maxWeight ?? "\u221e"} kg
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {channelsLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </CardContent>
          <CardContent className="pb-6 pt-0">
            <p className="text-xs text-muted-foreground">
              A channel-scoped charge overrides the partner-wide one for that
              channel. Keep at least one partner-wide card as a fallback — a
              shipment matching no channel has no base freight, and the partner
              is then dropped from the quote entirely.
            </p>
          </CardContent>
        </Card>

        {/* AI Assist - headline feature */}
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>AI Assist</CardTitle>
            </div>
            <CardDescription>
              Describe a charge in plain language and let AI draft the config
              for review before it goes live.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={aiDescription}
              onChange={(e) => setAiDescription(e.target.value)}
              placeholder='e.g. "Add a fuel surcharge of 8% on the base freight for this partner"'
              rows={aiDescription.includes("\n") ? 14 : 3}
              className={cn(
                aiDescription.includes("\n") && "font-mono text-xs",
              )}
            />
            <PromptTemplates onUse={setAiDescription} />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={handleGenerateDraft}
                disabled={isDrafting || !selectedPartnerId}
              >
                {isDrafting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-2 h-4 w-4" />
                )}
                Draft with AI
              </Button>
              <Button
                variant="outline"
                onClick={handleRunAnomalyScan}
                disabled={isScanning || !selectedPartnerId}
              >
                {isScanning ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                )}
                Run Anomaly Scan
              </Button>
            </div>

            {aiError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{aiError}</AlertDescription>
              </Alert>
            )}

            {draft && (
              <>
                {draftValidationProblems.length > 0 && (
                  <Alert className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertDescription>
                      <ul className="list-disc space-y-1 pl-4">
                        {draftValidationProblems.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                <SuggestionCard
                  suggestion={draft}
                  onApprove={handleApproveDraft}
                  onReject={handleRejectDraft}
                  isApproving={isApproving}
                  isRejecting={isRejecting}
                  results={draftResults}
                />
              </>
            )}

            {anomalyError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{anomalyError}</AlertDescription>
              </Alert>
            )}

            {anomalyFindings && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Scanned {anomalyScannedCount ?? 0} configs,{" "}
                  {anomalyFindings.length} finding
                  {anomalyFindings.length === 1 ? "" : "s"}
                </p>
                {anomalyFindings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No anomalies detected.
                  </p>
                ) : (
                  <AnomalyFindingsList findings={anomalyFindings} />
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configs table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {selectedPartner
                    ? `${selectedPartner.displayName || selectedPartner.name} — Configs`
                    : "Charge Configs"}
                </CardTitle>
                <CardDescription>{configs.length} configured</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => refetchConfigs()}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  onClick={openCreateDialog}
                  disabled={!selectedPartnerId}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Config
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedPartnerId ? (
              <p className="py-8 text-center text-muted-foreground">
                Select a partner to view its charge configs
              </p>
            ) : configsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : configsError ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  Failed to load charge configs
                </h3>
                <Button onClick={() => refetchConfigs()} variant="outline">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
              </div>
            ) : configs.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                No charge configs for this partner yet
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Config Preview</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((cfg) => (
                    <TableRow key={cfg.id}>
                      <TableCell className="font-mono text-xs font-medium">
                        {cfg.chargeDefinition?.code || cfg.chargeDefinitionId}
                      </TableCell>
                      <TableCell>{cfg.chargeDefinition?.name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {cfg.chargeDefinition?.category || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <code className="block truncate text-xs text-muted-foreground">
                          {JSON.stringify(cfg.config)}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={cfg.isActive ? "default" : "secondary"}>
                          {cfg.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(cfg)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfigToDelete(cfg)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Suggestion inbox */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Suggestion Inbox</CardTitle>
            </div>
            <CardDescription>
              Pending AI suggestions awaiting review (NL drafts, legacy imports,
              anomaly findings)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {inboxLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : inboxSuggestions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No pending suggestions
              </p>
            ) : (
              <div className="space-y-3">
                {inboxSuggestions.map((s) => (
                  <SuggestionCard
                    key={s.id}
                    suggestion={s}
                    onApprove={() => handleInboxApprove(s.id)}
                    onReject={() => handleInboxReject(s.id)}
                    isApproving={isApproving && inboxActionId === s.id}
                    isRejecting={isRejecting && inboxActionId === s.id}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </PageContainer>

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? "Edit Charge Config" : "Add Charge Config"}
            </DialogTitle>
            <DialogDescription>
              {editingConfig
                ? `${editingConfig.chargeDefinition?.code || ""} for ${selectedPartner?.displayName || selectedPartner?.name || "this partner"}`
                : `New config for ${selectedPartner?.displayName || selectedPartner?.name || "this partner"}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!editingConfig && (
              <div className="space-y-2">
                <Label>Charge Definition *</Label>
                <Select
                  value={formDefinitionId}
                  onValueChange={setFormDefinitionId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a definition" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {definitions.map((def) => (
                      <SelectItem key={def.id} value={def.id}>
                        {def.code} — {def.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="config-json">Config (JSON) *</Label>
              <Textarea
                id="config-json"
                value={formConfigText}
                onChange={(e) => setFormConfigText(e.target.value)}
                rows={8}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="conditions-json">
                Conditions (JSON, optional)
              </Label>
              <Textarea
                id="conditions-json"
                value={formConditionsText}
                onChange={(e) => setFormConditionsText(e.target.value)}
                rows={4}
                className="font-mono text-xs"
                placeholder="null"
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value)}
                  className="w-28"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  id="config-active"
                  checked={formIsActive}
                  onCheckedChange={setFormIsActive}
                />
                <Label htmlFor="config-active">Active</Label>
              </div>
            </div>

            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleFormSubmit}
              disabled={isCreating || isUpdating}
            >
              {(isCreating || isUpdating) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingConfig ? "Save Changes" : "Create Config"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!configToDelete}
        onOpenChange={(open) => !open && setConfigToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Charge Config</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the{" "}
              <span className="font-mono">
                {configToDelete?.chargeDefinition?.code}
              </span>{" "}
              config for this partner. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
