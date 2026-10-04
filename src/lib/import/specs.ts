// ============================================================================
// SIORG Import — Module Specs
// Definisi kolom template + aturan validasi baris untuk 4 modul: Anggota,
// Keuangan, Inventaris, dan Persuratan. File ini aman diimport di client
// (tidak ada dependency server) sehingga modal impor bisa menampilkan
// panduan kolom tanpa request tambahan.
// ============================================================================

import {
  daysFromToday,
  isValidEmail,
  isValidUrl,
  matchEnum,
  matchLookup,
  normalizePhone,
  normalizeValue,
  parseAmount,
  parseDate,
  today,
  type EnumEntry,
} from "./shared";
import type {
  ImportContext,
  ImportField,
  ImportModuleKey,
  ImportModuleSpec,
  ImportRowIssue,
} from "./types";

// ---------------------------------------------------------------------------
// Enum bersama (harus sinkron dengan enum PostgreSQL di schema.sql)
// ---------------------------------------------------------------------------

const ROLE_OPTIONS: EnumEntry[] = [
  { value: "ANGGOTA", label: "Anggota", aliases: ["anggota", "member", "peserta"] },
  { value: "KABID", label: "Kabid", aliases: ["kabid", "ketua bidang"] },
  { value: "PELATIH", label: "Pelatih", aliases: ["pelatih", "coach"] },
  { value: "PEMBINA", label: "Pembina", aliases: ["pembina"] },
  { value: "SEKRETARIS", label: "Sekretaris", aliases: ["sekretaris", "sekretaris umum"] },
  { value: "BENDAHARA", label: "Bendahara", aliases: ["bendahara", "keuangan"] },
  { value: "PENGURUS_INTI", label: "Pengurus Inti", aliases: ["pengurus inti", "pengurus", "pi", "core"] },
  { value: "WAKIL_KETUA", label: "Wakil Ketua", aliases: ["wakil ketua", "wakil", "waketu"] },
  { value: "KETUA_UMUM", label: "Ketua Umum", aliases: ["ketua umum", "ketua", "ketu"] },
  { value: "ADMIN", label: "Admin", aliases: ["admin", "administrator"] },
];

const STATUS_OPTIONS: EnumEntry[] = [
  { value: "AKTIF", label: "Aktif", aliases: ["aktif", "active"] },
  { value: "CUTI", label: "Cuti", aliases: ["cuti"] },
  { value: "ALUMNI", label: "Alumni", aliases: ["alumni", "lulusan", "alumnus"] },
  { value: "NONAKTIF", label: "Nonaktif", aliases: ["nonaktif", "non aktif", "tidak aktif", "pensiun"] },
];

const FINANCE_TYPE_OPTIONS: EnumEntry[] = [
  { value: "INCOME", label: "Pemasukan", aliases: ["income", "pemasukan", "masuk", "penerimaan"] },
  { value: "EXPENSE", label: "Pengeluaran", aliases: ["expense", "pengeluaran", "keluar"] },
];

const CATEGORY_OPTIONS: EnumEntry[] = [
  { value: "ELECTRONICS", label: "Elektronik", aliases: ["elektronik", "electronic", "it", "komputer", "gadget"] },
  { value: "FURNITURE", label: "Meubelair", aliases: ["meubelair", "furniture", "furnitur", "perabot"] },
  { value: "STATIONERY", label: "ATK", aliases: ["atk", "stationery", "alat tulis", "peralatan tulis"] },
  { value: "DOCUMENTS", label: "Dokumen", aliases: ["dokumen", "document", "arsip"] },
  { value: "OTHER", label: "Lainnya", aliases: ["lainnya", "other", "lain", "lain-lain", "misc"] },
];

const CONDITION_OPTIONS: EnumEntry[] = [
  { value: "GOOD", label: "Baik", aliases: ["baik", "good", "normal"] },
  { value: "DAMAGED_LIGHT", label: "Rusak Ringan", aliases: ["rusak ringan", "damaged light", "rusak", "ringan"] },
  { value: "DAMAGED_HEAVY", label: "Rusak Berat", aliases: ["rusak berat", "damaged heavy"] },
  { value: "LOST", label: "Hilang", aliases: ["hilang", "lost", "rusak total"] },
];

const LETTER_TYPE_OPTIONS: EnumEntry[] = [
  { value: "INCOMING", label: "Surat Masuk", aliases: ["surat masuk", "incoming", "masuk", "terima"] },
  { value: "OUTGOING", label: "Surat Keluar", aliases: ["surat keluar", "outgoing", "keluar", "kirim"] },
];

const CLASSIFICATION_OPTIONS: EnumEntry[] = [
  { value: "PUBLIC", label: "Publik", aliases: ["publik", "public", "terbuka"] },
  { value: "CONFIDENTIAL", label: "Rahasia", aliases: ["rahasia", "confidential", "terbatas"] },
];

