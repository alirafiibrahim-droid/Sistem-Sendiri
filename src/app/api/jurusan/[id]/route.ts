import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiUnauthorized,
  apiNotFound,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireAccess } from "@/lib/access";
import { jurusanFormSchema } from "@/lib/validations/settings";
import { writeAuditLog } from "@/lib/audit";

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
    const forbidden = requireAccess(userRole, "settings-fakultas-jurusan", "update");
    if (forbidden) return forbidden;

    const { id } = await params;
    const body = await request.json();
    const parsed = jurusanFormSchema.partial().safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const supabase = await createSupabaseServer();

    const { data: current } = await supabase
      .from("jurusan")
      .select("id, name, description, fakultas_id")
      .eq("id", id)
      .maybeSingle();

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

    await writeAuditLog({
      action: "UPDATE",
      targetTable: "jurusan",
      targetId: id,
      userId: getUid(request),
      oldValue: current
        ? { name: current.name, description: current.description, fakultas_id: current.fakultas_id }
        : null,
      newValue: { name: data.name, description: data.description, fakultas_id: data.fakultas_id },
    });

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
    const forbidden = requireAccess(userRole, "settings-fakultas-jurusan", "delete");
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("jurusan")
      .select("id, name")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase.from("jurusan").delete().eq("id", id);
    if (error) return apiInternalError(error.message);

    await writeAuditLog({
      action: "DELETE",
      targetTable: "jurusan",
      targetId: id,
      userId: getUid(request),
      oldValue: existing ? { name: existing.name } : null,
    });

    return apiOk({ message: "Jurusan berhasil dihapus." });
  } catch {
    return apiInternalError();
  }
}
