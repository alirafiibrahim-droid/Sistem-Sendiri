"use client";

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

const divisions = [
  { id: "1", name: "Kestari", description: "Kesekretariatan dan Administrasi", members: 5 },
  { id: "2", name: "Kewirausahaan", description: "Pengembangan Jiwa Wirausaha", members: 7 },
  { id: "3", name: "Keagamaan", description: "Pembinaan Kerohanian", members: 6 },
  { id: "4", name: "Sosial Masyarakat", description: "Pengabdian kepada Masyarakat", members: 8 },
  { id: "5", name: "Hubungan Masyarakat", description: "Humas & Jaringan Eksternal", members: 6 },
  { id: "6", name: "Olahraga", description: "Pembinaan Prestasi Olahraga & Keatletan", members: 9 },
  { id: "7", name: "Seni dan Budaya", description: "Pengembangan Seni dan Budaya", members: 4 },
];

const orgSettings = {
  name: "SIORG",
  description: "Sistem Informasi Organisasi Kemahasiswaan",
  email: "admin@siorg.ac.id",
  period: "2025/2026",
  isMaintenance: false,
};

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Pengaturan</h2>
        <p className="text-muted-foreground">Konfigurasi sistem dan data organisasi</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informasi Organisasi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nama Organisasi</label>
              <Input defaultValue={orgSettings.name} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Deskripsi</label>
              <Input defaultValue={orgSettings.description} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input defaultValue={orgSettings.email} type="email" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Periode</label>
              <Input defaultValue={orgSettings.period} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Mode Pemeliharaan</p>
                <p className="text-xs text-muted-foreground">Nonaktifkan akses pengguna</p>
              </div>
              <Badge variant={orgSettings.isMaintenance ? "destructive" : "success"}>
                {orgSettings.isMaintenance ? "Aktif" : "Nonaktif"}
              </Badge>
            </div>
            <Button>Simpan Perubahan</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Divisi</CardTitle>
              <Button size="sm">+ Tambah Divisi</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Anggota</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {divisions.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>{d.members} orang</TableCell>
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
    </div>
  );
}
