// ============================================================================
// SIORG Import — Screening & Commit Engine (server only)
// Mengubah teks CSV menjadi laporan screening per baris, lalu menyimpan data
// hanya bila seluruh baris lolos. Tidak ada Partial import: bila satu baris
// bermasalah, seluruh file ditolak agar pengguna tidak_import separuh diam-diam.
// ============================================================================

import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_USER_PASSWORD } from "@/lib/auth-constants";
import { writeAuditLog } from "@/lib/audit";
import { parseCsv } from "./csv";
import { normalizeHeader, normalizeValue } from "./shared";
import { getImportSpec } from "./specs";
import {
  createSeenState,
  type ImportCommitFailure,
  type ImportCommitResult,
  type ImportContext,
  type ImportHandoverLookup,
  type ImportModuleKey,
  type ImportModuleSpec,
  type ImportRowIssue,
  type ImportScreening,
  type ImportScreeningRow,
  type NamedLookup,
} from "./types";

/** Batas aman untuk satu proses impor. */
export const MAX_IMPORT_ROWS = 500;

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServer>>;

/** Konteks kosong baru untuk setiap pemanggilan. */
function createEmptyContext(): ImportContext {
  return {
    divisions: [],
    fakultas: [],
    jurusan: [],
    programs: [],
    projects: [],
    wallets: [],
    banks: [],
    cashAccounts: [],
    handovers: [],
    existingNims: new Set<string>(),
    existingEmails: new Set<string>(),
    existingLetterRefs: new Set<string>(),
  };
}

function toLookup(rows: { id: string; name: string }[] | null): NamedLookup[] {
  return (rows ?? []).map((row) => ({ id: row.id, name: row.name }));
}

/** Label periode serti jab + alias yang diterima di CSV. */
function buildHandoverLookup(row: {
  id: string;
  period_from: string;
  period_to: string;
}): ImportHandoverLookup {
  const from = row.period_from;
  const to = row.period_to;
  const fromYear = from.slice(0, 4);
  const toYear = to.slice(0, 4);
  const shortToYear = toYear.slice(2);
  const aliases = new Set<string>([
    `${fromYear}/${shortToYear}`,
    `${fromYear}-${shortToYear}`,
    `${fromYear} ${shortToYear}`,
    from,
    to,
    `${from} - ${to}`,
    `${from} s/d ${to}`,
    `${from}/${to}`,
  ]);
  return {
    id: row.id,
    period_from: from,
    period_to: to,
    label: `${fromYear}/${toYear}`,
    aliases: [...aliases],
  };
}

/**
 * Memuat seluruh data referensi yang dibutuhkan validasi baris.
 * Hanya tabel yang relevan untuk modul tersebut yang diambil.
 */
export async function loadImportContext(
  supabase: SupabaseClient,
  module: ImportModuleKey
): Promise<ImportContext> {
  const ctx: ImportContext = createEmptyContext();

  if (module === "members") {
    const [divisions, fakultas, jurusan, profiles] = await Promise.all([
      supabase.from("divisions").select("id, name"),
      supabase.from("fakultas").select("id, name"),
      supabase.from("jurusan").select("id, name, fakultas_id"),
      supabase.from("profiles").select("nim, email"),
    ]);
    ctx.divisions = toLookup(divisions.data);
    ctx.fakultas = toLookup(fakultas.data);
    ctx.jurusan = (jurusan.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      aliases: [],
    }));
    ctx.existingNims = new Set(
      (profiles.data ?? []).map((p) => p.nim?.toLowerCase() ?? "").filter(Boolean)
    );
    ctx.existingEmails = new Set(
      (profiles.data ?? []).map((p) => p.email?.toLowerCase() ?? "").filter(Boolean)
    );
    return ctx;
  }

  if (module === "finances") {
    const [wallets, banks, cashAccounts, programs, projects, handovers] = await Promise.all([
      supabase.from("wallets").select("id, name"),
      supabase.from("banks").select("id, name"),
      supabase.from("cash_accounts").select("id, name"),
      supabase.from("programs").select("id, name"),
      supabase.from("incidental_projects").select("id, name"),
      supabase.from("handovers").select("id, period_from, period_to"),
    ]);
    ctx.wallets = toLookup(wallets.data);
    ctx.banks = toLookup(banks.data);
    ctx.cashAccounts = toLookup(cashAccounts.data);
    ctx.programs = toLookup(programs.data);
    ctx.projects = toLookup(projects.data);
    ctx.handovers = (handovers.data ?? []).map(buildHandoverLookup);
    return ctx;
  }

  if (module === "letters") {
    const { data: letters } = await supabase.from("letters").select("reference_number");
    ctx.existingLetterRefs = new Set(
      (letters ?? []).map((l) => normalizeValue(l.reference_number ?? "")).filter(Boolean)
    );
    const { data: handovers } = await supabase
      .from("handovers")
      .select("id, period_from, period_to");
    ctx.handovers = (handovers ?? []).map(buildHandoverLookup);
    return ctx;
  }

  return ctx;
}

