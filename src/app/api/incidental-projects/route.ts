import { NextRequest } from "next/server";
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
import { projectFormSchema } from "@/lib/validations/project";
import { writeAuditLog } from "@/lib/audit";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { attachHandovers } from "@/lib/handover";

export async function GET(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 25));
    const search = searchParams.get("search") || "";
    const sort = searchParams.get("sort") || "created_at";
    const order = searchParams.get("order") === "asc" ? true : false;
    const status = searchParams.get("status");

    const supabase = await createSupabaseServer();

    let query = supabase
      .from("incidental_projects")
      .select("*", { count: "exact" });

    if (status) {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query
      .order(sort, { ascending: order })
      .range(from, to);

    if (error) {
      console.error("PROJECTS GET ERROR:", error);
      return apiInternalError();
    }

    const withPeriods = await attachHandovers(data, createSupabaseAdmin());

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return apiOk(withPeriods, { total, page, limit, totalPages });
  } catch (e) {
    console.error("PROJECTS GET ERROR:", e);
    return apiInternalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const forbidden = requireAccess(role, "projects", "create");
    if (forbidden) return forbidden;

    const body = await request.json();

    const parsed = projectFormSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const { name, description, urgency_level, start_date, end_date, budget_source, handover_id } = parsed.data;

    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("incidental_projects")
      .insert({
        name,
        description: description || null,
        urgency_level,
        start_date,
        end_date: end_date || null,
        budget_source: budget_source || null,
        handover_id: handover_id || null,
        status: "PROPOSED",
        created_by: uid,
      })
      .select()
      .single();

    if (error) {
      console.error("PROJECTS INSERT ERROR:", error);
      return apiInternalError(error.message);
    }

    await writeAuditLog({
      action: "CREATE",
      targetTable: "incidental_projects",
      targetId: data.id,
      userId: uid,
      newValue: {
        name: data.name,
        urgency_level: data.urgency_level,
        start_date: data.start_date,
        end_date: data.end_date,
        budget_source: data.budget_source,
        status: data.status,
      },
    });

    return apiCreated(data);
  } catch (e) {
    console.error("PROJECTS POST ERROR:", e);
    return apiInternalError();
  }
}
