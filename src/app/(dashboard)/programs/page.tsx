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
import type { ProgramWithDetails } from "@/lib/types/database";

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
  const supabase = createSupabaseClient();
  const [programs, setPrograms] = useState<ProgramWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("programs")
      .select("*, divisions(id, name)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }
    if (statusFilter !== "ALL") {
      query = query.eq("status", statusFilter);
    }

    const { data } = await query;
    if (data) setPrograms(data as ProgramWithDetails[]);
    setLoading(false);
  }, [supabase, search, statusFilter]);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

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
                <TableHead>Anggaran</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : programs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Belum ada program kerja.
                  </TableCell>
                </TableRow>
              ) : (
                programs.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.divisions?.name ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[p.status]}>{p.status}</Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(p.budget_estimate)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {p.start_date} s/d {p.end_date}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon">
                        ...
                      </Button>
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
