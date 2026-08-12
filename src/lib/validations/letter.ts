import { z } from "zod";

export const letterFormSchema = z.object({
  type: z.enum(["INCOMING", "OUTGOING"], {
    message: "Tipe surat wajib dipilih.",
  }),
  title: z
    .string()
    .min(3, "Judul minimal 3 karakter.")
    .max(255, "Judul maksimal 255 karakter."),
  sender: z
    .string()
    .min(3, "Pengirim/penerima minimal 3 karakter.")
    .max(255, "Pengirim/penerima maksimal 255 karakter."),
  date_received_sent: z.string().min(1, "Tanggal wajib diisi."),
  classification: z.enum(["PUBLIC", "CONFIDENTIAL"]).optional().default("PUBLIC"),
  document_url: z.string().optional().or(z.literal("")),
  handover_id: z
    .string()
    .uuid("ID periode tidak valid.")
    .optional()
    .or(z.literal("")),
});

export type LetterFormValues = z.infer<typeof letterFormSchema>;
