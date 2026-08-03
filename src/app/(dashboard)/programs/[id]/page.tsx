"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { programUpdateSchema } from "@/lib/validations/program";
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
    month: "long",
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
  const [formBudget, setFormBudget] = useState("");
  const [formStatus, setFormStatus] = useState<string>("PLANNED");
  const [formDivisionId, setFormDivisionId] = useState("");
  const [formProposalUrl, setFormProposalUrl] = useState("");
  const [formLpjUrl, setFormLpjUrl] = useState("");

  const [deleteLoading, setDeleteLoading] = useState(false);

  const [formMembers, setFormMembers] = useState<{ user_id: string; full_name: string; nim: string }[]>([]);
  const [allProfiles, setAllProfiles] = useState<{ id: string; full_name: string; nim: string }[]>([]);
  const [newMemberId, setNewMemberId] = useState("");

  const [activeTab, setActiveTab] = useState<"detail" | "anggota" | "sesi">("detail");

  const [sessions, setSessions] = useState<Array<{id: string; date: string; title: string | null; created_at: string; program_session_attendants: Array<{count: number}>}>>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [submittingSessions, setSubmittingSessions] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sessionDateInput, setSessionDateInput] = useState(new Date().toISOString().split("T")[0]);
  const [sessionDateList, setSessionDateList] = useState<string[]>([]);
  const [sessionMessage, setSessionMessage] = useState<{type: "success" | "error"; text: string} | null>(null);

  const [qrSession, setQrSession] = useState<{id: string; date: string} | null>(null);
  const [qrUrl, setQrUrl] = useState("");
  const [loadingQr, setLoadingQr] = useState(false);

  const [attendeeSessionId, setAttendeeSessionId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Array<{id: string; method: string; scanned_at: string | null; created_at: string; profiles: {id: string; full_name: string; nim: string; avatar_url: string | null} | null}>>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);

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

  useEffect(() => {
    supabase
      .from("divisions")
      .select("id, name, description, created_at, updated_at")
      .order("name")
      .then(({ data }) => {
        if (data) setDivisions(data);
      });
  }, [supabase]);

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
        body: JSON.stringify({ dates: sessionDateList }),
      });
      const json = await res.json();
      if (json.success) {
        setSessionMessage({ type: "success", text: "Sesi berhasil dibuat!" });
        setSessionDateList([]);
        setSessionDateInput(new Date().toISOString().split("T")[0]);
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

  const handleViewAttendees = async (sessionId: string) => {
    setAttendeeSessionId(sessionId);
    setAttendees([]);
    setLoadingAttendees(true);
    try {
      const res = await fetch(`/api/programs/${id}/sessions/${sessionId}/attendance`);
      const json = await res.json();
      if (json.success) setAttendees(json.data);
    } catch {}
    setLoadingAttendees(false);
  };

  const openEdit = () => {
    if (!program) return;
    setFormName(program.name);
    setFormDescription(program.description || "");
    setFormStartDate(program.start_date);
    setFormEndDate(program.end_date);
    setFormBudget(String(program.budget_estimate));
    setFormStatus(program.status);
    setFormDivisionId(program.division_id || "");
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
      budget_estimate: formBudget ? Number(formBudget) : undefined,
      status: formStatus,
      division_id: formDivisionId || undefined,
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
        budget_estimate: formBudget ? Number(formBudget) : 0,
        status: formStatus,
        division_id: formDivisionId || null,
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
  const canEdit = userRole === "ADMIN" || userRole === "PENGURUS_INTI" || userRole === "KABID" || isCreator;
  const canDelete = userRole === "ADMIN";

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
          {canEdit && !editing && (
            <Button onClick={openEdit}>Edit Program</Button>
          )}
          {canDelete && (
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? "Menghapus..." : "Hapus"}
            </Button>
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
                  <label className="text-sm font-medium">
                    Estimasi Anggaran (Rp) <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    placeholder="Minimal Rp 1.000"
                    min="0"
                    value={formBudget}
                    onChange={(e) => setFormBudget(e.target.value)}
                  />
                  {editErrors.budget_estimate && <p className="text-sm text-red-500">{editErrors.budget_estimate}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={formStatus} onChange={(e) => setFormStatus(e.target.value)}>
                    <option value="PLANNED">Direncanakan</option>
                    <option value="ONGOING">Berlangsung</option>
                    <option value="COMPLETED">Selesai</option>
                    <option value="CANCELLED">Dibatalkan</option>
                  </Select>
                  {editErrors.status && <p className="text-sm text-red-500">{editErrors.status}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Divisi Penanggung Jawab</label>
                <Select value={formDivisionId} onChange={(e) => setFormDivisionId(e.target.value)}>
                  <option value="">Pilih divisi</option>
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
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
                    <Select value={newMemberId} onChange={(e) => setNewMemberId(e.target.value)}>
                      <option value="">Pilih anggota...</option>
                      {allProfiles
                        .filter((p) => !formMembers.some((m) => m.user_id === p.id))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.full_name} — {p.nim}
                          </option>
                        ))}
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
                    <span className="text-muted-foreground">Anggaran</span>
                    <span className="font-medium">{formatCurrency(program.budget_estimate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tanggal Mulai</span>
                    <span>{formatDate(program.start_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tanggal Selesai</span>
                    <span>{formatDate(program.end_date)}</span>
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
                          <TableHead>Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sessions.map((session) => (
                          <TableRow key={session.id}>
                            <TableCell>{formatDate(session.date)}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewAttendees(session.id)}
                                >
                                  {session.program_session_attendants?.[0]?.count ?? 0} Peserta
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewQr({ id: session.id, date: session.date })}
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
              {/* Attendee List Modal */}
              {attendeeSessionId && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                  <Card className="w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
                    <CardHeader>
                      <CardTitle>Daftar Hadir</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingAttendees ? (
                        <p className="text-center py-8 text-muted-foreground">Memuat...</p>
                      ) : attendees.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground">Belum ada peserta yang hadir.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nama</TableHead>
                              <TableHead>NIM</TableHead>
                              <TableHead>Metode</TableHead>
                              <TableHead>Waktu</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {attendees.map((a) => (
                              <TableRow key={a.id}>
                                <TableCell className="font-medium">
                                  {a.profiles?.full_name || "Unknown"}
                                </TableCell>
                                <TableCell>{a.profiles?.nim || "-"}</TableCell>
                                <TableCell>
                                  <Badge variant={a.method === "QR" ? "default" : "secondary"}>
                                    {a.method}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {new Date(a.created_at).toLocaleString("id-ID")}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                      <Button
                        variant="outline"
                        className="w-full mt-4"
                        onClick={() => { setAttendeeSessionId(null); setAttendees([]); }}
                      >
                        Tutup
                      </Button>
                    </CardContent>
                  </Card>
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
              {qrSession && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                  <Card className="w-full max-w-md mx-4">
                    <CardHeader>
                      <CardTitle>QR Code Presensi</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Tanggal</p>
                        <p className="font-medium">{formatDate(qrSession.date)}</p>
                      </div>
                      <div className="text-center py-4">
                        {loadingQr ? (
                          <p className="text-muted-foreground">Memuat QR Code...</p>
                        ) : (
                          <>
                            <p className="text-sm text-muted-foreground mb-2">
                              Arahkan kamera ke QR Code di bawah
                            </p>
                            <div className="bg-white p-4 rounded-lg inline-block max-w-full overflow-hidden">
                              <p className="text-xs font-mono break-all">{qrUrl || "Tidak ada URL QR."}</p>
                            </div>
                          </>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => { setQrSession(null); setQrUrl(""); }}
                      >
                        Tutup
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
