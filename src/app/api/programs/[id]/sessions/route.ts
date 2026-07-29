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
import { NextRequest } from "next/server";

// GET /api/programs/[id]/sessions — list sessions
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(_request);
    if (!uid) return apiUnauthorized();

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("program_sessions")
      .select("*, program_session_attendants(count)")
      .eq("program_id", id)
      .order("date", { ascending: false });

    if (error) return apiInternalError(error.message);
    return apiOk(data || []);
  } catch {
    return apiInternalError();
  }
}

// POST /api/programs/[id]/sessions — create sessions (multi-date)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    const role = getUserRole(request);
    if (!uid) return apiUnauthorized();

    const { id } = await params;
    const body = await request.json();
    const { dates, title } = body as { dates?: string[]; title?: string };

    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return apiBadRequest("Minimal satu tanggal harus diisi.");
    }

    const supabase = await createSupabaseServer();

    const rows = dates.map((date) => ({
      program_id: id,
      date,
      title: title || null,
      created_by: uid,
    }));

    const { data, error } = await supabase
      .from("program_sessions")
      .insert(rows)
      .select();

    if (error) return apiInternalError(error.message);
    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
