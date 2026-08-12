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
      .from("athlete_targets")
      .select("*, athletic_metrics(id, name, type, unit)")
      .eq("id", id)
      .single();

    if (error || !data) return apiNotFound();
    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    const role = getUserRole(request);
    if (!uid) return apiUnauthorized();
    const forbidden = requireAccess(role, "athlete-performance", "update");
    if (forbidden) return forbidden;

    const { id } = await params;
    const body = await request.json();

    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("athlete_targets")
      .select("id, athlete_id, metric_id, target_value")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound();

    const { data, error } = await supabase
      .from("athlete_targets")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) return apiInternalError();
    if (!data) return apiNotFound();

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    const existingRow = existing as unknown as Record<string, unknown>;
    const updatedRow = data as unknown as Record<string, unknown>;
    for (const key of ["athlete_id", "metric_id", "target_value", "is_active"]) {
      if (JSON.stringify(existingRow[key]) !== JSON.stringify(updatedRow[key])) {
        oldValue[key] = existingRow[key] ?? null;
        newValue[key] = updatedRow[key] ?? null;
      }
    }

    await writeAuditLog({
      action: "UPDATE",
      targetTable: "athlete_targets",
      targetId: id,
      userId: uid,
      oldValue: Object.keys(oldValue).length > 0 ? oldValue : null,
      newValue: Object.keys(newValue).length > 0 ? newValue : null,
    });

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
      .from("athlete_targets")
      .select("id, athlete_id, metric_id, target_value")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("athlete_targets")
      .delete()
      .eq("id", id);

    if (error) return apiInternalError();

    await writeAuditLog({
      action: "DELETE",
      targetTable: "athlete_targets",
      targetId: id,
      userId: uid,
      oldValue: existing
        ? {
            athlete_id: existing.athlete_id,
            metric_id: existing.metric_id,
            target_value: existing.target_value,
          }
        : null,
    });

    return apiOk({ deleted: true });
  } catch {
    return apiInternalError();
  }
}
