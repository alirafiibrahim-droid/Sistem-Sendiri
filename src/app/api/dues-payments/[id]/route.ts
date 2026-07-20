import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { isRoleAllowed } from "@/lib/authz";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const { id } = await params;
    const supabase = await createSupabaseServer();

    let query = supabase
      .from("dues_payments")
      .select(
        "*, profiles(id, full_name, nim), dues_templates(id, title, amount, due_date)"
      )
      .eq("id", id)
      .single();

    if (!isRoleAllowed(role, ["PENGURUS_INTI", "KABID"])) {
      query = supabase
        .from("dues_payments")
        .select(
          "*, profiles(id, full_name, nim), dues_templates(id, title, amount, due_date)"
        )
        .eq("id", id)
        .eq("user_id", uid)
        .single();
    }

    const { data, error } = await query;

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
    const { id } = await params;
    const supabase = await createSupabaseServer();

    const isAdminUser = isRoleAllowed(role, ["PENGURUS_INTI"]);

    let baseQuery = supabase
      .from("dues_payments")
      .select("id, user_id, status")
      .eq("id", id);

    if (!isAdminUser) {
      baseQuery = baseQuery.eq("user_id", uid);
    }

    const { data: existing } = await baseQuery.single();

    if (!existing) return apiNotFound();

    const body = await request.json();

    if (isAdminUser) {
      const { status, feedback, verified_by, verified_at, ...rest } = body;
      const updateData: Record<string, unknown> = { ...rest };
      if (status !== undefined) updateData.status = status;
      if (feedback !== undefined) updateData.feedback = feedback;
      if (verified_by !== undefined) updateData.verified_by = verified_by;
      if (verified_at !== undefined) updateData.verified_at = verified_at;

      const { data, error } = await supabase
        .from("dues_payments")
        .update(updateData)
        .eq("id", id)
        .select(
          "*, profiles(id, full_name, nim), dues_templates(id, title, amount, due_date)"
        )
        .single();

      if (error) return apiInternalError();

      return apiOk(data);
    }

    if (
      existing.status !== "UNPAID" &&
      existing.status !== "PENDING_VERIFICATION"
    ) {
      return apiForbidden();
    }

    const { payment_date, proof_url } = body;
    const updateData: Record<string, unknown> = {};
    if (payment_date !== undefined) updateData.payment_date = payment_date;
    if (proof_url !== undefined) updateData.proof_url = proof_url;

    const { data, error } = await supabase
      .from("dues_payments")
      .update(updateData)
      .eq("id", id)
      .select(
        "*, profiles(id, full_name, nim), dues_templates(id, title, amount, due_date)"
      )
      .single();

    if (error) return apiInternalError();

    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}
