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
import { requireAccess } from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";

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
    const forbidden = requireAccess(userRole, "inventory-add", "update");
    if (forbidden) return forbidden;

    const { id } = await params;
    const body = await request.json();
    const { name, category, stock, unit_price, condition, location, description, photo_url, is_active } = body;

    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("inventory_items")
      .select("id, name, category, stock, unit_price, condition, location")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound("Barang tidak ditemukan.");

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (category !== undefined) updateData.category = category;
    if (stock !== undefined) updateData.stock = Number(stock);
    if (unit_price !== undefined) updateData.unit_price = Number(unit_price);
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

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    const existingRow = existing as unknown as Record<string, unknown>;
    const updatedRow = data as unknown as Record<string, unknown>;
    for (const key of ["name", "category", "stock", "unit_price", "condition", "location", "is_active"]) {
      if (JSON.stringify(existingRow[key]) !== JSON.stringify(updatedRow[key])) {
        oldValue[key] = existingRow[key] ?? null;
        newValue[key] = updatedRow[key] ?? null;
      }
    }

    await writeAuditLog({
      action: "UPDATE",
      targetTable: "inventory_items",
      targetId: id,
      userId: uid,
      oldValue: Object.keys(oldValue).length > 0 ? oldValue : null,
      newValue: Object.keys(newValue).length > 0 ? newValue : null,
    });

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
    const forbidden = requireAccess(userRole, "inventory-add", "delete");
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("inventory_items")
      .select("id, name, code")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound("Barang tidak ditemukan.");

    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) return apiInternalError(error.message);

    await writeAuditLog({
      action: "DELETE",
      targetTable: "inventory_items",
      targetId: id,
      userId: uid,
      oldValue: {
        name: existing.name,
        code: existing.code,
      },
    });

    return apiOk(null);
  } catch {
    return apiInternalError();
  }
}
