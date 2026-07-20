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
import { isAdmin, requireRole } from "@/lib/authz";
import { fakultasFormSchema } from "@/lib/validations/settings";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { id } = await params;
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.from("fakultas").select("*").eq("id", id).single();
    if (error || !data) return apiNotFound("Fakultas");
    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userRole = getUserRole(request);
    const forbidden = requireRole(userRole, ["PENGURUS_INTI"]);
    if (forbidden) return forbidden;

    const { id } = await params;
    const body = await request.json();
    const parsed = fakultasFormSchema.partial().safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
      .from("fakultas")
      .update(parsed.data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") return apiBadRequest("Nama fakultas sudah ada.");
      return apiInternalError(error.message);
    }

    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userRole = getUserRole(request);
    if (!isAdmin(userRole)) return apiForbidden();

    const { id } = await params;
    const supabase = await createSupabaseServer();
    const { error } = await supabase.from("fakultas").delete().eq("id", id);
    if (error) return apiInternalError(error.message);
    return apiOk({ message: "Fakultas berhasil dihapus." });
  } catch {
    return apiInternalError();
  }
}
