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
import { writeAuditLog } from "@/lib/audit";

// Field sensitif yang wajib terekam jejak auditnya.
const SENSITIVE_FIELDS = ["role", "status", "division_id", "fakultas_id", "jurusan_id"];

async function auditProfileChanges(
  uid: string,
  targetId: string,
  current: Record<string, unknown> | null,
  updated: Record<string, unknown> | null
): Promise<void> {
  if (!current || !updated) return;
  const oldValue: Record<string, unknown> = {};
  const newValue: Record<string, unknown> = {};
  for (const key of SENSITIVE_FIELDS) {
    if (JSON.stringify(current[key]) !== JSON.stringify(updated[key])) {
      oldValue[key] = current[key] ?? null;
      newValue[key] = updated[key] ?? null;
    }
  }
  if (Object.keys(oldValue).length === 0) return;

  await writeAuditLog({
    action: "UPDATE",
    targetTable: "profiles",
    targetId,
    userId: uid,
    oldValue,
    newValue,
  });
}

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

    if (id !== uid) {
      const userRole = getUserRole(request);
      const forbidden = requireAccess(userRole, "members-detail", "read");
      if (forbidden) return forbidden;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*, divisions(id, name), fakultas(id, name), jurusan(id, name)")
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

    // Ambil data lama untuk perbandingan audit (field sensitif saja).
    const { data: current } = await supabase
      .from("profiles")
      .select("id, role, status, division_id, fakultas_id, jurusan_id")
      .eq("id", id)
      .maybeSingle();

    // Self-update non-admin: limited fields only
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

    const forbidden = requireAccess(userRole, "settings-user", "update");
    if (forbidden) return forbidden;

    // Admin/Pengurus Inti dapat mengubah profil anggota mana pun.
    const { data, error } = await supabase
      .from("profiles")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) return apiInternalError(error.message);

    await auditProfileChanges(uid, id, current, data);

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
    const forbidden = requireAccess(userRole, "settings-user", "delete");
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("profiles")
      .select("id, full_name, nim")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) return apiInternalError(error.message);

    await writeAuditLog({
      action: "DELETE",
      targetTable: "profiles",
      targetId: id,
      userId: getUid(request),
      oldValue: existing
        ? { full_name: existing.full_name, nim: existing.nim }
        : null,
    });

    return apiOk({ message: "Anggota berhasil dihapus permanen." });
  } catch {
    return apiInternalError();
  }
}
