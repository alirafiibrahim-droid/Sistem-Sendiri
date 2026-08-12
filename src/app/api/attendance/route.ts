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

// GET /api/attendance?program_id=xxx — list attendance for a program
// GET /api/attendance — list all user's attendance records
export async function GET(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { searchParams } = new URL(request.url);
    const programId = searchParams.get("program_id");

    const supabase = await createSupabaseServer();

    if (programId) {
      const { data, error } = await supabase
        .from("attendances")
        .select("*, profiles(id, full_name, nim, avatar_url)")
        .eq("program_id", programId)
        .order("timestamp", { ascending: false });

      if (error) return apiInternalError(error.message);
      return apiOk(data || []);
    }

    const { data, error } = await supabase
      .from("attendances")
      .select("*, programs(id, name)")
      .eq("user_id", uid)
      .order("timestamp", { ascending: false });

    if (error) return apiInternalError(error.message);
    return apiOk(data || []);
  } catch {
    return apiInternalError();
  }
}

// POST /api/attendance — record attendance
export async function POST(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const body = await request.json();
    const { program_id, method } = body as { program_id?: string; method?: string };

    if (!program_id) {
      return apiBadRequest("program_id wajib diisi.");
    }

    if (!method || !["MANUAL", "QR"].includes(method)) {
      return apiBadRequest("Method harus MANUAL atau QR.");
    }

    const supabase = await createSupabaseServer();

    const { data: program, error: pErr } = await supabase
      .from("programs")
      .select("id")
      .eq("id", program_id)
      .single();

    if (pErr || !program) return apiNotFound("Program tidak ditemukan.");

    const { data, error } = await supabase
      .from("attendances")
      .upsert(
        {
          program_id,
          user_id: uid,
          status: "PRESENT",
          method,
          scanned_at: method === "QR" ? new Date().toISOString() : null,
        },
        { onConflict: "program_id,user_id" }
      )
      .select()
      .single();

    if (error) {
      return apiInternalError(error.message);
    }

    await writeAuditLog({
      action: "CREATE",
      targetTable: "attendances",
      targetId: data.id,
      userId: uid,
      newValue: {
        program_id,
        user_id: uid,
        status: "PRESENT",
        method,
        scanned_at: data.scanned_at ?? null,
      },
    });

    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
