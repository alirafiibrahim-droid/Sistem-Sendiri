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
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("assessments")
      .select("*, athletic_metrics(id, name, type, unit), profiles(id, full_name, nim)")
      .eq("id", id)
      .single();

    if (error || !data) return apiNotFound();
    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    const role = getUserRole(request);
    if (!uid) return apiUnauthorized();
    const forbidden = requireAccess(role, "athlete-performance", "delete");
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("assessments")
      .select("id, athlete_id, metric_id, value")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("assessments")
      .delete()
      .eq("id", id);

    if (error) return apiInternalError();

    await writeAuditLog({
      action: "DELETE",
      targetTable: "assessments",
      targetId: id,
      userId: uid,
      oldValue: existing
        ? {
            athlete_id: existing.athlete_id,
            metric_id: existing.metric_id,
            value: existing.value,
          }
        : null,
    });

    return apiOk({ deleted: true });
  } catch {
    return apiInternalError();
  }
}
