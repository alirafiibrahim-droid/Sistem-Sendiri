import { createSupabaseServer } from "@/lib/supabase/server";
import { generateUniqueSessionCodes } from "@/lib/session-code";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { writeAuditLog } from "@/lib/audit";
import { requireAccess } from "@/lib/access";
import { NextRequest } from "next/server";

// GET /api/projects/[id]/sessions — list sessions
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
      .from("project_sessions")
      .select("*, project_session_attendants(count)")
      .eq("project_id", id)
      .order("date", { ascending: false });

    if (error) return apiInternalError(error.message);
    return apiOk(data || []);
  } catch {
    return apiInternalError();
  }
}

// POST /api/projects/[id]/sessions — create sessions (multi-date)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    const role = getUserRole(request);
    if (!uid) return apiUnauthorized();

    const forbidden = requireAccess(role, "projects", "create");
    if (forbidden) return forbidden;

    const { id } = await params;
    const body = await request.json();
    const { dates, title } = body as { dates?: string[]; title?: string };

    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return apiBadRequest("Minimal satu tanggal harus diisi.");
    }

    const supabase = await createSupabaseServer();

    const sessionCodes = await generateUniqueSessionCodes(supabase, "project_sessions", dates.length);

    const rows = dates.map((date, i) => ({
      project_id: id,
      date,
      title: title || null,
      session_code: sessionCodes[i],
      created_by: uid,
    }));

    const { data, error } = await supabase
      .from("project_sessions")
      .insert(rows)
      .select();

    if (error) return apiInternalError(error.message);

    const inserted = data || [];
    for (const row of inserted) {
      await writeAuditLog({
        action: "CREATE",
        targetTable: "project_sessions",
        targetId: row.id,
        userId: uid,
        newValue: {
          project_id: id,
          date: row.date,
          title: row.title ?? null,
          session_code: row.session_code,
        },
      });
    }

    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
