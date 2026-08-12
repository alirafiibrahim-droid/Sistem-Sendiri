"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { QrCodeModal } from "@/components/ui/qr-code-modal";
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
    day: "2-digit", month: "2-digit", year: "numeric",
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
  const trainings = useMemo(() => session?.trainings || [], [session?.trainings]);

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
    if (json.success) setAssessments(json.data);
    setAssessmentsLoading(false);
  }, [id]);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  // Pre-fill score inputs from existing assessments (per training/category)
  useEffect(() => {
    const inputs: Record<string, string> = {};
    for (const a of assessments) {
      const cat = a.athletic_metrics?.category;
      if (!cat) continue;
      for (const t of trainings) {
        if (t.category === cat) {
          inputs[`${t.id}_${a.athlete_id}`] = String(a.value);
        }
      }
    }
    setScoreInputs(inputs);
  }, [assessments, trainings]);

  // Fetch QR URL
  useEffect(() => {
    if (!showQr || !id) return;
    fetch(`/api/training-sessions/${id}/qr`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setQrUrl(j.data.scan_url); });
  }, [showQr, id]);

  // Submit assessment (per training/variable)
  const handleSaveScore = async (athleteId: string) => {
    const entries = trainings
      .map((t) => ({
        training_id: t.id,
        value: scoreInputs[`${t.id}_${athleteId}`],
      }))
      .filter((e) => e.value && e.value.trim() !== "");

    if (entries.length === 0) return;

    for (const e of entries) {
      const numVal = Number(e.value);
      if (isNaN(numVal) || numVal < 1 || numVal > 10) {
        setSaveMsg((prev) => ({ ...prev, [athleteId]: "Score harus 1-10" }));
        return;
      }
    }

    setSavingAthlete(athleteId);
    setSaveMsg((prev) => ({ ...prev, [athleteId]: "" }));

    let ok = true;
    for (const e of entries) {
      const res = await fetch(`/api/training-sessions/${id}/assessments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athlete_id: athleteId,
          training_id: e.training_id,
          value: Number(e.value),
        }),
      });

      const json = await res.json();
      if (!json.success) {
        ok = false;
        setSaveMsg((prev) => ({ ...prev, [athleteId]: json.error?.message || "Gagal" }));
        break;
      }
    }

    if (ok) {
      setSaveMsg((prev) => ({ ...prev, [athleteId]: "Tersimpan" }));
      fetchAssessments();
      setTimeout(() => setSaveMsg((prev) => ({ ...prev, [athleteId]: "" })), 2000);
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
          <Button variant="outline" onClick={() => setShowQr(true)}>
            Tampilkan QR Code
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
            <p className="text-xs text-muted-foreground">Nama Sesi</p>
            <p className="font-semibold">{session.name || session.session_type || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pelatih</p>
            <p className="font-semibold">{session.profiles?.full_name || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Durasi / Intensitas</p>
            <div className="font-semibold">
              {session.duration_minutes} menit
              {session.intensity && (
                <Badge variant={intensityVariant[session.intensity] || "secondary"} className="ml-2 text-xs">
                  {session.intensity}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
        {trainings.length > 0 && (
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground mb-2">Latihan dalam sesi ini</p>
            <div className="flex flex-wrap gap-2">
              {trainings.map((t) => (
                <Badge key={t.id} variant="outline">
                  {t.name}
                  {t.category && (
                    <span className="ml-2 text-[10px] text-muted-foreground">
                      {CATEGORY_LABELS[t.category] || t.category}
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* QR Code Modal */}
      <QrCodeModal
        open={showQr}
        label="Sesi Latihan"
        title="QR Code Absensi"
        dateText={formatDate(session.date)}
        url={qrUrl}
        loading={!qrUrl}
        onClose={() => { setShowQr(false); setQrUrl(""); }}
      />

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
                      {a.scanned_at ? new Date(a.scanned_at).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Assessment Section — only for PELATIH / ADMIN */}
      {canAssess && trainings.length > 0 && attendants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Penilaian Anggota</CardTitle>
            <p className="text-sm text-muted-foreground">
              Berikan score 1-10 per atlet untuk setiap variabel latihan dalam sesi ini.
              Hasilnya akan diperbarui di Matrik Performa.
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>NIM</TableHead>
                  {trainings.map((t) => (
                    <TableHead key={t.id} className="text-center">
                      <span className="font-medium">{t.name}</span>
                      {t.category && (
                        <span className="block text-[10px] text-muted-foreground">
                          {CATEGORY_LABELS[t.category] || t.category}
                        </span>
                      )}
                    </TableHead>
                  ))}
                  <TableHead className="w-32">Aksi</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessmentsLoading ? (
                  <TableRow>
                    <TableCell colSpan={trainings.length + 4} className="text-center py-6 text-muted-foreground">Memuat data...</TableCell>
                  </TableRow>
                ) : (
                  attendants.map((a) => {
                    const hasScore = trainings.some((t) =>
                      scoreInputs[`${t.id}_${a.athlete_id}`]
                    );
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.profiles?.full_name || a.athlete_id}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{a.profiles?.nim || "-"}</TableCell>
                        {trainings.map((t) => (
                          <TableCell key={t.id}>
                            <Input
                              type="number"
                              min="1"
                              max="10"
                              step="0.5"
                              placeholder="1-10"
                              value={scoreInputs[`${t.id}_${a.athlete_id}`] || ""}
                              onChange={(e) =>
                                setScoreInputs((prev) => ({
                                  ...prev,
                                  [`${t.id}_${a.athlete_id}`]: e.target.value,
                                }))
                              }
                              className="w-20 mx-auto text-center"
                            />
                          </TableCell>
                        ))}
                        <TableCell>
                          <Button
                            size="sm"
                            disabled={savingAthlete === a.athlete_id || !hasScore}
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
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Show message if no training */}
      {canAssess && trainings.length === 0 && attendants.length > 0 && (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            Sesi ini belum memiliki latihan. Tambahkan latihan untuk mengisi penilaian variabel.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
