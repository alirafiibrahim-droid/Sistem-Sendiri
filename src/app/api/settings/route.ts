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
import { isAdmin } from "@/lib/authz";

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

    return apiOk(data);
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
    if (!isAdmin(userRole)) return apiForbidden();

    const body = await request.json();
    const allowedFields = [
      "org_name",
      "org_description",
      "org_email",
      "org_logo_url",
      "period_year",
      "is_maintenance",
    ];
    const safeUpdate: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) safeUpdate[key] = body[key];
    }

    if (Object.keys(safeUpdate).length === 0) {
      return apiBadRequest("Tidak ada field yang diizinkan untuk diubah.");
    }

    safeUpdate.updated_at = new Date().toISOString();

    const supabase = await createSupabaseServer();

    const { data: current } = await supabase
      .from("organization_settings")
      .select("id")
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
    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}
