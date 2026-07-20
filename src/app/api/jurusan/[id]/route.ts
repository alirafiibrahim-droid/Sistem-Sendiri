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
import { jurusanFormSchema } from "@/lib/validations/settings";

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
      .from("jurusan")
      .select("*, fakultas(id, name)")
      .eq("id", id)
      .single();
    if (error || !data) return apiNotFound("Jurusan");
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
    const parsed = jurusanFormSchema.partial().safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
      .from("jurusan")
      .update(parsed.data)
      .eq("id", id)
      .select("*, fakultas(id, name)")
      .single();

    if (error) {
      if (error.code === "23505") return apiBadRequest("Nama jurusan sudah ada.");
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
    const { error } = await supabase.from("jurusan").delete().eq("id", id);
    if (error) return apiInternalError(error.message);
    return apiOk({ message: "Jurusan berhasil dihapus." });
  } catch {
    return apiInternalError();
  }
}
