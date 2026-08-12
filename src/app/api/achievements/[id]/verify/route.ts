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
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    const role = getUserRole(request);
    if (!uid) return apiUnauthorized();

    const forbidden = requireAccess(role, "achievements-verify", "create");
    if (forbidden) return forbidden;

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

    await writeAuditLog({
      action: "UPDATE",
      targetTable: "achievements",
      targetId: id,
      userId: uid,
      newValue: {
        status,
        rejection_reason: status === "REJECTED" ? rejection_reason : null,
      },
    });

    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}