// ---------------------------------------------------------------------------
// Helper validasi
// ---------------------------------------------------------------------------

const MAX_NIM_LENGTH = 30;

function issue(field: string | null, message: string): ImportRowIssue {
  return { field, message };
}

/** Validasi kolom teks wajib. Mengembalikan nilai bersih atau null. */
function requiredText(
  values: Record<string, string>,
  key: string,
  min: number,
  max: number,
  label: string
): { value: string | null; issues: ImportRowIssue[] } {
  const raw = values[key]?.trim() ?? "";
  if (raw === "") return { value: null, issues: [issue(key, `${label} wajib diisi.`)] };
  if (raw.length < min) {
    return {
      value: null,
      issues: [issue(key, `${label} minimal ${min} karakter (saat ini ${raw.length}).`)],
    };
  }
  if (raw.length > max) {
    return {
      value: null,
      issues: [issue(key, `${label} maksimal ${max} karakter (saat ini ${raw.length}).`)],
    };
  }
  return { value: raw, issues: [] };
}

/** Validasi kolom tanggal wajib. */
function requiredDate(
  values: Record<string, string>,
  key: string,
  label: string
): { value: string | null; issues: ImportRowIssue[] } {
  const raw = values[key]?.trim() ?? "";
  if (raw === "") return { value: null, issues: [issue(key, `${label} wajib diisi.`)] };
  const parsed = parseDate(raw);
  if (!parsed) {
    return {
      value: null,
      issues: [
        issue(key, `${label} tidak valid ("${raw}"). Format yang benar: 2024-09-01 atau 01/09/2024.`),
      ],
    };
  }
  return { value: parsed, issues: [] };
}

/** Validasi kolom tanggal opsional. */
function optionalDate(
  values: Record<string, string>,
  key: string,
  label: string
): { value: string | null; issues: ImportRowIssue[] } {
  const raw = values[key]?.trim() ?? "";
  if (raw === "") return { value: null, issues: [] };
  const parsed = parseDate(raw);
  if (!parsed) {
    return {
      value: null,
      issues: [
        issue(key, `${label} tidak valid ("${raw}"). Format yang benar: 2024-09-01 atau 01/09/2024.`),
      ],
    };
  }
  return { value: parsed, issues: [] };
}

/** Validasi kolom nominal opsional; default 0 bila kosong. */
function optionalAmount(
  values: Record<string, string>,
  key: string,
  label: string,
  fallback = 0
): { value: number | null; issues: ImportRowIssue[] } {
  const raw = values[key]?.trim() ?? "";
  if (raw === "") return { value: fallback, issues: [] };
  const parsed = parseAmount(raw);
  if (parsed === null) {
    return {
      value: null,
      issues: [issue(key, `${label} harus berupa angka (contoh: 1500000 atau 1.500.000).`)],
    };
  }
  if (parsed < 0) {
    return { value: null, issues: [issue(key, `${label} tidak boleh negatif.`)] };
  }
  if (parsed > 999_999_999_999) {
    return { value: null, issues: [issue(key, `${label} terlalu besar.`)] };
  }
  return { value: parsed, issues: [] };
}

/** Validasi kolom URL opsional. */
function optionalUrl(
  values: Record<string, string>,
  key: string,
  label: string
): { value: string | null; issues: ImportRowIssue[] } {
  const raw = values[key]?.trim() ?? "";
  if (raw === "") return { value: null, issues: [] };
  if (!isValidUrl(raw)) {
    return {
      value: null,
      issues: [issue(key, `${label} harus berupa URL lengkap, contoh: https://contoh.com/file.pdf`)],
    };
  }
  return { value: raw, issues: [] };
}

/** Cocokkan kolom opsional ke lookup; string kosong = null. */
function optionalLookup(
  values: Record<string, string>,
  key: string,
  items: ImportContext["divisions"],
  label: string
): { id: string | null; issues: ImportRowIssue[] } {
  const raw = values[key]?.trim() ?? "";
  if (raw === "") return { id: null, issues: [] };
  const match = matchLookup(raw, items, label);
  if (!match.ok || !match.item) return { id: null, issues: [issue(key, match.message ?? `${label} tidak valid.`)] };
  return { id: match.item.id, issues: [] };
}

// ===========================================================================
// ANGGOTA
// ===========================================================================

