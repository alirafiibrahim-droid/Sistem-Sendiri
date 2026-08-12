import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiUnauthorized,
  apiInternalError,
  getUid,
} from "@/lib/api-response";
import { NextRequest } from "next/server";
import {
  JUARA_OPTIONS,
  LEVEL_OPTIONS,
  CATEGORY_OPTIONS,
} from "@/lib/achievement";

export async function GET(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const supabase = await createSupabaseServer();

    const juaraCounts: Record<string, number> = Object.fromEntries(
      JUARA_OPTIONS.map((j) => [j.value, 0])
    );
    const juaraAchievements: Record<string, Set<string>> = Object.fromEntries(
      JUARA_OPTIONS.map((j) => [j.value, new Set<string>()])
    );

    const { data: achievements } = await supabase
      .from("achievements")
      .select("id, juara, level, category");

    for (const a of achievements || []) {
      if (a.juara && juaraAchievements[a.juara]) {
        juaraAchievements[a.juara].add(a.id);
      }
    }

    const { data: participants } = await supabase
      .from("achievement_participants")
      .select("achievement_id, juara");

    for (const p of participants || []) {
      if (p.juara && juaraAchievements[p.juara]) {
        juaraAchievements[p.juara].add(p.achievement_id);
      }
    }
    for (const j of JUARA_OPTIONS) {
      juaraCounts[j.value] = juaraAchievements[j.value].size;
    }

    const levelCounts: Record<string, number> = Object.fromEntries(
      LEVEL_OPTIONS.map((l) => [l, 0])
    );
    const categoryCounts: Record<string, number> = Object.fromEntries(
      CATEGORY_OPTIONS.map((c) => [c, 0])
    );

    for (const a of achievements || []) {
      if (levelCounts[a.level] !== undefined) levelCounts[a.level] += 1;
      if (categoryCounts[a.category] !== undefined) categoryCounts[a.category] += 1;
    }

    return apiOk({
      juara: juaraCounts,
      level: levelCounts,
      kategori: categoryCounts,
    });
  } catch (e) {
    console.error("ACHIEVEMENTS SUMMARY ERROR:", e);
    return apiInternalError();
  }
}
