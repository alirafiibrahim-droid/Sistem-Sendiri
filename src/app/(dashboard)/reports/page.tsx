"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { REPORT_MODULES } from "@/lib/reports";
import type { ReportDefinition } from "@/lib/reports";

interface CatalogResponse {
  success: boolean;
  data?: ReportDefinition[];
  error?: { message: string };
}

export default function ReportsPage() {
  const [catalog, setCatalog] = useState<ReportDefinition[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/reports/catalog")
      .then((r) => r.json())
      .then((json: CatalogResponse) => {
        if (!active) return;
        if (json.success && json.data) setCatalog(json.data);
        else setError(json.error?.message || "Gagal memuat katalog laporan.");
      })
      .catch(() => {
        if (active) setError("Gagal memuat katalog laporan.");
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Laporan</h2>
          <p className="text-sm text-muted-foreground">Katalog laporan organisasi</p>
        </div>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {error}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!catalog) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Laporan</h2>
          <p className="text-sm text-muted-foreground">Katalog laporan organisasi</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const groups = REPORT_MODULES.map((mod) => ({
    ...mod,
    reports: catalog.filter((r) => r.module === mod.key),
  })).filter((g) => g.reports.length > 0);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Laporan</h2>
        <p className="text-sm text-muted-foreground">
          Pilih jenis laporan, atur parameter, lalu buat & unduh dalam format PDF atau Excel.
        </p>
      </div>

      {groups.map((group) => (
        <section key={group.key}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="text-base">{group.icon}</span>
            {group.key}
            <span className="text-xs font-normal text-muted-foreground/60">
              ({group.reports.length})
            </span>
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.reports.map((report) => (
              <Link key={report.slug} href={`/reports/${report.slug}`} className="group">
                <Card className="h-full transition-colors group-hover:border-primary/50">
                  <CardContent className="flex h-full flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-2xl" aria-hidden>
                        {report.icon}
                      </span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {report.code}
                      </Badge>
                    </div>
                    <div>
                      <h4 className="font-semibold leading-snug">{report.title}</h4>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {report.description}
                      </p>
                    </div>
                    <div className="mt-auto flex items-center gap-2">
                      <Badge variant="secondary">PDF</Badge>
                      <Badge variant="secondary">Excel</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}

    </div>
  );
}
