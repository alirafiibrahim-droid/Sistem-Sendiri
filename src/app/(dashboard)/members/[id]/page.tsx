"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProfileWithDivision, Division, Fakultas, Jurusan } from "@/lib/types/database";

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

const statusLabels: Record<string, string> = {
  AKTIF: "Aktif",
  CUTI: "Cuti",
  ALUMNI: "Alumni",
  NONAKTIF: "Nonaktif",
};

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  AKTIF: "success",
  CUTI: "warning",
  ALUMNI: "secondary",
  NONAKTIF: "destructive",
};

export default function MemberDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const supabase = createSupabaseClient();

  const [member, setMember] = useState<ProfileWithDivision | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [fakultasList, setFakultasList] = useState<Fakultas[]>([]);
  const [jurusanList, setJurusanList] = useState<Jurusan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [forbidden, setForbidden] = useState(false);

  // Editable fields
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [fakultasId, setFakultasId] = useState("");
  const [jurusanId, setJurusanId] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (currentProfile && id !== user.id) {
        const allowedRoles = ["ADMIN", "BENDAHARA", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"];
        if (!allowedRoles.includes(currentProfile.role)) {
          setForbidden(true);
          setLoading(false);
          return;
        }
      }
    }

    const [{ data: memberData }, { data: divData }, { data: fakData }, { data: jurData }] = await Promise.all([
      supabase.from("profiles").select("*, divisions(id, name), fakultas(id, name), jurusan(id, name)").eq("id", id).single(),
      supabase.from("divisions").select("id, name, description, created_at, updated_at").order("name"),
      supabase.from("fakultas").select("*").order("name"),
      supabase.from("jurusan").select("*").order("name"),
    ]);
    if (memberData) {
      const m = memberData as ProfileWithDivision;
      setMember(m);
      setRole(m.role);
      setStatus(m.status);
      setDivisionId(m.division_id ?? "");
      setPhoneNumber(m.phone_number ?? "");
      setFakultasId(m.fakultas_id ?? "");
      setJurusanId(m.jurusan_id ?? "");
    }
    if (divData) setDivisions(divData as Division[]);
    if (fakData) setFakultasList(fakData as Fakultas[]);
    if (jurData) setJurusanList(jurData as Jurusan[]);
    setLoading(false);
  }, [supabase, id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");

    const res = await fetch(`/api/profiles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role,
        status,
        division_id: divisionId || null,
        phone_number: phoneNumber || null,
        fakultas_id: fakultasId || null,
        jurusan_id: jurusanId || null,
      }),
    });
    const json = await res.json();

    if (!json.success) {
      setMessage("Gagal menyimpan: " + (json.error?.message || "Terjadi kesalahan."));
    } else {
      setMessage("Perubahan berhasil disimpan.");
      fetchData();
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Memuat data...</div>;
  }

  if (forbidden) {
    return (
      <div className="text-center py-8 space-y-4">
        <p className="text-muted-foreground">Anda tidak memiliki akses untuk melihat detail anggota ini.</p>
        <Button variant="outline" onClick={() => router.back()}>Kembali</Button>
      </div>
    );
  }

  if (!member) {
    return <div className="text-center py-8 text-muted-foreground">Anggota tidak ditemukan.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Detail Anggota</h2>
          <p className="text-muted-foreground">Kelola data dan hak akses anggota</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>Kembali</Button>
      </div>

      {/* Profil Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={member.avatar_url ?? undefined} alt={member.full_name} />
              <AvatarFallback>{member.full_name.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-xl font-bold">{member.full_name}</h3>
              <p className="text-muted-foreground">{member.email}</p>
              <div className="flex gap-2 mt-1">
                <Badge variant={roleBadgeVariant[member.role]}>{roleLabels[member.role]}</Badge>
                <Badge variant={statusVariant[member.status]}>{statusLabels[member.status]}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Dasar */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Informasi Dasar</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-muted-foreground">NIM</span><span className="font-mono">{member.nim}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{member.email}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">No. HP</span><span>{member.phone_number ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Divisi</span><span>{member.divisions?.name ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Fakultas</span><span>{member.fakultas?.name ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Jurusan</span><span>{member.jurusan?.name ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Bergabung</span><span>{new Date(member.joined_at).toLocaleDateString("id-ID")}</span></div>
          </CardContent>
        </Card>

        {/* Pengaturan Role & Status */}
        <Card>
          <CardHeader><CardTitle>Pengaturan Role & Status</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Select value={role} onValueChange={(value) => setRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANGGOTA">Anggota</SelectItem>
                  <SelectItem value="KABID">Kabid (Kepala Bidang)</SelectItem>
                  <SelectItem value="PELATIH">Pelatih</SelectItem>
                  <SelectItem value="PEMBINA">Pembina</SelectItem>
                  <SelectItem value="BENDAHARA">Bendahara</SelectItem>
                  <SelectItem value="SEKRETARIS">Sekretaris</SelectItem>
                  <SelectItem value="PENGURUS_INTI">Pengurus Inti</SelectItem>
                  <SelectItem value="WAKIL_KETUA">Wakil Ketua</SelectItem>
                  <SelectItem value="KETUA_UMUM">Ketua Umum</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Admin: akses penuh. Ketua Umum & Wakil: pengawasan. Pengurus Inti, Sekretaris & Bendahara: CRUD & approval. Kabid: kelola divisi. Pelatih: bimbingan atlet. Pembina: pengawasan keatletan. Anggota: akses terbatas.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status Keaktifan</label>
              <Select value={status} onValueChange={(value) => setStatus(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AKTIF">Aktif</SelectItem>
                  <SelectItem value="CUTI">Cuti</SelectItem>
                  <SelectItem value="ALUMNI">Alumni</SelectItem>
                  <SelectItem value="NONAKTIF">Nonaktif</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Divisi</label>
              <Select value={divisionId === "" ? "__none__" : divisionId} onValueChange={(value) => setDivisionId(value === "__none__" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tidak ada divisi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Tidak ada divisi</SelectItem>
                  {divisions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Fakultas</label>
              <Select value={fakultasId === "" ? "__none__" : fakultasId} onValueChange={(value) => { setFakultasId(value === "__none__" ? "" : value); setJurusanId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Tidak ada fakultas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Tidak ada fakultas</SelectItem>
                  {fakultasList.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Jurusan</label>
              <Select value={jurusanId === "" ? "__none__" : jurusanId} onValueChange={(value) => setJurusanId(value === "__none__" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tidak ada jurusan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Tidak ada jurusan</SelectItem>
                  {jurusanList.filter((j) => !fakultasId || j.fakultas_id === fakultasId).map((j) => (
                    <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">No. HP</label>
              <Input
                placeholder="081234567890"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>

            {message && (
              <p className={`text-sm text-center ${message.includes("Gagal") ? "text-red-500" : "text-green-600"}`}>
                {message}
              </p>
            )}

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
