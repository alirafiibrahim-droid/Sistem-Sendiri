"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { achievementFormSchema } from "@/lib/validations/achievement";
import type { Achievement } from "@/lib/types/database";
import type { ApiMeta } from "@/lib/types/api";

type FormErrors = Record<string, string>;

interface ParticipantRow {
  user_id: string;
  juara: string;
  keterangan: string;
}

interface MemberOption {
  id: string;
  full_name: string;
  nim: string;
}

const statusVariant: Record<string, "success" | "warning" | "destructive"> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "destructive",
};

const statusLabel: Record<string, string> = {
  APPROVED: "Disetujui",
  PENDING: "Menunggu",
  REJECTED: "Ditolak",
};

const typeLabel: Record<string, string> = {
  ORGANIZATION: "Organisasi",
  INDIVIDUAL: "Individu",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AchievementsPage() {
  const router = useRouter();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 15;

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Members data for dropdown
  const [members, setMembers] = useState<MemberOption[]>([]);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState<"ORGANIZATION" | "INDIVIDUAL">("ORGANIZATION");
  const [formCategory, setFormCategory] = useState("");
  const [formLevel, setFormLevel] = useState("");
  const [formOrganizer, setFormOrganizer] = useState("");
  const [formDate, setFormDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [formProofUrl, setFormProofUrl] = useState("");
  const [formParticipants, setFormParticipants] = useState<ParticipantRow[]>([]);

  const fetchAchievements = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (search) params.set("search", search);
    if (typeFilter) params.set("type", typeFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (levelFilter) params.set("level", levelFilter);

    const res = await fetch(`/api/achievements?${params}`);
    const json = await res.json();

    if (json.success) {
      setAchievements(json.data);
      setMeta(json.meta);
    }
    setLoading(false);
  }, [page, search, typeFilter, statusFilter, levelFilter]);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  const fetchMembers = async () => {
    const res = await fetch("/api/profiles?limit=500");
    const json = await res.json();
    if (json.success) {
      setMembers(
        json.data.map((p: { id: string; full_name: string; nim: string }) => ({
          id: p.id,
          full_name: p.full_name,
          nim: p.nim,
        }))
      );
    }
  };

  const resetForm = () => {
    setFormTitle("");
    setFormDescription("");
    setFormType("ORGANIZATION");
    setFormCategory("");
    setFormLevel("");
    setFormOrganizer("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormProofUrl("");
    setFormParticipants([]);
    setErrors({});
  };

  const openModal = () => {
    resetForm();
    fetchMembers();
    setShowModal(true);
  };

  const addParticipant = () => {
    setFormParticipants([
      ...formParticipants,
      { user_id: "", juara: "", keterangan: "" },
    ]);
  };

  const removeParticipant = (index: number) => {
    setFormParticipants(formParticipants.filter((_, i) => i !== index));
  };

  const updateParticipant = (
    index: number,
    field: keyof ParticipantRow,
    value: string
  ) => {
    const updated = [...formParticipants];
    updated[index] = { ...updated[index], [field]: value };
    setFormParticipants(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = achievementFormSchema.safeParse({
      title: formTitle,
      description: formDescription || undefined,
      type: formType,
      category: formCategory,
      level: formLevel,
      organizer: formOrganizer || undefined,
      achievement_date: formDate,
      proof_url: formProofUrl || undefined,
      participants:
        formParticipants.length > 0
          ? formParticipants.map((p) => ({
              user_id: p.user_id,
              juara: p.juara,
              keterangan: p.keterangan || undefined,
            }))
          : undefined,
    });

    if (!result.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join(".");
        if (!fieldErrors[path]) fieldErrors[path] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setFormLoading(true);

    const res = await fetch("/api/achievements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: formTitle,
        description: formDescription || undefined,
        type: formType,
        category: formCategory,
        level: formLevel,
        organizer: formOrganizer || undefined,
        achievement_date: formDate,
        proof_url: formProofUrl || undefined,
        participants:
          formParticipants.length > 0
            ? formParticipants.map((p) => ({
                user_id: p.user_id,
                juara: p.juara,
                keterangan: p.keterangan || undefined,
              }))
            : undefined,
      }),
    });

    const json = await res.json();

    if (!json.success) {
      setErrors({ _form: json.error?.message || "Gagal menyimpan prestasi." });
      setFormLoading(false);
      return;
    }

    setShowModal(false);
    setFormLoading(false);
    fetchAchievements();
  };

  const totalPages = meta.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Prestasi</h2>
          <p className="text-muted-foreground">Wall of Fame - Prestasi organisasi dan individu</p>
        </div>
        <Button onClick={openModal}>+ Ajukan Prestasi</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Cari prestasi..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <Select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="w-36"
        >
          <option value="">Semua Tipe</option>
          <option value="ORGANIZATION">Organisasi</option>
          <option value="INDIVIDUAL">Individu</option>
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="w-36"
        >
          <option value="">Semua Status</option>
          <option value="APPROVED">Disetujui</option>
          <option value="PENDING">Menunggu</option>
          <option value="REJECTED">Ditolak</option>
        </Select>
        <Select
          value={levelFilter}
          onChange={(e) => {
            setLevelFilter(e.target.value);
            setPage(1);
          }}
          className="w-36"
        >
          <option value="">Semua Level</option>
          <option value="Internasional">Internasional</option>
          <option value="Nasional">Nasional</option>
          <option value="Provinsi">Provinsi</option>
          <option value="Kabupaten/Kota">Kabupaten/Kota</option>
          <option value="Universitas">Universitas</option>
          <option value="Fakultas">Fakultas</option>
        </Select>
      </div>

      {/* Achievement Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {loading ? (
          <div className="col-span-2 text-center py-12 text-muted-foreground">
            Memuat data...
          </div>
        ) : achievements.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-muted-foreground">
            Belum ada prestasi.
          </div>
        ) : (
          achievements.map((a) => (
            <Card key={a.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push(`/achievements/${a.id}`)}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{a.title}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{a.category}</Badge>
                      <Badge variant="outline">{a.level}</Badge>
                      <Badge variant="outline">{typeLabel[a.type] || a.type}</Badge>
                    </div>
                  </div>
                  <Badge variant={statusVariant[a.status] || "secondary"}>
                    {statusLabel[a.status] || a.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {a.description && (
                  <p className="text-sm text-muted-foreground">{a.description}</p>
                )}
                <div className="text-sm text-muted-foreground">
                  {a.organizer && <span>{a.organizer} &middot; </span>}
                  {formatDate(a.achievement_date)}
                </div>
                {a.status === "REJECTED" && a.rejection_reason && (
                  <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
                    <span className="font-medium">Alasan ditolak:</span> {a.rejection_reason}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {meta.total !== undefined && meta.total > limit && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Menampilkan {(page - 1) * limit + 1} -{" "}
            {Math.min(page * limit, meta.total)} dari {meta.total} prestasi
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

      {/* Modal "+ Ajukan Prestasi" */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowModal(false)}
          />

          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold">Ajukan Prestasi</h3>
                  <p className="text-sm text-muted-foreground">
                    Catat prestasi organisasi atau individu
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
                {/* Tipe Prestasi */}
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
                          : "bg-white border-border text-muted-foreground hover:bg-muted"
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
                          : "bg-white border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Individu
                    </button>
                  </div>
                  {errors.type && (
                    <p className="text-sm text-red-500">{errors.type}</p>
                  )}
                </div>

                {/* Judul */}
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="title">
                    Judul Prestasi <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="title"
                    placeholder="Contoh: Juara 1 Debat Nasional"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                  {errors.title && (
                    <p className="text-sm text-red-500">{errors.title}</p>
                  )}
                </div>

                {/* Deskripsi */}
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="description">
                    Deskripsi <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="description"
                    placeholder="Deskripsikan prestasi yang diraih..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  {errors.description && (
                    <p className="text-sm text-red-500">{errors.description}</p>
                  )}
                </div>

                {/* Kategori & Level */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="category">
                      Kategori <span className="text-red-500">*</span>
                    </label>
                    <Select
                      id="category"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                    >
                      <option value="">Pilih kategori</option>
                      <option value="Akademik">Akademik</option>
                      <option value="Olahraga">Olahraga</option>
                      <option value="Seni">Seni</option>
                      <option value="Penelitian">Penelitian</option>
                      <option value="Teknologi">Teknologi</option>
                      <option value="Sosial">Sosial</option>
                      <option value="Lainnya">Lainnya</option>
                    </Select>
                    {errors.category && (
                      <p className="text-sm text-red-500">{errors.category}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="level">
                      Level <span className="text-red-500">*</span>
                    </label>
                    <Select
                      id="level"
                      value={formLevel}
                      onChange={(e) => setFormLevel(e.target.value)}
                    >
                      <option value="">Pilih level</option>
                      <option value="Internasional">Internasional</option>
                      <option value="Nasional">Nasional</option>
                      <option value="Provinsi">Provinsi</option>
                      <option value="Kabupaten/Kota">Kabupaten/Kota</option>
                      <option value="Universitas">Universitas</option>
                      <option value="Fakultas">Fakultas</option>
                    </Select>
                    {errors.level && (
                      <p className="text-sm text-red-500">{errors.level}</p>
                    )}
                  </div>
                </div>

                {/* Penyelenggara & Tanggal */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="organizer">
                      Penyelenggara
                    </label>
                    <Input
                      id="organizer"
                      placeholder="Contoh: Kementerian Pendidikan"
                      value={formOrganizer}
                      onChange={(e) => setFormOrganizer(e.target.value)}
                    />
                    {errors.organizer && (
                      <p className="text-sm text-red-500">{errors.organizer}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="achievement_date">
                      Tanggal <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="achievement_date"
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                    />
                    {errors.achievement_date && (
                      <p className="text-sm text-red-500">{errors.achievement_date}</p>
                    )}
                  </div>
                </div>

                {/* URL Bukti */}
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="proof_url">
                    URL Bukti (Opsional)
                  </label>
                  <Input
                    id="proof_url"
                    type="url"
                    placeholder="https://..."
                    value={formProofUrl}
                    onChange={(e) => setFormProofUrl(e.target.value)}
                  />
                  {errors.proof_url && (
                    <p className="text-sm text-red-500">{errors.proof_url}</p>
                  )}
                </div>

                {/* Anggota Berprestasi */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">
                      Anggota Berprestasi
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addParticipant}
                    >
                      + Tambah Anggota
                    </Button>
                  </div>

                  {formParticipants.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Belum ada anggota ditambahkan. Klik &quot;+ Tambah Anggota&quot; untuk menambahkan.
                    </p>
                  )}

                  {formParticipants.map((p, idx) => (
                    <div
                      key={idx}
                      className="flex gap-2 items-start p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex-1 space-y-2">
                        <Select
                          value={p.user_id}
                          onChange={(e) =>
                            updateParticipant(idx, "user_id", e.target.value)
                          }
                        >
                          <option value="">Pilih anggota</option>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.full_name} ({m.nim})
                            </option>
                          ))}
                        </Select>
                        {errors[`participants.${idx}.user_id`] && (
                          <p className="text-xs text-red-500">
                            {errors[`participants.${idx}.user_id`]}
                          </p>
                        )}

                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Input
                              placeholder="Juara (contoh: Juara 1)"
                              value={p.juara}
                              onChange={(e) =>
                                updateParticipant(idx, "juara", e.target.value)
                              }
                            />
                            {errors[`participants.${idx}.juara`] && (
                              <p className="text-xs text-red-500">
                                {errors[`participants.${idx}.juara`]}
                              </p>
                            )}
                          </div>
                          <div className="flex-1">
                            <Input
                              placeholder="Keterangan (opsional)"
                              value={p.keterangan}
                              onChange={(e) =>
                                updateParticipant(idx, "keterangan", e.target.value)
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeParticipant(idx)}
                        className="p-1.5 hover:bg-destructive/10 rounded-lg text-destructive mt-1"
                      >
                        <svg
                          className="w-4 h-4"
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
                  ))}
                </div>

                {errors._form && (
                  <p className="text-sm text-red-500 text-center">
                    {errors._form}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={formLoading} className="flex-1">
                    {formLoading ? "Menyimpan..." : "Ajukan Prestasi"}
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
