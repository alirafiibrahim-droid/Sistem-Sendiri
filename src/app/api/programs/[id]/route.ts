import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
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
import { requireAccess } from "@/lib/access";
import { programUpdateSchema } from "@/lib/validations/program";
import { writeAuditLog } from "@/lib/audit";

function getHandoverStatus(handovers: unknown): string | null | undefined {
  if (Array.isArray(handovers)) return handovers[0]?.status;
  if (handovers && typeof handovers === "object") {
    return (handovers as { status?: string | null }).status ?? null;
  }
  return null;
}

// GET /api/programs/[id]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const userRole = getUserRole(request);
    const forbidden = requireAccess(userRole, "programs-detail", "read");
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: program, error: programError } = await supabase
      .from("programs")
      .select("*, divisions(id, name), handovers(id, period_from, period_to, status)")
      .eq("id", id)
      .single();

    if (programError || !program) return apiNotFound("Program");

    const { data: members } = await supabase
      .from("program_members")
      .select("*")
      .eq("program_id", id);

    let membersWithProfiles: unknown[] = [];
    if (members && members.length > 0) {
      const userIds = [...new Set(members.map((m) => m.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, nim, avatar_url")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      membersWithProfiles = members.map((m) => ({
        ...m,
        profiles: profileMap.get(m.user_id) || null,
      }));
    }

    let averageScore: number | null = null;
    const { data: sessions } = await supabase
      .from("program_sessions")
      .select("id")
      .eq("program_id", id);
    const sessionIds = (sessions || []).map((s) => s.id);
    if (sessionIds.length > 0) {
      const { data: attendants } = await supabase
        .from("program_session_attendants")
        .select("session_id, score")
        .in("session_id", sessionIds)
        .not("score", "is", null);

      const scoreMap = new Map<string, number[]>();
      for (const a of attendants || []) {
        const list = scoreMap.get(a.session_id) || [];
        list.push(a.score);
        scoreMap.set(a.session_id, list);
      }

      const sessionAverages = [...scoreMap.values()]
        .filter((scores) => scores.length > 0)
        .map((scores) => scores.reduce((sum, s) => sum + s, 0) / scores.length);

      if (sessionAverages.length > 0) {
        averageScore =
          sessionAverages.reduce((sum, a) => sum + a, 0) / sessionAverages.length;
      }
    }

    return apiOk({
      ...program,
      program_members: membersWithProfiles,
      average_score: averageScore,
    });
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
    const forbidden = requireAccess(userRole, "programs-detail", "update");

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: program, error: programError } = await supabase
      .from("programs")
      .select("id, created_by, handover_id, handovers(id, status)")
      .eq("id", id)
      .single();

    if (programError || !program) return apiNotFound("Program");

    // Program pada periode Sertijab yang telah selesai tidak dapat diedit.
    if (getHandoverStatus(program.handovers) === "COMPLETED") {
      return apiForbidden(
        "Program pada periode yang telah selesai tidak dapat diedit."
      );
    }

    if (forbidden) {
      if (program.created_by !== uid) return forbidden;
    }

    const body = await request.json();

    const validation = programUpdateSchema.safeParse(body);
    if (!validation.success) {
      const msg = validation.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    // Jika periode diubah, pastikan periode baru masih berjalan (belum COMPLETED)
    if (validation.data.handover_id) {
      const admin = createSupabaseAdmin();
      const { data: handover } = await admin
        .from("handovers")
        .select("id, status")
        .eq("id", validation.data.handover_id)
        .maybeSingle();

      if (!handover || handover.status === "COMPLETED") {
        return apiBadRequest("Periode yang dipilih tidak valid atau telah selesai.");
      }
    }

    const { data: oldRow } = await supabase
      .from("programs")
      .select("*")
      .eq("id", id)
      .single();

    const { data, error } = await supabase
      .from("programs")
      .update(validation.data)
      .eq("id", id)
      .select("*, divisions(id, name), handovers(id, period_from, period_to, status)")
      .single();

    if (error) return apiInternalError(error.message);

    await writeAuditLog({
      action: "UPDATE",
      targetTable: "programs",
      targetId: id,
      userId: uid,
      oldValue: oldRow,
      newValue: data,
    });

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
    const uid = getUid(request);
    const userRole = getUserRole(request);
    const forbidden = requireAccess(userRole, "programs-detail", "delete");
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: program } = await supabase
      .from("programs")
      .select("handovers(id, status)")
      .eq("id", id)
      .single();

    if (getHandoverStatus(program?.handovers) === "COMPLETED") {
      return apiForbidden("Program pada periode yang telah selesai tidak dapat dihapus.");
    }

    const { data: oldRow } = await supabase
      .from("programs")
      .select("*")
      .eq("id", id)
      .single();

    const { error } = await supabase.from("programs").delete().eq("id", id);
    if (error) return apiInternalError(error.message);

    await writeAuditLog({
      action: "DELETE",
      targetTable: "programs",
      targetId: id,
      userId: uid,
      oldValue: oldRow,
    });

    return apiOk({ message: "Program berhasil dihapus." });
  } catch {
    return apiInternalError();
  }
}
