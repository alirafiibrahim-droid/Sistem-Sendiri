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
import { bankFormSchema } from "@/lib/validations/settings";
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
      .from("banks")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return apiNotFound("Bank");
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
      .from("banks")
      .select("id, name, account_number, account_holder, description")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound("Bank");

    const body = await request.json();
    const parsed = bankFormSchema.partial().safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const { data, error } = await supabase
      .from("banks")
      .update(parsed.data)
      .eq("id", id)
      .select()
      .single();

    if (error) return apiInternalError(error.message);

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    const existingRow = existing as unknown as Record<string, unknown>;
    const updatedRow = data as unknown as Record<string, unknown>;
    for (const key of ["name", "account_number", "account_holder", "description"]) {
      if (JSON.stringify(existingRow[key]) !== JSON.stringify(updatedRow[key])) {
        oldValue[key] = existingRow[key] ?? null;
        newValue[key] = updatedRow[key] ?? null;
      }
    }

    await writeAuditLog({
      action: "UPDATE",
      targetTable: "banks",
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
      .from("banks")
      .select("id, name, account_number, account_holder")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound("Bank");

    const { error } = await supabase.from("banks").delete().eq("id", id);
    if (error) return apiInternalError();

    await writeAuditLog({
      action: "DELETE",
      targetTable: "banks",
      targetId: id,
      userId: uid,
      oldValue: {
        name: existing.name,
        account_number: existing.account_number,
        account_holder: existing.account_holder,
      },
    });

    return apiOk({ message: "Deleted successfully" });
  } catch {
    return apiInternalError();
  }
}
