// ============================================================================
// SIORG Modul Dashboard — Agregasi data nyata dari seluruh modul operasi.
// Dipanggil server-side dari halaman "/" (Dashboard).
// Seluruh query memakai sesi pengguna sehingga hasil otomatis dibatasi RLS.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";

// ----------------------------------------------------------------------------
// Tipe data hasil agregasi
// ----------------------------------------------------------------------------

export interface StatItem {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger" | "muted";
}

export interface PeriodOption {
  id: string;
  label: string;
  status: string;
}

export interface ProgramListItem {
  id: string;
  name: string;
  status: string;
  start_date: string;
  end_date: string;
  division_name: string | null;
  budget_estimate: number;
  score: number | null;
}

export interface FinanceItem {
  id: string;
  date: string;
  type: string;
  amount: number;
  description: string;
}

export interface MemberItem {
  id: string;
  full_name: string;
  nim: string;
  role: string;
  status: string;
  division_name: string | null;
}

export interface AchievementItem {
  id: string;
  title: string;
  level: string;
  juara: string | null;
  achievement_date: string;
  status: string;
}

export interface LetterItem {
  id: string;
  reference_number: string;
  title: string;
  type: string;
  date_received_sent: string;
}

export interface HandoverItem {
  id: string;
  period_from: string;
  period_to: string;
  status: string;
  handover_date: string | null;
}

export interface ProjectItem {
  id: string;
  name: string;
  status: string;
  start_date: string;
}

export interface InventoryLoanItem {
  id: string;
  item_name: string;
  borrower_name: string;
  quantity: number;
  borrow_date: string;
  status: string;
}

export interface TrainingSessionItem {
  id: string;
  name: string;
  date: string;
  duration_minutes: number | null;
  intensity: string | null;
  attendance: number;
}

export interface DashboardData {
  overview: {
    orgName: string;
    userName: string;
    userRole: string;
    periodLabel: string | null;
    dateLabel: string;
  };
  periods: PeriodOption[];
  selectedPeriodId: string;
  programs: {
    total: number;
    active: number;
    byStatus: { status: string; count: number }[];
    upcoming: ProgramListItem[];
  };
  finances: {
    visible: boolean;
    income: number;
    expense: number;
    balance: number;
    monthly: { month: string; income: number; expense: number }[];
    recent: FinanceItem[];
  };
  members: {
    total: number;
    active: number;
    byStatus: { status: string; count: number }[];
    byDivision: { name: string; count: number }[];
    recent: MemberItem[];
  };
  attendance: {
    totalSessions: number;
    totalRecords: number;
    byType: { label: string; sessions: number; records: number }[];
  };
  athletics: {
    athleteCount: number;
    sessionCount: number;
    attendanceCount: number;
    assessmentCount: number;
    recentSessions: TrainingSessionItem[];
  };
  achievements: {
    total: number;
    approved: number;
    byStatus: { status: string; count: number }[];
    recent: AchievementItem[];
  };
  inventory: {
    itemCount: number;
    totalStock: number;
    totalValue: number;
    activeLoans: number;
    byCondition: { label: string; count: number }[];
    recentLoans: InventoryLoanItem[];
  };
  letters: {
    total: number;
    incoming: number;
    outgoing: number;
    recent: LetterItem[];
  };
  handovers: {
    total: number;
    byStatus: { status: string; count: number }[];
    current: HandoverItem | null;
    history: HandoverItem[];
  };
  projects: {
    total: number;
    byStatus: { status: string; count: number }[];
    totalIncome: number;
    totalExpense: number;
    recent: ProjectItem[];
  };
}

// ----------------------------------------------------------------------------
// Tipe baris hasil query (casting eksplisit untuk kejelasan tipe)
// ----------------------------------------------------------------------------

interface ProgramRow {
  id: string;
  name: string;
  status: string;
  start_date: string;
  end_date: string;
  division_id: string | null;
  budget_estimate: number;
  divisions: { name: string } | null;
}

interface HandoverRow {
  id: string;
  period_from: string;
  period_to: string;
  status: string;
  handover_date: string | null;
}

