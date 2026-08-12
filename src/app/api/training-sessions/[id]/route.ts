import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiUnauthorized,
  apiNotFound,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireAccess } from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";
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

    // Step 3: attach trainings (banyak latihan per sesi via junction)
    const { data: links } = await supabase
      .from("training_session_trainings")
      .select("training_id")
      .eq("session_id", id);

    const trainings: Array<{ id: string; name: string; category: string }> = [];
    const trainingIds = (links || []).map((l) => l.training_id);
    if (session.training_id && !trainingIds.includes(session.training_id)) {
      trainingIds.push(session.training_id);
    }
    if (trainingIds.length > 0) {
      const { data: t } = await supabase
        .from("trainings")
        .select("id, name, category")
        .in("id", trainingIds);
      const trainingMap = new Map((t || []).map((tr) => [tr.id, tr]));
      for (const tid of trainingIds) {
        const item = trainingMap.get(tid);
        if (item) trainings.push(item);
      }
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
      const forbidden = requireAccess(role, "training-sessions", "update");
      if (forbidden) return forbidden;
    }

    const { id } = await params;
    const body = await request.json();
    const { athlete_ids, training_ids, ...sessionData } = body;

    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("training_sessions")
      .select("id, name, date, session_type, duration_minutes, intensity")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound();

    const { data, error } = await supabase
      .from("training_sessions")
      .update(sessionData)
      .eq("id", id)
      .select()
      .single();

    if (error) return apiInternalError();
    if (!data) return apiNotFound();

    if (training_ids !== undefined) {
      await supabase
        .from("training_session_trainings")
        .delete()
        .eq("session_id", id);

      if (training_ids.length > 0) {
        const links = training_ids.map((training_id: string) => ({
          session_id: id,
          training_id,
        }));

        const { error: linkError } = await supabase
          .from("training_session_trainings")
          .insert(links);

        if (linkError) return apiInternalError();
      }
    }

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

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    const existingRow = existing as unknown as Record<string, unknown>;
    const updatedRow = data as unknown as Record<string, unknown>;
    for (const key of ["name", "date", "session_type", "duration_minutes", "intensity"]) {
      if (JSON.stringify(existingRow[key]) !== JSON.stringify(updatedRow[key])) {
        oldValue[key] = existingRow[key] ?? null;
        newValue[key] = updatedRow[key] ?? null;
      }
    }

    await writeAuditLog({
      action: "UPDATE",
      targetTable: "training_sessions",
      targetId: id,
      userId: uid,
      oldValue: Object.keys(oldValue).length > 0 ? oldValue : null,
      newValue: Object.keys(newValue).length > 0 ? newValue : null,
    });

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
      const forbidden = requireAccess(role, "training-sessions", "delete");
      if (forbidden) return forbidden;
    }

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("training_sessions")
      .select("id, name, date")
      .eq("id", id)
      .single();

    await supabase
      .from("training_session_attendants")
      .delete()
      .eq("session_id", id);

    const { error } = await supabase
      .from("training_sessions")
      .delete()
      .eq("id", id);

    if (error) return apiInternalError();

    await writeAuditLog({
      action: "DELETE",
      targetTable: "training_sessions",
      targetId: id,
      userId: uid,
      oldValue: existing ? { name: existing.name, date: existing.date } : null,
    });

    return apiOk({ deleted: true });
  } catch {
    return apiInternalError();
  }
}
