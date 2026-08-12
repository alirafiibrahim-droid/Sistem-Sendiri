import { z } from "zod";

export const divisionFormSchema = z.object({
  name: z.string().min(2, "Nama divisi minimal 2 karakter.").max(100, "Nama divisi maksimal 100 karakter."),
  description: z.string().max(250, "Deskripsi maksimal 250 karakter.").optional(),
});

export const fakultasFormSchema = z.object({
  name: z.string().min(2, "Nama fakultas minimal 2 karakter.").max(100, "Nama fakultas maksimal 100 karakter."),
  description: z.string().max(250, "Deskripsi maksimal 250 karakter.").optional(),
});

export const jurusanFormSchema = z.object({
  name: z.string().min(2, "Nama jurusan minimal 2 karakter.").max(100, "Nama jurusan maksimal 100 karakter."),
  description: z.string().max(250, "Deskripsi maksimal 250 karakter.").optional(),
  fakultas_id: z.string().uuid("ID fakultas tidak valid.").optional().or(z.literal("")),
});

export const bankFormSchema = z.object({
  name: z.string().min(2, "Nama bank minimal 2 karakter.").max(100, "Nama bank maksimal 100 karakter."),
  account_number: z.string().min(1, "Nomor rekening wajib diisi.").max(50, "Nomor rekening maksimal 50 karakter."),
  account_holder: z.string().min(2, "Atas nama wajib diisi.").max(255, "Atas nama maksimal 255 karakter."),
  description: z.string().max(250, "Deskripsi maksimal 250 karakter.").optional(),
});

export const cashAccountFormSchema = z.object({
  name: z.string().min(2, "Nama kas minimal 2 karakter.").max(100, "Nama kas maksimal 100 karakter."),
  description: z.string().max(250, "Deskripsi maksimal 250 karakter.").optional(),
});

export const walletFormSchema = z.object({
  name: z.string().min(2, "Nama dompet minimal 2 karakter.").max(100, "Nama dompet maksimal 100 karakter."),
  description: z.string().max(250, "Deskripsi maksimal 250 karakter.").optional(),
  bank_id: z.string().uuid("ID bank tidak valid.").optional().or(z.literal("")),
  cash_account_id: z.string().uuid("ID kas tidak valid.").optional().or(z.literal("")),
  is_active: z.boolean().optional(),
});

export const profileFormSchema = z.object({
  full_name: z.string().min(2, "Nama minimal 2 karakter.").max(100, "Nama maksimal 100 karakter."),
  phone_number: z.string().max(20, "No telepon maksimal 20 karakter.").optional().or(z.literal("")),
});

export const orgSettingsFormSchema = z.object({
  org_name: z.string().min(2, "Nama organisasi minimal 2 karakter.").max(100),
  org_description: z.string().max(500).optional(),
  org_email: z.string().email("Email tidak valid.").optional().or(z.literal("")),
  org_address: z.string().max(500, "Alamat maksimal 500 karakter.").optional().or(z.literal("")),
  org_phone_number: z.string().max(20, "No telepon maksimal 20 karakter.").optional().or(z.literal("")),
  org_university: z.string().max(200, "Nama universitas maksimal 200 karakter.").optional().or(z.literal("")),
  org_social_media: z
    .array(
      z.object({
        platform: z.string().min(1, "Platform wajib diisi.").max(50, "Platform maksimal 50 karakter."),
        url: z.string().url("URL media sosial tidak valid.").max(500, "URL maksimal 500 karakter."),
      })
    )
    .max(10, "Maksimal 10 tautan media sosial.")
    .optional(),
  org_est_year: z
    .string()
    .max(4, "Tahun berdiri maksimal 4 digit.")
    .regex(/^\d{0,4}$/, "Tahun berdiri harus berupa angka.")
    .optional()
    .or(z.literal("")),
  period_year: z.string().min(4, "Periode wajib diisi.").max(9),
  is_maintenance: z.boolean().optional(),
});
