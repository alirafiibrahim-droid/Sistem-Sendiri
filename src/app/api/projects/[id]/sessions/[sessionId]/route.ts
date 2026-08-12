import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiNoContent,
  apiUnauthorized,
  apiNotFound,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireAccess } from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";

// DELETE /api/projects/[id]/sessions/[sessionId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const forbidden = requireAccess(getUserRole(request), "projects", "delete");
    if (forbidden) return forbidden;

    const { sessionId } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("project_sessions")
      .select("id, date, title")
      .eq("id", sessionId)
      .single();

    if (!existing) return apiNotFound("Sesi tidak ditemukan.");

    const { data, error } = await supabase
      .from("project_sessions")
      .delete()
      .eq("id", sessionId)
      .select("id");

    if (error) return apiInternalError(error.message);
    if (!data || data.length === 0) return apiNotFound("Sesi tidak ditemukan.");

    await writeAuditLog({
      action: "DELETE",
      targetTable: "project_sessions",
      targetId: sessionId,
      userId: uid,
      oldValue: { date: existing.date, title: existing.title ?? null },
    });

    return apiNoContent();
  } catch {
    return apiInternalError();
  }
}
