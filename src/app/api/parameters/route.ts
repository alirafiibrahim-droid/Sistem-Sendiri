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

// GET /api/parameters
export async function GET(request: Request) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
      .from("parameters")
      .select("*")
      .order("name");

    if (error) return apiInternalError(error.message);
    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

// POST /api/parameters
export async function POST(request: Request) {
  try {
    const userRole = getUserRole(request);
    const forbidden = requireAccess(userRole, "settings-parameters", "create");
    if (forbidden) return forbidden;

    const uid = getUid(request);
    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return apiBadRequest("Nama parameter wajib diisi.");
    }

    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
      .from("parameters")
      .insert({ name: name.trim(), description: description || "" })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") return apiBadRequest("Nama parameter sudah ada.");
      return apiInternalError(error.message);
    }

    await writeAuditLog({
      action: "CREATE",
      targetTable: "parameters",
      targetId: data.id,
      userId: uid,
      newValue: { name: data.name, description: data.description },
    });

    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}