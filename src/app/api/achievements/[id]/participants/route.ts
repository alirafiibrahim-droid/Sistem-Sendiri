import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiNotFound,
  apiBadRequest,
  apiInternalError,
  getUid,
} from "@/lib/api-response";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("achievement_participants")
      .select("*, profiles(id, full_name, nim, avatar_url)")
      .eq("achievement_id", id);

    if (error) throw error;

    return apiOk(data);
  } catch (error) {
    return apiInternalError();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { id } = await params;
    const supabase = await createSupabaseServer();
    const body = await request.json();

    const { user_id, role_in_achievement } = body;

    if (!user_id) {
      return apiBadRequest("user_id is required");
    }

    const { data: existing } = await supabase
      .from("achievement_participants")
      .select("id")
      .eq("achievement_id", id)
      .eq("user_id", user_id)
      .single();

    if (existing) {
      return apiBadRequest("Participant already exists for this achievement");
    }

    const { data, error } = await supabase
      .from("achievement_participants")
      .insert({
        achievement_id: id,
        user_id,
        role_in_achievement: role_in_achievement || null,
      })
      .select()
      .single();

    if (error) throw error;

    return apiCreated(data);
  } catch (error) {
    return apiInternalError();
  }
}
