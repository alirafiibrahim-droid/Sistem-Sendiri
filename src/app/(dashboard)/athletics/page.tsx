"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const metrics = [
  { id: "1", name: "Kecepatan 100m", type: "QUANTITATIVE", unit: "s", latest: 12.5, target: 12.0 },
  { id: "2", name: "Bench Press", type: "QUANTITATIVE", unit: "kg", latest: 60, target: 70 },
  { id: "3", name: "Teknik Dasar", type: "QUALITATIVE", unit: "skala 1-5", latest: 4, target: 5 },
  { id: "4", name: "Lari 5km", type: "QUANTITATIVE", unit: "menit", latest: 25, target: 22 },
];

const trainingSessions = [
  { id: "1", date: "2026-07-14", type: "Kardio & Teknik", coach: "Rina Wulandari", duration: 90, intensity: "HIGH", athletes: 12 },
  { id: "2", date: "2026-07-13", type: "Strength Training", coach: "Rina Wulandari", duration: 60, intensity: "MEDIUM", athletes: 8 },
  { id: "3", date: "2026-07-12", type: "Recovery Session", coach: "Rina Wulandari", duration: 45, intensity: "LOW", athletes: 15 },
  { id: "4", date: "2026-07-11", type: "Speed & Agility", coach: "Rina Wulandari", duration: 75, intensity: "HIGH", athletes: 10 },
];

const intensityVariant: Record<string, "destructive" | "warning" | "secondary"> = {
  HIGH: "destructive",
  MEDIUM: "warning",
  LOW: "secondary",
};

export default function AthleticsPage() {
  const [tab, setTab] = useState<"metrics" | "sessions">("metrics");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Keatletan</h2>
          <p className="text-muted-foreground">Monitoring performa dan sesi latihan atlet</p>
        </div>
        <Button>+ Sesi Latihan Baru</Button>
      </div>

      <div className="flex gap-2">
        <Button
          variant={tab === "metrics" ? "default" : "outline"}
          onClick={() => setTab("metrics")}
        >
          Metrik Performa
        </Button>
        <Button
          variant={tab === "sessions" ? "default" : "outline"}
          onClick={() => setTab("sessions")}
        >
          Sesi Latihan
        </Button>
      </div>

      {tab === "metrics" && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {metrics.map((m) => (
              <Card key={m.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{m.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Terbaru</span>
                      <span className="font-semibold">{m.latest} {m.unit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Target</span>
                      <span className="text-sm">{m.target} {m.unit}</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min((m.latest / m.target) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Daftar Metrik</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Metrik</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Satuan</TableHead>
                    <TableHead>Nilai Terbaru</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.map((m) => {
                    const achieved = m.type === "QUANTITATIVE" && m.unit === "s"
                      ? m.latest <= m.target
                      : m.latest >= m.target;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{m.type}</Badge>
                        </TableCell>
                        <TableCell>{m.unit}</TableCell>
                        <TableCell className="font-semibold">{m.latest}</TableCell>
                        <TableCell>{m.target}</TableCell>
                        <TableCell>
                          <Badge variant={achieved ? "success" : "warning"}>
                            {achieved ? "Tercapai" : "Belum"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {tab === "sessions" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jenis Sesi</TableHead>
                  <TableHead>Pelatih</TableHead>
                  <TableHead>Durasi</TableHead>
                  <TableHead>Intensitas</TableHead>
                  <TableHead>Atlet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trainingSessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm">{s.date}</TableCell>
                    <TableCell className="font-medium">{s.type}</TableCell>
                    <TableCell>{s.coach}</TableCell>
                    <TableCell>{s.duration} menit</TableCell>
                    <TableCell>
                      <Badge variant={intensityVariant[s.intensity]}>{s.intensity}</Badge>
                    </TableCell>
                    <TableCell>{s.athletes} orang</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
