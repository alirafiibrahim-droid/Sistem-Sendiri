import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiUnauthorized,
  apiNotFound,
  apiInternalError,
  getUid,
} from "@/lib/api-response";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const uid = getUid(_request);
    if (!uid) return apiUnauthorized();

    const { sessionId } = await params;
    const supabase = await createSupabaseServer();

    const { data: session, error } = await supabase
      .from("program_sessions")
      .select("id, date, title, program_id")
      .eq("id", sessionId)
      .single();

    if (error || !session) return apiNotFound();

    const origin = _request.headers.get("origin") || "http://localhost:3000";
    const scanUrl = `${origin}/attendance?program_session=${sessionId}`;

    return apiOk({
      session_id: sessionId,
      scan_url: scanUrl,
      session,
    });
  } catch {
    return apiInternalError();
  }
}
