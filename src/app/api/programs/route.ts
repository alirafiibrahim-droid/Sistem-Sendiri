import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiBadRequest,
  apiInternalError,
  getUid,
} from "@/lib/api-response";
import type { PaginationParams } from "@/lib/types/api";

// GET /api/programs?page=1&limit=25&search=&sort=&order=asc
export async function GET(request: Request) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "25");
    const search = searchParams.get("search") || "";
    const sort = searchParams.get("sort") || "created_at";
    const order = searchParams.get("order") || "desc";

    const supabase = await createSupabaseServer();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("programs")
      .select("*, divisions(id, name)", { count: "exact" });

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

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

// POST /api/programs (Semua role terautentikasi)
export async function POST(request: Request) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const body = await request.json();
    const { name, description, start_date, end_date, budget_estimate, division_id, proposal_url, lpj_url } = body;

    if (!name || !start_date || !end_date) {
      return apiBadRequest("Nama, tanggal mulai, dan tanggal selesai wajib diisi.");
    }

    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
      .from("programs")
      .insert({
        name,
        description: description || "",
        start_date,
        end_date,
        budget_estimate: budget_estimate || 0,
        division_id: division_id || null,
        proposal_url: proposal_url || null,
        lpj_url: lpj_url || null,
        created_by: uid,
      })
      .select("*, divisions(id, name)")
      .single();

    if (error) return apiInternalError(error.message);
    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
