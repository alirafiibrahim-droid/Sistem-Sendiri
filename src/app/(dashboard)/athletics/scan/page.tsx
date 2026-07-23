"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
import type { TrainingSessionWithCoach } from "@/lib/types/database";

const CATEGORY_LABELS: Record<string, string> = {
  STRENGTH: "Strength", POWER: "Power", SPEED: "Speed", AGILITY: "Agility",
  ENDURANCE: "Endurance", FLEXIBILITY: "Flexibility", TEKNIK: "Teknik",
  MENTAL: "Mental", GAME_INTELLIGENCE: "Game Intelligence",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function ScanPageInner() {
  const searchParams = useSearchParams();
  const preselectedSession = searchParams.get("session") || "";

  const [mode, setMode] = useState<"select" | "manual" | "qr">(
    preselectedSession ? "qr" : "select"
  );
  const [sessions, setSessions] = useState<TrainingSessionWithCoach[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [attendedSessions, setAttendedSessions] = useState<Set<string>>(new Set());

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/training-sessions?limit=50");
    const json = await res.json();
    if (json.success) setSessions(json.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Auto-submit if session param is provided (from QR scan)
  useEffect(() => {
    if (!preselectedSession || submitting || message) return;

    // Check if already attended
    if (attendedSessions.has(preselectedSession)) {
      setMessage({ type: "success", text: "Anda sudah tercatat hadir di sesi ini." });
      return;
    }

    handleAttendance(preselectedSession, "QR");
  }, [preselectedSession, attendedSessions]);

  const handleAttendance = async (sessionId: string, method: "MANUAL" | "QR") => {
    setSubmitting(true);
    setMessage(null);

    const res = await fetch(`/api/training-sessions/${sessionId}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method }),
    });

    const json = await res.json();

    if (json.success) {
      setMessage({ type: "success", text: "Kehadiran berhasil dicatat!" });
      setAttendedSessions((prev) => new Set(prev).add(sessionId));
    } else {
      setMessage({
        type: "error",
        text: json.error?.message || "Gagal mencatat kehadiran.",
      });
    }

    setSubmitting(false);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Absensi Sesi Latihan</h2>
        <p className="text-muted-foreground">Pilih metode absensi atau scan QR code</p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg border ${
            message.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Mode selector */}
      <div className="flex gap-3">
        <Button
          variant={mode === "select" || mode === "manual" ? "default" : "outline"}
          onClick={() => setMode("manual")}
        >
          Absensi Manual
        </Button>
        <Button
          variant={mode === "qr" ? "default" : "outline"}
          onClick={() => setMode("qr")}
        >
          Scan QR Code
        </Button>
      </div>

      {/* Manual mode: list sessions, click to attend */}
      {mode === "manual" && (
        <Card>
          <CardHeader>
            <CardTitle>Pilih Sesi Latihan</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jenis Latihan</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      Memuat sesi...
                    </TableCell>
                  </TableRow>
                ) : sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      Tidak ada sesi latihan tersedia.
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">{formatDate(s.date)}</TableCell>
                      <TableCell className="font-medium">
                        {s.trainings?.name || s.session_type || "-"}
                        {s.trainings?.category && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {CATEGORY_LABELS[s.trainings.category] || s.trainings.category}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {attendedSessions.has(s.id) ? (
                          <Badge variant="success">Hadir</Badge>
                        ) : (
                          <Button
                            size="sm"
                            disabled={submitting}
                            onClick={() => handleAttendance(s.id, "MANUAL")}
                          >
                            {submitting ? "Mengirim..." : "Hadir"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* QR mode: shows if preselectedSession is set, otherwise prompt to scan */}
      {mode === "qr" && (
        <Card>
          <CardHeader>
            <CardTitle>Scan QR Code</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {preselectedSession ? (
              submitting ? (
                <p className="text-muted-foreground">Mencatat kehadiran...</p>
              ) : (
                <p className="text-muted-foreground">
                  {message?.type === "success"
                    ? "Kehadiran sudah tercatat."
                    : "Memproses absensi..."}
                </p>
              )
            ) : (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Buka kamera HP Anda dan scan QR Code yang ditampilkan oleh pelatih.
                </p>
                <p className="text-sm text-muted-foreground">
                  QR Code berisi link yang akan membuka halaman ini dan otomatis mencatat kehadiran Anda.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ScanAttendancePage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Memuat...</div>}>
      <ScanPageInner />
    </Suspense>
  );
}
