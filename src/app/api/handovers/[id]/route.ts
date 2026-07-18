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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServer();
    const uid = await getUid(request);
    if (!uid) return apiUnauthorized();

    const { id } = await params;

    const { data, error } = await supabase
      .from("handovers")
      .select("*, profiles(id, full_name)")
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
    const supabase = await createSupabaseServer();
    const uid = await getUid(request);
    if (!uid) return apiUnauthorized();

    const role = await getUserRole(request);
    if (!["ADMIN", "PENGURUS_INTI"].includes(role)) {
      return apiForbidden();
    }

    const { id } = await params;
    const body = await request.json();

    const { data: existing } = await supabase
      .from("handovers")
      .select("id")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound();

    const { data, error } = await supabase
      .from("handovers")
      .update(body)
      .eq("id", id)
      .select("*, profiles(id, full_name)")
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
    const supabase = await createSupabaseServer();
    const uid = await getUid(request);
    if (!uid) return apiUnauthorized();

    const role = await getUserRole(request);
    if (role !== "ADMIN") return apiForbidden();

    const { id } = await params;

    const { data: existing } = await supabase
      .from("handovers")
      .select("id")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound();

    const { error } = await supabase.from("handovers").delete().eq("id", id);

    if (error) return apiInternalError();

    return apiOk({ message: "Handover deleted" });
  } catch {
    return apiInternalError();
  }
}