const MEMBERS_FIELDS: ImportField[] = [
  {
    key: "full_name",
    header: "Nama Lengkap",
    required: true,
    example: "Budi Santoso",
    hint: "Minimal 3 karakter, maksimal 100",
  },
  {
    key: "nim",
    header: "NIM",
    required: true,
    example: "221011234",
    hint: "Harus unik, belum terdaftar",
  },
  {
    key: "email",
    header: "Email",
    required: true,
    example: "budi.santoso@student.ac.id",
    hint: "Dipakai untuk login, harus unik",
  },
  {
    key: "role",
    header: "Peran",
    required: false,
    example: "ANGGOTA",
    hint: "Kosongkan untuk ANGGOTA. Pilihan: " + ROLE_OPTIONS.map((r) => r.label).join(", "),
  },
  {
    key: "status",
    header: "Status",
    required: false,
    example: "AKTIF",
    hint: "Kosongkan untuk AKTIF. Pilihan: " + STATUS_OPTIONS.map((r) => r.label).join(", "),
  },
  {
    key: "phone_number",
    header: "No. HP",
    required: false,
    example: "08123456789",
    hint: "Hanya digit, 8-15 karakter",
  },
  {
    key: "division",
    header: "Divisi",
    required: false,
    example: "Divisi Informasi dan Teknologi",
    hint: "Harus sesuai data divisi yang sudah ada di Pengaturan > Divisi",
  },
  {
    key: "fakultas",
    header: "Fakultas",
    required: false,
    example: "Fakultas Teknik",
    hint: "Harus sesuai data fakultas yang sudah ada",
  },
  {
    key: "jurusan",
    header: "Jurusan",
    required: false,
    example: "Teknik Informatika",
    hint: "Harus sesuai data jurusan yang sudah ada",
  },
  {
    key: "joined_at",
    header: "Tanggal Bergabung",
    required: false,
    example: "2024-09-01",
    hint: "Format 2024-09-01 atau 01/09/2024",
  },
];

interface MemberParsed {
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
}

function parseMemberRow(
  values: Record<string, string>,
  ctx: ImportContext
): { parsed: MemberParsed; issues: ImportRowIssue[] } {
  const issues: ImportRowIssue[] = [];

  const name = requiredText(values, "full_name", 3, 100, "Nama lengkap");
  issues.push(...name.issues);

  const nimRaw = values.nim?.trim() ?? "";
  let nim = "";
  if (nimRaw === "") {
    issues.push(issue("nim", "NIM wajib diisi."));
  } else if (nimRaw.length > MAX_NIM_LENGTH) {
    issues.push(issue("nim", `NIM maksimal ${MAX_NIM_LENGTH} karakter.`));
  } else if (!/^[A-Za-z0-9._/-]+$/.test(nimRaw)) {
    issues.push(issue("nim", "NIM hanya boleh berisi huruf, angka, titik, garis, atau garis miring."));
  } else {
    nim = nimRaw;
  }

  const emailRaw = values.email?.trim().toLowerCase() ?? "";
  let email = "";
  if (emailRaw === "") {
    issues.push(issue("email", "Email wajib diisi (dipakai untuk login)."));
  } else if (!isValidEmail(emailRaw)) {
    issues.push(issue("email", `Email tidak valid ("${values.email}").`));
  } else if (emailRaw.length > 255) {
    issues.push(issue("email", "Email maksimal 255 karakter."));
  } else {
    email = emailRaw;
  }

  const roleRaw = values.role?.trim() ?? "";
  let role = "ANGGOTA";
  if (roleRaw !== "") {
    const roleMatch = matchEnum<MemberParsed["role"]>(roleRaw, ROLE_OPTIONS);
    if (!roleMatch.ok) issues.push(issue("role", roleMatch.message ?? "Peran tidak valid."));
    else role = roleMatch.value ?? "ANGGOTA";
  }

  const statusRaw = values.status?.trim() ?? "";
  let status = "AKTIF";
  if (statusRaw !== "") {
    const statusMatch = matchEnum<MemberParsed["status"]>(statusRaw, STATUS_OPTIONS);
    if (!statusMatch.ok) issues.push(issue("status", statusMatch.message ?? "Status tidak valid."));
    else status = statusMatch.value ?? "AKTIF";
  }

  const phoneRaw = values.phone_number?.trim() ?? "";
  let phone: string | null = null;
  if (phoneRaw !== "") {
    phone = normalizePhone(phoneRaw);
    if (phone === "") {
      issues.push(
        issue("phone_number", `Nomor HP tidak valid ("${phoneRaw}"). Gunakan 8-15 digit, contoh: 08123456789.`)
      );
    }
  }

  const division = optionalLookup(values, "division", ctx.divisions, "Divisi");
  issues.push(...division.issues);
  const fakultas = optionalLookup(values, "fakultas", ctx.fakultas, "Fakultas");
  issues.push(...fakultas.issues);
  const jurusan = optionalLookup(values, "jurusan", ctx.jurusan, "Jurusan");
  issues.push(...jurusan.issues);

  if (fakultas.id && jurusan.id) {
    const fakultasItem = ctx.fakultas.find((f) => f.id === fakultas.id);
    const jurusanItem = ctx.jurusan.find((j) => j.id === jurusan.id);
    if (
      fakultasItem &&
      jurusanItem &&
      (jurusanItem as { fakultas_id?: string | null }).fakultas_id &&
      (jurusanItem as { fakultas_id?: string | null }).fakultas_id !== fakultas.id
    ) {
      issues.push(
        issue(
          "jurusan",
          `Jurusan "${jurusanItem.name}" tidak berada di Fakultas "${fakultasItem.name}".`
        )
      );
    }
  }

  const joined = optionalDate(values, "joined_at", "Tanggal bergabung");
  issues.push(...joined.issues);
  if (joined.value && joined.value > today()) {
    issues.push(issue("joined_at", "Tanggal bergabung tidak boleh di masa depan."));
  }

  return {
    parsed: {
      full_name: name.value ?? "",
      nim,
      email,
      role,
      status,
      phone_number: phone,
      division_id: division.id,
      fakultas_id: fakultas.id,
      jurusan_id: jurusan.id,
      joined_at: joined.value,
    },
    issues,
  };
}

