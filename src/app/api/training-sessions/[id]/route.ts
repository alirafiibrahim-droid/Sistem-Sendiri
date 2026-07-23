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

    // Try with trainings join first (needs migration); fallback without
    let query = supabase
      .from("training_sessions")
      .select("*, profiles(id, full_name), training_session_attendants(*, profiles(id, full_name, nim, avatar_url))")
      .eq("id", id)
      .single();

    const { data, error } = await query;

    if (error || !data) return apiNotFound();

    // Attempt to attach trainings data if training_id exists
    if (data.training_id) {
      const { data: training } = await supabase
        .from("trainings")
        .select("id, name, category")
        .eq("id", data.training_id)
        .single();
      data.trainings = training || null;
    } else {
      data.trainings = null;
    }

    return apiOk(data);
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
