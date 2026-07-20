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

export const profileFormSchema = z.object({
  full_name: z.string().min(2, "Nama minimal 2 karakter.").max(100, "Nama maksimal 100 karakter."),
  phone_number: z.string().max(20, "No telepon maksimal 20 karakter.").optional().or(z.literal("")),
  avatar_url: z.string().url("URL avatar harus valid.").optional().or(z.literal("")),
});

export const orgSettingsFormSchema = z.object({
  org_name: z.string().min(2, "Nama organisasi minimal 2 karakter.").max(100),
  org_description: z.string().max(500).optional(),
  org_email: z.string().email("Email tidak valid.").optional().or(z.literal("")),
  period_year: z.string().min(4, "Periode wajib diisi.").max(9),
  is_maintenance: z.boolean().optional(),
});
