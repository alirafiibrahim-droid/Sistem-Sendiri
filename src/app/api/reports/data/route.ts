import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiUnauthorized,
  apiForbidden,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { getReportBySlug, isReportAllowed } from "@/lib/reports";
import { buildReport } from "@/lib/report-builders";

// POST /api/reports/data
// body: { type: slug, filters: { key: value } }
export async function POST(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);

    const body = await request.json().catch(() => null);
    const slug = typeof body?.type === "string" ? body.type : "";
    const report = getReportBySlug(slug);
    if (!report) return apiBadRequest("Jenis laporan tidak dikenal.");
    if (!isReportAllowed(report, role)) return apiForbidden();

    const filters: Record<string, string> = {};
    if (body?.filters && typeof body.filters === "object") {
      for (const [key, value] of Object.entries(body.filters as Record<string, unknown>)) {
        if (typeof value === "string" && value.trim()) filters[key] = value.trim();
      }
    }

    for (const flt of report.filters) {
      if (flt.required && !filters[flt.key]) {
        return apiBadRequest(`Filter "${flt.label}" wajib diisi.`);
      }
    }

    const supabase = await createSupabaseServer();

    let kabidDivisionId: string | null = null;
    if (role === "KABID") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("division_id")
        .eq("id", uid)
        .maybeSingle();
      kabidDivisionId = profile?.division_id || null;
    }

    const data = await buildReport(report, {
      supabase,
      uid,
      role,
      kabidDivisionId,
      filters,
    });

    return apiOk(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : undefined;
    return apiInternalError(message);
  }
}