// ----------------------------------------------------------------------------
// Konstanta label
// ----------------------------------------------------------------------------

export const PROGRAM_STATUS_LABEL: Record<string, string> = {
  PLANNED: "Direncanakan",
  ONGOING: "Berjalan",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

export const FINANCE_TYPE_LABEL: Record<string, string> = {
  INCOME: "Pemasukan",
  EXPENSE: "Pengeluaran",
};

export const USER_STATUS_LABEL: Record<string, string> = {
  AKTIF: "Aktif",
  CUTI: "Cuti",
  ALUMNI: "Alumni",
  NONAKTIF: "Nonaktif",
};

export const USER_ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  KETUA_UMUM: "Ketua Umum",
  WAKIL_KETUA: "Wakil Ketua",
  PENGURUS_INTI: "Pengurus Inti",
  SEKRETARIS: "Sekretaris",
  BENDAHARA: "Bendahara",
  KABID: "Kepala Bidang",
  PELATIH: "Pelatih",
  PEMBINA: "Pembina",
  ANGGOTA: "Anggota",
};

export const ACHIEVEMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu Verifikasi",
  APPROVED: "Terverifikasi",
  REJECTED: "Ditolak",
};

export const ACHIEVEMENT_JUARA_LABEL: Record<string, string> = {
  JUARA_I: "Juara I",
  JUARA_II: "Juara II",
  JUARA_III: "Juara III",
  JUARA_HARAPAN: "Juara Harapan",
};

export const HANDOVER_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Belum Berjalan",
  ONGOING: "Berjalan",
  COMPLETED: "Selesai",
};

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  PROPOSED: "Diajukan",
  APPROVED: "Disetujui",
  ONGOING: "Berjalan",
  CLOSED: "Selesai",
};

export const INVENTORY_CONDITION_LABEL: Record<string, string> = {
  GOOD: "Baik",
  DAMAGED_LIGHT: "Rusak Ringan",
  DAMAGED_HEAVY: "Rusak Berat",
  LOST: "Hilang",
};

export const INVENTORY_LOAN_STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  RETURNED: "Dikembalikan",
  OVERDUE: "Terlambat",
};

export const LETTER_TYPE_LABEL: Record<string, string> = {
  INCOMING: "Surat Masuk",
  OUTGOING: "Surat Keluar",
};

export const ATTENDANCE_TYPE_LABEL = [
  { key: "program", label: "Sesi Program Kerja" },
  { key: "training", label: "Sesi Latihan" },
  { key: "project", label: "Sesi Proyek Insidental" },
] as const;

export function formatRp(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(Number(value || 0));
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const DUMMY_UUID = "00000000-0000-0000-0000-000000000000";

function monthKey(dateStr: string): string {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr.slice(0, 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const d = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return month;
  return d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
}

// Rentang tanggal satu periode kepengurusan dari label Sertijab,
// mis. period_from "2026/2027" & period_to "2027/2028"
//   -> dari 2026-07-01 hingga 2028-06-30 (tahun akademik, Juli–Juni).
function handoverPeriodBounds(
  periodFrom: string,
  periodTo: string
): { from: string; to: string } | null {
  const mFrom = /^(\d{4})\//.exec(periodFrom);
  const mTo = /\/(\d{4})$/.exec(periodTo);
  if (!mFrom || !mTo) return null;
  return {
    from: `${mFrom[1]}-07-01`,
    to: `${mTo[1]}-06-30`,
  };
}

function countStatus(rows: unknown[], key: string) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const v = String((r as Record<string, unknown>)[key] ?? "UNKNOWN");
    map.set(v, (map.get(v) || 0) + 1);
  }
  return [...map.entries()].map(([status, count]) => ({ status, count }));
}

