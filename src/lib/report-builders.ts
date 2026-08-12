// ============================================================================
// SIORG Modul Pelaporan (A13) — Logika agregasi 20 laporan
// Dipanggil server-side dari /api/reports/data.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportDefinition } from "@/lib/reports";
import {
  formatRp,
  formatDate,
  PROGRAM_STATUS_LABEL,
  FINANCE_TYPE_LABEL,
  LOAN_STATUS_LABEL,
  INVENTORY_CONDITION_LABEL,
  INVENTORY_CATEGORY_LABEL,
  PROJECT_STATUS_LABEL,
  ACHIEVEMENT_JUARA_LABEL,
} from "@/lib/reports";
import type { ReportData, ReportColumn } from "@/lib/types/api";

export interface ReportBuilderContext {
  supabase: SupabaseClient;
  uid: string;
  role: string | null;
  /** division_id milik KABID (scope divisi sendiri). */
  kabidDivisionId?: string | null;
  filters: Record<string, string | undefined>;
}

// ----------------------------------------------------------------------------
// Tipe baris hasil query + relasi embed (tanpa `any`)
// ----------------------------------------------------------------------------

interface MemberRow {
  full_name: string | null;
  nim: string | null;
  email: string | null;
  fakultas: { name: string } | null;
  jurusan: { name: string } | null;
  joined_at: string;
}

interface AttMemberRow {
  id: string;
  full_name: string | null;
  nim: string | null;
  divisions: { name: string } | null;
}

interface ProgramRow {
  id: string;
  name: string | null;
  budget_estimate: number | null;
  status: string | null;
  divisions: { name: string } | null;
}

interface WalletRow {
  id: string;
  name: string;
  bank_id: string | null;
  cash_account_id: string | null;
}

interface FinanceTxRow {
  type: string | null;
  amount: number;
  description: string | null;
  date: string;
  created_by: string | null;
  bank_id: string | null;
  cash_account_id: string | null;
  wallet_id: string | null;
  programs: { name: string } | null;
  wallets: { name: string } | null;
  banks: { name: string } | null;
  cash_accounts: { name: string } | null;
}

interface ProgramSessionRow {
  id: string;
  program_id: string | null;
  date: string;
  title: string | null;
  programs: { name: string } | null;
}

interface ProgramAttendantRow {
  session_id: string;
  user_id: string;
  scanned_at: string | null;
}

interface CoachRow {
  id: string;
  full_name: string | null;
}

interface TrainingSessionRow {
  id: string;
  coach_id: string | null;
  name: string | null;
  date: string;
  created_at: string;
}

interface AssessmentRow {
  athlete_id: string;
  metric_id: string;
  value: number;
}

interface MetricRow {
  id: string;
  name: string | null;
  unit: string | null;
}

interface AchievementRow {
  id: string;
  title: string | null;
  category: string | null;
  level: string | null;
  organizer: string | null;
  achievement_date: string;
  juara: string | null;
  status: string | null;
}

interface AchievementParticipantRow {
  achievement_id: string;
  profiles: { full_name: string } | null;
}

interface InventoryItemRow {
  code: string | null;
  name: string | null;
  category: string | null;
  stock: number;
  unit_price: number;
  condition: string | null;
}

interface InventoryPurchaseRow {
  amount: number;
  date: string;
  description: string | null;
  inventory_items: { name: string } | null;
  wallets: { name: string } | null;
  banks: { name: string } | null;
  cash_accounts: { name: string } | null;
}

interface InventoryLoanRow {
  id: string;
  borrower_id: string;
  quantity: number;
  borrow_date: string;
  return_date: string | null;
  status: string | null;
  inventory_items: { name: string } | null;
}

interface InventoryDisposalRow {
  disposal_date: string;
  quantity: number;
  reason: string | null;
  value_removed: number;
  inventory_items: { name: string } | null;
}

interface LetterRow {
  reference_number: string | null;
  title: string | null;
  sender: string | null;
  date_received_sent: string;
  classification: string | null;
}

interface ProjectRow {
  id: string;
  name: string | null;
  status: string | null;
  start_date: string;
}

interface PrgRow {
  id: string;
  name: string | null;
  start_date: string;
  end_date: string;
  status: string | null;
  budget_estimate: number | null;
  divisions: { name: string } | null;
}

interface PrgSessionRow {
  id: string;
  program_id: string | null;
  date: string;
  title: string | null;
}

interface ScoredAttendantRow {
  session_id: string;
  user_id: string;
  score: number | null;
}

// ----------------------------------------------------------------------------
// Utilitas
// ----------------------------------------------------------------------------

const DUMMY_UUID = "00000000-0000-0000-0000-000000000000";

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

function timeOf(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function addTo(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) || 0) + value);
}

function subtitle(ctx: ReportBuilderContext): string | undefined {
  const f = ctx.filters;
  const parts: string[] = [];
  if (f.date_from || f.date_to) {
    parts.push(
      `${f.date_from ? formatDate(f.date_from) : "…"} s/d ${
        f.date_to ? formatDate(f.date_to) : "…"
      }`
    );
  }
  if (f.cut_off_date) parts.push(`Cut-off: ${formatDate(f.cut_off_date)}`);
  return parts.length ? parts.join(" · ") : undefined;
}

async function fetchProfileNames(
  supabase: SupabaseClient,
  userIds: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);
  for (const p of data || []) map.set(p.id, p.full_name || "-");
  return map;
}

