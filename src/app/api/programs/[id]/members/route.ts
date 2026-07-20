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

// GET /api/programs/[id]/members
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("program_members")
      .select("*, profiles(id, full_name, nim, avatar_url)")
      .eq("program_id", id)
      .order("joined_at");

    if (error) return apiInternalError(error.message);
    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

// POST /api/programs/[id]/members (Admin/Pengurus Inti/Kabid only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const userRole = getUserRole(request);
    const forbidden = requireRole(userRole, ["PENGURUS_INTI", "KABID"]);
    if (forbidden) return forbidden;

    const { id } = await params;
    const body = await request.json();
    const { user_id, role_in_program } = body;

    if (!user_id || !role_in_program) {
      return apiBadRequest("user_id dan role_in_program wajib diisi.");
    }

    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("program_members")
      .select("id")
      .eq("program_id", id)
      .eq("user_id", user_id)
      .maybeSingle();

    if (existing) {
      return apiBadRequest("Anggota ini sudah terdaftar dalam program.");
    }

    const { data, error } = await supabase
      .from("program_members")
      .insert({
        program_id: id,
        user_id,
        role_in_program,
      })
      .select("*, profiles(id, full_name, nim, avatar_url)")
      .single();

    if (error) return apiInternalError(error.message);
    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
