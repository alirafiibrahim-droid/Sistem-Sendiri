import { NextRequest } from "next/server";
import {
  apiOk,
  apiUnauthorized,
  apiForbidden,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import {
  REPORT_CATALOG,
  isReportAllowed,
  canAccessReports,
} from "@/lib/reports";

// GET /api/reports/catalog — daftar laporan yang boleh diakses role saat ini
export async function GET(request: NextRequest) {
  const uid = getUid(request);
  if (!uid) return apiUnauthorized();

  const role = getUserRole(request);
  if (!canAccessReports(role)) return apiForbidden();

  const catalog = REPORT_CATALOG.filter((r) => isReportAllowed(r, role));
  return apiOk(catalog, { userRole: role ?? undefined, total: catalog.length });
}
