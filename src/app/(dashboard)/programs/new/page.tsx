"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Division } from "@/lib/types/database";
import { programFormSchema } from "@/lib/validations/program";

type FormErrors = Record<string, string>;

export default function NewProgramPage() {
  const router = useRouter();
  const supabase = createSupabaseClient();

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [proposalUrl, setProposalUrl] = useState("");
  const [lpjUrl, setLpjUrl] = useState("");

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
    const result = programFormSchema.safeParse({
      name,
      description,
      start_date: startDate,
      end_date: endDate,
      budget_estimate: budget ? Number(budget) : 0,
      division_id: divisionId || undefined,
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

    const { error: insertError } = await supabase.from("programs").insert({
      name,
      description: description || "",
      start_date: startDate,
      end_date: endDate,
      budget_estimate: budget ? Number(budget) : 0,
      division_id: divisionId || null,
      proposal_url: proposalUrl || null,
      lpj_url: lpjUrl || null,
      created_by: user.id,
    });

    if (insertError) {
      setErrors({ _form: insertError.message });
      setLoading(false);
      return;
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
            {/* Nama Program */}
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

            {/* Deskripsi */}
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

            {/* Tanggal Mulai & Selesai */}
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

            {/* Anggaran & Divisi */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="budget">
                  Estimasi Anggaran (Rp) <span className="text-red-500">*</span>
                </label>
                <Input
                  id="budget"
                  type="number"
                  placeholder="Minimal Rp 1.000"
                  min="0"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
                {errors.budget_estimate && <p className="text-sm text-red-500">{errors.budget_estimate}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="division">
                  Divisi Penanggung Jawab
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
                {errors.division_id && <p className="text-sm text-red-500">{errors.division_id}</p>}
              </div>
            </div>

            {/* URL Proposal */}
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

            {/* URL LPJ */}
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
