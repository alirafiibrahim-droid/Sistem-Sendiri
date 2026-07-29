"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import SpiderChart from "@/components/charts/spider-chart";
import { trainingSessionSchema, trainingFormSchema } from "@/lib/validations/training";
import type { TrainingSessionWithCoach, Training, Profile } from "@/lib/types/database";
import type { ApiMeta } from "@/lib/types/api";
import Link from "next/link";

type FormErrors = Record<string, string>;
type TabId = "matrix" | "sessions" | "trainings";

const CATEGORY_LABELS: Record<string, string> = {
  STRENGTH: "Strength",
  POWER: "Power",
  SPEED: "Speed",
  AGILITY: "Agility",
  ENDURANCE: "Endurance",
  FLEXIBILITY: "Flexibility",
  TEKNIK: "Teknik",
  MENTAL: "Mental",
  GAME_INTELLIGENCE: "Game Intelligence",
};

function getScoreColor(score: number): string {
  if (score >= 7) return "bg-green-500";
  if (score >= 4) return "bg-yellow-500";
  return "bg-red-500";
}

function getScoreBg(score: number): string {
  if (score >= 7) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
  if (score >= 4) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
  return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
}

const intensityVariant: Record<string, "destructive" | "warning" | "secondary"> = {
  HIGH: "destructive",
  MEDIUM: "warning",
  LOW: "secondary",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const supabase = createSupabaseClient();

export default function AthleticsPage() {
  const [tab, setTab] = useState<TabId>("sessions");

  // ─── Sessions state ───
  const [sessions, setSessions] = useState<TrainingSessionWithCoach[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 15;

  // ─── Session modal ───
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formDates, setFormDates] = useState<string[]>([new Date().toISOString().split("T")[0]]);
  const [formTrainingId, setFormTrainingId] = useState("");
  const [formDuration, setFormDuration] = useState("");
  const [formIntensity, setFormIntensity] = useState("MEDIUM");
  const [trainingsList, setTrainingsList] = useState<Training[]>([]);

  // ─── Trainings tab state ───
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [trainingsLoading, setTrainingsLoading] = useState(true);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [trainingFormLoading, setTrainingFormLoading] = useState(false);
  const [trainingErrors, setTrainingErrors] = useState<FormErrors>({});
  const [trainingName, setTrainingName] = useState("");
  const [trainingCategory, setTrainingCategory] = useState("");
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);

  // ─── Matrix state ───
  const [athletes, setAthletes] = useState<Pick<Profile, "id" | "full_name" | "nim">[]>([]);
  const [selectedAthlete, setSelectedAthlete] = useState("");
  const [athleteScores, setAthleteScores] = useState<Array<{ category: string; avg_score: number; latest_score: number; assessment_count: number }>>([]);
  const [scoresLoading, setScoresLoading] = useState(false);
  const [scoreMode, setScoreMode] = useState<"average" | "latest">("average");

  // ─── Fetch sessions ───
  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);

    const res = await fetch(`/api/training-sessions?${params}`);
    const json = await res.json();

    if (json.success) {
      setSessions(json.data);
      setMeta(json.meta);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    if (tab === "sessions") fetchSessions();
  }, [fetchSessions, tab]);

  // ─── Fetch trainings for dropdown ───
  useEffect(() => {
    fetch("/api/trainings")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setTrainingsList(j.data);
          setTrainings(j.data);
        }
        setTrainingsLoading(false);
      });
  }, [showSessionModal, showTrainingModal]);

  // ─── Fetch athletes for matrix ───
  useEffect(() => {
    if (tab !== "matrix") return;
    supabase
      .from("profiles")
      .select("id, full_name, nim")
      .not("role", "in", "(PELATIH,PEMBINA)")
      .order("full_name")
      .then(({ data }) => {
        if (data) setAthletes(data);
      });
  }, [tab]);

  // ─── Fetch athlete scores ───
  const fetchScores = useCallback(async () => {
    if (!selectedAthlete) {
      setAthleteScores([]);
      return;
    }
    setScoresLoading(true);
    const res = await fetch(`/api/athlete-scores?athlete_id=${selectedAthlete}&mode=${scoreMode}`);
    const j = await res.json();
    if (j.success) setAthleteScores(j.data);
    setScoresLoading(false);
  }, [selectedAthlete, scoreMode]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores, tab]);

  // ─── Session form ───
  const resetSessionForm = () => {
    setFormDates([new Date().toISOString().split("T")[0]]);
    setFormTrainingId("");
    setFormDuration("");
    setFormIntensity("MEDIUM");
    setErrors({});
  };

  const handleSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = trainingSessionSchema.safeParse({
      dates: formDates,
      training_id: formTrainingId || undefined,
      session_type: trainingsList.find((t) => t.id === formTrainingId)?.name || "",
      duration_minutes: formDuration,
      intensity: formIntensity,
    });

    if (!result.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setFormLoading(true);

    const res = await fetch("/api/training-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dates: formDates,
        training_id: formTrainingId || undefined,
        session_type: trainingsList.find((t) => t.id === formTrainingId)?.name || undefined,
        duration_minutes: Number(formDuration),
        intensity: formIntensity,
      }),
    });

    const json = await res.json();

    if (!json.success) {
      setErrors({ _form: json.error?.message || "Gagal menyimpan sesi latihan." });
      setFormLoading(false);
      return;
    }

    setShowSessionModal(false);
    setFormLoading(false);
    fetchSessions();
  };

  // ─── Training form ───
  const resetTrainingForm = () => {
    setTrainingName("");
    setTrainingCategory("");
    setEditingTraining(null);
    setTrainingErrors({});
  };

  const handleTrainingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = trainingFormSchema.safeParse({
      name: trainingName,
      category: trainingCategory,
    });

    if (!parsed.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setTrainingErrors(fieldErrors);
      return;
    }

    setTrainingErrors({});
    setTrainingFormLoading(true);

    const url = editingTraining ? `/api/trainings/${editingTraining.id}` : "/api/trainings";
    const method = editingTraining ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });

    const json = await res.json();

    if (!json.success) {
      setTrainingErrors({ _form: json.error?.message || "Gagal menyimpan latihan." });
      setTrainingFormLoading(false);
      return;
    }

    setShowTrainingModal(false);
    setTrainingFormLoading(false);
    // Refresh trainings list
    const listRes = await fetch("/api/trainings");
    const listJson = await listRes.json();
    if (listJson.success) {
      setTrainings(listJson.data);
      setTrainingsList(listJson.data);
    }
  };

  const handleDeleteTraining = async (id: string) => {
    if (!confirm("Hapus latihan ini?")) return;
    const res = await fetch(`/api/trainings/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      setTrainings((prev) => prev.filter((t) => t.id !== id));
      setTrainingsList((prev) => prev.filter((t) => t.id !== id));
    }
  };

  const totalPages = meta.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Keatletan</h2>
          <p className="text-muted-foreground">Monitoring performa dan sesi latihan atlet</p>
        </div>
        {tab === "sessions" && (
          <Button
            onClick={() => {
              resetSessionForm();
              setShowSessionModal(true);
            }}
          >
            + Sesi Latihan Baru
          </Button>
        )}
        {tab === "trainings" && (
          <Button
            onClick={() => {
              resetTrainingForm();
              setShowTrainingModal(true);
            }}
          >
            + Latihan Baru
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button variant={tab === "matrix" ? "default" : "outline"} onClick={() => setTab("matrix")}>
          Matrik Performa
        </Button>
        <Button variant={tab === "sessions" ? "default" : "outline"} onClick={() => setTab("sessions")}>
          Sesi Latihan
        </Button>
        <Button variant={tab === "trainings" ? "default" : "outline"} onClick={() => setTab("trainings")}>
          Latihan
        </Button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          TAB: Matrik Performa (Spider Chart)
          ═══════════════════════════════════════════════════════════════ */}
      {tab === "matrix" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pilih Atlet</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedAthlete}
                onChange={(e) => setSelectedAthlete(e.target.value)}
              >
                <option value="">— Pilih Atlet —</option>
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name} {a.nim ? `(${a.nim})` : ""}
                  </option>
                ))}
              </Select>
            </CardContent>
          </Card>

          {selectedAthlete && (
            <Card>
              <CardHeader>
                <CardTitle>Statistik Kategori Latihan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant={scoreMode === "average" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setScoreMode("average")}
                  >
                    Rata-rata
                  </Button>
                  <Button
                    variant={scoreMode === "latest" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setScoreMode("latest")}
                  >
                    Riwayat Terakhir
                  </Button>
                </div>
                {scoresLoading ? (
                  <p className="text-center text-muted-foreground py-8">Memuat data...</p>
                ) : athleteScores.filter((s) => s.assessment_count > 0).length > 0 ? (
                  (() => {
                    const totalAssess = athleteScores.reduce((s, c) => s + c.assessment_count, 0);
                    const overallAvg = athleteScores.reduce((s, c) => s + (scoreMode === "average" ? c.avg_score : c.latest_score), 0) / athleteScores.length;
                    const scoreLabel = scoreMode === "average" ? "Skor Rata-rata" : "Skor Terakhir";
                    return (
                      <div className="flex flex-col items-center gap-6">
                        <SpiderChart
                          data={athleteScores.map((s) => ({
                            category: s.category,
                            value: scoreMode === "average" ? s.avg_score : s.latest_score,
                          }))}
                          size={350}
                        />
                        <div className="flex gap-6 text-sm">
                          <div className="text-center">
                            <p className="text-2xl font-bold">{totalAssess}</p>
                            <p className="text-muted-foreground">Total Penilaian</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold">{overallAvg.toFixed(1)}</p>
                            <p className="text-muted-foreground">
                              {scoreMode === "average" ? "Rata-rata Keseluruhan" : "Rata-rata Terakhir"}
                            </p>
                          </div>
                        </div>
                        <div className="w-full max-w-lg">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Kategori</TableHead>
                                <TableHead className="text-right">{scoreLabel}</TableHead>
                                <TableHead className="text-right">Jumlah Penilaian</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {athleteScores.map((s) => (
                                <TableRow key={s.category}>
                                  <TableCell className="font-medium">
                                    {CATEGORY_LABELS[s.category] || s.category}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${getScoreBg(scoreMode === "average" ? s.avg_score : s.latest_score)}`}>
                                      <span className={`w-2 h-2 rounded-full ${getScoreColor(scoreMode === "average" ? s.avg_score : s.latest_score)}`} />
                                      {scoreMode === "average" ? s.avg_score : s.latest_score}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">{s.assessment_count}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          <div className="flex justify-center gap-4 text-xs text-muted-foreground mt-4">
                            <span className="flex items-center gap-1">
                              <span className="w-3 h-3 rounded-full bg-red-500" /> 0-3.9
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-3 h-3 rounded-full bg-yellow-500" /> 4-6.9
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-3 h-3 rounded-full bg-green-500" /> 7-10
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-center text-muted-foreground py-8">Belum ada data penilaian untuk atlet ini. Berikan penilaian melalui Detail Sesi Latihan.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB: Sesi Latihan
          ═══════════════════════════════════════════════════════════════ */}
      {tab === "sessions" && (
        <>
          <div className="flex gap-3">
            <Input
              placeholder="Cari sesi latihan..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="max-w-sm"
            />
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Jenis Latihan</TableHead>
                    <TableHead>Durasi</TableHead>
                    <TableHead>Intensitas</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Memuat data...
                      </TableCell>
                    </TableRow>
                  ) : sessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Belum ada sesi latihan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sessions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm">{formatDate(s.date)}</TableCell>
                        <TableCell className="font-medium">{s.session_type || s.trainings?.name || "-"}</TableCell>
                        <TableCell>{s.duration_minutes} menit</TableCell>
                        <TableCell>
                          <Badge variant={intensityVariant[s.intensity || ""] || "secondary"}>
                            {s.intensity || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Link href={`/athletics/${s.id}`}>
                            <Button variant="outline" size="sm">Detail</Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>

            {meta.total !== undefined && meta.total > limit && (
              <div className="p-4 border-t border-border flex items-center justify-between bg-muted/50">
                <p className="text-xs text-muted-foreground">
                  Menampilkan {(page - 1) * limit + 1} - {Math.min(page * limit, meta.total)} dari {meta.total} sesi
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Prev
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB: Latihan (Master Data)
          ═══════════════════════════════════════════════════════════════ */}
      {tab === "trainings" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Latihan</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trainingsLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      Memuat data...
                    </TableCell>
                  </TableRow>
                ) : trainings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      Belum ada data latihan.
                    </TableCell>
                  </TableRow>
                ) : (
                  trainings.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{CATEGORY_LABELS[t.category] || t.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingTraining(t);
                            setTrainingName(t.name);
                            setTrainingCategory(t.category);
                            setShowTrainingModal(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteTraining(t.id)}
                        >
                          Hapus
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODAL: Sesi Latihan Baru
          ═══════════════════════════════════════════════════════════════ */}
      {showSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSessionModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold">Sesi Latihan Baru</h3>
                  <p className="text-sm text-muted-foreground">Catat sesi latihan atlet</p>
                </div>
                <button onClick={() => setShowSessionModal(false)} className="p-1 hover:bg-muted rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSessionSubmit} className="space-y-4">
                {/* Jenis Latihan (from trainings) */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Jenis Latihan <span className="text-red-500">*</span></label>
                  <Select value={formTrainingId} onChange={(e) => setFormTrainingId(e.target.value)}>
                    <option value="">— Pilih Latihan —</option>
                    {trainingsList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({CATEGORY_LABELS[t.category] || t.category})
                      </option>
                    ))}
                  </Select>
                  {errors.training_id && <p className="text-sm text-red-500">{errors.training_id}</p>}
                </div>

                {/* Multiple Dates */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tanggal Latihan <span className="text-red-500">*</span></label>
                  <div className="space-y-2">
                    {formDates.map((d, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          type="date"
                          value={d}
                          onChange={(e) => {
                            const newDates = [...formDates];
                            newDates[i] = e.target.value;
                            setFormDates(newDates);
                          }}
                          className="flex-1"
                        />
                        {formDates.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setFormDates(formDates.filter((_, idx) => idx !== i))}
                          >
                            Hapus
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormDates([...formDates, new Date().toISOString().split("T")[0]])}
                  >
                    + Tambah Tanggal
                  </Button>
                  {errors.dates && <p className="text-sm text-red-500">{errors.dates}</p>}
                </div>

                {/* Durasi & Intensitas */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Durasi (menit) <span className="text-red-500">*</span></label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="60"
                      value={formDuration}
                      onChange={(e) => setFormDuration(e.target.value)}
                    />
                    {errors.duration_minutes && <p className="text-sm text-red-500">{errors.duration_minutes}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Intensitas <span className="text-red-500">*</span></label>
                    <Select value={formIntensity} onChange={(e) => setFormIntensity(e.target.value)}>
                      <option value="LOW">Rendah</option>
                      <option value="MEDIUM">Sedang</option>
                      <option value="HIGH">Tinggi</option>
                    </Select>
                    {errors.intensity && <p className="text-sm text-red-500">{errors.intensity}</p>}
                  </div>
                </div>

                {errors._form && <p className="text-sm text-red-500 text-center">{errors._form}</p>}

                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={formLoading} className="flex-1">
                    {formLoading ? "Menyimpan..." : "Simpan Sesi Latihan"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowSessionModal(false)}>
                    Batal
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODAL: Latihan Baru / Edit
          ═══════════════════════════════════════════════════════════════ */}
      {showTrainingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowTrainingModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold">{editingTraining ? "Edit Latihan" : "Latihan Baru"}</h3>
                  <p className="text-sm text-muted-foreground">
                    {editingTraining ? "Ubah data latihan" : "Tambah data latihan baru"}
                  </p>
                </div>
                <button onClick={() => setShowTrainingModal(false)} className="p-1 hover:bg-muted rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleTrainingSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nama Latihan <span className="text-red-500">*</span></label>
                  <Input
                    placeholder="Contoh: Sprint 100m"
                    value={trainingName}
                    onChange={(e) => setTrainingName(e.target.value)}
                  />
                  {trainingErrors.name && <p className="text-sm text-red-500">{trainingErrors.name}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Kategori <span className="text-red-500">*</span></label>
                  <Select value={trainingCategory} onChange={(e) => setTrainingCategory(e.target.value)}>
                    <option value="">— Pilih Kategori —</option>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </Select>
                  {trainingErrors.category && <p className="text-sm text-red-500">{trainingErrors.category}</p>}
                </div>

                {trainingErrors._form && <p className="text-sm text-red-500 text-center">{trainingErrors._form}</p>}

                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={trainingFormLoading} className="flex-1">
                    {trainingFormLoading ? "Menyimpan..." : editingTraining ? "Simpan Perubahan" : "Simpan Latihan"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowTrainingModal(false)}>
                    Batal
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
