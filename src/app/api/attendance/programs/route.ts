import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiUnauthorized,
  apiInternalError,
  getUid,
} from "@/lib/api-response";
import { NextRequest } from "next/server";

// GET /api/attendance/programs — list active programs for attendance
export async function GET(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("programs")
      .select("id, name, start_date, end_date, status")
      .in("status", ["ONGOING", "PLANNED"])
      .order("start_date", { ascending: false });

    if (error) return apiInternalError(error.message);
    return apiOk(data || []);
  } catch {
    return apiInternalError();
  }
}
