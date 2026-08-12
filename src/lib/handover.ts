import type { SupabaseClient } from "@supabase/supabase-js";

export interface HandoverRef {
  id: string;
  period_from: string;
  period_to: string;
  status: string;
}

/**
 * Menyambungkan data periode Sertijab ke baris yang memiliki handover_id.
 * Dipakai di route handler (server) untuk menampilkan label "Periode Berjalan"
 * pada daftar prestasi, surat, dan proyek. Menggunakan client admin agar
 * periode aktif yang belum COMPLETED tetap terbaca (bypass RLS).
 */
export async function attachHandovers<T extends { handover_id: string | null }>(
  rows: T[],
  supabase: SupabaseClient
): Promise<Array<T & { handovers: HandoverRef | null }>> {
  if (rows.length === 0) return [];

  const ids = [
    ...new Set(rows.map((r) => r.handover_id).filter(Boolean) as string[]),
  ];

  if (ids.length === 0) {
    return rows.map((r) => ({ ...r, handovers: null }));
  }

  const { data } = await supabase
    .from("handovers")
    .select("id, period_from, period_to, status")
    .in("id", ids);

  const map = new Map(
    (data || []).map((h) => [h.id, h as HandoverRef])
  );

  return rows.map((r) => ({
    ...r,
    handovers: r.handover_id ? map.get(r.handover_id) || null : null,
  }));
}
