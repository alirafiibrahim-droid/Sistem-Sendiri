"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { handoverSchema } from "@/lib/validations/handover";
import type { HandoverWithCreator } from "@/lib/types/database";
import type { ApiMeta } from "@/lib/types/api";

type FormErrors = Record<string, string>;

const statusVariant: Record<string, "success" | "warning" | "secondary"> = {
  COMPLETED: "success",
  SIGNED: "warning",
  DRAFT: "secondary",
};

const statusLabel: Record<string, string> = {
  COMPLETED: "Selesai",
  SIGNED: "Ditandatangani",
  DRAFT: "Draf",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function HandoversPage() {
  const [handovers, setHandovers] = useState<HandoverWithCreator[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 15;

  const [showModal, setShowModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const [formPeriodFrom, setFormPeriodFrom] = useState("");
  const [formPeriodTo, setFormPeriodTo] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formWitnesses, setFormWitnesses] = useState<{ name: string; nim: string; role: string }[]>([]);
  const [witnessName, setWitnessName] = useState("");
  const [witnessNim, setWitnessNim] = useState("");
  const [witnessRole, setWitnessRole] = useState("");

  const fetchHandovers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);

    const res = await fetch(`/api/handovers?${params}`);
    const json = await res.json();

    if (json.success) {
      setHandovers(json.data);
      setMeta(json.meta);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchHandovers();
  }, [fetchHandovers]);

  const resetForm = () => {
    setFormPeriodFrom("");
    setFormPeriodTo("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormWitnesses([]);
    setWitnessName("");
    setWitnessNim("");
    setWitnessRole("");
    setErrors({});
  };

  const openModal = () => {
    resetForm();
    setShowModal(true);
  };

  const addWitness = () => {
    if (!witnessName.trim() || !witnessRole.trim()) return;
    setFormWitnesses([
      ...formWitnesses,
      { name: witnessName.trim(), nim: witnessNim.trim(), role: witnessRole.trim() },
    ]);
    setWitnessName("");
    setWitnessNim("");
    setWitnessRole("");
  };

  const removeWitness = (i: number) => {
    setFormWitnesses(formWitnesses.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = handoverSchema.safeParse({
      period_from: formPeriodFrom,
      period_to: formPeriodTo,
      handover_date: formDate,
      witnesses: formWitnesses,
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

    const res = await fetch("/api/handovers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period_from: formPeriodFrom,
        period_to: formPeriodTo,
        handover_date: formDate,
        witnesses: formWitnesses,
      }),
    });

    const json = await res.json();

    if (!json.success) {
      setErrors({ _form: json.error?.message || "Gagal menyimpan sertijab." });
      setFormLoading(false);
      return;
    }

    setShowModal(false);
    setFormLoading(false);
    fetchHandovers();
  };

  const totalPages = meta.totalPages || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sertijab</h2>
          <p className="text-muted-foreground">Arsip Serah Terima Jabatan antar periode</p>
        </div>
        <Button onClick={openModal}>+ Sertijab Baru</Button>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Cari sertijab..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
      </div>

      <div className="space-y-4">
        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Memuat data...</p>
        ) : handovers.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">Belum ada data sertijab.</p>
        ) : (
          handovers.map((h) => (
            <Card key={h.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">
                      Periode {h.period_from} &rarr; {h.period_to}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Tanggal: {formatDate(h.handover_date)} &middot; Dibuat oleh:{" "}
                      {h.profiles?.full_name || "-"}
                    </p>
                  </div>
                  <Badge variant={statusVariant[h.status]}>
                    {statusLabel[h.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {h.witnesses && h.witnesses.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Saksi:</p>
                    <div className="flex flex-wrap gap-2">
                      {h.witnesses.map((w, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {w.name}{w.nim ? ` (${w.nim})` : ""} - {w.role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {meta.total !== undefined && meta.total > limit && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Menampilkan {(page - 1) * limit + 1} -{" "}
            {Math.min(page * limit, meta.total)} dari {meta.total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />

          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold">Sertijab Baru</h3>
                  <p className="text-sm text-muted-foreground">Buat serah terima jabatan baru</p>
                </div>
                <button onClick={() => setShowModal(false)} className="p-1 hover:bg-muted rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="period_from">
                      Periode Sebelumnya <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="period_from"
                      placeholder="2025/2026"
                      value={formPeriodFrom}
                      onChange={(e) => setFormPeriodFrom(e.target.value)}
                    />
                    {errors.period_from && (
                      <p className="text-sm text-red-500">{errors.period_from}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="period_to">
                      Periode Baru <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="period_to"
                      placeholder="2026/2027"
                      value={formPeriodTo}
                      onChange={(e) => setFormPeriodTo(e.target.value)}
                    />
                    {errors.period_to && (
                      <p className="text-sm text-red-500">{errors.period_to}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="handover_date">
                    Tanggal Sertijab <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="handover_date"
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                  />
                  {errors.handover_date && (
                    <p className="text-sm text-red-500">{errors.handover_date}</p>
                  )}
                </div>

                {/* Witnesses */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Saksi</label>

                  {formWitnesses.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formWitnesses.map((w, i) => (
                        <Badge key={i} variant="secondary" className="pr-1">
                          {w.name} - {w.role}
                          <button
                            type="button"
                            onClick={() => removeWitness(i)}
                            className="ml-1 hover:text-red-500"
                          >
                            &times;
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder="Nama"
                      value={witnessName}
                      onChange={(e) => setWitnessName(e.target.value)}
                    />
                    <Input
                      placeholder="NIM"
                      value={witnessNim}
                      onChange={(e) => setWitnessNim(e.target.value)}
                    />
                    <Input
                      placeholder="Jabatan"
                      value={witnessRole}
                      onChange={(e) => setWitnessRole(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addWitness}
                    disabled={!witnessName.trim() || !witnessRole.trim()}
                  >
                    + Tambah Saksi
                  </Button>
                </div>

                {errors._form && (
                  <p className="text-sm text-red-500 text-center">{errors._form}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={formLoading} className="flex-1">
                    {formLoading ? "Menyimpan..." : "Simpan Sertijab"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
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
