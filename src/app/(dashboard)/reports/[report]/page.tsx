"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReportDefinition, ReportFilterField } from "@/lib/reports";
import type { ReportData } from "@/lib/types/api";

interface Option {
  value: string;
  label: string;
}

interface CatalogResponse {
  success: boolean;
  data?: ReportDefinition[];
  error?: { message: string };
  meta?: { userRole?: string };
}

const PREVIEW_LIMIT = 50;

function cellValue(row: Record<string, string | number | null>, key: string) {
  const v = row[key];
  if (v === null || v === undefined) return "-";
  return String(v);
}

export default function ReportConfigPage() {
  const params = useParams<{ report: string }>();
  const slug = params.report;

  const [report, setReport] = useState<ReportDefinition | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [notAllowed, setNotAllowed] = useState(false);
  const [loadingReport, setLoadingReport] = useState(true);

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<Record<string, Option[]>>({});
  const [loadingOptions, setLoadingOptions] = useState<Record<string, boolean>>({});

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/reports/catalog")
      .then((r) => r.json())
      .then((json: CatalogResponse) => {
        if (!active) return;
        setRole(json.meta?.userRole || null);
        if (json.success && json.data) {
          const found = json.data.find((r) => r.slug === slug);
          if (found) {
            setReport(found);
            const initial: Record<string, string> = {};
            for (const f of found.filters) {
              if (f.defaultValue) initial[f.key] = f.defaultValue;
            }
            setFilters(initial);
          } else {
            setNotAllowed(true);
          }
        } else {
          setNotAllowed(true);
        }
      })
      .catch(() => setNotAllowed(true))
      .finally(() => {
        if (active) setLoadingReport(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const loadOptions = useCallback(
    async (field: ReportFilterField) => {
      const source = field.source;
      if (!source || source === "none" || options[source]) return;
      setLoadingOptions((prev) => ({ ...prev, [source]: true }));
      try {
        let url = "";
        switch (source) {
          case "divisions":
            url = "/api/divisions";
            break;
          case "fakultas":
            url = "/api/fakultas";
            break;
          case "jurusan":
            url = "/api/jurusan";
            break;
          case "programs":
            url = "/api/programs?limit=500";
            break;
          case "projects":
            url = "/api/incidental-projects?limit=100";
            break;
          case "handovers":
            url = "/api/handovers?limit=100";
            break;
          case "accounts":
            url = "/api/finances/dashboard";
            break;
        }
        if (!url) return;
        const json = await fetch(url).then((r) => r.json());
        const arr = json.data || [];
        let opts: Option[] = [];
        if (source === "divisions" || source === "fakultas" || source === "jurusan") {
          opts = arr.map((d: { id: string; name: string }) => ({
            value: d.id,
            label: d.name,
          }));
        } else if (source === "programs" || source === "projects") {
          opts = arr.map((p: { id: string; name: string }) => ({
            value: p.id,
            label: p.name,
          }));
        } else if (source === "handovers") {
          opts = arr.map((h: { id: string; period_from: string; period_to: string }) => ({
            value: h.id,
            label: `Periode ${h.period_to}`,
          }));
        } else if (source === "accounts") {
          opts = [
            ...(arr.banks || []).map((b: { bank_id: string; bank_name: string }) => ({
              value: `bank:${b.bank_id}`,
              label: `Bank: ${b.bank_name}`,
            })),
            ...(arr.cash_accounts || []).map((c: { cash_account_id: string; cash_account_name: string }) => ({
              value: `cash:${c.cash_account_id}`,
              label: `Kas: ${c.cash_account_name}`,
            })),
            ...(arr.wallets || []).map((w: { wallet_id: string; wallet_name: string }) => ({
              value: w.wallet_id,
              label: `Dompet: ${w.wallet_name}`,
            })),
          ];
        }
        setOptions((prev) => ({ ...prev, [source]: opts }));
      } finally {
        setLoadingOptions((prev) => ({ ...prev, [source]: false }));
      }
    },
    [options]
  );

  useEffect(() => {
    if (!report) return;
    for (const f of report.filters) {
      if (f.type === "select" && f.source) loadOptions(f);
    }
  }, [report, loadOptions]);

  const visibleFilters = useMemo(() => {
    if (!report) return [];
    return role === "KABID"
      ? report.filters.filter((f) => !(f.key === "division_id" || f.source === "divisions"))
      : report.filters;
  }, [report, role]);

  const canFetch = useMemo(() => {
    if (!report) return false;
    return report.filters
      .filter((f) => f.required)
      .every((f) => Boolean(filters[f.key]));
  }, [report, filters]);

  useEffect(() => {
    if (!report || !canFetch) {
      setData(null);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/reports/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: report.slug, filters }),
        });
        const json = await res.json();
        if (json.success) setData(json.data as ReportData);
        else setError(json.error?.message || "Gagal memuat data laporan.");
      } catch {
        setError("Gagal memuat data laporan.");
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [report, canFetch, filters]);

  const downloadExcel = useCallback(() => {
    if (!report || !data) return;
    const sep = ";";
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const header = data.columns.map((c) => esc(c.label)).join(sep);
    const lines = data.rows.map((row) =>
      data.columns.map((c) => esc(cellValue(row, c.key))).join(sep)
    );
    const csv = "\uFEFF" + [header, ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.code}_${report.slug}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [report, data]);

  const printUrl = useMemo(() => {
    if (!report) return "";
    const sp = new URLSearchParams();
    sp.set("type", report.slug);
    for (const [k, v] of Object.entries(filters)) {
      if (v) sp.set(k, v);
    }
    return `/reports/${report.slug}/print?${sp.toString()}`;
  }, [report, filters]);

  if (loadingReport) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (notAllowed || !report) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-3xl" aria-hidden>
              🔒
            </p>
            <h2 className="mt-2 font-semibold">Akses Ditolak</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Anda tidak memiliki akses untuk melihat laporan ini.
            </p>
            <Link href="/reports" className="mt-4 inline-block text-sm text-primary underline">
              Kembali ke katalog
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/reports" className="text-sm text-muted-foreground hover:underline">
          ← Katalog
        </Link>
        <span className="text-muted-foreground">/</span>
        <Badge variant="outline" className="font-mono text-[10px]">
          {report.code}
        </Badge>
        <h2 className="text-lg font-semibold">{report.title}</h2>
      </div>

      <p className="text-sm text-muted-foreground">{report.description}</p>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Parameter Laporan</CardTitle>
            <CardDescription>Isi parameter wajib untuk membuat laporan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {visibleFilters.map((field) => {
              const value = filters[field.key] || "";
              const opts =
                field.options ||
                (field.source && field.source !== "none" ? options[field.source] || [] : []);
              const loadingOpts = field.source ? loadingOptions[field.source] : false;
              return (
                <div key={field.key}>
                  <label className="mb-1 block text-sm font-medium">
                    {field.label}
                    {field.required && <span className="text-red-500"> *</span>}
                  </label>
                  {field.type === "date" && (
                    <Input
                      type="date"
                      value={value}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                    />
                  )}
                  {field.type === "text" && (
                    <Input
                      type="text"
                      value={value}
                      placeholder={field.help || ""}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                    />
                  )}
                  {(field.type === "select" || field.type === "mode") && (
                    <Select
                      value={value}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                    >
                      <option value="">— Pilih —</option>
                      {loadingOpts && <option disabled>Memuat…</option>}
                      {opts.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  )}
                  {field.help && <p className="mt-1 text-xs text-muted-foreground">{field.help}</p>}
                </div>
              );
            })}

            {!canFetch && (
              <p className="text-xs text-muted-foreground">
                Lengkapi parameter bertanda * terlebih dahulu.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" disabled={!canFetch || !data || loading} onClick={downloadExcel}>
                <span aria-hidden>📊</span> Unduh Excel
              </Button>
              {printUrl && (
                <a
                  href={printUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={canFetch && data ? "" : "pointer-events-none opacity-50"}
                >
                  <Button size="sm" variant="outline" disabled={!canFetch || !data}>
                    <span aria-hidden>🖨️</span> Unduh PDF
                  </Button>
                </a>
              )}
            </div>
            {data && (
              <span className="text-xs text-muted-foreground">
                {data.rows.length} baris data
              </span>
            )}
          </div>

          {loading && (
            <Card>
              <CardContent className="space-y-3 py-6">
                <Skeleton className="h-20 rounded-lg" />
                <Skeleton className="h-40 rounded-lg" />
              </CardContent>
            </Card>
          )}

          {!loading && error && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-red-500">{error}</CardContent>
            </Card>
          )}

          {!loading && !error && data && (
            <>
              {data.summary.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {data.summary.map((s) => (
                    <Card key={s.label}>
                      <CardContent className="py-3">
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                        <p className="mt-1 truncate text-base font-semibold">{s.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pratinjau</CardTitle>
                  <CardDescription>
                    {data.subtitle
                      ? `${data.title} · ${data.subtitle}`
                      : `Menampilkan ${Math.min(data.rows.length, PREVIEW_LIMIT)} dari ${data.rows.length} baris`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {data.columns.map((col) => (
                          <TableHead
                            key={col.key}
                            className={
                              col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""
                            }
                          >
                            {col.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.slice(0, PREVIEW_LIMIT).map((row, idx) => (
                        <TableRow key={idx}>
                          {data.columns.map((col) => (
                            <TableCell
                              key={col.key}
                              className={
                                col.align === "right"
                                  ? "text-right"
                                  : col.align === "center"
                                    ? "text-center"
                                    : ""
                              }
                            >
                              {cellValue(row, col.key)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {data.rows.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Tidak ada data untuk parameter yang dipilih.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {!loading && !error && !data && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Lengkapi parameter untuk melihat pratinjau laporan.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
