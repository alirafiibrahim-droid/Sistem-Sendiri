"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import SpiderChart from "@/components/charts/spider-chart";
import LineChart, { type LineChartSeries } from "@/components/charts/line-chart";
import { trainingSessionSchema, trainingFormSchema } from "@/lib/validations/training";
import type { TrainingSessionWithCoach, Training, Profile } from "@/lib/types/database";
import type { ApiMeta } from "@/lib/types/api";
import Link from "next/link";

type FormErrors = Record<string, string>;
type TabId = "matrix" | "sessions" | "trainings";

interface HandoverOption {
  id: string;
  period_from: string;
  period_to: string;
  status: string;
}

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

const intensityVariant: Record<string, "destructive" | "warning" | "secondary"> = {
  HIGH: "destructive",
  MEDIUM: "warning",
  LOW: "secondary",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Menghitung jam selesai dari jam mulai + durasi (menit). Format HH:MM.
function addMinutes(time: string, minutes: number): string {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return time;
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nh = ((Math.floor(total / 60) % 24) + 24) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

// Menampilkan rentang jam "HH:MM - HH:MM" atau "-"
function timeRange(start: string | null, duration: number | null): string {
  if (!start) return "-";
  const end = addMinutes(start, duration || 0);
  return `${start} - ${end}`;
}

const supabase = createSupabaseClient();

export default function AthleticsPage() {
  const [tab, setTab] = useState<TabId>("sessions");

  // ─── Sessions state ───
  const [sessions, setSessions] = useState<TrainingSessionWithCoach[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [page, setPage] = useState(1);
  const limit = 15;

  // ─── Session modal ───
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formDates, setFormDates] = useState<string[]>([new Date().toISOString().split("T")[0]]);
  const [formSessionName, setFormSessionName] = useState("");
  const [formTrainingIds, setFormTrainingIds] = useState<string[]>([]);
  const [trainingDropdownOpen, setTrainingDropdownOpen] = useState(false);
  const trainingDropdownRef = useRef<HTMLDivElement>(null);
  const [formDuration, setFormDuration] = useState("");
  const [formIntensity, setFormIntensity] = useState("MEDIUM");
  const [formStartTime, setFormStartTime] = useState("");
  const [trainingsList, setTrainingsList] = useState<Training[]>([]);

  // ─── Periode Berjalan (Sertijab) ───
  const [activePeriods, setActivePeriods] = useState<HandoverOption[]>([]);
  const [formHandoverId, setFormHandoverId] = useState("");

  // Default ke periode berjalan yang aktif
  useEffect(() => {
    fetch("/api/handovers/active")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setActivePeriods(json.data);
          if (json.data.length > 0) setFormHandoverId(json.data[0].id);
        }
      });
  }, []);

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
  const [progressSeries, setProgressSeries] = useState<LineChartSeries[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [selectedProgressCategories, setSelectedProgressCategories] = useState<string[]>([]);

  // ─── Fetch sessions ───
  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (filterStartDate) params.set("start_date", filterStartDate);
    if (filterEndDate) params.set("end_date", filterEndDate);

    const res = await fetch(`/api/training-sessions?${params}`);
    const json = await res.json();

    if (json.success) {
      setSessions(json.data);
      setMeta(json.meta);
    }
    setLoading(false);
  }, [page, search, filterStartDate, filterEndDate]);

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
    if (tab !== "matrix") return;
    const id = setInterval(fetchScores, 15000);
    return () => clearInterval(id);
  }, [fetchScores, tab]);

  // ─── Fetch athlete progress (line chart) ───
  const fetchProgress = useCallback(async () => {
    if (!selectedAthlete) {
      setProgressSeries([]);
      setSelectedProgressCategories([]);
      return;
    }
    setProgressLoading(true);
    const res = await fetch(`/api/athlete-progress?athlete_id=${selectedAthlete}`);
    const j = await res.json();
    if (j.success) {
      setProgressSeries(j.data);
      setSelectedProgressCategories((prev) => {
        const available = (j.data as LineChartSeries[]).map((s) => s.category);
        if (prev.length === 0) return available;
        return prev.filter((c) => available.includes(c));
      });
    }
    setProgressLoading(false);
  }, [selectedAthlete]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const toggleProgressCategory = (category: string) => {
    setSelectedProgressCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const filteredProgressSeries = progressSeries.filter((s) =>
    selectedProgressCategories.includes(s.category)
  );

  // ─── Session form ───
  const resetSessionForm = () => {
    setFormDates([new Date().toISOString().split("T")[0]]);
    setFormSessionName("");
    setFormTrainingIds([]);
    setFormDuration("");
    setFormIntensity("MEDIUM");
    setFormStartTime("");
    if (activePeriods.length > 0) setFormHandoverId(activePeriods[0].id);
    else setFormHandoverId("");
    setErrors({});
  };

  const toggleFormTraining = (id: string) => {
    setFormTrainingIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Close training dropdown on outside click
  useEffect(() => {
    if (!trainingDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (trainingDropdownRef.current && !trainingDropdownRef.current.contains(e.target as Node)) {
        setTrainingDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [trainingDropdownOpen]);

  const handleSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = trainingSessionSchema.safeParse({
      name: formSessionName,
      dates: formDates,
      training_ids: formTrainingIds,
      start_time: formStartTime,
      duration_minutes: formDuration,
      intensity: formIntensity,
      handover_id: formHandoverId,
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
        name: formSessionName,
        dates: formDates,
        training_ids: formTrainingIds,
        start_time: formStartTime,
        handover_id: formHandoverId,
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
                                    {(() => {
                                      const val = scoreMode === "average" ? s.avg_score : s.latest_score;
                                      const color = val >= 7 ? "#16a34a" : val >= 4 ? "#fa8603" : "#dc2626";
                                      return (
                                        <span
                                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                                          style={{ backgroundColor: color + "20", color, fontWeight: 600 }}
                                        >
                                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                                          {val}
                                        </span>
                                      );
                                    })()}
                                  </TableCell>
                                  <TableCell className="text-right">{s.assessment_count}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          <div className="flex justify-center gap-4 text-xs text-muted-foreground mt-4">
                            <span className="flex items-center gap-1">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#dc2626" }} /> 0-3.9
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#fa8603" }} /> 4-6.9
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#16a34a" }} /> 7-10
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

          {selectedAthlete && (
            <Card>
              <CardHeader>
                <CardTitle>Progres Nilai Performa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {progressSeries.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {progressSeries.map((s) => {
                        const active = selectedProgressCategories.includes(s.category);
                        return (
                          <button
                            key={s.category}
                            type="button"
                            onClick={() => toggleProgressCategory(s.category)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                              active
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-muted/70"
                            }`}
                          >
                            {CATEGORY_LABELS[s.category] || s.category}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Klik variabel matrik untuk menampilkan atau menyembunyikannya pada grafik.
                    </p>
                    {progressLoading ? (
                      <p className="text-center text-muted-foreground py-8">Memuat data...</p>
                    ) : filteredProgressSeries.length > 0 ? (
                      <LineChart series={filteredProgressSeries} maxScore={10} />
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        Tidak ada kategori yang dipilih. Pilih minimal satu variabel di atas.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Belum ada riwayat penilaian untuk atlet ini.
                  </p>
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
              placeholder="Cari nama sesi latihan..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="max-w-sm"
            />
            <DateRangeFilter
              startDate={filterStartDate}
              endDate={filterEndDate}
              onStartDateChange={(v) => {
                setFilterStartDate(v);
                setPage(1);
              }}
              onEndDateChange={(v) => {
                setFilterEndDate(v);
                setPage(1);
              }}
            />
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Kode Unit</TableHead>
                    <TableHead>Jenis Latihan</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead>Jam</TableHead>
                    <TableHead>Durasi</TableHead>
                    <TableHead>Intensitas</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Memuat data...
                      </TableCell>
                    </TableRow>
                  ) : sessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Belum ada sesi latihan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sessions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm">{formatDate(s.date)}</TableCell>
                        <TableCell>
                          <code className="rounded bg-muted px-2 py-1 font-mono text-xs font-semibold tracking-widest text-primary">
                            {s.session_code || "-"}
                          </code>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{s.name || s.session_type || "-"}</p>
                          {(s.trainings || []).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(s.trainings || []).map((t) => (
                                <Badge key={t.id} variant="outline" className="text-[10px]">
                                  {t.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {s.handovers ? (
                            <span className="text-sm">
                              Periode {s.handovers.period_to}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{timeRange(s.start_time, s.duration_minutes)}</TableCell>
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
          <div className="relative bg-card text-foreground rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
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
                {/* Nama Sesi Latihan */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nama Sesi Latihan <span className="text-red-500">*</span></label>
                  <Input
                    placeholder="Contoh: Latihan Pagi Fisik Dasar"
                    value={formSessionName}
                    onChange={(e) => setFormSessionName(e.target.value)}
                  />
                  {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                </div>

                {/* Latihan (multiple) */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Latihan <span className="text-red-500">*</span>
                    <span className="text-muted-foreground text-xs font-normal ml-1">
                      (boleh pilih lebih dari satu)
                    </span>
                  </label>
                  <div className="relative" ref={trainingDropdownRef}>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between font-normal"
                      onClick={() => setTrainingDropdownOpen((o) => !o)}
                    >
                      <span className="truncate">
                        {formTrainingIds.length === 0
                          ? "Pilih latihan..."
                          : formTrainingIds.length === 1
                            ? `1 latihan dipilih`
                            : `${formTrainingIds.length} latihan dipilih`}
                      </span>
                      <svg
                        className={`h-4 w-4 opacity-50 transition-transform ${trainingDropdownOpen ? "rotate-180" : ""}`}
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </Button>

                    {trainingDropdownOpen && (
                      <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-md border bg-background shadow-md">
                        {trainingsList.length === 0 ? (
                          <p className="px-3 py-4 text-sm text-muted-foreground">
                            Belum ada data latihan. Tambahkan latihan terlebih dahulu di tab Latihan.
                          </p>
                        ) : (
                          <div className="p-1">
                            {trainingsList.map((t) => {
                              const active = formTrainingIds.includes(t.id);
                              return (
                                <label
                                  key={t.id}
                                  className={`flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm hover:bg-muted ${
                                    active ? "bg-muted/60" : ""
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={active}
                                    onChange={() => toggleFormTraining(t.id)}
                                    className="h-4 w-4 accent-primary"
                                  />
                                  <span className="flex-1">{t.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {CATEGORY_LABELS[t.category] || t.category}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {formTrainingIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {trainingsList
                        .filter((t) => formTrainingIds.includes(t.id))
                        .map((t) => (
                          <Badge
                            key={t.id}
                            variant="secondary"
                            className="cursor-pointer gap-1"
                            onClick={() => toggleFormTraining(t.id)}
                          >
                            {t.name}
                            <span aria-hidden className="text-muted-foreground">&times;</span>
                          </Badge>
                        ))}
                    </div>
                  )}
                  {errors.training_ids && <p className="text-sm text-red-500">{errors.training_ids}</p>}
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

                {/* Periode Berjalan (Sertijab) */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Periode Berjalan</label>
                  <Select value={formHandoverId} onChange={(e) => setFormHandoverId(e.target.value)}>
                    <option value="">Tanpa periode</option>
                    {activePeriods.map((p) => (
                      <option key={p.id} value={p.id}>
                        Periode {p.period_from} – {p.period_to}
                      </option>
                    ))}
                  </Select>
                  {activePeriods.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Belum ada periode Sertijab yang berjalan.
                    </p>
                  )}
                  {errors.handover_id && <p className="text-sm text-red-500">{errors.handover_id}</p>}
                </div>

                {/* Jam Mulai */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Jam Mulai <span className="text-red-500">*</span></label>
                  <Input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                  />
                  {errors.start_time && <p className="text-sm text-red-500">{errors.start_time}</p>}
                  {formStartTime && formDuration && (
                    <p className="text-xs text-muted-foreground">
                      Jam selesai: {addMinutes(formStartTime, Number(formDuration) || 0)}
                    </p>
                  )}
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
          <div className="relative bg-card text-foreground rounded-2xl shadow-xl w-full max-w-md mx-4">
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
