import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiUnauthorized,
  apiInternalError,
  getUid,
} from "@/lib/api-response";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const supabase = await createSupabaseServer();
    const { searchParams } = new URL(request.url);
    const bankId = searchParams.get("bank_id");
    const cashAccountId = searchParams.get("cash_account_id");
    const walletId = searchParams.get("wallet_id");

    // Fetch all banks
    const { data: banks } = await supabase
      .from("banks")
      .select("id, name, account_number, account_holder")
      .order("name");

    // Fetch all cash accounts
    const { data: cashAccounts } = await supabase
      .from("cash_accounts")
      .select("id, name")
      .order("name");

    // Fetch wallets with owner info
    let walletQuery = supabase
      .from("wallets")
      .select("id, name, bank_id, cash_account_id, is_active")
      .order("name");

    if (bankId) walletQuery = walletQuery.eq("bank_id", bankId);
    if (cashAccountId) walletQuery = walletQuery.eq("cash_account_id", cashAccountId);
    if (walletId) walletQuery = walletQuery.eq("id", walletId);

    const { data: wallets } = await walletQuery;

    // Fetch all finance transactions for balance calculation
    const { data: finances } = await supabase
      .from("finances")
      .select("type, amount, wallet_id, bank_id, cash_account_id");

    // Calculate balances
    let totalIncome = 0;
    let totalExpense = 0;
    let noSourceIncome = 0;
    let noSourceExpense = 0;

    for (const f of finances || []) {
      if (f.type === "INCOME") totalIncome += Number(f.amount);
      else totalExpense += Number(f.amount);

      // Transaksi tanpa sumber (wallet/bank/kas) → bucket "Belum Dialokasikan"
      if (!f.wallet_id && !f.bank_id && !f.cash_account_id) {
        if (f.type === "INCOME") noSourceIncome += Number(f.amount);
        else noSourceExpense += Number(f.amount);
      }
    }

    // Calculate balance per wallet
    const walletBalances = (wallets || []).map((w) => {
      let income = 0;
      let expense = 0;
      for (const f of finances || []) {
        if (f.wallet_id === w.id) {
          if (f.type === "INCOME") income += Number(f.amount);
          else expense += Number(f.amount);
        }
      }
      return {
        wallet_id: w.id,
        wallet_name: w.name,
        bank_id: w.bank_id,
        cash_account_id: w.cash_account_id,
        is_active: w.is_active,
        income,
        expense,
        balance: income - expense,
      };
    });

    // Calculate balance per bank
    const bankBalances = (banks || []).map((b) => {
      const walletsForBank = walletBalances.filter((w) => w.bank_id === b.id);
      const walletIds = walletsForBank.map((w) => w.wallet_id);

      let income = 0;
      let expense = 0;

      for (const f of finances || []) {
        // Direct bank reference or via wallet
        if (f.bank_id === b.id || (f.wallet_id && walletIds.includes(f.wallet_id))) {
          if (f.type === "INCOME") income += Number(f.amount);
          else expense += Number(f.amount);
        }
      }

      return {
        bank_id: b.id,
        bank_name: b.name,
        account_number: b.account_number,
        account_holder: b.account_holder,
        income,
        expense,
        balance: income - expense,
        wallets: walletsForBank,
      };
    });

    // Calculate balance per cash account
    const cashBalances = (cashAccounts || []).map((c) => {
      const walletsForCash = walletBalances.filter((w) => w.cash_account_id === c.id);
      const walletIds = walletsForCash.map((w) => w.wallet_id);

      let income = 0;
      let expense = 0;

      for (const f of finances || []) {
        // Direct cash reference or via wallet
        if (f.cash_account_id === c.id || (f.wallet_id && walletIds.includes(f.wallet_id))) {
          if (f.type === "INCOME") income += Number(f.amount);
          else expense += Number(f.amount);
        }
      }

      return {
        cash_account_id: c.id,
        cash_account_name: c.name,
        income,
        expense,
        balance: income - expense,
        wallets: walletsForCash,
      };
    });

    return apiOk({
      total_income: totalIncome,
      total_expense: totalExpense,
      total_balance: totalIncome - totalExpense,
      no_source_income: noSourceIncome,
      no_source_expense: noSourceExpense,
      no_source_balance: noSourceIncome - noSourceExpense,
      banks: bankBalances,
      cash_accounts: cashBalances,
      wallets: walletBalances,
    });
  } catch (e) {
    console.error("FINANCE DASHBOARD ERROR:", e);
    return apiInternalError();
  }
}
