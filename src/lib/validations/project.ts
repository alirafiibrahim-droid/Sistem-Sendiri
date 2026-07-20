import { z } from "zod";

export const projectFormSchema = z.object({
  name: z
    .string()
    .min(3, "Nama proyek minimal 3 karakter.")
    .max(150, "Nama proyek maksimal 150 karakter."),
  description: z.string().optional().or(z.literal("")),
  urgency_level: z.enum(["LOW", "NORMAL", "HIGH"], {
    message: "Tingkat urgensi wajib dipilih.",
  }),
  start_date: z.string().min(1, "Tanggal mulai wajib diisi."),
  end_date: z.string().optional().or(z.literal("")),
  budget_source: z.string().optional().or(z.literal("")),
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;