// ---------------------------------------------------------------------------
// Screening
// ---------------------------------------------------------------------------

function isEmptyRow(cells: string[]): boolean {
  return cells.every((cell) => cell.trim() === "");
}

/**
 * Menjalankan skrining: memetakan header, lalu memvalidasi tiap baris.
 * Header yang tidak dikenali diabaikan (file hasil unduhan "data bermasalah"
 * tetap bisa diunggah ulang tanpa menghapus kolom tambahan).
 */
export function screenCsv(spec: ImportModuleSpec, csv: string, ctx: ImportContext): ImportScreening {
  const fileErrors: string[] = [];
  const unknownHeaders: string[] = [];
  const rows: ImportScreeningRow[] = [];

  const { rows: matrix, startLines } = parseCsv(csv);

  if (matrix.length === 0) {
    return {
      module: spec.key,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      rows: [],
      fileErrors: ["File CSV kosong. Unggah file yang berisi header dan minimal satu baris data."],
      unknownHeaders: [],
    };
  }

  const headerCells = matrix[0].map((cell) => cell.trim());
  const knownHeaders = new Map<string, string>(); // normalized header -> field key
  const seenHeaderLabels = new Set<string>();

  for (const field of spec.fields) {
    knownHeaders.set(normalizeHeader(field.header), field.key);
  }

  const headerToField = new Map<number, string | null>();
  for (let i = 0; i < headerCells.length; i++) {
    const label = headerCells[i];
    if (label === "") {
      headerToField.set(i, null);
      continue;
    }
    const normalized = normalizeHeader(label);
    const fieldKey = knownHeaders.get(normalized) ?? null;
    if (!fieldKey) unknownHeaders.push(label);
    if (seenHeaderLabels.has(normalized)) {
      fileErrors.push(`Kolom "${label}" muncul lebih dari sekali.`);
      continue;
    }
    seenHeaderLabels.add(normalized);
    headerToField.set(i, fieldKey);
  }

  for (const field of spec.fields) {
    const normalized = normalizeHeader(field.header);
    if (!seenHeaderLabels.has(normalized)) {
      fileErrors.push(
        `Kolom wajib "${field.header}" tidak ditemukan pada file. Pastikan baris pertama berisi header yang sama persis dengan template.`
      );
    }
  }

  const dataRows = matrix.slice(1).filter((cells) => !isEmptyRow(cells));

  if (dataRows.length === 0) {
    fileErrors.push("File tidak berisi data. Tambahkan minimal satu baris di bawah baris header.");
  } else if (dataRows.length > MAX_IMPORT_ROWS) {
    fileErrors.push(
      `File berisi ${dataRows.length} baris, melebihi batas ${MAX_IMPORT_ROWS} baris per impor.`
    );
  }

  const seen = createSeenState();
  for (let i = 0; i < matrix.length - 1; i++) {
    const cells = matrix[i + 1];
    if (isEmptyRow(cells)) continue;
    if (dataRows.length > MAX_IMPORT_ROWS) break;

    const values: Record<string, string> = {};
    for (const field of spec.fields) values[field.key] = "";
    for (let c = 0; c < cells.length; c++) {
      const fieldKey = headerToField.get(c) ?? null;
      if (!fieldKey) continue;
      values[fieldKey] = (cells[c] ?? "").trim();
    }

    // Deteksi jumlah kolom tidak sama dengan header
    const issues: ImportRowIssue[] = [];
    if (cells.length > headerCells.length) {
      issues.push({
        field: null,
        message: `Baris ini memiliki ${cells.length} kolom, melebihi ${headerCells.length} kolom pada header. Periksa jumlah tanda pisah (koma) atau tanda kutip pada file.`,
      });
    }

    if (issues.length === 0) {
      issues.push(...spec.validateRow(values, ctx, seen));
    }

    rows.push({
      line: startLines[i + 1] ?? i + 2,
      values,
      issues,
      valid: issues.length === 0,
    });
  }

  const validRows = rows.filter((row) => row.valid).length;

  return {
    module: spec.key,
    totalRows: rows.length,
    validRows,
    invalidRows: rows.length - validRows,
    rows,
    fileErrors,
    unknownHeaders,
  };
}

