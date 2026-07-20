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
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("dues_templates")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return apiNotFound();

    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const forbidden = requireRole(role, ["PENGURUS_INTI"]);
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("dues_templates")
      .select("id")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound();

    const body = await request.json();
    const { title, amount, due_date } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (amount !== undefined) updateData.amount = amount;
    if (due_date !== undefined) updateData.due_date = due_date;

    const { data, error } = await supabase
      .from("dues_templates")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return apiInternalError();

    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    if (!isAdmin(role)) return apiForbidden();

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("dues_templates")
      .select("id")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound();

    const { error } = await supabase
      .from("dues_templates")
      .delete()
      .eq("id", id);

    if (error) return apiInternalError();

    return apiOk({ message: "Deleted successfully" });
  } catch {
    return apiInternalError();
  }
}
