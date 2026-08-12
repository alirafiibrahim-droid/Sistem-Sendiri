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

async function getActivePeriod(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>
): Promise<string | null> {
  const { data } = await supabase
    .from("handovers")
    .select("period_from")
    .neq("status", "COMPLETED")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.period_from || null;
}

// GET /api/settings
export async function GET(request: Request) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
      .from("organization_settings")
      .select("*")
      .limit(1)
      .single();

    if (error || !data) return apiNotFound("Pengaturan organisasi");

    const activePeriod = await getActivePeriod(supabase);
    return apiOk({
      ...data,
      period_year: activePeriod || data.period_year,
    });
  } catch {
    return apiInternalError();
  }
}

// PATCH /api/settings (ADMIN only)
export async function PATCH(request: Request) {
  try {
    const uid = getUid(request);
    const userRole = getUserRole(request);
    if (!uid) return apiUnauthorized();

    const forbidden = requireAccess(userRole, "settings-organization", "update");
    if (forbidden) return forbidden;

    const body = await request.json();
    const allowedFields = [
      "org_name",
      "org_description",
      "org_email",
      "org_logo_url",
      "org_address",
      "org_phone_number",
      "org_university",
      "org_social_media",
      "org_est_year",
      "is_maintenance",
    ];
    const safeUpdate: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) safeUpdate[key] = body[key];
    }

    if (Object.keys(safeUpdate).length === 0) {
      return apiBadRequest("Tidak ada field yang diizinkan untuk diubah.");
    }

    // Periode selalu mengikuti Periode Sertijab yang aktif berjalan.
    const supabase = await createSupabaseServer();
    const activePeriod = await getActivePeriod(supabase);
    if (activePeriod) safeUpdate.period_year = activePeriod;

    safeUpdate.updated_at = new Date().toISOString();

    const { data: current } = await supabase
      .from("organization_settings")
      .select("*")
      .limit(1)
      .single();

    if (!current) return apiNotFound("Pengaturan organisasi");

    const { data, error } = await supabase
      .from("organization_settings")
      .update(safeUpdate)
      .eq("id", current.id)
      .select()
      .single();

    if (error) return apiInternalError(error.message);

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    for (const key of Object.keys(safeUpdate)) {
      if (key === "updated_at") continue;
      if (JSON.stringify(current[key]) !== JSON.stringify(data[key])) {
        oldValue[key] = current[key] ?? null;
        newValue[key] = data[key] ?? null;
      }
    }

    await writeAuditLog({
      action: "UPDATE",
      targetTable: "organization_settings",
      targetId: current.id,
      userId: uid,
      oldValue: Object.keys(oldValue).length > 0 ? oldValue : null,
      newValue: Object.keys(newValue).length > 0 ? newValue : null,
    });

    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}
