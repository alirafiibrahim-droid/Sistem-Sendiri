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

const VIEW_ROLES = ["ADMIN", "PENGURUS_INTI", "KABID"];

export async function GET(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const supabase = await createSupabaseServer();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const search = searchParams.get("search") || "";
    const sort = searchParams.get("sort") || "created_at";
    const order = searchParams.get("order") || "desc";

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("dues_payments")
      .select(
        "*, profiles(id, full_name, nim), dues_templates(id, title, amount, due_date)",
        { count: "exact" }
      );

    if (!role || !VIEW_ROLES.includes(role)) {
      query = query.eq("user_id", uid);
    }

    if (search) {
      query = query.or(
        `profiles.full_name.ilike.%${search}%,profiles.nim.ilike.%${search}%`
      );
    }

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

    const body = await request.json();
    const { due_template_id, payment_date, proof_url } = body;

    if (!due_template_id || !payment_date || !proof_url) {
      return apiBadRequest("Missing required fields");
    }

    const supabase = await createSupabaseServer();

    const { data: template } = await supabase
      .from("dues_templates")
      .select("id")
      .eq("id", due_template_id)
      .single();

    if (!template) return apiNotFound("Dues template not found");

    const { data, error } = await supabase
      .from("dues_payments")
      .insert({
        due_template_id,
        user_id: uid,
        payment_date,
        proof_url,
        status: "PENDING_VERIFICATION",
      })
      .select(
        "*, profiles(id, full_name, nim), dues_templates(id, title, amount, due_date)"
      )
      .single();

    if (error) return apiInternalError();

    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
