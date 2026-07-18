import { createSupabaseServer } from "@/lib/supabase/server";
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

// GET /api/divisions
export async function GET(request: Request) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
      .from("divisions")
      .select("*")
      .order("name");

    if (error) return apiInternalError(error.message);
    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

// POST /api/divisions (Admin/Pengurus Inti only)
export async function POST(request: Request) {
  try {
    const userRole = getUserRole(request);
    if (!["ADMIN", "PENGURUS_INTI"].includes(userRole ?? "")) {
      return apiForbidden();
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name) return apiBadRequest("Nama divisi wajib diisi.");

    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
      .from("divisions")
      .insert({ name, description: description || "" })
      .select()
      .single();

    if (error) {
      if (error.code === "23505")
        return apiBadRequest("Nama divisi sudah ada.");
      return apiInternalError(error.message);
    }

    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
