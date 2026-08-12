import { NextRequest } from "next/server";
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
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { attachHandovers } from "@/lib/handover";
import { writeAuditLog } from "@/lib/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const forbidden = requireAccess(role, "projects-detail", "read");
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("incidental_projects")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return apiNotFound();

    const [withPeriod] = await attachHandovers([data], createSupabaseAdmin());

    return apiOk(withPeriod);
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
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const forbidden = requireAccess(role, "projects", "update");
    if (forbidden) return forbidden;

    const { id } = await params;
    const body = await request.json();

    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("incidental_projects")
      .select("id, name, description, urgency_level, start_date, end_date, budget_source, status")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound();

    const allowedFields = [
      "name",
      "description",
      "urgency_level",
      "start_date",
      "end_date",
      "budget_source",
      "handover_id",
      "status",
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return apiOk(existing);
    }

    const { data, error } = await supabase
      .from("incidental_projects")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    const existingRow = existing as unknown as Record<string, unknown>;
    const updatedRow = data as unknown as Record<string, unknown>;
    for (const key of ["name", "description", "urgency_level", "start_date", "end_date", "budget_source", "status"]) {
      if (JSON.stringify(existingRow[key]) !== JSON.stringify(updatedRow[key])) {
        oldValue[key] = existingRow[key] ?? null;
        newValue[key] = updatedRow[key] ?? null;
      }
    }

    await writeAuditLog({
      action: "UPDATE",
      targetTable: "incidental_projects",
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
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const forbidden = requireAccess(role, "projects-detail", "delete");
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("incidental_projects")
      .select("id, name, urgency_level, status")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound();

    const { error } = await supabase
      .from("incidental_projects")
      .delete()
      .eq("id", id);

    if (error) throw error;

    await writeAuditLog({
      action: "DELETE",
      targetTable: "incidental_projects",
      targetId: id,
      userId: uid,
      oldValue: {
        name: existing.name,
        urgency_level: existing.urgency_level,
        status: existing.status,
      },
    });

    return apiOk({ deleted: true });
  } catch {
    return apiInternalError();
  }
}
