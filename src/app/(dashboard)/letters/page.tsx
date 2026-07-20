"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { letterFormSchema } from "@/lib/validations/letter";
import type { LetterWithCreator } from "@/lib/types/database";
import type { ApiMeta } from "@/lib/types/api";

type FormErrors = Record<string, string>;

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
    month: "short",
    year: "numeric",
  });
}

export default function LettersPage() {
  const [letters, setLetters] = useState<LetterWithCreator[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 15;

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Form state
  const [formType, setFormType] = useState<"INCOMING" | "OUTGOING">("INCOMING");
  const [formTitle, setFormTitle] = useState("");
  const [formSender, setFormSender] = useState("");
  const [formDate, setFormDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [formClassification, setFormClassification] = useState("PUBLIC");
  const [formDocumentUrl, setFormDocumentUrl] = useState("");

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

    const res = await fetch(`/api/letters?${params}`);
    const json = await res.json();

    if (json.success) {
      setLetters(json.data);
      setMeta(json.meta);
    }
    setLoading(false);
  }, [page, search, typeFilter]);

  useEffect(() => {
    fetchLetters();
  }, [fetchLetters]);

  const resetForm = () => {
    setFormType("INCOMING");
    setFormTitle("");
    setFormSender("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormClassification("PUBLIC");
    setFormDocumentUrl("");
    setErrors({});
  };

  const openModal = () => {
    resetForm();
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
      document_url: formDocumentUrl || undefined,
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

    const res = await fetch("/api/letters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: formType,
        title: formTitle,
        sender: formSender,
        date_received_sent: formDate,
        classification: formClassification,
        document_url: formDocumentUrl || undefined,
      }),
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
                <TableHead>Dicatat Oleh</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : letters.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
                    <TableCell className="text-muted-foreground text-sm">
                      {l.profiles?.full_name || "-"}
                    </TableCell>
                    <TableCell>
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
                  <h3 className="text-lg font-bold">Arsipkan Surat</h3>
                  <p className="text-sm text-muted-foreground">
                    Tambah arsip surat masuk atau keluar
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
                    {formLoading ? "Menyimpan..." : "Simpan Surat"}
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
