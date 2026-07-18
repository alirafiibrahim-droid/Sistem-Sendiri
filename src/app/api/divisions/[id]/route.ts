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

// GET /api/divisions/[id]
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
      .from("divisions")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return apiNotFound("Divisi");
    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

// PATCH /api/divisions/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userRole = getUserRole(request);
    if (!["ADMIN", "PENGURUS_INTI"].includes(userRole ?? "")) {
      return apiForbidden();
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("divisions")
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

// DELETE /api/divisions/[id] (Admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userRole = getUserRole(request);
    if (userRole !== "ADMIN") return apiForbidden();

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { error } = await supabase.from("divisions").delete().eq("id", id);
    if (error) return apiInternalError(error.message);

    return apiOk({ message: "Divisi berhasil dihapus." });
  } catch {
    return apiInternalError();
  }
}
