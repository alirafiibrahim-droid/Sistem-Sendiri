import { NextRequest } from "next/server";
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
import { budgetItemUpdateSchema } from "@/lib/validations/budget";
import { writeAuditLog } from "@/lib/audit";

function subtotalOf(quantity: number, unitPrice: number) {
  return Math.round(quantity * unitPrice * 100) / 100;
}

// PATCH /api/budget-items/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const forbidden = requireAccess(role, "programs", "update");
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing, error: existingError } = await supabase
      .from("budget_items")
      .select("id, parent_id, program_id, project_id, name, quantity, unit_price, subtotal")
      .eq("id", id)
      .single();

    if (existingError || !existing) return apiNotFound("Pos anggaran");

    const body = await request.json();
    const parsed = budgetItemUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const updates = parsed.data || {};
    const name = updates.name !== undefined ? updates.name : existing.name;
    const quantity = updates.quantity !== undefined ? updates.quantity : Number(existing.quantity);
    const unitPrice = updates.unit_price !== undefined ? updates.unit_price : Number(existing.unit_price);
    const subtotal = subtotalOf(quantity, unitPrice);

    const { data: children, error: childrenError } = await supabase
      .from("budget_items")
      .select("id")
      .eq("parent_id", id);

    if (childrenError) return apiInternalError(childrenError.message);
    const hasChildren = (children || []).length > 0;

    // Induk pos yang memiliki anak tidak boleh memiliki nilai anggaran sendiri.
    if (hasChildren && subtotal > 0) {
      return apiBadRequest(
        "Induk pos yang memiliki anak pos tidak boleh memiliki nilai anggaran sendiri."
      );
    }

    const parentId = updates.parent_id !== undefined ? updates.parent_id : existing.parent_id;

    // Induk pos yang memiliki anak tidak dapat dijadikan anak pos.
    if (hasChildren && parentId) {
      return apiBadRequest(
        "Induk pos yang memiliki anak pos tidak dapat diubah menjadi anak pos."
      );
    }

    if (parentId) {
      if (parentId === id) {
        return apiBadRequest("Induk pos tidak dapat merujuk dirinya sendiri.");
      }
      const { data: parent, error: parentError } = await supabase
        .from("budget_items")
        .select("id, parent_id, subtotal, program_id, project_id")
        .eq("id", parentId)
        .single();

      if (parentError || !parent) {
        return apiBadRequest("Induk pos yang dipilih tidak ditemukan.");
      }
      if (parent.parent_id) {
        return apiBadRequest("Induk pos yang dipilih bukan Induk Pos.");
      }
      if (parent.program_id !== existing.program_id || parent.project_id !== existing.project_id) {
        return apiBadRequest("Induk pos harus berasal dari program/proyek yang sama.");
      }
      if (Number(parent.subtotal) > 0) {
        return apiBadRequest(
          "Induk pos yang sudah memiliki besar anggaran tidak dapat dipilih sebagai induk."
        );
      }
    }

    const { data, error } = await supabase
      .from("budget_items")
      .update({
        parent_id: parentId,
        name,
        quantity,
        unit_price: unitPrice,
        subtotal,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return apiInternalError(error.message);

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    const existingRow = existing as unknown as Record<string, unknown>;
    const updatedRow = data as unknown as Record<string, unknown>;
    for (const key of ["name", "quantity", "unit_price", "subtotal", "parent_id"]) {
      if (JSON.stringify(existingRow[key]) !== JSON.stringify(updatedRow[key])) {
        oldValue[key] = existingRow[key] ?? null;
        newValue[key] = updatedRow[key] ?? null;
      }
    }

    await writeAuditLog({
      action: "UPDATE",
      targetTable: "budget_items",
      targetId: id,
      userId: uid,
      oldValue: Object.keys(oldValue).length > 0 ? oldValue : null,
      newValue: Object.keys(newValue).length > 0 ? newValue : null,
    });

    const { data: childRows } = await supabase
      .from("budget_items")
      .select("*")
      .eq("parent_id", id)
      .order("created_at", { ascending: true });

    return apiOk({ ...data, children: childRows || [] });
  } catch {
    return apiInternalError();
  }
}

// DELETE /api/budget-items/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const forbidden = requireAccess(role, "programs", "delete");
    if (forbidden) return forbidden;

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
      .from("budget_items")
      .select("id, name")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound("Pos anggaran");

    const { error } = await supabase.from("budget_items").delete().eq("id", id);
    if (error) return apiInternalError(error.message);

    await writeAuditLog({
      action: "DELETE",
      targetTable: "budget_items",
      targetId: id,
      userId: uid,
      oldValue: existing ? { name: existing.name } : null,
    });

    return apiOk({ deleted: true });
  } catch {
    return apiInternalError();
  }
}
