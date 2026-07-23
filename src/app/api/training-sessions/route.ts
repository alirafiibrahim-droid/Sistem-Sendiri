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
import { trainingSessionSchema } from "@/lib/validations/training";
import { NextRequest } from "next/server";
import type { Profile, TrainingSessionWithCoach } from "@/lib/types/database";

async function attachProfiles(
  sessions: TrainingSessionWithCoach[],
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>
): Promise<TrainingSessionWithCoach[]> {
  const userIds = [
    ...new Set(sessions.map((s) => s.coach_id).filter(Boolean) as string[]),
  ];
  if (userIds.length === 0) return sessions;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles || []).map((p: Pick<Profile, "id" | "full_name">) => [p.id, p])
  );

  return sessions.map((s) => ({
    ...s,
    profiles: s.coach_id ? profileMap.get(s.coach_id) || null : null,
  }));
}

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
      .select("*, trainings(id, name, category)", { count: "exact" });

    if (start_date) query = query.gte("date", start_date);
    if (end_date) query = query.lte("date", end_date);
    if (search) query = query.ilike("session_type", `%${search}%`);

    query = query.order(sort, { ascending: order === "asc" });
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) {
      console.error("TRAINING SESSIONS GET ERROR:", error);
      return apiInternalError();
    }

    const result = await attachProfiles(data as TrainingSessionWithCoach[], supabase);

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return apiOk(result, { total, page, limit, totalPages });
  } catch (e) {
    console.error("TRAINING SESSIONS GET ERROR:", e);
    return apiInternalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const uid = getUid(request);
    const role = getUserRole(request);
    if (!uid) return apiUnauthorized();

    const forbidden = requireRole(role, ["PENGURUS_INTI", "KABID", "PELATIH"]);
    if (forbidden) return forbidden;

    const body = await request.json();

    const parsed = trainingSessionSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const { dates, training_id, session_type, duration_minutes, intensity, athlete_ids } = parsed.data;

    const supabase = await createSupabaseServer();

    const sessionsToInsert = dates.map((date) => ({
      coach_id: uid,
      training_id: training_id || null,
      date,
      session_type: session_type || null,
      duration_minutes,
      intensity,
    }));

    const { data: sessions, error: sessionError } = await supabase
      .from("training_sessions")
      .insert(sessionsToInsert)
      .select();

    if (sessionError) {
      console.error("TRAINING SESSIONS INSERT ERROR:", sessionError);
      return apiInternalError(sessionError.message);
    }

    if (athlete_ids && athlete_ids.length > 0 && sessions) {
      const attendants = sessions.flatMap((s) =>
        athlete_ids.map((athlete_id: string) => ({
          session_id: s.id,
          athlete_id,
          method: "MANUAL" as const,
        }))
      );

      const { error: attError } = await supabase
        .from("training_session_attendants")
        .insert(attendants);

      if (attError) {
        console.error("TRAINING SESSIONS ATTENDANTS INSERT ERROR:", attError);
      }
    }

    return apiCreated(sessions);
  } catch (e) {
    console.error("TRAINING SESSIONS POST ERROR:", e);
    return apiInternalError();
  }
}
