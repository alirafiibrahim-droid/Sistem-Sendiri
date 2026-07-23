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
import { trainingFormSchema } from "@/lib/validations/training";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("trainings")
      .select("*")
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
    const role = getUserRole(request);
    if (!uid) return apiUnauthorized();

    const forbidden = requireRole(role, [
      "ADMIN",
      "PENGURUS_INTI",
      "KABID",
      "PELATIH",
    ]);
    if (forbidden) return forbidden;

    const { id } = await params;
    const body = await request.json();
    const parsed = trainingFormSchema.partial().safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
      .from("trainings")
      .update(parsed.data)
      .eq("id", id)
      .select()
      .single();

    if (error) return apiInternalError();
    if (!data) return apiNotFound();
    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(_request);
    const role = getUserRole(_request);
    if (!uid) return apiUnauthorized();

    const forbidden = requireRole(role, ["ADMIN", "PENGURUS_INTI"]);
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { error } = await supabase.from("trainings").delete().eq("id", id);
    if (error) return apiInternalError();
    return apiOk({ deleted: true });
  } catch {
    return apiInternalError();
  }
}
