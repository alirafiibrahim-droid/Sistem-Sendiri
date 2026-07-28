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
import { isAdmin, isRoleAllowed } from "@/lib/authz";
import { programUpdateSchema } from "@/lib/validations/program";

// GET /api/programs/[id]
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
      .from("programs")
      .select("*, divisions(id, name), program_members(*, profiles(id, full_name, nim, avatar_url))")
      .eq("id", id)
      .single();

    if (error || !data) return apiNotFound("Program");
    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

// PATCH /api/programs/[id] (Admin/Pengurus Inti/Kabid or creator)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const userRole = getUserRole(request);
    const isPrivileged = isRoleAllowed(userRole, ["PENGURUS_INTI", "KABID"]);

    const { id } = await params;
    const supabase = await createSupabaseServer();

    if (!isPrivileged) {
      const { data: program } = await supabase
        .from("programs")
        .select("created_by")
        .eq("id", id)
        .single();

      if (!program || program.created_by !== uid) return apiForbidden();
    }

    const body = await request.json();

    const validation = programUpdateSchema.safeParse(body);
    if (!validation.success) {
      const msg = validation.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const { data, error } = await supabase
      .from("programs")
      .update(validation.data)
      .eq("id", id)
      .select("*, divisions(id, name)")
      .single();

    if (error) return apiInternalError(error.message);
    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

// DELETE /api/programs/[id] (Admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userRole = getUserRole(request);
    if (!isAdmin(userRole)) return apiForbidden();

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { error } = await supabase.from("programs").delete().eq("id", id);
    if (error) return apiInternalError(error.message);

    return apiOk({ message: "Program berhasil dihapus." });
  } catch {
    return apiInternalError();
  }
}
