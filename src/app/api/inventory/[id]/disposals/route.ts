import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiBadRequest,
  apiNotFound,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireRole } from "@/lib/authz";
import { inventoryDisposalFormSchema } from "@/lib/validations/inventory";

// GET /api/inventory/[id]/disposals
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("inventory_disposals")
      .select("*, inventory_items(id, code, name), profiles(id, full_name)")
      .eq("item_id", id)
      .order("disposal_date", { ascending: false });

    if (error) return apiInternalError(error.message);
    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

// POST /api/inventory/[id]/disposals (Admin/Pengurus Inti)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const userRole = getUserRole(request);
    const forbidden = requireRole(userRole, ["PENGURUS_INTI"]);
    if (forbidden) return forbidden;

    const { id } = await params;
    const body = await request.json();

    const parsed = inventoryDisposalFormSchema.safeParse({
      item_id: id,
      quantity: body.quantity,
      reason: body.reason,
      disposal_date: body.disposal_date,
    });
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const { quantity, reason, disposal_date } = parsed.data;

    const supabase = await createSupabaseServer();

    const { data: item } = await supabase
      .from("inventory_items")
      .select("id, name, code, stock")
      .eq("id", id)
      .single();

    if (!item) return apiNotFound("Barang");

    const { data, error } = await supabase.rpc("dispose_inventory", {
      p_item_id: id,
      p_quantity: quantity,
      p_reason: reason,
      p_disposal_date: disposal_date,
    });

    if (error) {
      const msg = error.message || "";
      if (msg.includes("INSUFFICIENT_STOCK"))
        return apiBadRequest("Stok tidak mencukupi untuk jumlah yang dihapus.");
      if (msg.includes("INVALID_QUANTITY"))
        return apiBadRequest("Jumlah penghapusan harus lebih dari 0.");
      if (msg.includes("ITEM_NOT_FOUND")) return apiNotFound("Barang");
      return apiInternalError("Gagal menghapus inventaris: " + msg);
    }

    const { data: updatedItem } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("id", id)
      .single();

    return apiCreated({ disposal: data, item: updatedItem });
  } catch {
    return apiInternalError();
  }
}
