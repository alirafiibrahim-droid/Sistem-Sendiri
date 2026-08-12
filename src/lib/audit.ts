import { createSupabaseAdmin } from "@/lib/supabase/admin";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

export interface AuditInput {
  action: AuditAction;
  targetTable: string;
  targetId: string | null;
  userId?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}

/**
 * Mencatat aktivitas (CREATE/UPDATE/DELETE) ke tabel audit_logs.
 * Menggunakan service role client agar tulis berhasil untuk semua role
 * (RLS audit_logs hanya mengizinkan SELECT untuk admin).
 * Kegagalan pencatatan tidak boleh menggagalkan operasi utama.
 */
export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    const admin = createSupabaseAdmin();
    await admin.from("audit_logs").insert({
      user_id: input.userId ?? null,
      action: input.action,
      target_table: input.targetTable,
      target_id: input.targetId,
      old_value: input.oldValue ?? null,
      new_value: input.newValue ?? null,
    });
  } catch {
    // Audit logging tidak boleh memutus operasi utama.
  }
}
