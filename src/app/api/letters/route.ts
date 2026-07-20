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
import { requireRole } from "@/lib/authz";
import { letterFormSchema } from "@/lib/validations/letter";
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

    let query = supabase
      .from("letters")
      .select("*", { count: "exact" });

    if (type) {
      query = query.eq("type", type);
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

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return apiOk(result, { total, page, limit, totalPages });
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
    const forbidden = requireRole(role, ["PENGURUS_INTI", "KABID"]);
    if (forbidden) return forbidden;

    const body = await request.json();

    const parsed = letterFormSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const { type, title, sender, date_received_sent, classification, document_url } = parsed.data;

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
        reference_number: refNum,
        created_by: uid,
      })
      .select()
      .single();

    if (error) {
      console.error("LETTERS INSERT ERROR:", error);
      return apiInternalError(error.message);
    }

    const result = (await attachProfiles([data as LetterWithCreator], supabase))[0];

    return apiCreated(result);
  } catch (e) {
    console.error("LETTERS POST ERROR:", e);
    return apiInternalError();
  }
}
