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
    if (!["ADMIN", "PENGURUS_INTI", "KABID"].includes(userRole ?? "")) {
      return apiForbidden();
    }

    const { id, taskId } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("tasks")
      .select("id")
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
    if (!["ADMIN", "PENGURUS_INTI", "KABID"].includes(userRole ?? "")) {
      return apiForbidden();
    }

    const { id, taskId } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("tasks")
      .select("id")
      .eq("id", taskId)
      .eq("program_id", id)
      .single();

    if (!existing) return apiNotFound("Task");

    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) return apiInternalError(error.message);

    return apiOk({ message: "Task berhasil dihapus." });
  } catch {
    return apiInternalError();
  }
}
