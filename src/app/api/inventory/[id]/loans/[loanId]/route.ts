import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiUnauthorized,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";

// PATCH /api/inventory/[id]/loans/[loanId] (approve/reject/return)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; loanId: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const userRole = getUserRole(request);
    if (!["ADMIN", "PENGURUS_INTI"].includes(userRole ?? "")) {
      return apiUnauthorized();
    }

    const { id, loanId } = await params;
    const body = await request.json();
    const { status, return_condition, return_notes } = body;

    const supabase = await createSupabaseServer();

    if (status === "APPROVED") {
      const { data, error } = await supabase
        .from("inventory_loans")
        .update({
          status: "APPROVED",
          approved_by: uid,
          approved_at: new Date().toISOString(),
        })
        .eq("id", loanId)
        .eq("item_id", id)
        .select()
        .single();

      if (error) return apiInternalError(error.message);
      return apiOk(data);
    }

    if (status === "REJECTED") {
      const { data, error } = await supabase
        .from("inventory_loans")
        .update({ status: "REJECTED" })
        .eq("id", loanId)
        .eq("item_id", id)
        .select()
        .single();

      if (error) return apiInternalError(error.message);
      return apiOk(data);
    }

    if (status === "RETURNED") {
      if (!return_condition) {
        return apiBadRequest("Kondisi barang saat dikembalikan wajib dipilih.");
      }

      const { data, error } = await supabase
        .from("inventory_loans")
        .update({
          status: "RETURNED",
          actual_return: new Date().toISOString().split("T")[0],
          return_condition,
          return_notes: return_notes || null,
        })
        .eq("id", loanId)
        .eq("item_id", id)
        .select()
        .single();

      if (error) return apiInternalError(error.message);

      // Jika kondisi lebih buruk, update kondisi barang
      if (return_condition === "DAMAGED_LIGHT" || return_condition === "DAMAGED_HEAVY" || return_condition === "LOST") {
        await supabase
          .from("inventory_items")
          .update({ condition: return_condition })
          .eq("id", id);
      }

      return apiOk(data);
    }

    return apiBadRequest("Status tidak valid.");
  } catch {
    return apiInternalError();
  }
}
