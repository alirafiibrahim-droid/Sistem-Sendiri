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
import { walletFormSchema } from "@/lib/validations/settings";
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
      .from("wallets")
      .select("*, banks(id, name), cash_accounts(id, name)")
      .eq("id", id)
      .single();

    if (error || !data) return apiNotFound("Dompet");
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
      .from("wallets")
      .select("id")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound("Dompet");

    const body = await request.json();
    const parsed = walletFormSchema.partial().safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const { data, error } = await supabase
      .from("wallets")
      .update(parsed.data)
      .eq("id", id)
      .select("*, banks(id, name), cash_accounts(id, name)")
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
      .from("wallets")
      .select("id")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound("Dompet");

    const { error } = await supabase.from("wallets").delete().eq("id", id);
    if (error) return apiInternalError();

    return apiOk({ message: "Deleted successfully" });
  } catch {
    return apiInternalError();
  }
}
