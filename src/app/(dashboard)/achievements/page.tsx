"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const achievements = [
  {
    id: "1",
    title: "Juara 1 Debat Nasional",
    category: "Akademik",
    level: "Nasional",
    date: "2026-06-15",
    organizer: "Kementerian Pendidikan",
    type: "ORGANIZATION",
    status: "APPROVED",
    participants: ["Andi Pratama (Ketua Tim)", "Rina Wulandari (Anggota)"],
  },
  {
    id: "2",
    title: "Best Paper Award - Konferensi Teknologi",
    category: "Penelitian",
    level: "Internasional",
    date: "2026-05-20",
    organizer: "IEEE Indonesia",
    type: "INDIVIDUAL",
    status: "APPROVED",
    participants: ["Budi Santoso"],
  },
  {
    id: "3",
    title: "Juara 2 Futsal Liga Mahasiswa",
    category: "Olahraga",
    level: "Provinsi",
    date: "2026-04-10",
    organizer: "KONI Provinsi",
    type: "ORGANIZATION",
    status: "APPROVED",
    participants: ["Rina Wulandari (Kapten)", "Eko Prasetyo", "Gilang Ramadhan"],
  },
  {
    id: "4",
    title: "Harapan 1 Lomba Fotografi",
    category: "Seni",
    level: "Nasional",
    date: "2026-03-25",
    organizer: "Himpunan Mahasiswa Desain",
    type: "INDIVIDUAL",
    status: "PENDING",
    participants: ["Dewi Lestari"],
  },
];

const statusVariant: Record<string, "success" | "warning" | "destructive"> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "destructive",
};

const statusLabel: Record<string, string> = {
  APPROVED: "Disetujui",
  PENDING: "Menunggu",
  REJECTED: "Ditolak",
};

const typeLabel: Record<string, string> = {
  ORGANIZATION: "Organisasi",
  INDIVIDUAL: "Individu",
};

export default function AchievementsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Prestasi</h2>
          <p className="text-muted-foreground">Wall of Fame - Prestasi organisasi dan individu</p>
        </div>
        <Button>+ Ajukan Prestasi</Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {achievements.map((a) => (
          <Card key={a.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{a.title}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{a.category}</Badge>
                    <Badge variant="outline">{a.level}</Badge>
                    <Badge variant="outline">{typeLabel[a.type]}</Badge>
                  </div>
                </div>
                <Badge variant={statusVariant[a.status]}>
                  {statusLabel[a.status]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {a.organizer} &middot; {a.date}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Peserta:</p>
                <div className="flex flex-wrap gap-1">
                  {a.participants.map((p) => (
                    <Badge key={p} variant="secondary" className="text-xs">
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
              {a.status === "PENDING" && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="default">Setujui</Button>
                  <Button size="sm" variant="outline">Tolak</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
