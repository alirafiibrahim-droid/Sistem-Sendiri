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
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const search = searchParams.get("search") || "";
    const sort = searchParams.get("sort") || "created_at";
    const order = searchParams.get("order") || "desc";
    const athlete_id = searchParams.get("athlete_id");

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const supabase = await createSupabaseServer();
    let query = supabase
      .from("athlete_targets")
      .select("*, athletic_metrics(id, name, type, unit)", { count: "exact" });

    if (athlete_id) query = query.eq("athlete_id", athlete_id);

    query = query.order(sort, { ascending: order === "asc" });
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) return apiInternalError();

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return apiOk(data, { total, page, limit, totalPages });
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
    const { athlete_id, metric_id, target_value } = body;

    if (!athlete_id || !metric_id || target_value === undefined) {
      return apiBadRequest("athlete_id, metric_id, target_value are required");
    }

    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
      .from("athlete_targets")
      .insert({
        athlete_id,
        metric_id,
        target_value,
        is_active: true,
      })
      .select()
      .single();

    if (error) return apiInternalError();
    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
