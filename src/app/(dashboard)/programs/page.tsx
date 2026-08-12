"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Division, ProgramWithDetails } from "@/lib/types/database";

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  ONGOING: "warning",
  PLANNED: "secondary",
  COMPLETED: "success",
  CANCELLED: "destructive",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

interface HandoverOption {
  id: string;
  period_from: string;
  period_to: string;
  status: string;
}

export default function ProgramsPage() {
  const supabase = createSupabaseClient();
  const [programs, setPrograms] = useState<ProgramWithDetails[]>([]);
  const [budgets, setBudgets] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [handovers, setHandovers] = useState<HandoverOption[]>([]);
  const [periodFilter, setPeriodFilter] = useState("ALL");
  const [divisionFilter, setDivisionFilter] = useState("ALL");

  useEffect(() => {
    supabase
      .from("divisions")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (data) setDivisions(data as Division[]);
      });

    supabase
      .from("handovers")
      .select("id, period_from, period_to, status")
      .order("period_to", { ascending: false })
      .then(({ data }) => {
        const list = (data || []) as HandoverOption[];
        setHandovers(list);
        const active =
          list.find((h) => h.status === "ONGOING") ||
          list.find((h) => h.status !== "COMPLETED");
        setPeriodFilter(active ? active.id : "ALL");
      });
  }, [supabase]);

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("programs")
      .select("*, divisions(id, name), handovers(id, period_from, period_to, status)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }
    if (statusFilter !== "ALL") {
      query = query.eq("status", statusFilter);
    }
    if (periodFilter !== "ALL") {
      query = query.eq("handover_id", periodFilter);
    }
    if (divisionFilter !== "ALL") {
      query = query.eq("division_id", divisionFilter);
    }

    const { data } = await query;
    if (data) {
      const programIds = data.map((p: { id: string }) => p.id);
      const averageScoreByProgram = new Map<string, number>();
      const budgetByProgram = new Map<string, number>();

      if (programIds.length > 0) {
        const { data: budgetItems } = await supabase
          .from("budget_items")
          .select("program_id, subtotal, parent_id")
          .in("program_id", programIds);

        for (const item of budgetItems || []) {
          if (item.parent_id) continue;
          budgetByProgram.set(
            item.program_id,
            (budgetByProgram.get(item.program_id) || 0) + Number(item.subtotal)
          );
        }
        for (const b of budgetItems || []) {
          if (!b.parent_id) continue;
          budgetByProgram.set(
            b.program_id,
            (budgetByProgram.get(b.program_id) || 0) + Number(b.subtotal)
          );
        }
      }

      if (programIds.length > 0) {
        const { data: sessions } = await supabase
          .from("program_sessions")
          .select("id, program_id")
          .in("program_id", programIds);

        const sessionIds = (sessions || []).map((s) => s.id);
        if (sessionIds.length > 0) {
          const { data: attendants } = await supabase
            .from("program_session_attendants")
            .select("session_id, score")
            .in("session_id", sessionIds)
            .not("score", "is", null);

          const sessionScoreMap = new Map<string, number[]>();
          for (const a of attendants || []) {
            const list = sessionScoreMap.get(a.session_id) || [];
            list.push(a.score);
            sessionScoreMap.set(a.session_id, list);
          }

          const programSessionAverages = new Map<string, number[]>();
          for (const s of sessions || []) {
            const scores = sessionScoreMap.get(s.id);
            if (!scores || scores.length === 0) continue;
            const avg = scores.reduce((sum, v) => sum + v, 0) / scores.length;
            const list = programSessionAverages.get(s.program_id) || [];
            list.push(avg);
            programSessionAverages.set(s.program_id, list);
          }

          for (const [pid, avgs] of programSessionAverages) {
            averageScoreByProgram.set(
              pid,
              avgs.reduce((sum, v) => sum + v, 0) / avgs.length
            );
          }
        }
      }

      setPrograms(
        (data as ProgramWithDetails[]).map((p) => ({
          ...p,
          average_score: averageScoreByProgram.get(p.id) ?? null,
        }))
      );
      setBudgets(budgetByProgram);
    }
    setLoading(false);
  }, [supabase, search, statusFilter, periodFilter, divisionFilter]);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  const selectedHandover = handovers.find((h) => h.id === periodFilter);

  const summary = useMemo(() => {
    const totalPrograms = programs.length;
    const totalBudget = programs.reduce(
      (sum, p) => sum + (budgets.get(p.id) || 0),
      0
    );
    const byDivision = new Map<string, number>();
    for (const p of programs) {
      const name = p.divisions?.name ?? "Tanpa Divisi";
      byDivision.set(name, (byDivision.get(name) || 0) + 1);
    }
    const divisionBreakdown = Array.from(byDivision.entries()).sort(
      (a, b) => b[1] - a[1]
    );
    return { totalPrograms, totalBudget, divisionBreakdown };
  }, [programs, budgets]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Program Kerja</h2>
          <p className="text-muted-foreground">Kelola semua program kerja organisasi</p>
        </div>
        <Link href="/programs/new">
          <Button>+ Program Baru</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Program Kerja
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "-" : summary.totalPrograms}
            </div>
            <CardDescription>
              {selectedHandover
                ? `Periode ${selectedHandover.period_to}`
                : periodFilter === "ALL"
                  ? "Semua periode"
                  : "-"}
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Program per Divisi
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.divisionBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada data</p>
            ) : (
              <div className="space-y-1.5">
                {summary.divisionBreakdown.slice(0, 5).map(([name, count]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate">{name}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
                {summary.divisionBreakdown.length > 5 && (
                  <p className="text-xs text-muted-foreground">
                    +{summary.divisionBreakdown.length - 5} divisi lainnya
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Anggaran
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "-" : formatCurrency(summary.totalBudget)}
            </div>
            <CardDescription>Total anggaran dari pos anggaran program kerja</CardDescription>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Cari program..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">Semua Status</option>
          <option value="PLANNED">Planned</option>
          <option value="ONGOING">Ongoing</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
        <Select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)}>
          <option value="ALL">Semua Periode</option>
          {handovers.map((h) => (
            <option key={h.id} value={h.id}>
              Periode {h.period_to}
              {h.status === "ONGOING" ? " (Berjalan)" : ""}
            </option>
          ))}
        </Select>
        <Select value={divisionFilter} onChange={(e) => setDivisionFilter(e.target.value)}>
          <option value="ALL">Semua Divisi</option>
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Program</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead>Divisi</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Anggaran</TableHead>
                <TableHead>Penilaian</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : programs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Belum ada program kerja.
                  </TableCell>
                </TableRow>
              ) : (
                programs.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <Link href={`/programs/${p.id}`} className="hover:underline">
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.handovers ? (
                        <span className="inline-flex items-center gap-1.5">
                          Periode {p.handovers.period_to}
                          {p.handovers.status === "COMPLETED" && (
                            <span className="text-xs text-muted-foreground">(Selesai)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{p.divisions?.name ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[p.status]}>{p.status}</Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(budgets.get(p.id) || 0)}</TableCell>
                    <TableCell>
                      {p.average_score != null ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-sm font-semibold text-success">
                          {p.average_score.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {p.start_date} s/d {p.end_date}
                    </TableCell>
                    <TableCell>
                      <Link href={`/programs/${p.id}`}>
                        <Button variant="ghost" size="icon">
                          ...
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
