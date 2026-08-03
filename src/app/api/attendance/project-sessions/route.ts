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

// GET /api/attendance/project-sessions — list sessions available for attendance
export async function GET(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const supabase = await createSupabaseServer();
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("project_sessions")
      .select("id, date, title, project_id, incidental_projects!inner(name)")
      .gte("date", twoDaysAgo)
      .order("date", { ascending: true });

    if (error) return apiInternalError(error.message);

    // Attach user attendance status
    const result = await Promise.all(
      (data || []).map(async (s) => {
        const { count } = await supabase
          .from("project_session_attendants")
          .select("id", { count: "exact", head: true })
          .eq("session_id", s.id)
          .eq("user_id", uid);
        return {
          id: s.id,
          date: s.date,
          title: s.title,
          project_id: s.project_id,
          project_name: (s.incidental_projects as unknown as { name: string } | null)?.name ?? "",
          has_attended: (count || 0) > 0,
        };
      })
    );

    return apiOk(result);
  } catch {
    return apiInternalError();
  }
}

// POST /api/attendance/project-sessions — record attendance
export async function POST(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const body = await request.json();
    const { session_id, method } = body as { session_id?: string; method?: string };

    if (!session_id) {
      return apiBadRequest("session_id wajib diisi.");
    }

    if (!method || !["MANUAL", "QR"].includes(method)) {
      return apiBadRequest("Method harus MANUAL atau QR.");
    }

    const supabase = await createSupabaseServer();

    // Verify session exists and check H+2
    const { data: session, error: sErr } = await supabase
      .from("project_sessions")
      .select("id, date")
      .eq("id", session_id)
      .single();

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
          session_id,
          user_id: uid,
          method,
          scanned_at: method === "QR" ? new Date().toISOString() : null,
        },
        { onConflict: "session_id,user_id" }
      )
      .select()
      .single();

    if (error) return apiInternalError(error.message);
    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
