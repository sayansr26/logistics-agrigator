"use client";

import { useMemo, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
  Search,
  ListTree,
  Lock,
  Trash2,
} from "lucide-react";
import {
  useGetChargeDefinitionsQuery,
  useUpdateChargeDefinitionStatusMutation,
  useDeleteChargeDefinitionMutation,
  type ChargeDefinition,
} from "@/store/api/endpoints/chargesApi";

const STAGE_COLORS: Record<string, string> = {
  QUOTE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  BOOKING_OPTION:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  EVENT:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
};

const CATEGORY_COLORS: Record<string, string> = {
  BASE: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  VAS: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300",
  SURCHARGE:
    "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  DISCOUNT: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  TAX: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  EVENT:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
};

function JsonBlock({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <p className="text-sm text-muted-foreground">Not configured</p>;
  }
  return (
    <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function ChargeDefinitionsPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [selected, setSelected] = useState<ChargeDefinition | null>(null);

  const { data, isLoading, error, refetch } = useGetChargeDefinitionsQuery({
    limit: 100,
  });
  const [updateStatus, { isLoading: isTogglingStatus }] =
    useUpdateChargeDefinitionStatusMutation();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const definitions = data?.data?.definitions || [];

  const categories = useMemo(
    () => Array.from(new Set(definitions.map((d) => d.category))).sort(),
    [definitions],
  );

  const filtered = definitions.filter((def) => {
    if (
      search &&
      !def.code.toLowerCase().includes(search.toLowerCase()) &&
      !def.name.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    if (categoryFilter !== "all" && def.category !== categoryFilter) {
      return false;
    }
    if (stageFilter !== "all" && def.applyStage !== stageFilter) {
      return false;
    }
    return true;
  });

  const [deleteDefinition, { isLoading: isDeleting }] =
    useDeleteChargeDefinitionMutation();
  const [definitionToDelete, setDefinitionToDelete] =
    useState<ChargeDefinition | null>(null);

  const handleDelete = async () => {
    if (!definitionToDelete) return;
    try {
      await deleteDefinition(definitionToDelete.id).unwrap();
      if (selected?.id === definitionToDelete.id) setSelected(null);
      setDefinitionToDelete(null);
    } catch {
      // errorMiddleware surfaces the toast
    }
  };

  const handleToggle = async (def: ChargeDefinition) => {
    setTogglingId(def.id);
    try {
      await updateStatus({ id: def.id, isActive: !def.isActive }).unwrap();
    } catch {
      // errorMiddleware surfaces the toast
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeader
          title="Charge Definitions"
          description="System catalog of chargeable line items (charges-engine v3)"
        />

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Catalog</CardTitle>
                <CardDescription>
                  {definitions.length} definitions configured
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search code or name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-56 pl-9"
                  />
                </div>
                <Select
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    <SelectItem value="QUOTE">Quote</SelectItem>
                    <SelectItem value="BOOKING_OPTION">
                      Booking Option
                    </SelectItem>
                    <SelectItem value="EVENT">Event</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => refetch()}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  Failed to load charge definitions
                </h3>
                <Button onClick={() => refetch()} variant="outline">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ListTree className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No charge definitions match your filters
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((def) => (
                    <TableRow
                      key={def.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(def)}
                    >
                      <TableCell className="font-mono text-xs font-medium">
                        <div className="flex items-center gap-1.5">
                          {def.code}
                          {def.isSystem && (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{def.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={CATEGORY_COLORS[def.category] || ""}
                        >
                          {def.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={STAGE_COLORS[def.applyStage] || ""}
                        >
                          {def.applyStage}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {def.phase}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {def.computation?.method || "-"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`active-${def.id}`}
                            checked={def.isActive}
                            onCheckedChange={() => handleToggle(def)}
                            disabled={isTogglingStatus && togglingId === def.id}
                          />
                        </div>
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={def.isSystem}
                          title={
                            def.isSystem
                              ? "System definitions cannot be deleted — deactivate instead"
                              : "Delete definition"
                          }
                          onClick={() => setDefinitionToDelete(def)}
                        >
                          <Trash2
                            className={
                              def.isSystem
                                ? "h-4 w-4 text-muted-foreground"
                                : "h-4 w-4 text-red-500"
                            }
                          />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </PageContainer>

      <Sheet
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-lg"
        >
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 font-mono">
                  {selected.code}
                  {selected.isSystem && (
                    <Badge variant="secondary" className="font-sans">
                      <Lock className="mr-1 h-3 w-3" />
                      System
                    </Badge>
                  )}
                </SheetTitle>
                <SheetDescription>{selected.name}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className={CATEGORY_COLORS[selected.category] || ""}
                  >
                    {selected.category}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={STAGE_COLORS[selected.applyStage] || ""}
                  >
                    {selected.applyStage}
                  </Badge>
                  <Badge variant="outline">Phase {selected.phase}</Badge>
                  <Badge variant={selected.isActive ? "default" : "secondary"}>
                    {selected.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                {selected.description && (
                  <p className="text-sm text-muted-foreground">
                    {selected.description}
                  </p>
                )}

                <div>
                  <h4 className="mb-2 text-sm font-semibold">Computation</h4>
                  <JsonBlock value={selected.computation} />
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold">
                    Booking Question
                  </h4>
                  <JsonBlock value={selected.bookingQuestion} />
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold">Conditions</h4>
                  <JsonBlock value={selected.conditions} />
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold">Aggregation</h4>
                  <JsonBlock value={selected.aggregation} />
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold">Flags</h4>
                  <JsonBlock value={selected.flags} />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      <AlertDialog
        open={!!definitionToDelete}
        onOpenChange={(open) => !open && setDefinitionToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Charge Definition</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes{" "}
              <span className="font-mono">{definitionToDelete?.code}</span>
              {definitionToDelete?.name
                ? ` (${definitionToDelete.name})`
                : ""}{" "}
              from the catalog, along with every partner charge config that uses
              it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
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
