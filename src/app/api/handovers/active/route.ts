import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  apiOk,
  apiUnauthorized,
  apiInternalError,
  getUid,
} from "@/lib/api-response";
import { NextRequest } from "next/server";

// GET /api/handovers/active
// Mengembalikan periode Sertijab yang sedang berjalan (status != COMPLETED)
// untuk dropdown "Periode" pada form Program Kerja.
export async function GET(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const admin = createSupabaseAdmin();

    const { data, error } = await admin
      .from("handovers")
      .select("id, period_from, period_to, status")
      .neq("status", "COMPLETED")
      .order("period_to", { ascending: false });

    if (error) {
      console.error("HANDOVERS ACTIVE ERROR:", error);
      return apiInternalError(error.message);
    }

    return apiOk(data || []);
  } catch (e) {
    console.error("HANDOVERS ACTIVE ERROR:", e);
    return apiInternalError();
  }
}
