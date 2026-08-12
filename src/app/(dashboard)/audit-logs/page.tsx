"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditLog } from "@/lib/types/database";

interface AuditLogRow extends AuditLog {
  profiles: { id: string; full_name: string } | null;
}

interface LogsResponse {
  success: boolean;
  data?: AuditLogRow[];
  meta?: { total: number; page: number; limit: number; totalPages: number };
  error?: { message: string };
}

const TABLE_OPTIONS = [
  { value: "programs", label: "Program Kerja" },
  { value: "tasks", label: "Tugas Proker" },
  { value: "program_members", label: "Anggota Proker" },
  { value: "program_sessions", label: "Sesi Proker" },
  { value: "program_session_attendants", label: "Absensi Sesi Proker" },
  { value: "profiles", label: "Anggota" },
  { value: "organization_settings", label: "Pengaturan Organisasi" },
  { value: "divisions", label: "Divisi" },
  { value: "fakultas", label: "Fakultas" },
  { value: "jurusan", label: "Jurusan" },
  { value: "finances", label: "Keuangan" },
  { value: "banks", label: "Bank" },
  { value: "cash_accounts", label: "Kas" },
  { value: "wallets", label: "Dompet" },
  { value: "inventory_items", label: "Inventaris" },
  { value: "letters", label: "Persuratan" },
  { value: "achievements", label: "Prestasi" },
  { value: "handovers", label: "Sertijab" },
  { value: "incidental_projects", label: "Proyek Insidental" },
  { value: "trainings", label: "Latihan (Keatletan)" },
  { value: "training_sessions", label: "Sesi Latihan" },
  { value: "training_session_attendants", label: "Absensi Latihan" },
  { value: "assessments", label: "Penilaian Atlet" },
  { value: "athlete_targets", label: "Target Atlet" },
  { value: "athletic_metrics", label: "Metrik Atletik" },
  { value: "budget_items", label: "Item Anggaran" },
  { value: "dues_templates", label: "Templat Iuran" },
  { value: "dues_payments", label: "Pembayaran Iuran" },
  { value: "achievement_participants", label: "Peserta Prestasi" },
  { value: "project_sessions", label: "Sesi Proyek" },
  { value: "project_session_attendants", label: "Absensi Sesi Proyek" },
  { value: "project_attendances", label: "Absensi Proyek" },
  { value: "attendances", label: "Absensi" },
  { value: "project_funds", label: "Dana Proyek Insidental" },
  { value: "project_milestones", label: "Milestone Proyek" },
  { value: "project_team", label: "Tim Proyek" },
  { value: "inventory_damage_logs", label: "Log Kerusakan" },
  { value: "inventory_disposals", label: "Penghapusan Barang" },
  { value: "inventory_loans", label: "Peminjaman Barang" },
  { value: "inventory_purchases", label: "Pembelian Barang" },
];

