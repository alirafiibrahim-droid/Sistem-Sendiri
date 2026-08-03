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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { id } = await params;
    const body = await request.json();
    const { method } = body as { method?: string };

    if (!method || !["MANUAL", "QR"].includes(method)) {
      return apiBadRequest("Method harus MANUAL atau QR.");
    }

    const supabase = await createSupabaseServer();

    // Verify session exists and check H+2
    const { data: session, error: sErr } = await supabase
      .from("training_sessions")
      .select("id, date")
      .eq("id", id)
      .single();

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
      .select("*, profiles(id, full_name, nim, avatar_url)")
      .eq("session_id", id)
      .order("created_at", { ascending: false });

    if (error) return apiInternalError();
    return apiOk(data || []);
  } catch {
    return apiInternalError();
  }
}
