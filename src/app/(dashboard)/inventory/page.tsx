"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase/client";
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
import type { InventoryItem } from "@/lib/types/database";

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

export default function InventoryPage() {
  const supabase = createSupabaseClient();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");

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

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Inventaris</h2>
          <p className="text-muted-foreground">Kelola barang milik organisasi</p>
        </div>
        <Link href="/inventory/new">
          <Button>+ Barang Baru</Button>
        </Link>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Cari barang..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">Semua Kategori</option>
          <option value="ELECTRONICS">Elektronik</option>
          <option value="FURNITURE">Meubelair</option>
          <option value="STATIONERY">ATK</option>
          <option value="DOCUMENTS">Dokumen</option>
          <option value="OTHER">Lainnya</option>
        </Select>
        <Select value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)}>
          <option value="">Semua Kondisi</option>
          <option value="GOOD">Baik</option>
          <option value="DAMAGED_LIGHT">Rusak Ringan</option>
          <option value="DAMAGED_HEAVY">Rusak Berat</option>
          <option value="LOST">Hilang</option>
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
                <TableHead>Kondisi</TableHead>
                <TableHead>Lokasi</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
    </div>
  );
}
