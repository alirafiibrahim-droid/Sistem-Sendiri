"use client";

import { useState } from "react";
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

const members = [
  { id: "1", name: "Andi Pratama", nim: "2406010001", email: "andi@email.com", role: "ADMIN", division: "Kestari", status: "AKTIF", phone: "081234567890" },
  { id: "2", name: "Budi Santoso", nim: "2406010002", email: "budi@email.com", role: "PENGURUS_INTI", division: "Kewirausahaan", status: "AKTIF", phone: "081234567891" },
  { id: "3", name: "Rina Wulandari", nim: "2406010003", email: "rina@email.com", role: "KABID", division: "Olahraga", status: "AKTIF", phone: "081234567892" },
  { id: "4", name: "Dewi Lestari", nim: "2406010004", email: "dewi@email.com", role: "ANGGOTA", division: "Seni dan Budaya", status: "AKTIF", phone: "081234567893" },
  { id: "5", name: "Eko Prasetyo", nim: "2406010005", email: "eko@email.com", role: "ANGGOTA", division: "Sosial Masyarakat", status: "AKTIF", phone: "081234567894" },
  { id: "6", name: "Fitri Handayani", nim: "2306010006", email: "fitri@email.com", role: "ANGGOTA", division: "Keagamaan", status: "CUTI", phone: "081234567895" },
  { id: "7", name: "Gilang Ramadhan", nim: "2306010007", email: "gilang@email.com", role: "ANGGOTA", division: "Hubungan Masyarakat", status: "ALUMNI", phone: "081234567896" },
  { id: "8", name: "Hana Permata", nim: "2406010008", email: "hana@email.com", role: "ANGGOTA", division: "Kestari", status: "AKTIF", phone: "081234567897" },
];

const roleLabels: Record<string, string> = {
  ADMIN: "Admin",
  PENGURUS_INTI: "Pengurus Inti",
  KABID: "Kabid",
  ANGGOTA: "Anggota",
};

const roleBadgeVariant: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  ADMIN: "destructive",
  PENGURUS_INTI: "default",
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
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const filtered = members.filter((m) => {
    const matchSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.nim.includes(search);
    const matchRole = roleFilter === "ALL" || m.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Anggota</h2>
          <p className="text-muted-foreground">Manajemen data anggota organisasi</p>
        </div>
        <Button>+ Tambah Anggota</Button>
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
          <option value="PENGURUS_INTI">Pengurus Inti</option>
          <option value="KABID">Kabid</option>
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
                <TableHead>Status</TableHead>
                <TableHead>No. HP</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        fallback={m.name.split(" ").map((n) => n[0]).join("")}
                        className="h-8 w-8"
                      />
                      <div>
                        <p className="font-medium">{m.name}</p>
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
                  <TableCell>{m.division}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[m.status]}>{m.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{m.phone}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">...</Button>
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
