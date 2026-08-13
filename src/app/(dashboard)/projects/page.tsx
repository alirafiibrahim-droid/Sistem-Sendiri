"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { projectFormSchema } from "@/lib/validations/project";
import type { IncidentalProject } from "@/lib/types/database";
import type { ApiMeta } from "@/lib/types/api";

type FormErrors = Record<string, string>;

interface HandoverOption {
  id: string;
  period_from: string;
  period_to: string;
  status: string;
}

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
    month: "2-digit",
    year: "numeric",
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<IncidentalProject[]>([]);
  const [budgets, setBudgets] = useState<Map<string, number>>(new Map());
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

  // Periode Berjalan (Sertijab aktif)
  const [handovers, setHandovers] = useState<HandoverOption[]>([]);
  const [formHandoverId, setFormHandoverId] = useState("");

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
      const ids = (json.data as IncidentalProject[]).map((p: IncidentalProject) => p.id);
      const budgetMap = new Map<string, number>();
      if (ids.length > 0) {
        try {
          const budgetRes = await fetch(`/api/budget-items?project_id=${ids.join(",")}`);
          const budgetJson = await budgetRes.json();
          if (budgetJson.success) {
            for (const item of budgetJson.data) {
              if (item.parent_id) continue;
              budgetMap.set(
                item.project_id,
                (budgetMap.get(item.project_id) || 0) + Number(item.subtotal)
              );
            }
            for (const item of budgetJson.data) {
              if (!item.parent_id) continue;
              budgetMap.set(
                item.project_id,
                (budgetMap.get(item.project_id) || 0) + Number(item.subtotal)
              );
            }
          }
        } catch {}
      }
      setBudgets(budgetMap);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = projectFormSchema.safeParse({
      name: formName,
      description: formDescription || undefined,
      urgency_level: formUrgency,
      start_date: formStartDate,
      end_date: formEndDate || undefined,
      budget_source: formBudgetSource || undefined,
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
        handover_id: formHandoverId || undefined,
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
                    <Button variant="outline" size="sm" onClick={() => router.push(`/projects/${p.id}`)}>
                      Detail
                    </Button>
                    <Badge variant="secondary">
                      Anggaran: {formatCurrency(budgets.get(p.id) || 0)}
                    </Badge>
                    <Badge variant={urgencyVariant[p.urgency_level] || "secondary"}>
                      {urgencyLabel[p.urgency_level] || p.urgency_level}
                    </Badge>
                    <Badge variant={statusVariant[p.status] || "secondary"}>
                      {statusLabel[p.status] || p.status}
                    </Badge>
                    {p.handovers && (
                      <Badge variant="secondary">
                        Periode {p.handovers.period_to}
                      </Badge>
                    )}
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

          <div className="relative bg-card text-foreground rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
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
    </div>
  );
}
