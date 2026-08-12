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
import { requireAccess } from "@/lib/access";
import { financeFormSchema } from "@/lib/validations/finance";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";
import type { FinanceWithDetails, Profile } from "@/lib/types/database";

async function attachProfiles(
  finances: FinanceWithDetails[],
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>
): Promise<FinanceWithDetails[]> {
  const userIds = [
    ...new Set(finances.map((f) => f.created_by).filter(Boolean) as string[]),
  ];
  if (userIds.length === 0) return finances;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles || []).map((p: Pick<Profile, "id" | "full_name">) => [p.id, p])
  );

  return finances.map((f) => ({
    ...f,
    profiles: f.created_by ? profileMap.get(f.created_by) || null : null,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const supabase = await createSupabaseServer();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const search = searchParams.get("search") || "";
    const sort = searchParams.get("sort") || "created_at";
    const order = searchParams.get("order") || "desc";
    const type = searchParams.get("type");
    const programId = searchParams.get("program_id");
    const handoverId = searchParams.get("handover_id");
    const start_date = searchParams.get("start_date");
    const end_date = searchParams.get("end_date");

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const walletId = searchParams.get("wallet_id");
    const bankId = searchParams.get("bank_id");
    const cashAccountId = searchParams.get("cash_account_id");

    let query = supabase
      .from("finances")
      .select("*, programs(id, name), incidental_projects(id, name), wallets(id, name), banks(id, name), cash_accounts(id, name), handovers(id, period_from, period_to, status)", { count: "exact" });

    if (type) query = query.eq("type", type);
    if (programId) query = query.eq("program_id", programId);
    if (handoverId) query = query.eq("handover_id", handoverId);
    if (walletId) query = query.eq("wallet_id", walletId);
    if (start_date) query = query.gte("date", start_date);
    if (end_date) query = query.lte("date", end_date);

    // Filter by Bank: transaksi langsung ke bank atau via dompet milik bank tsb
    if (bankId) {
      const { data: bankWallets } = await supabase
        .from("wallets")
        .select("id")
        .eq("bank_id", bankId);
      const bankWalletIds = (bankWallets || []).map((w) => w.id);
      if (bankWalletIds.length > 0) {
        query = query.or(`bank_id.eq.${bankId},wallet_id.in.(${bankWalletIds.join(",")})`);
      } else {
        query = query.eq("bank_id", bankId);
      }
    }

    // Filter by Kas: transaksi langsung ke kas atau via dompet milik kas tsb
    if (cashAccountId) {
      const { data: cashWallets } = await supabase
        .from("wallets")
        .select("id")
        .eq("cash_account_id", cashAccountId);
      const cashWalletIds = (cashWallets || []).map((w) => w.id);
      if (cashWalletIds.length > 0) {
        query = query.or(`cash_account_id.eq.${cashAccountId},wallet_id.in.(${cashWalletIds.join(",")})`);
      } else {
        query = query.eq("cash_account_id", cashAccountId);
      }
    }

    if (search) query = query.ilike("description", `%${search}%`);

    const { data, count, error } = await query
      .order(sort, { ascending: order === "asc" })
      .range(from, to);

    if (error) return apiInternalError(error.message);

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    const result = await attachProfiles(data as FinanceWithDetails[], supabase);

    // Transaksi eksternal (dari modul lain) tidak boleh di-edit/di-hapus
    // dari modul Keuangan.
    const resultWithSource = result.map((f) => ({
      ...f,
      is_external: (f.source || "keuangan") !== "keuangan",
    }));

    return apiOk(resultWithSource, { total, page, limit, totalPages });
  } catch (e) {
    console.error("FINANCES GET ERROR:", e);
    return apiInternalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const forbidden = requireAccess(getUserRole(request), "finances", "create");
    if (forbidden) return forbidden;

    const body = await request.json();

    const parsed = financeFormSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const { type, amount, description, date, program_id, project_id, handover_id, receipt_url, receipt_urls, wallet_id, bank_id, cash_account_id } = parsed.data;

    const supabase = await createSupabaseServer();

    const receiptUrls = (receipt_urls || []).filter((u: string) => u.trim() !== "");

    const { data, error } = await supabase
      .from("finances")
      .insert({
        type,
        amount,
        description,
        date,
        program_id: program_id || null,
        project_id: project_id || null,
        handover_id: handover_id || null,
        receipt_url:
          receiptUrls.length > 0 ? receiptUrls.join("\n") : receipt_url || "",
        wallet_id: wallet_id || null,
        bank_id: bank_id || null,
        cash_account_id: cash_account_id || null,
        created_by: uid,
        source: "keuangan",
      })
      .select("*, programs(id, name), incidental_projects(id, name), wallets(id, name), banks(id, name), cash_accounts(id, name), handovers(id, period_from, period_to, status)")
      .single();

    if (error) {
      console.error("FINANCES INSERT ERROR:", error);
      return apiInternalError(error.message);
    }

    await writeAuditLog({
      action: "CREATE",
      targetTable: "finances",
      targetId: data.id,
      userId: uid,
      newValue: {
        type: data.type,
        amount: data.amount,
        description: data.description,
        date: data.date,
        program_id: data.program_id,
        project_id: data.project_id,
      },
    });

    const result = (await attachProfiles([data as FinanceWithDetails], supabase))[0];

    return apiCreated(result);
  } catch (e) {
    console.error("FINANCES POST ERROR:", e);
    return apiInternalError();
  }
}
