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
import type { FinanceWithDetails, Program, WalletWithOwner, Bank, CashAccount, IncidentalProject } from "@/lib/types/database";
import type { ApiMeta } from "@/lib/types/api";

type FormErrors = Record<string, string>;

interface DashboardData {
  total_income: number;
  total_expense: number;
  total_balance: number;
  banks: Array<{
    bank_id: string;
    bank_name: string;
    account_number: string;
    account_holder: string;
    income: number;
    expense: number;
    balance: number;
    wallets: Array<{
      wallet_id: string;
      wallet_name: string;
      bank_id: string;
      cash_account_id: string | null;
      is_active: boolean;
      income: number;
      expense: number;
      balance: number;
    }>;
  }>;
  cash_accounts: Array<{
    cash_account_id: string;
    cash_account_name: string;
    income: number;
    expense: number;
    balance: number;
    wallets: Array<{
      wallet_id: string;
      wallet_name: string;
      bank_id: string | null;
      cash_account_id: string;
      is_active: boolean;
      income: number;
      expense: number;
      balance: number;
    }>;
  }>;
  wallets: Array<{
    wallet_id: string;
    wallet_name: string;
    bank_id: string | null;
    cash_account_id: string | null;
    is_active: boolean;
    income: number;
    expense: number;
    balance: number;
  }>;
}

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
  const [formSubjectId, setFormSubjectId] = useState("");
  const [formReceiptUrl, setFormReceiptUrl] = useState("");
  const [formWalletId, setFormWalletId] = useState("");

  // Dropdown data
  const [programs, setPrograms] = useState<Pick<Program, "id" | "name">[]>([]);
  const [projects, setProjects] = useState<Pick<IncidentalProject, "id" | "name">[]>([]);
  const [walletsList, setWalletsList] = useState<WalletWithOwner[]>([]);
  const [banksList, setBanksList] = useState<Pick<Bank, "id" | "name" | "account_number">[]>([]);
  const [cashList, setCashList] = useState<Pick<CashAccount, "id" | "name">[]>([]);

  // Dashboard data
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  // Hierarchical filter state
  const [filterBankCash, setFilterBankCash] = useState("");
  const [filterWalletId, setFilterWalletId] = useState("");

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (search) params.set("search", search);
    if (filterType) params.set("type", filterType);
    if (filterWalletId) params.set("wallet_id", filterWalletId);

    const res = await fetch(`/api/finances?${params}`);
    const json = await res.json();

    if (json.success) {
      setTransactions(json.data);
      setMeta(json.meta);
    }
    setLoading(false);
  }, [page, search, filterType, filterWalletId]);

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

  useEffect(() => {
    supabase
      .from("incidental_projects")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (data) setProjects(data);
      });
  }, [supabase]);

  // Fetch wallets for dropdown
  useEffect(() => {
    fetch("/api/wallets")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setWalletsList(json.data);
      });
  }, []);

  // Fetch banks & cash for dropdown
  useEffect(() => {
    Promise.all([fetch("/api/banks"), fetch("/api/cash")]).then(([bRes, cRes]) =>
      Promise.all([bRes.json(), cRes.json()]).then(([bJson, cJson]) => {
        if (bJson.success) setBanksList(bJson.data);
        if (cJson.success) setCashList(cJson.data);
      })
    );
  }, []);

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    const res = await fetch("/api/finances/dashboard");
    const json = await res.json();
    if (json.success) setDashboard(json.data);
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Get available wallets based on hierarchical filter
  const availableWallets = filterBankCash
    ? walletsList.filter(
        (w) => w.bank_id === filterBankCash || w.cash_account_id === filterBankCash
      )
    : walletsList;

  const bankIdsWithWallet = new Set(
    walletsList.filter((w) => w.bank_id).map((w) => w.bank_id as string)
  );
  const cashIdsWithWallet = new Set(
    walletsList.filter((w) => w.cash_account_id).map((w) => w.cash_account_id as string)
  );
  const banksWithoutWallet = banksList.filter((b) => !bankIdsWithWallet.has(b.id));
  const cashWithoutWallet = cashList.filter((c) => !cashIdsWithWallet.has(c.id));

  // Build label for bank/cash selector
  const bankCashOptions = [
    ...(dashboard?.banks.map((b) => ({
      id: b.bank_id,
      label: `Bank: ${b.bank_name}`,
    })) || []),
    ...(dashboard?.cash_accounts.map((c) => ({
      id: c.cash_account_id,
      label: `Kas: ${c.cash_account_name}`,
    })) || []),
  ];

  const resetForm = () => {
    setFormType("INCOME");
    setFormAmount("");
    setFormDescription("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormSubjectId("");
    setFormReceiptUrl("");
    setFormWalletId("");
    setErrors({});
  };

  const openModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Parse wallet_id: could be a UUID (wallet), "bank:UUID", or "cash:UUID"
    let walletId = "";
    let bankId = "";
    let cashAccountId = "";
    if (formWalletId.startsWith("bank:")) {
      bankId = formWalletId.replace("bank:", "");
    } else if (formWalletId.startsWith("cash:")) {
      cashAccountId = formWalletId.replace("cash:", "");
    } else if (formWalletId) {
      walletId = formWalletId;
    }

    let formProgramId = "";
    let formProjectId = "";
    if (formSubjectId.startsWith("project:")) {
      formProjectId = formSubjectId.replace("project:", "");
    } else if (formSubjectId) {
      formProgramId = formSubjectId;
    }

    const result = financeFormSchema.safeParse({
      type: formType,
      amount: formAmount,
      description: formDescription,
      date: formDate,
      program_id: formProgramId || undefined,
      project_id: formProjectId || undefined,
      receipt_url: formReceiptUrl || undefined,
      wallet_id: walletId || undefined,
      bank_id: bankId || undefined,
      cash_account_id: cashAccountId || undefined,
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
        project_id: formProjectId || undefined,
        receipt_url: formReceiptUrl || undefined,
        wallet_id: walletId || undefined,
        bank_id: bankId || undefined,
        cash_account_id: cashAccountId || undefined,
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
    fetchDashboard();
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
              {formatCurrency(dashboard?.total_income || 0)}
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
              {formatCurrency(dashboard?.total_expense || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo Keseluruhan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(dashboard?.total_balance || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Balance per Bank/Cash */}
      {dashboard && (dashboard.banks.length > 0 || dashboard.cash_accounts.length > 0) && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Saldo per Bank/Kas</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {dashboard.banks.map((b) => (
              <Card key={b.bank_id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-sm">{b.bank_name}</p>
                    <Badge variant="outline" className="text-xs">{b.account_number}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{b.account_holder}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Masuk</p>
                      <p className="font-medium text-green-600">{formatCurrency(b.income)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Keluar</p>
                      <p className="font-medium text-red-600">{formatCurrency(b.expense)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Saldo</p>
                      <p className="font-bold">{formatCurrency(b.balance)}</p>
                    </div>
                  </div>
                  {b.wallets.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                      {b.wallets.map((w) => (
                        <div key={w.wallet_id} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{w.wallet_name}</span>
                          <span className={`font-medium ${w.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {formatCurrency(w.balance)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {dashboard.cash_accounts.map((c) => (
              <Card key={c.cash_account_id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-sm">{c.cash_account_name}</p>
                    <Badge variant="secondary" className="text-xs">Kas</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Masuk</p>
                      <p className="font-medium text-green-600">{formatCurrency(c.income)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Keluar</p>
                      <p className="font-medium text-red-600">{formatCurrency(c.expense)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Saldo</p>
                      <p className="font-bold">{formatCurrency(c.balance)}</p>
                    </div>
                  </div>
                  {c.wallets.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                      {c.wallets.map((w) => (
                        <div key={w.wallet_id} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{w.wallet_name}</span>
                          <span className={`font-medium ${w.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {formatCurrency(w.balance)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
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
        <Select
          value={filterBankCash}
          onChange={(e) => {
            setFilterBankCash(e.target.value);
            setFilterWalletId("");
            setPage(1);
          }}
          className="w-56"
        >
          <option value="">Semua Bank/Kas</option>
          {bankCashOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </Select>
        <Select
          value={filterWalletId}
          onChange={(e) => {
            setFilterWalletId(e.target.value);
            setPage(1);
          }}
          className="w-56"
        >
          <option value="">Semua Sumber</option>
          {availableWallets.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
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
                <TableHead>Sumber</TableHead>
                <TableHead>Program / Proyek</TableHead>
                <TableHead>Dicatat Oleh</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                      {t.wallets?.name || t.banks?.name || t.cash_accounts?.name || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {t.programs?.name || t.incidental_projects?.name || "-"}
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

                {/* Sumber */}
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="wallet">
                    Sumber
                  </label>
                  <Select
                    id="wallet"
                    value={formWalletId}
                    onChange={(e) => setFormWalletId(e.target.value)}
                  >
                    <option value="">Tanpa sumber tertentu</option>
                    {banksWithoutWallet.length > 0 && (
                      <optgroup label="Bank">
                        {banksWithoutWallet.map((b) => (
                          <option key={`bank-${b.id}`} value={`bank:${b.id}`}>
                            {b.name} - {b.account_number}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {cashWithoutWallet.length > 0 && (
                      <optgroup label="Kas">
                        {cashWithoutWallet.map((c) => (
                          <option key={`cash-${c.id}`} value={`cash:${c.id}`}>
                            {c.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {walletsList.length > 0 && (
                      <optgroup label="Dompet">
                        {walletsList.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.banks?.name || w.cash_accounts?.name || "-"})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </Select>
                  {errors.wallet_id && (
                    <p className="text-sm text-red-500">{errors.wallet_id}</p>
                  )}
                </div>

                {/* Program / Proyek Terkait */}
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="program">
                    Program / Proyek Terkait
                  </label>
                  <Select
                    id="program"
                    value={formSubjectId}
                    onChange={(e) => setFormSubjectId(e.target.value)}
                  >
                    <option value="">Tidak terkait program/proyek</option>
                    {programs.length > 0 && (
                      <optgroup label="Program">
                        {programs.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {projects.length > 0 && (
                      <optgroup label="Proyek Insidental">
                        {projects.map((p) => (
                          <option key={p.id} value={`project:${p.id}`}>
                            {p.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </Select>
                  {errors.program_id && (
                    <p className="text-sm text-red-500">{errors.program_id}</p>
                  )}
                  {errors.project_id && (
                    <p className="text-sm text-red-500">{errors.project_id}</p>
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
