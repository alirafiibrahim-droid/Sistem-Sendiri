import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiUnauthorized,
  apiNotFound,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireRole } from "@/lib/authz";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServer();

    // Step 1: fetch session (no joins)
    const { data: session, error } = await supabase
      .from("training_sessions")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !session) return apiNotFound();

    // Step 2: attach coach profile
    let profiles = null;
    if (session.coach_id) {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", session.coach_id)
        .single();
      profiles = p || null;
    }

    // Step 3: attach training data
    let trainings = null;
    if (session.training_id) {
      const { data: t } = await supabase
        .from("trainings")
        .select("id, name, category")
        .eq("id", session.training_id)
        .single();
      trainings = t || null;
    }

    // Step 4: attach attendants + their profiles
    const { data: attendantsRaw } = await supabase
      .from("training_session_attendants")
      .select("*")
      .eq("session_id", id);

    let attendants: Array<Record<string, unknown>> = attendantsRaw || [];
    if (attendants.length > 0) {
      const athleteIds = [...new Set(attendants.map((a) => a.athlete_id))];
      const { data: attProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, nim, avatar_url")
        .in("id", athleteIds);
      const profileMap = new Map((attProfiles || []).map((p) => [p.id, p]));
      attendants = attendants.map((a) => ({
        ...a,
        profiles: profileMap.get(a.athlete_id) || null,
      }));
    }

    return apiOk({
      ...session,
      profiles,
      trainings,
      training_session_attendants: attendants,
    });
  } catch {
    return apiInternalError();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    const role = getUserRole(request);
    if (!uid) return apiUnauthorized();
    if (role !== "coach") {
      const forbidden = requireRole(role, ["PENGURUS_INTI", "KABID"]);
      if (forbidden) return forbidden;
    }

    const { id } = await params;
    const body = await request.json();
    const { athlete_ids, ...sessionData } = body;

    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("training_sessions")
      .update(sessionData)
      .eq("id", id)
      .select()
      .single();

    if (error) return apiInternalError();
    if (!data) return apiNotFound();

    if (athlete_ids !== undefined) {
      await supabase
        .from("training_session_attendants")
        .delete()
        .eq("session_id", id);

      if (athlete_ids.length > 0) {
        const attendants = athlete_ids.map((athlete_id: string) => ({
          session_id: id,
          athlete_id,
        }));

        const { error: attError } = await supabase
          .from("training_session_attendants")
          .insert(attendants);

        if (attError) return apiInternalError();
      }
    }

    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    const role = getUserRole(request);
    if (!uid) return apiUnauthorized();
    if (role !== "coach") {
      const forbidden = requireRole(role, ["PENGURUS_INTI", "KABID"]);
      if (forbidden) return forbidden;
    }

    const { id } = await params;
    const supabase = await createSupabaseServer();

    await supabase
      .from("training_session_attendants")
      .delete()
      .eq("session_id", id);

    const { error } = await supabase
      .from("training_sessions")
      .delete()
      .eq("id", id);

    if (error) return apiInternalError();
    return apiOk({ deleted: true });
  } catch {
    return apiInternalError();
  }
}
