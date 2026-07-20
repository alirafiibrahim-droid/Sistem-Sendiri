import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiUnauthorized,
  apiNotFound,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireRole } from "@/lib/authz";

// DELETE /api/programs/[id]/members/[memberId] (Admin/Pengurus Inti/Kabid only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const userRole = getUserRole(request);
    const forbidden = requireRole(userRole, ["PENGURUS_INTI", "KABID"]);
    if (forbidden) return forbidden;

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
