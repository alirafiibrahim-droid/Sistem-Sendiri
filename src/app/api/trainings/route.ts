import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireRole } from "@/lib/authz";
import { trainingFormSchema } from "@/lib/validations/training";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const supabase = await createSupabaseServer();
    let query = supabase
      .from("trainings")
      .select("*", { count: "exact" })
      .order("name");

    if (category) query = query.eq("category", category);

    const { data, error, count } = await query;
    if (error) {
      console.error("TRAININGS GET ERROR:", error);
      return apiInternalError();
    }

    return apiOk(data, { total: count || 0 });
  } catch {
    return apiInternalError();
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const parsed = trainingFormSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
      .from("trainings")
      .insert(parsed.data)
      .select()
      .single();

    if (error) {
      console.error("TRAININGS INSERT ERROR:", error);
      return apiInternalError(error.message);
    }

    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