const MEMBERS_SPEC: ImportModuleSpec = {
  key: "members",
  label: "Anggota",
  singular: "anggota",
  accessModule: "members",
  filename: "template-impor-anggota.csv",
  fields: MEMBERS_FIELDS,
  examples: [],
  headerMap: Object.fromEntries(MEMBERS_FIELDS.map((f) => [f.header, f.key])),
  bulkInsert: false,
  validateRow(values, ctx, seen) {
    const { parsed, issues } = parseMemberRow(values, ctx);

    if (parsed.nim) {
      if (ctx.existingNims.has(parsed.nim)) {
        issues.push(issue("nim", `NIM ${parsed.nim} sudah terdaftar di sistem.`));
      } else if (seen.nims.has(parsed.nim)) {
        issues.push(issue("nim", `NIM ${parsed.nim} duplikat di dalam file ini.`));
      } else {
        seen.nims.add(parsed.nim);
      }
    }

    if (parsed.email) {
      if (ctx.existingEmails.has(parsed.email)) {
        issues.push(issue("email", `Email ${parsed.email} sudah terdaftar di sistem.`));
      } else if (seen.emails.has(parsed.email)) {
        issues.push(issue("email", `Email ${parsed.email} duplikat di dalam file ini.`));
      } else {
        seen.emails.add(parsed.email);
      }
    }

    const signature = `${parsed.email}|${parsed.nim}`;
    if (parsed.email && parsed.nim && seen.signature.has(signature)) {
      issues.push(issue(null, "Baris ini identik dengan baris lain di dalam file."));
    } else if (parsed.email && parsed.nim) {
      seen.signature.add(signature);
    }

    return issues;
  },
  toRecord(values, ctx) {
    const { parsed } = parseMemberRow(values, ctx);
    return parsed as unknown as Record<string, unknown>;
  },
};

// ===========================================================================
// KEUANGAN
// ===========================================================================

const FINANCES_FIELDS: ImportField[] = [
  {
    key: "type",
    header: "Tipe",
    required: true,
    example: "Pemasukan",
    hint: "Pilihan: Pemasukan, Pengeluaran",
  },
  {
    key: "date",
    header: "Tanggal",
    required: true,
    example: "2024-09-01",
    hint: "Format 2024-09-01 atau 01/09/2024",
  },
  {
    key: "amount",
    header: "Jumlah",
    required: true,
    example: "1500000",
    hint: "Tanpa titik desimal: 1500000 (atau 1.500.000)",
  },
  {
    key: "description",
    header: "Deskripsi",
    required: true,
    example: "Iuran anggota bulan September",
    hint: "Minimal 3 karakter, maksimal 500",
  },
  {
    key: "source",
    header: "Sumber Dana",
    required: false,
    example: "Bank BRI",
    hint: "Nama dompet, bank, atau kas yang sudah terdaftar",
  },
  {
    key: "program",
    header: "Program Kerja",
    required: false,
    example: "Maktaba Digital",
    hint: "Harus sesuai data program yang sudah ada",
  },
  {
    key: "project",
    header: "Proyek Insidental",
    required: false,
    example: "Festivalisasi 2024",
    hint: "Harus sesuai data proyek yang sudah ada",
  },
  {
    key: "handover",
    header: "Periode Sertijab",
    required: false,
    example: "2024/2025",
    hint: "Format periode, contoh: 2024/2025 atau 2024-09-01 - 2025-09-01",
  },
  {
    key: "receipt_url",
    header: "URL Bukti",
    required: false,
    example: "https://drive.google.com/abc",
    hint: "URL bukti transfer/kuitansi",
  },
];

interface FinanceSource {
  wallet_id: string | null;
  bank_id: string | null;
  cash_account_id: string | null;
}

