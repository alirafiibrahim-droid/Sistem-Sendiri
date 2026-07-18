import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiUnauthorized,
  apiBadRequest,
  apiNotFound,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";

// GET /api/inventory/[id]
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
      .from("inventory_items")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return apiNotFound("Barang tidak ditemukan.");
    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

// PATCH /api/inventory/[id] (Admin/Pengurus Inti)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const userRole = getUserRole(request);
    if (!["ADMIN", "PENGURUS_INTI"].includes(userRole ?? "")) {
      return apiUnauthorized();
    }

    const { id } = await params;
    const body = await request.json();
    const { name, category, stock, condition, location, description, photo_url, is_active } = body;

    const supabase = await createSupabaseServer();

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (category !== undefined) updateData.category = category;
    if (stock !== undefined) updateData.stock = Number(stock);
    if (condition !== undefined) updateData.condition = condition;
    if (location !== undefined) updateData.location = location;
    if (description !== undefined) updateData.description = description;
    if (photo_url !== undefined) updateData.photo_url = photo_url || null;
    if (is_active !== undefined) updateData.is_active = is_active;

    if (Object.keys(updateData).length === 0) {
      return apiBadRequest("Tidak ada data yang diperbarui.");
    }

    const { data, error } = await supabase
      .from("inventory_items")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) return apiInternalError(error.message);
    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

// DELETE /api/inventory/[id] (Admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const userRole = getUserRole(request);
    if (userRole !== "ADMIN") {
      return apiUnauthorized();
    }

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) return apiInternalError(error.message);
    return apiOk(null);
  } catch {
    return apiInternalError();
  }
}
