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
    const forbidden = requireAccess(userRole, "settings-divisions", "update");
    if (forbidden) return forbidden;

    const { id } = await params;
    const body = await request.json();
    const supabase = await createSupabaseServer();

    const { data: current } = await supabase
      .from("divisions")
      .select("id, name, description")
      .eq("id", id)
      .maybeSingle();

    const { data, error } = await supabase
      .from("divisions")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) return apiInternalError(error.message);

    await writeAuditLog({
      action: "UPDATE",
      targetTable: "divisions",
      targetId: id,
      userId: getUid(request),
      oldValue: current
        ? { name: current.name, description: current.description }
        : null,
      newValue: { name: data.name, description: data.description },
    });

    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

// DELETE /api/divisions/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userRole = getUserRole(request);
    const forbidden = requireAccess(userRole, "settings-divisions", "delete");
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("divisions")
      .select("id, name")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase.from("divisions").delete().eq("id", id);
    if (error) return apiInternalError(error.message);

    await writeAuditLog({
      action: "DELETE",
      targetTable: "divisions",
      targetId: id,
      userId: getUid(request),
      oldValue: existing ? { name: existing.name } : null,
    });

    return apiOk({ message: "Divisi berhasil dihapus." });
  } catch {
    return apiInternalError();
  }
}
