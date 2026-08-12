import { createSupabaseServer } from "@/lib/supabase/server";
import { isProgramLocked } from "@/lib/program-lock";
import { generateUniqueSessionCodes } from "@/lib/session-code";
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
import { requireAccess } from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";
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
    if (!uid) return apiUnauthorized();

    const forbidden = requireAccess(getUserRole(request), "programs", "create");
    if (forbidden) return forbidden;

    const { id } = await params;
    const body = await request.json();
    const { dates, title } = body as { dates?: string[]; title?: string };

    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return apiBadRequest("Minimal satu tanggal harus diisi.");
    }

    const supabase = await createSupabaseServer();

    if (await isProgramLocked(supabase, id)) {
      return apiForbidden("Program pada periode yang telah selesai tidak dapat diubah.");
    }

    const sessionCodes = await generateUniqueSessionCodes(supabase, "program_sessions", dates.length);

    const rows = dates.map((date, i) => ({
      program_id: id,
      date,
      title: title || null,
      session_code: sessionCodes[i],
      created_by: uid,
    }));

    const { data, error } = await supabase
      .from("program_sessions")
      .insert(rows)
      .select();

    if (error) return apiInternalError(error.message);

    for (const row of data ?? []) {
      await writeAuditLog({
        action: "CREATE",
        targetTable: "program_sessions",
        targetId: row.id,
        userId: uid,
        newValue: {
          program_id: id,
          date: row.date,
          title: row.title,
          session_code: row.session_code,
        },
      });
    }

    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
