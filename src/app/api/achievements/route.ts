import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiBadRequest,
  apiInternalError,
  getUid,
} from "@/lib/api-response";
import { achievementFormSchema } from "@/lib/validations/achievement";
import { NextRequest } from "next/server";
import type { AchievementWithParticipants, Profile } from "@/lib/types/database";

async function attachProfiles(
  achievements: AchievementWithParticipants[],
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>
): Promise<AchievementWithParticipants[]> {
  const userIds = [
    ...new Set(achievements.map((a) => a.created_by).filter(Boolean) as string[]),
  ];
  if (userIds.length === 0) return achievements;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles || []).map((p: Pick<Profile, "id" | "full_name">) => [p.id, p])
  );

  return achievements.map((a) => ({
    ...a,
    profiles: a.created_by ? profileMap.get(a.created_by) || null : null,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const supabase = await createSupabaseServer();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const search = searchParams.get("search") || "";
    const sort = searchParams.get("sort") || "created_at";
    const order = searchParams.get("order") || "desc";
    const type = searchParams.get("type") || "";
    const status = searchParams.get("status") || "";
    const level = searchParams.get("level") || "";

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("achievements")
      .select("*", { count: "exact" });

    if (search) {
      query = query.ilike("title", `%${search}%`);
    }
    if (type) {
      query = query.eq("type", type);
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (level) {
      query = query.eq("level", level);
    }

    const { data, error, count } = await query
      .order(sort, { ascending: order === "asc" })
      .range(from, to);

    if (error) {
      console.error("ACHIEVEMENTS GET ERROR:", error);
      return apiInternalError();
    }

    const result = await attachProfiles(data as AchievementWithParticipants[], supabase);

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return apiOk(result, { total, page, limit, totalPages });
  } catch (e) {
    console.error("ACHIEVEMENTS GET ERROR:", e);
    return apiInternalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const body = await request.json();

    const parsed = achievementFormSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const {
      title,
      description,
      type,
      category,
      level,
      organizer,
      achievement_date,
      proof_url,
      participants,
    } = parsed.data;

    const supabase = await createSupabaseServer();

    const { data: achievement, error: insertError } = await supabase
      .from("achievements")
      .insert({
        title,
        description: description || null,
        type,
        category,
        level,
        organizer: organizer || null,
        achievement_date,
        proof_url: proof_url || null,
        created_by: uid,
        status: "PENDING",
      })
      .select()
      .single();

    if (insertError) {
      console.error("ACHIEVEMENTS INSERT ERROR:", insertError);
      return apiInternalError(insertError.message);
    }

    if (participants && participants.length > 0) {
      const rows = participants.map((p) => ({
        achievement_id: achievement.id,
        user_id: p.user_id,
        juara: p.juara,
        keterangan: p.keterangan || null,
      }));

      const { error: participantError } = await supabase
        .from("achievement_participants")
        .insert(rows);

      if (participantError) {
        console.error("ACHIEVEMENTS PARTICIPANTS INSERT ERROR:", participantError);
      }
    }

    return apiCreated(achievement);
  } catch (e) {
    console.error("ACHIEVEMENTS POST ERROR:", e);
    return apiInternalError();
  }
}
