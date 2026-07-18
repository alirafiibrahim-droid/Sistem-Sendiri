"use client";

import { useState } from "react";
import Link from "next/link";
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

const programs = [
  { id: "1", name: "Seminar Kewirausahaan", division: "Kewirausahaan", status: "ONGOING", start: "2026-08-01", end: "2026-08-15", budget: 5000000, progress: 65 },
  { id: "2", name: "Turnamen Futsal Antar Divisi", division: "Olahraga", status: "PLANNED", start: "2026-09-01", end: "2026-09-10", budget: 3000000, progress: 0 },
  { id: "3", name: "Bakti Sosial", division: "Sosial Masyarakat", status: "COMPLETED", start: "2026-06-01", end: "2026-06-15", budget: 2000000, progress: 100 },
  { id: "4", name: "Training Atletik Bulanan", division: "Olahraga", status: "ONGOING", start: "2026-07-01", end: "2026-07-31", budget: 1500000, progress: 40 },
  { id: "5", name: "Kajian Keagamaan", division: "Keagamaan", status: "ONGOING", start: "2026-07-01", end: "2026-12-31", budget: 800000, progress: 30 },
];

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  ONGOING: "warning",
  PLANNED: "secondary",
  COMPLETED: "success",
  CANCELLED: "destructive",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function ProgramsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = programs.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Program Kerja</h2>
          <p className="text-muted-foreground">Kelola semua program kerja organisasi</p>
        </div>
        <Link href="/programs/new">
          <Button>+ Program Baru</Button>
        </Link>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Cari program..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">Semua Status</option>
          <option value="PLANNED">Planned</option>
          <option value="ONGOING">Ongoing</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Program</TableHead>
                <TableHead>Divisi</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Anggaran</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.division}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[p.status]}>{p.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{p.progress}%</span>
                    </div>
                  </TableCell>
                  <TableCell>{formatCurrency(p.budget)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {p.start} s/d {p.end}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      ...
                    </Button>
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
