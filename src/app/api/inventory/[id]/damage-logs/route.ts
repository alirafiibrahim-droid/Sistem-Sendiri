import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiBadRequest,
  apiInternalError,
  getUid,
} from "@/lib/api-response";

// GET /api/inventory/[id]/damage-logs
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
      .from("inventory_damage_logs")
      .select("*, profiles(id, full_name)")
      .eq("item_id", id)
      .order("created_at", { ascending: false });

    if (error) return apiInternalError(error.message);
    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

// POST /api/inventory/[id]/damage-logs (Admin/Pengurus Inti)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { id } = await params;
    const body = await request.json();
    const { incident_date, type, description, estimated_cost } = body;

    if (!incident_date || !type || !description) {
      return apiBadRequest("Tanggal insiden, tipe, dan deskripsi wajib diisi.");
    }

    const supabase = await createSupabaseServer();

    // Log kerusakan
    const { data: log, error: logError } = await supabase
      .from("inventory_damage_logs")
      .insert({
        item_id: id,
        reported_by: uid,
        incident_date,
        type,
        description,
        estimated_cost: estimated_cost || 0,
      })
      .select()
      .single();

    if (logError) return apiInternalError(logError.message);

    // Update kondisi barang berdasarkan tipe
    if (type === "LOSS") {
      await supabase
        .from("inventory_items")
        .update({ condition: "LOST" })
        .eq("id", id);
    } else if (type === "DAMAGE") {
      await supabase
        .from("inventory_items")
        .update({ condition: "DAMAGED_HEAVY" })
        .eq("id", id);
    }

    return apiCreated(log);
  } catch {
    return apiInternalError();
  }
}
