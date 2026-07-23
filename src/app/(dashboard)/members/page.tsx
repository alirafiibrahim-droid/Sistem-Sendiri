"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProfileWithDivision } from "@/lib/types/database";

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

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("profiles")
      .select("*, divisions(id, name)", { count: "exact" })
      .order("full_name", { ascending: true });

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,nim.ilike.%${search}%`);
    }
    if (roleFilter !== "ALL") {
      query = query.eq("role", roleFilter);
    }

    const { data } = await query;
    if (data) setMembers(data as ProfileWithDivision[]);
    setLoading(false);
  }, [supabase, search, roleFilter]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

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

      <div className="flex gap-3">
        <Input
          placeholder="Cari nama atau NIM..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="ALL">Semua Role</option>
          <option value="ADMIN">Admin</option>
          <option value="KETUA_UMUM">Ketua Umum</option>
          <option value="WAKIL_KETUA">Wakil Ketua</option>
          <option value="PENGURUS_INTI">Pengurus Inti</option>
          <option value="SEKRETARIS">Sekretaris</option>
          <option value="BENDAHARA">Bendahara</option>
          <option value="KABID">Kabid</option>
          <option value="PELATIH">Pelatih</option>
          <option value="PEMBINA">Pembina</option>
          <option value="ANGGOTA">Anggota</option>
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
                        <Avatar
                          fallback={m.full_name.split(" ").map((n) => n[0]).join("")}
                          className="h-8 w-8"
                        />
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
