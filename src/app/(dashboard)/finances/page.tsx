"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
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
import { financeFormSchema } from "@/lib/validations/finance";
import type { FinanceWithDetails, Program } from "@/lib/types/database";
import type { ApiMeta } from "@/lib/types/api";

type FormErrors = Record<string, string>;

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
    month: "short",
    year: "numeric",
  });
}

export default function FinancesPage() {
  const supabase = createSupabaseClient();

  const [transactions, setTransactions] = useState<FinanceWithDetails[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [page, setPage] = useState(1);
  const limit = 15;

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Form state
  const [formType, setFormType] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [formAmount, setFormAmount] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDate, setFormDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [formProgramId, setFormProgramId] = useState("");
  const [formReceiptUrl, setFormReceiptUrl] = useState("");

  // Programs for dropdown
  const [programs, setPrograms] = useState<Pick<Program, "id" | "name">[]>([]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (search) params.set("search", search);
    if (filterType) params.set("type", filterType);

    const res = await fetch(`/api/finances?${params}`);
    const json = await res.json();

    if (json.success) {
      setTransactions(json.data);
      setMeta(json.meta);
    }
    setLoading(false);
  }, [page, search, filterType]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    supabase
      .from("programs")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (data) setPrograms(data);
      });
  }, [supabase]);

  // Summary from all data (fetch without pagination for totals)
  const [summary, setSummary] = useState({ income: 0, expense: 0 });

  useEffect(() => {
    const fetchSummary = async () => {
      const [incRes, expRes] = await Promise.all([
        fetch("/api/finances?limit=9999&type=INCOME"),
        fetch("/api/finances?limit=9999&type=EXPENSE"),
      ]);
      const incJson = await incRes.json();
      const expJson = await expRes.json();

      const income = incJson.success
        ? incJson.data.reduce(
            (s: number, t: FinanceWithDetails) => s + Number(t.amount),
            0
          )
        : 0;
      const expense = expJson.success
        ? expJson.data.reduce(
            (s: number, t: FinanceWithDetails) => s + Number(t.amount),
            0
          )
        : 0;

      setSummary({ income, expense });
    };
    fetchSummary();
  }, []);

  const resetForm = () => {
    setFormType("INCOME");
    setFormAmount("");
    setFormDescription("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormProgramId("");
    setFormReceiptUrl("");
    setErrors({});
  };

  const openModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = financeFormSchema.safeParse({
      type: formType,
      amount: formAmount,
      description: formDescription,
      date: formDate,
      program_id: formProgramId || undefined,
      receipt_url: formReceiptUrl || undefined,
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

    const res = await fetch("/api/finances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: formType,
        amount: Number(formAmount),
        description: formDescription,
        date: formDate,
        program_id: formProgramId || undefined,
        receipt_url: formReceiptUrl || undefined,
      }),
    });

    const json = await res.json();

    if (!json.success) {
      setErrors({ _form: json.error?.message || "Gagal menyimpan transaksi." });
      setFormLoading(false);
      return;
    }

    setShowModal(false);
    setFormLoading(false);
    fetchTransactions();
  };

  const totalPages = meta.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Keuangan</h2>
          <p className="text-muted-foreground">
            Jurnal transaksi keuangan organisasi
          </p>
        </div>
        <Button onClick={openModal}>+ Catat Transaksi</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Pemasukan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.income)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Pengeluaran
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.expense)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo Kas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.income - summary.expense)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Input
          placeholder="Cari transaksi..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <Select
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setPage(1);
          }}
          className="w-48"
        >
          <option value="">Semua Tipe</option>
          <option value="INCOME">Pemasukan</option>
          <option value="EXPENSE">Pengeluaran</option>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>Dicatat Oleh</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Belum ada transaksi.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">
                      {formatDate(t.date)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          t.type === "INCOME" ? "success" : "destructive"
                        }
                      >
                        {t.type === "INCOME" ? "Pemasukan" : "Pengeluaran"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {t.description}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {t.programs?.name || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {t.profiles?.full_name || "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span
                        className={
                          t.type === "INCOME"
                            ? "text-green-600"
                            : "text-red-600"
                        }
                      >
                        {t.type === "INCOME" ? "+" : "-"}{" "}
                        {formatCurrency(Number(t.amount))}
                      </span>
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
              {Math.min(page * limit, meta.total)} dari {meta.total} transaksi
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

      {/* Modal "+ Catat Transaksi" */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowModal(false)}
          />

          {/* Modal Content */}
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold">Catat Transaksi</h3>
                  <p className="text-sm text-muted-foreground">
                    Tambah transaksi pemasukan atau pengeluaran
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
                {/* Tipe Transaksi */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Tipe Transaksi <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setFormType("INCOME")}
                      className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors ${
                        formType === "INCOME"
                          ? "bg-green-50 border-green-300 text-green-700"
                          : "bg-white border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Pemasukan
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType("EXPENSE")}
                      className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors ${
                        formType === "EXPENSE"
                          ? "bg-red-50 border-red-300 text-red-700"
                          : "bg-white border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Pengeluaran
                    </button>
                  </div>
                  {errors.type && (
                    <p className="text-sm text-red-500">{errors.type}</p>
                  )}
                </div>

                {/* Jumlah & Tanggal */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="amount">
                      Jumlah (Rp) <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="amount"
                      type="number"
                      min="1"
                      placeholder="0"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                    />
                    {errors.amount && (
                      <p className="text-sm text-red-500">{errors.amount}</p>
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
                    {errors.date && (
                      <p className="text-sm text-red-500">{errors.date}</p>
                    )}
                  </div>
                </div>

                {/* Deskripsi */}
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="description">
                    Deskripsi <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="description"
                    placeholder="Contoh: Sponsor dari PT Maju Jaya"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  {errors.description && (
                    <p className="text-sm text-red-500">{errors.description}</p>
                  )}
                </div>

                {/* Program Terkait */}
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="program">
                    Program Terkait
                  </label>
                  <Select
                    id="program"
                    value={formProgramId}
                    onChange={(e) => setFormProgramId(e.target.value)}
                  >
                    <option value="">Tidak terkait program</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                  {errors.program_id && (
                    <p className="text-sm text-red-500">{errors.program_id}</p>
                  )}
                </div>

                {/* URL Bukti */}
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="receipt">
                    URL Bukti (Opsional)
                  </label>
                  <Input
                    id="receipt"
                    type="url"
                    placeholder="https://..."
                    value={formReceiptUrl}
                    onChange={(e) => setFormReceiptUrl(e.target.value)}
                  />
                  {errors.receipt_url && (
                    <p className="text-sm text-red-500">{errors.receipt_url}</p>
                  )}
                </div>

                {errors._form && (
                  <p className="text-sm text-red-500 text-center">
                    {errors._form}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={formLoading} className="flex-1">
                    {formLoading ? "Menyimpan..." : "Simpan Transaksi"}
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