async function fetchPrgRows(ctx: ReportBuilderContext): Promise<PrgRow[]> {
  const supabase = ctx.supabase;
  const f = ctx.filters;
  let q = supabase
    .from("programs")
    .select("id, name, start_date, end_date, status, budget_estimate, divisions(name)");
  if (f.handover_id) q = q.eq("handover_id", f.handover_id);
  if (ctx.kabidDivisionId) q = q.eq("division_id", ctx.kabidDivisionId);
  else if (f.division_id) q = q.eq("division_id", f.division_id);
  if (f.status) q = q.eq("status", f.status);
  if (f.program_id) q = q.eq("id", f.program_id);
  const { data, error } = await q.order("start_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as unknown as PrgRow[];
}

async function periodSubtitle(ctx: ReportBuilderContext): Promise<string | undefined> {
  const f = ctx.filters;
  const parts: string[] = [];
  if (f.handover_id) {
    const { data } = await ctx.supabase
      .from("handovers")
      .select("period_from, period_to")
      .eq("id", f.handover_id)
      .maybeSingle();
    if (data) parts.push(`Periode ${data.period_from} – ${data.period_to}`);
  }
  const base = subtitle(ctx);
  if (base) parts.push(base);
  return parts.length ? parts.join(" · ") : undefined;
}

// ----------------------------------------------------------------------------
// RPT-MBR-01 — Laporan Total Anggota
// ----------------------------------------------------------------------------

async function buildMembers(ctx: ReportBuilderContext): Promise<ReportData> {
  const supabase = ctx.supabase;
  const f = ctx.filters;
  const mode = f.mode || "detail";

  let query = supabase
    .from("profiles")
    .select(
      "full_name, nim, email, division_id, fakultas_id, jurusan_id, joined_at, divisions(name), fakultas(name), jurusan(name)"
    );

  if (f.date_from) query = query.gte("joined_at", f.date_from);
  if (f.date_to) query = query.lte("joined_at", `${f.date_to} 23:59:59`);
  if (f.fakultas_id) query = query.eq("fakultas_id", f.fakultas_id);
  if (f.jurusan_id) query = query.eq("jurusan_id", f.jurusan_id);
  if (ctx.kabidDivisionId) query = query.eq("division_id", ctx.kabidDivisionId);

  const { data, error } = await query.order("joined_at", { ascending: true });
  if (error) throw new Error(error.message);

  const members = (data || []) as unknown as MemberRow[];
  let columns: ReportColumn[];
  let rows: ReportData["rows"];

  if (mode === "ringkas") {
    const byFakultas = new Map<string, number>();
    for (const m of members) {
      addTo(byFakultas, m.fakultas?.name || "Tanpa Fakultas", 1);
    }
    columns = [
      { key: "fakultas", label: "Fakultas" },
      { key: "total", label: "Total Anggota", align: "right" },
    ];
    rows = [...byFakultas.entries()].map(([name, total]) => ({
      fakultas: name,
      total,
    }));
  } else {
    columns = [
      { key: "nama", label: "Nama" },
      { key: "nim", label: "NIM" },
      { key: "email", label: "Email" },
      { key: "jurusan", label: "Jurusan" },
      { key: "fakultas", label: "Fakultas" },
      { key: "terdaftar", label: "Tanggal Terdaftar" },
    ];
    rows = members.map((m) => ({
      nama: m.full_name || "-",
      nim: m.nim || "-",
      email: m.email || "-",
      jurusan: m.jurusan?.name || "-",
      fakultas: m.fakultas?.name || "-",
      terdaftar: formatDate(m.joined_at),
    }));
  }

  return {
    type: "rpt-mbr-01",
    title: "Laporan Total Anggota",
    subtitle: subtitle(ctx),
    columns,
    rows,
    summary: [{ label: "Total Anggota", value: formatNumber(members.length) }],
  };
}

// ----------------------------------------------------------------------------
// RPT-FIN-01 — Realisasi Anggaran per Program Kerja
// ----------------------------------------------------------------------------

async function buildFinRealisasi(ctx: ReportBuilderContext): Promise<ReportData> {
  const supabase = ctx.supabase;
  const f = ctx.filters;

  let query = supabase
    .from("programs")
    .select("id, name, budget_estimate, status, divisions(name)");

  if (ctx.kabidDivisionId) query = query.eq("division_id", ctx.kabidDivisionId);
  else if (f.division_id) query = query.eq("division_id", f.division_id);
  if (f.status) query = query.eq("status", f.status);

  const { data, error } = await query.order("name", { ascending: true });
  if (error) throw new Error(error.message);

  const programs = (data || []) as unknown as ProgramRow[];
  const programIds = programs.map((p: { id: string }) => p.id);

  const realisasi = new Map<string, number>();
  if (programIds.length) {
    const { data: txs, error: txErr } = await supabase
      .from("finances")
      .select("program_id, amount")
      .eq("type", "EXPENSE")
      .in("program_id", programIds);
    if (txErr) throw new Error(txErr.message);
    for (const t of txs || []) {
      if (t.program_id) addTo(realisasi, t.program_id, num(t.amount));
    }
  }

  let totalAnggaran = 0;
  let totalRealisasi = 0;
  let totalSisa = 0;

  const rows = programs.map((p) => {
    const anggaran = num(p.budget_estimate);
    const r = realisasi.get(p.id) || 0;
    const sisa = anggaran - r;
    const persen = anggaran > 0 ? Math.round((r / anggaran) * 100) : 0;
    totalAnggaran += anggaran;
    totalRealisasi += r;
    totalSisa += sisa;
    return {
      proker: p.name || "-",
      divisi: p.divisions?.name || "-",
      status: (p.status && PROGRAM_STATUS_LABEL[p.status]) || p.status || "-",
      anggaran: formatRp(anggaran),
      realisasi: formatRp(r),
      sisa: formatRp(sisa),
      persentase: `${persen}%`,
    };
  });

  const columns: ReportColumn[] = [
    { key: "proker", label: "Program Kerja" },
    { key: "divisi", label: "Divisi" },
    { key: "status", label: "Status" },
    { key: "anggaran", label: "Anggaran", align: "right" },
    { key: "realisasi", label: "Realisasi", align: "right" },
    { key: "sisa", label: "Sisa", align: "right" },
    { key: "persentase", label: "Realisasi %", align: "right" },
  ];

  return {
    type: "rpt-fin-01",
    title: "Realisasi Anggaran per Program Kerja",
    subtitle: subtitle(ctx),
    columns,
    rows,
    summary: [
      { label: "Total Program", value: formatNumber(rows.length) },
      { label: "Total Anggaran", value: formatRp(totalAnggaran) },
      { label: "Total Realisasi", value: formatRp(totalRealisasi) },
      { label: "Total Sisa", value: formatRp(totalSisa) },
    ],
  };
}

// ----------------------------------------------------------------------------
// RPT-FIN-02 — Total Saldo Kas/Bank/Dompet (cut-off)
// ----------------------------------------------------------------------------

async function buildFinSaldo(ctx: ReportBuilderContext): Promise<ReportData> {
  const supabase = ctx.supabase;
  const f = ctx.filters;
  const cutOff = f.cut_off_date;

  const { data: banks } = await supabase
    .from("banks")
    .select("id, name")
    .order("name");
  const { data: cashAccounts } = await supabase
    .from("cash_accounts")
    .select("id, name")
    .order("name");
  const { data: wallets } = await supabase
    .from("wallets")
    .select("id, name, bank_id, cash_account_id")
    .order("name");

  let q = supabase
    .from("finances")
    .select("type, amount, wallet_id, bank_id, cash_account_id");
  if (cutOff) q = q.lte("date", cutOff);
  const { data: finances } = await q;

  const txs = finances || [];

  const walletBalances = (wallets || []).map((w: WalletRow) => {
    let income = 0;
    let expense = 0;
    for (const tx of txs) {
      if (tx.wallet_id !== w.id) continue;
      if (tx.type === "INCOME") income += num(tx.amount);
      else expense += num(tx.amount);
    }
    return {
      id: w.id,
      name: w.name,
      bank_id: w.bank_id,
      cash_account_id: w.cash_account_id,
      income,
      expense,
      balance: income - expense,
    };
  });

  const buildRows: {
    key: string;
    name: string;
    jenis: string;
    income: number;
    expense: number;
    balance: number;
  }[] = [];

  for (const b of banks || []) {
    const walletIds = walletBalances
      .filter((w) => w.bank_id === b.id)
      .map((w) => w.id);
    let income = 0;
    let expense = 0;
    for (const tx of txs) {
      if (tx.bank_id === b.id || (tx.wallet_id && walletIds.includes(tx.wallet_id))) {
        if (tx.type === "INCOME") income += num(tx.amount);
        else expense += num(tx.amount);
      }
    }
    buildRows.push({
      key: `bank:${b.id}`,
      name: b.name,
      jenis: "Bank",
      income,
      expense,
      balance: income - expense,
    });
  }

  for (const c of cashAccounts || []) {
    const walletIds = walletBalances
      .filter((w) => w.cash_account_id === c.id)
      .map((w) => w.id);
    let income = 0;
    let expense = 0;
    for (const tx of txs) {
      if (tx.cash_account_id === c.id || (tx.wallet_id && walletIds.includes(tx.wallet_id))) {
        if (tx.type === "INCOME") income += num(tx.amount);
        else expense += num(tx.amount);
      }
    }
    buildRows.push({
      key: `cash:${c.id}`,
      name: c.name,
      jenis: "Kas",
      income,
      expense,
      balance: income - expense,
    });
  }

  for (const w of walletBalances) {
    if (w.bank_id || w.cash_account_id) continue;
    buildRows.push({
      key: w.id,
      name: w.name,
      jenis: "Dompet",
      income: w.income,
      expense: w.expense,
      balance: w.balance,
    });
  }

  let noSourceIncome = 0;
  let noSourceExpense = 0;
  for (const tx of txs) {
    if (!tx.wallet_id && !tx.bank_id && !tx.cash_account_id) {
      if (tx.type === "INCOME") noSourceIncome += num(tx.amount);
      else noSourceExpense += num(tx.amount);
    }
  }
  if (noSourceIncome || noSourceExpense) {
    buildRows.push({
      key: "none",
      name: "Belum Dialokasikan",
      jenis: "-",
      income: noSourceIncome,
      expense: noSourceExpense,
      balance: noSourceIncome - noSourceExpense,
    });
  }

  const filtered =
    f.account_id && !f.account_id.includes(",")
      ? buildRows.filter((a) => a.key === f.account_id)
      : buildRows;

  const columns: ReportColumn[] = [
    { key: "nama", label: "Akun" },
    { key: "jenis", label: "Jenis" },
    { key: "income", label: "Pemasukan", align: "right" },
    { key: "expense", label: "Pengeluaran", align: "right" },
    { key: "saldo", label: "Saldo", align: "right" },
  ];

  const rows = filtered.map((a) => ({
    nama: a.name,
    jenis: a.jenis,
    income: formatRp(a.income),
    expense: formatRp(a.expense),
    saldo: formatRp(a.balance),
  }));

  const totalSaldo = filtered.reduce((s, a) => s + a.balance, 0);
  const totalIncome = filtered.reduce((s, a) => s + a.income, 0);
  const totalExpense = filtered.reduce((s, a) => s + a.expense, 0);

  return {
    type: "rpt-fin-02",
    title: "Total Saldo Kas/Bank/Dompet",
    subtitle: subtitle(ctx),
    columns,
    rows,
    summary: [
      { label: "Total Saldo", value: formatRp(totalSaldo) },
      { label: "Total Pemasukan", value: formatRp(totalIncome) },
      { label: "Total Pengeluaran", value: formatRp(totalExpense) },
    ],
  };
}

// ----------------------------------------------------------------------------
// RPT-FIN-03 — Pemasukan / Pengeluaran (mutasi)
// ----------------------------------------------------------------------------

async function buildFinMutasi(ctx: ReportBuilderContext): Promise<ReportData> {
  const supabase = ctx.supabase;
  const f = ctx.filters;

  let q = supabase
    .from("finances")
    .select(
      "id, type, amount, description, date, program_id, wallet_id, bank_id, cash_account_id, created_by, programs(name), wallets(name), banks(name), cash_accounts(name)"
    );

  if (f.date_from) q = q.gte("date", f.date_from);
  if (f.date_to) q = q.lte("date", f.date_to);
  if (f.type) q = q.eq("type", f.type);
  if (f.program_id) q = q.eq("program_id", f.program_id);

  const { data, error } = await q
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  let txs = (data || []) as unknown as FinanceTxRow[];

  const accountFilter = f.account_id;
  if (accountFilter) {
    if (accountFilter.startsWith("bank:"))
      txs = txs.filter((t) => t.bank_id === accountFilter.slice(5));
    else if (accountFilter.startsWith("cash:"))
      txs = txs.filter((t) => t.cash_account_id === accountFilter.slice(5));
    else txs = txs.filter((t) => t.wallet_id === accountFilter);
  }

  const names = await fetchProfileNames(
    supabase,
    txs.map((t) => t.created_by)
  );

  let totalIncome = 0;
  let totalExpense = 0;

  const rows = txs.map((t) => {
    const amount = num(t.amount);
    if (t.type === "INCOME") totalIncome += amount;
    else totalExpense += amount;
    return {
      tanggal: formatDate(t.date),
      deskripsi: t.description || "-",
      program: t.programs?.name || "-",
      akun: t.wallets?.name || t.banks?.name || t.cash_accounts?.name || "-",
      tipe: (t.type && FINANCE_TYPE_LABEL[t.type]) || t.type || "-",
      pencatat: names.get(t.created_by || "") || "-",
      jumlah: formatRp(amount),
    };
  });

  const columns: ReportColumn[] = [
    { key: "tanggal", label: "Tanggal" },
    { key: "deskripsi", label: "Deskripsi" },
    { key: "program", label: "Program" },
    { key: "akun", label: "Akun" },
    { key: "tipe", label: "Tipe" },
    { key: "pencatat", label: "Dicatat Oleh" },
    { key: "jumlah", label: "Jumlah", align: "right" },
  ];

  return {
    type: "rpt-fin-03",
    title: "Pemasukan / Pengeluaran",
    subtitle: subtitle(ctx),
    columns,
    rows,
    summary: [
      { label: "Total Pemasukan", value: formatRp(totalIncome) },
      { label: "Total Pengeluaran", value: formatRp(totalExpense) },
      { label: "Selisih", value: formatRp(totalIncome - totalExpense) },
      { label: "Total Transaksi", value: formatNumber(rows.length) },
    ],
  };
}

// ----------------------------------------------------------------------------
// RPT-ATT-01 — Rekap Kehadiran per Kegiatan/Sesi
// ----------------------------------------------------------------------------

async function buildAttSesi(ctx: ReportBuilderContext): Promise<ReportData> {
  const supabase = ctx.supabase;
  const f = ctx.filters;

  let q = supabase
    .from("program_sessions")
    .select("id, program_id, date, title, programs(name)");

  if (f.date_from) q = q.gte("date", f.date_from);
  if (f.date_to) q = q.lte("date", f.date_to);
  if (f.program_id) q = q.eq("program_id", f.program_id);

  if (ctx.kabidDivisionId) {
    const { data: owned } = await supabase
      .from("programs")
      .select("id")
      .eq("division_id", ctx.kabidDivisionId);
    const ids = (owned || []).map((p) => p.id);
    q = ids.length ? q.in("program_id", ids) : q.in("program_id", [DUMMY_UUID]);
  }

  const { data, error } = await q.order("date", { ascending: true });
  if (error) throw new Error(error.message);

  const sessions = (data || []) as unknown as ProgramSessionRow[];
  const sessionIds = sessions.map((s: { id: string }) => s.id);

  const memberCount = new Map<string, number>();
  const programIds = [
    ...new Set(
      sessions
        .map((s) => s.program_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  if (programIds.length) {
    const { data: members } = await supabase
      .from("program_members")
      .select("program_id")
      .in("program_id", programIds);
    for (const m of members || []) addTo(memberCount, m.program_id, 1);
  }

  const attendantBySession = new Map<string, ProgramAttendantRow[]>();
  let allAttendants: ProgramAttendantRow[] = [];
  if (sessionIds.length) {
    const { data: atts } = await supabase
      .from("program_session_attendants")
      .select("session_id, user_id, scanned_at")
      .in("session_id", sessionIds);
    allAttendants = (atts || []) as ProgramAttendantRow[];
    for (const a of allAttendants) {
      const list = attendantBySession.get(a.session_id) || [];
      list.push(a);
      attendantBySession.set(a.session_id, list);
    }
  }

  const names = await fetchProfileNames(
    supabase,
    allAttendants.map((a) => a.user_id)
  );

  let totalHadir = 0;
  const rows = sessions.map((s) => {
    const atts = attendantBySession.get(s.id) || [];
    const hadir = atts.length;
    totalHadir += hadir;
    const total = memberCount.get(s.program_id || "") || 0;
    const firstScan = atts.length
      ? atts.map((a) => a.scanned_at).sort().find(Boolean)
      : null;
    const namesList = atts.map((a) => names.get(a.user_id) || "-");
    return {
      sesi: s.title || `Sesi ${formatDate(s.date)}`,
      program: s.programs?.name || "-",
      tanggal: formatDate(s.date),
      jam: timeOf(firstScan),
      hadir,
      tidakHadir: Math.max(0, total - hadir),
      daftar: namesList.length ? namesList.join(", ") : "-",
    };
  });

  const columns: ReportColumn[] = [
    { key: "sesi", label: "Kegiatan/Sesi" },
    { key: "program", label: "Program" },
    { key: "tanggal", label: "Tanggal" },
    { key: "jam", label: "Jam" },
    { key: "hadir", label: "Hadir", align: "right" },
    { key: "tidakHadir", label: "Tidak Hadir", align: "right" },
    { key: "daftar", label: "Daftar Hadir" },
  ];

  return {
    type: "rpt-att-01",
    title: "Rekap Kehadiran per Kegiatan/Sesi",
    subtitle: subtitle(ctx),
    columns,
    rows,
    summary: [
      { label: "Total Sesi", value: formatNumber(rows.length) },
      { label: "Total Kehadiran", value: formatNumber(totalHadir) },
    ],
  };
}

// ----------------------------------------------------------------------------
// RPT-ATT-02 — Rekap Kehadiran per Anggota
// ----------------------------------------------------------------------------

async function buildAttAnggota(ctx: ReportBuilderContext): Promise<ReportData> {
  const supabase = ctx.supabase;
  const f = ctx.filters;

  let sq = supabase.from("program_sessions").select("id, date");
  if (f.date_from) sq = sq.gte("date", f.date_from);
  if (f.date_to) sq = sq.lte("date", f.date_to);
  if (ctx.kabidDivisionId) {
    const { data: owned } = await supabase
      .from("programs")
      .select("id")
      .eq("division_id", ctx.kabidDivisionId);
    const ids = (owned || []).map((p) => p.id);
    sq = ids.length ? sq.in("program_id", ids) : sq.in("program_id", [DUMMY_UUID]);
  }

  const { data: sessions } = await sq.order("date", { ascending: true });
  const sessionList = sessions || [];
  const sessionIds = sessionList.map((s: { id: string }) => s.id);
  const sessionDate = new Map<string, string>();
  for (const s of sessionList) sessionDate.set(s.id, s.date);

  let attRecords: ProgramAttendantRow[] = [];
  if (sessionIds.length) {
    const { data } = await supabase
      .from("program_session_attendants")
      .select("session_id, user_id, scanned_at")
      .in("session_id", sessionIds);
    attRecords = (data || []) as ProgramAttendantRow[];
  }

  let pq = supabase
    .from("profiles")
    .select("id, full_name, nim, division_id, divisions(name)");
  if (ctx.kabidDivisionId) pq = pq.eq("division_id", ctx.kabidDivisionId);
  else if (f.division_id) pq = pq.eq("division_id", f.division_id);
  const { data: members } = await pq.order("full_name", { ascending: true });
  const memberList = (members || []) as unknown as AttMemberRow[];

  const attendedByUser = new Map<string, ProgramAttendantRow[]>();
  for (const a of attRecords) {
    const list = attendedByUser.get(a.user_id) || [];
    list.push(a);
    attendedByUser.set(a.user_id, list);
  }

  const totalSessions = sessionList.length;
  let sumPct = 0;
  const rows = memberList.map((m) => {
    const atts = attendedByUser.get(m.id) || [];
    const hadir = atts.length;
    const pct = totalSessions > 0 ? Math.round((hadir / totalSessions) * 100) : 0;
    sumPct += pct;
    const rincian = atts
      .map((a) => `${formatDate(sessionDate.get(a.session_id))} ${timeOf(a.scanned_at)}`)
      .join("; ");
    return {
      anggota: m.full_name || "-",
      nim: m.nim || "-",
      divisi: m.divisions?.name || "-",
      totalSesi: totalSessions,
      hadir,
      persentase: `${pct}%`,
      rincian: rincian || "-",
    };
  });

  const avgPct = rows.length ? Math.round(sumPct / rows.length) : 0;

  const columns: ReportColumn[] = [
    { key: "anggota", label: "Anggota" },
    { key: "nim", label: "NIM" },
    { key: "divisi", label: "Divisi" },
    { key: "totalSesi", label: "Total Sesi", align: "right" },
    { key: "hadir", label: "Hadir", align: "right" },
    { key: "persentase", label: "Kehadiran", align: "right" },
    { key: "rincian", label: "Rincian Sesi" },
  ];

  return {
    type: "rpt-att-02",
    title: "Rekap Kehadiran per Anggota",
    subtitle: subtitle(ctx),
    columns,
    rows,
    summary: [
      { label: "Total Anggota", value: formatNumber(rows.length) },
      { label: "Total Sesi", value: formatNumber(totalSessions) },
      { label: "Rata-rata Kehadiran", value: `${avgPct}%` },
    ],
  };
}

// ----------------------------------------------------------------------------
// RPT-ATH-01 — Rekap Kehadiran Pelatih
// ----------------------------------------------------------------------------

async function buildAthPelatih(ctx: ReportBuilderContext): Promise<ReportData> {
  const supabase = ctx.supabase;
  const f = ctx.filters;

  const { data: coaches } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "PELATIH")
    .order("full_name");

  let q = supabase
    .from("training_sessions")
    .select("id, coach_id, name, date, created_at");
  if (f.date_from) q = q.gte("date", f.date_from);
  if (f.date_to) q = q.lte("date", f.date_to);
  if (ctx.role === "PELATIH") q = q.eq("coach_id", ctx.uid);

  const { data: sessions, error } = await q.order("date", { ascending: true });
  if (error) throw new Error(error.message);

  const byCoach = new Map<string, TrainingSessionRow[]>();
  for (const s of sessions || []) {
    if (!s.coach_id) continue;
    const list = byCoach.get(s.coach_id) || [];
    list.push(s as TrainingSessionRow);
    byCoach.set(s.coach_id, list);
  }

  const rows = (coaches || []).map((c: CoachRow) => {
    const list = byCoach.get(c.id) || [];
    return {
      pelatih: c.full_name || "-",
      jumlahSesi: list.length,
      rincian: list.length
        ? list.map((s) => `${s.name || "Sesi"} (${formatDate(s.date)})`).join("; ")
        : "-",
    };
  });

  const columns: ReportColumn[] = [
    { key: "pelatih", label: "Pelatih" },
    { key: "jumlahSesi", label: "Jumlah Sesi", align: "right" },
    { key: "rincian", label: "Rincian Sesi" },
  ];

  return {
    type: "rpt-ath-01",
    title: "Rekap Kehadiran Pelatih",
    subtitle: subtitle(ctx),
    columns,
    rows,
    summary: [
      { label: "Total Pelatih", value: formatNumber(rows.length) },
      { label: "Total Sesi", value: formatNumber((sessions || []).length) },
    ],
  };
}

// ----------------------------------------------------------------------------
// RPT-ATH-02 — Rata-rata Nilai per Atlet (pivot)
// ----------------------------------------------------------------------------

async function buildAthRataPerAtlet(ctx: ReportBuilderContext): Promise<ReportData> {
  const supabase = ctx.supabase;
  const f = ctx.filters;

  let sq = supabase.from("training_sessions").select("id");
  if (f.date_from) sq = sq.gte("date", f.date_from);
  if (f.date_to) sq = sq.lte("date", f.date_to);
  const { data: sessions } = await sq;
  const sessionIds = (sessions || []).map((s: { id: string }) => s.id);

  const { data: metrics } = await supabase
    .from("athletic_metrics")
    .select("id, name")
    .order("name");
  const metricList = metrics || [];

  let ass: AssessmentRow[] = [];
  if (sessionIds.length) {
    const { data } = await supabase
      .from("assessments")
      .select("athlete_id, metric_id, value")
      .in("session_id", sessionIds);
    ass = (data || []) as AssessmentRow[];
  }

  const names = await fetchProfileNames(
    supabase,
    ass.map((a) => a.athlete_id)
  );

  const byAthlete = new Map<string, Map<string, { sum: number; count: number }>>();
  for (const a of ass) {
    const per = byAthlete.get(a.athlete_id) || new Map();
    const cur = per.get(a.metric_id) || { sum: 0, count: 0 };
    cur.sum += num(a.value);
    cur.count += 1;
    per.set(a.metric_id, cur);
    byAthlete.set(a.athlete_id, per);
  }

  const columns: ReportColumn[] = [
    { key: "atlet", label: "Atlet" },
    ...metricList.map((m) => ({
      key: m.id,
      label: m.name,
      align: "right" as const,
    })),
  ];

  const rows = [...byAthlete.entries()].map(([athleteId, per]) => {
    const row: Record<string, string | number | null> = {
      atlet: names.get(athleteId) || "-",
    };
    for (const m of metricList) {
      const cur = per.get(m.id);
      row[m.id] = cur
        ? formatNumber(Math.round((cur.sum / cur.count) * 100) / 100)
        : null;
    }
    return row;
  });

  return {
    type: "rpt-ath-02",
    title: "Rata-rata Nilai per Atlet",
    subtitle: subtitle(ctx),
    columns,
    rows,
    summary: [
      { label: "Total Atlet", value: formatNumber(rows.length) },
      { label: "Total Metrik", value: formatNumber(metricList.length) },
    ],
  };
}

// ----------------------------------------------------------------------------
// RPT-ATH-03 — Rata-rata Nilai Seluruh Atlet
// ----------------------------------------------------------------------------

async function buildAthRataSemua(ctx: ReportBuilderContext): Promise<ReportData> {
  const supabase = ctx.supabase;
  const f = ctx.filters;

  let sq = supabase.from("training_sessions").select("id");
  if (f.date_from) sq = sq.gte("date", f.date_from);
  if (f.date_to) sq = sq.lte("date", f.date_to);
  const { data: sessions } = await sq;
  const sessionIds = (sessions || []).map((s: { id: string }) => s.id);

  const { data: metrics } = await supabase
    .from("athletic_metrics")
    .select("id, name, unit")
    .order("name");
  const metricList = metrics || [];

  let ass: AssessmentRow[] = [];
  if (sessionIds.length) {
    const { data } = await supabase
      .from("assessments")
      .select("metric_id, value")
      .in("session_id", sessionIds);
    ass = (data || []) as AssessmentRow[];
  }

  const perMetric = new Map<
    string,
    { sum: number; count: number; min: number; max: number }
  >();
  for (const a of ass) {
    const v = num(a.value);
    const cur = perMetric.get(a.metric_id) || {
      sum: 0,
      count: 0,
      min: Infinity,
      max: -Infinity,
    };
    cur.sum += v;
    cur.count += 1;
    cur.min = Math.min(cur.min, v);
    cur.max = Math.max(cur.max, v);
    perMetric.set(a.metric_id, cur);
  }

  const rows = metricList.map((m: MetricRow) => {
    const cur = perMetric.get(m.id);
    return {
      metrik: m.name || "-",
      unit: m.unit || "-",
      rata: cur ? formatNumber(Math.round((cur.sum / cur.count) * 100) / 100) : "-",
      terendah: cur ? formatNumber(cur.min) : "-",
      tertinggi: cur ? formatNumber(cur.max) : "-",
      jumlah: cur ? cur.count : 0,
    };
  });

  const columns: ReportColumn[] = [
    { key: "metrik", label: "Metrik" },
    { key: "unit", label: "Unit" },
    { key: "rata", label: "Rata-rata", align: "right" },
    { key: "terendah", label: "Terendah", align: "right" },
    { key: "tertinggi", label: "Tertinggi", align: "right" },
    { key: "jumlah", label: "Jumlah Penilaian", align: "right" },
  ];

  return {
    type: "rpt-ath-03",
    title: "Rata-rata Nilai Seluruh Atlet",
    subtitle: subtitle(ctx),
    columns,
    rows,
    summary: [
      { label: "Total Penilaian", value: formatNumber(ass.length) },
      { label: "Total Metrik", value: formatNumber(metricList.length) },
    ],
  };
}

// ----------------------------------------------------------------------------
// RPT-ACH-01 — Rekap Prestasi per Periode
// ----------------------------------------------------------------------------

async function buildAch(ctx: ReportBuilderContext): Promise<ReportData> {
  const supabase = ctx.supabase;
  const f = ctx.filters;

  let q = supabase
    .from("achievements")
    .select("id, title, category, level, organizer, achievement_date, juara, status");
  if (f.date_from) q = q.gte("achievement_date", f.date_from);
  if (f.date_to) q = q.lte("achievement_date", f.date_to);
  if (f.level) q = q.eq("level", f.level);
  q = q.eq("status", "APPROVED");

  const { data: achievements, error } = await q.order("achievement_date", {
    ascending: false,
  });
  if (error) throw new Error(error.message);

  const ids = (achievements || []).map((a: { id: string }) => a.id);
  const participantsByAch = new Map<string, string[]>();
  if (ids.length) {
    const { data: parts } = await supabase
      .from("achievement_participants")
      .select("achievement_id, profiles(full_name)")
      .in("achievement_id", ids);
    for (const p of (parts || []) as unknown as AchievementParticipantRow[]) {
      const list = participantsByAch.get(p.achievement_id) || [];
      if (p.profiles?.full_name) list.push(p.profiles.full_name);
      participantsByAch.set(p.achievement_id, list);
    }
  }

  const rows = (achievements || []).map((a: AchievementRow) => ({
    prestasi: a.title || "-",
    kategori: a.category || "-",
    level: a.level || "-",
    penyelenggara: a.organizer || "-",
    tanggal: formatDate(a.achievement_date),
    juara: (a.juara && ACHIEVEMENT_JUARA_LABEL[a.juara]) || a.juara || "-",
    peserta: participantsByAch.get(a.id)?.join(", ") || "-",
  }));

  const columns: ReportColumn[] = [
    { key: "prestasi", label: "Prestasi" },
    { key: "kategori", label: "Kategori" },
    { key: "level", label: "Level" },
    { key: "penyelenggara", label: "Penyelenggara" },
    { key: "tanggal", label: "Tanggal" },
    { key: "juara", label: "Juara" },
    { key: "peserta", label: "Peserta" },
  ];

  return {
    type: "rpt-ach-01",
    title: "Rekap Prestasi per Periode",
    subtitle: subtitle(ctx),
    columns,
    rows,
    summary: [{ label: "Total Prestasi", value: formatNumber(rows.length) }],
  };
}

// ----------------------------------------------------------------------------
// RPT-INV-01 — Total Item Inventaris
// ----------------------------------------------------------------------------

async function buildInvTotal(ctx: ReportBuilderContext): Promise<ReportData> {
  const supabase = ctx.supabase;
  const f = ctx.filters;

  let q = supabase.from("inventory_items").select("category, stock");
  if (f.category) q = q.eq("category", f.category);
  const { data } = await q;
  const items = data || [];

  const byCat = new Map<string, { jenis: number; unit: number }>();
  for (const it of items) {
    const cur = byCat.get(it.category) || { jenis: 0, unit: 0 };
    cur.jenis += 1;
    cur.unit += num(it.stock);
    byCat.set(it.category, cur);
  }

  const rows = [...byCat.entries()].map(([cat, v]) => ({
    kategori: INVENTORY_CATEGORY_LABEL[cat] || cat || "-",
    jenis: v.jenis,
    unit: v.unit,
  }));

  const columns: ReportColumn[] = [
    { key: "kategori", label: "Kategori" },
    { key: "jenis", label: "Jenis Barang", align: "right" },
    { key: "unit", label: "Total Unit", align: "right" },
  ];

  const totalUnit = items.reduce((s, i) => s + num(i.stock), 0);

  return {
    type: "rpt-inv-01",
    title: "Total Item Inventaris",
    subtitle: subtitle(ctx),
    columns,
    rows,
    summary: [
      { label: "Total Jenis Barang", value: formatNumber(items.length) },
      { label: "Total Unit", value: formatNumber(totalUnit) },
    ],
  };
}

// ----------------------------------------------------------------------------
// RPT-INV-02 — Total Nilai (Rp) Inventaris
// ----------------------------------------------------------------------------

async function buildInvNilai(ctx: ReportBuilderContext): Promise<ReportData> {
  const supabase = ctx.supabase;
  const f = ctx.filters;

  let q = supabase
    .from("inventory_items")
    .select("category, name, stock, unit_price");
  if (f.category) q = q.eq("category", f.category);
  const { data } = await q;
  const items = data || [];

  const byCat = new Map<string, { jenis: number; unit: number; nilai: number }>();
  for (const it of items) {
    const cur = byCat.get(it.category) || { jenis: 0, unit: 0, nilai: 0 };
    cur.jenis += 1;
    cur.unit += num(it.stock);
    cur.nilai += num(it.stock) * num(it.unit_price);
    byCat.set(it.category, cur);
  }

  const rows = [...byCat.entries()].map(([cat, v]) => ({
    kategori: INVENTORY_CATEGORY_LABEL[cat] || cat || "-",
    jenis: v.jenis,
    unit: v.unit,
    nilai: formatRp(v.nilai),
  }));

  const columns: ReportColumn[] = [
    { key: "kategori", label: "Kategori" },
    { key: "jenis", label: "Jenis Barang", align: "right" },
    { key: "unit", label: "Total Unit", align: "right" },
    { key: "nilai", label: "Total Nilai", align: "right" },
  ];

  const totalNilai = items.reduce(
    (s, i) => s + num(i.stock) * num(i.unit_price),
    0
  );

  return {
    type: "rpt-inv-02",
    title: "Total Nilai (Rp) Inventaris",
    subtitle: subtitle(ctx),
    columns,
    rows,
    summary: [
      { label: "Total Jenis Barang", value: formatNumber(items.length) },
      { label: "Total Unit", value: formatNumber(items.reduce((s, i) => s + num(i.stock), 0)) },
      { label: "Total Nilai", value: formatRp(totalNilai) },
    ],
  };
}

// ----------------------------------------------------------------------------
// RPT-INV-03 — Pembelian Inventaris
// ----------------------------------------------------------------------------

async function buildInvPembelian(ctx: ReportBuilderContext): Promise<ReportData> {
  const supabase = ctx.supabase;
  const f = ctx.filters;

  let q = supabase
    .from("inventory_purchases")
    .select(
      "id, amount, date, description, inventory_items(name), wallets(name), banks(name), cash_accounts(name)"
    );
  if (f.date_from) q = q.gte("date", f.date_from);
  if (f.date_to) q = q.lte("date", f.date_to);

  const { data, error } = await q.order("date", { ascending: false });
  if (error) throw new Error(error.message);

  let total = 0;
  const rows = ((data || []) as unknown as InventoryPurchaseRow[]).map((p) => {
    const amount = num(p.amount);
    total += amount;
    return {
      tanggal: formatDate(p.date),
      barang: p.inventory_items?.name || "-",
      deskripsi: p.description || "-",
      sumber: p.wallets?.name || p.banks?.name || p.cash_accounts?.name || "-",
      jumlah: formatRp(amount),
    };
  });

  const columns: ReportColumn[] = [
    { key: "tanggal", label: "Tanggal" },
    { key: "barang", label: "Barang" },
    { key: "deskripsi", label: "Deskripsi" },
    { key: "sumber", label: "Sumber" },
    { key: "jumlah", label: "Jumlah", align: "right" },
  ];

  return {
    type: "rpt-inv-03",
    title: "Pembelian Inventaris",
    subtitle: subtitle(ctx),
    columns,
    rows,
    summary: [
      { label: "Total Transaksi", value: formatNumber(rows.length) },
      { label: "Total Pembelian", value: formatRp(total) },
    ],
  };
}

// ----------------------------------------------------------------------------
// RPT-INV-04 — Peminjaman Inventaris
// ----------------------------------------------------------------------------

async function buildInvPinjam(ctx: ReportBuilderContext): Promise<ReportData> {
  const supabase = ctx.supabase;
  const f = ctx.filters;

  let q = supabase
    .from("inventory_loans")
    .select(
      "id, item_id, borrower_id, quantity, borrow_date, return_date, status, purpose, inventory_items(name)"
    );
  if (f.date_from) q = q.gte("borrow_date", f.date_from);
  if (f.date_to) q = q.lte("borrow_date", f.date_to);
  if (f.status) q = q.eq("status", f.status);

  const { data, error } = await q.order("borrow_date", { ascending: false });
  if (error) throw new Error(error.message);

  const loans = (data || []) as unknown as InventoryLoanRow[];
  const names = await fetchProfileNames(
    supabase,
    loans.map((l) => l.borrower_id)
  );

  const rows = loans.map((l) => ({
    barang: l.inventory_items?.name || "-",
    peminjam: names.get(l.borrower_id) || "-",
    jumlah: l.quantity,
    tglPinjam: formatDate(l.borrow_date),
    tglKembali: formatDate(l.return_date),
    status: (l.status && LOAN_STATUS_LABEL[l.status]) || l.status || "-",
  }));

  const columns: ReportColumn[] = [
    { key: "barang", label: "Barang" },
    { key: "peminjam", label: "Peminjam" },
    { key: "jumlah", label: "Jumlah", align: "right" },
    { key: "tglPinjam", label: "Tanggal Pinjam" },
    { key: "tglKembali", label: "Tanggal Kembali" },
    { key: "status", label: "Status" },
  ];

  return {
    type: "rpt-inv-04",
    title: "Peminjaman Inventaris",
    subtitle: subtitle(ctx),
    columns,
    rows,
    summary: [{ label: "Total Peminjaman", value: formatNumber(rows.length) }],
  };
}

// ----------------------------------------------------------------------------
// RPT-INV-05 — Penghapusan Inventaris
// ----------------------------------------------------------------------------

async function buildInvHapus(ctx: ReportBuilderContext): Promise<ReportData> {
  const supabase = ctx.supabase;
  const f = ctx.filters;

  let q = supabase
    .from("inventory_disposals")
    .select(
      "id, item_id, quantity, reason, disposal_date, value_removed, inventory_items(name)"
    );
  if (f.date_from) q = q.gte("disposal_date", f.date_from);
  if (f.date_to) q = q.lte("disposal_date", f.date_to);

  const { data, error } = await q.order("disposal_date", { ascending: false });
  if (error) throw new Error(error.message);

  let totalValue = 0;
  const rows = ((data || []) as unknown as InventoryDisposalRow[]).map((d) => {
    const value = num(d.value_removed);
    totalValue += value;
    return {
      tanggal: formatDate(d.disposal_date),
      barang: d.inventory_items?.name || "-",
      jumlah: d.quantity,
      alasan: d.reason || "-",
      nilai: formatRp(value),
    };
  });

  const columns: ReportColumn[] = [
    { key: "tanggal", label: "Tanggal" },
    { key: "barang", label: "Barang" },
    { key: "jumlah", label: "Jumlah", align: "right" },
    { key: "alasan", label: "Alasan" },
    { key: "nilai", label: "Nilai Dihapus", align: "right" },
  ];

  return {
    type: "rpt-inv-05",
    title: "Penghapusan Inventaris",
    subtitle: subtitle(ctx),
    columns,
    rows,
    summary: [
      { label: "Total Transaksi", value: formatNumber(rows.length) },
      { label: "Total Nilai Dihapus", value: formatRp(totalValue) },
    ],
  };
}

// ----------------------------------------------------------------------------
// RPT-INV-06 — Kondisi Inventaris
// ----------------------------------------------------------------------------

async function buildInvKondisi(ctx: ReportBuilderContext): Promise<ReportData> {
  const supabase = ctx.supabase;
  const f = ctx.filters;

  let q = supabase
    .from("inventory_items")
    .select("code, name, category, stock, unit_price, condition");
  if (f.category) q = q.eq("category", f.category);
  const { data } = await q;
  const items = data || [];

  let columns: ReportColumn[];
  let rows: ReportData["rows"];

  if (f.condition) {
    const filtered = items.filter((i) => i.condition === f.condition);
    columns = [
      { key: "kode", label: "Kode" },
      { key: "nama", label: "Nama Barang" },
      { key: "kategori", label: "Kategori" },
      { key: "stok", label: "Stok", align: "right" },
      { key: "nilai", label: "Nilai", align: "right" },
    ];
    rows = filtered.map((i: InventoryItemRow) => ({
      kode: i.code || "-",
      nama: i.name || "-",
      kategori: (i.category && INVENTORY_CATEGORY_LABEL[i.category]) || i.category || "-",
      stok: num(i.stock),
      nilai: formatRp(num(i.stock) * num(i.unit_price)),
    }));
    const totalUnit = filtered.reduce((s, i) => s + num(i.stock), 0);
    const totalNilai = filtered.reduce(
      (s, i) => s + num(i.stock) * num(i.unit_price),
      0
    );
    return {
      type: "rpt-inv-06",
      title: "Kondisi Inventaris",
      subtitle: subtitle(ctx),
      columns,
      rows,
      summary: [
        { label: "Total Unit", value: formatNumber(totalUnit) },
        { label: "Total Nilai", value: formatRp(totalNilai) },
      ],
    };
  }

  const byCond = new Map<string, { jenis: number; unit: number }>();
  for (const it of items) {
    const cur = byCond.get(it.condition) || { jenis: 0, unit: 0 };
    cur.jenis += 1;
    cur.unit += num(it.stock);
    byCond.set(it.condition, cur);
  }

  columns = [
    { key: "kondisi", label: "Kondisi" },
    { key: "jenis", label: "Jenis Barang", align: "right" },
    { key: "unit", label: "Total Unit", align: "right" },
  ];
  rows = [...byCond.entries()].map(([cond, v]) => ({
    kondisi: INVENTORY_CONDITION_LABEL[cond] || cond || "-",
    jenis: v.jenis,
    unit: v.unit,
  }));

  const totalUnit = items.reduce((s, i) => s + num(i.stock), 0);

  return {
    type: "rpt-inv-06",
    title: "Kondisi Inventaris",
    subtitle: subtitle(ctx),
    columns,
    rows,
    summary: [
      { label: "Total Unit", value: formatNumber(totalUnit) },
      { label: "Total Jenis Barang", value: formatNumber(items.length) },
    ],
  };
}

// ----------------------------------------------------------------------------
// RPT-LTR-01/02 — Surat Masuk / Surat Keluar
// ----------------------------------------------------------------------------

async function buildLtr(
  ctx: ReportBuilderContext,
  incoming: boolean
): Promise<ReportData> {
  const supabase = ctx.supabase;
  const f = ctx.filters;

  let q = supabase
    .from("letters")
    .select("reference_number, title, sender, date_received_sent, classification");
  q = q.eq("type", incoming ? "INCOMING" : "OUTGOING");
  if (f.date_from) q = q.gte("date_received_sent", f.date_from);
  if (f.date_to) q = q.lte("date_received_sent", f.date_to);
  if (ctx.kabidDivisionId) q = q.eq("classification", "PUBLIC");

  const { data, error } = await q.order("date_received_sent", {
    ascending: false,
  });
  if (error) throw new Error(error.message);

  const rows = (data || []).map((l: LetterRow) => ({
    noSurat: l.reference_number || "-",
    perihal: l.title || "-",
    pihak: l.sender || "-",
    tanggal: formatDate(l.date_received_sent),
    klasifikasi: l.classification || "-",
  }));

  const columns: ReportColumn[] = [
    { key: "noSurat", label: "No. Surat" },
    { key: "perihal", label: "Perihal" },
    { key: "pihak", label: incoming ? "Pengirim" : "Penerima" },
    { key: "tanggal", label: "Tanggal" },
    { key: "klasifikasi", label: "Klasifikasi" },
  ];

  return {
    type: incoming ? "rpt-ltr-01" : "rpt-ltr-02",
    title: incoming ? "Surat Masuk per Periode" : "Surat Keluar per Periode",
    subtitle: subtitle(ctx),
    columns,
    rows,
    summary: [{ label: "Total Surat", value: formatNumber(rows.length) }],
  };
}

// ----------------------------------------------------------------------------
// RPT-PRJ-01 — Total Proyek Insidental
// ----------------------------------------------------------------------------

async function buildPrjTotal(ctx: ReportBuilderContext): Promise<ReportData> {
  const supabase = ctx.supabase;
  const f = ctx.filters;

  let q = supabase
    .from("incidental_projects")
    .select("id, name, status, start_date");
  if (f.date_from) q = q.gte("start_date", f.date_from);
  if (f.date_to) q = q.lte("start_date", f.date_to);
  if (f.status) q = q.eq("status", f.status);

  const { data: projects, error } = await q.order("start_date", {
    ascending: true,
  });
  if (error) throw new Error(error.message);

  const projectIds = (projects || []).map((p: { id: string }) => p.id);
  const fundsByProject = await fetchProjectFunds(supabase, projectIds);

  let totalIncome = 0;
  let totalExpense = 0;

  const rows = (projects || []).map((p: ProjectRow) => {
    const fnd = fundsByProject.get(p.id) || { income: 0, expense: 0 };
    totalIncome += fnd.income;
    totalExpense += fnd.expense;
    return {
      proyek: p.name || "-",
      status: (p.status && PROJECT_STATUS_LABEL[p.status]) || p.status || "-",
      tglMulai: formatDate(p.start_date),
      danaMasuk: formatRp(fnd.income),
      danaKeluar: formatRp(fnd.expense),
      totalDana: formatRp(fnd.income - fnd.expense),
    };
  });

  const columns: ReportColumn[] = [
    { key: "proyek", label: "Proyek" },
    { key: "status", label: "Status" },
    { key: "tglMulai", label: "Tanggal Mulai" },
    { key: "danaMasuk", label: "Dana Masuk", align: "right" },
    { key: "danaKeluar", label: "Dana Keluar", align: "right" },
    { key: "totalDana", label: "Total Dana", align: "right" },
  ];

  return {
    type: "rpt-prj-01",
    title: "Total Proyek Insidental",
    subtitle: subtitle(ctx),
    columns,
    rows,
    summary: [
      { label: "Total Proyek", value: formatNumber(rows.length) },
      { label: "Total Dana Masuk", value: formatRp(totalIncome) },
      { label: "Total Dana Keluar", value: formatRp(totalExpense) },
      { label: "Total Dana", value: formatRp(totalIncome - totalExpense) },
    ],
  };
}

// ----------------------------------------------------------------------------
// RPT-PRJ-02 — Anggaran Proyek Insidental
// ----------------------------------------------------------------------------

async function buildPrjAnggaran(ctx: ReportBuilderContext): Promise<ReportData> {
  const supabase = ctx.supabase;
  const f = ctx.filters;

  let q = supabase
    .from("incidental_projects")
    .select("id, name, status, start_date");
  if (f.date_from) q = q.gte("start_date", f.date_from);
  if (f.date_to) q = q.lte("start_date", f.date_to);
  if (f.status) q = q.eq("status", f.status);

  const { data: projects, error } = await q.order("start_date", {
    ascending: true,
  });
  if (error) throw new Error(error.message);

  const projectIds = (projects || []).map((p: { id: string }) => p.id);
  const fundsByProject = await fetchProjectFunds(supabase, projectIds);

  const budgetByProject = new Map<string, number>();
  if (projectIds.length) {
    const { data: budgetItems } = await supabase
      .from("budget_items")
      .select("project_id, parent_id, subtotal")
      .in("project_id", projectIds);
    for (const b of budgetItems || []) {
      if (!b.parent_id && b.project_id) {
        addTo(budgetByProject, b.project_id, num(b.subtotal));
      }
    }
  }

  let totalAnggaran = 0;
  let totalIncome = 0;
  let totalExpense = 0;

  const rows = (projects || []).map((p: ProjectRow) => {
    const anggaran = budgetByProject.get(p.id) || 0;
    const fnd = fundsByProject.get(p.id) || { income: 0, expense: 0 };
    totalAnggaran += anggaran;
    totalIncome += fnd.income;
    totalExpense += fnd.expense;
    return {
      proyek: p.name || "-",
      status: (p.status && PROJECT_STATUS_LABEL[p.status]) || p.status || "-",
      anggaran: formatRp(anggaran),
      danaMasuk: formatRp(fnd.income),
      danaKeluar: formatRp(fnd.expense),
      sisa: formatRp(fnd.income - fnd.expense),
    };
  });

  const columns: ReportColumn[] = [
    { key: "proyek", label: "Proyek" },
    { key: "status", label: "Status" },
    { key: "anggaran", label: "Anggaran", align: "right" },
    { key: "danaMasuk", label: "Dana Masuk", align: "right" },
    { key: "danaKeluar", label: "Dana Keluar", align: "right" },
    { key: "sisa", label: "Sisa", align: "right" },
  ];

  return {
    type: "rpt-prj-02",
    title: "Anggaran Proyek Insidental",
    subtitle: subtitle(ctx),
    columns,
    rows,
    summary: [
      { label: "Total Proyek", value: formatNumber(rows.length) },
      { label: "Total Anggaran", value: formatRp(totalAnggaran) },
      { label: "Total Dana Masuk", value: formatRp(totalIncome) },
      { label: "Total Dana Keluar", value: formatRp(totalExpense) },
      { label: "Total Sisa", value: formatRp(totalIncome - totalExpense) },
    ],
  };
}

async function fetchProjectFunds(
  supabase: SupabaseClient,
  projectIds: string[]
): Promise<Map<string, { income: number; expense: number }>> {
  const map = new Map<string, { income: number; expense: number }>();
  if (!projectIds.length) return map;
  const { data: funds } = await supabase
    .from("project_funds")
    .select("project_id, type, amount")
    .in("project_id", projectIds);
  for (const fn of funds || []) {
    const cur = map.get(fn.project_id) || { income: 0, expense: 0 };
    if (fn.type === "INCOME") cur.income += num(fn.amount);
    else cur.expense += num(fn.amount);
    map.set(fn.project_id, cur);
  }
  return map;
}

// ----------------------------------------------------------------------------
// RPT-PRG-01 — Laporan Program Kerja per Periode
// ----------------------------------------------------------------------------

async function buildPrgPeriod(ctx: ReportBuilderContext): Promise<ReportData> {
  const programs = await fetchPrgRows(ctx);

  const byStatus = new Map<string, number>();
  for (const p of programs) addTo(byStatus, p.status || "-", 1);

  const columns: ReportColumn[] = [
    { key: "proker", label: "Program Kerja" },
    { key: "divisi", label: "Divisi" },
    { key: "status", label: "Status" },
    { key: "tglMulai", label: "Tanggal Mulai" },
    { key: "tglSelesai", label: "Tanggal Selesai" },
    { key: "anggaran", label: "Anggaran", align: "right" },
  ];

  const rows = programs.map((p) => ({
    proker: p.name || "-",
    divisi: p.divisions?.name || "-",
    status: (p.status && PROGRAM_STATUS_LABEL[p.status]) || p.status || "-",
    tglMulai: formatDate(p.start_date),
    tglSelesai: formatDate(p.end_date),
    anggaran: formatRp(p.budget_estimate),
  }));

  return {
    type: "rpt-prg-01",
    title: "Laporan Program Kerja per Periode",
    subtitle: await periodSubtitle(ctx),
    columns,
    rows,
    summary: [
      { label: "Total Program", value: formatNumber(programs.length) },
      ...[...byStatus.entries()].map(([status, total]) => ({
        label: `Status ${status}`,
        value: formatNumber(total),
      })),
    ],
  };
}

// ----------------------------------------------------------------------------
// RPT-PRG-02 — Laporan Nilai per Program Kerja
// ----------------------------------------------------------------------------

async function buildPrgNilai(ctx: ReportBuilderContext): Promise<ReportData> {
  const supabase = ctx.supabase;
  const f = ctx.filters;
  const mode = f.mode || "detail";

  const programs = await fetchPrgRows(ctx);
  const programIds = programs.map((p) => p.id);

  let sessions: PrgSessionRow[] = [];
  let scores: ScoredAttendantRow[] = [];
  if (programIds.length) {
    const { data: s } = await supabase
      .from("program_sessions")
      .select("id, program_id, date, title")
      .in("program_id", programIds);
    sessions = (s || []) as unknown as PrgSessionRow[];
    const sessionIds = sessions.map((x) => x.id);
    if (sessionIds.length) {
      const { data: a } = await supabase
        .from("program_session_attendants")
        .select("session_id, user_id, score")
        .in("session_id", sessionIds);
      scores = (a || []) as unknown as ScoredAttendantRow[];
    }
  }

  const programName = new Map(programs.map((p) => [p.id, p.name]));
  const sessionProgram = new Map<string, string>();
  for (const s of sessions) sessionProgram.set(s.id, s.program_id || "");

  let totalScore = 0;
  let totalScored = 0;

  if (mode === "ringkas") {
    const byProg = new Map<string, { sesi: number; penilaian: number; total: number }>();
    for (const s of sessions) {
      const key = s.program_id || "";
      const cur = byProg.get(key) || { sesi: 0, penilaian: 0, total: 0 };
      cur.sesi += 1;
      byProg.set(key, cur);
    }
    for (const a of scores) {
      const key = sessionProgram.get(a.session_id) || "";
      const cur = byProg.get(key) || { sesi: 0, penilaian: 0, total: 0 };
      cur.penilaian += 1;
      cur.total += num(a.score);
      totalScore += num(a.score);
      totalScored += 1;
      byProg.set(key, cur);
    }
    const columns: ReportColumn[] = [
      { key: "proker", label: "Program Kerja" },
      { key: "jumlahSesi", label: "Jumlah Sesi", align: "right" },
      { key: "jumlahPenilaian", label: "Jumlah Penilaian", align: "right" },
      { key: "totalNilai", label: "Total Nilai", align: "right" },
      { key: "rataNilai", label: "Rata-rata Nilai", align: "right" },
    ];
    const rows = [...byProg.entries()].map(([pid, v]) => ({
      proker: programName.get(pid) || "-",
      jumlahSesi: v.sesi,
      jumlahPenilaian: v.penilaian,
      totalNilai: v.total,
      rataNilai: v.penilaian
        ? formatNumber(Math.round((v.total / v.penilaian) * 100) / 100)
        : "-",
    }));
    return {
      type: "rpt-prg-02",
      title: "Laporan Nilai per Program Kerja",
      subtitle: await periodSubtitle(ctx),
      columns,
      rows,
      summary: [
        { label: "Total Program", value: formatNumber(rows.length) },
        { label: "Total Penilaian", value: formatNumber(totalScored) },
        { label: "Total Nilai", value: formatNumber(totalScore) },
        {
          label: "Rata-rata Keseluruhan",
          value: totalScored ? formatNumber(Math.round((totalScore / totalScored) * 100) / 100) : "-",
        },
      ],
    };
  }

  const rows = sessions.map((s) => {
    let total = 0;
    let count = 0;
    for (const a of scores) {
      if (a.session_id !== s.id) continue;
      count += 1;
      total += num(a.score);
      totalScore += num(a.score);
      totalScored += 1;
    }
    return {
      proker: programName.get(s.program_id || "") || "-",
      sesi: s.title || `Sesi ${formatDate(s.date)}`,
      tanggal: formatDate(s.date),
      jumlahPenilaian: count,
      totalNilai: total,
      rataNilai: count ? formatNumber(Math.round((total / count) * 100) / 100) : "-",
    };
  });

  const columns: ReportColumn[] = [
    { key: "proker", label: "Program Kerja" },
    { key: "sesi", label: "Kegiatan/Sesi" },
    { key: "tanggal", label: "Tanggal" },
    { key: "jumlahPenilaian", label: "Jumlah Penilaian", align: "right" },
    { key: "totalNilai", label: "Total Nilai", align: "right" },
    { key: "rataNilai", label: "Rata-rata Nilai", align: "right" },
  ];

  return {
    type: "rpt-prg-02",
    title: "Laporan Nilai per Program Kerja",
    subtitle: await periodSubtitle(ctx),
    columns,
    rows,
    summary: [
      { label: "Total Sesi", value: formatNumber(rows.length) },
      { label: "Total Penilaian", value: formatNumber(totalScored) },
      { label: "Total Nilai", value: formatNumber(totalScore) },
      {
        label: "Rata-rata Keseluruhan",
        value: totalScored ? formatNumber(Math.round((totalScore / totalScored) * 100) / 100) : "-",
      },
    ],
  };
}

// ----------------------------------------------------------------------------
// RPT-PRG-03 — Laporan Absensi per Program Kerja
// ----------------------------------------------------------------------------

async function buildPrgAbsen(ctx: ReportBuilderContext): Promise<ReportData> {
  const supabase = ctx.supabase;
  const f = ctx.filters;
  const mode = f.mode || "detail";

  const programs = await fetchPrgRows(ctx);
  const programIds = programs.map((p) => p.id);

  let sessions: PrgSessionRow[] = [];
  let attendants: ProgramAttendantRow[] = [];
  if (programIds.length) {
    const { data: s } = await supabase
      .from("program_sessions")
      .select("id, program_id, date, title")
      .in("program_id", programIds);
    sessions = (s || []) as unknown as PrgSessionRow[];
    const sessionIds = sessions.map((x) => x.id);
    if (sessionIds.length) {
      const { data: a } = await supabase
        .from("program_session_attendants")
        .select("session_id, user_id, scanned_at")
        .in("session_id", sessionIds);
      attendants = (a || []) as unknown as ProgramAttendantRow[];
    }
  }

  const memberCountByProgram = new Map<string, number>();
  if (programIds.length) {
    const { data: members } = await supabase
      .from("program_members")
      .select("program_id")
      .in("program_id", programIds);
    for (const m of members || []) addTo(memberCountByProgram, m.program_id, 1);
  }

  const sessionProgram = new Map<string, string>();
  const sessionDate = new Map<string, string>();
  for (const s of sessions) {
    sessionProgram.set(s.id, s.program_id || "");
    sessionDate.set(s.id, s.date);
  }

  const sessionsByProgram = new Map<string, number>();
  for (const s of sessions) addTo(sessionsByProgram, s.program_id || "", 1);

  const hadirByProgram = new Map<string, number>();
  const detailByProgram = new Map<
    string,
    Map<string, { count: number; dates: string[] }>
  >();
  for (const a of attendants) {
    const pid = sessionProgram.get(a.session_id) || "";
    if (!pid) continue;
    addTo(hadirByProgram, pid, 1);
    const inner = detailByProgram.get(pid) || new Map<string, { count: number; dates: string[] }>();
    const cur = inner.get(a.user_id) || { count: 0, dates: [] };
    cur.count += 1;
    cur.dates.push(formatDate(sessionDate.get(a.session_id)));
    inner.set(a.user_id, cur);
    detailByProgram.set(pid, inner);
  }

  const userIds = [...new Set(attendants.map((a) => a.user_id))];
  const names = await fetchProfileNames(supabase, userIds);
  const nimMap = new Map<string, string>();
  if (userIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, nim")
      .in("id", userIds);
    for (const p of profs || []) nimMap.set(p.id, p.nim || "-");
  }

  if (mode === "ringkas") {
    const columns: ReportColumn[] = [
      { key: "proker", label: "Program Kerja" },
      { key: "jumlahSesi", label: "Jumlah Sesi", align: "right" },
      { key: "totalHadir", label: "Total Peserta Hadir", align: "right" },
      { key: "totalAnggota", label: "Total Anggota", align: "right" },
      { key: "rataHadir", label: "Rata-rata Hadir/Sesi", align: "right" },
    ];
    const rows = programs.map((p) => {
      const totalHadir = hadirByProgram.get(p.id) || 0;
      const jumlahSesi = sessionsByProgram.get(p.id) || 0;
      return {
        proker: p.name || "-",
        jumlahSesi,
        totalHadir,
        totalAnggota: memberCountByProgram.get(p.id) || 0,
        rataHadir: jumlahSesi ? formatNumber(Math.round((totalHadir / jumlahSesi) * 100) / 100) : "-",
      };
    });
    return {
      type: "rpt-prg-03",
      title: "Laporan Absensi per Program Kerja",
      subtitle: await periodSubtitle(ctx),
      columns,
      rows,
      summary: [
        { label: "Total Program", value: formatNumber(rows.length) },
        { label: "Total Kehadiran", value: formatNumber(attendants.length) },
      ],
    };
  }

  const rows: ReportData["rows"] = [];
  for (const p of programs) {
    const inner = detailByProgram.get(p.id);
    if (!inner) continue;
    for (const [userId, v] of inner) {
      rows.push({
        proker: p.name || "-",
        anggota: names.get(userId) || "-",
        nim: nimMap.get(userId) || "-",
        jumlahHadir: v.count,
        daftarSesi: v.dates.join(", "),
      });
    }
  }
  rows.sort((a, b) => {
    const pa = String(a.proker).localeCompare(String(b.proker));
    return pa !== 0 ? pa : String(a.anggota).localeCompare(String(b.anggota));
  });

  const columns: ReportColumn[] = [
    { key: "proker", label: "Program Kerja" },
    { key: "anggota", label: "Anggota" },
    { key: "nim", label: "NIM" },
    { key: "jumlahHadir", label: "Jumlah Hadir", align: "right" },
    { key: "daftarSesi", label: "Daftar Sesi Hadir" },
  ];

  return {
    type: "rpt-prg-03",
    title: "Laporan Absensi per Program Kerja",
    subtitle: await periodSubtitle(ctx),
    columns,
    rows,
    summary: [
      { label: "Total Program", value: formatNumber(programs.length) },
      { label: "Total Kehadiran", value: formatNumber(attendants.length) },
    ],
  };
}

// ----------------------------------------------------------------------------
// Dispatcher
// ----------------------------------------------------------------------------

export async function buildReport(
  report: ReportDefinition,
  ctx: ReportBuilderContext
): Promise<ReportData> {
  switch (report.slug) {
    case "rpt-mbr-01":
      return buildMembers(ctx);
    case "rpt-fin-01":
      return buildFinRealisasi(ctx);
    case "rpt-fin-02":
      return buildFinSaldo(ctx);
    case "rpt-fin-03":
      return buildFinMutasi(ctx);
    case "rpt-prg-01":
      return buildPrgPeriod(ctx);
    case "rpt-prg-02":
      return buildPrgNilai(ctx);
    case "rpt-prg-03":
      return buildPrgAbsen(ctx);
    case "rpt-att-01":
      return buildAttSesi(ctx);
    case "rpt-att-02":
      return buildAttAnggota(ctx);
    case "rpt-ath-01":
      return buildAthPelatih(ctx);
    case "rpt-ath-02":
      return buildAthRataPerAtlet(ctx);
    case "rpt-ath-03":
      return buildAthRataSemua(ctx);
    case "rpt-ach-01":
      return buildAch(ctx);
    case "rpt-inv-01":
      return buildInvTotal(ctx);
    case "rpt-inv-02":
      return buildInvNilai(ctx);
    case "rpt-inv-03":
      return buildInvPembelian(ctx);
    case "rpt-inv-04":
      return buildInvPinjam(ctx);
    case "rpt-inv-05":
      return buildInvHapus(ctx);
    case "rpt-inv-06":
      return buildInvKondisi(ctx);
    case "rpt-ltr-01":
      return buildLtr(ctx, true);
    case "rpt-ltr-02":
      return buildLtr(ctx, false);
    case "rpt-prj-01":
      return buildPrjTotal(ctx);
    case "rpt-prj-02":
      return buildPrjAnggaran(ctx);
    default:
      throw new Error(`Laporan ${report.slug} belum didukung.`);
  }
}
