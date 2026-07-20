import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiNotFound,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireRole } from "@/lib/authz";

export async function GET(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 25));
    const search = searchParams.get("search") || "";
    const sort = searchParams.get("sort") || "created_at";
    const order = searchParams.get("order") === "asc" ? true : false;
    const status = searchParams.get("status");

    const supabase = await createSupabaseServer();

    let query = supabase
      .from("incidental_projects")
      .select("*", { count: "exact" });

    if (status) {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query
      .order(sort, { ascending: order })
      .range(from, to);

    if (error) throw error;

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
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const forbidden = requireRole(role, ["PENGURUS_INTI", "KABID"]);
    if (forbidden) return forbidden;

    const body = await request.json();
    const { name, description, urgency_level, start_date, end_date, budget_source } = body;

    if (!name || !urgency_level || !start_date || !end_date) {
      return apiBadRequest("Missing required fields");
    }

    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("incidental_projects")
      .insert({
        name,
        description,
        urgency_level,
        start_date,
        end_date,
        budget_source,
        status: "PROPOSED",
        created_by: uid,
      })
      .select()
      .single();

    if (error) throw error;

    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
