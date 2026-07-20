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
import { requireRole } from "@/lib/authz";

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
    const forbidden = requireRole(role, ["PENGURUS_INTI", "KABID"]);
    if (forbidden) return forbidden;

    const { id, userId } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("project_team")
      .select("id")
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

    return apiOk({ deleted: true });
  } catch {
    return apiInternalError();
  }
}