export function isScreeningClean(screening: ImportScreening): boolean {
  return (
    screening.fileErrors.length === 0 &&
    screening.invalidRows === 0 &&
    screening.totalRows > 0
  );
}

// ---------------------------------------------------------------------------
// Commit
// ---------------------------------------------------------------------------

interface CommitContext {
  supabase: SupabaseClient;
  spec: ImportModuleSpec;
  ctx: ImportContext;
  uid: string;
}

async function commitMembers(
  { supabase, spec, ctx, uid }: CommitContext,
  rows: ImportScreeningRow[]
): Promise<ImportCommitResult> {
  const admin = createSupabaseAdmin();
  const failures: ImportCommitFailure[] = [];
  let created = 0;

  for (const row of rows) {
    const record = spec.toRecord(row.values, ctx) as {
      full_name: string;
      nim: string;
      email: string;
      role: string;
      status: string;
      phone_number: string | null;
      division_id: string | null;
      fakultas_id: string | null;
      jurusan_id: string | null;
      joined_at: string | null;
    };

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: record.email,
      password: DEFAULT_USER_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: record.full_name,
        nim: record.nim,
        phone_number: record.phone_number ?? "",
        role: record.role,
        division_id: record.division_id ?? "",
        fakultas_id: record.fakultas_id ?? "",
        jurusan_id: record.jurusan_id ?? "",
      },
    });

    if (authError || !authData?.user) {
      const message = authError?.message ?? "Gagal membuat akun pengguna.";
      failures.push({
        line: row.line,
        message: /already been registered|already exists/i.test(message)
          ? "Email sudah terdaftar dalam sistem."
          : message,
      });
      continue;
    }

    const profileId = authData.user.id;
    const updates: Record<string, unknown> = {};
    if (record.joined_at) updates.joined_at = record.joined_at;
    if (record.status !== "AKTIF") updates.status = record.status;

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", profileId);
      if (updateError) {
        failures.push({
          line: row.line,
          message: `Akun dibuat, tetapi data anggota gagal disimpan: ${updateError.message}`,
        });
        continue;
      }
    }

    created++;
    ctx.existingNims.add(record.nim.toLowerCase());
    ctx.existingEmails.add(record.email.toLowerCase());

    await writeImportAudit(uid, "profiles", profileId, record);
  }

  return { module: spec.key, created, failures };
}