function toDateLabel(date: Date): string {
  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ============================================================================
// Helper: hitung ringkasan per modul. Setiap builder dibungkus try/catch agar
// satu modul yang gagal (mis. tabel belum ada di DB) tidak merusak dashboard.
// ============================================================================

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

// ----------------------------------------------------------------------------
// Program Kerja
// ----------------------------------------------------------------------------

async function buildPrograms(
  supabase: SupabaseClient,
  kabidDivisionId: string | null,
  periodBounds: { from: string; to: string } | null
): Promise<DashboardData["programs"]> {
  return safe(async () => {
    let q = supabase
      .from("programs")
      .select("id, name, status, start_date, end_date, division_id, budget_estimate, divisions(name)");
    if (kabidDivisionId) q = q.eq("division_id", kabidDivisionId);
    if (periodBounds) q = q.gte("start_date", periodBounds.from).lte("start_date", periodBounds.to);
    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const programs = (data || []) as unknown as ProgramRow[];
    const byStatus = countStatus(programs, "status");
    const active = programs.filter((p) => p.status === "ONGOING").length;

    const upcomingRows = programs
      .filter((p) => p.status === "PLANNED" || p.status === "ONGOING")
      .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))
      .slice(0, 5);

    const upcomingIds = upcomingRows.map((p) => p.id);
    const scoreMap = new Map<string, number>();
    if (upcomingIds.length) {
      const { data: sessions, error: sErr } = await supabase
        .from("program_sessions")
        .select("id, program_id")
        .in("program_id", upcomingIds);
      if (!sErr && sessions) {
        const sessionIds = sessions.map((s) => s.id);
        if (sessionIds.length) {
          const { data: attendants, error: aErr } = await supabase
            .from("program_session_attendants")
            .select("session_id, score")
            .in("session_id", sessionIds)
            .not("score", "is", null);
          if (!aErr && attendants) {
            const sessionScoreMap = new Map<string, number[]>();
            for (const a of attendants) {
              const list = sessionScoreMap.get(a.session_id) || [];
              list.push(a.score);
              sessionScoreMap.set(a.session_id, list);
            }
            const programSessionAverages = new Map<string, number[]>();
            for (const s of sessions) {
              const scores = sessionScoreMap.get(s.id);
              if (!scores || scores.length === 0) continue;
              const avg = scores.reduce((sum, v) => sum + v, 0) / scores.length;
              const list = programSessionAverages.get(s.program_id) || [];
              list.push(avg);
              programSessionAverages.set(s.program_id, list);
            }
            for (const [pid, avgs] of programSessionAverages) {
              scoreMap.set(pid, avgs.reduce((sum, v) => sum + v, 0) / avgs.length);
            }
          }
        }
      }
    }

    const upcoming: ProgramListItem[] = upcomingRows.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      start_date: p.start_date,
      end_date: p.end_date,
      division_name: (p.divisions as { name?: string } | null)?.name || null,
      budget_estimate: num(p.budget_estimate),
      score: scoreMap.get(p.id) ?? null,
    }));

    return { total: programs.length, active, byStatus, upcoming };
  }, { total: 0, active: 0, byStatus: [], upcoming: [] });
}

// ----------------------------------------------------------------------------
// Keuangan
// ----------------------------------------------------------------------------

