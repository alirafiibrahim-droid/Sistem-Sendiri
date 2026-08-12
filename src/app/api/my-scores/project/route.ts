import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiUnauthorized,
  apiInternalError,
  getUid,
} from "@/lib/api-response";
import { NextRequest } from "next/server";

// GET /api/my-scores/project — riwayat & rata-rata nilai sesi proyek insidental milik user
export async function GET(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("project_session_attendants")
      .select("score, project_sessions!inner(date)")
      .eq("user_id", uid)
      .not("score", "is", null);

    if (error) return apiInternalError(error.message);

    const points = (data || []).map((r) => ({
      date: (r.project_sessions as unknown as { date: string }).date,
      score: Number(r.score),
    }));
    points.sort((a, b) => a.date.localeCompare(b.date));

    const total = points.length;
    const average =
      total > 0
        ? points.reduce((sum, p) => sum + p.score, 0) / total
        : 0;

    return apiOk({ average: Math.round(average * 100) / 100, total, points });
  } catch {
    return apiInternalError();
  }
}
