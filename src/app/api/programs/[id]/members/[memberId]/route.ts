import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";

// DELETE /api/programs/[id]/members/[memberId] (Admin/Pengurus Inti/Kabid only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const userRole = getUserRole(request);
    if (!["ADMIN", "PENGURUS_INTI", "KABID"].includes(userRole ?? "")) {
      return apiForbidden();
    }

    const { id, memberId } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing, error: fetchError } = await supabase
      .from("program_members")
      .select("id")
      .eq("id", memberId)
      .eq("program_id", id)
      .single();

    if (fetchError || !existing) return apiNotFound("Anggota program");

    const { error } = await supabase
      .from("program_members")
      .delete()
      .eq("id", memberId);

    if (error) return apiInternalError(error.message);
    return apiOk({ message: "Anggota program berhasil dihapus." });
  } catch {
    return apiInternalError();
  }
}