function matchSource(
  values: Record<string, string>,
  ctx: ImportContext
): { source: FinanceSource; issues: ImportRowIssue[] } {
  const raw = values.source?.trim() ?? "";
  const empty: FinanceSource = { wallet_id: null, bank_id: null, cash_account_id: null };
  if (raw === "") return { source: empty, issues: [] };

  const wallet = matchLookup(raw, ctx.wallets, "Dompet");
  if (wallet.ok && wallet.item) {
    return { source: { ...empty, wallet_id: wallet.item.id }, issues: [] };
  }
  const bank = matchLookup(raw, ctx.banks, "Bank");
  if (bank.ok && bank.item) {
    return { source: { ...empty, bank_id: bank.item.id }, issues: [] };
  }
  const cash = matchLookup(raw, ctx.cashAccounts, "Kas");
  if (cash.ok && cash.item) {
    return { source: { ...empty, cash_account_id: cash.item.id }, issues: [] };
  }

  const options = [
    ...ctx.wallets.map((w) => w.name),
    ...ctx.banks.map((b) => b.name),
    ...ctx.cashAccounts.map((c) => c.name),
  ];
  return {
    source: empty,
    issues: [
      issue(
        "source",
        `Sumber dana "${raw}" tidak ditemukan. Pilihan yang tersedia: ${
          options.slice(0, 10).join(", ") || "(belum ada data dompet/bank/kas)"
        }${options.length > 10 ? ", ..." : ""}.`
      ),
    ],
  };
}

interface FinanceParsed {
  type: "INCOME" | "EXPENSE";
  amount: number;
  description: string;
  date: string;
  program_id: string | null;
  project_id: string | null;
  handover_id: string | null;
  receipt_url: string;
  wallet_id: string | null;
  bank_id: string | null;
  cash_account_id: string | null;
}

function parseFinanceRow(
  values: Record<string, string>,
  ctx: ImportContext
): { parsed: FinanceParsed; issues: ImportRowIssue[] } {
  const issues: ImportRowIssue[] = [];

  const typeRaw = values.type?.trim() ?? "";
  let type: FinanceParsed["type"] = "INCOME";
  if (typeRaw === "") {
    issues.push(issue("type", "Tipe transaksi wajib diisi (Pemasukan/Pengeluaran)."));
  } else {
    const typeMatch = matchEnum<FinanceParsed["type"]>(typeRaw, FINANCE_TYPE_OPTIONS);
    if (!typeMatch.ok) issues.push(issue("type", typeMatch.message ?? "Tipe transaksi tidak valid."));
    else type = typeMatch.value ?? "INCOME";
  }

  const date = requiredDate(values, "date", "Tanggal");
  issues.push(...date.issues);
  if (date.value && daysFromToday(date.value) > 1) {
    issues.push(issue("date", "Tanggal transaksi tidak boleh di masa depan."));
  }

  const amountRaw = values.amount?.trim() ?? "";
  let amount = 0;
  if (amountRaw === "") {
    issues.push(issue("amount", "Jumlah wajib diisi."));
  } else {
    const amountParsed = parseAmount(amountRaw);
    if (amountParsed === null) {
      issues.push(
        issue("amount", `Jumlah harus berupa angka (contoh: 1500000 atau 1.500.000), bukan "${amountRaw}".`)
      );
    } else if (amountParsed <= 0) {
      issues.push(issue("amount", "Jumlah harus lebih dari 0."));
    } else if (amountParsed > 999_999_999_999) {
      issues.push(issue("amount", "Jumlah terlalu besar."));
    } else {
      amount = amountParsed;
    }
  }

  const description = requiredText(values, "description", 3, 500, "Deskripsi");
  issues.push(...description.issues);

  const source = matchSource(values, ctx);
  issues.push(...source.issues);

  const program = optionalLookup(values, "program", ctx.programs, "Program kerja");
  issues.push(...program.issues);
  const project = optionalLookup(values, "project", ctx.projects, "Proyek insidental");
  issues.push(...project.issues);
  const handover = matchHandover(values, ctx);
  issues.push(...handover.issues);

  const receipt = optionalUrl(values, "receipt_url", "URL bukti");
  issues.push(...receipt.issues);

  return {
    parsed: {
      type,
      amount,
      description: description.value ?? "",
      date: date.value ?? today(),
      program_id: program.id,
      project_id: project.id,
      handover_id: handover.id,
      receipt_url: receipt.value ?? "",
      wallet_id: source.source.wallet_id,
      bank_id: source.source.bank_id,
      cash_account_id: source.source.cash_account_id,
    },
    issues,
  };
}

