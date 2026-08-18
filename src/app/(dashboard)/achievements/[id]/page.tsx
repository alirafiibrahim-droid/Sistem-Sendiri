"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { achievementFormSchema } from "@/lib/validations/achievement";
import { JUARA_OPTIONS, JUARA_LABELS } from "@/lib/achievement";
import type {
  AchievementWithParticipants,
  AchievementParticipantWithProfile,
  Profile,
} from "@/lib/types/database";

type FormErrors = Record<string, string>;

const statusVariant: Record<string, "success" | "warning" | "destructive"> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "destructive",
};

const statusLabel: Record<string, string> = {
  APPROVED: "Disetujui",
  PENDING: "Menunggu Verifikasi",
  REJECTED: "Ditolak",
};

const typeLabel: Record<string, string> = {
  ORGANIZATION: "Organisasi",
  INDIVIDUAL: "Individu",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function AchievementDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const supabase = createSupabaseClient();

  const [achievement, setAchievement] = useState<AchievementWithParticipants | null>(null);
  const [participants, setParticipants] = useState<AchievementParticipantWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editErrors, setEditErrors] = useState<FormErrors>({});

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState<"ORGANIZATION" | "INDIVIDUAL">("ORGANIZATION");
  const [formJuara, setFormJuara] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formLevel, setFormLevel] = useState("");
  const [formOrganizer, setFormOrganizer] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formProofUrl, setFormProofUrl] = useState("");

  // Verify state
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Delete state
  const [deleteLoading, setDeleteLoading] = useState(false);

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
      const res = await fetch(`/api/achievements/${id}`);
      const json = await res.json();
      if (json.success) {
        setAchievement(json.data);
        setParticipants(json.data.achievement_participants || []);
      }
    } catch {
      console.error("Failed to fetch achievement");
    }

    setLoading(false);
  }, [supabase, id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openEdit = () => {
    if (!achievement) return;
    setFormTitle(achievement.title);
    setFormDescription(achievement.description || "");
    setFormType(achievement.type);
    setFormJuara(achievement.juara || "");
    setFormCategory(achievement.category);
    setFormLevel(achievement.level);
    setFormOrganizer(achievement.organizer || "");
    setFormDate(achievement.achievement_date);
    setFormProofUrl(achievement.proof_url || "");
    setEditErrors({});
    setEditing(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = achievementFormSchema.safeParse({
      title: formTitle,
      description: formDescription || undefined,
      type: formType,
      juara: formType === "ORGANIZATION" ? formJuara : undefined,
      category: formCategory,
      level: formLevel,
      organizer: formOrganizer || undefined,
      achievement_date: formDate,
      proof_url: formProofUrl || undefined,
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

    const res = await fetch(`/api/achievements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: formTitle,
        description: formDescription || null,
        type: formType,
        juara: formType === "ORGANIZATION" ? (formJuara || null) : null,
        category: formCategory,
        level: formLevel,
        organizer: formOrganizer || null,
        achievement_date: formDate,
        proof_url: formProofUrl || null,
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

  const handleVerify = async (status: "APPROVED" | "REJECTED") => {
    if (status === "REJECTED" && !rejectReason.trim()) {
      setEditErrors({ rejection_reason: "Alasan penolakan wajib diisi." });
      return;
    }

    setVerifyLoading(true);
    setEditErrors({});

    const res = await fetch(`/api/achievements/${id}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        rejection_reason: status === "REJECTED" ? rejectReason : undefined,
      }),
    });

    const json = await res.json();

    if (!json.success) {
      setEditErrors({ _form: json.error?.message || "Gagal memverifikasi." });
      setVerifyLoading(false);
      return;
    }

    setVerifyLoading(false);
    setShowRejectForm(false);
    setRejectReason("");
    fetchData();
  };

  const handleDelete = async () => {
    if (!confirm("Yakin ingin menghapus prestasi ini? Tindakan ini tidak dapat dibatalkan.")) return;

    setDeleteLoading(true);
    const res = await fetch(`/api/achievements/${id}`, { method: "DELETE" });
    const json = await res.json();

    if (json.success) {
      router.push("/achievements");
    }
    setDeleteLoading(false);
  };

  const isCreator = achievement?.created_by === userId;
  const canEdit = ["ADMIN", "PEMBINA", "WAKIL_KETUA", "KETUA_UMUM"].includes(userRole) || isCreator;
  const canVerify = userRole === "ADMIN" || userRole === "PENGURUS_INTI";
  const canDelete = userRole === "ADMIN";

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Memuat data...</div>;
  }

  if (!achievement) {
    return <div className="text-center py-8 text-muted-foreground">Prestasi tidak ditemukan.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Detail Prestasi</h2>
          <p className="text-muted-foreground">Lihat, edit, dan verifikasi data prestasi</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>Kembali</Button>
          {canEdit && !editing && achievement.status !== "APPROVED" && (
            <Button onClick={openEdit}>Edit Prestasi</Button>
          )}
          {canDelete && (
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? "Menghapus..." : "Hapus"}
            </Button>
          )}
        </div>
      </div>

      {/* Status Banner */}
      <div className={`flex items-center gap-3 rounded-xl p-4 ${
        achievement.status === "APPROVED"
          ? "bg-green-50 border border-green-200"
          : achievement.status === "REJECTED"
          ? "bg-red-50 border border-red-200"
          : "bg-yellow-50 border border-yellow-200"
      }`}>
        <Badge variant={statusVariant[achievement.status]} className="text-sm">
          {statusLabel[achievement.status]}
        </Badge>
        {achievement.status === "REJECTED" && achievement.rejection_reason && (
          <p className="text-sm text-red-700">
            <span className="font-medium">Alasan ditolak:</span> {achievement.rejection_reason}
          </p>
        )}
        {achievement.status === "PENDING" && canVerify && (
          <p className="text-sm text-yellow-700">Menunggu verifikasi Anda.</p>
        )}
      </div>

      {/* Edit Form */}
      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit Prestasi</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Tipe Prestasi <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFormType("ORGANIZATION")}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors ${
                      formType === "ORGANIZATION"
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-card border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Organisasi
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType("INDIVIDUAL")}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors ${
                      formType === "INDIVIDUAL"
                        ? "bg-purple-50 border-purple-300 text-purple-700"
                        : "bg-card border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Individu
                  </button>
                </div>
                {editErrors.type && <p className="text-sm text-red-500">{editErrors.type}</p>}
              </div>

              {formType === "ORGANIZATION" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Juara <span className="text-red-500">*</span>
                  </label>
                  <Select value={formJuara} onValueChange={(value) => setFormJuara(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih juara" />
                    </SelectTrigger>
                    <SelectContent>
                      {JUARA_OPTIONS.map((j) => (
                        <SelectItem key={j.value} value={j.value}>
                          {j.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editErrors.juara && <p className="text-sm text-red-500">{editErrors.juara}</p>}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Judul Prestasi <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="Contoh: Juara 1 Debat Nasional"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
                {editErrors.title && <p className="text-sm text-red-500">{editErrors.title}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Deskripsi</label>
                <textarea
                  placeholder="Deskripsikan prestasi yang diraih..."
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
                    Kategori <span className="text-red-500">*</span>
                  </label>
                  <Select value={formCategory} onValueChange={(value) => setFormCategory(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Akademik">Akademik</SelectItem>
                      <SelectItem value="Olahraga">Olahraga</SelectItem>
                      <SelectItem value="Seni">Seni</SelectItem>
                      <SelectItem value="Penelitian">Penelitian</SelectItem>
                      <SelectItem value="Teknologi">Teknologi</SelectItem>
                      <SelectItem value="Sosial">Sosial</SelectItem>
                      <SelectItem value="Lainnya">Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                  {editErrors.category && <p className="text-sm text-red-500">{editErrors.category}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Level <span className="text-red-500">*</span>
                  </label>
                  <Select value={formLevel} onValueChange={(value) => setFormLevel(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Internasional">Internasional</SelectItem>
                      <SelectItem value="Nasional">Nasional</SelectItem>
                      <SelectItem value="Provinsi">Provinsi</SelectItem>
                      <SelectItem value="Kabupaten/Kota">Kabupaten/Kota</SelectItem>
                      <SelectItem value="Universitas">Universitas</SelectItem>
                      <SelectItem value="Fakultas">Fakultas</SelectItem>
                    </SelectContent>
                  </Select>
                  {editErrors.level && <p className="text-sm text-red-500">{editErrors.level}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Penyelenggara</label>
                  <Input
                    placeholder="Contoh: Kementerian Pendidikan"
                    value={formOrganizer}
                    onChange={(e) => setFormOrganizer(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Tanggal <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                  />
                  {editErrors.achievement_date && <p className="text-sm text-red-500">{editErrors.achievement_date}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">URL Bukti (Opsional)</label>
                <Input
                  type="url"
                  placeholder="https://..."
                  value={formProofUrl}
                  onChange={(e) => setFormProofUrl(e.target.value)}
                />
                {editErrors.proof_url && <p className="text-sm text-red-500">{editErrors.proof_url}</p>}
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
        <div className="grid grid-cols-2 gap-6">
          {/* Info Prestasi */}
          <Card>
            <CardHeader><CardTitle>Informasi Prestasi</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Judul</span>
                <span className="font-medium text-right max-w-[60%]">{achievement.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipe</span>
                <Badge variant="outline">{typeLabel[achievement.type]}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kategori</span>
                <Badge variant="outline">{achievement.category}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Level</span>
                <Badge variant="outline">{achievement.level}</Badge>
              </div>
              {achievement.juara && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Juara</span>
                  <Badge variant="success">{JUARA_LABELS[achievement.juara] || achievement.juara}</Badge>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Penyelenggara</span>
                <span>{achievement.organizer || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tanggal</span>
                <span>{formatDate(achievement.achievement_date)}</span>
              </div>
              {achievement.handovers && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Periode</span>
                  <span>Periode {achievement.handovers.period_to}</span>
                </div>
              )}
              {achievement.description && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground text-sm">Deskripsi</span>
                  <p className="text-sm mt-1">{achievement.description}</p>
                </div>
              )}
              {achievement.proof_url && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground text-sm">Bukti</span>
                  <a
                    href={achievement.proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline block mt-1 break-all"
                  >
                    {achievement.proof_url}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Tambahan & Verifikasi */}
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Informasi Lainnya</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={statusVariant[achievement.status]}>
                    {statusLabel[achievement.status]}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dibuat pada</span>
                  <span className="text-sm">{formatDate(achievement.created_at)}</span>
                </div>
                {achievement.profiles && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Diajukan oleh</span>
                    <span>{(achievement.profiles as Pick<Profile, "id" | "full_name">).full_name}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Verify Section */}
            {canVerify && achievement.status === "PENDING" && (
              <Card>
                <CardHeader><CardTitle>Verifikasi Prestasi</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Tinjau pengajuan prestasi ini dan berikan keputusan.
                  </p>

                  {showRejectForm ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Alasan Penolakan</label>
                        <textarea
                          placeholder="Jelaskan alasan penolakan..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          rows={3}
                          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                        {editErrors.rejection_reason && (
                          <p className="text-sm text-red-500">{editErrors.rejection_reason}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          onClick={() => handleVerify("REJECTED")}
                          disabled={verifyLoading}
                        >
                          {verifyLoading ? "Memproses..." : "Tolak"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowRejectForm(false);
                            setRejectReason("");
                            setEditErrors({});
                          }}
                        >
                          Batal
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleVerify("APPROVED")}
                        disabled={verifyLoading}
                        className="flex-1"
                      >
                        {verifyLoading ? "Memproses..." : "Setujui"}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => setShowRejectForm(true)}
                        disabled={verifyLoading}
                        className="flex-1"
                      >
                        Tolak
                      </Button>
                    </div>
                  )}

                  {editErrors._form && (
                    <p className="text-sm text-red-500 text-center">{editErrors._form}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Participants Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Anggota Berprestasi
            {participants.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({participants.length} orang)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No.</TableHead>
                <TableHead>Nama Anggota</TableHead>
                <TableHead>NIM</TableHead>
                {achievement.type === "INDIVIDUAL" && <TableHead>Juara</TableHead>}
                <TableHead>Keterangan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={achievement.type === "INDIVIDUAL" ? 5 : 4}
                    className="text-center text-muted-foreground py-8"
                  >
                    Tidak ada anggota berprestasi terdaftar.
                  </TableCell>
                </TableRow>
              ) : (
                participants.map((p, idx) => (
                  <TableRow key={p.id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="font-medium">
                      {p.profiles?.full_name || "-"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {p.profiles?.nim || "-"}
                    </TableCell>
                    {achievement.type === "INDIVIDUAL" && (
                      <TableCell>
                        <Badge variant="success">{JUARA_LABELS[p.juara] || p.juara || "-"}</Badge>
                      </TableCell>
                    )}
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {p.keterangan || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
