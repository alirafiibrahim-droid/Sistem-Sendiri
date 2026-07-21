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
import { requireRole } from "@/lib/authz";
import { bankFormSchema } from "@/lib/validations/settings";
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
      .from("banks")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return apiNotFound("Bank");
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
    const forbidden = requireRole(role, ["ADMIN", "PENGURUS_INTI"]);
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("banks")
      .select("id")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound("Bank");

    const body = await request.json();
    const parsed = bankFormSchema.partial().safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const { data, error } = await supabase
      .from("banks")
      .update(parsed.data)
      .eq("id", id)
      .select()
      .single();

    if (error) return apiInternalError(error.message);
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
    const forbidden = requireRole(role, ["ADMIN", "PENGURUS_INTI"]);
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("banks")
      .select("id")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound("Bank");

    const { error } = await supabase.from("banks").delete().eq("id", id);
    if (error) return apiInternalError();

    return apiOk({ message: "Deleted successfully" });
  } catch {
    return apiInternalError();
  }
}
