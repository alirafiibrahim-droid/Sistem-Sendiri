import {
  apiBadRequest,
  apiInternalError,
  apiOk,
  apiUnauthorized,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireAccess } from "@/lib/access";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getImportSpec } from "@/lib/import/specs";
import { loadImportContext, screenCsv } from "@/lib/import/server";

// POST /api/import/[module]/validate
// Body: { csv: string } — menjalankan skrining tanpa menyimpan apa pun.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ module: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { module } = await params;
    const spec = getImportSpec(module);
    if (!spec) return apiBadRequest("Modul impor tidak dikenal.");

    const forbidden = requireAccess(getUserRole(request), spec.accessModule, "create");
    if (forbidden) return forbidden;

    const body = await request.json();
    const csv = typeof body?.csv === "string" ? body.csv : "";
    if (csv.trim() === "") return apiBadRequest("File CSV kosong.");

    const supabase = await createSupabaseServer();
    const ctx = await loadImportContext(supabase, spec.key);
    const screening = screenCsv(spec, csv, ctx);

    return apiOk(screening);
  } catch (e) {
    console.error("IMPORT VALIDATE ERROR:", e);
    return apiInternalError();
  }
}