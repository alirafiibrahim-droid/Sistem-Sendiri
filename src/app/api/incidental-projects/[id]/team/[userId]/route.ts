import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiUnauthorized,
  apiNotFound,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireAccess } from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const forbidden = requireAccess(role, "projects", "delete");
    if (forbidden) return forbidden;

    const { id, userId } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("project_team")
      .select("id, user_id, project_role")
      .eq("project_id", id)
      .eq("user_id", userId)
      .single();

    if (!existing) return apiNotFound();

    const { error } = await supabase
      .from("project_team")
      .delete()
      .eq("project_id", id)
      .eq("user_id", userId);

    if (error) throw error;

    await writeAuditLog({
      action: "DELETE",
      targetTable: "project_team",
      targetId: existing.id,
      userId: uid,
      oldValue: { project_id: id, user_id: userId, project_role: existing.project_role },
    });

    return apiOk({ deleted: true });
  } catch {
    return apiInternalError();
  }
}
