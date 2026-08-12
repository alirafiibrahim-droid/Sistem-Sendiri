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
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const forbidden = requireAccess(role, "finances", "update");
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("dues_payments")
      .select("id")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound();

    const body = await request.json();
    const { status, feedback } = body;

    if (!status || !["PAID", "UNPAID"].includes(status)) {
      return apiBadRequest("Status must be PAID or UNPAID");
    }

    const { data, error } = await supabase
      .from("dues_payments")
      .update({
        status,
        feedback: feedback || null,
        verified_by: uid,
        verified_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(
        "*, profiles(id, full_name, nim), dues_templates(id, title, amount, due_date)"
      )
      .single();

    if (error) return apiInternalError();

    await writeAuditLog({
      action: "UPDATE",
      targetTable: "dues_payments",
      targetId: id,
      userId: uid,
      newValue: {
        status,
        feedback: feedback || null,
        verified_by: uid,
      },
    });

    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}
