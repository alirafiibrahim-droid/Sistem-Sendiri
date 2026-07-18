"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Division } from "@/lib/types/database";

type FormErrors = Record<string, string>;

export default function NewMemberPage() {
  const router = useRouter();
  const supabase = createSupabaseClient();

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [nim, setNim] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [role, setRole] = useState("ANGGOTA");

  useEffect(() => {
    supabase
      .from("divisions")
      .select("id, name, description, created_at, updated_at")
      .order("name")
      .then(({ data }) => {
        if (data) setDivisions(data);
      });
  }, [supabase]);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!fullName || fullName.length < 3) {
      newErrors.fullName = "Nama lengkap minimal 3 karakter.";
    }
    if (!email || !email.includes("@")) {
      newErrors.email = "Email harus valid.";
    }
    if (!nim || nim.length < 5) {
      newErrors.nim = "NIM minimal 5 karakter.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }

    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setErrors({ _form: "Anda belum login." });
      setLoading(false);
      return;
    }

    const response = await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        full_name: fullName,
        nim,
        phone_number: phoneNumber || null,
        division_id: divisionId || null,
        role,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      setErrors({ _form: result.error?.message || "Gagal menambahkan anggota." });
      setLoading(false);
      return;
    }

    router.push("/members");
    router.refresh();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tambah Anggota</h2>
        <p className="text-muted-foreground">Undang anggota baru ke dalam sistem</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Form Anggota Baru</CardTitle>
          <CardDescription>
            Anggota akan menerima email undangan untuk membuat akun. Email undangan dikirim otomatis oleh Supabase Auth.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nama Lengkap */}
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="fullName">
                Nama Lengkap <span className="text-red-500">*</span>
              </label>
              <Input
                id="fullName"
                placeholder="Contoh: Andi Pratama"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              {errors.fullName && <p className="text-sm text-red-500">{errors.fullName}</p>}
            </div>

            {/* Email & NIM */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">
                  Email <span className="text-red-500">*</span>
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="andi@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="nim">
                  NIM <span className="text-red-500">*</span>
                </label>
                <Input
                  id="nim"
                  placeholder="2406010001"
                  value={nim}
                  onChange={(e) => setNim(e.target.value)}
                />
                {errors.nim && <p className="text-sm text-red-500">{errors.nim}</p>}
              </div>
            </div>

            {/* No. HP & Divisi */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="phone">
                  No. HP
                </label>
                <Input
                  id="phone"
                  placeholder="081234567890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="division">
                  Divisi
                </label>
                <Select
                  id="division"
                  value={divisionId}
                  onChange={(e) => setDivisionId(e.target.value)}
                >
                  <option value="">Pilih divisi</option>
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Role */}
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="role">
                Role <span className="text-red-500">*</span>
              </label>
              <Select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="ANGGOTA">Anggota</option>
                <option value="KABID">Kabid (Kepala Bidang)</option>
                <option value="PENGURUS_INTI">Pengurus Inti</option>
                <option value="ADMIN">Admin</option>
              </Select>
              <p className="text-xs text-muted-foreground">
                Role menentukan hak akses pengguna dalam sistem. Admin memiliki akses penuh.
              </p>
            </div>

            {errors._form && (
              <p className="text-sm text-red-500 text-center">{errors._form}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Mengirim Undangan..." : "Tambah Anggota"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Batal
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
