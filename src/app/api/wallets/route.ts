import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { walletFormSchema } from "@/lib/validations/settings";
import { requireAccess } from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const supabase = await createSupabaseServer();
    const { searchParams } = new URL(request.url);
    const bankId = searchParams.get("bank_id");
    const cashAccountId = searchParams.get("cash_account_id");

    let query = supabase
      .from("wallets")
      .select("*, banks(id, name), cash_accounts(id, name)")
      .order("name", { ascending: true });

    if (bankId) query = query.eq("bank_id", bankId);
    if (cashAccountId) query = query.eq("cash_account_id", cashAccountId);

    const { data, error } = await query;
    if (error) return apiInternalError(error.message);
    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const forbidden = requireAccess(role, "settings-wallets", "create");
    if (forbidden) return forbidden;

    const body = await request.json();
    const parsed = walletFormSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const { name, description, bank_id, cash_account_id, is_active } = parsed.data;

    if (!bank_id && !cash_account_id) {
      return apiBadRequest("Dompet harus dimiliki oleh Bank atau Kas.");
    }
    if (bank_id && cash_account_id) {
      return apiBadRequest("Dompet hanya boleh dimiliki oleh salah satu: Bank atau Kas.");
    }

    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("wallets")
      .insert({
        name,
        description: description || "",
        bank_id: bank_id || null,
        cash_account_id: cash_account_id || null,
        is_active: is_active !== undefined ? is_active : true,
      })
      .select("*, banks(id, name), cash_accounts(id, name)")
      .single();

    if (error) return apiInternalError(error.message);

    await writeAuditLog({
      action: "CREATE",
      targetTable: "wallets",
      targetId: data.id,
      userId: uid,
      newValue: {
        name: data.name,
        bank_id: data.bank_id,
        cash_account_id: data.cash_account_id,
        is_active: data.is_active,
      },
    });

    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
