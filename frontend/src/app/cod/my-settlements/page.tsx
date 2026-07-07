"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { settlementApi, Settlement, SettlementStatus } from "@/services/api/settlement-api";
import { useAppSelector } from "@/store/hooks";
import { RefreshCw, Wallet, Clock } from "lucide-react";

const STATUS_STYLES: Record<SettlementStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  FINANCE_VERIFICATION: "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-800",
  RELEASED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  HOLD: "bg-orange-100 text-orange-800",
  CANCELLED: "bg-gray-200 text-gray-600",
};

function money(v: string | number | null | undefined): string {
  const n = typeof v === "string" ? parseFloat(v) : v || 0;
  return `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

export default function MySettlementsPage() {
  const [rows, setRows] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accessToken = useAppSelector((s) => s.auth.token);

  const load = useCallback(async () => {
    if (!accessToken) return; // wait for auth token to hydrate before calling APIs
    setLoading(true);
    setError(null);
    try {
      settlementApi.setAccessToken(accessToken);
      const res = await settlementApi.listMySettlements({ limit: 50 });
      setRows(res.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load your settlements");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const pending = rows
      .filter((r) => !["RELEASED", "CANCELLED", "REJECTED"].includes(r.status))
      .reduce((acc, r) => acc + parseFloat(r.netPayable || "0"), 0);
    const released = rows
      .filter((r) => r.status === "RELEASED")
      .reduce((acc, r) => acc + parseFloat(r.netPayable || "0"), 0);
    return { pending, released };
  }, [rows]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My COD Settlements</h1>
            <p className="text-muted-foreground">Your pending COD amount, settlement history and payout status</p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending COD</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{money(stats.pending)}</div>
              <p className="text-xs text-muted-foreground">Awaiting settlement release</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Released</CardTitle>
              <Wallet className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{money(stats.released)}</div>
              <p className="text-xs text-muted-foreground">Paid out to you</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Settlement History</CardTitle>
            <CardDescription>All settlements raised for your account</CardDescription>
          </CardHeader>
          <CardContent>
            {error && <div className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Settlement No.</TableHead>
                    <TableHead className="text-right">Net Payable</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Payout Ref</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No settlements yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.settlementNo}</TableCell>
                      <TableCell className="text-right font-semibold">{money(r.netPayable)}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_STYLES[r.status]} variant="outline">
                          {r.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{r.paymentMode || "—"}</TableCell>
                      <TableCell className="text-xs">{r.payoutReference || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {new Date(r.updatedAt).toLocaleDateString("en-IN")}
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