const FINANCES_SPEC: ImportModuleSpec = {
  key: "finances",
  label: "Keuangan",
  singular: "transaksi",
  accessModule: "finances",
  filename: "template-impor-keuangan.csv",
  fields: FINANCES_FIELDS,
  examples: [],
  headerMap: Object.fromEntries(FINANCES_FIELDS.map((f) => [f.header, f.key])),
  bulkInsert: true,
  validateRow(values, ctx, seen) {
    const { parsed, issues } = parseFinanceRow(values, ctx);
    if (parsed.amount > 0 && parsed.date) {
      const signature = `${parsed.date}|${parsed.type}|${parsed.amount}|${normalizeValue(
        parsed.description
      )}`;
      if (seen.signature.has(signature)) {
        issues.push(
          issue(null, "Transaksi dengan tanggal, tipe, jumlah, dan deskripsi sama sudah ada di file ini.")
        );
      } else {
        seen.signature.add(signature);
      }
    }
    return issues;
  },
  toRecord(values, ctx) {
    const { parsed } = parseFinanceRow(values, ctx);
    return parsed as unknown as Record<string, unknown>;
  },
};

// ===========================================================================
// INVENTARIS
// ===========================================================================

const INVENTORY_FIELDS: ImportField[] = [
  {
    key: "name",
    header: "Nama Barang",
    required: true,
    example: "Laptop ASUS VivoBook 14",
    hint: "Minimal 3 karakter, maksimal 100",
  },
  {
    key: "category",
    header: "Kategori",
    required: true,
    example: "Elektronik",
    hint: "Pilihan: " + CATEGORY_OPTIONS.map((c) => c.label).join(", "),
  },
  {
    key: "stock",
    header: "Jumlah",
    required: true,
    example: "3",
    hint: "Bilangan bulat, minimal 1",
  },
  {
    key: "unit_price",
    header: "Harga Satuan",
    required: false,
    example: "7500000",
    hint: "Kosongkan bila tanpa nilai. Angka saja: 7500000",
  },
  {
    key: "condition",
    header: "Kondisi",
    required: false,
    example: "Baik",
    hint: "Kosongkan untuk Baik. Pilihan: " + CONDITION_OPTIONS.map((c) => c.label).join(", "),
  },
  {
    key: "location",
    header: "Lokasi Penyimpanan",
    required: true,
    example: "Ruang Sekretariat",
    hint: "Minimal 3 karakter, maksimal 100",
  },
  {
    key: "description",
    header: "Deskripsi",
    required: false,
    example: "Laptop untuk administrasi organisasi",
    hint: "Maksimal 250 karakter",
  },
  {
    key: "photo_url",
    header: "URL Foto",
    required: false,
    example: "https://contoh.com/foto.jpg",
    hint: "URL foto barang",
  },
];

interface InventoryParsed {
  name: string;
  category: string;
  stock: number;
  unit_price: number;
  condition: string;
  location: string;
  description: string;
  photo_url: string | null;
}

function parseInventoryRow(
  values: Record<string, string>
): { parsed: InventoryParsed; issues: ImportRowIssue[] } {
  const issues: ImportRowIssue[] = [];

  const name = requiredText(values, "name", 3, 100, "Nama barang");
  issues.push(...name.issues);

  const categoryRaw = values.category?.trim() ?? "";
  let category = "OTHER";
  if (categoryRaw === "") {
    issues.push(issue("category", "Kategori wajib diisi."));
  } else {
    const match = matchEnum<InventoryParsed["category"]>(categoryRaw, CATEGORY_OPTIONS);
    if (!match.ok) issues.push(issue("category", match.message ?? "Kategori tidak valid."));
    else category = match.value ?? "OTHER";
  }

  const stockRaw = values.stock?.trim() ?? "";
  let stock = 0;
  if (stockRaw === "") {
    issues.push(issue("stock", "Jumlah wajib diisi."));
  } else if (!/^\d+$/.test(stockRaw)) {
    issues.push(issue("stock", `Jumlah harus bilangan bulat positif, bukan "${stockRaw}".`));
  } else {
    stock = Number(stockRaw);
    if (stock < 1) issues.push(issue("stock", "Jumlah minimal 1 unit."));
    else if (stock > 1_000_000) issues.push(issue("stock", "Jumlah terlalu besar."));
  }

  const unitPrice = optionalAmount(values, "unit_price", "Harga satuan", 0);
  issues.push(...unitPrice.issues);

  const conditionRaw = values.condition?.trim() ?? "";
  let condition = "GOOD";
  if (conditionRaw !== "") {
    const match = matchEnum<InventoryParsed["condition"]>(conditionRaw, CONDITION_OPTIONS);
    if (!match.ok) issues.push(issue("condition", match.message ?? "Kondisi tidak valid."));
    else condition = match.value ?? "GOOD";
  }

  const location = requiredText(values, "location", 3, 100, "Lokasi penyimpanan");
  issues.push(...location.issues);

  const descriptionRaw = values.description?.trim() ?? "";
  let descriptionText = "";
  if (descriptionRaw !== "") {
    if (descriptionRaw.length > 250) {
      issues.push(issue("description", `Deskripsi maksimal 250 karakter (saat ini ${descriptionRaw.length}).`));
    } else {
      descriptionText = descriptionRaw;
    }
  }

  const photo = optionalUrl(values, "photo_url", "URL foto");
  issues.push(...photo.issues);

  return {
    parsed: {
      name: name.value ?? "",
      category,
      stock,
      unit_price: unitPrice.value ?? 0,
      condition,
      location: location.value ?? "",
      description: descriptionText,
      photo_url: photo.value,
    },
    issues,
  };
}