async function buildFinances(
  supabase: SupabaseClient,
  visible: boolean,
  periodId: string | null
): Promise<DashboardData["finances"]> {
  if (!visible) {
    return { visible: false, income: 0, expense: 0, balance: 0, monthly: [], recent: [] };
  }
  return safe(async () => {
    let qAll = supabase.from("finances").select("type, amount");
    if (periodId) qAll = qAll.eq("handover_id", periodId);
    const { data: all } = await qAll;
    let income = 0;
    let expense = 0;
    for (const t of all || []) {
      if (t.type === "INCOME") income += num(t.amount);
      else expense += num(t.amount);
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    const fromDate = sixMonthsAgo.toISOString().slice(0, 10);

    let qRecent = supabase.from("finances").select("type, amount, date").gte("date", fromDate);
    if (periodId) qRecent = qRecent.eq("handover_id", periodId);
    const { data: recentData } = await qRecent;

    const monthlyMap = new Map<string, { income: number; expense: number }>();
    for (const t of recentData || []) {
      const key = monthKey(t.date);
      const cur = monthlyMap.get(key) || { income: 0, expense: 0 };
      if (t.type === "INCOME") cur.income += num(t.amount);
      else cur.expense += num(t.amount);
      monthlyMap.set(key, cur);
    }
    const monthly = [...monthlyMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([m, v]) => ({ month: monthLabel(m), income: v.income, expense: v.expense }));

    let qRecentRows = supabase
      .from("finances")
      .select("id, date, type, amount, description")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(6);
    if (periodId) qRecentRows = qRecentRows.eq("handover_id", periodId);
    const { data: recentRows } = await qRecentRows;

    const recent: FinanceItem[] = (recentRows || []).map((r) => ({
      id: r.id,
      date: r.date,
      type: r.type,
      amount: num(r.amount),
      description: r.description || "-",
    }));

    return {
      visible: true,
      income,
      expense,
      balance: income - expense,
      monthly,
      recent,
    };
  }, { visible, income: 0, expense: 0, balance: 0, monthly: [], recent: [] });
}

// ----------------------------------------------------------------------------
// Anggota
// ----------------------------------------------------------------------------

async function buildMembers(
  supabase: SupabaseClient,
  kabidDivisionId: string | null
): Promise<DashboardData["members"]> {
  return safe(async () => {
    let q = supabase
      .from("profiles")
      .select("id, full_name, nim, role, status, joined_at, division_id, divisions(name)");
    if (kabidDivisionId) q = q.eq("division_id", kabidDivisionId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const rows = data || [];
    const byStatus = countStatus(rows, "status");
    const active = rows.filter((r) => r.status === "AKTIF").length;

    const divMap = new Map<string, number>();
    for (const r of rows) {
      const name = (r.divisions as { name?: string } | null)?.name || "Tanpa Divisi";
      divMap.set(name, (divMap.get(name) || 0) + 1);
    }
    const byDivision = [...divMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    const recent: MemberItem[] = rows
      .slice()
      .sort((a, b) => String(b.joined_at).localeCompare(String(a.joined_at)))
      .slice(0, 5)
      .map((r) => ({
        id: r.id,
        full_name: r.full_name,
        nim: r.nim,
        role: r.role,
        status: r.status,
        division_name: (r.divisions as { name?: string } | null)?.name || null,
      }));

    return { total: rows.length, active, byStatus, byDivision, recent };
  }, { total: 0, active: 0, byStatus: [], byDivision: [], recent: [] });
}

// ----------------------------------------------------------------------------
// Absensi
// ----------------------------------------------------------------------------

async function buildAttendance(
  supabase: SupabaseClient,
  kabidDivisionId: string | null
): Promise<DashboardData["attendance"]> {
  return safe(async () => {
    // Program sessions (scope divisi untuk KABID)
    let psq = supabase.from("program_sessions").select("id");
    if (kabidDivisionId) {
      const { data: owned } = await supabase
        .from("programs")
        .select("id")
        .eq("division_id", kabidDivisionId);
      const ids = (owned || []).map((p) => p.id);
      psq = ids.length ? psq.in("program_id", ids) : psq.in("program_id", [DUMMY_UUID]);
    }
    const { data: programSessions } = await psq;
    const programSessionIds = (programSessions || []).map((s) => s.id);

    const { count: trainingCount } = await supabase
      .from("training_sessions")
      .select("id", { count: "exact", head: true });
    const { count: projectCount } = await supabase
      .from("project_sessions")
      .select("id", { count: "exact", head: true });

    let programAtt = 0;
    if (programSessionIds.length) {
      const { count } = await supabase
        .from("program_session_attendants")
        .select("id", { count: "exact", head: true })
        .in("session_id", programSessionIds);
      programAtt = count || 0;
    }
    const { count: trainingAtt } = await supabase
      .from("training_session_attendants")
      .select("id", { count: "exact", head: true });
    const { count: projectAtt } = await supabase
      .from("project_session_attendants")
      .select("id", { count: "exact", head: true });

    const byType = [
      { label: ATTENDANCE_TYPE_LABEL[0].label, sessions: programSessions?.length || 0, records: programAtt },
      { label: ATTENDANCE_TYPE_LABEL[1].label, sessions: trainingCount || 0, records: trainingAtt || 0 },
      { label: ATTENDANCE_TYPE_LABEL[2].label, sessions: projectCount || 0, records: projectAtt || 0 },
    ];

    const totalSessions = byType.reduce((s, t) => s + t.sessions, 0);
    const totalRecords = byType.reduce((s, t) => s + t.records, 0);

    return { totalSessions, totalRecords, byType };
  }, { totalSessions: 0, totalRecords: 0, byType: [] });
}

// ----------------------------------------------------------------------------
// Keatletan
// ----------------------------------------------------------------------------

async function buildAthletics(supabase: SupabaseClient): Promise<DashboardData["athletics"]> {
  return safe(async () => {
    const { count: athleteCount } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "AKTIF")
      .not("role", "in", "(PELATIH,PEMBINA)");
    const { count: sessionCount } = await supabase
      .from("training_sessions")
      .select("id", { count: "exact", head: true });
    const { count: attendanceCount } = await supabase
      .from("training_session_attendants")
      .select("id", { count: "exact", head: true });
    const { count: assessmentCount } = await supabase
      .from("assessments")
      .select("id", { count: "exact", head: true });

    const { data: recentRows } = await supabase
      .from("training_sessions")
      .select("id, name, session_type, date, duration_minutes, intensity, training_session_attendants(count)")
      .order("date", { ascending: false })
      .limit(5);

    const recentSessions: TrainingSessionItem[] = (recentRows || []).map((r) => ({
      id: r.id,
      name: r.name || r.session_type || "Sesi Latihan",
      date: r.date,
      duration_minutes: r.duration_minutes,
      intensity: r.intensity,
      attendance: (r.training_session_attendants as Array<{ count: number }> | null)?.[0]?.count || 0,
    }));

    return {
      athleteCount: athleteCount || 0,
      sessionCount: sessionCount || 0,
      attendanceCount: attendanceCount || 0,
      assessmentCount: assessmentCount || 0,
      recentSessions,
    };
  }, { athleteCount: 0, sessionCount: 0, attendanceCount: 0, assessmentCount: 0, recentSessions: [] });
}

// ----------------------------------------------------------------------------
// Prestasi
// ----------------------------------------------------------------------------

async function buildAchievements(
  supabase: SupabaseClient,
  periodId: string | null
): Promise<DashboardData["achievements"]> {
  return safe(async () => {
    let q = supabase.from("achievements").select("id, title, level, juara, achievement_date, status");
    if (periodId) q = q.eq("handover_id", periodId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const rows = data || [];
    const byStatus = countStatus(rows, "status");
    const approved = rows.filter((r) => r.status === "APPROVED").length;

    const recent: AchievementItem[] = rows
      .slice()
      .sort((a, b) => String(b.achievement_date).localeCompare(String(a.achievement_date)))
      .slice(0, 5)
      .map((r) => ({
        id: r.id,
        title: r.title,
        level: r.level,
        juara: r.juara,
        achievement_date: r.achievement_date,
        status: r.status,
      }));

    return { total: rows.length, approved, byStatus, recent };
  }, { total: 0, approved: 0, byStatus: [], recent: [] });
}

// ----------------------------------------------------------------------------
// Inventaris
// ----------------------------------------------------------------------------

async function buildInventory(supabase: SupabaseClient): Promise<DashboardData["inventory"]> {
  return safe(async () => {
    const { data: items } = await supabase
      .from("inventory_items")
      .select("condition, stock, unit_price");
    const itemList = items || [];

    const itemCount = itemList.length;
    const totalStock = itemList.reduce((s, i) => s + num(i.stock), 0);
    const totalValue = itemList.reduce((s, i) => s + num(i.stock) * num(i.unit_price), 0);

    const condMap = new Map<string, number>();
    for (const i of itemList) {
      const c = String(i.condition ?? "UNKNOWN");
      condMap.set(c, (condMap.get(c) || 0) + num(i.stock));
    }
    const byCondition = [...condMap.entries()].map(([label, count]) => ({ label, count }));

    const { count: activeLoans } = await supabase
      .from("inventory_loans")
      .select("id", { count: "exact", head: true })
      .in("status", ["PENDING", "APPROVED", "OVERDUE"]);

    const { data: loans } = await supabase
      .from("inventory_loans")
      .select("id, item_id, borrower_id, quantity, borrow_date, status, inventory_items(name), profiles(full_name)")
      .order("borrow_date", { ascending: false })
      .limit(5);

    const recentLoans: InventoryLoanItem[] = (loans || []).map((l) => ({
      id: l.id,
      item_name: (l.inventory_items as { name?: string } | null)?.name || "-",
      borrower_name: (l.profiles as { full_name?: string } | null)?.full_name || "-",
      quantity: num(l.quantity),
      borrow_date: l.borrow_date,
      status: l.status,
    }));

    return {
      itemCount,
      totalStock,
      totalValue,
      activeLoans: activeLoans || 0,
      byCondition,
      recentLoans,
    };
  }, { itemCount: 0, totalStock: 0, totalValue: 0, activeLoans: 0, byCondition: [], recentLoans: [] });
}

// ----------------------------------------------------------------------------
// Persuratan
// ----------------------------------------------------------------------------

async function buildLetters(
  supabase: SupabaseClient,
  periodId: string | null
): Promise<DashboardData["letters"]> {
  return safe(async () => {
    let qIn = supabase
      .from("letters")
      .select("id", { count: "exact", head: true })
      .eq("type", "INCOMING");
    if (periodId) qIn = qIn.eq("handover_id", periodId);
    const { count: incoming } = await qIn;

    let qOut = supabase
      .from("letters")
      .select("id", { count: "exact", head: true })
      .eq("type", "OUTGOING");
    if (periodId) qOut = qOut.eq("handover_id", periodId);
    const { count: outgoing } = await qOut;

    let qRecent = supabase
      .from("letters")
      .select("id, reference_number, title, type, date_received_sent")
      .order("date_received_sent", { ascending: false })
      .limit(5);
    if (periodId) qRecent = qRecent.eq("handover_id", periodId);
    const { data } = await qRecent;

    const recent: LetterItem[] = (data || []).map((l) => ({
      id: l.id,
      reference_number: l.reference_number,
      title: l.title,
      type: l.type,
      date_received_sent: l.date_received_sent,
    }));

    return { total: (incoming || 0) + (outgoing || 0), incoming: incoming || 0, outgoing: outgoing || 0, recent };
  }, { total: 0, incoming: 0, outgoing: 0, recent: [] });
}

// ----------------------------------------------------------------------------
// Sertijab
// ----------------------------------------------------------------------------

function summarizeHandovers(rows: HandoverRow[]): DashboardData["handovers"] {
  const byStatus = countStatus(rows, "status");

  const current =
    rows.find((h) => h.status === "ONGOING") ||
    rows.find((h) => h.status !== "COMPLETED") ||
    rows[0] ||
    null;

  const toItem = (h: HandoverRow): HandoverItem => ({
    id: h.id,
    period_from: h.period_from,
    period_to: h.period_to,
    status: h.status,
    handover_date: h.handover_date,
  });

  const history = rows.slice(0, 5).map(toItem);

  return {
    total: rows.length,
    byStatus,
    current: current ? toItem(current) : null,
    history,
  };
}

// ----------------------------------------------------------------------------
// Proyek Insidental
// ----------------------------------------------------------------------------

async function buildProjects(
  supabase: SupabaseClient,
  periodId: string | null
): Promise<DashboardData["projects"]> {
  return safe(async () => {
    let q = supabase.from("incidental_projects").select("id, name, status, start_date");
    if (periodId) q = q.eq("handover_id", periodId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const rows = data || [];
    const byStatus = countStatus(rows, "status");
    const projectIds = rows.map((r) => r.id);

    let fq = supabase.from("project_funds").select("type, amount");
    if (projectIds.length) fq = fq.in("project_id", projectIds);
    const { data: funds } = await fq;
    let totalIncome = 0;
    let totalExpense = 0;
    for (const f of funds || []) {
      if (f.type === "INCOME") totalIncome += num(f.amount);
      else totalExpense += num(f.amount);
    }

    const recent: ProjectItem[] = rows
      .slice()
      .sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)))
      .slice(0, 5)
      .map((r) => ({ id: r.id, name: r.name, status: r.status, start_date: r.start_date }));

    return { total: rows.length, byStatus, totalIncome, totalExpense, recent };
  }, { total: 0, byStatus: [], totalIncome: 0, totalExpense: 0, recent: [] });
}

// ----------------------------------------------------------------------------
// Entry point
// ----------------------------------------------------------------------------

export interface BuildDashboardOptions {
  uid: string;
  role: string | null;
  kabidDivisionId: string | null;
  periodId?: string | null;
}

export async function buildDashboardData(
  supabase: SupabaseClient,
  opts: BuildDashboardOptions
): Promise<DashboardData> {
  const { role, kabidDivisionId, periodId } = opts;

  // Periode (Sertijab) — sumber data filter "Periode Berjalan"
  let handoverRows: HandoverRow[] = [];
  try {
    const { data } = await supabase
      .from("handovers")
      .select("id, period_from, period_to, status, handover_date")
      .order("period_to", { ascending: false });
    handoverRows = (data || []) as unknown as HandoverRow[];
  } catch {
    // abaikan jika tabel periode gagal diakses
  }

  const currentHandover =
    handoverRows.find((h) => h.status === "ONGOING") ||
    handoverRows.find((h) => h.status !== "COMPLETED") ||
    handoverRows[0] ||
    null;

  let effectivePeriodId: string | null = null;
  if (periodId === "all") {
    effectivePeriodId = null;
  } else if (periodId && handoverRows.some((h) => h.id === periodId)) {
    effectivePeriodId = periodId;
  } else {
    // Default: Periode Berjalan yang aktif
    effectivePeriodId = currentHandover?.id ?? null;
  }

  const financeVisible =
    role !== null && ["ADMIN", "KETUA_UMUM", "WAKIL_KETUA", "PENGURUS_INTI", "SEKRETARIS", "BENDAHARA"].includes(role);

  const periodHandover =
    effectivePeriodId ? handoverRows.find((h) => h.id === effectivePeriodId) || null : null;
  const programPeriodBounds = periodHandover
    ? handoverPeriodBounds(periodHandover.period_from, periodHandover.period_to)
    : null;

  const [orgData, profileData, programs, finances, members, attendance, athletics, achievements, inventory, letters, projects] =
    await Promise.all([
      supabase.from("organization_settings").select("org_name, period_year").limit(1).maybeSingle(),
      supabase.from("profiles").select("full_name, role").eq("id", opts.uid).maybeSingle(),
      buildPrograms(supabase, kabidDivisionId, programPeriodBounds),
      buildFinances(supabase, financeVisible, effectivePeriodId),
      buildMembers(supabase, kabidDivisionId),
      buildAttendance(supabase, kabidDivisionId),
      buildAthletics(supabase),
      buildAchievements(supabase, effectivePeriodId),
      buildInventory(supabase),
      buildLetters(supabase, effectivePeriodId),
      buildProjects(supabase, effectivePeriodId),
    ]);

  const selectedHandover =
    effectivePeriodId ? handoverRows.find((h) => h.id === effectivePeriodId) || null : null;

  const periodLabel = selectedHandover
    ? `Periode ${selectedHandover.period_to}`
    : handoverRows.length === 0
      ? orgData.data?.period_year
        ? `Periode ${orgData.data.period_year}`
        : null
      : "Semua Periode";

  const periods: PeriodOption[] = handoverRows.map((h) => ({
    id: h.id,
    label: `Periode ${h.period_to}`,
    status: h.status,
  }));

  return {
    overview: {
      orgName: orgData.data?.org_name || "SIORG",
      userName: profileData.data?.full_name || "Pengguna",
      userRole: profileData.data?.role || role || "",
      periodLabel,
      dateLabel: toDateLabel(new Date()),
    },
    periods,
    selectedPeriodId: effectivePeriodId ?? "all",
    programs,
    finances,
    members,
    attendance,
    athletics,
    achievements,
    inventory,
    letters,
    handovers: summarizeHandovers(handoverRows),
    projects,
  };
}
