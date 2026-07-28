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
      }
    } catch {
      console.error("Failed to fetch program");
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
    return <div className="text-center py-8 text-muted-foreground">Program tidak ditemukan.</div>;
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
          {/* Info Program */}
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

          {/* Info Tambahan */}
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

      {/* Members Table */}
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
                <TableHead>Peran dalam Program</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
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
                    <TableCell>
                      <Badge variant="outline">{m.role_in_program}</Badge>
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
