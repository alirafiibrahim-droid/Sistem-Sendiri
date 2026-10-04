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
import { commitImport } from "@/lib/import/server";

// POST /api/import/[module]/commit
// Body: { csv: string } — skrining diulang di server, lalu disimpan hanya
// bila seluruh baris lolos. Bila ada baris bermasalah, data TIDAK disimpan
// dan hasil skrining dikembalikan agar user bisa mengunduh file bermasalah.
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
    const { result, screening } = await commitImport(supabase, spec.key, csv, uid);

    if (!result) {
      return apiOk({
        saved: false,
        screening,
        message:
          screening.invalidRows > 0
            ? `Impor ditolak: ${screening.invalidRows} baris bermasalah. Perbaiki lalu unggah ulang.`
            : screening.fileErrors[0] ?? "Impor ditolak karena format file tidak sesuai.",
      });
    }

    return apiOk({
      saved: result.created > 0,
      created: result.created,
      failures: result.failures,
      screening,
      message:
        result.failures.length > 0
          ? `${result.created} data tersimpan, ${result.failures.length} baris gagal disimpan.`
          : `${result.created} ${spec.singular} berhasil diimpor.`,
    });
  } catch (e) {
    console.error("IMPORT COMMIT ERROR:", e);
    return apiInternalError();
  }
}