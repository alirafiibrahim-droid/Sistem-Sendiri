import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiCreated,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireRole } from "@/lib/authz";
import { fakultasFormSchema } from "@/lib/validations/settings";

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.from("fakultas").select("*").order("name");
    if (error) return apiInternalError(error.message);
    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

export async function POST(request: Request) {
  try {
    const userRole = getUserRole(request);
    const forbidden = requireRole(userRole, ["PENGURUS_INTI"]);
    if (forbidden) return forbidden;

    const body = await request.json();
    const parsed = fakultasFormSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const { name, description } = parsed.data;
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("fakultas")
      .insert({ name, description: description || "" })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") return apiBadRequest("Nama fakultas sudah ada.");
      return apiInternalError(error.message);
    }

    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
