import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiInternalError,
  apiBadRequest,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireAccess } from "@/lib/access";
import { letterFormSchema } from "@/lib/validations/letter";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { attachHandovers } from "@/lib/handover";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";
import type { LetterWithCreator, Profile } from "@/lib/types/database";

async function attachProfiles(
  letters: LetterWithCreator[],
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>
): Promise<LetterWithCreator[]> {
  const userIds = [
    ...new Set(letters.map((l) => l.created_by).filter(Boolean) as string[]),
  ];
  if (userIds.length === 0) return letters;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles || []).map((p: Pick<Profile, "id" | "full_name">) => [p.id, p])
  );

  return letters.map((l) => ({
    ...l,
    profiles: l.created_by ? profileMap.get(l.created_by) || null : null,
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
    const type = searchParams.get("type") || "";
    const start_date = searchParams.get("start_date");
    const end_date = searchParams.get("end_date");

    let query = supabase
      .from("letters")
      .select("*", { count: "exact" });

    if (type) {
      query = query.eq("type", type);
    }

    if (start_date) {
      query = query.gte("date_received_sent", start_date);
    }

    if (end_date) {
      query = query.lte("date_received_sent", end_date);
    }

    if (search) {
      query = query.or(
        `title.ilike.%${search}%,sender.ilike.%${search}%,reference_number.ilike.%${search}%`
      );
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await query
      .order(sort, { ascending: order === "asc" })
      .range(from, to);

    if (error) {
      console.error("LETTERS GET ERROR:", error);
      return apiInternalError();
    }

    const result = await attachProfiles(data as LetterWithCreator[], supabase);

    const withPeriods = await attachHandovers(result, createSupabaseAdmin());

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return apiOk(withPeriods, { total, page, limit, totalPages });
  } catch (e) {
    console.error("LETTERS GET ERROR:", e);
    return apiInternalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const forbidden = requireAccess(role, "letters", "create");
    if (forbidden) return forbidden;

    const body = await request.json();

    const parsed = letterFormSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const { type, title, sender, date_received_sent, classification, document_url, handover_id } = parsed.data;

    const refNum = `REF-${Date.now()}`;

    const { data, error } = await supabase
      .from("letters")
      .insert({
        type,
        title,
        sender,
        date_received_sent,
        classification: classification || "PUBLIC",
        document_url: document_url || "",
        handover_id: handover_id || null,
        reference_number: refNum,
        created_by: uid,
      })
      .select()
      .single();

    if (error) {
      console.error("LETTERS INSERT ERROR:", error);
      return apiInternalError(error.message);
    }

    await writeAuditLog({
      action: "CREATE",
      targetTable: "letters",
      targetId: data.id,
      userId: uid,
      newValue: {
        type: data.type,
        reference_number: data.reference_number,
        title: data.title,
        sender: data.sender,
        date_received_sent: data.date_received_sent,
      },
    });

    const result = (await attachProfiles([data as LetterWithCreator], supabase))[0];

    return apiCreated(result);
  } catch (e) {
    console.error("LETTERS POST ERROR:", e);
    return apiInternalError();
  }
}
