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

// GET /api/programs/[id]/tasks/[taskId]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { id, taskId } = await params;
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("tasks")
      .select("*, profiles(id, full_name, avatar_url)")
      .eq("id", taskId)
      .eq("program_id", id)
      .single();

    if (error || !data) return apiNotFound("Task");
    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

// PATCH /api/programs/[id]/tasks/[taskId] (Admin/Pengurus Inti/Kabid only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const userRole = getUserRole(request);
    const forbidden = requireAccess(userRole, "programs", "update");
    if (forbidden) return forbidden;

    const { id, taskId } = await params;
    const supabase = await createSupabaseServer();

    if (await isProgramLocked(supabase, id)) {
      return apiForbidden("Program pada periode yang telah selesai tidak dapat diubah.");
    }

    const { data: existing } = await supabase
      .from("tasks")
      .select("id, title, assignee_id, status")
      .eq("id", taskId)
      .eq("program_id", id)
      .single();

    if (!existing) return apiNotFound("Task");

    const body = await request.json();
    const { data, error } = await supabase
      .from("tasks")
      .update(body)
      .eq("id", taskId)
      .select("*, profiles(id, full_name, avatar_url)")
      .single();

    if (error) return apiInternalError(error.message);

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    const existingRow = existing as unknown as Record<string, unknown>;
    const updatedRow = data as unknown as Record<string, unknown>;
    for (const key of ["title", "description", "assignee_id", "due_date", "status"]) {
      if (JSON.stringify(existingRow[key]) !== JSON.stringify(updatedRow[key])) {
        oldValue[key] = existingRow[key] ?? null;
        newValue[key] = updatedRow[key] ?? null;
      }
    }

    await writeAuditLog({
      action: "UPDATE",
      targetTable: "tasks",
      targetId: taskId,
      userId: uid,
      oldValue: Object.keys(oldValue).length > 0 ? oldValue : null,
      newValue: Object.keys(newValue).length > 0 ? newValue : null,
    });

    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

// DELETE /api/programs/[id]/tasks/[taskId] (Admin/Pengurus Inti/Kabid only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const userRole = getUserRole(request);
    const forbidden = requireAccess(userRole, "programs", "delete");
    if (forbidden) return forbidden;

    const { id, taskId } = await params;
    const supabase = await createSupabaseServer();

    if (await isProgramLocked(supabase, id)) {
      return apiForbidden("Program pada periode yang telah selesai tidak dapat diubah.");
    }

    const { data: existing } = await supabase
      .from("tasks")
      .select("id, title")
      .eq("id", taskId)
      .eq("program_id", id)
      .single();

    if (!existing) return apiNotFound("Task");

    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) return apiInternalError(error.message);

    await writeAuditLog({
      action: "DELETE",
      targetTable: "tasks",
      targetId: taskId,
      userId: uid,
      oldValue: { title: existing.title },
    });

    return apiOk({ message: "Task berhasil dihapus." });
  } catch {
    return apiInternalError();
  }
}
