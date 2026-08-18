"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Division } from "@/lib/types/database";
import { programFormSchema } from "@/lib/validations/program";

type FormErrors = Record<string, string>;

interface MemberItem {
  user_id: string;
  full_name: string;
  nim: string;
}

interface ActivePeriod {
  id: string;
  period_from: string;
  period_to: string;
  status: string;
}

export default function NewProgramPage() {
  const router = useRouter();
  const supabase = createSupabaseClient();

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [activePeriods, setActivePeriods] = useState<ActivePeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [handoverId, setHandoverId] = useState("");
  const [proposalUrl, setProposalUrl] = useState("");
  const [lpjUrl, setLpjUrl] = useState("");

  const [allProfiles, setAllProfiles] = useState<{ id: string; full_name: string; nim: string }[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [members, setMembers] = useState<MemberItem[]>([]);

  useEffect(() => {
    supabase
      .from("divisions")
      .select("id, name, description, created_at, updated_at")
      .order("name")
      .then(({ data }) => {
        if (data) setDivisions(data);
      });
  }, [supabase]);

  // Periode Sertijab yang sedang berjalan (dropdown "Periode")
  useEffect(() => {
    fetch("/api/handovers/active")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setActivePeriods(json.data);
          if (json.data.length === 1) setHandoverId(json.data[0].id);
        }
      });
  }, []);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, full_name, nim")
      .eq("status", "AKTIF")
      .order("full_name")
      .then(({ data }) => {
        if (data) setAllProfiles(data);
      });
  }, [supabase]);

  function addMember() {
    if (!selectedMemberId) return;
    if (members.some((m) => m.user_id === selectedMemberId)) return;
    const profile = allProfiles.find((p) => p.id === selectedMemberId);
    if (!profile) return;
    setMembers([...members, { user_id: profile.id, full_name: profile.full_name, nim: profile.nim }]);
    setSelectedMemberId("");
  }

  function removeMember(userId: string) {
    setMembers(members.filter((m) => m.user_id !== userId));
  }

  const availableProfiles = allProfiles.filter((p) => !members.some((m) => m.user_id === p.id));

  const validate = (): boolean => {
    const result = programFormSchema.safeParse({
      name,
      description,
      start_date: startDate,
      end_date: endDate,
      division_id: divisionId || undefined,
      handover_id: handoverId || undefined,
      proposal_url: proposalUrl || undefined,
      lpj_url: lpjUrl || undefined,
    });

    if (!result.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string;
        if (!fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
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

    const { data: newProgram, error: insertError } = await supabase
      .from("programs")
      .insert({
        name,
        description: description || "",
        start_date: startDate,
        end_date: endDate,
        division_id: divisionId || null,
        handover_id: handoverId || null,
        proposal_url: proposalUrl || null,
        lpj_url: lpjUrl || null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (insertError) {
      setErrors({ _form: insertError.message });
      setLoading(false);
      return;
    }

    if (members.length > 0 && newProgram) {
      const memberInserts = members.map((m) => ({
        program_id: newProgram.id,
        user_id: m.user_id,
        role_in_program: "Anggota",
      }));

      const { error: memberError } = await supabase
        .from("program_members")
        .insert(memberInserts);

      if (memberError) {
        setErrors({ _form: "Program tersimpan, tetapi gagal menambahkan anggota: " + memberError.message });
        setLoading(false);
        return;
      }
    }

    router.push("/programs");
    router.refresh();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Program Baru</h2>
        <p className="text-muted-foreground">Buat program kerja baru</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Form Program Kerja</CardTitle>
          <CardDescription>Isi data di bawah untuk membuat program baru</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="name">
                Nama Program <span className="text-red-500">*</span>
              </label>
              <Input
                id="name"
                placeholder="Contoh: Seminar Kewirausahaan"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="description">
                Deskripsi <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                placeholder="Jelaskan tujuan dan gambaran umum program..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
              {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="startDate">
                  Tanggal Mulai <span className="text-red-500">*</span>
                </label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                {errors.start_date && <p className="text-sm text-red-500">{errors.start_date}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="endDate">
                  Tanggal Selesai <span className="text-red-500">*</span>
                </label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                {errors.end_date && <p className="text-sm text-red-500">{errors.end_date}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="period">
                Periode (Sertijab)
              </label>
              <Select
                value={handoverId === "" ? "__none__" : handoverId}
                onValueChange={(value) => setHandoverId(value === "__none__" ? "" : value)}
              >
                <SelectTrigger id="period">
                  <SelectValue placeholder="Pilih periode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Pilih periode</SelectItem>
                  {activePeriods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      Periode {p.period_to}
                      {p.status === "ONGOING" ? " (Berjalan)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activePeriods.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Belum ada periode Sertijab yang berjalan.
                </p>
              )}
              {errors.handover_id && (
                <p className="text-sm text-red-500">{errors.handover_id}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="division">
                  Divisi Penanggung Jawab
                </label>
                <Select
                  value={divisionId === "" ? "__none__" : divisionId}
                  onValueChange={(value) => setDivisionId(value === "__none__" ? "" : value)}
                >
                  <SelectTrigger id="division">
                    <SelectValue placeholder="Pilih divisi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Pilih divisi</SelectItem>
                    {divisions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.division_id && <p className="text-sm text-red-500">{errors.division_id}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="proposal">
                URL Proposal
              </label>
              <Input
                id="proposal"
                type="url"
                placeholder="https://drive.google.com/..."
                value={proposalUrl}
                onChange={(e) => setProposalUrl(e.target.value)}
              />
              {errors.proposal_url && <p className="text-sm text-red-500">{errors.proposal_url}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="lpj">
                URL LPJ (Laporan Pertanggungjawaban)
              </label>
              <Input
                id="lpj"
                type="url"
                placeholder="https://drive.google.com/..."
                value={lpjUrl}
                onChange={(e) => setLpjUrl(e.target.value)}
              />
              {errors.lpj_url && <p className="text-sm text-red-500">{errors.lpj_url}</p>}
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">Anggota Tim Program</h3>

              <div className="flex gap-2 mb-3">
                <div className="flex-1">
                  <Select
                    value={selectedMemberId === "" ? "__none__" : selectedMemberId}
                    onValueChange={(value) => setSelectedMemberId(value === "__none__" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih anggota..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Pilih anggota...</SelectItem>
                      {availableProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name} — {p.nim}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" onClick={addMember} disabled={!selectedMemberId}>
                  Tambah
                </Button>
              </div>

              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada anggota ditambahkan.</p>
              ) : (
                <div className="border rounded-md">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left font-medium">No.</th>
                        <th className="px-3 py-2 text-left font-medium">Nama</th>
                        <th className="px-3 py-2 text-left font-medium">NIM</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m, idx) => (
                        <tr key={m.user_id} className="border-b last:border-b-0">
                          <td className="px-3 py-2">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium">{m.full_name}</td>
                          <td className="px-3 py-2 font-mono text-xs">{m.nim}</td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => removeMember(m.user_id)}
                            >
                              Hapus
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {errors._form && (
              <p className="text-sm text-red-500 text-center">{errors._form}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Menyimpan..." : "Simpan Program"}
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
