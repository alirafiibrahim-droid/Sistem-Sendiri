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

type Tab = "info" | "loans" | "damage";

export default function InventoryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const supabase = createSupabaseClient();

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loans, setLoans] = useState<InventoryLoan[]>([]);
  const [damageLogs, setDamageLogs] = useState<InventoryDamageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("info");

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: itemData }, { data: loanData }, { data: logData }] = await Promise.all([
      supabase.from("inventory_items").select("*").eq("id", id).single(),
      supabase.from("inventory_loans").select("*, profiles(id, full_name, nim)").eq("item_id", id).order("created_at", { ascending: false }),
      supabase.from("inventory_damage_logs").select("*, profiles(id, full_name)").eq("item_id", id).order("created_at", { ascending: false }),
    ]);
    if (itemData) setItem(itemData as InventoryItem);
    if (loanData) setLoans(loanData as InventoryLoan[]);
    if (logData) setDamageLogs(logData as InventoryDamageLog[]);
    setLoading(false);
  }, [supabase, id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        {([["info", "Info"], ["loans", "Peminjaman"], ["damage", "Kerusakan"]] as const).map(([key, label]) => (
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
    </div>
  );
}
