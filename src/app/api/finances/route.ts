import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { NextRequest } from "next/server";

const ALLOWED_ROLES = ["ADMIN", "PENGURUS_INTI", "KABID"];

export async function GET(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const supabase = await createSupabaseServer();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const search = searchParams.get("search") || "";
    const sort = searchParams.get("sort") || "created_at";
    const order = searchParams.get("order") || "desc";
    const type = searchParams.get("type");
    const programId = searchParams.get("program_id");

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("finances")
      .select("*, profiles(id, full_name), programs(id, name)", { count: "exact" });

    if (type) query = query.eq("type", type);
    if (programId) query = query.eq("program_id", programId);
    if (search) query = query.ilike("description", `%${search}%`);

    const { data, count, error } = await query
      .order(sort, { ascending: order === "asc" })
      .range(from, to);

    if (error) return apiInternalError();

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return apiOk(data, { total, page, limit, totalPages });
  } catch {
    return apiInternalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    if (!role || !ALLOWED_ROLES.includes(role)) return apiForbidden();

    const body = await request.json();
    const { type, amount, description, date, program_id, receipt_url } = body;

    if (!type || !amount || !description || !date) {
      return apiBadRequest("Missing required fields");
    }

    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("finances")
      .insert({
        type,
        amount,
        description,
        date,
        program_id: program_id || null,
        receipt_url: receipt_url || null,
        created_by: uid,
      })
      .select("*, profiles(id, full_name), programs(id, name)")
      .single();

    if (error) return apiInternalError();

    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
