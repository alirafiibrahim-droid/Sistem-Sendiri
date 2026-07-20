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
      .select("*, programs(id, name)")
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
    const { type, amount, description, date, program_id, receipt_url } = body;

    const updateData: Record<string, unknown> = {};
    if (type !== undefined) updateData.type = type;
    if (amount !== undefined) updateData.amount = amount;
    if (description !== undefined) updateData.description = description;
    if (date !== undefined) updateData.date = date;
    if (program_id !== undefined) updateData.program_id = program_id;
    if (receipt_url !== undefined) updateData.receipt_url = receipt_url;

    const { data, error } = await supabase
      .from("finances")
      .update(updateData)
      .eq("id", id)
      .select("*, programs(id, name)")
      .single();

    if (error) return apiInternalError();

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
