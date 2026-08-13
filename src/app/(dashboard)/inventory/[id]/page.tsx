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
import type {
  InventoryItem,
  InventoryLoan,
  InventoryDamageLog,
  InventoryPurchase,
  InventoryDisposal,
  InventoryDisposalWithDetails,
  WalletWithOwner,
  Bank,
  CashAccount,
} from "@/lib/types/database";

const categoryLabel: Record<string, string> = {
  ELECTRONICS: "Elektronik",
  FURNITURE: "Meubelair",
  STATIONERY: "ATK",
  DOCUMENTS: "Dokumen",
  OTHER: "Lainnya",
};

const conditionVariant: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  GOOD: "success",
  DAMAGED_LIGHT: "warning",
  DAMAGED_HEAVY: "destructive",
  LOST: "secondary",
};

const conditionLabel: Record<string, string> = {
  GOOD: "Baik",
  DAMAGED_LIGHT: "Rusak Ringan",
  DAMAGED_HEAVY: "Rusak Berat",
  LOST: "Hilang",
};

const loanStatusVariant: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  PENDING: "secondary",
  APPROVED: "success",
  REJECTED: "destructive",
  RETURNED: "success",
  OVERDUE: "destructive",
};

const loanStatusLabel: Record<string, string> = {
  PENDING: "Menunggu",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  RETURNED: "Dikembalikan",
  OVERDUE: "Terlambat",
};

const damageTypeLabel: Record<string, string> = {
  DAMAGE: "Kerusakan",
  LOSS: "Kehilangan",
  MAINTENANCE: "Pemeliharaan",
};

type Tab = "info" | "loans" | "damage" | "purchases" | "disposals";

