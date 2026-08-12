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
import { cashAccountFormSchema } from "@/lib/validations/settings";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { id } = await params;
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
      .from("cash_accounts")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return apiNotFound("Kas");
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
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const forbidden = requireAccess(role, "settings-cash-bank", "update");
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("cash_accounts")
      .select("id, name, description")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound("Kas");

    const body = await request.json();
    const parsed = cashAccountFormSchema.partial().safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const { data, error } = await supabase
      .from("cash_accounts")
      .update(parsed.data)
      .eq("id", id)
      .select()
      .single();

    if (error) return apiInternalError(error.message);

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    const existingRow = existing as unknown as Record<string, unknown>;
    const updatedRow = data as unknown as Record<string, unknown>;
    for (const key of ["name", "description"]) {
      if (JSON.stringify(existingRow[key]) !== JSON.stringify(updatedRow[key])) {
        oldValue[key] = existingRow[key] ?? null;
        newValue[key] = updatedRow[key] ?? null;
      }
    }

    await writeAuditLog({
      action: "UPDATE",
      targetTable: "cash_accounts",
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
    const forbidden = requireAccess(role, "settings-cash-bank", "delete");
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("cash_accounts")
      .select("id, name")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound("Kas");

    const { error } = await supabase.from("cash_accounts").delete().eq("id", id);
    if (error) return apiInternalError();

    await writeAuditLog({
      action: "DELETE",
      targetTable: "cash_accounts",
      targetId: id,
      userId: uid,
      oldValue: existing ? { name: existing.name } : null,
    });

    return apiOk({ message: "Deleted successfully" });
  } catch {
    return apiInternalError();
  }
}
