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

// GET /api/parameters/[id]
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
      .from("parameters")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return apiNotFound("Parameter");
    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

// PATCH /api/parameters/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userRole = getUserRole(request);
    const forbidden = requireAccess(userRole, "settings-parameters", "update");
    if (forbidden) return forbidden;

    const { id } = await params;
    const body = await request.json();
    const { name, description } = body as { name?: string; description?: string };

    if (name !== undefined && (!name || !name.trim())) {
      return apiBadRequest("Nama parameter wajib diisi.");
    }

    const patch: { name?: string; description?: string } = {};
    if (name !== undefined) patch.name = name.trim();
    if (description !== undefined) patch.description = description;

    const supabase = await createSupabaseServer();

    const { data: current } = await supabase
      .from("parameters")
      .select("id, name, description")
      .eq("id", id)
      .maybeSingle();

    const { data, error } = await supabase
      .from("parameters")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") return apiBadRequest("Nama parameter sudah ada.");
      return apiInternalError(error.message);
    }

    await writeAuditLog({
      action: "UPDATE",
      targetTable: "parameters",
      targetId: id,
      userId: getUid(request),
      oldValue: current ? { name: current.name, description: current.description } : null,
      newValue: { name: data.name, description: data.description },
    });

    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

// DELETE /api/parameters/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userRole = getUserRole(request);
    const forbidden = requireAccess(userRole, "settings-parameters", "delete");
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("parameters")
      .select("id, name")
      .eq("id", id)
      .maybeSingle();

    // Nilai peserta yang memakai parameter ini ikut terhapus (ON DELETE CASCADE),
    // sehingga kolom `score` (rata-rata) harus dihitung ulang.
    const { data: affectedScores } = await supabase
      .from("program_session_attendant_scores")
      .select("attendant_id")
      .eq("parameter_id", id);

    const affectedAttendantIds = [
      ...new Set((affectedScores || []).map((s) => s.attendant_id as string)),
    ];

    const { error } = await supabase.from("parameters").delete().eq("id", id);
    if (error) return apiInternalError(error.message);

    for (const attendantId of affectedAttendantIds) {
      const { data: remaining } = await supabase
        .from("program_session_attendant_scores")
        .select("score")
        .eq("attendant_id", attendantId);

      const filled = (remaining || []).map((r) => r.score as number);
      const average =
        filled.length > 0
          ? Math.round(filled.reduce((sum, n) => sum + n, 0) / filled.length)
          : null;

      const { error: updErr } = await supabase
        .from("program_session_attendants")
        .update({ score: average })
        .eq("id", attendantId);
      if (updErr) return apiInternalError(updErr.message);
    }

    await writeAuditLog({
      action: "DELETE",
      targetTable: "parameters",
      targetId: id,
      userId: getUid(request),
      oldValue: existing ? { name: existing.name } : null,
    });

    return apiOk({ message: "Parameter berhasil dihapus." });
  } catch {
    return apiInternalError();
  }
}