import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiBadRequest,
  apiInternalError,
  getUid,
} from "@/lib/api-response";
import { financeFormSchema } from "@/lib/validations/finance";
import { NextRequest } from "next/server";
import type { FinanceWithDetails, Profile } from "@/lib/types/database";

async function attachProfiles(
  finances: FinanceWithDetails[],
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>
): Promise<FinanceWithDetails[]> {
  const userIds = [
    ...new Set(finances.map((f) => f.created_by).filter(Boolean) as string[]),
  ];
  if (userIds.length === 0) return finances;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles || []).map((p: Pick<Profile, "id" | "full_name">) => [p.id, p])
  );

  return finances.map((f) => ({
    ...f,
    profiles: f.created_by ? profileMap.get(f.created_by) || null : null,
  }));
}

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

    const walletId = searchParams.get("wallet_id");

    let query = supabase
      .from("finances")
      .select("*, programs(id, name), wallets(id, name)", { count: "exact" });

    if (type) query = query.eq("type", type);
    if (programId) query = query.eq("program_id", programId);
    if (walletId) query = query.eq("wallet_id", walletId);
    if (search) query = query.ilike("description", `%${search}%`);

    const { data, count, error } = await query
      .order(sort, { ascending: order === "asc" })
      .range(from, to);

    if (error) return apiInternalError(error.message);

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    const result = await attachProfiles(data as FinanceWithDetails[], supabase);

    return apiOk(result, { total, page, limit, totalPages });
  } catch (e) {
    console.error("FINANCES GET ERROR:", e);
    return apiInternalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const body = await request.json();

    const parsed = financeFormSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const { type, amount, description, date, program_id, receipt_url, wallet_id } = parsed.data;

    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("finances")
      .insert({
        type,
        amount,
        description,
        date,
        program_id: program_id || null,
        receipt_url: receipt_url || "",
        wallet_id: wallet_id || null,
        created_by: uid,
      })
      .select("*, programs(id, name), wallets(id, name)")
      .single();

    if (error) {
      console.error("FINANCES INSERT ERROR:", error);
      return apiInternalError(error.message);
    }

    const result = (await attachProfiles([data as FinanceWithDetails], supabase))[0];

    return apiCreated(result);
  } catch (e) {
    console.error("FINANCES POST ERROR:", e);
    return apiInternalError();
  }
}
