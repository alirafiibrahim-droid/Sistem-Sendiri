"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { letterFormSchema } from "@/lib/validations/letter";
import { createSupabaseClient } from "@/lib/supabase/client";
import type { LetterWithCreator } from "@/lib/types/database";
import type { ApiMeta } from "@/lib/types/api";

type FormErrors = Record<string, string>;

interface HandoverOption {
  id: string;
  period_from: string;
  period_to: string;
  status: string;
}

const typeVariant: Record<string, "default" | "secondary"> = {
  INCOMING: "default",
  OUTGOING: "secondary",
};

const typeLabel: Record<string, string> = {
  INCOMING: "Masuk",
  OUTGOING: "Keluar",
};

const classificationVariant: Record<string, "warning" | "outline"> = {
  CONFIDENTIAL: "warning",
  PUBLIC: "outline",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function LettersPage() {
  const [letters, setLetters] = useState<LetterWithCreator[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [page, setPage] = useState(1);
  const limit = 15;

  const [userRole, setUserRole] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  // Detail state
  const [detailLetter, setDetailLetter] = useState<LetterWithCreator | null>(null);

  // Form state
  const [formType, setFormType] = useState<"INCOMING" | "OUTGOING">("INCOMING");
  const [formTitle, setFormTitle] = useState("");
  const [formSender, setFormSender] = useState("");
  const [formDate, setFormDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [formClassification, setFormClassification] = useState("PUBLIC");
  const [formDocumentUrl, setFormDocumentUrl] = useState("");

  // Periode Berjalan (Sertijab aktif)
  const [handovers, setHandovers] = useState<HandoverOption[]>([]);
  const [formHandoverId, setFormHandoverId] = useState("");

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchLetters = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (search) params.set("search", search);
    if (typeFilter) params.set("type", typeFilter);
    if (filterStartDate) params.set("start_date", filterStartDate);
    if (filterEndDate) params.set("end_date", filterEndDate);

    const res = await fetch(`/api/letters?${params}`);
    const json = await res.json();

    if (json.success) {
      setLetters(json.data);
      setMeta(json.meta);
    }
    setLoading(false);
  }, [page, search, typeFilter, filterStartDate, filterEndDate]);

  useEffect(() => {
    fetchLetters();
  }, [fetchLetters]);

  useEffect(() => {
    const supabase = createSupabaseClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            if (data) setUserRole(data.role);
          });
      }
    });
  }, []);

  const canEdit =
    userRole === "ADMIN" || userRole === "PENGURUS_INTI" || userRole === "KABID";

  const resetForm = () => {
    setEditingId(null);
    setFormType("INCOMING");
    setFormTitle("");
    setFormSender("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormClassification("PUBLIC");
    setFormDocumentUrl("");
    setFormHandoverId("");
    setErrors({});
  };

  const fetchActivePeriods = async (): Promise<HandoverOption[]> => {
    try {
      const res = await fetch("/api/handovers/active");
      const json = await res.json();
      if (json.success) {
        setHandovers(json.data);
        return json.data as HandoverOption[];
      }
    } catch {}
    return [];
  };

  const openModal = async () => {
    resetForm();
    const list = await fetchActivePeriods();
    if (list.length > 0) setFormHandoverId(list[0].id);
    setShowModal(true);
  };

  const openEdit = async (l: LetterWithCreator) => {
    setEditingId(l.id);
    setFormType(l.type);
    setFormTitle(l.title);
    setFormSender(l.sender);
    setFormDate(l.date_received_sent.slice(0, 10));
    setFormClassification(l.classification);
    setFormDocumentUrl(l.document_url || "");
    setFormHandoverId(l.handover_id || "");
    const list = await fetchActivePeriods();
    if (l.handover_id && !list.some((h) => h.id === l.handover_id) && l.handovers) {
      const current = l.handovers;
      setHandovers((prev) => [{ ...current, status: current.status }, ...prev]);
    }
    setErrors({});
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = letterFormSchema.safeParse({
      type: formType,
      title: formTitle,
      sender: formSender,
      date_received_sent: formDate,
      classification: formClassification,
      document_url: formDocumentUrl,
      handover_id: formHandoverId || undefined,
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

    const payload = {
      type: formType,
      title: formTitle,
      sender: formSender,
      date_received_sent: formDate,
      classification: formClassification,
      document_url: formDocumentUrl,
      handover_id: formHandoverId || undefined,
    };

    const res = await fetch(editingId ? `/api/letters/${editingId}` : "/api/letters", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (!json.success) {
      setErrors({ _form: json.error?.message || "Gagal menyimpan surat." });
      setFormLoading(false);
      return;
    }

    setShowModal(false);
    setFormLoading(false);
    fetchLetters();
  };

  const handleDelete = async (id: string) => {
    setDeleteLoading(true);
    const res = await fetch(`/api/letters/${id}`, { method: "DELETE" });
    const json = await res.json();

    if (!json.success) {
      alert(json.error?.message || "Gagal menghapus surat.");
      setDeleteLoading(false);
      return;
    }

    setDeleteId(null);
    setDeleteLoading(false);
    fetchLetters();
  };

  const totalPages = meta.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Persuratan</h2>
          <p className="text-muted-foreground">Arsip surat masuk dan keluar</p>
        </div>
        <Button onClick={openModal}>+ Arsipkan Surat</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Input
          placeholder="Cari surat..."
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
          className="w-48"
        >
          <option value="">Semua Tipe</option>
          <option value="INCOMING">Surat Masuk</option>
          <option value="OUTGOING">Surat Keluar</option>
        </Select>
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

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Referensi</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Judul</TableHead>
                <TableHead>Pengirim/Penerima</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Klasifikasi</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead>Dicatat Oleh</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : letters.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Belum ada surat.
                  </TableCell>
                </TableRow>
              ) : (
                letters.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-sm">{l.reference_number}</TableCell>
                    <TableCell>
                      <Badge variant={typeVariant[l.type]}>{typeLabel[l.type]}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{l.title}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{l.sender}</TableCell>
                    <TableCell className="text-sm">{formatDate(l.date_received_sent)}</TableCell>
                    <TableCell>
                      <Badge variant={classificationVariant[l.classification]}>
                        {l.classification}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {l.handovers ? (
                        <span>
                          Periode {l.handovers.period_to}
                          {l.handovers.status === "COMPLETED" && (
                            <span className="text-xs text-muted-foreground"> (Selesai)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {l.profiles?.full_name || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailLetter(l)}
                        >
                          Detail
                        </Button>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(l)}
                          >
                            Edit
                          </Button>
                        )}
                        {canEdit && (
                          <div className="relative">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDeleteId(deleteId === l.id ? null : l.id)
                              }
                            >
                              Hapus
                            </Button>
                            {deleteId === l.id && (
                              <div className="absolute right-0 top-full mt-1 z-10 bg-white border border-border rounded-lg shadow-lg p-3 min-w-40">
                                <p className="text-xs text-muted-foreground mb-2">
                                  Yakin hapus surat ini?
                                </p>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={deleteLoading}
                                    onClick={() => handleDelete(l.id)}
                                  >
                                    {deleteLoading ? "..." : "Ya, Hapus"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setDeleteId(null)}
                                  >
                                    Batal
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Pagination */}
        {meta.total !== undefined && meta.total > 0 && (
          <div className="p-4 border-t border-border flex items-center justify-between bg-muted/50">
            <p className="text-xs text-muted-foreground">
              Menampilkan {(page - 1) * limit + 1} -{" "}
              {Math.min(page * limit, meta.total)} dari {meta.total} surat
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

      {/* Modal "+ Arsipkan Surat" */}
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
                  <h3 className="text-lg font-bold">
                    {editingId ? "Edit Surat" : "Arsipkan Surat"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {editingId
                      ? "Perbarui data arsip surat"
                      : "Tambah arsip surat masuk atau keluar"}
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
                {/* Tipe Surat */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Tipe Surat <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setFormType("INCOMING")}
                      className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors ${
                        formType === "INCOMING"
                          ? "bg-blue-50 border-blue-300 text-blue-700"
                          : "bg-white border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Surat Masuk
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType("OUTGOING")}
                      className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors ${
                        formType === "OUTGOING"
                          ? "bg-purple-50 border-purple-300 text-purple-700"
                          : "bg-white border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Surat Keluar
                    </button>
                  </div>
                  {errors.type && (
                    <p className="text-sm text-red-500">{errors.type}</p>
                  )}
                </div>

                {/* Judul Surat */}
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="title">
                    Judul Surat <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="title"
                    placeholder="Contoh: Undangan Rapat Kerja"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                  {errors.title && (
                    <p className="text-sm text-red-500">{errors.title}</p>
                  )}
                </div>

                {/* Pengirim/Penerima & Tanggal */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="sender">
                      Pengirim/Penerima <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="sender"
                      placeholder={formType === "INCOMING" ? "Nama pengirim" : "Nama penerima"}
                      value={formSender}
                      onChange={(e) => setFormSender(e.target.value)}
                    />
                    {errors.sender && (
                      <p className="text-sm text-red-500">{errors.sender}</p>
                    )}
                  </div>
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
                    {errors.date_received_sent && (
                      <p className="text-sm text-red-500">{errors.date_received_sent}</p>
                    )}
                  </div>
                </div>

                {/* Klasifikasi */}
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="classification">
                    Klasifikasi
                  </label>
                  <Select
                    id="classification"
                    value={formClassification}
                    onChange={(e) => setFormClassification(e.target.value)}
                  >
                    <option value="PUBLIC">Publik</option>
                    <option value="CONFIDENTIAL">Rahasia</option>
                  </Select>
                  {errors.classification && (
                    <p className="text-sm text-red-500">{errors.classification}</p>
                  )}
                </div>

                {/* Periode Berjalan */}
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="handover_id">
                    Periode Berjalan
                  </label>
                  <Select
                    id="handover_id"
                    value={formHandoverId}
                    onChange={(e) => setFormHandoverId(e.target.value)}
                  >
                    <option value="">Pilih periode</option>
                    {handovers.map((h) => (
                      <option key={h.id} value={h.id}>
                        Periode {h.period_to}
                        {h.status === "ONGOING" ? " (Berjalan)" : ""}
                      </option>
                    ))}
                  </Select>
                  {handovers.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Belum ada periode Sertijab yang berjalan.
                    </p>
                  )}
                  {errors.handover_id && (
                    <p className="text-sm text-red-500">{errors.handover_id}</p>
                  )}
                </div>

                {/* URL Dokumen */}
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="document_url">
                    URL Dokumen (Opsional)
                  </label>
                  <Input
                    id="document_url"
                    type="url"
                    placeholder="https://..."
                    value={formDocumentUrl}
                    onChange={(e) => setFormDocumentUrl(e.target.value)}
                  />
                  {errors.document_url && (
                    <p className="text-sm text-red-500">{errors.document_url}</p>
                  )}
                </div>

                {errors._form && (
                  <p className="text-sm text-red-500 text-center">
                    {errors._form}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={formLoading} className="flex-1">
                    {formLoading
                      ? "Menyimpan..."
                      : editingId
                      ? "Simpan Perubahan"
                      : "Simpan Surat"}
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

      {/* Modal Detail Surat */}
      {detailLetter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDetailLetter(null)}
          />

          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold">Detail Surat</h3>
                  <p className="font-mono text-xs text-muted-foreground">
                    {detailLetter.reference_number}
                  </p>
                </div>
                <button
                  onClick={() => setDetailLetter(null)}
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

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant={typeVariant[detailLetter.type]}>
                    {typeLabel[detailLetter.type]}
                  </Badge>
                  <Badge variant={classificationVariant[detailLetter.classification]}>
                    {detailLetter.classification === "CONFIDENTIAL"
                      ? "Rahasia"
                      : "Publik"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Judul Surat</p>
                    <p className="text-sm font-semibold">{detailLetter.title}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Pengirim/Penerima
                    </p>
                    <p className="text-sm">{detailLetter.sender}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Tanggal</p>
                    <p className="text-sm">{formatDate(detailLetter.date_received_sent)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Dicatat Oleh
                    </p>
                    <p className="text-sm">
                      {detailLetter.profiles?.full_name || "-"}
                    </p>
                  </div>
                </div>

                {detailLetter.handovers && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Periode</p>
                    <p className="text-sm">
                      Periode {detailLetter.handovers.period_to}
                      {detailLetter.handovers.status === "COMPLETED"
                        ? " (Selesai)"
                        : ""}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Dokumen</p>
                  {detailLetter.document_url ? (
                    <a
                      href={detailLetter.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline break-all"
                    >
                      Buka dokumen &rarr;
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">Tidak ada dokumen.</p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Dicatat Pada
                  </p>
                  <p className="text-sm">
                    {new Date(detailLetter.created_at).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                {canEdit && (
                  <Button
                    className="flex-1"
                    onClick={() => {
                      openEdit(detailLetter);
                      setDetailLetter(null);
                    }}
                  >
                    Edit Surat
                  </Button>
                )}
                <Button
                  variant="outline"
                  className={canEdit ? "" : "flex-1"}
                  onClick={() => setDetailLetter(null)}
                >
                  Tutup
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
