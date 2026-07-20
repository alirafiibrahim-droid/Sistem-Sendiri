import { NextRequest } from "next/server";
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
import { isAdmin, requireRole } from "@/lib/authz";

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const forbidden = requireRole(role, ["PENGURUS_INTI", "KABID"]);
    if (forbidden) return forbidden;

    const { id, milestoneId } = await params;
    const body = await request.json();

    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("project_milestones")
      .select("id, is_completed")
      .eq("project_id", id)
      .eq("id", milestoneId)
      .single();

    if (!existing) return apiNotFound();

    const updates: Record<string, unknown> = {};

    if ("title" in body) updates.title = body.title;
    if ("description" in body) updates.description = body.description;
    if ("due_date" in body) updates.due_date = body.due_date;
    if ("is_completed" in body) {
      updates.is_completed = body.is_completed;
      if (body.is_completed === true && !existing.is_completed) {
        updates.completed_at = new Date().toISOString();
      }
    }

    if (Object.keys(updates).length === 0) {
      return apiOk(existing);
    }

    const { data, error } = await supabase
      .from("project_milestones")
      .update(updates)
      .eq("id", milestoneId)
      .select()
      .single();

    if (error) throw error;

    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    if (!isAdmin(role)) return apiForbidden();

    const { id, milestoneId } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("project_milestones")
      .select("id")
      .eq("project_id", id)
      .eq("id", milestoneId)
      .single();

    if (!existing) return apiNotFound();

    const { error } = await supabase
      .from("project_milestones")
      .delete()
      .eq("id", milestoneId);

    if (error) throw error;

    return apiOk({ deleted: true });
  } catch {
    return apiInternalError();
  }
}
