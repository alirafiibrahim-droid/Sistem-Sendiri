import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiNotFound,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireRole } from "@/lib/authz";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const uid = await getUid(request);
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
      .select("*, profiles(id, full_name)", { count: "exact" });

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
    const supabase = await createSupabaseServer();
    const uid = await getUid(request);
    if (!uid) return apiUnauthorized();

    const role = await getUserRole(request);
    const forbidden = requireRole(role, ["PENGURUS_INTI", "KABID"]);
    if (forbidden) return forbidden;

    const body = await request.json();
    const { type, title, sender, date_received_sent, classification, document_url, reference_number } = body;

    if (!type || !title || !sender || !date_received_sent) {
      return apiBadRequest("Missing required fields: type, title, sender, date_received_sent");
    }

    const refNum = reference_number || `REF-${Date.now()}`;

    const { data, error } = await supabase
      .from("letters")
      .insert({
        type,
        title,
        sender,
        date_received_sent,
        classification: classification || "PUBLIC",
        document_url: document_url || null,
        reference_number: refNum,
        created_by: uid,
      })
      .select("*, profiles(id, full_name)")
      .single();

    if (error) return apiInternalError();

    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
