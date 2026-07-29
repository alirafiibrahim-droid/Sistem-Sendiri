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
import { projectFormSchema } from "@/lib/validations/project";
import type { IncidentalProject } from "@/lib/types/database";
import type { ApiMeta } from "@/lib/types/api";

type FormErrors = Record<string, string>;

type ProjectSession = {
  id: string;
  date: string;
  title: string | null;
  created_at: string;
  project_session_attendants: { count: number }[];
};

type SessionMessage = { type: "success" | "error"; text: string };

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive" | "default"> = {
  PROPOSED: "secondary",
  APPROVED: "warning",
  ONGOING: "default",
  CLOSED: "success",
};

const statusLabel: Record<string, string> = {
  PROPOSED: "Diajukan",
  APPROVED: "Disetujui",
  ONGOING: "Berjalan",
  CLOSED: "Selesai",
};

const urgencyVariant: Record<string, "destructive" | "warning" | "secondary"> = {
  HIGH: "destructive",
  NORMAL: "warning",
  LOW: "secondary",
};

const urgencyLabel: Record<string, string> = {
  HIGH: "Tinggi",
  NORMAL: "Normal",
  LOW: "Rendah",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<IncidentalProject[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 15;

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formUrgency, setFormUrgency] = useState("NORMAL");
  const [formStartDate, setFormStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [formEndDate, setFormEndDate] = useState("");
  const [formBudgetSource, setFormBudgetSource] = useState("");

  // Sessions state
  const [selectedProject, setSelectedProject] = useState<{ id: string; name: string } | null>(null);
  const [projectSessions, setProjectSessions] = useState<ProjectSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionFormOpen, setSessionFormOpen] = useState(false);
  const [sessionDateInput, setSessionDateInput] = useState(new Date().toISOString().split("T")[0]);
  const [sessionDateList, setSessionDateList] = useState<string[]>([]);
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionSubmitting, setSessionSubmitting] = useState(false);
  const [sessionMessage, setSessionMessage] = useState<SessionMessage | null>(null);
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [qrData, setQrData] = useState<any | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);

    const res = await fetch(`/api/incidental-projects?${params}`);
    const json = await res.json();

    if (json.success) {
      setProjects(json.data);
      setMeta(json.meta);
    }
    setLoading(false);
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormUrgency("NORMAL");
    setFormStartDate(new Date().toISOString().split("T")[0]);
    setFormEndDate("");
    setFormBudgetSource("");
    setErrors({});
  };

  const openModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = projectFormSchema.safeParse({
      name: formName,
      description: formDescription || undefined,
      urgency_level: formUrgency,
      start_date: formStartDate,
      end_date: formEndDate || undefined,
      budget_source: formBudgetSource || undefined,
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

    const res = await fetch("/api/incidental-projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formName,
        description: formDescription || undefined,
        urgency_level: formUrgency,
        start_date: formStartDate,
        end_date: formEndDate || undefined,
        budget_source: formBudgetSource || undefined,
      }),
    });

    const json = await res.json();

    if (!json.success) {
      setErrors({ _form: json.error?.message || "Gagal menyimpan proyek." });
      setFormLoading(false);
      return;
    }

    setShowModal(false);
    setFormLoading(false);
    fetchProjects();
  };

  // ─── Sessions ───

  const fetchSessions = useCallback(async (projectId: string) => {
    setSessionsLoading(true);
    const res = await fetch(`/api/projects/${projectId}/sessions`);
    const json = await res.json();
    if (json.success) {
      setProjectSessions(json.data);
    }
    setSessionsLoading(false);
  }, []);

  const openSessions = (p: IncidentalProject) => {
    setSelectedProject({ id: p.id, name: p.name });
    setSessionFormOpen(false);
    setSessionDateList([]);
    setSessionDateInput(new Date().toISOString().split("T")[0]);
    setSessionTitle("");
    setSessionMessage(null);
    setQrSessionId(null);
    setQrData(null);
    fetchSessions(p.id);
  };

  const closeSessions = () => {
    setSelectedProject(null);
    setProjectSessions([]);
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    if (sessionDateList.length === 0) {
      setSessionMessage({ type: "error", text: "Minimal satu tanggal harus diisi." });
      return;
    }

    setSessionSubmitting(true);
    setSessionMessage(null);

    const res = await fetch(`/api/projects/${selectedProject.id}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dates: sessionDateList,
        title: sessionTitle || undefined,
      }),
    });

    const json = await res.json();

    if (!json.success) {
      setSessionMessage({
        type: "error",
        text: json.error?.message || "Gagal membuat sesi.",
      });
      setSessionSubmitting(false);
      return;
    }

    setSessionMessage({ type: "success", text: "Sesi berhasil dibuat." });
    setSessionDateList([]);
    setSessionDateInput(new Date().toISOString().split("T")[0]);
    setSessionTitle("");
    setSessionFormOpen(false);
    setSessionSubmitting(false);
    fetchSessions(selectedProject.id);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!selectedProject) return;
    if (!confirm("Hapus sesi ini?")) return;

    const res = await fetch(
      `/api/projects/${selectedProject.id}/sessions/${sessionId}`,
      { method: "DELETE" }
    );

    const json = await res.json();

    if (!json.success) {
      setSessionMessage({
        type: "error",
        text: json.error?.message || "Gagal menghapus sesi.",
      });
      return;
    }

    setSessionMessage({ type: "success", text: "Sesi berhasil dihapus." });
    fetchSessions(selectedProject.id);
  };

  const handleShowQr = async (sessionId: string) => {
    if (!selectedProject) return;
    setQrSessionId(sessionId);
    setQrData(null);

    const res = await fetch(
      `/api/projects/${selectedProject.id}/sessions/${sessionId}/qr`
    );
    const json = await res.json();

    if (json.success) {
      setQrData(json.data);
    } else {
      setQrSessionId(null);
      setSessionMessage({
        type: "error",
        text: "Gagal memuat QR.",
      });
    }
  };

  const totalPages = meta.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Proyek Insidental</h2>
          <p className="text-muted-foreground">Proyek ad-hoc di luar program kerja rutin</p>
        </div>
        <Button onClick={openModal}>+ Proyek Baru</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Input
          placeholder="Cari proyek..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="w-48"
        >
          <option value="">Semua Status</option>
          <option value="PROPOSED">Diajukan</option>
          <option value="APPROVED">Disetujui</option>
          <option value="ONGOING">Berjalan</option>
          <option value="CLOSED">Selesai</option>
        </Select>
      </div>

      {/* Project Cards */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Memuat data...
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Belum ada proyek.
          </div>
        ) : (
          projects.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{p.name}</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{formatDate(p.start_date)} {p.end_date ? `s/d ${formatDate(p.end_date)}` : ""}</span>
                      {p.budget_source && (
                        <>
                          <span>&middot;</span>
                          <span>{p.budget_source}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => openSessions(p)}>
                      Sesi
                    </Button>
                    <Badge variant={urgencyVariant[p.urgency_level] || "secondary"}>
                      {urgencyLabel[p.urgency_level] || p.urgency_level}
                    </Badge>
                    <Badge variant={statusVariant[p.status] || "secondary"}>
                      {statusLabel[p.status] || p.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              {p.description && (
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {meta.total !== undefined && meta.total > limit && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Menampilkan {(page - 1) * limit + 1} -{" "}
            {Math.min(page * limit, meta.total)} dari {meta.total} proyek
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

      {/* Modal "+ Proyek Baru" */}
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
                  <h3 className="text-lg font-bold">Proyek Baru</h3>
                  <p className="text-sm text-muted-foreground">
                    Buat proyek insidental baru
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
                {/* Nama Proyek */}
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="name">
                    Nama Proyek <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="name"
                    placeholder="Contoh: Panitia Wisuda Darurat"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500">{errors.name}</p>
                  )}
                </div>

                {/* Deskripsi */}
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="description">
                    Deskripsi
                  </label>
                  <textarea
                    id="description"
                    placeholder="Deskripsi proyek..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  {errors.description && (
                    <p className="text-sm text-red-500">{errors.description}</p>
                  )}
                </div>

                {/* Urgensi & Sumber Dana */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="urgency">
                      Tingkat Urgensi <span className="text-red-500">*</span>
                    </label>
                    <Select
                      id="urgency"
                      value={formUrgency}
                      onChange={(e) => setFormUrgency(e.target.value)}
                    >
                      <option value="LOW">Rendah</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">Tinggi</option>
                    </Select>
                    {errors.urgency_level && (
                      <p className="text-sm text-red-500">{errors.urgency_level}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="budget_source">
                      Sumber Dana
                    </label>
                    <Input
                      id="budget_source"
                      placeholder="Contoh: Sponsor Eksternal"
                      value={formBudgetSource}
                      onChange={(e) => setFormBudgetSource(e.target.value)}
                    />
                    {errors.budget_source && (
                      <p className="text-sm text-red-500">{errors.budget_source}</p>
                    )}
                  </div>
                </div>

                {/* Tanggal Mulai & Selesai */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="start_date">
                      Tanggal Mulai <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                    />
                    {errors.start_date && (
                      <p className="text-sm text-red-500">{errors.start_date}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="end_date">
                      Tanggal Selesai
                    </label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                    />
                    {errors.end_date && (
                      <p className="text-sm text-red-500">{errors.end_date}</p>
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
                    {formLoading ? "Menyimpan..." : "Simpan Proyek"}
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

      {/* Sessions Modal */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeSessions}
          />

          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold">Sesi - {selectedProject.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Kelola sesi presensi proyek
                  </p>
                </div>
                <button
                  onClick={closeSessions}
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

              {sessionMessage && (
                <div
                  className={`mb-4 px-4 py-3 rounded-lg text-sm ${
                    sessionMessage.type === "success"
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {sessionMessage.text}
                  <button
                    className="float-right font-bold"
                    onClick={() => setSessionMessage(null)}
                  >
                    &times;
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  {projectSessions.length} sesi
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSessionFormOpen(!sessionFormOpen)}
                >
                  + Buat Sesi
                </Button>
              </div>

              {/* Create Session Form */}
              {sessionFormOpen && (
                <form onSubmit={handleCreateSession} className="mb-6 p-4 border rounded-xl bg-muted/30 space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Tanggal <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={sessionDateInput}
                        onChange={(e) => setSessionDateInput(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (sessionDateInput && !sessionDateList.includes(sessionDateInput)) {
                            setSessionDateList([...sessionDateList, sessionDateInput]);
                          }
                        }}
                      >
                        Tambah Tanggal
                      </Button>
                    </div>
                    {sessionDateList.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {sessionDateList.map((d, i) => (
                          <span
                            key={d}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-secondary text-secondary-foreground"
                          >
                            {new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                            <button
                              type="button"
                              className="hover:text-destructive ml-1"
                              onClick={() => setSessionDateList(sessionDateList.filter((_, j) => j !== i))}
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Judul (opsional)</label>
                    <Input
                      placeholder="Contoh: Sesi Pembukaan"
                      value={sessionTitle}
                      onChange={(e) => setSessionTitle(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button type="submit" disabled={sessionSubmitting} size="sm">
                      {sessionSubmitting ? "Menyimpan..." : "Simpan"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSessionFormOpen(false);
                        setSessionDateList([]);
                        setSessionDateInput(new Date().toISOString().split("T")[0]);
                        setSessionTitle("");
                      }}
                    >
                      Batal
                    </Button>
                  </div>
                </form>
              )}

              {/* Sessions Table */}
              {sessionsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Memuat sesi...
                </div>
              ) : projectSessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Belum ada sesi.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Judul</TableHead>
                      <TableHead>Peserta</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectSessions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{formatDate(s.date)}</TableCell>
                        <TableCell>{s.title || "-"}</TableCell>
                        <TableCell>
                          {s.project_session_attendants[0]?.count ?? 0}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleShowQr(s.id)}
                            >
                              QR
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteSession(s.id)}
                            >
                              Hapus
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrSessionId && qrData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setQrSessionId(null);
              setQrData(null);
            }}
          />

          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">QR Code Sesi</h3>
              <button
                onClick={() => {
                  setQrSessionId(null);
                  setQrData(null);
                }}
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

            {qrData.session && (
              <div className="text-sm text-muted-foreground mb-4">
                <p>Tanggal: {formatDate(qrData.session.date)}</p>
                {qrData.session.title && <p>Judul: {qrData.session.title}</p>}
              </div>
            )}

            <div className="bg-muted/30 rounded-xl p-4 break-all">
              <p className="text-xs font-mono text-center mb-2">
                {qrData.scan_url}
              </p>
              <p className="text-xs text-muted-foreground text-center">
                Buka URL di atas untuk melakukan presensi, atau scan QR code dari perangkat lain.
              </p>
            </div>

            <Button
              className="w-full mt-4"
              variant="outline"
              onClick={() => {
                navigator.clipboard?.writeText(qrData.scan_url);
              }}
            >
              Salin URL
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