export default function InventoryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const supabase = createSupabaseClient();

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loans, setLoans] = useState<InventoryLoan[]>([]);
  const [damageLogs, setDamageLogs] = useState<InventoryDamageLog[]>([]);
  const [disposals, setDisposals] = useState<InventoryDisposalWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("info");

  // Disposal form
  const [showDisposalForm, setShowDisposalForm] = useState(false);
  const [disposalQty, setDisposalQty] = useState("1");
  const [disposalReason, setDisposalReason] = useState("");
  const [disposalDate, setDisposalDate] = useState(new Date().toISOString().split("T")[0]);
  const [disposalLoading, setDisposalLoading] = useState(false);
  const [disposalError, setDisposalError] = useState("");

  // Price edit
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [priceLoading, setPriceLoading] = useState(false);

  // Loan form
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [loanQty, setLoanQty] = useState("1");
  const [loanBorrowDate, setLoanBorrowDate] = useState("");
  const [loanReturnDate, setLoanReturnDate] = useState("");
  const [loanPurpose, setLoanPurpose] = useState("");
  const [loanLoading, setLoanLoading] = useState(false);

  // Return form
  const [returnLoanId, setReturnLoanId] = useState<string | null>(null);
  const [returnCondition, setReturnCondition] = useState("GOOD");
  const [returnNotes, setReturnNotes] = useState("");
  const [returnLoading, setReturnLoading] = useState(false);

  // Damage form
  const [showDamageForm, setShowDamageForm] = useState(false);
  const [damageDate, setDamageDate] = useState("");
  const [damageType, setDamageType] = useState("DAMAGE");
  const [damageDesc, setDamageDesc] = useState("");
  const [damageCost, setDamageCost] = useState("");
  const [damageLoading, setDamageLoading] = useState(false);

  // Purchase form
  const [purchases, setPurchases] = useState<InventoryPurchase[]>([]);
  const [walletsList, setWalletsList] = useState<WalletWithOwner[]>([]);
  const [banksList, setBanksList] = useState<Pick<Bank, "id" | "name" | "account_number">[]>([]);
  const [cashList, setCashList] = useState<Pick<CashAccount, "id" | "name">[]>([]);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchaseQty, setPurchaseQty] = useState("1");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [purchaseSource, setPurchaseSource] = useState("");
  const [purchaseDesc, setPurchaseDesc] = useState("");
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: itemData }, { data: loanData }, { data: logData }, { data: disposalData }] =
      await Promise.all([
        supabase.from("inventory_items").select("*").eq("id", id).single(),
        supabase.from("inventory_loans").select("*").eq("item_id", id).order("created_at", { ascending: false }),
        supabase.from("inventory_damage_logs").select("*").eq("item_id", id).order("created_at", { ascending: false }),
        supabase.from("inventory_disposals").select("*, inventory_items(id, code, name)").eq("item_id", id).order("disposal_date", { ascending: false }),
      ]);
    if (itemData) setItem(itemData as InventoryItem);

    const loans = (loanData || []) as InventoryLoan[];
    const logs = (logData || []) as InventoryDamageLog[];
    const disposals = (disposalData || []) as InventoryDisposal[];

    const userIds = [
      ...new Set(
        [
          ...loans.map((l) => [l.borrower_id, l.approved_by]),
          ...logs.map((l) => l.reported_by),
          ...disposals.map((d) => d.created_by),
        ]
          .flat()
          .filter((v): v is string => Boolean(v))
      ),
    ];

    let profileMap = new Map<string, { id: string; full_name: string }>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      profileMap = new Map(
        (profiles || []).map((p) => [p.id, { id: p.id, full_name: p.full_name }])
      );
    }

    setLoans(
      loans.map((l) => ({
        ...l,
        profiles: l.borrower_id ? profileMap.get(l.borrower_id) || null : null,
      })) as InventoryLoan[]
    );
    setDamageLogs(
      logs.map((l) => ({
        ...l,
        profiles: l.reported_by ? profileMap.get(l.reported_by) || null : null,
      })) as InventoryDamageLog[]
    );
    setDisposals(
      disposals.map((d) => ({
        ...d,
        profiles: d.created_by ? profileMap.get(d.created_by) || null : null,
      })) as InventoryDisposalWithDetails[]
    );

    setLoading(false);
  }, [supabase, id]);

  const fetchPurchases = useCallback(async () => {
    const res = await fetch(`/api/inventory/${id}/purchases`);
    const json = await res.json();
    if (json.success) setPurchases(json.data);
  }, [id]);

  const fetchWallets = useCallback(async () => {
    const res = await fetch("/api/wallets");
    const json = await res.json();
    if (json.success) setWalletsList(json.data);
  }, []);

  const fetchBanksCash = useCallback(async () => {
    const [bRes, cRes] = await Promise.all([fetch("/api/banks"), fetch("/api/cash")]);
    const [bJson, cJson] = await Promise.all([bRes.json(), cRes.json()]);
    if (bJson.success) setBanksList(bJson.data);
    if (cJson.success) setCashList(cJson.data);
  }, []);

  useEffect(() => {
    fetchData();
    fetchPurchases();
    fetchWallets();
    fetchBanksCash();
  }, [fetchData, fetchPurchases, fetchWallets, fetchBanksCash]);

  const bankIdsWithWallet = new Set(
    walletsList.filter((w) => w.bank_id).map((w) => w.bank_id as string)
  );
  const cashIdsWithWallet = new Set(
    walletsList.filter((w) => w.cash_account_id).map((w) => w.cash_account_id as string)
  );
  const banksWithoutWallet = banksList.filter((b) => !bankIdsWithWallet.has(b.id));
  const cashWithoutWallet = cashList.filter((c) => !cashIdsWithWallet.has(c.id));

  const handleLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoanLoading(true);

    const { error } = await supabase.from("inventory_loans").insert({
      item_id: id,
      quantity: Number(loanQty),
      borrow_date: loanBorrowDate,
      return_date: loanReturnDate,
      purpose: loanPurpose,
    });

    if (!error) {
      setShowLoanForm(false);
      setLoanQty("1");
      setLoanBorrowDate("");
      setLoanReturnDate("");
      setLoanPurpose("");
      fetchData();
    }
    setLoanLoading(false);
  };

  const handleReturn = async (loanId: string) => {
    setReturnLoading(true);
    const { error } = await supabase
      .from("inventory_loans")
      .update({
        status: "RETURNED",
        actual_return: new Date().toISOString().split("T")[0],
        return_condition: returnCondition,
        return_notes: returnNotes || null,
      })
      .eq("id", loanId);

    if (!error) {
      setReturnLoanId(null);
      setReturnCondition("GOOD");
      setReturnNotes("");
      fetchData();
    }
    setReturnLoading(false);
  };

  const handleApprove = async (loanId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from("inventory_loans")
      .update({
        status: "APPROVED",
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", loanId);
    fetchData();
  };

  const handleReject = async (loanId: string) => {
    await supabase
      .from("inventory_loans")
      .update({ status: "REJECTED" })
      .eq("id", loanId);
    fetchData();
  };

  const handleDamageLog = async (e: React.FormEvent) => {
    e.preventDefault();
    setDamageLoading(true);

    const { error } = await supabase.from("inventory_damage_logs").insert({
      item_id: id,
      incident_date: damageDate,
      type: damageType,
      description: damageDesc,
      estimated_cost: damageCost ? Number(damageCost) : 0,
    });

    if (!error) {
      setShowDamageForm(false);
      setDamageDate("");
      setDamageType("DAMAGE");
      setDamageDesc("");
      setDamageCost("");
      fetchData();
    }
    setDamageLoading(false);
  };

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setPurchaseLoading(true);

    let walletId = "";
    let bankId = "";
    let cashAccountId = "";
    if (purchaseSource.startsWith("bank:")) {
      bankId = purchaseSource.replace("bank:", "");
    } else if (purchaseSource.startsWith("cash:")) {
      cashAccountId = purchaseSource.replace("cash:", "");
    } else if (purchaseSource) {
      walletId = purchaseSource;
    }

    const res = await fetch(`/api/inventory/${id}/purchases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quantity: Number(purchaseQty) || 1,
        amount: Number(purchaseAmount),
        subtotal: (Number(purchaseQty) || 1) * (Number(purchaseAmount) || 0),
        date: purchaseDate,
        wallet_id: walletId || undefined,
        bank_id: bankId || undefined,
        cash_account_id: cashAccountId || undefined,
        description: purchaseDesc || undefined,
      }),
    });

    if (res.ok) {
      setShowPurchaseForm(false);
      setPurchaseDate("");
      setPurchaseQty("1");
      setPurchaseAmount("");
      setPurchaseSource("");
      setPurchaseDesc("");
      fetchPurchases();
      fetchData();
    }
    setPurchaseLoading(false);
  };

  const handleDisposal = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisposalLoading(true);
    setDisposalError("");

    const res = await fetch(`/api/inventory/${id}/disposals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quantity: Number(disposalQty),
        reason: disposalReason,
        disposal_date: disposalDate,
      }),
    });
    const json = await res.json();

    if (!json.success) {
      setDisposalError(json.error?.message || "Gagal menghapus inventaris.");
      setDisposalLoading(false);
      return;
    }

    setShowDisposalForm(false);
    setDisposalQty("1");
    setDisposalReason("");
    setDisposalDate(new Date().toISOString().split("T")[0]);
    setDisposalLoading(false);
    fetchData();
  };

  const savePrice = async () => {
    setPriceLoading(true);
    const res = await fetch(`/api/inventory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unit_price: Number(priceInput) || 0 }),
    });
    const json = await res.json();
    if (json.success) {
      setEditingPrice(false);
      fetchData();
    }
    setPriceLoading(false);
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Memuat data...</div>;
  }

  if (!item) {
    return <div className="text-center py-8 text-muted-foreground">Barang tidak ditemukan.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{item.name}</h2>
          <p className="text-muted-foreground">{item.code} &middot; {categoryLabel[item.category]}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>Kembali</Button>
          <Button onClick={() => setShowLoanForm(true)}>Pinjam Barang</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([["info", "Info"], ["loans", "Peminjaman"], ["damage", "Kerusakan"], ["purchases", "Pembelian"], ["disposals", "Penghapusan"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Info */}
      {activeTab === "info" && (
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Detail Barang</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Kode</span><span className="font-mono">{item.code}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Nama</span><span>{item.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Kategori</span><span>{categoryLabel[item.category]}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Lokasi</span><span>{item.location}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Deskripsi</span><span>{item.description || "-"}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Status</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Stok Total</span><span className="font-bold">{item.stock} unit</span></div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Harga Satuan</span>
                {editingPrice ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="0"
                      className="w-32 h-8 text-right"
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                    />
                    <Button size="sm" onClick={savePrice} disabled={priceLoading}>
                      OK
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingPrice(false)}>
                      Batal
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-bold">
                      {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(item.unit_price || 0)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setPriceInput(String(item.unit_price || 0));
                        setEditingPrice(true);
                      }}
                    >
                      Ubah
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Nilai</span><span className="font-bold">{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(item.stock * (item.unit_price || 0))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Kondisi</span><Badge variant={conditionVariant[item.condition]}>{conditionLabel[item.condition]}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status Aktif</span><span>{item.is_active ? "Ya" : "Tidak"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Dibuat</span><span className="text-sm">{new Date(item.created_at).toLocaleDateString("id-ID")}</span></div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Loans */}
      {activeTab === "loans" && (
        <div className="space-y-4">
          {showLoanForm && (
            <Card>
              <CardHeader><CardTitle>Form Peminjaman</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleLoan} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Jumlah Unit</label>
                      <Input type="number" min="1" max={item.stock} value={loanQty} onChange={(e) => setLoanQty(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tanggal Pinjam</label>
                      <Input type="date" value={loanBorrowDate} onChange={(e) => setLoanBorrowDate(e.target.value)} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tanggal Kembali</label>
                      <Input type="date" value={loanReturnDate} onChange={(e) => setLoanReturnDate(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Keperluan</label>
                      <Input placeholder="Keperluan peminjaman..." value={loanPurpose} onChange={(e) => setLoanPurpose(e.target.value)} required />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={loanLoading}>{loanLoading ? "Mengirim..." : "Ajukan"}</Button>
                    <Button type="button" variant="outline" onClick={() => setShowLoanForm(false)}>Batal</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Peminjam</TableHead>
                    <TableHead>Jumlah</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Belum ada peminjaman.</TableCell>
                    </TableRow>
                  ) : (
                    loans.map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell className="font-medium">
                          {(loan as unknown as Record<string, unknown>).profiles
                            ? ((loan as unknown as Record<string, unknown>).profiles as Record<string, string>).full_name
                            : "-"}
                        </TableCell>
                        <TableCell>{loan.quantity} unit</TableCell>
                        <TableCell className="text-sm">{loan.borrow_date} s/d {loan.return_date}</TableCell>
                        <TableCell><Badge variant={loanStatusVariant[loan.status]}>{loanStatusLabel[loan.status]}</Badge></TableCell>
                        <TableCell>
                          {loan.status === "PENDING" && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => handleApprove(loan.id)}>Setuju</Button>
                              <Button size="sm" variant="destructive" onClick={() => handleReject(loan.id)}>Tolak</Button>
                            </div>
                          )}
                          {loan.status === "APPROVED" && (
                            returnLoanId === loan.id ? (
                              <div className="flex gap-1 items-center">
                                <Select value={returnCondition} onChange={(e) => setReturnCondition(e.target.value)}>
                                  <option value="GOOD">Baik</option>
                                  <option value="DAMAGED_LIGHT">Rusak Ringan</option>
                                  <option value="DAMAGED_HEAVY">Rusak Berat</option>
                                  <option value="LOST">Hilang</option>
                                </Select>
                                <Button size="sm" onClick={() => handleReturn(loan.id)} disabled={returnLoading}>OK</Button>
                                <Button size="sm" variant="outline" onClick={() => setReturnLoanId(null)}>Batal</Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => setReturnLoanId(loan.id)}>Kembalikan</Button>
                            )
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Damage */}
      {activeTab === "damage" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowDamageForm(true)}>Catat Kerusakan</Button>
          </div>

          {showDamageForm && (
            <Card>
              <CardHeader><CardTitle>Form Kerusakan/Kehilangan</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleDamageLog} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tanggal Insiden</label>
                      <Input type="date" value={damageDate} onChange={(e) => setDamageDate(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tipe</label>
                      <Select value={damageType} onChange={(e) => setDamageType(e.target.value)}>
                        <option value="DAMAGE">Kerusakan</option>
                        <option value="LOSS">Kehilangan</option>
                        <option value="MAINTENANCE">Pemeliharaan</option>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Deskripsi</label>
                    <textarea
                      placeholder="Jelaskan kronologi..."
                      value={damageDesc}
                      onChange={(e) => setDamageDesc(e.target.value)}
                      rows={3}
                      className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      required
                    />
                  </div>
                  <div className="space-y-2 max-w-xs">
                    <label className="text-sm font-medium">Estimasi Biaya (Rp)</label>
                    <Input type="number" min="0" value={damageCost} onChange={(e) => setDamageCost(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={damageLoading}>{damageLoading ? "Menyimpan..." : "Simpan"}</Button>
                    <Button type="button" variant="outline" onClick={() => setShowDamageForm(false)}>Batal</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Deskripsi</TableHead>
                    <TableHead>Biaya</TableHead>
                    <TableHead>Pelapor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {damageLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Belum ada log kerusakan.</TableCell>
                    </TableRow>
                  ) : (
                    damageLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">{log.incident_date}</TableCell>
                        <TableCell><Badge variant="secondary">{damageTypeLabel[log.type]}</Badge></TableCell>
                        <TableCell className="text-sm max-w-xs truncate">{log.description}</TableCell>
                        <TableCell className="text-sm">
                          {log.estimated_cost > 0
                            ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(log.estimated_cost)
                            : "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {(log as unknown as Record<string, unknown>).profiles
                            ? ((log as unknown as Record<string, unknown>).profiles as Record<string, string>).full_name
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Purchases */}
      {activeTab === "purchases" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowPurchaseForm(true)}>Catat Pembelian</Button>
          </div>

          {showPurchaseForm && (
            <Card>
              <CardHeader><CardTitle>Form Pembelian Barang</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handlePurchase} className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tanggal Pembelian</label>
                      <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Jumlah (unit)</label>
                      <Input type="number" min="1" placeholder="1" value={purchaseQty} onChange={(e) => setPurchaseQty(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nominal per Unit (Rp)</label>
                      <Input type="number" min="1" placeholder="0" value={purchaseAmount} onChange={(e) => setPurchaseAmount(e.target.value)} required />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                    <span className="text-muted-foreground">Subtotal ({Number(purchaseQty) || 0} x {new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0 }).format(Number(purchaseAmount) || 0)})</span>
                    <span className="font-bold">
                      {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format((Number(purchaseQty) || 0) * (Number(purchaseAmount) || 0))}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Sumber Dana</label>
                    <Select value={purchaseSource} onChange={(e) => setPurchaseSource(e.target.value)} required>
                      <option value="">Pilih sumber dana...</option>
                      {banksWithoutWallet.length > 0 && (
                        <optgroup label="Bank">
                          {banksWithoutWallet.map((b) => (
                            <option key={`bank-${b.id}`} value={`bank:${b.id}`}>{b.name} - {b.account_number}</option>
                          ))}
                        </optgroup>
                      )}
                      {cashWithoutWallet.length > 0 && (
                        <optgroup label="Kas">
                          {cashWithoutWallet.map((c) => (
                            <option key={`cash-${c.id}`} value={`cash:${c.id}`}>{c.name}</option>
                          ))}
                        </optgroup>
                      )}
                      {walletsList.length > 0 && (
                        <optgroup label="Dompet">
                          {walletsList.map((w) => (
                            <option key={w.id} value={w.id}>{w.name} ({w.banks?.name || w.cash_accounts?.name || "-"})</option>
                          ))}
                        </optgroup>
                      )}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Deskripsi</label>
                    <Input placeholder="Deskripsi pembelian..." value={purchaseDesc} onChange={(e) => setPurchaseDesc(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={purchaseLoading}>{purchaseLoading ? "Menyimpan..." : "Simpan"}</Button>
                    <Button type="button" variant="outline" onClick={() => setShowPurchaseForm(false)}>Batal</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Jumlah</TableHead>
                    <TableHead>Nominal</TableHead>
                    <TableHead>Subtotal</TableHead>
                    <TableHead>Sumber</TableHead>
                    <TableHead>Deskripsi</TableHead>
                    <TableHead>Dicatat oleh</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Belum ada catatan pembelian.</TableCell>
                    </TableRow>
                  ) : (
                    purchases.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">{p.date}</TableCell>
                        <TableCell className="text-sm">{p.quantity} unit</TableCell>
                        <TableCell className="text-sm">
                          {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(p.amount)}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(p.subtotal)}
                        </TableCell>
                        <TableCell className="text-sm">{(p as unknown as Record<string, unknown>).wallets ? ((p as unknown as Record<string, unknown>).wallets as Record<string, string>).name : (p as unknown as Record<string, unknown>).banks ? ((p as unknown as Record<string, unknown>).banks as Record<string, string>).name : (p as unknown as Record<string, unknown>).cash_accounts ? ((p as unknown as Record<string, unknown>).cash_accounts as Record<string, string>).name : "-"}</TableCell>
                        <TableCell className="text-sm max-w-xs truncate">{p.description || "-"}</TableCell>
                        <TableCell className="text-sm">
                          {(p as unknown as Record<string, unknown>).profiles
                            ? ((p as unknown as Record<string, unknown>).profiles as Record<string, string>).full_name
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Disposals */}
      {activeTab === "disposals" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="destructive" onClick={() => setShowDisposalForm(true)}>Hapus Inventaris</Button>
          </div>

          {showDisposalForm && (
            <Card>
              <CardHeader><CardTitle>Form Penghapusan Aset</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleDisposal} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Jumlah Dihapus</label>
                      <Input
                        type="number"
                        min="1"
                        max={item.stock}
                        value={disposalQty}
                        onChange={(e) => setDisposalQty(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tanggal Penghapusan</label>
                      <Input
                        type="date"
                        value={disposalDate}
                        onChange={(e) => setDisposalDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Alasan Penghapusan</label>
                    <textarea
                      placeholder="Contoh: rusak berat dan tidak dapat diperbaiki"
                      value={disposalReason}
                      onChange={(e) => setDisposalReason(e.target.value)}
                      rows={3}
                      className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      required
                    />
                  </div>
                  {disposalError && (
                    <p className="text-sm text-red-500">{disposalError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" variant="destructive" disabled={disposalLoading}>
                      {disposalLoading ? "Menyimpan..." : "Simpan Penghapusan"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowDisposalForm(false)}>
                      Batal
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Jumlah</TableHead>
                    <TableHead>Nilai (Rp)</TableHead>
                    <TableHead>Alasan</TableHead>
                    <TableHead>Oleh</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {disposals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Belum ada penghapusan aset.</TableCell>
                    </TableRow>
                  ) : (
                    disposals.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="text-sm">{d.disposal_date}</TableCell>
                        <TableCell>{d.quantity} unit</TableCell>
                        <TableCell className="text-sm font-medium">
                          {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(d.value_removed)}
                        </TableCell>
                        <TableCell className="text-sm max-w-xs truncate">{d.reason}</TableCell>
                        <TableCell className="text-sm">{d.profiles?.full_name || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
