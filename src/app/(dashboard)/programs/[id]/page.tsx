"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
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
import { programUpdateSchema } from "@/lib/validations/program";
import BudgetManager from "@/components/budget/BudgetManager";
import { QrCodeModal } from "@/components/ui/qr-code-modal";
import type {
  ProgramWithDetails,
  ProgramMemberWithProfile,
  Division,
} from "@/lib/types/database";

type FormErrors = Record<string, string>;

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  ONGOING: "warning",
  PLANNED: "secondary",
  COMPLETED: "success",
  CANCELLED: "destructive",
};

const statusLabel: Record<string, string> = {
  PLANNED: "Direncanakan",
  ONGOING: "Berlangsung",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function ProgramDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const supabase = createSupabaseClient();

  const [program, setProgram] = useState<ProgramWithDetails | null>(null);
  const [members, setMembers] = useState<ProgramMemberWithProfile[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [userRole, setUserRole] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  const [editing, setEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editErrors, setEditErrors] = useState<FormErrors>({});

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formStatus, setFormStatus] = useState<string>("PLANNED");
  const [formDivisionId, setFormDivisionId] = useState("");
  const [formHandoverId, setFormHandoverId] = useState("");
  const [formProposalUrl, setFormProposalUrl] = useState("");
  const [formLpjUrl, setFormLpjUrl] = useState("");

  const [activePeriods, setActivePeriods] = useState<{ id: string; period_from: string; period_to: string; status: string }[]>([]);

  const [deleteLoading, setDeleteLoading] = useState(false);

  const [formMembers, setFormMembers] = useState<{ user_id: string; full_name: string; nim: string }[]>([]);
  const [allProfiles, setAllProfiles] = useState<{ id: string; full_name: string; nim: string }[]>([]);
  const [newMemberId, setNewMemberId] = useState("");

  const [activeTab, setActiveTab] = useState<"detail" | "anggota" | "sesi" | "anggaran">("detail");

  const [sessions, setSessions] = useState<Array<{id: string; date: string; title: string | null; session_code: string | null; start_time: string | null; end_time: string | null; created_at: string; program_session_attendants: Array<{count: number}>}>>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [submittingSessions, setSubmittingSessions] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sessionDateInput, setSessionDateInput] = useState(new Date().toISOString().split("T")[0]);
  const [sessionDateList, setSessionDateList] = useState<string[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState("");
  const [sessionEndTime, setSessionEndTime] = useState("");
  const [sessionMessage, setSessionMessage] = useState<{type: "success" | "error"; text: string} | null>(null);

  const [qrSession, setQrSession] = useState<{id: string; date: string} | null>(null);
  const [qrUrl, setQrUrl] = useState("");
  const [loadingQr, setLoadingQr] = useState(false);

  const [attendeeSessionId, setAttendeeSessionId] = useState<string | null>(null);
  const [attendeeSessionDate, setAttendeeSessionDate] = useState("");
  const [attendees, setAttendees] = useState<Array<{id: string; method: string; scanned_at: string | null; score: number | null; notes: string | null; created_at: string; profiles: {id: string; full_name: string; nim: string; avatar_url: string | null} | null}>>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingScores, setSavingScores] = useState(false);
  const [scoreMessage, setScoreMessage] = useState<{type: "success" | "error"; text: string} | null>(null);

  const [budgetTotal, setBudgetTotal] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile) setUserRole(profile.role);
    }

    try {
      const res = await fetch(`/api/programs/${id}`);
      const json = await res.json();
      if (json.success) {
        setProgram(json.data);
        setMembers(json.data.program_members || []);
        setFetchError("");
      } else {
        setFetchError(json.error?.message || "Gagal memuat data program.");
      }
    } catch {
      setFetchError("Gagal terhubung ke server.");
    }

    setLoading(false);
  }, [supabase, id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchBudgetTotal = useCallback(async () => {
    try {
      const res = await fetch(`/api/budget-items?program_id=${id}`);
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
    supabase
      .from("divisions")
      .select("id, name, description, created_at, updated_at")
      .order("name")
      .then(({ data }) => {
        if (data) setDivisions(data);
      });
  }, [supabase]);

  // Periode Sertijab yang sedang berjalan (dropdown "Periode")
  useEffect(() => {
    fetch("/api/handovers/active")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setActivePeriods(json.data);
      });
  }, []);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, full_name, nim")
      .eq("status", "AKTIF")
      .order("full_name")
      .then(({ data }) => {
        if (data) setAllProfiles(data);
      });
  }, [supabase]);

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch(`/api/programs/${id}/sessions`);
      const json = await res.json();
      if (json.success) setSessions(json.data);
    } catch {}
    setLoadingSessions(false);
  }, [id]);

  useEffect(() => {
    if (activeTab === "sesi") fetchSessions();
  }, [activeTab, fetchSessions]);

  const handleCreateSessions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionDateList.length === 0) return;
    setSubmittingSessions(true);
    setSessionMessage(null);
    try {
      const res = await fetch(`/api/programs/${id}/sessions`, {
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
    } catch {
      setSessionMessage({ type: "error", text: "Gagal terhubung ke server." });
    }
    setSubmittingSessions(false);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("Yakin ingin menghapus sesi ini?")) return;
    try {
      const res = await fetch(`/api/programs/${id}/sessions/${sessionId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) fetchSessions();
    } catch {}
  };

  const handleViewQr = async (session: { id: string; date: string }) => {
    setQrSession(session);
    setLoadingQr(true);
    setQrUrl("");
    try {
      const res = await fetch(`/api/programs/${id}/sessions/${session.id}/qr`);
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
      const res = await fetch(`/api/programs/${id}/sessions/${sessionId}/attendance`);
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
      const res = await fetch(`/api/programs/${id}/sessions/${attendeeSessionId}/attendance`, {
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

  const openEdit = () => {
    if (!program) return;
    setFormName(program.name);
    setFormDescription(program.description || "");
    setFormStartDate(program.start_date);
    setFormEndDate(program.end_date);
    setFormStatus(program.status);
    setFormDivisionId(program.division_id || "");
    setFormHandoverId(program.handover_id || "");
    setFormProposalUrl(program.proposal_url || "");
    setFormLpjUrl(program.lpj_url || "");
    setFormMembers(
      members.map((m) => ({
        user_id: m.user_id,
        full_name: m.profiles?.full_name || "",
        nim: m.profiles?.nim || "",
      }))
    );
    setNewMemberId("");
    setEditErrors({});
    setEditing(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = programUpdateSchema.safeParse({
      name: formName,
      description: formDescription || undefined,
      start_date: formStartDate || undefined,
      end_date: formEndDate || undefined,
      status: formStatus,
      division_id: formDivisionId || undefined,
      handover_id: formHandoverId || undefined,
      proposal_url: formProposalUrl || undefined,
      lpj_url: formLpjUrl || undefined,
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

    const res = await fetch(`/api/programs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formName,
        description: formDescription || null,
        start_date: formStartDate || undefined,
        end_date: formEndDate || undefined,
        status: formStatus,
        division_id: formDivisionId || null,
        handover_id: formHandoverId || null,
        proposal_url: formProposalUrl || null,
        lpj_url: formLpjUrl || null,
      }),
    });

    const json = await res.json();

    if (!json.success) {
      setEditErrors({ _form: json.error?.message || "Gagal menyimpan perubahan." });
      setEditLoading(false);
      return;
    }

    const { error: delErr } = await supabase
      .from("program_members")
      .delete()
      .eq("program_id", id);

    if (delErr) {
      setEditErrors({ _form: "Gagal menyimpan anggota: " + delErr.message });
      setEditLoading(false);
      return;
    }

    if (formMembers.length > 0) {
      const { error: insErr } = await supabase
        .from("program_members")
        .insert(
          formMembers.map((m) => ({
            program_id: id,
            user_id: m.user_id,
            role_in_program: "Anggota",
          }))
        );

      if (insErr) {
        setEditErrors({ _form: "Gagal menyimpan anggota: " + insErr.message });
        setEditLoading(false);
        return;
      }
    }

    setEditing(false);
    setEditLoading(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!confirm("Yakin ingin menghapus program ini? Tindakan ini tidak dapat dibatalkan.")) return;

    setDeleteLoading(true);
    const res = await fetch(`/api/programs/${id}`, { method: "DELETE" });
    const json = await res.json();

    if (json.success) {
      router.push("/programs");
    }
    setDeleteLoading(false);
  };

  const isCreator = program?.created_by === userId;
  const isLocked = program?.handovers?.status === "COMPLETED";
  const canEdit = ["ADMIN", "KABID", "BENDAHARA", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"].includes(userRole) || isCreator;
  const canManageScores = userRole === "ADMIN" || userRole === "PENGURUS_INTI" || userRole === "KABID";
  const canDelete = ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"].includes(userRole);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Memuat data...</div>;
  }

  if (!program) {
    return (
      <div className="text-center py-8 space-y-4">
        <p className="text-muted-foreground">{fetchError || "Program tidak ditemukan."}</p>
        <Button variant="outline" onClick={() => router.back()}>Kembali</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Detail Program Kerja</h2>
          <p className="text-muted-foreground">Lihat, edit, dan kelola data program kerja</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>Kembali</Button>
          {isLocked ? (
            <div className="inline-flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              <span aria-hidden>🔒</span> Periode telah selesai — hanya dapat dilihat
            </div>
          ) : (
            <>
              {canEdit && !editing && (
                <Button onClick={openEdit}>Edit Program</Button>
              )}
              {canDelete && (
                <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
                  {deleteLoading ? "Menghapus..." : "Hapus"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Edit Form */}
      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit Program Kerja</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Nama Program <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="Contoh: Seminar Kewirausahaan"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
                {editErrors.name && <p className="text-sm text-red-500">{editErrors.name}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Deskripsi <span className="text-red-500">*</span>
                </label>
                <textarea
                  placeholder="Jelaskan tujuan dan gambaran umum program..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={4}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
                {editErrors.description && <p className="text-sm text-red-500">{editErrors.description}</p>}
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
                  <label className="text-sm font-medium">
                    Tanggal Selesai <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                  />
                  {editErrors.end_date && <p className="text-sm text-red-500">{editErrors.end_date}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={formStatus} onValueChange={(value) => setFormStatus(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PLANNED">Direncanakan</SelectItem>
                      <SelectItem value="ONGOING">Berlangsung</SelectItem>
                      <SelectItem value="COMPLETED">Selesai</SelectItem>
                      <SelectItem value="CANCELLED">Dibatalkan</SelectItem>
                    </SelectContent>
                  </Select>
                  {editErrors.status && <p className="text-sm text-red-500">{editErrors.status}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Periode (Sertijab)</label>
                <Select value={formHandoverId === "" ? "__none__" : formHandoverId} onValueChange={(value) => setFormHandoverId(value === "__none__" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih periode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Pilih periode</SelectItem>
                    {activePeriods.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        Periode {p.period_to}
                        {p.status === "ONGOING" ? " (Berjalan)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editErrors.handover_id && <p className="text-sm text-red-500">{editErrors.handover_id}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Divisi Penanggung Jawab</label>
                <Select value={formDivisionId === "" ? "__none__" : formDivisionId} onValueChange={(value) => setFormDivisionId(value === "__none__" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih divisi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Pilih divisi</SelectItem>
                    {divisions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editErrors.division_id && <p className="text-sm text-red-500">{editErrors.division_id}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">URL Proposal</label>
                <Input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={formProposalUrl}
                  onChange={(e) => setFormProposalUrl(e.target.value)}
                />
                {editErrors.proposal_url && <p className="text-sm text-red-500">{editErrors.proposal_url}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">URL LPJ (Laporan Pertanggungjawaban)</label>
                <Input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={formLpjUrl}
                  onChange={(e) => setFormLpjUrl(e.target.value)}
                />
                {editErrors.lpj_url && <p className="text-sm text-red-500">{editErrors.lpj_url}</p>}
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold mb-3">Anggota Tim Program</h3>

                <div className="flex gap-2 mb-3">
                  <div className="flex-1">
                    <Select value={newMemberId === "" ? "__none__" : newMemberId} onValueChange={(value) => setNewMemberId(value === "__none__" ? "" : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih anggota..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Pilih anggota...</SelectItem>
                        {allProfiles
                          .filter((p) => !formMembers.some((m) => m.user_id === p.id))
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.full_name} — {p.nim}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      const profile = allProfiles.find((p) => p.id === newMemberId);
                      if (profile) {
                        setFormMembers([...formMembers, { user_id: profile.id, full_name: profile.full_name, nim: profile.nim }]);
                        setNewMemberId("");
                      }
                    }}
                    disabled={!newMemberId}
                  >
                    Tambah
                  </Button>
                </div>

                {formMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada anggota.</p>
                ) : (
                  <div className="border rounded-md">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-3 py-2 text-left font-medium">No.</th>
                          <th className="px-3 py-2 text-left font-medium">Nama</th>
                          <th className="px-3 py-2 text-left font-medium">NIM</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formMembers.map((m, idx) => (
                          <tr key={m.user_id} className="border-b last:border-b-0">
                            <td className="px-3 py-2">{idx + 1}</td>
                            <td className="px-3 py-2 font-medium">{m.full_name}</td>
                            <td className="px-3 py-2 font-mono text-xs">{m.nim}</td>
                            <td className="px-3 py-2 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-700"
                                onClick={() => setFormMembers(formMembers.filter((fm) => fm.user_id !== m.user_id))}
                              >
                                Hapus
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
                Detail Program
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
                <CardHeader><CardTitle>Informasi Program</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nama Program</span>
                    <span className="font-medium text-right max-w-[60%]">{program.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={statusVariant[program.status]}>{statusLabel[program.status]}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Divisi</span>
                    <span>{program.divisions?.name ?? "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Periode</span>
                    <span>
                      {program.handovers
                        ? `Periode ${program.handovers.period_to}${program.handovers.status === "COMPLETED" ? " (Selesai)" : ""}`
                        : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Anggaran</span>
                    <span className="font-medium">{formatCurrency(budgetTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tanggal Mulai</span>
                    <span>{formatDate(program.start_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tanggal Selesai</span>
                    <span>{formatDate(program.end_date)}</span>
                  </div>
                  <div className="pt-2 border-t">
                    <span className="text-muted-foreground text-sm">Penilaian</span>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full bg-gradient-to-br from-primary to-blue-600 text-primary-foreground shadow-md">
                        <span className="text-base font-bold leading-none">
                          {program.average_score != null ? program.average_score.toFixed(1) : "-"}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Rata-rata semua sesi</span>
                          <span className="text-xs font-medium text-muted-foreground">/ 10</span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-warning to-success transition-all"
                            style={{
                              width: `${Math.min(100, ((program.average_score ?? 0) / 10) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  {program.description && (
                    <div className="pt-2 border-t">
                      <span className="text-muted-foreground text-sm">Deskripsi</span>
                      <p className="text-sm mt-1">{program.description}</p>
                    </div>
                  )}
                  {program.proposal_url && (
                    <div className="pt-2 border-t">
                      <span className="text-muted-foreground text-sm">Proposal</span>
                      <a
                        href={program.proposal_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline block mt-1 break-all"
                      >
                        {program.proposal_url}
                      </a>
                    </div>
                  )}
                  {program.lpj_url && (
                    <div className="pt-2 border-t">
                      <span className="text-muted-foreground text-sm">LPJ</span>
                      <a
                        href={program.lpj_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline block mt-1 break-all"
                      >
                        {program.lpj_url}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Informasi Lainnya</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dibuat pada</span>
                    <span className="text-sm">{formatDate(program.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Terakhir diperbarui</span>
                    <span className="text-sm">{formatDate(program.updated_at)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Anggota Tab */}
          {activeTab === "anggota" && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Anggota Tim Program
                  {members.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({members.length} orang)
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No.</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>NIM</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          Belum ada anggota tim.
                        </TableCell>
                      </TableRow>
                    ) : (
                      members.map((m, idx) => (
                        <TableRow key={m.id}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="font-medium">
                            {m.profiles?.full_name || "-"}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {m.profiles?.nim || "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Anggaran Tab */}
          {activeTab === "anggaran" && (
            <BudgetManager
              type="program"
              entityId={id}
              canEdit={canEdit && !isLocked}
            />
          )}

          {/* Sesi Tab */}
          {activeTab === "sesi" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Sesi Pertemuan</h3>
                {!isLocked && (
                  <Button
                    variant="outline"
                    onClick={() => { setShowCreateForm(!showCreateForm); setSessionMessage(null); }}
                  >
                    {showCreateForm ? "Tutup" : "+ Buat Sesi"}
                  </Button>
                )}
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
                                <button
                                  onClick={() => handleViewAttendees(session.id, session.date)}
                                  className="group inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3 text-sm font-medium shadow-sm transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-md active:scale-95"
                                >
                                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary transition-colors group-hover:bg-primary-foreground group-hover:text-primary">
                                    {session.program_session_attendants?.[0]?.count ?? 0}
                                  </span>
                                  Peserta
                                </button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewQr({ id: session.id, date: session.date })}
                                >
                                  QR Code
                                </Button>
                                {!isLocked && (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteSession(session.id)}
                                  >
                                    Hapus
                                  </Button>
                                )}
              {/* Attendee List Overlay */}
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
                              {canManageScores && !isLocked && (
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

                    {canManageScores && !isLocked && !loadingAttendees && attendees.length > 0 && (
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
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* QR Code Modal */}
              <QrCodeModal
                open={!!qrSession}
                label="Sesi Program Kerja"
                title="QR Code Presensi"
                dateText={qrSession ? formatDate(qrSession.date) : ""}
                url={qrUrl}
                loading={loadingQr}
                onClose={() => { setQrSession(null); setQrUrl(""); }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
