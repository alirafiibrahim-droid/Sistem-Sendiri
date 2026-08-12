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
    const forbidden = requireAccess(role, "finances", "update");
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("dues_templates")
      .select("id, title, amount, due_date")
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

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    const existingRow = existing as unknown as Record<string, unknown>;
    const updatedRow = data as unknown as Record<string, unknown>;
    for (const key of ["title", "amount", "due_date"]) {
      if (JSON.stringify(existingRow[key]) !== JSON.stringify(updatedRow[key])) {
        oldValue[key] = existingRow[key] ?? null;
        newValue[key] = updatedRow[key] ?? null;
      }
    }

    await writeAuditLog({
      action: "UPDATE",
      targetTable: "dues_templates",
      targetId: id,
      userId: uid,
      oldValue: Object.keys(oldValue).length > 0 ? oldValue : null,
      newValue: Object.keys(newValue).length > 0 ? newValue : null,
    });

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
    const forbidden = requireAccess(role, "finances", "delete");
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("dues_templates")
      .select("id, title")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound();

    const { error } = await supabase
      .from("dues_templates")
      .delete()
      .eq("id", id);

    if (error) return apiInternalError();

    await writeAuditLog({
      action: "DELETE",
      targetTable: "dues_templates",
      targetId: id,
      userId: uid,
      oldValue: existing ? { title: existing.title } : null,
    });

    return apiOk({ message: "Deleted successfully" });
  } catch {
    return apiInternalError();
  }
}
