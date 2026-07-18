"use client";

import { useState } from "react";
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

const letters = [
  { id: "1", ref: "001/UN/SIORG/VII/2026", type: "INCOMING", title: "Undangan Rapat Kerja", sender: "Dekanat Fakultas Teknik", date: "2026-07-05", classification: "PUBLIC", createdBy: "Andi Pratama" },
  { id: "2", ref: "002/SU/SIORG/VII/2026", type: "OUTGOING", title: "Surat Keterangan Aktif", sender: "SIORG ke Rektorat", date: "2026-07-08", classification: "PUBLIC", createdBy: "Budi Santoso" },
  { id: "3", ref: "003/RA/SIORG/VII/2026", type: "INCOMING", title: "Rekomendasi Acara", sender: "Kemendikbud", date: "2026-07-10", classification: "CONFIDENTIAL", createdBy: "Rina Wulandari" },
  { id: "4", ref: "004/MA/SIORG/VII/2026", type: "OUTGOING", title: "MoU Kerjasama", sender: "SIORG ke PT Maju Jaya", date: "2026-07-12", classification: "CONFIDENTIAL", createdBy: "Andi Pratama" },
  { id: "5", ref: "005/UD/SIORG/VII/2026", type: "INCOMING", title: "Undangan Seminar Nasional", sender: "Universitas Indonesia", date: "2026-07-14", classification: "PUBLIC", createdBy: "Dewi Lestari" },
];

const typeVariant: Record<string, "default" | "secondary"> = {
  INCOMING: "default",
  OUTGOING: "secondary",
};

const typeLabel: Record<string, string> = {
  INCOMING: "Masuk",
  OUTGOING: "Keluar",
};

const classificationVariant: Record<string, "warning" | "outline"> = {
  CONFIDENTIAL: "warning",
  PUBLIC: "outline",
};

export default function LettersPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const filtered = letters.filter((l) => {
    const matchSearch =
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.ref.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "ALL" || l.type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Persuratan</h2>
          <p className="text-muted-foreground">Arsip surat masuk dan keluar</p>
        </div>
        <Button>+ Arsipkan Surat</Button>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Cari surat..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="ALL">Semua Tipe</option>
          <option value="INCOMING">Surat Masuk</option>
          <option value="OUTGOING">Surat Keluar</option>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Referensi</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Judul</TableHead>
                <TableHead>Pengirim/Penerima</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Klasifikasi</TableHead>
                <TableHead>Dicatat Oleh</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-sm">{l.ref}</TableCell>
                  <TableCell>
                    <Badge variant={typeVariant[l.type]}>{typeLabel[l.type]}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{l.title}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{l.sender}</TableCell>
                  <TableCell className="text-sm">{l.date}</TableCell>
                  <TableCell>
                    <Badge variant={classificationVariant[l.classification]}>
                      {l.classification}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{l.createdBy}</TableCell>
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
