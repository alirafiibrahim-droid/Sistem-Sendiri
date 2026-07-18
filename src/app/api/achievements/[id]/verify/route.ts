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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    const role = getUserRole(request);
    if (!uid) return apiUnauthorized();

    const allowedRoles = ["ADMIN", "PENGURUS_INTI"];
    if (!allowedRoles.includes(role)) return apiForbidden();

    const { id } = await params;
    const supabase = await createSupabaseServer();
    const body = await request.json();

    const { status, rejection_reason } = body;

    if (!status || !["APPROVED", "REJECTED"].includes(status)) {
      return apiBadRequest("Status must be APPROVED or REJECTED");
    }

    if (status === "REJECTED" && !rejection_reason) {
      return apiBadRequest("Rejection reason is required when rejecting");
    }

    const { data: existing, error: fetchError } = await supabase
      .from("achievements")
      .select("id")
      .eq("id", id)
      .single();

    if (fetchError || !existing) return apiNotFound();

    const { data, error } = await supabase
      .from("achievements")
      .update({
        status,
        rejection_reason: status === "REJECTED" ? rejection_reason : null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return apiOk(data);
  } catch (error) {
    return apiInternalError();
  }
}
