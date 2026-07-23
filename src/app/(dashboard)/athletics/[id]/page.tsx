"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TrainingSessionWithCoach, TrainingSessionAttendant, UserRole } from "@/lib/types/database";
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

interface AssessmentRow {
  id: string;
  athlete_id: string;
  value: number;
  notes: string | null;
  profiles: { id: string; full_name: string; nim: string } | null;
  athletic_metrics: { id: string; name: string; category: string } | null;
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createSupabaseClient();
  const [session, setSession] = useState<TrainingSessionWithCoach | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrUrl, setQrUrl] = useState("");
  const [showQr, setShowQr] = useState(false);

  // User role
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  // Assessments
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(true);
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({});
  const [savingAthlete, setSavingAthlete] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<Record<string, string>>({});

  // Fetch user role
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            if (data) setUserRole(data.role);
          });
      }
    });
  }, [supabase]);

  const canAssess = userRole === "ADMIN" || userRole === "PELATIH" || userRole === "PENGURUS_INTI" || userRole === "KABID";

  // Fetch session
  const fetchSession = useCallback(async () => {
    const res = await fetch(`/api/training-sessions/${id}`);
    const json = await res.json();
    if (json.success) setSession(json.data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Fetch existing assessments
  const fetchAssessments = useCallback(async () => {
    setAssessmentsLoading(true);
    const res = await fetch(`/api/training-sessions/${id}/assessments`);
    const json = await res.json();
    if (json.success) {
      setAssessments(json.data);
      // Pre-fill score inputs from existing assessments
      const inputs: Record<string, string> = {};
      for (const a of json.data) {
        inputs[a.athlete_id] = String(a.value);
      }
      setScoreInputs(inputs);
    }
    setAssessmentsLoading(false);
  }, [id]);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  // Fetch QR URL
  useEffect(() => {
    if (!showQr || !id) return;
    fetch(`/api/training-sessions/${id}/qr`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setQrUrl(j.data.scan_url); });
  }, [showQr, id]);

  // Submit assessment
  const handleSaveScore = async (athleteId: string) => {
    const val = scoreInputs[athleteId];
    if (!val) return;

    const numVal = Number(val);
    if (isNaN(numVal) || numVal < 1 || numVal > 10) {
      setSaveMsg((prev) => ({ ...prev, [athleteId]: "Score harus 1-10" }));
      return;
    }

    setSavingAthlete(athleteId);
    setSaveMsg((prev) => ({ ...prev, [athleteId]: "" }));

    const res = await fetch(`/api/training-sessions/${id}/assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ athlete_id: athleteId, value: numVal }),
    });

    const json = await res.json();

    if (json.success) {
      setSaveMsg((prev) => ({ ...prev, [athleteId]: "Tersimpan" }));
      fetchAssessments();
      setTimeout(() => setSaveMsg((prev) => ({ ...prev, [athleteId]: "" })), 2000);
    } else {
      setSaveMsg((prev) => ({ ...prev, [athleteId]: json.error?.message || "Gagal" }));
    }

    setSavingAthlete(null);
  };

  if (loading) {
    return <div className="space-y-6"><p className="text-muted-foreground">Memuat data sesi...</p></div>;
  }

  if (!session) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Sesi latihan tidak ditemukan.</p>
        <Link href="/athletics"><Button variant="outline">Kembali</Button></Link>
      </div>
    );
  }

  const attendants = session.training_session_attendants || [];
  const category = session.trainings?.category;
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
              {category && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {CATEGORY_LABELS[category] || category}
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
                <img src={qrScanUrl} alt="QR Code Absensi" width={250} height={250} className="border rounded-lg" />
                <p className="text-sm text-muted-foreground text-center break-all">URL: {qrUrl}</p>
                <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(qrUrl)}>
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
        <CardHeader>
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
                    <TableCell className="font-medium">{a.profiles?.full_name || a.athlete_id}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{a.profiles?.nim || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={a.method === "QR" ? "default" : "secondary"}>{a.method}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.scanned_at ? new Date(a.scanned_at).toLocaleString("id-ID") : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Assessment Section — only for PELATIH / ADMIN */}
      {canAssess && category && attendants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Penilaian Anggota</CardTitle>
            <p className="text-sm text-muted-foreground">
              Score 1-10 per anggota untuk kategori <strong>{CATEGORY_LABELS[category] || category}</strong>.
              Rata-rata akan muncul di Matrik Performa.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>NIM</TableHead>
                  <TableHead className="w-32">Score (1-10)</TableHead>
                  <TableHead className="w-32">Aksi</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessmentsLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Memuat data...</TableCell>
                  </TableRow>
                ) : (
                  attendants.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.profiles?.full_name || a.athlete_id}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{a.profiles?.nim || "-"}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          step="0.5"
                          placeholder="1-10"
                          value={scoreInputs[a.athlete_id] || ""}
                          onChange={(e) =>
                            setScoreInputs((prev) => ({ ...prev, [a.athlete_id]: e.target.value }))
                          }
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          disabled={savingAthlete === a.athlete_id || !scoreInputs[a.athlete_id]}
                          onClick={() => handleSaveScore(a.athlete_id)}
                        >
                          {savingAthlete === a.athlete_id ? "..." : "Simpan"}
                        </Button>
                      </TableCell>
                      <TableCell>
                        {saveMsg[a.athlete_id] && (
                          <span className={`text-sm ${saveMsg[a.athlete_id] === "Tersimpan" ? "text-green-600" : "text-red-500"}`}>
                            {saveMsg[a.athlete_id]}
                          </span>
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

      {/* Show message if no category */}
      {canAssess && !category && attendants.length > 0 && (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            Sesi ini belum memiliki kategori latihan. Ubah jenis latihan ke data Latihan yang memiliki kategori untuk mengisi penilaian.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
