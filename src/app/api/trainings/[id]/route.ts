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
import { trainingFormSchema } from "@/lib/validations/training";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("trainings")
      .select("*")
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

    const forbidden = requireAccess(role, "trainings", "update");
    if (forbidden) return forbidden;

    const { id } = await params;
    const body = await request.json();
    const parsed = trainingFormSchema.partial().safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("trainings")
      .select("id, name, category, description")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound();

    const { data, error } = await supabase
      .from("trainings")
      .update(parsed.data)
      .eq("id", id)
      .select()
      .single();

    if (error) return apiInternalError();
    if (!data) return apiNotFound();

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    const existingRow = existing as unknown as Record<string, unknown>;
    const updatedRow = data as unknown as Record<string, unknown>;
    for (const key of ["name", "category", "description"]) {
      if (JSON.stringify(existingRow[key]) !== JSON.stringify(updatedRow[key])) {
        oldValue[key] = existingRow[key] ?? null;
        newValue[key] = updatedRow[key] ?? null;
      }
    }

    await writeAuditLog({
      action: "UPDATE",
      targetTable: "trainings",
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(_request);
    const role = getUserRole(_request);
    if (!uid) return apiUnauthorized();

    const forbidden = requireAccess(role, "trainings", "delete");
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("trainings")
      .select("id, name")
      .eq("id", id)
      .single();

    const { error } = await supabase.from("trainings").delete().eq("id", id);
    if (error) return apiInternalError();

    await writeAuditLog({
      action: "DELETE",
      targetTable: "trainings",
      targetId: id,
      userId: uid,
      oldValue: existing ? { name: existing.name } : null,
    });

    return apiOk({ deleted: true });
  } catch {
    return apiInternalError();
  }
}
