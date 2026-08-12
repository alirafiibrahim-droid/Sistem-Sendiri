import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiUnauthorized,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireAccess } from "@/lib/access";

// GET /api/audit-logs?page=1&limit=25&target_table=&action=&q=&user_id=&sort=created_at&order=desc
export async function GET(request: Request) {
  try {
    const uid = getUid(request);
    const userRole = getUserRole(request);
    if (!uid) return apiUnauthorized();

    const forbidden = requireAccess(userRole, "audit-logs", "read");
    if (forbidden) return forbidden;

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "25");
    const targetTable = searchParams.get("target_table");
    const action = searchParams.get("action");
    const q = searchParams.get("q") || "";
    const userId = searchParams.get("user_id");
    const sort = searchParams.get("sort") || "created_at";
    const order = searchParams.get("order") || "desc";

    const supabase = await createSupabaseServer();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Cari ID pengguna (actor) berdasarkan nama lengkap untuk filter
    let userIds: string[] | null = null;
    if (q.trim()) {
      const { data: profileHits } = await supabase
        .from("profiles")
        .select("id")
        .ilike("full_name", `%${q.trim()}%`)
        .limit(50);
      userIds = (profileHits ?? []).map((p) => p.id);
      if (userIds.length === 0) {
        return apiOk([], {
          total: 0,
          page,
          limit,
          totalPages: 0,
        });
      }
    }

    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" });

    if (targetTable) query = query.eq("target_table", targetTable);
    if (action) query = query.eq("action", action);
    if (userId) query = query.eq("user_id", userId);
    if (userIds) query = query.in("user_id", userIds);

    const { data, count, error } = await query
      .order(sort, { ascending: order === "asc" })
      .range(from, to);

    if (error) return apiInternalError(error.message);

    // audit_logs.user_id merujuk auth.users, bukan public.profiles,
    // sehingga tidak bisa di-embed langsung via PostgREST.
    // Ambil nama aktor secara terpisah lalu digabung di sini.
    const rows = data ?? [];
    const actorIds = Array.from(
      new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v))
    );
    const actorMap = new Map<string, { id: string; full_name: string }>();
    if (actorIds.length > 0) {
      const { data: actorProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", actorIds);
      for (const p of actorProfiles ?? []) actorMap.set(p.id, p);
    }

    const result = rows.map((r) => ({
      ...r,
      profiles: r.user_id ? (actorMap.get(r.user_id) ?? null) : null,
    }));

    return apiOk(result, {
      total: count ?? 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0,
    });
  } catch {
    return apiInternalError();
  }
}
