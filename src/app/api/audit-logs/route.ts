import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiUnauthorized,
  apiForbidden,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { isAdmin } from "@/lib/authz";

// GET /api/audit-logs?page=1&limit=25&target_table=&action=&sort=created_at&order=desc
export async function GET(request: Request) {
  try {
    const uid = getUid(request);
    const userRole = getUserRole(request);
    if (!uid) return apiUnauthorized();
    if (!isAdmin(userRole)) return apiForbidden();

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "25");
    const targetTable = searchParams.get("target_table");
    const action = searchParams.get("action");
    const sort = searchParams.get("sort") || "created_at";
    const order = searchParams.get("order") || "desc";

    const supabase = await createSupabaseServer();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("audit_logs")
      .select("*, profiles(id, full_name)", { count: "exact" });

    if (targetTable) query = query.eq("target_table", targetTable);
    if (action) query = query.eq("action", action);

    const { data, count, error } = await query
      .order(sort, { ascending: order === "asc" })
      .range(from, to);

    if (error) return apiInternalError(error.message);

    return apiOk(data, {
      total: count ?? 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0,
    });
  } catch {
    return apiInternalError();
  }
}
