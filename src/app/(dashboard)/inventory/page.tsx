"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
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
  InventoryDisposal,
  InventoryDisposalWithDetails,
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

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value || 0);
}

export default function InventoryPage() {
  const supabase = createSupabaseClient();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");

  // Disposal date range filter (Riwayat Penghapusan Aset)
  const [disposalStartDate, setDisposalStartDate] = useState("");
  const [disposalEndDate, setDisposalEndDate] = useState("");

  // Summary
  const [loanedUnits, setLoanedUnits] = useState(0);

  // Disposal
  const [disposals, setDisposals] = useState<InventoryDisposalWithDetails[]>([]);
  const [showDisposalModal, setShowDisposalModal] = useState(false);
  const [disposalItemId, setDisposalItemId] = useState("");
  const [disposalQty, setDisposalQty] = useState("1");
  const [disposalReason, setDisposalReason] = useState("");
  const [disposalDate, setDisposalDate] = useState(new Date().toISOString().split("T")[0]);
  const [disposalLoading, setDisposalLoading] = useState(false);
  const [disposalError, setDisposalError] = useState("");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("inventory_items")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
    }
    if (categoryFilter) {
      query = query.eq("category", categoryFilter);
    }
    if (conditionFilter) {
      query = query.eq("condition", conditionFilter);
    }

    const { data } = await query;
    if (data) setItems(data as InventoryItem[]);
    setLoading(false);
  }, [supabase, search, categoryFilter, conditionFilter]);

  const fetchLoanedUnits = useCallback(async () => {
    const { data } = await supabase
      .from("inventory_loans")
      .select("quantity")
      .in("status", ["APPROVED", "OVERDUE"]);
    if (data) {
      setLoanedUnits(data.reduce((sum, l) => sum + l.quantity, 0));
    }
  }, [supabase]);

  const fetchDisposals = useCallback(async () => {
    let query = supabase
      .from("inventory_disposals")
      .select("*, inventory_items(id, code, name)")
      .order("disposal_date", { ascending: false });

    if (disposalStartDate) {
      query = query.gte("disposal_date", disposalStartDate);
    }
    if (disposalEndDate) {
      query = query.lte("disposal_date", disposalEndDate);
    }

    const { data } = await query.limit(100);
    if (!data) return;

    const rows = data as InventoryDisposal[];
    const userIds = [
      ...new Set(
        rows.map((d) => d.created_by).filter((v): v is string => Boolean(v))
      ),
    ];

    let profileMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name]));
    }

    setDisposals(
      rows.map((d) => ({
        ...d,
        profiles: d.created_by
          ? { id: d.created_by, full_name: profileMap.get(d.created_by) || "" }
          : null,
      })) as InventoryDisposalWithDetails[]
    );
  }, [supabase, disposalStartDate, disposalEndDate]);

  useEffect(() => {
    fetchItems();
    fetchLoanedUnits();
    fetchDisposals();
  }, [fetchItems, fetchLoanedUnits, fetchDisposals]);

  const totalUnits = items.reduce((sum, i) => sum + i.stock, 0);
  const totalValue = items.reduce((sum, i) => sum + i.stock * (i.unit_price || 0), 0);

  const selectedItem = items.find((i) => i.id === disposalItemId) || null;

  const handleDisposalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disposalItemId) {
      setDisposalError("Pilih aset terlebih dahulu.");
      return;
    }
    setDisposalLoading(true);
    setDisposalError("");

    const res = await fetch(`/api/inventory/${disposalItemId}/disposals`, {
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

    setShowDisposalModal(false);
    setDisposalItemId("");
    setDisposalQty("1");
    setDisposalReason("");
    setDisposalDate(new Date().toISOString().split("T")[0]);
    setDisposalLoading(false);
    fetchItems();
    fetchDisposals();
    fetchLoanedUnits();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Inventaris</h2>
          <p className="text-muted-foreground">Kelola barang milik organisasi</p>
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" onClick={() => setShowDisposalModal(true)}>
            Hapus Inventaris
          </Button>
          <Link href="/inventory/new">
            <Button>+ Barang Baru</Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total Item Inventaris</p>
            <p className="text-2xl font-bold mt-1">
              {totalUnits}
              <span className="text-sm font-normal text-muted-foreground ml-1">unit</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">{items.length} jenis barang</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total Nilai Inventaris</p>
            <p className="text-2xl font-bold mt-1">{formatRupiah(totalValue)}</p>
            <p className="text-xs text-muted-foreground mt-1">Dari {items.length} jenis barang</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Sedang Dipinjam</p>
            <p className="text-2xl font-bold mt-1">
              {loanedUnits}
              <span className="text-sm font-normal text-muted-foreground ml-1">unit</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">Peminjaman aktif (disetujui)</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Cari barang..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={categoryFilter === "" ? "all" : categoryFilter} onValueChange={(value) => setCategoryFilter(value === "all" ? "" : value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            <SelectItem value="ELECTRONICS">Elektronik</SelectItem>
            <SelectItem value="FURNITURE">Meubelair</SelectItem>
            <SelectItem value="STATIONERY">ATK</SelectItem>
            <SelectItem value="DOCUMENTS">Dokumen</SelectItem>
            <SelectItem value="OTHER">Lainnya</SelectItem>
          </SelectContent>
        </Select>
        <Select value={conditionFilter === "" ? "all" : conditionFilter} onValueChange={(value) => setConditionFilter(value === "all" ? "" : value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kondisi</SelectItem>
            <SelectItem value="GOOD">Baik</SelectItem>
            <SelectItem value="DAMAGED_LIGHT">Rusak Ringan</SelectItem>
            <SelectItem value="DAMAGED_HEAVY">Rusak Berat</SelectItem>
            <SelectItem value="LOST">Hilang</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Nama Barang</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Stok</TableHead>
                <TableHead>Nilai</TableHead>
                <TableHead>Kondisi</TableHead>
                <TableHead>Lokasi</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Belum ada barang inventaris.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">{item.code}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{categoryLabel[item.category]}</TableCell>
                    <TableCell>{item.stock} unit</TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatRupiah(item.stock * (item.unit_price || 0))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={conditionVariant[item.condition]}>
                        {conditionLabel[item.condition]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.location}</TableCell>
                    <TableCell>
                      <Link href={`/inventory/${item.id}`}>
                        <Button variant="ghost" size="icon">
                          ...
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Riwayat Penghapusan */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>
              Riwayat Penghapusan Aset
              {disposals.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({disposals.length}{" "}
                  {disposalStartDate || disposalEndDate ? "data" : "terakhir"})
                </span>
              )}
            </CardTitle>
            <DateRangeFilter
              startDate={disposalStartDate}
              endDate={disposalEndDate}
              onStartDateChange={setDisposalStartDate}
              onEndDateChange={setDisposalEndDate}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Barang</TableHead>
                <TableHead>Jumlah</TableHead>
                <TableHead>Nilai (Rp)</TableHead>
                <TableHead>Alasan</TableHead>
                <TableHead>Oleh</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {disposals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Belum ada penghapusan aset.
                  </TableCell>
                </TableRow>
              ) : (
                disposals.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-sm">{d.disposal_date}</TableCell>
                    <TableCell className="font-medium">
                      {d.inventory_items ? (
                        <>
                          {d.inventory_items.name}{" "}
                          <span className="text-xs text-muted-foreground font-mono">
                            ({d.inventory_items.code})
                          </span>
                        </>
                      ) : "-"}
                    </TableCell>
                    <TableCell>{d.quantity} unit</TableCell>
                    <TableCell className="text-sm font-medium">{formatRupiah(d.value_removed)}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{d.reason}</TableCell>
                    <TableCell className="text-sm">{d.profiles?.full_name || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Hapus Inventaris */}
      {showDisposalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowDisposalModal(false)}
          />
          <div className="relative bg-card text-foreground rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold">Hapus Inventaris</h3>
                  <p className="text-sm text-muted-foreground">
                    Kurangi jumlah aset dan nilai (Rp) inventaris
                  </p>
                </div>
                <button
                  onClick={() => setShowDisposalModal(false)}
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

              <form onSubmit={handleDisposalSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Pilih Aset <span className="text-red-500">*</span>
                  </label>
                  <Select value={disposalItemId} onValueChange={(value) => setDisposalItemId(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih aset..." />
                    </SelectTrigger>
                    <SelectContent>
                      {items
                        .filter((i) => i.stock > 0)
                        .map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.code} - {i.name} (stok {i.stock} unit)
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedItem && (
                  <p className="text-xs text-muted-foreground">
                    Nilai per unit: {formatRupiah(selectedItem.unit_price)} &middot; Stok saat ini:{" "}
                    {selectedItem.stock} unit
                  </p>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Jumlah Dihapus <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max={selectedItem?.stock ?? 1}
                      value={disposalQty}
                      onChange={(e) => setDisposalQty(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Tanggal Penghapusan <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={disposalDate}
                      onChange={(e) => setDisposalDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Alasan Penghapusan <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    placeholder="Contoh: rusak berat dan tidak dapat diperbaiki"
                    value={disposalReason}
                    onChange={(e) => setDisposalReason(e.target.value)}
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                {selectedItem && selectedItem.unit_price > 0 && (
                  <div className="flex justify-between rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                    <span className="text-muted-foreground">Estimasi nilai berkurang</span>
                    <span className="font-bold">
                      {formatRupiah((Number(disposalQty) || 0) * selectedItem.unit_price)}
                    </span>
                  </div>
                )}

                {disposalError && (
                  <p className="text-sm text-red-500 text-center">{disposalError}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={disposalLoading} className="flex-1" variant="destructive">
                    {disposalLoading ? "Menyimpan..." : "Simpan Penghapusan"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowDisposalModal(false)}>
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
