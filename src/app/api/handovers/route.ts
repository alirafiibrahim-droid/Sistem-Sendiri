import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiForbidden,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { isAdmin } from "@/lib/authz";
import { handoverSchema } from "@/lib/validations/handover";
import { NextRequest } from "next/server";
import type { Profile, HandoverWithCreator } from "@/lib/types/database";

async function attachProfiles(
  handovers: HandoverWithCreator[],
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>
): Promise<HandoverWithCreator[]> {
  const userIds = [
    ...new Set(handovers.map((h) => h.created_by).filter(Boolean) as string[]),
  ];
  if (userIds.length === 0) return handovers;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles || []).map((p: Pick<Profile, "id" | "full_name">) => [p.id, p])
  );

  return handovers.map((h) => ({
    ...h,
    profiles: h.created_by ? profileMap.get(h.created_by) || null : null,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 25;
    const search = searchParams.get("search") || "";
    const sort = searchParams.get("sort") || "created_at";
    const order = searchParams.get("order") || "desc";

    let query = supabase
      .from("handovers")
      .select("*", { count: "exact" });

    if (search) {
      query = query.or(
        `period_from.ilike.%${search}%,period_to.ilike.%${search}%,status.ilike.%${search}%`
      );
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await query
      .order(sort, { ascending: order === "asc" })
      .range(from, to);

    if (error) {
      console.error("HANDOVERS GET ERROR:", error);
      return apiInternalError();
    }

    const result = await attachProfiles(data as HandoverWithCreator[], supabase);

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return apiOk(result, { total, page, limit, totalPages });
  } catch (e) {
    console.error("HANDOVERS GET ERROR:", e);
    return apiInternalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    if (!isAdmin(role)) return apiForbidden();

    const body = await request.json();

    const parsed = handoverSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const { period_from, period_to, handover_date, witnesses } = parsed.data;

    const { data, error } = await supabase
      .from("handovers")
      .insert({
        period_from,
        period_to,
        handover_date,
        witnesses: witnesses || [],
        status: "DRAFT",
        created_by: uid,
      })
      .select("*")
      .single();

    if (error) {
      console.error("HANDOVERS INSERT ERROR:", error);
      return apiInternalError(error.message);
    }

    return apiCreated(data);
  } catch (e) {
    console.error("HANDOVERS POST ERROR:", e);
    return apiInternalError();
  }
}
