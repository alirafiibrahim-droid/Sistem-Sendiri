import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiNoContent,
  apiUnauthorized,
  apiNotFound,
  apiInternalError,
  getUid,
} from "@/lib/api-response";
import { NextRequest } from "next/server";

// DELETE /api/projects/[id]/sessions/[sessionId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const uid = getUid(_request);
    if (!uid) return apiUnauthorized();

    const { sessionId } = await params;
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("project_sessions")
      .delete()
      .eq("id", sessionId)
      .select("id");

    if (error) return apiInternalError(error.message);
    if (!data || data.length === 0) return apiNotFound("Sesi tidak ditemukan.");
    return apiNoContent();
  } catch {
    return apiInternalError();
  }
}
