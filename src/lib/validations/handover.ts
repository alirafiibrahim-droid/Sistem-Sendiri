import { z } from "zod";

const witnessSchema = z.object({
  name: z.string().min(1, "Nama saksi wajib diisi."),
  nim: z.string().optional().default(""),
  role: z.string().min(1, "Jabatan saksi wajib diisi."),
});

export const handoverSchema = z.object({
  period_from: z
    .string()
    .regex(/^\d{4}\/\d{4}$/, "Format periode harus YYYY/YYYY (contoh: 2025/2026)."),
  period_to: z
    .string()
    .regex(/^\d{4}\/\d{4}$/, "Format periode harus YYYY/YYYY (contoh: 2025/2026)."),
  handover_date: z.string().min(1, "Tanggal sertijab wajib diisi."),
  witnesses: z.array(witnessSchema).optional().default([]),
});

export type HandoverFormValues = z.infer<typeof handoverSchema>;
