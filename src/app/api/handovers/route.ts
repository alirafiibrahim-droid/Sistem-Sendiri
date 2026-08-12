import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiBadRequest,
  apiConflict,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireAccess } from "@/lib/access";
import { handoverSchema } from "@/lib/validations/handover";
import { writeAuditLog } from "@/lib/audit";
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
    const forbidden = requireAccess(role, "handovers", "create");
    if (forbidden) return forbidden;

    const body = await request.json();

    const parsed = handoverSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const { period_from, period_to, handover_date, document_url, witnesses } = parsed.data;

    const { data: existing, error: checkError } = await supabase
      .from("handovers")
      .select("id, period_from, period_to, status");

    if (checkError) {
      console.error("HANDOVERS UNIQUENESS CHECK ERROR:", checkError);
      return apiInternalError(checkError.message);
    }

    const rows = existing || [];

    const hasActivePeriod = rows.some((h) => h.status !== "COMPLETED");
    if (hasActivePeriod) {
      return apiConflict(
        "Tidak dapat membuat sertijab baru karena masih ada periode berjalan. Selesaikan periode sebelumnya (status Selesai Periode) terlebih dahulu sebelum menjalankan periode baru."
      );
    }

    const periodTaken = rows.some(
      (h) => h.period_to === period_to || h.period_from === period_to
    );
    if (periodTaken) {
      return apiConflict(
        `Periode ${period_to} sudah terdaftar pada sertijab yang ada. Periode berjalan harus unik.`
      );
    }

    const { data, error } = await supabase
      .from("handovers")
      .insert({
        period_from,
        period_to,
        handover_date,
        document_url: document_url || null,
        witnesses: witnesses || [],
        status: "NOT_STARTED",
        created_by: uid,
      })
      .select("*")
      .single();

    if (error) {
      console.error("HANDOVERS INSERT ERROR:", error);
      return apiInternalError(error.message);
    }

    await writeAuditLog({
      action: "CREATE",
      targetTable: "handovers",
      targetId: data.id,
      userId: uid,
      newValue: {
        period_from: data.period_from,
        period_to: data.period_to,
        handover_date: data.handover_date,
        status: data.status,
      },
    });

    return apiCreated(data);
  } catch (e) {
    console.error("HANDOVERS POST ERROR:", e);
    return apiInternalError();
  }
}
