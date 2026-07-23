import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiUnauthorized,
  apiBadRequest,
  apiInternalError,
  getUid,
} from "@/lib/api-response";
import { NextRequest } from "next/server";

interface CategoryScore {
  category: string;
  avg_score: number;
  assessment_count: number;
}

const ALL_CATEGORIES = [
  "STRENGTH", "POWER", "SPEED", "AGILITY",
  "ENDURANCE", "FLEXIBILITY", "TEKNIK", "MENTAL", "GAME_INTELLIGENCE",
];

export async function GET(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { searchParams } = new URL(request.url);
    const athlete_id = searchParams.get("athlete_id") || uid;

    const supabase = await createSupabaseServer();

    // Get metrics with categories
    const { data: metrics, error: mErr } = await supabase
      .from("athletic_metrics")
      .select("id, category");

    if (mErr) return apiInternalError();

    const metricsWithCategory = (metrics || []).filter(
      (m) => m.category !== null
    );

    if (metricsWithCategory.length === 0) {
      return apiOk(
        ALL_CATEGORIES.map((c) => ({
          category: c,
          avg_score: 0,
          assessment_count: 0,
        }))
      );
    }

    const metricIds = metricsWithCategory.map((m) => m.id);
    const metricCategoryMap = new Map(
      metricsWithCategory.map((m) => [m.id, m.category])
    );

    // Get assessments for this athlete
    const { data: assessments, error: aErr } = await supabase
      .from("assessments")
      .select("metric_id, value")
      .eq("athlete_id", athlete_id)
      .in("metric_id", metricIds);

    if (aErr) return apiInternalError();

    // Group by category and compute average
    const categoryMap = new Map<string, number[]>();
    for (const a of assessments || []) {
      const cat = metricCategoryMap.get(a.metric_id);
      if (cat) {
        if (!categoryMap.has(cat)) categoryMap.set(cat, []);
        categoryMap.get(cat)!.push(Number(a.value));
      }
    }

    const scores: CategoryScore[] = ALL_CATEGORIES.map((cat) => {
      const values = categoryMap.get(cat) || [];
      const avg =
        values.length > 0
          ? values.reduce((sum, v) => sum + v, 0) / values.length
          : 0;
      return {
        category: cat,
        avg_score: Math.round(avg * 100) / 100,
        assessment_count: values.length,
      };
    });

    return apiOk(scores);
  } catch {
    return apiInternalError();
  }
}