async function commitFinances(
  { supabase, spec, ctx, uid }: CommitContext,
  rows: ImportScreeningRow[]
): Promise<ImportCommitResult> {
  const payload = rows.map((row) => ({
    ...(spec.toRecord(row.values, ctx) as Record<string, unknown>),
    created_by: uid,
    source: "keuangan",
  }));

  const { data, error } = await supabase.from("finances").insert(payload).select("id");
  if (error) {
    return {
      module: spec.key,
      created: 0,
      failures: rows.map((row) => ({ line: row.line, message: error.message })),
    };
  }

  const ids = (data ?? []).map((row) => row.id as string);
  await Promise.all(
    ids.map((id) =>
      writeImportAudit(uid, "finances", id, { source: "import_csv", bulk: true })
    )
  );

  return { module: spec.key, created: ids.length, failures: [] };
}

async function commitInventory(
  { supabase, spec, ctx, uid }: CommitContext,
  rows: ImportScreeningRow[]
): Promise<ImportCommitResult> {
  const failures: ImportCommitFailure[] = [];
  let created = 0;

  // Insert per baris: kode barang dibuat oleh trigger BRG-XXXX yang menghitung
  // MAX+1, sehingga tidak aman bila beberapa baris di-insert sekaligus.
  for (const row of rows) {
    const record = spec.toRecord(row.values, ctx) as Record<string, unknown>;
    const { data, error } = await supabase
      .from("inventory_items")
      .insert({ ...record, created_by: uid })
      .select("id")
      .single();

    if (error || !data) {
      failures.push({ line: row.line, message: error?.message ?? "Gagal menyimpan barang." });
      continue;
    }

    created++;
    await writeImportAudit(uid, "inventory_items", data.id, record);
  }

  return { module: spec.key, created, failures };
}

async function commitLetters(
  { supabase, spec, ctx, uid }: CommitContext,
  rows: ImportScreeningRow[]
): Promise<ImportCommitResult> {
  const failures: ImportCommitFailure[] = [];
  let created = 0;

  // Insert per baris: nomor referensi dibuat trigger dari COUNT() per bulan.
  for (const row of rows) {
    const record = spec.toRecord(row.values, ctx) as Record<string, unknown>;
    const { data, error } = await supabase
      .from("letters")
      .insert({ ...record, created_by: uid })
      .select("id")
      .single();

    if (error || !data) {
      failures.push({ line: row.line, message: error?.message ?? "Gagal menyimpan surat." });
      continue;
    }

    created++;
    ctx.existingLetterRefs.add(normalizeValue(String(record.reference_number ?? "")));
    await writeImportAudit(uid, "letters", data.id, record);
  }

  return { module: spec.key, created, failures };
}

const COMMITTERS = {
  members: commitMembers,
  finances: commitFinances,
  inventory: commitInventory,
  letters: commitLetters,
} as const;

async function writeImportAudit(
  uid: string,
  targetTable: string,
  targetId: string,
  newValue: Record<string, unknown>
): Promise<void> {
  try {
    await writeAuditLog({
      action: "CREATE",
      targetTable,
      targetId,
      userId: uid,
      newValue: { ...newValue, imported_via: "csv" },
    });
  } catch {
    // Audit logging tidak boleh memutus proses impor.
  }
}

export interface CommitOutcome {
  result: ImportCommitResult | null;
  screening: ImportScreening;
}

/**
 * Menyimpan data dari CSV. Validasi selalu dijalankan ulang di server sehingga
 * file yang bermasalah tidak pernah bisa dipaksakan lewat bypass client.
 */
export async function commitImport(
  supabase: SupabaseClient,
  module: ImportModuleKey,
  csv: string,
  uid: string
): Promise<CommitOutcome> {
  const spec = getImportSpec(module);
  if (!spec) {
    throw new Error(`Modul impor "${module}" tidak dikenal.`);
  }

  const ctx = await loadImportContext(supabase, module);
  const screening = screenCsv(spec, csv, ctx);

  if (!isScreeningClean(screening)) {
    return { result: null, screening };
  }

  const cleanRows = screening.rows.filter((row) => row.valid);
  const result = await COMMITTERS[module]({ supabase, spec, ctx, uid }, cleanRows);

  return { result, screening };
}