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
import { NextRequest } from "next/server";

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
      .select("*, profiles(id, full_name)", { count: "exact" });

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

    if (error) throw error;

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return apiOk(data, { total, page, limit, totalPages });
  } catch (error) {
    return apiInternalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const supabase = await createSupabaseServer();
    const body = await request.json();

    const {
      title,
      description,
      type,
      category,
      level,
      organizer,
      achievement_date,
      proof_url,
      participant_ids,
    } = body;

    if (!title || !description || !type || !category || !level) {
      return apiBadRequest("Missing required fields");
    }

    const { data: achievement, error: insertError } = await supabase
      .from("achievements")
      .insert({
        title,
        description,
        type,
        category,
        level,
        organizer: organizer || null,
        achievement_date: achievement_date || null,
        proof_url: proof_url || null,
        created_by: uid,
        status: "PENDING",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    if (participant_ids && participant_ids.length > 0) {
      const participants = participant_ids.map((userId: string) => ({
        achievement_id: achievement.id,
        user_id: userId,
      }));

      const { error: participantError } = await supabase
        .from("achievement_participants")
        .insert(participants);

      if (participantError) throw participantError;
    }

    return apiCreated(achievement);
  } catch (error) {
    return apiInternalError();
  }
}
