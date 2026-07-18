import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiBadRequest,
  apiInternalError,
  getUid,
} from "@/lib/api-response";

// GET /api/inventory/[id]/loans
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
      .from("inventory_loans")
      .select("*, profiles(id, full_name, nim)")
      .eq("item_id", id)
      .order("created_at", { ascending: false });

    if (error) return apiInternalError(error.message);
    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

// POST /api/inventory/[id]/loans (Semua role terautentikasi)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { id } = await params;
    const body = await request.json();
    const { quantity, borrow_date, return_date, purpose } = body;

    if (!quantity || !borrow_date || !return_date || !purpose) {
      return apiBadRequest("Jumlah, tanggal pinjam, tanggal kembali, dan keperluan wajib diisi.");
    }

    const supabase = await createSupabaseServer();

    // Cek stok tersedia
    const { data: item, error: itemError } = await supabase
      .from("inventory_items")
      .select("stock")
      .eq("id", id)
      .single();

    if (itemError || !item) return apiBadRequest("Barang tidak ditemukan.");

    // Hitung stok yang sedang dipinjam
    const { data: activeLoans } = await supabase
      .from("inventory_loans")
      .select("quantity")
      .eq("item_id", id)
      .in("status", ["APPROVED", "OVERDUE"]);

    const borrowed = activeLoans?.reduce((sum, l) => sum + l.quantity, 0) || 0;
    const available = item.stock - borrowed;

    if (Number(quantity) > available) {
      return apiBadRequest(`Stok tidak mencukupi. Tersedia: ${available} unit.`);
    }

    const { data, error } = await supabase
      .from("inventory_loans")
      .insert({
        item_id: id,
        borrower_id: uid,
        quantity: Number(quantity),
        borrow_date,
        return_date,
        purpose,
        status: "PENDING",
      })
      .select("*, profiles(id, full_name, nim)")
      .single();

    if (error) return apiInternalError(error.message);
    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
