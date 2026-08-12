import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireAccess } from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";

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

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("dues_templates")
      .select("*", { count: "exact" });

    if (search) query = query.ilike("title", `%${search}%`);

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
    const forbidden = requireAccess(role, "finances", "create");
    if (forbidden) return forbidden;

    const body = await request.json();
    const { title, amount, due_date } = body;

    if (!title || !amount || !due_date) {
      return apiBadRequest("Missing required fields");
    }

    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("dues_templates")
      .insert({
        title,
        amount,
        due_date,
        created_by: uid,
      })
      .select("*")
      .single();

    if (error) return apiInternalError();

    await writeAuditLog({
      action: "CREATE",
      targetTable: "dues_templates",
      targetId: data.id,
      userId: uid,
      newValue: {
        title: data.title,
        amount: data.amount,
        due_date: data.due_date,
      },
    });

    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
