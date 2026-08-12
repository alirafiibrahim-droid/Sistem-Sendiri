"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createSupabaseClient } from "@/lib/supabase/client";
import type { OrganizationSettings } from "@/lib/types/database";
import type { ReportData } from "@/lib/types/api";

interface SettingsData {
  success: boolean;
  data?: OrganizationSettings;
}

interface ReportResponse {
  success: boolean;
  data?: ReportData;
  error?: { message: string };
}

function cellValue(row: Record<string, string | number | null>, key: string) {
  const v = row[key];
  if (v === null || v === undefined) return "-";
  return String(v);
}

function ReportPrintContent() {
  const sp = useSearchParams();
  const printed = useRef(false);

  const reportType = sp.get("type") || "";
  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    sp.forEach((value, key) => {
      if (key !== "type" && value) f[key] = value;
    });
    return f;
  }, [sp]);

  const [org, setOrg] = useState<OrganizationSettings | null>(null);
  const [data, setData] = useState<ReportData | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const supabase = createSupabaseClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.email) setUserEmail(user.email);

        const [settingsRes, dataRes] = await Promise.all([
          fetch("/api/settings").then((r) => r.json() as Promise<SettingsData>),
          fetch("/api/reports/data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: reportType, filters }),
          }).then((r) => r.json() as Promise<ReportResponse>),
        ]);

        if (!active) return;
        if (settingsRes.success && settingsRes.data) setOrg(settingsRes.data);
        if (dataRes.success && dataRes.data) setData(dataRes.data);
        else setError(dataRes.error?.message || "Gagal memuat laporan.");
      } catch {
        if (active) setError("Gagal memuat laporan.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [reportType, filters]);

  useEffect(() => {
    if (loading || error || !data || !org) return;
    if (printed.current) return;
    printed.current = true;
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, [loading, error, data, org]);

  const now = useMemo(() => {
    const d = new Date();
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-[794px] space-y-4 p-6">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-[794px] p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-3xl" aria-hidden>
              🔒
            </p>
            <h2 className="mt-2 font-semibold">Laporan tidak dapat dibuat</h2>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <Link
              href="/reports"
              className="mt-4 inline-block text-sm text-primary underline"
            >
              Kembali ke katalog
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const orgInitial = (org?.org_name || "S").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-muted/40 py-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-[794px] bg-white p-8 shadow print:max-w-none print:shadow-none print:p-10">
        <Button
          size="sm"
          variant="outline"
          className="mb-4 print:hidden"
          onClick={() => window.print()}
        >
          🖨️ Cetak / Simpan PDF
        </Button>

        {/* KOP */}
        <header className="border-b-2 border-black pb-4 text-center">
          <div className="flex flex-col items-center gap-2">
            {org?.org_logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={org.org_logo_url}
                alt="Logo"
                className="h-16 w-16 object-contain"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                {orgInitial}
              </div>
            )}
            <h1 className="text-xl font-bold uppercase tracking-wide">
              {org?.org_name || "SIORG"}
            </h1>
            {org?.org_description && (
              <p className="max-w-xl text-xs leading-relaxed">{org.org_description}</p>
            )}
            <p className="text-xs">
              {[org?.org_address, org?.org_phone_number, org?.org_email]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="mt-3 border-t-4 border-double border-black" aria-hidden />
        </header>

        {/* Judul laporan */}
        <div className="mt-6 text-center">
          <h2 className="text-base font-bold uppercase">{data.title}</h2>
          {data.subtitle && <p className="mt-1 text-sm">{data.subtitle}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            Periode Kepengurusan {org?.period_year || "-"}
          </p>
        </div>

        {/* Ringkasan */}
        {data.summary.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.summary.map((s) => (
              <div key={s.label} className="rounded border border-gray-300 px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </p>
                <p className="mt-1 truncate text-sm font-bold">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabel */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {data.columns.map((col) => (
                  <th
                    key={col.key}
                    className="border border-gray-400 bg-gray-100 px-2 py-1.5 font-semibold"
                    style={{
                      textAlign: col.align === "right" ? "right" : col.align === "center" ? "center" : "left",
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, idx) => (
                <tr key={idx} className="break-inside-avoid">
                  {data.columns.map((col) => (
                    <td
                      key={col.key}
                      className="border border-gray-400 px-2 py-1"
                      style={{
                        textAlign: col.align === "right" ? "right" : col.align === "center" ? "center" : "left",
                      }}
                    >
                      {cellValue(row, col.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {data.rows.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Tidak ada data untuk parameter yang dipilih.
            </p>
          )}
        </div>

        {/* Tanda tangan */}
        <div className="mt-12 grid grid-cols-2 gap-8 text-sm">
          <div className="text-center">
            <p>Mengetahui,</p>
            <p className="font-medium">Ketua Umum</p>
            <div className="h-24" aria-hidden />
            <p className="font-semibold underline">(……………………………………)</p>
          </div>
          <div className="text-center">
            <p>{now}</p>
            <p className="font-medium">Penyusun</p>
            <div className="h-24" aria-hidden />
            <p className="font-semibold underline">{userEmail || "(……………………………………)"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReportPrintPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[794px] space-y-4 p-6">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      }
    >
      <ReportPrintContent />
    </Suspense>
  );
}
