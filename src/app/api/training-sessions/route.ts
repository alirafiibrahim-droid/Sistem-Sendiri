import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiForbidden,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { NextRequest } from "next/server";

const ALLOWED_ROLES = ["ADMIN", "PENGURUS_INTI", "KABID", "coach"];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const search = searchParams.get("search") || "";
    const sort = searchParams.get("sort") || "date";
    const order = searchParams.get("order") || "desc";
    const start_date = searchParams.get("start_date");
    const end_date = searchParams.get("end_date");

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const supabase = await createSupabaseServer();
    let query = supabase
      .from("training_sessions")
      .select("*, profiles(id, full_name)", { count: "exact" });

    if (start_date) query = query.gte("date", start_date);
    if (end_date) query = query.lte("date", end_date);
    if (search) query = query.ilike("session_type", `%${search}%`);

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
    if (!ALLOWED_ROLES.includes(role)) return apiForbidden();

    const body = await request.json();
    const { date, session_type, duration_minutes, intensity, athlete_ids } = body;

    if (!date || !session_type || !duration_minutes || !intensity) {
      return apiBadRequest("date, session_type, duration_minutes, intensity are required");
    }

    const supabase = await createSupabaseServer();

    const coach_id = uid;

    const { data: session, error: sessionError } = await supabase
      .from("training_sessions")
      .insert({
        coach_id,
        date,
        session_type,
        duration_minutes,
        intensity,
      })
      .select()
      .single();

    if (sessionError) return apiInternalError();

    if (athlete_ids && athlete_ids.length > 0) {
      const attendants = athlete_ids.map((athlete_id: string) => ({
        session_id: session.id,
        athlete_id,
      }));

      const { error: attError } = await supabase
        .from("training_session_attendants")
        .insert(attendants);

      if (attError) return apiInternalError();
    }

    return apiCreated(session);
  } catch {
    return apiInternalError();
  }
}
