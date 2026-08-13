import { createSupabaseServer } from "@/lib/supabase/server";
import { generateUniqueSessionCodes } from "@/lib/session-code";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireAccess } from "@/lib/access";
import { trainingSessionSchema } from "@/lib/validations/training";
import { writeAuditLog } from "@/lib/audit";
import { attachHandovers } from "@/lib/handover";
import { NextRequest } from "next/server";
import type { Profile, Training, TrainingSessionWithCoach } from "@/lib/types/database";

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
      .select("*", { count: "exact" });

    if (start_date) query = query.gte("date", start_date);
    if (end_date) query = query.lte("date", end_date);
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,session_type.ilike.%${search}%`
      );
    }

    query = query.order(sort, { ascending: order === "asc" });
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) {
      console.error("TRAINING SESSIONS GET ERROR:", error);
      return apiInternalError();
    }

    let result = await attachProfiles(data as TrainingSessionWithCoach[], supabase);
    result = await attachHandovers(result, supabase);

    // Attach trainings (banyak latihan per sesi via junction)
    const sessionIds = result.map((s) => s.id);
    const trainingMap = new Map<string, Pick<Training, "id" | "name" | "category">>();
    if (sessionIds.length > 0) {
      const { data: links } = await supabase
        .from("training_session_trainings")
        .select("session_id, training_id")
        .in("session_id", sessionIds);

      const trainingIds = [...new Set((links || []).map((l) => l.training_id))];
      if (trainingIds.length > 0) {
        const { data: trainingsData } = await supabase
          .from("trainings")
          .select("id, name, category")
          .in("id", trainingIds);
        for (const t of trainingsData || []) trainingMap.set(t.id, t);
      }

      result = result.map((s) => {
        const linked =
          (links || [])
            .filter((l) => l.session_id === s.id)
            .map((l) => trainingMap.get(l.training_id))
            .filter((t): t is Pick<Training, "id" | "name" | "category"> => !!t);

        // Legacy: sesi lama memakai kolom training_id langsung
        if (s.training_id && !linked.some((t) => t.id === s.training_id)) {
          const legacy = trainingMap.get(s.training_id);
          if (legacy) linked.unshift(legacy);
        }

        return { ...s, trainings: linked };
      });
    }

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

    const forbidden = requireAccess(role, "training-sessions", "create");
    if (forbidden) return forbidden;

    const body = await request.json();

    const parsed = trainingSessionSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const { name, dates, training_ids, start_time, duration_minutes, intensity, athlete_ids, handover_id } = parsed.data;

    const supabase = await createSupabaseServer();

    const sessionCodes = await generateUniqueSessionCodes(supabase, "training_sessions", dates.length);

    const sessionsToInsert = dates.map((date, i) => ({
      coach_id: uid,
      name,
      date,
      session_code: sessionCodes[i],
      session_type: name,
      start_time,
      handover_id: handover_id || null,
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

    if (sessions) {
      const trainingLinks = sessions.flatMap((s) =>
        training_ids.map((training_id: string) => ({
          session_id: s.id,
          training_id,
        }))
      );

      const { error: linkError } = await supabase
        .from("training_session_trainings")
        .insert(trainingLinks);

      if (linkError) {
        console.error("TRAINING SESSION TRAININGS INSERT ERROR:", linkError);
        return apiInternalError(linkError.message);
      }
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

    for (const s of sessions ?? []) {
      await writeAuditLog({
        action: "CREATE",
        targetTable: "training_sessions",
        targetId: s.id,
        userId: uid,
        newValue: {
          name: s.name,
          date: s.date,
          session_code: s.session_code,
          start_time: s.start_time,
          handover_id: s.handover_id,
          duration_minutes: s.duration_minutes,
          intensity: s.intensity,
        },
      });
    }

    return apiCreated(sessions);
  } catch (e) {
    console.error("TRAINING SESSIONS POST ERROR:", e);
    return apiInternalError();
  }
}
