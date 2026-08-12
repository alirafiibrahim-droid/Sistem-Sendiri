import { z } from "zod";

export const budgetItemSchema = z
  .object({
    program_id: z.string().uuid("ID program tidak valid.").optional(),
    project_id: z.string().uuid("ID proyek tidak valid.").optional(),
    parent_id: z
      .string()
      .uuid("ID induk pos tidak valid.")
      .nullable()
      .optional(),
    name: z
      .string()
      .min(1, "Nama pos wajib diisi.")
      .max(200, "Nama pos maksimal 200 karakter."),
    quantity: z.coerce
      .number()
      .min(0, "Jumlah tidak boleh negatif."),
    unit_price: z.coerce
      .number()
      .min(0, "Nilai anggaran tidak boleh negatif."),
  })
  .refine(
    (data) => Boolean(data.program_id) !== Boolean(data.project_id),
    {
      message: "Pos anggaran harus terhubung ke program atau proyek.",
      path: ["program_id"],
    }
  );

export const budgetItemUpdateSchema = z
  .object({
    parent_id: z
      .string()
      .uuid("ID induk pos tidak valid.")
      .nullable()
      .optional(),
    name: z
      .string()
      .min(1, "Nama pos wajib diisi.")
      .max(200, "Nama pos maksimal 200 karakter.")
      .optional(),
    quantity: z.coerce
      .number()
      .min(0, "Jumlah tidak boleh negatif.")
      .optional(),
    unit_price: z.coerce
      .number()
      .min(0, "Nilai anggaran tidak boleh negatif.")
      .optional(),
  })
  .optional();

export type BudgetItemValues = z.infer<typeof budgetItemSchema>;
