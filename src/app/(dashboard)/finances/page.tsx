"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const transactions = [
  { id: "1", date: "2026-07-10", type: "INCOME" as const, amount: 500000, description: "Sponsor dari PT Maju Jaya untuk Seminar Kewirausahaan", recordedBy: "Andi Pratama", program: "Seminar Kewirausahaan" },
  { id: "2", date: "2026-07-11", type: "EXPENSE" as const, amount: 150000, description: "Pembelian spanduk acara Seminar Kewirausahaan", recordedBy: "Budi Santoso", program: "Seminar Kewirausahaan" },
  { id: "3", date: "2026-07-12", type: "INCOME" as const, amount: 200000, description: "Pelunasan Iuran: Andi Pratama - Uang Kas Juli", recordedBy: "Sistem", program: null },
  { id: "4", date: "2026-07-13", type: "EXPENSE" as const, amount: 75000, description: "Snack rapat koordinasi panitia", recordedBy: "Rina Wulandari", program: null },
  { id: "5", date: "2026-07-14", type: "INCOME" as const, amount: 1000000, description: "Donasi alumni", recordedBy: "Andi Pratama", program: null },
  { id: "6", date: "2026-07-14", type: "EXPENSE" as const, amount: 300000, description: "Perlengkapan latihan atletik", recordedBy: "Budi Santoso", program: "Training Atletik Bulanan" },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function FinancesPage() {
  const [search, setSearch] = useState("");

  const totalIncome = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((acc, t) => acc + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const filtered = transactions.filter(
    (t) =>
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.recordedBy.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Keuangan</h2>
          <p className="text-muted-foreground">Jurnal transaksi keuangan organisasi</p>
        </div>
        <Button>+ Catat Transaksi</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pemasukan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pengeluaran</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpense)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Kas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(balance)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Cari transaksi..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

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
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm">{t.date}</TableCell>
                  <TableCell>
                    <Badge variant={t.type === "INCOME" ? "success" : "destructive"}>
                      {t.type === "INCOME" ? "Pemasukan" : "Pengeluaran"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{t.description}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{t.program || "-"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{t.recordedBy}</TableCell>
                  <TableCell className="text-right font-medium">
                    <span className={t.type === "INCOME" ? "text-green-600" : "text-red-600"}>
                      {t.type === "INCOME" ? "+" : "-"} {formatCurrency(t.amount)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
