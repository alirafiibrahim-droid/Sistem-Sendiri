import { z } from "zod";

export const achievementParticipantSchema = z.object({
  user_id: z.string().min(1, "Anggota wajib dipilih."),
  juara: z
    .string()
    .min(1, "Juara wajib diisi.")
    .max(50, "Juara maksimal 50 karakter."),
  keterangan: z
    .string()
    .max(500, "Keterangan maksimal 500 karakter.")
    .optional()
    .or(z.literal("")),
});

export const achievementFormSchema = z.object({
  title: z
    .string()
    .min(3, "Judul prestasi minimal 3 karakter.")
    .max(255, "Judul prestasi maksimal 255 karakter."),
  description: z
    .string()
    .min(3, "Deskripsi minimal 3 karakter.")
    .max(1000, "Deskripsi maksimal 1000 karakter.")
    .optional()
    .or(z.literal("")),
  type: z.enum(["ORGANIZATION", "INDIVIDUAL"], {
    message: "Tipe prestasi wajib dipilih.",
  }),
  category: z
    .string()
    .min(2, "Kategori wajib diisi.")
    .max(50, "Kategori maksimal 50 karakter."),
  level: z
    .string()
    .min(2, "Level wajib diisi.")
    .max(50, "Level maksimal 50 karakter."),
  organizer: z.string().optional().or(z.literal("")),
  achievement_date: z.string().min(1, "Tanggal prestasi wajib diisi."),
  proof_url: z
    .string()
    .url("URL bukti harus valid.")
    .optional()
    .or(z.literal("")),
  participants: z.array(achievementParticipantSchema).optional(),
});

export type AchievementFormValues = z.infer<typeof achievementFormSchema>;
export type AchievementParticipantFormValues = z.infer<
  typeof achievementParticipantSchema
>;
