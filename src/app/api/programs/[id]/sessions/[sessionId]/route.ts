import { createSupabaseServer } from "@/lib/supabase/server";
import { isProgramLocked } from "@/lib/program-lock";
import {
  apiNoContent,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireAccess } from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";

// DELETE /api/programs/[id]/sessions/[sessionId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const forbidden = requireAccess(getUserRole(request), "programs", "delete");
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    if (await isProgramLocked(supabase, id)) {
      return apiForbidden("Program pada periode yang telah selesai tidak dapat diubah.");
    }

    const { sessionId } = await params;

    const { data: existing } = await supabase
      .from("program_sessions")
      .select("id, date, title")
      .eq("id", sessionId)
      .single();

    const { data, error } = await supabase
      .from("program_sessions")
      .delete()
      .eq("id", sessionId)
      .select("id");

    if (error) return apiInternalError(error.message);
    if (!data || data.length === 0) return apiNotFound("Sesi tidak ditemukan.");

    await writeAuditLog({
      action: "DELETE",
      targetTable: "program_sessions",
      targetId: sessionId,
      userId: uid,
      oldValue: existing
        ? { program_id: id, date: existing.date, title: existing.title }
        : null,
    });

    return apiNoContent();
  } catch {
    return apiInternalError();
  }
}
