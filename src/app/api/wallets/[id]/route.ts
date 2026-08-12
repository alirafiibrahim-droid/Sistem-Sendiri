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
import { walletFormSchema } from "@/lib/validations/settings";
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
      .from("wallets")
      .select("*, banks(id, name), cash_accounts(id, name)")
      .eq("id", id)
      .single();

    if (error || !data) return apiNotFound("Dompet");
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
    const forbidden = requireAccess(role, "settings-wallets", "update");
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("wallets")
      .select("id, name, bank_id, cash_account_id, is_active")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound("Dompet");

    const body = await request.json();
    const parsed = walletFormSchema.partial().safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const { data, error } = await supabase
      .from("wallets")
      .update(parsed.data)
      .eq("id", id)
      .select("*, banks(id, name), cash_accounts(id, name)")
      .single();

    if (error) return apiInternalError(error.message);

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    const existingRow = existing as unknown as Record<string, unknown>;
    const updatedRow = data as unknown as Record<string, unknown>;
    for (const key of ["name", "description", "bank_id", "cash_account_id", "is_active"]) {
      if (JSON.stringify(existingRow[key]) !== JSON.stringify(updatedRow[key])) {
        oldValue[key] = existingRow[key] ?? null;
        newValue[key] = updatedRow[key] ?? null;
      }
    }

    await writeAuditLog({
      action: "UPDATE",
      targetTable: "wallets",
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
    const forbidden = requireAccess(role, "settings-wallets", "delete");
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("wallets")
      .select("id, name")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound("Dompet");

    const { error } = await supabase.from("wallets").delete().eq("id", id);
    if (error) return apiInternalError();

    await writeAuditLog({
      action: "DELETE",
      targetTable: "wallets",
      targetId: id,
      userId: uid,
      oldValue: existing ? { name: existing.name } : null,
    });

    return apiOk({ message: "Deleted successfully" });
  } catch {
    return apiInternalError();
  }
}
