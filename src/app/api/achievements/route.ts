import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { attachHandovers } from "@/lib/handover";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { achievementFormSchema } from "@/lib/validations/achievement";
import { requireAccess } from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";
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
    const juara = searchParams.get("juara") || "";
    const start_date = searchParams.get("start_date");
    const end_date = searchParams.get("end_date");

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("achievements")
      .select("*", { count: "exact" });

    if (juara) {
      const { data: viaParticipants } = await supabase
        .from("achievement_participants")
        .select("achievement_id")
        .eq("juara", juara);
      const { data: viaAchievements } = await supabase
        .from("achievements")
        .select("id")
        .eq("juara", juara);

      const ids = [
        ...new Set([
          ...(viaParticipants || []).map((m) => m.achievement_id),
          ...(viaAchievements || []).map((a) => a.id),
        ]),
      ];
      query = query.in("id", ids);
    }

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
    if (start_date) {
      query = query.gte("achievement_date", start_date);
    }
    if (end_date) {
      query = query.lte("achievement_date", end_date);
    }

    const { data, error, count } = await query
      .order(sort, { ascending: order === "asc" })
      .range(from, to);

    if (error) {
      console.error("ACHIEVEMENTS GET ERROR:", error);
      return apiInternalError();
    }

    const result = await attachProfiles(data as AchievementWithParticipants[], supabase);

    const withPeriods = await attachHandovers(result, createSupabaseAdmin());

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return apiOk(withPeriods, { total, page, limit, totalPages });
  } catch (e) {
    console.error("ACHIEVEMENTS GET ERROR:", e);
    return apiInternalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const forbidden = requireAccess(getUserRole(request), "achievements", "create");
    if (forbidden) return forbidden;

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
      juara,
      category,
      level,
      organizer,
      achievement_date,
      proof_url,
      handover_id,
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
        juara: type === "ORGANIZATION" ? (juara || null) : null,
        organizer: organizer || null,
        achievement_date,
        proof_url: proof_url || null,
        handover_id: handover_id || null,
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
        juara: type === "ORGANIZATION" ? null : p.juara,
        keterangan: p.keterangan || null,
      }));

      const { error: participantError } = await supabase
        .from("achievement_participants")
        .insert(rows);

      if (participantError) {
        console.error("ACHIEVEMENTS PARTICIPANTS INSERT ERROR:", participantError);
      }
    }

    await writeAuditLog({
      action: "CREATE",
      targetTable: "achievements",
      targetId: achievement.id,
      userId: uid,
      newValue: {
        title,
        type,
        category,
        level,
        juara: achievement.juara,
        achievement_date,
        participants: participants?.length || 0,
      },
    });

    return apiCreated(achievement);
  } catch (e) {
    console.error("ACHIEVEMENTS POST ERROR:", e);
    return apiInternalError();
  }
}
