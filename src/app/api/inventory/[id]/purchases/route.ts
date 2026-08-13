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
import { requireAccess } from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";
import { inventoryPurchaseFormSchema } from "@/lib/validations/inventory";
import { NextRequest } from "next/server";

// GET /api/inventory/[id]/purchases
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
      .from("inventory_purchases")
      .select(
        "*, inventory_items(id, code, name), wallets(id, name), banks(id, name), cash_accounts(id, name)"
      )
      .eq("item_id", id)
      .order("date", { ascending: false });

    if (error) return apiInternalError(error.message);

    const userIds = [
      ...new Set(
        (data || []).map((p: { created_by: string | null }) => p.created_by).filter(Boolean) as string[]
      ),
    ];

    let profileMap = new Map<string, { id: string; full_name: string }>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      profileMap = new Map(
        (profiles || []).map((p: { id: string; full_name: string }) => [p.id, p])
      );
    }

    const result = (data || []).map(
      (p: Record<string, unknown>) => ({
        ...p,
        profiles: p.created_by
          ? profileMap.get(p.created_by as string) || null
          : null,
      })
    );

    return apiOk(result);
  } catch {
    return apiInternalError();
  }
}

// POST /api/inventory/[id]/purchases
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const userRole = getUserRole(request);
    const forbidden = requireAccess(userRole, "inventory-add", "create");
    if (forbidden) return forbidden;

    const { id } = await params;
    const body = await request.json();

    const parsed = inventoryPurchaseFormSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const { quantity, amount, date, wallet_id, bank_id, cash_account_id, description } =
      parsed.data;

    const subtotal = Number(quantity) * Number(amount);

    const supabase = await createSupabaseServer();

    // Verify item exists
    const { data: item, error: itemError } = await supabase
      .from("inventory_items")
      .select("id, name, code, stock")
      .eq("id", id)
      .single();

    if (itemError || !item) return apiNotFound("Barang tidak ditemukan.");

    // Create finance entry (EXPENSE) — nominal biaya yang dibayarkan = subtotal
    const financeDesc = `Pembelian ${item.name} (${item.code})${description ? " - " + description : ""}`;
    const { data: finance, error: financeError } = await supabase
      .from("finances")
      .insert({
        type: "EXPENSE",
        amount: subtotal,
        description: financeDesc,
        date,
        receipt_url: "",
        wallet_id: wallet_id || null,
        bank_id: bank_id || null,
        cash_account_id: cash_account_id || null,
        created_by: uid,
        source: "inventory",
      })
      .select("id")
      .single();

    if (financeError) {
      console.error("FINANCE INSERT ERROR:", financeError);
      return apiInternalError("Gagal membuat catatan keuangan: " + financeError.message);
    }

    // Create purchase record
    const { data: purchase, error: purchaseError } = await supabase
      .from("inventory_purchases")
      .insert({
        item_id: id,
        quantity,
        amount,
        subtotal,
        date,
        wallet_id: wallet_id || null,
        bank_id: bank_id || null,
        cash_account_id: cash_account_id || null,
        description: description || "",
        finance_id: finance.id,
        created_by: uid,
      })
      .select(
        "*, inventory_items(id, code, name), wallets(id, name), banks(id, name), cash_accounts(id, name)"
      )
      .single();

    if (purchaseError) {
      console.error("PURCHASE INSERT ERROR:", purchaseError);
      return apiInternalError("Gagal menyimpan pembelian: " + purchaseError.message);
    }

    // Tambah stok inventaris sesuai Jumlah pembelian
    const { error: stockError } = await supabase
      .from("inventory_items")
      .update({ stock: Number(item.stock) + Number(quantity) })
      .eq("id", id);

    if (stockError) {
      console.error("STOCK UPDATE ERROR:", stockError);
      return apiInternalError("Pembelian tersimpan, tetapi gagal menambah stok: " + stockError.message);
    }

    // Attach creator profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", uid)
      .single();

    const result = {
      ...purchase,
      profiles: profile || null,
    };

    await writeAuditLog({
      action: "CREATE",
      targetTable: "inventory_purchases",
      targetId: purchase.id,
      userId: uid,
      newValue: {
        item_id: id,
        quantity,
        amount,
        subtotal,
        date,
        wallet_id: wallet_id || null,
        bank_id: bank_id || null,
        cash_account_id: cash_account_id || null,
        description: description || "",
        finance_id: finance.id,
      },
    });

    return apiCreated(result);
  } catch {
    return apiInternalError();
  }
}
