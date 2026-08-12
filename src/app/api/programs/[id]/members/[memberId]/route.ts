import { createSupabaseServer } from "@/lib/supabase/server";
import { isProgramLocked } from "@/lib/program-lock";
import {
  apiOk,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireAccess } from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";

// DELETE /api/programs/[id]/members/[memberId] (Admin/Pengurus Inti/Kabid only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const userRole = getUserRole(request);
    const forbidden = requireAccess(userRole, "programs", "delete");
    if (forbidden) return forbidden;

    const { id, memberId } = await params;
    const supabase = await createSupabaseServer();

    if (await isProgramLocked(supabase, id)) {
      return apiForbidden("Program pada periode yang telah selesai tidak dapat diubah.");
    }

    const { data: existing, error: fetchError } = await supabase
      .from("program_members")
      .select("id, user_id, role_in_program")
      .eq("id", memberId)
      .eq("program_id", id)
      .single();

    if (fetchError || !existing) return apiNotFound("Anggota program");

    const { error } = await supabase
      .from("program_members")
      .delete()
      .eq("id", memberId);

    if (error) return apiInternalError(error.message);

    await writeAuditLog({
      action: "DELETE",
      targetTable: "program_members",
      targetId: memberId,
      userId: uid,
      oldValue: {
        program_id: id,
        user_id: existing.user_id,
        role_in_program: existing.role_in_program,
      },
    });

    return apiOk({ message: "Anggota program berhasil dihapus." });
  } catch {
    return apiInternalError();
  }
}
