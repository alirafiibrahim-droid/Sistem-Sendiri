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

const timeFormat = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Jam mulai harus format HH:MM.");

export const trainingSessionSchema = z.object({
  name: z
    .string()
    .min(5, "Nama sesi latihan minimal 5 karakter.")
    .max(100, "Nama sesi latihan maksimal 100 karakter."),
  dates: z
    .array(z.string().min(1, "Tanggal wajib diisi."))
    .min(1, "Minimal satu tanggal harus dipilih."),
  training_ids: z
    .array(z.string().uuid("Latihan tidak valid."))
    .min(1, "Minimal satu latihan harus dipilih."),
  start_time: timeFormat,
  duration_minutes: z.coerce
    .number()
    .int("Durasi harus bilangan bulat.")
    .positive("Durasi harus lebih dari 0.")
    .max(1440, "Durasi maksimal 1440 menit."),
  intensity: z.enum(["LOW", "MEDIUM", "HIGH"], {
    message: "Tingkat intensitas wajib dipilih.",
  }),
  athlete_ids: z.array(z.string()).optional(),
  handover_id: z.string().uuid("Periode tidak valid.").optional().or(z.literal("")),
});

export type TrainingSessionFormValues = z.infer<typeof trainingSessionSchema>;
