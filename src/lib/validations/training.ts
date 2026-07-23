import { z } from "zod";

export const trainingCategoryEnum = z.enum([
  "STRENGTH", "POWER", "SPEED", "AGILITY",
  "ENDURANCE", "FLEXIBILITY", "TEKNIK", "MENTAL", "GAME_INTELLIGENCE",
]);

export const trainingFormSchema = z.object({
  name: z
    .string()
    .min(2, "Nama latihan minimal 2 karakter.")
    .max(100, "Nama latihan maksimal 100 karakter."),
  category: trainingCategoryEnum,
});

export type TrainingFormValues = z.infer<typeof trainingFormSchema>;

export const trainingSessionSchema = z.object({
  dates: z
    .array(z.string().min(1, "Tanggal wajib diisi."))
    .min(1, "Minimal satu tanggal harus dipilih."),
  training_id: z.string().uuid().optional().or(z.literal("")),
  session_type: z
    .string()
    .min(2, "Jenis latihan minimal 2 karakter.")
    .max(50, "Jenis latihan maksimal 50 karakter.")
    .optional()
    .or(z.literal("")),
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
