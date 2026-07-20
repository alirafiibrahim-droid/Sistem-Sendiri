import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { isAdmin } from "@/lib/authz";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const uid = await getUid(request);
    if (!uid) return apiUnauthorized();

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 25;
    const search = searchParams.get("search") || "";
    const sort = searchParams.get("sort") || "created_at";
    const order = searchParams.get("order") || "desc";

    let query = supabase
      .from("handovers")
      .select("*, profiles(id, full_name)", { count: "exact" });

    if (search) {
      query = query.or(
        `period_from.ilike.%${search}%,period_to.ilike.%${search}%,status.ilike.%${search}%`
      );
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await query
      .order(sort, { ascending: order === "asc" })
      .range(from, to);

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
    const supabase = await createSupabaseServer();
    const uid = await getUid(request);
    if (!uid) return apiUnauthorized();

    const role = await getUserRole(request);
    if (!isAdmin(role)) return apiForbidden();

    const body = await request.json();
    const { period_from, period_to, handover_date, witnesses } = body;

    if (!period_from || !period_to || !handover_date) {
      return apiBadRequest("Missing required fields: period_from, period_to, handover_date");
    }

    const { data, error } = await supabase
      .from("handovers")
      .insert({
        period_from,
        period_to,
        handover_date,
        witnesses: witnesses || [],
        status: "DRAFT",
        created_by: uid,
      })
      .select("*, profiles(id, full_name)")
      .single();

    if (error) return apiInternalError();

    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
