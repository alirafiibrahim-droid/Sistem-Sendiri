import type { SupabaseClient } from "@supabase/supabase-js";

interface HandoverStatusRef {
  status?: string | null;
}

// Program pada periode Sertijab yang sudah diselesaikan (COMPLETED)
// bersifat read-only: tidak dapat diedit, dihapus, atau dimodifikasi.
export async function isProgramLocked(
  supabase: SupabaseClient,
  programId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("programs")
    .select("handovers(status)")
    .eq("id", programId)
    .maybeSingle();

  const ref = data?.handovers as HandoverStatusRef | HandoverStatusRef[] | null;
  if (Array.isArray(ref)) {
    return ref[0]?.status === "COMPLETED";
  }
  return ref?.status === "COMPLETED";
}
