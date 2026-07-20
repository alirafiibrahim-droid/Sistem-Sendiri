"use client";

import { useState, useEffect, useCallback } from "react";
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
import { trainingSessionSchema } from "@/lib/validations/training";
import type { TrainingSessionWithCoach } from "@/lib/types/database";
import type { ApiMeta } from "@/lib/types/api";

type FormErrors = Record<string, string>;

const intensityVariant: Record<string, "destructive" | "warning" | "secondary"> = {
  HIGH: "destructive",
  MEDIUM: "warning",
  LOW: "secondary",
};

const metrics = [
  { id: "1", name: "Kecepatan 100m", type: "QUANTITATIVE", unit: "s", latest: 12.5, target: 12.0 },
  { id: "2", name: "Bench Press", type: "QUANTITATIVE", unit: "kg", latest: 60, target: 70 },
  { id: "3", name: "Teknik Dasar", type: "QUALITATIVE", unit: "skala 1-5", latest: 4, target: 5 },
  { id: "4", name: "Lari 5km", type: "QUANTITATIVE", unit: "menit", latest: 25, target: 22 },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AthleticsPage() {
  const [tab, setTab] = useState<"metrics" | "sessions">("sessions");

  // Sessions state
  const [sessions, setSessions] = useState<TrainingSessionWithCoach[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 15;

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Form state
  const [formDate, setFormDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [formType, setFormType] = useState("");
  const [formDuration, setFormDuration] = useState("");
  const [formIntensity, setFormIntensity] = useState("MEDIUM");

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
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

  const resetForm = () => {
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormType("");
    setFormDuration("");
    setFormIntensity("MEDIUM");
    setErrors({});
  };

  const openModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = trainingSessionSchema.safeParse({
      date: formDate,
      session_type: formType,
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
        date: formDate,
        session_type: formType,
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

    setShowModal(false);
    setFormLoading(false);
    if (tab === "sessions") fetchSessions();
  };

  const totalPages = meta.totalPages || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Keatletan</h2>
          <p className="text-muted-foreground">Monitoring performa dan sesi latihan atlet</p>
        </div>
        <Button onClick={openModal}>+ Sesi Latihan Baru</Button>
      </div>

      {/* Tabs */}
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
        <>
          {/* Search */}
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
                    <TableHead>Jenis Sesi</TableHead>
                    <TableHead>Pelatih</TableHead>
                    <TableHead>Durasi</TableHead>
                    <TableHead>Intensitas</TableHead>
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
                        <TableCell className="font-medium">{s.session_type}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {s.profiles?.full_name || "-"}
                        </TableCell>
                        <TableCell>{s.duration_minutes} menit</TableCell>
                        <TableCell>
                          <Badge variant={intensityVariant[s.intensity || ""] || "secondary"}>
                            {s.intensity || "-"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>

            {/* Pagination */}
            {meta.total !== undefined && meta.total > limit && (
              <div className="p-4 border-t border-border flex items-center justify-between bg-muted/50">
                <p className="text-xs text-muted-foreground">
                  Menampilkan {(page - 1) * limit + 1} -{" "}
                  {Math.min(page * limit, meta.total)} dari {meta.total} sesi
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Modal "+ Sesi Latihan Baru" */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowModal(false)}
          />

          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold">Sesi Latihan Baru</h3>
                  <p className="text-sm text-muted-foreground">
                    Catat sesi latihan atlet
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 hover:bg-muted rounded-lg"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Tanggal & Jenis */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="date">
                      Tanggal <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="date"
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                    />
                    {errors.date && (
                      <p className="text-sm text-red-500">{errors.date}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="session_type">
                      Jenis Latihan <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="session_type"
                      placeholder="Contoh: Kardio & Teknik"
                      value={formType}
                      onChange={(e) => setFormType(e.target.value)}
                    />
                    {errors.session_type && (
                      <p className="text-sm text-red-500">{errors.session_type}</p>
                    )}
                  </div>
                </div>

                {/* Durasi & Intensitas */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="duration">
                      Durasi (menit) <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="duration"
                      type="number"
                      min="1"
                      placeholder="60"
                      value={formDuration}
                      onChange={(e) => setFormDuration(e.target.value)}
                    />
                    {errors.duration_minutes && (
                      <p className="text-sm text-red-500">{errors.duration_minutes}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="intensity">
                      Intensitas <span className="text-red-500">*</span>
                    </label>
                    <Select
                      id="intensity"
                      value={formIntensity}
                      onChange={(e) => setFormIntensity(e.target.value)}
                    >
                      <option value="LOW">Rendah</option>
                      <option value="MEDIUM">Sedang</option>
                      <option value="HIGH">Tinggi</option>
                    </Select>
                    {errors.intensity && (
                      <p className="text-sm text-red-500">{errors.intensity}</p>
                    )}
                  </div>
                </div>

                {errors._form && (
                  <p className="text-sm text-red-500 text-center">
                    {errors._form}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={formLoading} className="flex-1">
                    {formLoading ? "Menyimpan..." : "Simpan Sesi Latihan"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowModal(false)}
                  >
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