const INVENTORY_SPEC: ImportModuleSpec = {
  key: "inventory",
  label: "Inventaris",
  singular: "barang",
  accessModule: "inventory-add",
  filename: "template-impor-inventaris.csv",
  fields: INVENTORY_FIELDS,
  examples: [],
  headerMap: Object.fromEntries(INVENTORY_FIELDS.map((f) => [f.header, f.key])),
  bulkInsert: false,
  validateRow(values, _ctx, seen) {
    const { parsed, issues } = parseInventoryRow(values);
    const signature = normalizeValue(parsed.name);
    if (signature) {
      if (seen.signature.has(signature)) {
        issues.push(issue("name", `Nama barang "${parsed.name}" duplikat di dalam file ini.`));
      } else {
        seen.signature.add(signature);
      }
    }
    return issues;
  },
  toRecord(values) {
    const { parsed } = parseInventoryRow(values);
    return parsed as unknown as Record<string, unknown>;
  },
};

// ===========================================================================
// PERSURATAN
// ===========================================================================

const LETTERS_FIELDS: ImportField[] = [
  {
    key: "type",
    header: "Tipe",
    required: true,
    example: "Surat Masuk",
    hint: "Pilihan: Surat Masuk, Surat Keluar",
  },
  {
    key: "title",
    header: "Judul",
    required: true,
    example: "Undangan rapat koordinasi",
    hint: "Minimal 3 karakter, maksimal 255",
  },
  {
    key: "sender",
    header: "Pengirim/Penerima",
    required: true,
    example: "Fakultas Teknik",
    hint: "Minimal 3 karakter, maksimal 255",
  },
  {
    key: "date_received_sent",
    header: "Tanggal",
    required: true,
    example: "2024-09-01",
    hint: "Format 2024-09-01 atau 01/09/2024",
  },
  {
    key: "classification",
    header: "Klasifikasi",
    required: false,
    example: "Publik",
    hint: "Kosongkan untuk Publik. Pilihan: Publik, Rahasia",
  },
  {
    key: "reference_number",
    header: "Nomor Referensi",
    required: false,
    example: "001/UD/SIORG/IX/2024",
    hint: "Kosongkan untuk dibuat otomatis oleh sistem",
  },
  {
    key: "handover",
    header: "Periode Sertijab",
    required: false,
    example: "2024/2025",
    hint: "Format periode, contoh: 2024/2025",
  },
  {
    key: "document_url",
    header: "URL Dokumen",
    required: false,
    example: "https://contoh.com/surat.pdf",
    hint: "Link ke salinan digital surat",
  },
];

interface LetterParsed {
  type: "INCOMING" | "OUTGOING";
  title: string;
  sender: string;
  date_received_sent: string;
  classification: "PUBLIC" | "CONFIDENTIAL";
  reference_number: string;
  handover_id: string | null;
  document_url: string;
}

function parseLetterRow(
  values: Record<string, string>,
  ctx: ImportContext
): { parsed: LetterParsed; issues: ImportRowIssue[] } {
  const issues: ImportRowIssue[] = [];

  const typeRaw = values.type?.trim() ?? "";
  let type: LetterParsed["type"] = "INCOMING";
  if (typeRaw === "") {
    issues.push(issue("type", "Tipe surat wajib diisi (Surat Masuk/Surat Keluar)."));
  } else {
    const match = matchEnum<LetterParsed["type"]>(typeRaw, LETTER_TYPE_OPTIONS);
    if (!match.ok) issues.push(issue("type", match.message ?? "Tipe surat tidak valid."));
    else type = match.value ?? "INCOMING";
  }

  const title = requiredText(values, "title", 3, 255, "Judul");
  issues.push(...title.issues);

  const sender = requiredText(values, "sender", 3, 255, "Pengirim/penerima");
  issues.push(...sender.issues);

  const date = requiredDate(values, "date_received_sent", "Tanggal");
  issues.push(...date.issues);
  if (date.value && daysFromToday(date.value) > 1) {
    issues.push(issue("date_received_sent", "Tanggal surat tidak boleh di masa depan."));
  }

  const classificationRaw = values.classification?.trim() ?? "";
  let classification: LetterParsed["classification"] = "PUBLIC";
  if (classificationRaw !== "") {
    const match = matchEnum<LetterParsed["classification"]>(classificationRaw, CLASSIFICATION_OPTIONS);
    if (!match.ok) {
      issues.push(issue("classification", match.message ?? "Klasifikasi tidak valid."));
    } else {
      classification = match.value ?? "PUBLIC";
    }
  }

  const refRaw = values.reference_number?.trim() ?? "";
  let referenceNumber = "";
  if (refRaw !== "") {
    if (refRaw.length > 100) {
      issues.push(issue("reference_number", "Nomor referensi maksimal 100 karakter."));
    } else {
      referenceNumber = refRaw;
    }
  }

  const handover = matchHandover(values, ctx);
  issues.push(...handover.issues);

  const document = optionalUrl(values, "document_url", "URL dokumen");
  issues.push(...document.issues);

  return {
    parsed: {
      type,
      title: title.value ?? "",
      sender: sender.value ?? "",
      date_received_sent: date.value ?? today(),
      classification,
      reference_number: referenceNumber,
      handover_id: handover.id,
      document_url: document.value ?? "",
    },
    issues,
  };
}

