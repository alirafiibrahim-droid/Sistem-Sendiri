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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(_request);
    if (!uid) return apiUnauthorized();

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: session, error } = await supabase
      .from("training_sessions")
      .select("id, date, session_type, trainings(name, category)")
      .eq("id", id)
      .single();

    if (error || !session) return apiNotFound();

    const origin = _request.headers.get("origin") || "http://localhost:3000";
    const scanUrl = `${origin}/athletics/scan?session=${id}`;

    return apiOk({
      session_id: id,
      scan_url: scanUrl,
      session,
    });
  } catch {
    return apiInternalError();
  }
}
