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
import { requireAccess } from "@/lib/access";
import { financeFormSchema } from "@/lib/validations/finance";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";
import type { FinanceWithDetails, Profile } from "@/lib/types/database";

async function attachProfiles(
  finances: FinanceWithDetails[],
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>
): Promise<FinanceWithDetails[]> {
  const userIds = [
    ...new Set(finances.map((f) => f.created_by).filter(Boolean) as string[]),
  ];
  if (userIds.length === 0) return finances;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles || []).map((p: Pick<Profile, "id" | "full_name">) => [p.id, p])
  );

  return finances.map((f) => ({
    ...f,
    profiles: f.created_by ? profileMap.get(f.created_by) || null : null,
  }));
}

/** Transaksi dari modul lain (bukan '+ Catat Transaksi') tidak boleh diubah. */
function isExternal(source: string | null): boolean {
  return (source || "keuangan") !== "keuangan";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const forbidden = requireAccess(role, "finances-detail", "read");
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("finances")
      .select("*, programs(id, name), incidental_projects(id, name), wallets(id, name), banks(id, name), cash_accounts(id, name), handovers(id, period_from, period_to, status)")
      .eq("id", id)
      .single();

    if (error || !data) return apiNotFound();

    const result = (await attachProfiles([data as FinanceWithDetails], supabase))[0];
    result.is_external = isExternal(data.source);

    return apiOk(result);
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
    const forbidden = requireAccess(role, "finances", "update");
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("finances")
      .select("id, source, type, amount, description, date")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound();

    if (isExternal(existing.source)) {
      return apiForbidden(
        "Transaksi berasal dari modul lain dan tidak dapat diubah dari modul Keuangan. Ubah di modul asalnya."
      );
    }

    const body = await request.json();

    const parsed = financeFormSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const {
      type,
      amount,
      description,
      date,
      program_id,
      project_id,
      handover_id,
      receipt_url,
      receipt_urls,
      wallet_id,
      bank_id,
      cash_account_id,
    } = parsed.data;

    const receiptUrls = (receipt_urls || []).filter((u: string) => u.trim() !== "");

    const updateData: Record<string, unknown> = {
      type,
      amount,
      description,
      date,
      program_id: program_id || null,
      project_id: project_id || null,
      handover_id: handover_id || null,
      receipt_url:
        receiptUrls.length > 0 ? receiptUrls.join("\n") : receipt_url || "",
      wallet_id: wallet_id || null,
      bank_id: bank_id || null,
      cash_account_id: cash_account_id || null,
    };

    const { data, error } = await supabase
      .from("finances")
      .update(updateData)
      .eq("id", id)
      .select("*, programs(id, name), incidental_projects(id, name), wallets(id, name), banks(id, name), cash_accounts(id, name), handovers(id, period_from, period_to, status)")
      .single();

    if (error) {
      console.error("FINANCES UPDATE ERROR:", error);
      return apiInternalError(error.message);
    }

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    const existingRow = existing as unknown as Record<string, unknown>;
    const updatedRow = data as unknown as Record<string, unknown>;
    for (const key of ["type", "amount", "description", "date", "program_id", "project_id"]) {
      if (JSON.stringify(existingRow[key]) !== JSON.stringify(updatedRow[key])) {
        oldValue[key] = existingRow[key] ?? null;
        newValue[key] = updatedRow[key] ?? null;
      }
    }

    await writeAuditLog({
      action: "UPDATE",
      targetTable: "finances",
      targetId: id,
      userId: uid,
      oldValue: Object.keys(oldValue).length > 0 ? oldValue : null,
      newValue: Object.keys(newValue).length > 0 ? newValue : null,
    });

    const result = (await attachProfiles([data as FinanceWithDetails], supabase))[0];

    return apiOk(result);
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
    const forbidden = requireAccess(role, "finances", "delete");
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("finances")
      .select("id, source, type, amount, description, date")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound();

    if (isExternal(existing.source)) {
      return apiForbidden(
        "Transaksi berasal dari modul lain dan tidak dapat dihapus dari modul Keuangan. Hapus di modul asalnya."
      );
    }

    const { error } = await supabase.from("finances").delete().eq("id", id);

    if (error) return apiInternalError();

    await writeAuditLog({
      action: "DELETE",
      targetTable: "finances",
      targetId: id,
      userId: uid,
      oldValue: {
        type: existing.type,
        amount: existing.amount,
        description: existing.description,
        date: existing.date,
      },
    });

    return apiOk({ message: "Deleted successfully" });
  } catch {
    return apiInternalError();
  }
}