const ACTION_META: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "default" }> = {
  CREATE: { label: "Buat", variant: "success" },
  UPDATE: { label: "Ubah", variant: "warning" },
  DELETE: { label: "Hapus", variant: "destructive" },
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function DiffView({ oldValue, newValue }: { oldValue: unknown; newValue: unknown }) {
  const oldObj = oldValue && typeof oldValue === "object" ? (oldValue as Record<string, unknown>) : null;
  const newObj = newValue && typeof newValue === "object" ? (newValue as Record<string, unknown>) : null;

  if (oldObj && newObj) {
    const keys = Array.from(
      new Set([...Object.keys(oldObj), ...Object.keys(newObj)])
    ).filter((k) => JSON.stringify(oldObj[k]) !== JSON.stringify(newObj[k]));

    if (keys.length > 0) {
      return (
        <div className="space-y-2">
          {keys.map((key) => (
            <div key={key} className="grid grid-cols-[120px_1fr] gap-3 text-sm">
              <div className="text-muted-foreground font-medium break-all">{key}</div>
              <div className="grid grid-cols-2 gap-2">
                <pre className="rounded-md bg-muted p-2 text-xs overflow-x-auto whitespace-pre-wrap text-destructive">
                  {formatValue(oldObj[key])}
                </pre>
                <pre className="rounded-md bg-muted p-2 text-xs overflow-x-auto whitespace-pre-wrap text-green-700 dark:text-green-400">
                  {formatValue(newObj[key])}
                </pre>
              </div>
            </div>
          ))}
        </div>
      );
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <p className="text-xs text-muted-foreground font-medium mb-1">Nilai Lama</p>
        <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto whitespace-pre-wrap text-destructive">
          {formatValue(oldValue)}
        </pre>
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium mb-1">Nilai Baru</p>
        <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto whitespace-pre-wrap text-green-700 dark:text-green-400">
          {formatValue(newValue)}
        </pre>
      </div>
    </div>
  );
}

function DetailModal({ log, onClose }: { log: AuditLogRow; onClose: () => void }) {
  const meta = ACTION_META[log.action] ?? { label: log.action, variant: "default" as const };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-xl border bg-background p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Detail Audit</h3>
            <p className="text-sm text-muted-foreground">
              {new Date(log.created_at).toLocaleString("id-ID", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={meta.variant}>{meta.label}</Badge>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Tutup
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Pengguna</p>
            <p className="font-medium truncate">{log.profiles?.full_name ?? "Sistem"}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Tabel Target</p>
            <p className="font-medium">{log.target_table ?? "-"}</p>
          </div>
          <div className="rounded-lg border p-3 sm:col-span-2">
            <p className="text-xs text-muted-foreground">ID Target</p>
            <p className="font-mono text-xs break-all">{log.target_id ?? "-"}</p>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium mb-2">Perubahan Data</p>
          <DiffView oldValue={log.old_value} newValue={log.new_value} />
        </div>
      </div>
    </div>
  );
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 25, totalPages: 0 });

  const [actionFilter, setActionFilter] = useState("ALL");
  const [tableFilter, setTableFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AuditLogRow | null>(null);

  const appliedRef = useRef({ action: "ALL", table: "ALL", q: "", limit: 25 });

  const fetchLogs = useCallback(
    async (
      page: number,
      opts?: { limit?: number; action?: string; table?: string; q?: string }
    ) => {
      const limit = opts?.limit ?? appliedRef.current.limit;
      const action = opts?.action ?? appliedRef.current.action;
      const table = opts?.table ?? appliedRef.current.table;
      const q = opts?.q ?? appliedRef.current.q;
      appliedRef.current = { action, table, q, limit };

      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (action !== "ALL") params.set("action", action);
      if (table !== "ALL") params.set("target_table", table);
      if (q.trim()) params.set("q", q.trim());

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      const json: LogsResponse = await res.json();
      if (!json.success) {
        setError(json.error?.message || "Gagal memuat audit log.");
        setLogs([]);
        setMeta({ total: 0, page: 1, limit, totalPages: 0 });
      } else {
        setLogs(json.data ?? []);
        setMeta({
          total: json.meta?.total ?? 0,
          page: json.meta?.page ?? 1,
          limit: json.meta?.limit ?? limit,
          totalPages: json.meta?.totalPages ?? 0,
        });
      }
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    fetchLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") fetchLogs(meta.page);
    }, 30000);
    return () => clearInterval(id);
  }, [fetchLogs, meta.page]);

  const applyFilters = () => {
    fetchLogs(1, {
      action: actionFilter,
      table: tableFilter,
      q: search,
    });
  };

  const tableLabels = (name: string) =>
    TABLE_OPTIONS.find((t) => t.value === name)?.label ?? name;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Audit Trail</h2>
          <p className="text-muted-foreground">
            Jejak aktivitas perubahan data sensitif di sistem
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchLogs(meta.page)}>
          Muat Ulang
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Cari nama pengguna..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyFilters();
          }}
          className="max-w-sm"
        />
        <Select
          value={actionFilter}
          onChange={(e) => {
            const value = e.target.value;
            setActionFilter(value);
            fetchLogs(1, { action: value, table: tableFilter, q: search });
          }}
        >
          <option value="ALL">Semua Aksi</option>
          <option value="CREATE">Buat</option>
          <option value="UPDATE">Ubah</option>
          <option value="DELETE">Hapus</option>
        </Select>
        <Select
          value={tableFilter}
          onChange={(e) => {
            const value = e.target.value;
            setTableFilter(value);
            fetchLogs(1, { action: actionFilter, table: value, q: search });
          }}
        >
          <option value="ALL">Semua Tabel</option>
          {TABLE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        <Button size="sm" onClick={applyFilters}>
          Terapkan Filter
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Pengguna</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Tabel</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-destructive py-8">
                    {error}
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Belum ada aktivitas yang tercatat.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const metaBadge = ACTION_META[log.action] ?? {
                    label: log.action,
                    variant: "default" as const,
                  };
                  return (
                    <TableRow key={log.id} className="cursor-pointer" onClick={() => setSelected(log)}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(log.created_at).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            fallback={
                              log.profiles?.full_name
                                ? log.profiles.full_name.charAt(0).toUpperCase()
                                : "S"
                            }
                            className="h-7 w-7 text-xs"
                          />
                          <span className="font-medium">
                            {log.profiles?.full_name ?? "Sistem"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={metaBadge.variant}>{metaBadge.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{tableLabels(log.target_table ?? "-")}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          Detail
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Total <span className="font-semibold">{meta.total}</span> catatan
        </p>
        <div className="flex items-center gap-3">
          <Select
            value={String(meta.limit)}
            onChange={(e) => fetchLogs(1, { limit: Number(e.target.value) })}
            className="w-24"
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </Select>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1 || loading}
              onClick={() => fetchLogs(meta.page - 1)}
            >
              Sebelumnya
            </Button>
            <span className="text-sm text-muted-foreground">
              Halaman {meta.page} / {Math.max(meta.totalPages, 1)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages || loading}
              onClick={() => fetchLogs(meta.page + 1)}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      </div>

      {selected && <DetailModal log={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
