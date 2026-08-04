import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiUnauthorized,
  apiInternalError,
  getUid,
} from "@/lib/api-response";
import { NextRequest } from "next/server";

interface ProgressPoint {
  date: string;
  value: number;
  createdAt?: string;
  sessionId?: string | null;
}

interface CategoryProgress {
  category: string;
  points: ProgressPoint[];
}

const ALL_CATEGORIES = [
  "STRENGTH", "POWER", "SPEED", "AGILITY",
  "ENDURANCE", "FLEXIBILITY", "GAME_INTELLIGENCE", "TEKNIK", "MENTAL",
];

export async function GET(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { searchParams } = new URL(request.url);
    const athlete_id = searchParams.get("athlete_id") || uid;

    const supabase = await createSupabaseServer();

    const { data: metrics, error: mErr } = await supabase
      .from("athletic_metrics")
      .select("id, category");

    if (mErr) return apiInternalError();

    const metricsWithCategory = (metrics || []).filter(
      (m) => m.category !== null
    );

    if (metricsWithCategory.length === 0) {
      return apiOk<CategoryProgress[]>([]);
    }

    const metricIds = metricsWithCategory.map((m) => m.id);
    const metricCategoryMap = new Map(
      metricsWithCategory.map((m) => [m.id, m.category])
    );

    const { data: assessments, error: aErr } = await supabase
      .from("assessments")
      .select("metric_id, value, created_at, session_id")
      .eq("athlete_id", athlete_id)
      .in("metric_id", metricIds);

    if (aErr) return apiInternalError();

    const sessionIds = Array.from(
      new Set(
        (assessments || [])
          .map((a) => a.session_id)
          .filter((s): s is string => !!s)
      )
    );

    const sessionDateMap = new Map<string, string>();
    if (sessionIds.length > 0) {
      const { data: sessions, error: sErr } = await supabase
        .from("training_sessions")
        .select("id, date")
        .in("id", sessionIds);

      if (sErr) return apiInternalError();

      for (const s of sessions || []) {
        sessionDateMap.set(s.id, s.date);
      }
    }

    const categoryPoints = new Map<string, ProgressPoint[]>();

    for (const a of assessments || []) {
      const cat = metricCategoryMap.get(a.metric_id);
      if (!cat) continue;
      const date =
        (a.session_id && sessionDateMap.get(a.session_id)) ||
        a.created_at.slice(0, 10);
      if (!categoryPoints.has(cat)) categoryPoints.set(cat, []);
      categoryPoints
        .get(cat)!
        .push({
          date,
          value: Number(a.value),
          createdAt: a.created_at,
          sessionId: a.session_id,
        });
    }

    const series: CategoryProgress[] = ALL_CATEGORIES
      .map((cat) => {
        const raw = categoryPoints.get(cat) || [];

        // Satu penilaian per sesi latihan (ambil yang terbaru bila ada duplikat).
        const bySession = new Map<string, ProgressPoint>();
        for (const p of raw) {
          const key = p.sessionId || `${p.date}|${p.createdAt}`;
          const prev = bySession.get(key);
          if (!prev || (prev.createdAt || "") < (p.createdAt || "")) bySession.set(key, p);
        }

        // Aturan bisnis: bila ada penilaian variabel sama pada hari yang sama
        // (beberapa sesi), nilai dirata-ratakan menjadi satu titik.
        const byDate = new Map<string, number[]>();
        for (const p of bySession.values()) {
          if (!byDate.has(p.date)) byDate.set(p.date, []);
          byDate.get(p.date)!.push(p.value);
        }

        const points = Array.from(byDate.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, values]) => ({
            date,
            value:
              Math.round(
                (values.reduce((sum, v) => sum + v, 0) / values.length) * 100
              ) / 100,
          }));

        return { category: cat, points };
      })
      .filter((s) => s.points.length > 0);

    return apiOk(series);
  } catch {
    return apiInternalError();
  }
}
