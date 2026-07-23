"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
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
import type { TrainingSessionWithCoach, TrainingSessionAttendant } from "@/lib/types/database";
import Link from "next/link";

const CATEGORY_LABELS: Record<string, string> = {
  STRENGTH: "Strength", POWER: "Power", SPEED: "Speed", AGILITY: "Agility",
  ENDURANCE: "Endurance", FLEXIBILITY: "Flexibility", TEKNIK: "Teknik",
  MENTAL: "Mental", GAME_INTELLIGENCE: "Game Intelligence",
};

const intensityVariant: Record<string, "destructive" | "warning" | "secondary"> = {
  HIGH: "destructive", MEDIUM: "warning", LOW: "secondary",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<TrainingSessionWithCoach | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrUrl, setQrUrl] = useState("");
  const [showQr, setShowQr] = useState(false);

  const fetchSession = useCallback(async () => {
    const res = await fetch(`/api/training-sessions/${id}`);
    const json = await res.json();
    if (json.success) setSession(json.data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (!showQr || !id) return;
    fetch(`/api/training-sessions/${id}/qr`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setQrUrl(j.data.scan_url);
      });
  }, [showQr, id]);

  const handleManualAttendance = async (athleteId: string) => {
    const res = await fetch(`/api/training-sessions/${id}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "MANUAL" }),
    });
    const json = await res.json();
    if (json.success) fetchSession();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Memuat data sesi...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Sesi latihan tidak ditemukan.</p>
        <Link href="/athletics">
          <Button variant="outline">Kembali</Button>
        </Link>
      </div>
    );
  }

  const attendants = session.training_session_attendants || [];
  const qrScanUrl = qrUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrUrl)}`
    : "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/athletics" className="text-sm text-muted-foreground hover:underline">
            ← Kembali ke Keatletan
          </Link>
          <h2 className="text-2xl font-bold tracking-tight mt-1">Detail Sesi Latihan</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowQr(!showQr)}>
            {showQr ? "Sembunyikan QR" : "Tampilkan QR Code"}
          </Button>
        </div>
      </div>

      {/* Session Info */}
      <Card>
        <CardHeader>
          <CardTitle>Informasi Sesi</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Tanggal</p>
            <p className="font-semibold">{formatDate(session.date)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Jenis Latihan</p>
            <p className="font-semibold">
              {session.trainings?.name || session.session_type || "-"}
              {session.trainings?.category && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {CATEGORY_LABELS[session.trainings.category] || session.trainings.category}
                </Badge>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pelatih</p>
            <p className="font-semibold">{session.profiles?.full_name || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Durasi / Intensitas</p>
            <p className="font-semibold">
              {session.duration_minutes} menit
              {session.intensity && (
                <Badge variant={intensityVariant[session.intensity] || "secondary"} className="ml-2 text-xs">
                  {session.intensity}
                </Badge>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* QR Code */}
      {showQr && (
        <Card>
          <CardHeader>
            <CardTitle>QR Code Absensi</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {qrScanUrl ? (
              <>
                <img
                  src={qrScanUrl}
                  alt="QR Code Absensi"
                  width={250}
                  height={250}
                  className="border rounded-lg"
                />
                <p className="text-sm text-muted-foreground text-center">
                  Scan QR code ini untuk absensi. URL: {qrUrl}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(qrUrl);
                  }}
                >
                  Salin Link Absensi
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground">Memuat QR code...</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Attendance List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Daftar Kehadiran ({attendants.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>NIM</TableHead>
                <TableHead>Metode</TableHead>
                <TableHead>Waktu Scan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Belum ada kehadiran tercatat.
                  </TableCell>
                </TableRow>
              ) : (
                attendants.map((a: TrainingSessionAttendant) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      {a.profiles?.full_name || a.athlete_id}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {a.profiles?.nim || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.method === "QR" ? "default" : "secondary"}>
                        {a.method}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.scanned_at
                        ? new Date(a.scanned_at).toLocaleString("id-ID")
                        : "-"}
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