const LETTERS_SPEC: ImportModuleSpec = {
  key: "letters",
  label: "Persuratan",
  singular: "surat",
  accessModule: "letters",
  filename: "template-impor-persuratan.csv",
  fields: LETTERS_FIELDS,
  examples: [],
  headerMap: Object.fromEntries(LETTERS_FIELDS.map((f) => [f.header, f.key])),
  bulkInsert: false,
  validateRow(values, ctx, seen) {
    const { parsed, issues } = parseLetterRow(values, ctx);

    if (parsed.reference_number) {
      const normalized = normalizeValue(parsed.reference_number);
      if (ctx.existingLetterRefs.has(normalized)) {
        issues.push(
          issue("reference_number", `Nomor referensi "${parsed.reference_number}" sudah digunakan.`)
        );
      } else if (seen.letterRefs.has(normalized)) {
        issues.push(
          issue(
            "reference_number",
            `Nomor referensi "${parsed.reference_number}" duplikat di dalam file ini.`
          )
        );
      } else {
        seen.letterRefs.add(normalized);
      }
    }

    if (parsed.title && parsed.date_received_sent) {
      const signature = `${parsed.date_received_sent}|${normalizeValue(parsed.title)}`;
      if (seen.signature.has(signature)) {
        issues.push(issue(null, "Surat dengan tanggal dan judul sama sudah ada di dalam file ini."));
      } else {
        seen.signature.add(signature);
      }
    }

    return issues;
  },
  toRecord(values, ctx) {
    const { parsed } = parseLetterRow(values, ctx);
    return parsed as unknown as Record<string, unknown>;
  },
};

// ===========================================================================
// Pencocokan periode serti jab (dipakai Keuangan & Persuratan)
// ===========================================================================

function matchHandover(
  values: Record<string, string>,
  ctx: ImportContext
): { id: string | null; issues: ImportRowIssue[] } {
  const raw = values.handover?.trim() ?? "";
  if (raw === "") return { id: null, issues: [] };
  if (ctx.handovers.length === 0) {
    return {
      id: null,
      issues: [issue("handover", "Periode serti jab tidak ditemukan (belum ada data periode).")],
    };
  }

  const normalized = normalizeValue(raw).replace(/[^a-z0-9]+/g, "");
  for (const handover of ctx.handovers) {
    const candidates = [handover.label, ...handover.aliases];
    if (candidates.some((c) => normalizeValue(c).replace(/[^a-z0-9]+/g, "") === normalized)) {
      return { id: handover.id, issues: [] };
    }
  }

  return {
    id: null,
    issues: [
      issue(
        "handover",
        `Periode serti jab "${raw}" tidak ditemukan. Pilihan: ${ctx.handovers
          .slice(0, 6)
          .map((h) => h.label)
          .join(", ")}${ctx.handovers.length > 6 ? ", ..." : ""}.`
      ),
    ],
  };
}

// ===========================================================================
// Registry
// ===========================================================================

export const IMPORT_SPECS: Record<ImportModuleKey, ImportModuleSpec> = {
  members: MEMBERS_SPEC,
  finances: FINANCES_SPEC,
  inventory: INVENTORY_SPEC,
  letters: LETTERS_SPEC,
};

export const IMPORT_MODULE_KEYS = Object.keys(IMPORT_SPECS) as ImportModuleKey[];

export function getImportSpec(module: string): ImportModuleSpec | null {
  return IMPORT_SPECS[module as ImportModuleKey] ?? null;
}

/** Baris contoh untuk template (isi kolom yang wajib diisi). */
export function buildTemplateRows(spec: ImportModuleSpec): string[][] {
  const rows: string[][] = [spec.fields.map((field) => field.example ?? "")];
  for (const example of spec.examples) {
    rows.push(spec.fields.map((field) => example[field.key] ?? ""));
  }
  return rows;
}