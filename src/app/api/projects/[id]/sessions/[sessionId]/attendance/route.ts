import { createSupabaseServer } from "@/lib/supabase/server";
import { normalizeSessionCode, isValidSessionCode } from "@/lib/session-code";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
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

async function attachProfiles(
  rows: AttendeeRow[],
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>
) {
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { sessionId } = await params;
    const body = await request.json();
    const { method, session_code } = body as { method?: string; session_code?: string };

    if (!method || !["MANUAL", "QR"].includes(method)) {
      return apiBadRequest("Method harus MANUAL atau QR.");
    }

    const supabase = await createSupabaseServer();

    let query = supabase.from("project_sessions").select("id, date").eq("id", sessionId);

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
      .from("project_session_attendants")
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
      targetTable: "project_session_attendants",
      targetId: data.id,
      userId: uid,
      newValue: {
        session_id: sessionId,
        user_id: uid,
        method,
        scanned_at: data.scanned_at ?? null,
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
      .from("project_session_attendants")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });

    if (error) return apiInternalError();
    return apiOk(await attachProfiles((data || []) as AttendeeRow[], supabase));
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
    const forbidden = requireAccess(role, "projects", "update");
    if (forbidden) return forbidden;

    const { sessionId } = await params;
    const body = await request.json();
    const { scores } = body as {
      scores?: Array<{ attendee_id?: string; score?: number | null; notes?: string | null }>;
    };

    if (!Array.isArray(scores) || scores.length === 0) {
      return apiBadRequest("Data nilai tidak boleh kosong.");
    }

    const supabase = await createSupabaseServer();

    const { data: session } = await supabase
      .from("project_sessions")
      .select("id")
      .eq("id", sessionId)
      .single();

    if (!session) return apiNotFound("Sesi tidak ditemukan.");

    const updates: { attendee_id: string; score: number | null; notes: string | null }[] = [];

    for (const item of scores) {
      if (!item.attendee_id) return apiBadRequest("attendee_id wajib diisi.");
      const score = item.score ?? null;
      if (score !== null && (!Number.isInteger(score) || score < 1 || score > 10)) {
        return apiBadRequest("Nilai harus berupa angka bulat 1-10.");
      }
      const notes = item.notes == null ? null : String(item.notes).trim() || null;
      updates.push({ attendee_id: item.attendee_id, score, notes });
    }

    for (const u of updates) {
      const { error } = await supabase
        .from("project_session_attendants")
        .update({ score: u.score, notes: u.notes })
        .eq("id", u.attendee_id)
        .eq("session_id", sessionId);

      if (error) return apiInternalError(error.message);
    }

    const { data: refreshed } = await supabase
      .from("project_session_attendants")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });

    if (refreshed === null) {
      return apiInternalError("Gagal memuat ulang daftar hadir.");
    }

    return apiOk(await attachProfiles((refreshed || []) as AttendeeRow[], supabase));
  } catch (e) {
    console.error("SESSION SCORES PATCH ERROR:", e);
    return apiInternalError();
  }
}
