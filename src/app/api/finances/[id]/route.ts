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
import { isAdmin, requireRole } from "@/lib/authz";
import { financeFormSchema } from "@/lib/validations/finance";
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
      .from("finances")
      .select("*, programs(id, name), incidental_projects(id, name), wallets(id, name), banks(id, name), cash_accounts(id, name)")
      .eq("id", id)
      .single();

    if (error || !data) return apiNotFound();

    const result = (await attachProfiles([data as FinanceWithDetails], supabase))[0];

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
    const forbidden = requireRole(role, ["PENGURUS_INTI", "KABID"]);
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("finances")
      .select("id")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound();

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
      receipt_url,
      wallet_id,
      bank_id,
      cash_account_id,
    } = parsed.data;

    const updateData: Record<string, unknown> = {
      type,
      amount,
      description,
      date,
      program_id: program_id || null,
      project_id: project_id || null,
      receipt_url: receipt_url || "",
      wallet_id: wallet_id || null,
      bank_id: bank_id || null,
      cash_account_id: cash_account_id || null,
    };

    const { data, error } = await supabase
      .from("finances")
      .update(updateData)
      .eq("id", id)
      .select("*, programs(id, name), incidental_projects(id, name), wallets(id, name), banks(id, name), cash_accounts(id, name)")
      .single();

    if (error) {
      console.error("FINANCES UPDATE ERROR:", error);
      return apiInternalError(error.message);
    }

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
    if (!isAdmin(role)) return apiForbidden();

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("finances")
      .select("id")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound();

    const { error } = await supabase.from("finances").delete().eq("id", id);

    if (error) return apiInternalError();

    return apiOk({ message: "Deleted successfully" });
  } catch {
    return apiInternalError();
  }
}
