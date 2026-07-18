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
import { NextRequest } from "next/server";

const PATCH_ALLOWED_ROLES = ["ADMIN", "PENGURUS_INTI", "KABID"];

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
      .select("*, profiles(id, full_name), programs(id, name)")
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
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    if (!role || !PATCH_ALLOWED_ROLES.includes(role)) return apiForbidden();

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
      .select("*, profiles(id, full_name), programs(id, name)")
      .single();

    if (error) return apiInternalError();

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
    if (role !== "ADMIN") return apiForbidden();

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
