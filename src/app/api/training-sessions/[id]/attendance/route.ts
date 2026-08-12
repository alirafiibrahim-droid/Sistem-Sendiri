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
} from "@/lib/api-response";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";
import type { Profile } from "@/lib/types/database";

interface AttendeeRow {
  id: string;
  session_id: string;
  athlete_id: string;
  method: string;
  scanned_at: string | null;
  created_at: string;
}

async function attachProfiles(
  rows: AttendeeRow[],
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>
) {
  const userIds = [...new Set(rows.map((r) => r.athlete_id).filter(Boolean))];
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
    profiles: r.athlete_id ? profileMap.get(r.athlete_id) || null : null,
  }));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { id } = await params;
    const body = await request.json();
    const { method, session_code } = body as { method?: string; session_code?: string };

    if (!method || !["MANUAL", "QR"].includes(method)) {
      return apiBadRequest("Method harus MANUAL atau QR.");
    }

    const supabase = await createSupabaseServer();

    let query = supabase.from("training_sessions").select("id, date").eq("id", id);

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

    // Verify session exists and check H+2
    const { data: session, error: sErr } = await query.single();

    if (sErr || !session) return apiNotFound("Sesi latihan tidak ditemukan.");

    const sessionDate = new Date(session.date);
    const limitDate = new Date(sessionDate.getTime() + 3 * 86400000);
    limitDate.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (now >= limitDate) {
      return apiBadRequest("Batas absensi sesi ini sudah lewat (maksimal H+2 dari tanggal sesi).");
    }

    // Upsert attendance
    const { data, error } = await supabase
      .from("training_session_attendants")
      .upsert(
        {
          session_id: id,
          athlete_id: uid,
          method: method,
          scanned_at: method === "QR" ? new Date().toISOString() : null,
        },
        { onConflict: "session_id,athlete_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("ATTENDANCE INSERT ERROR:", error);
      return apiInternalError(error.message);
    }

    await writeAuditLog({
      action: "CREATE",
      targetTable: "training_session_attendants",
      targetId: data.id,
      userId: uid,
      newValue: {
        session_id: id,
        athlete_id: uid,
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("training_session_attendants")
      .select("*")
      .eq("session_id", id)
      .order("created_at", { ascending: false });

    if (error) return apiInternalError();
    return apiOk(await attachProfiles((data || []) as AttendeeRow[], supabase));
  } catch {
    return apiInternalError();
  }
}
