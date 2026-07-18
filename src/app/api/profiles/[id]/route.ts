import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";

// GET /api/profiles/[id]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("profiles")
      .select("*, divisions(id, name)")
      .eq("id", id)
      .single();

    if (error || !data) return apiNotFound("Profil");

    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

// PATCH /api/profiles/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    const userRole = getUserRole(request);
    if (!uid) return apiUnauthorized();

    const { id } = await params;
    const body = await request.json();

    const supabase = await createSupabaseServer();

    // Self-update: limited fields only
    if (id === uid && userRole !== "ADMIN") {
      const allowedFields = ["full_name", "phone_number", "avatar_url"];
      const safeUpdate: Record<string, unknown> = {};
      for (const key of allowedFields) {
        if (body[key] !== undefined) safeUpdate[key] = body[key];
      }
      if (Object.keys(safeUpdate).length === 0) {
        return apiBadRequest("Tidak ada field yang diizinkan untuk diubah.");
      }

      const { data, error } = await supabase
        .from("profiles")
        .update(safeUpdate)
        .eq("id", id)
        .select()
        .single();

      if (error) return apiInternalError(error.message);
      return apiOk(data);
    }

    // Admin/Core: full update
    if (!["ADMIN", "PENGURUS_INTI"].includes(userRole ?? "")) {
      return apiForbidden();
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) return apiInternalError(error.message);
    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

// DELETE /api/profiles/[id] (Admin only - hard delete)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userRole = getUserRole(request);
    if (userRole !== "ADMIN") return apiForbidden();

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) return apiInternalError(error.message);

    return apiOk({ message: "Anggota berhasil dihapus permanen." });
  } catch {
    return apiInternalError();
  }
}
