"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Division, Fakultas, Jurusan, ProfileWithDivision } from "@/lib/types/database";

const roleLabels: Record<string, string> = {
  ADMIN: "Admin",
  KETUA_UMUM: "Ketua Umum",
  WAKIL_KETUA: "Wakil Ketua",
  PENGURUS_INTI: "Pengurus Inti",
  SEKRETARIS: "Sekretaris",
  BENDAHARA: "Bendahara",
  KABID: "Kabid",
  ANGGOTA: "Anggota",
};

const roleBadgeVariant: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  ADMIN: "destructive",
  KETUA_UMUM: "destructive",
  WAKIL_KETUA: "default",
  PENGURUS_INTI: "default",
  SEKRETARIS: "success",
  BENDAHARA: "success",
  KABID: "warning",
  ANGGOTA: "secondary",
};

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  AKTIF: "success",
  CUTI: "warning",
  ALUMNI: "secondary",
  NONAKTIF: "destructive",
};

export default function MembersPage() {
  const supabase = createSupabaseClient();
  const [members, setMembers] = useState<ProfileWithDivision[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [fakultasList, setFakultasList] = useState<Fakultas[]>([]);
  const [jurusanList, setJurusanList] = useState<Jurusan[]>([]);
  const [divisionFilter, setDivisionFilter] = useState("ALL");
  const [fakultasFilter, setFakultasFilter] = useState("ALL");
  const [jurusanFilter, setJurusanFilter] = useState("ALL");
  const [breakdownBy, setBreakdownBy] = useState<"division" | "fakultas" | "jurusan">("division");

  useEffect(() => {
    supabase
      .from("divisions")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (data) setDivisions(data as Division[]);
      });
    supabase
      .from("fakultas")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (data) setFakultasList(data as Fakultas[]);
      });
    supabase
      .from("jurusan")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (data) setJurusanList(data as Jurusan[]);
      });
  }, [supabase]);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("profiles")
      .select("*, divisions(id, name), fakultas(id, name), jurusan(id, name)", { count: "exact" })
      .order("full_name", { ascending: true });

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,nim.ilike.%${search}%,phone_number.ilike.%${search}%`);
    }
    if (roleFilter !== "ALL") {
      query = query.eq("role", roleFilter);
    }
    if (divisionFilter !== "ALL") {
      query = query.eq("division_id", divisionFilter);
    }
    if (fakultasFilter !== "ALL") {
      query = query.eq("fakultas_id", fakultasFilter);
    }
    if (jurusanFilter !== "ALL") {
      query = query.eq("jurusan_id", jurusanFilter);
    }

    const { data } = await query;
    if (data) setMembers(data as ProfileWithDivision[]);
    setLoading(false);
  }, [supabase, search, roleFilter, divisionFilter, fakultasFilter, jurusanFilter]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const summary = useMemo(() => {
    const countBy = (key: (m: ProfileWithDivision) => string) => {
      const map = new Map<string, number>();
      for (const m of members) {
        const name = key(m);
        map.set(name, (map.get(name) || 0) + 1);
      }
      return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    };

    return {
      totalMembers: members.length,
      byDivision: countBy((m) => m.divisions?.name ?? "Tanpa Divisi"),
      byFakultas: countBy((m) => m.fakultas?.name ?? "Tanpa Fakultas"),
      byJurusan: countBy((m) => m.jurusan?.name ?? "Tanpa Jurusan"),
      byStatus: countBy((m) => m.status),
    };
  }, [members]);

  const activeBreakdown =
    breakdownBy === "division"
      ? summary.byDivision
      : breakdownBy === "fakultas"
        ? summary.byFakultas
        : summary.byJurusan;

  const statusOrder = ["AKTIF", "CUTI", "ALUMNI", "NONAKTIF"];
  const statusCounts = new Map(summary.byStatus);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Anggota</h2>
          <p className="text-muted-foreground">Manajemen data anggota organisasi</p>
        </div>
        <Link href="/members/new">
          <Button>+ Tambah Anggota</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Anggota
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "-" : summary.totalMembers}
            </div>
            <CardDescription>Jumlah anggota sesuai filter</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Anggota per Kategori
            </CardTitle>
            <div className="flex gap-1">
              {(
                [
                  ["division", "Divisi"],
                  ["fakultas", "Fakultas"],
                  ["jurusan", "Jurusan"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBreakdownBy(key)}
                  className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                    breakdownBy === key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {activeBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada data</p>
            ) : (
              <div className="space-y-1.5">
                {activeBreakdown.slice(0, 5).map(([name, count]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate">{name}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
                {activeBreakdown.length > 5 && (
                  <p className="text-xs text-muted-foreground">
                    +{activeBreakdown.length - 5} lainnya
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Anggota per Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {statusOrder.map((status) => (
                <div
                  key={status}
                  className="flex items-center justify-between text-sm"
                >
                  <Badge variant={statusVariant[status]}>{status}</Badge>
                  <span className="font-semibold">
                    {loading ? "-" : statusCounts.get(status) || 0}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Cari nama, NIM, atau No. HP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Role</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="KETUA_UMUM">Ketua Umum</SelectItem>
            <SelectItem value="WAKIL_KETUA">Wakil Ketua</SelectItem>
            <SelectItem value="PENGURUS_INTI">Pengurus Inti</SelectItem>
            <SelectItem value="SEKRETARIS">Sekretaris</SelectItem>
            <SelectItem value="BENDAHARA">Bendahara</SelectItem>
            <SelectItem value="KABID">Kabid</SelectItem>
            <SelectItem value="PELATIH">Pelatih</SelectItem>
            <SelectItem value="PEMBINA">Pembina</SelectItem>
            <SelectItem value="ANGGOTA">Anggota</SelectItem>
          </SelectContent>
        </Select>
        <Select value={divisionFilter} onValueChange={(value) => setDivisionFilter(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Divisi</SelectItem>
            {divisions.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fakultasFilter} onValueChange={(value) => setFakultasFilter(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Fakultas</SelectItem>
            {fakultasList.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={jurusanFilter} onValueChange={(value) => setJurusanFilter(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Jurusan</SelectItem>
            {jurusanList.map((j) => (
              <SelectItem key={j.id} value={j.id}>
                {j.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Anggota</TableHead>
                <TableHead>NIM</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Divisi</TableHead>
                <TableHead>Fakultas</TableHead>
                <TableHead>Jurusan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>No. HP</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Belum ada data anggota.
                  </TableCell>
                </TableRow>
              ) : (
                members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{m.full_name.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{m.full_name}</p>
                          <p className="text-xs text-muted-foreground">{m.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{m.nim}</TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant[m.role]}>
                        {roleLabels[m.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>{m.divisions?.name ?? "-"}</TableCell>
                    <TableCell className="text-sm">{m.fakultas?.name ?? "-"}</TableCell>
                    <TableCell className="text-sm">{m.jurusan?.name ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[m.status]}>{m.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{m.phone_number ?? "-"}</TableCell>
                    <TableCell>
                      <Link href={`/members/${m.id}`}>
                        <Button variant="ghost" size="icon">...</Button>
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
