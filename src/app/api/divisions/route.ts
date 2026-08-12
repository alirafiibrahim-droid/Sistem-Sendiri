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
import { requireAccess } from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";

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

// POST /api/divisions (hanya role dengan akses create Divisi)
export async function POST(request: Request) {
  try {
    const userRole = getUserRole(request);
    const forbidden = requireAccess(userRole, "settings-divisions", "create");
    if (forbidden) return forbidden;

    const uid = getUid(request);
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

    await writeAuditLog({
      action: "CREATE",
      targetTable: "divisions",
      targetId: data.id,
      userId: uid,
      newValue: { name: data.name, description: data.description },
    });

    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
