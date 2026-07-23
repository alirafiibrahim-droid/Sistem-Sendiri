import { z } from "zod";

export const financeFormSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"], {
    message: "Tipe transaksi wajib dipilih.",
  }),
  amount: z.coerce
    .number()
    .positive("Jumlah harus lebih dari 0.")
    .max(999999999999, "Jumlah terlalu besar."),
  description: z
    .string()
    .min(3, "Deskripsi minimal 3 karakter.")
    .max(500, "Deskripsi maksimal 500 karakter."),
  date: z.string().min(1, "Tanggal wajib diisi."),
  program_id: z.string().uuid("ID program tidak valid.").optional().or(z.literal("")),
  project_id: z.string().uuid("ID proyek tidak valid.").optional().or(z.literal("")),
  receipt_url: z.string().url("URL bukti harus valid.").optional().or(z.literal("")),
  wallet_id: z.string().uuid("ID dompet tidak valid.").optional().or(z.literal("")),
  bank_id: z.string().uuid("ID bank tidak valid.").optional().or(z.literal("")),
  cash_account_id: z.string().uuid("ID kas tidak valid.").optional().or(z.literal("")),
});

export type FinanceFormValues = z.infer<typeof financeFormSchema>;
