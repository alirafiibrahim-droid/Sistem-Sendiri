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
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
      .from("athletic_metrics")
      .select("*")
      .order("name");

    if (error) return apiInternalError();
    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const uid = getUid(request);
    const role = getUserRole(request);
    if (!uid) return apiUnauthorized();
    const forbidden = requireRole(role, ["PENGURUS_INTI", "KABID"]);
    if (forbidden) return forbidden;

    const body = await request.json();
    const { name, type, unit } = body;

    if (!name || !type || !unit) return apiBadRequest("name, type, unit are required");

    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
      .from("athletic_metrics")
      .insert({ name, type, unit })
      .select()
      .single();

    if (error) return apiInternalError();
    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
