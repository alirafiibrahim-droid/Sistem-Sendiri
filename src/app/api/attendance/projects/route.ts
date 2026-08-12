import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiNotFound,
  apiBadRequest,
  apiInternalError,
  getUid,
} from "@/lib/api-response";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";

// GET /api/attendance/projects — list active projects for attendance
export async function GET(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("incidental_projects")
      .select("id, name, start_date, end_date, status")
      .in("status", ["APPROVED", "ONGOING"])
      .order("start_date", { ascending: false });

    if (error) return apiInternalError(error.message);
    return apiOk(data || []);
  } catch {
    return apiInternalError();
  }
}

// POST /api/attendance/projects — record project attendance
export async function POST(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const body = await request.json();
    const { project_id, method } = body as { project_id?: string; method?: string };

    if (!project_id) {
      return apiBadRequest("project_id wajib diisi.");
    }

    if (!method || !["MANUAL", "QR"].includes(method)) {
      return apiBadRequest("Method harus MANUAL atau QR.");
    }

    const supabase = await createSupabaseServer();

    const { data: project, error: pErr } = await supabase
      .from("incidental_projects")
      .select("id")
      .eq("id", project_id)
      .single();

    if (pErr || !project) return apiNotFound("Proyek tidak ditemukan.");

    const { data, error } = await supabase
      .from("project_attendances")
      .upsert(
        {
          project_id,
          user_id: uid,
          method,
          scanned_at: method === "QR" ? new Date().toISOString() : null,
        },
        { onConflict: "project_id,user_id" }
      )
      .select()
      .single();

    if (error) {
      return apiInternalError(error.message);
    }

    await writeAuditLog({
      action: "CREATE",
      targetTable: "project_attendances",
      targetId: data.id,
      userId: uid,
      newValue: {
        project_id,
        user_id: uid,
        method,
        scanned_at: data.scanned_at ?? null,
      },
    });

    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
