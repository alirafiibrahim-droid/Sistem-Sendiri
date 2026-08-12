import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiCreated,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireAccess } from "@/lib/access";
import { jurusanFormSchema } from "@/lib/validations/settings";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.from("jurusan").select("*, fakultas(id, name)").order("name");
    if (error) return apiInternalError(error.message);
    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

export async function POST(request: Request) {
  try {
    const userRole = getUserRole(request);
    const forbidden = requireAccess(userRole, "settings-fakultas-jurusan", "create");
    if (forbidden) return forbidden;

    const body = await request.json();
    const parsed = jurusanFormSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const { name, description, fakultas_id } = parsed.data;
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("jurusan")
      .insert({
        name,
        description: description || "",
        fakultas_id: fakultas_id || null,
      })
      .select("*, fakultas(id, name)")
      .single();

    if (error) {
      if (error.code === "23505") return apiBadRequest("Nama jurusan sudah ada.");
      return apiInternalError(error.message);
    }

    await writeAuditLog({
      action: "CREATE",
      targetTable: "jurusan",
      targetId: data.id,
      userId: getUid(request),
      newValue: {
        name: data.name,
        description: data.description,
        fakultas_id: data.fakultas_id,
      },
    });

    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
