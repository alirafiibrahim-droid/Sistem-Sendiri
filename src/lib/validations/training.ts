import { z } from "zod";

export const trainingSessionSchema = z.object({
  date: z.string().min(1, "Tanggal wajib diisi."),
  session_type: z
    .string()
    .min(2, "Jenis latihan minimal 2 karakter.")
    .max(50, "Jenis latihan maksimal 50 karakter."),
  duration_minutes: z.coerce
    .number()
    .int("Durasi harus bilangan bulat.")
    .positive("Durasi harus lebih dari 0.")
    .max(1440, "Durasi maksimal 1440 menit."),
  intensity: z.enum(["LOW", "MEDIUM", "HIGH"], {
    message: "Tingkat intensitas wajib dipilih.",
  }),
  athlete_ids: z.array(z.string()).optional(),
});

export type TrainingSessionFormValues = z.infer<typeof trainingSessionSchema>;
