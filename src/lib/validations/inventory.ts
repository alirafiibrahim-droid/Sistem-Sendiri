import { z } from "zod";

export const inventoryItemFormSchema = z.object({
  name: z
    .string()
    .min(3, "Nama barang minimal 3 karakter.")
    .max(100, "Nama barang maksimal 100 karakter."),
  category: z.enum(["ELECTRONICS", "FURNITURE", "STATIONERY", "DOCUMENTS", "OTHER"], {
    message: "Kategori barang wajib dipilih.",
  }),
  stock: z.coerce
    .number()
    .int("Jumlah stok harus bilangan bulat.")
    .positive("Jumlah stok minimal 1 unit."),
  condition: z.enum(["GOOD", "DAMAGED_LIGHT", "DAMAGED_HEAVY", "LOST"], {
    message: "Kondisi barang wajib dipilih.",
  }),
  location: z
    .string()
    .min(3, "Lokasi penyimpanan wajib diisi.")
    .max(100, "Lokasi maksimal 100 karakter."),
  description: z.string().max(250, "Deskripsi maksimal 250 karakter.").optional(),
  photo_url: z.string().url("URL foto harus valid.").optional().or(z.literal("")),
});

export const inventoryLoanFormSchema = z
  .object({
    item_id: z.string().uuid("ID barang tidak valid."),
    quantity: z.coerce
      .number()
      .int("Jumlah harus bilangan bulat.")
      .positive("Jumlah minimal 1 unit."),
    borrow_date: z.coerce.date(),
    return_date: z.coerce.date(),
    purpose: z
      .string()
      .min(5, "Keperluan minimal 5 karakter.")
      .max(200, "Keperluan maksimal 200 karakter."),
  })
  .refine((data) => data.return_date >= data.borrow_date, {
    message: "Tanggal kembali tidak boleh sebelum tanggal pinjam.",
    path: ["return_date"],
  });

export const inventoryReturnFormSchema = z.object({
  condition: z.enum(["GOOD", "DAMAGED_LIGHT", "DAMAGED_HEAVY", "LOST"], {
    message: "Kondisi barang saat dikembalikan wajib dipilih.",
  }),
  notes: z.string().max(250, "Catatan maksimal 250 karakter.").optional(),
});

export const inventoryDamageLogFormSchema = z.object({
  item_id: z.string().uuid("ID barang tidak valid."),
  incident_date: z.coerce.date(),
  type: z.enum(["DAMAGE", "LOSS", "MAINTENANCE"], {
    message: "Tipe insiden wajib dipilih.",
  }),
  description: z
    .string()
    .min(10, "Deskripsi insiden minimal 10 karakter.")
    .max(500, "Deskripsi maksimal 500 karakter."),
  estimated_cost: z.coerce.number().min(0, "Biaya estimasi tidak boleh negatif.").optional(),
});

export const inventoryPurchaseFormSchema = z
  .object({
    amount: z.coerce
      .number()
      .positive("Jumlah harus lebih dari 0.")
      .max(999999999999, "Jumlah terlalu besar."),
    date: z.string().min(1, "Tanggal pembelian wajib diisi."),
    wallet_id: z.string().uuid("ID dompet tidak valid.").optional().or(z.literal("")),
    bank_id: z.string().uuid("ID bank tidak valid.").optional().or(z.literal("")),
    cash_account_id: z.string().uuid("ID kas tidak valid.").optional().or(z.literal("")),
    description: z.string().max(500, "Deskripsi maksimal 500 karakter.").optional(),
  })
  .refine((data) => data.wallet_id || data.bank_id || data.cash_account_id, {
    message: "Sumber dana wajib dipilih (Dompet, Bank, atau Kas).",
  });
