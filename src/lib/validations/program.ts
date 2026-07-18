import { z } from "zod";

export const programFormSchema = z
  .object({
    name: z
      .string()
      .min(5, "Nama program minimal 5 karakter.")
      .max(120, "Nama program maksimal 120 karakter."),
    description: z
      .string()
      .min(10, "Deskripsi program minimal 10 karakter."),
    start_date: z.coerce.date(),
    end_date: z.coerce.date(),
    budget_estimate: z.coerce
      .number()
      .min(0, "Anggaran tidak boleh negatif."),
    division_id: z.string().uuid("ID divisi tidak valid.").optional(),
    proposal_url: z
      .string()
      .url("URL proposal harus valid.")
      .optional()
      .or(z.literal("")),
    lpj_url: z
      .string()
      .url("URL LPJ harus valid.")
      .optional()
      .or(z.literal("")),
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: "Tanggal selesai tidak boleh sebelum tanggal mulai.",
    path: ["end_date"],
  });
