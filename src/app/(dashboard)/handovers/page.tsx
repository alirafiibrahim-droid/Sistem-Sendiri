"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const handovers = [
  {
    id: "1",
    periodFrom: "2024/2025",
    periodTo: "2025/2026",
    date: "2025-09-01",
    status: "COMPLETED",
    createdBy: "Andi Pratama",
    witnesses: [
      { name: "Dr. Budi Santoso, M.T.", role: "Pembina Organisasi" },
      { name: "Rina Wulandari", role: "Ketua Senat Mahasiswa" },
    ],
  },
  {
    id: "2",
    periodFrom: "2023/2024",
    periodTo: "2024/2025",
    date: "2024-09-01",
    status: "COMPLETED",
    createdBy: "Budi Santoso",
    witnesses: [
      { name: "Prof. Siti Aminah", role: "Dekan Fakultas Teknik" },
    ],
  },
  {
    id: "3",
    periodFrom: "2025/2026",
    periodTo: "2026/2027",
    date: "2026-09-01",
    status: "DRAFT",
    createdBy: "Andi Pratama",
    witnesses: [],
  },
];

const statusVariant: Record<string, "success" | "warning" | "secondary"> = {
  COMPLETED: "success",
  SIGNED: "warning",
  DRAFT: "secondary",
};

const statusLabel: Record<string, string> = {
  COMPLETED: "Selesai",
  SIGNED: "Ditandatangani",
  DRAFT: "Draf",
};

export default function HandoversPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sertijab</h2>
          <p className="text-muted-foreground">Arsip Serah Terima Jabatan antar periode</p>
        </div>
        <Button>+ Sertijab Baru</Button>
      </div>

      <div className="space-y-4">
        {handovers.map((h) => (
          <Card key={h.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">
                    Periode {h.periodFrom} &rarr; {h.periodTo}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Tanggal: {h.date} &middot; Dibuat oleh: {h.createdBy}
                  </p>
                </div>
                <Badge variant={statusVariant[h.status]}>
                  {statusLabel[h.status]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {h.witnesses.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Saksi:</p>
                  <div className="flex flex-wrap gap-2">
                    {h.witnesses.map((w, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {w.name} - {w.role}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {h.status === "DRAFT" && (
                <div className="flex gap-2 pt-3">
                  <Button size="sm">Unggah Dokumen</Button>
                  <Button size="sm" variant="outline">Edit</Button>
                </div>
              )}
              {h.status === "SIGNED" && (
                <div className="pt-3">
                  <Button size="sm">Setujui & Selesaikan</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
