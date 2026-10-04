import { createSupabaseServer } from "@/lib/supabase/server";
import { isProgramLocked } from "@/lib/program-lock";
import { normalizeSessionCode, isValidSessionCode } from "@/lib/session-code";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireAccess } from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";
import type { Profile } from "@/lib/types/database";

interface AttendeeRow {
  id: string;
  session_id: string;
  user_id: string;
  method: string;
  scanned_at: string | null;
  score: number | null;
  notes: string | null;
  created_at: string;
}

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServer>>;

async function attachProfiles(rows: AttendeeRow[], supabase: SupabaseClient) {
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  if (userIds.length === 0) return rows;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, nim, avatar_url")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles || []).map((p: Pick<Profile, "id" | "full_name" | "nim" | "avatar_url">) => [p.id, p])
  );

  return rows.map((r) => ({
    ...r,
    profiles: r.user_id ? profileMap.get(r.user_id) || null : null,
  }));
}

// Menyisipkan nilai per parameter (parameter_id -> score) pada setiap peserta.
async function attachParameterScores<T extends { id: string }>(rows: T[], supabase: SupabaseClient) {
  if (rows.length === 0) return rows;

  const { data: scores } = await supabase
    .from("program_session_attendant_scores")
    .select("attendant_id, parameter_id, score")
    .in(
      "attendant_id",
      rows.map((r) => r.id)
    );

  const byAttendant = new Map<string, Record<string, number>>();
  for (const s of scores || []) {
    const bucket = byAttendant.get(s.attendant_id) || {};
    bucket[s.parameter_id] = s.score;
    byAttendant.set(s.attendant_id, bucket);
  }

  return rows.map((r) => ({ ...r, parameter_scores: byAttendant.get(r.id) || {} }));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { id, sessionId } = await params;
    const body = await request.json();
    const { method, session_code } = body as { method?: string; session_code?: string };

    if (!method || !["MANUAL", "QR"].includes(method)) {
      return apiBadRequest("Method harus MANUAL atau QR.");
    }

    const supabase = await createSupabaseServer();

    if (await isProgramLocked(supabase, id)) {
      return apiForbidden("Program pada periode yang telah selesai tidak dapat diubah.");
    }

    let query = supabase.from("program_sessions").select("id, date").eq("id", sessionId);

    if (method === "MANUAL") {
      if (!session_code) {
        return apiBadRequest("Kode Unit wajib diisi untuk absensi manual.");
      }
      const normalized = normalizeSessionCode(session_code);
      if (!isValidSessionCode(normalized)) {
        return apiBadRequest("Format Kode Unit tidak valid (7 karakter huruf/angka).");
      }
      query = query.eq("session_code", normalized);
    }

    const { data: session, error: sErr } = await query.single();

    if (sErr || !session) return apiNotFound("Sesi tidak ditemukan.");

    const sessionDate = new Date(session.date);
    const limitDate = new Date(sessionDate.getTime() + 3 * 86400000);
    limitDate.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (now >= limitDate) {
      return apiBadRequest("Batas absensi sesi ini sudah lewat (maksimal H+2 dari tanggal sesi).");
    }

    const { data, error } = await supabase
      .from("program_session_attendants")
      .upsert(
        {
          session_id: sessionId,
          user_id: uid,
          method,
          scanned_at: method === "QR" ? new Date().toISOString() : null,
        },
        { onConflict: "session_id,user_id" }
      )
      .select()
      .single();

    if (error) return apiInternalError(error.message);

    await writeAuditLog({
      action: "CREATE",
      targetTable: "program_session_attendants",
      targetId: data.id,
      userId: uid,
      newValue: {
        session_id: sessionId,
        user_id: uid,
        method,
      },
    });

    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("program_session_attendants")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });

    if (error) return apiInternalError();
    return apiOk(
      await attachParameterScores(await attachProfiles((data || []) as AttendeeRow[], supabase), supabase)
    );
  } catch {
    return apiInternalError();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const forbidden = requireAccess(role, "programs", "update");
    if (forbidden) return forbidden;

    const { id, sessionId } = await params;
    const body = await request.json();
    const { scores } = body as {
      scores?: Array<{
        attendee_id?: string;
        score?: number | null;
        notes?: string | null;
        parameter_scores?: Array<{ parameter_id?: string; score?: number | null }>;
      }>;
    };

    if (!Array.isArray(scores) || scores.length === 0) {
      return apiBadRequest("Data nilai tidak boleh kosong.");
    }

    const supabase = await createSupabaseServer();

    if (await isProgramLocked(supabase, id)) {
      return apiForbidden("Program pada periode yang telah selesai tidak dapat diubah.");
    }

    const { data: session } = await supabase
      .from("program_sessions")
      .select("id")
      .eq("id", sessionId)
      .single();

    if (!session) return apiNotFound("Sesi tidak ditemukan.");

    // Pastikan seluruh attendee_id memang peserta pada sesi ini.
    const { data: sessionAttendees } = await supabase
      .from("program_session_attendants")
      .select("id")
      .eq("session_id", sessionId);

    const validAttendeeIds = new Set((sessionAttendees || []).map((a) => a.id));

    const updates: { attendee_id: string; parameter_count: number }[] = [];

    for (const item of scores) {
      if (!item.attendee_id) return apiBadRequest("attendee_id wajib diisi.");
      if (!validAttendeeIds.has(item.attendee_id)) {
        return apiBadRequest("Peserta tidak ditemukan pada sesi ini.");
      }
      const notes = item.notes == null ? null : String(item.notes).trim() || null;

      if (Array.isArray(item.parameter_scores)) {
        const seen = new Set<string>();
        const upserts: { attendant_id: string; parameter_id: string; score: number }[] = [];
        const removals: string[] = [];

        for (const ps of item.parameter_scores) {
          if (!ps.parameter_id) return apiBadRequest("parameter_id wajib diisi.");
          if (seen.has(ps.parameter_id)) {
            return apiBadRequest("Parameter penilaian terduplikasi.");
          }
          seen.add(ps.parameter_id);

          const value = ps.score ?? null;
          if (value !== null && (!Number.isInteger(value) || value < 1 || value > 10)) {
            return apiBadRequest("Nilai harus berupa angka bulat 1-10.");
          }
          if (value === null) removals.push(ps.parameter_id);
          else upserts.push({ attendant_id: item.attendee_id, parameter_id: ps.parameter_id, score: value });
        }

        if (upserts.length > 0) {
          const { error } = await supabase
            .from("program_session_attendant_scores")
            .upsert(upserts, { onConflict: "attendant_id,parameter_id" });
          if (error) return apiInternalError(error.message);
        }

        if (removals.length > 0) {
          const { error } = await supabase
            .from("program_session_attendant_scores")
            .delete()
            .eq("attendant_id", item.attendee_id)
            .in("parameter_id", removals);
          if (error) return apiInternalError(error.message);
        }

        // Kolom score pada attendant = rata-rata seluruh nilai parameter.
        const { data: stored, error: sErr } = await supabase
          .from("program_session_attendant_scores")
          .select("score")
          .eq("attendant_id", item.attendee_id);
        if (sErr) return apiInternalError(sErr.message);

        const filled = (stored || []).map((r) => r.score as number);
        const average =
          filled.length > 0
            ? Math.round(filled.reduce((sum, n) => sum + n, 0) / filled.length)
            : null;

        const { error } = await supabase
          .from("program_session_attendants")
          .update({ score: average, notes })
          .eq("id", item.attendee_id)
          .eq("session_id", sessionId);
        if (error) return apiInternalError(error.message);

        updates.push({ attendee_id: item.attendee_id, parameter_count: upserts.length });
      } else {
        const score = item.score ?? null;
        if (score !== null && (!Number.isInteger(score) || score < 1 || score > 10)) {
          return apiBadRequest("Nilai harus berupa angka bulat 1-10.");
        }
        const { error } = await supabase
          .from("program_session_attendants")
          .update({ score, notes })
          .eq("id", item.attendee_id)
          .eq("session_id", sessionId);
        if (error) return apiInternalError(error.message);

        updates.push({ attendee_id: item.attendee_id, parameter_count: 0 });
      }
    }

    await writeAuditLog({
      action: "UPDATE",
      targetTable: "program_session_attendants",
      targetId: sessionId,
      userId: uid,
      newValue: { session_id: sessionId, score_updates: updates.length },
    });

    const { data: refreshed } = await supabase
      .from("program_session_attendants")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });

    return apiOk(
      await attachParameterScores(
        await attachProfiles((refreshed || []) as AttendeeRow[], supabase),
        supabase
      )
    );
  } catch (e) {
    console.error("SESSION SCORES PATCH ERROR:", e);
    return apiInternalError();
  }
}
