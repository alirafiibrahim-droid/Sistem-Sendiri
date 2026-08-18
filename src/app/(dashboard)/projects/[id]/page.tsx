"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { projectFormSchema } from "@/lib/validations/project";
import { createSupabaseClient } from "@/lib/supabase/client";
import BudgetManager from "@/components/budget/BudgetManager";
import type { IncidentalProject } from "@/lib/types/database";
import { QrCodeModal } from "@/components/ui/qr-code-modal";

type FormErrors = Record<string, string>;

type ProjectSession = {
  id: string;
  date: string;
  title: string | null;
  session_code: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  project_session_attendants: { count: number }[];
};

type Attendee = {
  id: string;
  method: string;
  scanned_at: string | null;
  score: number | null;
  notes: string | null;
  created_at: string;
  profiles: { id: string; full_name: string; nim: string; avatar_url: string | null } | null;
};

type ProjectTeamMember = {
  id: string;
  project_id: string;
  user_id: string;
  project_role: string | null;
  joined_at: string;
  profiles: { id: string; full_name: string; nim: string; avatar_url: string | null } | null;
};

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
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [project, setProject] = useState<IncidentalProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [userRole, setUserRole] = useState("");

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editErrors, setEditErrors] = useState<FormErrors>({});
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formUrgency, setFormUrgency] = useState("NORMAL");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formBudgetSource, setFormBudgetSource] = useState("");
  const [formStatus, setFormStatus] = useState("PROPOSED");

  // Tab state
  const [activeTab, setActiveTab] = useState<"detail" | "anggota" | "sesi" | "anggaran">("detail");

  // Budget state
  const [budgetTotal, setBudgetTotal] = useState(0);

  // Team state
  const [members, setMembers] = useState<ProjectTeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [allProfiles, setAllProfiles] = useState<{ id: string; full_name: string; nim: string }[]>([]);
  const [newMemberId, setNewMemberId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("Anggota");
  const [memberMessage, setMemberMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Session state
  const [sessions, setSessions] = useState<ProjectSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [submittingSessions, setSubmittingSessions] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sessionDateInput, setSessionDateInput] = useState(new Date().toISOString().split("T")[0]);
  const [sessionDateList, setSessionDateList] = useState<string[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState("");
  const [sessionEndTime, setSessionEndTime] = useState("");
  const [sessionMessage, setSessionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // QR state
  const [qrSession, setQrSession] = useState<{ id: string; date: string; title?: string | null } | null>(null);
  const [qrUrl, setQrUrl] = useState("");
  const [loadingQr, setLoadingQr] = useState(false);

  // Attendee state
  const [attendeeSessionId, setAttendeeSessionId] = useState<string | null>(null);
  const [attendeeSessionDate, setAttendeeSessionDate] = useState("");
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingScores, setSavingScores] = useState(false);
  const [scoreMessage, setScoreMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profile) setUserRole(profile.role);
      }
    } catch {}

    try {
      const res = await fetch(`/api/incidental-projects/${id}`);
      const json = await res.json();
      if (json.success) {
        setProject(json.data);
        setFetchError("");
      } else {
        setFetchError(json.error?.message || "Gagal memuat data proyek.");
      }
    } catch {
      setFetchError("Gagal terhubung ke server.");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchBudgetTotal = useCallback(async () => {
    try {
      const res = await fetch(`/api/budget-items?project_id=${id}`);
      const json = await res.json();
      if (json.success) {
        const indaks = json.data as Array<{ subtotal: number; children: Array<{ subtotal: number }> }>;
        const total = indaks.reduce((sum, induk) => {
          const value =
            induk.children && induk.children.length > 0
              ? induk.children.reduce((s, c) => s + Number(c.subtotal), 0)
              : Number(induk.subtotal);
          return sum + value;
        }, 0);
        setBudgetTotal(total);
      }
    } catch {}
  }, [id]);

  useEffect(() => {
    if (activeTab === "detail" || activeTab === "anggaran") fetchBudgetTotal();
  }, [activeTab, fetchBudgetTotal]);

  useEffect(() => {
    createSupabaseClient()
      .from("profiles")
      .select("id, full_name, nim")
      .eq("status", "AKTIF")
      .order("full_name")
      .then(({ data }) => {
        if (data) setAllProfiles(data);
      });
  }, []);

  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/incidental-projects/${id}/team`);
      const json = await res.json();
      if (json.success) setMembers(json.data);
    } catch {}
    setLoadingMembers(false);
  }, [id]);

  useEffect(() => {
    if (activeTab === "anggota") fetchMembers();
  }, [activeTab, fetchMembers]);

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch(`/api/projects/${id}/sessions`);
      const json = await res.json();
      if (json.success) setSessions(json.data);
    } catch {}
    setLoadingSessions(false);
  }, [id]);

  useEffect(() => {
    if (activeTab === "sesi") fetchSessions();
  }, [activeTab, fetchSessions]);

  // ─── Edit ───

  const openEdit = () => {
    if (!project) return;
    setFormName(project.name);
    setFormDescription(project.description || "");
    setFormUrgency(project.urgency_level);
    setFormStartDate(project.start_date);
    setFormEndDate(project.end_date || "");
    setFormBudgetSource(project.budget_source || "");
    setFormStatus(project.status);
    setEditErrors({});
    setEditing(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
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
      setEditErrors(fieldErrors);
      return;
    }
    setEditErrors({});
    setEditLoading(true);
    const res = await fetch(`/api/incidental-projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formName,
        description: formDescription || null,
        urgency_level: formUrgency,
        start_date: formStartDate,
        end_date: formEndDate || null,
        budget_source: formBudgetSource || null,
        status: formStatus,
      }),
    });
    const json = await res.json();
    if (!json.success) {
      setEditErrors({ _form: json.error?.message || "Gagal menyimpan perubahan." });
      setEditLoading(false);
      return;
    }
    setEditing(false);
    setEditLoading(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!confirm("Yakin ingin menghapus proyek ini? Tindakan ini tidak dapat dibatalkan.")) return;
    const res = await fetch(`/api/incidental-projects/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) router.push("/projects");
  };

  // ─── Team ───

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberId) {
      setMemberMessage({ type: "error", text: "Pilih anggota terlebih dahulu." });
      return;
    }
    setMemberMessage(null);
    try {
      const res = await fetch(`/api/incidental-projects/${id}/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: newMemberId, project_role: newMemberRole }),
      });
      const json = await res.json();
      if (json.success) {
        setMemberMessage({ type: "success", text: "Anggota berhasil ditambahkan." });
        setNewMemberId("");
        setNewMemberRole("Anggota");
        fetchMembers();
      } else {
        setMemberMessage({ type: "error", text: json.error?.message || "Gagal menambahkan anggota." });
      }
    } catch {
      setMemberMessage({ type: "error", text: "Gagal terhubung ke server." });
    }
  };

  const handleRemoveMember = async (userId: string, fullName: string) => {
    if (!confirm(`Yakin ingin menghapus ${fullName} dari tim proyek?`)) return;
    setMemberMessage(null);
    try {
      const res = await fetch(`/api/incidental-projects/${id}/team/${userId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        setMemberMessage({ type: "success", text: "Anggota berhasil dihapus." });
        fetchMembers();
      } else {
        setMemberMessage({ type: "error", text: json.error?.message || "Gagal menghapus anggota." });
      }
    } catch {
      setMemberMessage({ type: "error", text: "Gagal terhubung ke server." });
    }
  };

  // ─── Sessions ───

  const handleCreateSessions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionDateList.length === 0) {
      setSessionMessage({ type: "error", text: "Minimal satu tanggal harus ditambahkan." });
      return;
    }
    setSubmittingSessions(true);
    setSessionMessage(null);
    try {
      const res = await fetch(`/api/projects/${id}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: sessionDateList, start_time: sessionStartTime || undefined, end_time: sessionEndTime || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        setSessionMessage({ type: "success", text: "Sesi berhasil dibuat!" });
        setSessionDateList([]);
        setSessionDateInput(new Date().toISOString().split("T")[0]);
        setSessionStartTime("");
        setSessionEndTime("");
        setShowCreateForm(false);
        fetchSessions();
      } else {
        setSessionMessage({ type: "error", text: json.error?.message || "Gagal membuat sesi." });
      }
    } catch (err) {
      console.error("Create session error:", err);
      setSessionMessage({ type: "error", text: "Gagal terhubung ke server." });
    }
    setSubmittingSessions(false);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("Yakin ingin menghapus sesi ini?")) return;
    try {
      const res = await fetch(`/api/projects/${id}/sessions/${sessionId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) fetchSessions();
    } catch {}
  };

  const handleViewQr = async (session: { id: string; date: string; title?: string | null }) => {
    setQrSession(session);
    setLoadingQr(true);
    setQrUrl("");
    try {
      const res = await fetch(`/api/projects/${id}/sessions/${session.id}/qr`);
      const json = await res.json();
      if (json.success) setQrUrl(json.data.scan_url);
    } catch {}
    setLoadingQr(false);
  };

  const handleViewAttendees = async (sessionId: string, date: string) => {
    setAttendeeSessionId(sessionId);
    setAttendeeSessionDate(date);
    setAttendees([]);
    setScoreDrafts({});
    setNoteDrafts({});
    setScoreMessage(null);
    setLoadingAttendees(true);
    try {
      const res = await fetch(`/api/projects/${id}/sessions/${sessionId}/attendance`);
      const json = await res.json();
      if (json.success) {
        setAttendees(json.data);
        const drafts: Record<string, string> = {};
        const notes: Record<string, string> = {};
        for (const a of json.data) {
          drafts[a.id] = a.score != null ? String(a.score) : "";
          notes[a.id] = a.notes ?? "";
        }
        setScoreDrafts(drafts);
        setNoteDrafts(notes);
      }
    } catch {}
    setLoadingAttendees(false);
  };

  const handleSaveScores = async () => {
    if (!attendeeSessionId) return;
    setSavingScores(true);
    setScoreMessage(null);

    const scores = attendees
      .map((a) => {
        const raw = scoreDrafts[a.id]?.trim() ?? "";
        if (raw === "") return { attendee_id: a.id, score: null, notes: noteDrafts[a.id] ?? "" };
        const value = Number(raw);
        if (!Number.isInteger(value) || value < 1 || value > 10) return null;
        return { attendee_id: a.id, score: value, notes: noteDrafts[a.id] ?? "" };
      })
      .filter(
        (s): s is { attendee_id: string; score: number | null; notes: string } => s !== null
      );

    const invalid = scores.some((s) => s.score === null);
    if (invalid) {
      setScoreMessage({ type: "error", text: "Nilai harus berupa angka bulat 1-10 atau dikosongkan." });
      setSavingScores(false);
      return;
    }

    try {
      const res = await fetch(`/api/projects/${id}/sessions/${attendeeSessionId}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scores }),
      });
      const json = await res.json();
      if (!json.success) {
        setScoreMessage({ type: "error", text: json.error?.message || "Gagal menyimpan nilai." });
        setSavingScores(false);
        return;
      }
      setAttendees(json.data);
      const drafts: Record<string, string> = {};
      const notes: Record<string, string> = {};
      for (const a of json.data) {
        drafts[a.id] = a.score != null ? String(a.score) : "";
        notes[a.id] = a.notes ?? "";
      }
      setScoreDrafts(drafts);
      setNoteDrafts(notes);
      setScoreMessage({ type: "success", text: "Nilai berhasil disimpan." });
    } catch {
      setScoreMessage({ type: "error", text: "Gagal terhubung ke server." });
    }
    setSavingScores(false);
  };

  const closeAttendeeModal = () => {
    setAttendeeSessionId(null);
    setAttendeeSessionDate("");
    setAttendees([]);
    setScoreDrafts({});
    setNoteDrafts({});
    setScoreMessage(null);
  };

  // ─── Render ───

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Memuat data...</div>;
  }

  if (!project) {
    return (
      <div className="text-center py-8 space-y-4">
        <p className="text-muted-foreground">{fetchError || "Proyek tidak ditemukan."}</p>
        <Button variant="outline" onClick={() => router.back()}>Kembali</Button>
      </div>
    );
  }

  const canEdit = ["ADMIN", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"].includes(userRole);
  const canManageScores = userRole === "ADMIN" || userRole === "PENGURUS_INTI" || userRole === "KABID";
  const canDelete = ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"].includes(userRole);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Detail Proyek Insidental</h2>
          <p className="text-muted-foreground">Lihat, edit, dan kelola data proyek insidental</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>Kembali</Button>
          {canEdit && !editing && (
            <Button onClick={openEdit}>Edit Proyek</Button>
          )}
          {canDelete && (
            <Button variant="destructive" onClick={handleDelete}>
              Hapus
            </Button>
          )}
        </div>
      </div>

      {/* Edit Form */}
      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit Proyek Insidental</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Nama Proyek <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="Contoh: Panitia Wisuda Darurat"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
                {editErrors.name && <p className="text-sm text-red-500">{editErrors.name}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Deskripsi</label>
                <textarea
                  placeholder="Deskripsi proyek..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
                {editErrors.description && <p className="text-sm text-red-500">{editErrors.description}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Tingkat Urgensi <span className="text-red-500">*</span>
                  </label>
                  <Select value={formUrgency} onValueChange={(value) => setFormUrgency(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Rendah</SelectItem>
                      <SelectItem value="NORMAL">Normal</SelectItem>
                      <SelectItem value="HIGH">Tinggi</SelectItem>
                    </SelectContent>
                  </Select>
                  {editErrors.urgency_level && <p className="text-sm text-red-500">{editErrors.urgency_level}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sumber Dana</label>
                  <Input
                    placeholder="Contoh: Sponsor Eksternal"
                    value={formBudgetSource}
                    onChange={(e) => setFormBudgetSource(e.target.value)}
                  />
                  {editErrors.budget_source && <p className="text-sm text-red-500">{editErrors.budget_source}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Tanggal Mulai <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                  />
                  {editErrors.start_date && <p className="text-sm text-red-500">{editErrors.start_date}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tanggal Selesai</label>
                  <Input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                  />
                  {editErrors.end_date && <p className="text-sm text-red-500">{editErrors.end_date}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={formStatus} onValueChange={(value) => setFormStatus(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROPOSED">Diajukan</SelectItem>
                    <SelectItem value="APPROVED">Disetujui</SelectItem>
                    <SelectItem value="ONGOING">Berjalan</SelectItem>
                    <SelectItem value="CLOSED">Selesai</SelectItem>
                  </SelectContent>
                </Select>
                {editErrors.status && <p className="text-sm text-red-500">{editErrors.status}</p>}
              </div>

              {editErrors._form && (
                <p className="text-sm text-red-500 text-center">{editErrors._form}</p>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={editLoading} className="flex-1">
                  {editLoading ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                  Batal
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tab Navigation */}
          <Card>
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab("detail")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "detail"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Detail Proyek
              </button>
              <button
                onClick={() => setActiveTab("anggota")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "anggota"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Anggota
              </button>
              <button
                onClick={() => setActiveTab("anggaran")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "anggaran"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Anggaran
              </button>
              <button
                onClick={() => setActiveTab("sesi")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "sesi"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Sesi Pertemuan
              </button>
            </div>
          </Card>

          {/* Detail Tab */}
          {activeTab === "detail" && (
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Informasi Proyek</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nama Proyek</span>
                    <span className="font-medium text-right max-w-[60%]">{project.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={statusVariant[project.status]}>{statusLabel[project.status]}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Urgensi</span>
                    <Badge variant={urgencyVariant[project.urgency_level]}>{urgencyLabel[project.urgency_level]}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tanggal Mulai</span>
                    <span>{formatDate(project.start_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tanggal Selesai</span>
                    <span>{project.end_date ? formatDate(project.end_date) : "-"}</span>
                  </div>
                  {project.budget_source && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sumber Dana</span>
                      <span className="font-medium">{project.budget_source}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Anggaran</span>
                    <span className="font-medium">{formatCurrency(budgetTotal)}</span>
                  </div>
                  {project.description && (
                    <div className="pt-2 border-t">
                      <span className="text-muted-foreground text-sm">Deskripsi</span>
                      <p className="text-sm mt-1">{project.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Informasi Lainnya</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dibuat pada</span>
                    <span className="text-sm">{formatDate(project.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Terakhir diperbarui</span>
                    <span className="text-sm">{formatDate(project.updated_at)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Anggota Tab */}
          {activeTab === "anggota" && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>
                    Anggota Tim Proyek
                    {members.length > 0 && (
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        ({members.length} orang)
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingMembers ? (
                    <div className="text-center py-8 text-muted-foreground">Memuat anggota...</div>
                  ) : members.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">Belum ada anggota tim.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>No.</TableHead>
                          <TableHead>Nama</TableHead>
                          <TableHead>NIM</TableHead>
                          <TableHead>Peran</TableHead>
                          {canEdit && <TableHead>Aksi</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {members.map((m, idx) => (
                          <TableRow key={m.id}>
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell className="font-medium">
                              {m.profiles?.full_name || "-"}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {m.profiles?.nim || "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{m.project_role || "Anggota"}</Badge>
                            </TableCell>
                            {canEdit && (
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => handleRemoveMember(m.user_id, m.profiles?.full_name || "anggota")}
                                >
                                  Hapus
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {canEdit && (
                <Card>
                  <CardHeader><CardTitle>Input Anggota</CardTitle></CardHeader>
                  <CardContent>
                    <form onSubmit={handleAddMember} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Pilih Anggota <span className="text-red-500">*</span>
                        </label>
                        <Select value={newMemberId === "" ? "__none__" : newMemberId} onValueChange={(value) => setNewMemberId(value === "__none__" ? "" : value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih anggota..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Pilih anggota...</SelectItem>
                            {allProfiles
                              .filter((p) => !members.some((m) => m.user_id === p.id))
                              .map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.full_name} — {p.nim}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Peran dalam Proyek</label>
                        <Input
                          placeholder="Contoh: Koordinator Acara, Humas, Logistik"
                          value={newMemberRole}
                          onChange={(e) => setNewMemberRole(e.target.value)}
                        />
                      </div>
                      {memberMessage && (
                        <p className={`text-sm ${memberMessage.type === "success" ? "text-green-500" : "text-red-500"}`}>
                          {memberMessage.text}
                        </p>
                      )}
                      <Button type="submit" disabled={!newMemberId}>
                        Tambah Anggota
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Anggaran Tab */}
          {activeTab === "anggaran" && (
            <BudgetManager
              type="project"
              entityId={id}
              canEdit={canEdit}
            />
          )}

          {/* Sesi Tab */}
          {activeTab === "sesi" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Sesi Pertemuan</h3>
                <Button
                  variant="outline"
                  onClick={() => { setShowCreateForm(!showCreateForm); setSessionMessage(null); }}
                >
                  {showCreateForm ? "Tutup" : "+ Buat Sesi"}
                </Button>
              </div>

              {showCreateForm && (
                <Card>
                  <CardHeader><CardTitle>Buat Sesi Baru</CardTitle></CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreateSessions} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Tanggal</label>
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
                                {new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })}
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

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Jam Mulai</label>
                          <Input
                            type="time"
                            value={sessionStartTime}
                            onChange={(e) => setSessionStartTime(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Jam Sampai</label>
                          <Input
                            type="time"
                            value={sessionEndTime}
                            onChange={(e) => setSessionEndTime(e.target.value)}
                          />
                        </div>
                      </div>

                      {sessionMessage && (
                        <p className={`text-sm ${sessionMessage.type === "success" ? "text-green-500" : "text-red-500"}`}>
                          {sessionMessage.text}
                        </p>
                      )}
                      <Button type="submit" disabled={submittingSessions}>
                        {submittingSessions ? "Menyimpan..." : "Simpan"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-0">
                  {loadingSessions ? (
                    <div className="text-center py-8 text-muted-foreground">Memuat sesi...</div>
                  ) : sessions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">Belum ada sesi pertemuan.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Jam</TableHead>
                          <TableHead>Kode Unit</TableHead>
                          <TableHead>Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sessions.map((session) => (
                          <TableRow key={session.id}>
                            <TableCell>{formatDate(session.date)}</TableCell>
                            <TableCell className="text-sm">
                              {session.start_time && session.end_time
                                ? `${session.start_time} - ${session.end_time}`
                                : session.start_time
                                  ? session.start_time
                                  : "-"}
                            </TableCell>
                            <TableCell>
                              <code className="rounded bg-muted px-2 py-1 font-mono text-xs font-semibold tracking-widest text-primary">
                                {session.session_code || "-"}
                              </code>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewAttendees(session.id, session.date)}
                                >
                                  {session.project_session_attendants?.[0]?.count ?? 0} Peserta
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewQr({ id: session.id, date: session.date, title: session.title })}
                                >
                                  QR Code
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteSession(session.id)}
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
                </CardContent>
              </Card>

              {/* QR Modal */}
              <QrCodeModal
                open={!!qrSession}
                label="Sesi Proyek Insidental"
                title="QR Code Presensi"
                dateText={qrSession ? formatDate(qrSession.date) : ""}
                url={qrUrl}
                loading={loadingQr}
                onClose={() => { setQrSession(null); setQrUrl(""); }}
              />

              {/* Attendee Modal */}
              {attendeeSessionId && (
                <div className="fixed inset-0 z-50 flex justify-end">
                  <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={closeAttendeeModal}
                  />
                  <div className="relative flex h-full w-full max-w-md flex-col bg-background shadow-2xl">
                    <div className="bg-gradient-to-br from-primary to-blue-600 px-6 pb-6 pt-5 text-primary-foreground">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-widest text-primary-foreground/70">
                            Sesi Pertemuan
                          </p>
                          <h2 className="mt-1 text-xl font-semibold">
                            {attendeeSessionDate ? formatDate(attendeeSessionDate) : ""}
                          </h2>
                        </div>
                        <button
                          onClick={closeAttendeeModal}
                          className="rounded-full bg-white/15 p-2 text-white transition-colors hover:bg-white/30"
                          aria-label="Tutup"
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          >
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-medium">
                          <span className="h-2 w-2 rounded-full bg-success" />
                          {loadingAttendees ? "Memuat..." : `${attendees.length} peserta hadir`}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-3 overflow-y-auto p-5">
                      {loadingAttendees ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          <p className="mt-3 text-sm">Memuat daftar hadir...</p>
                        </div>
                      ) : attendees.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                          <svg
                            className="h-10 w-10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                          <p className="mt-3 text-sm font-medium">Belum ada peserta yang hadir</p>
                          <p className="mt-1 text-xs">Peserta dapat melakukan presensi melalui QR Code.</p>
                        </div>
                      ) : (
                        attendees.map((a) => {
                          const initials =
                            a.profiles?.full_name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";
                          const time = new Date(a.created_at).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                          return (
                            <div key={a.id} className="flex flex-col gap-2">
                              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:border-primary/40">
                                <Avatar className="h-10 w-10 ring-2 ring-border">
                                   <AvatarImage src={a.profiles?.avatar_url ?? undefined} alt={a.profiles?.full_name ?? ""} />
                                  <AvatarFallback>{initials}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold">
                                    {a.profiles?.full_name || "Unknown"}
                                  </p>
                                  <p className="font-mono text-xs text-muted-foreground">
                                    {a.profiles?.nim || "-"}
                                  </p>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  <Badge variant={a.method === "QR" ? "default" : "secondary"}>
                                    {a.method}
                                  </Badge>
                                  <span className="text-[11px] text-muted-foreground">{time}</span>
                                </div>
                              </div>
                              {canManageScores && (
                                <div className="flex flex-col gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-3 py-2">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-xs font-medium text-muted-foreground">
                                      Nilai (1-10)
                                    </span>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={10}
                                      value={scoreDrafts[a.id] ?? ""}
                                      onChange={(e) =>
                                        setScoreDrafts({
                                          ...scoreDrafts,
                                          [a.id]: e.target.value,
                                        })
                                      }
                                      placeholder="-"
                                      className="h-8 w-16 text-center text-sm"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <span className="text-xs font-medium text-muted-foreground">
                                      Catatan
                                    </span>
                                    <textarea
                                      value={noteDrafts[a.id] ?? ""}
                                      onChange={(e) =>
                                        setNoteDrafts({
                                          ...noteDrafts,
                                          [a.id]: e.target.value,
                                        })
                                      }
                                      rows={2}
                                      placeholder="Catatan (opsional)..."
                                      className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                    {canManageScores && !loadingAttendees && attendees.length > 0 && (
                      <div className="border-t border-border bg-card px-5 py-4">
                        {scoreMessage && (
                          <p
                            className={`mb-2 text-sm ${
                              scoreMessage.type === "success" ? "text-success" : "text-destructive"
                            }`}
                          >
                            {scoreMessage.text}
                          </p>
                        )}
                        <Button className="w-full" disabled={savingScores} onClick={handleSaveScores}>
                          {savingScores ? "Menyimpan..." : "Simpan Nilai"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
