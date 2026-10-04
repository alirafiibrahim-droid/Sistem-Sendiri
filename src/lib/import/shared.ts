// ============================================================================
// SIORG Import — Value Parsers & Normalizers
// Helper tervalidasi ulang (server) sehingga hasil screening client dan server
// selalu identik. Semua input sudah berupa string mentah dari CSV.
// ============================================================================

/** Buang spasi, normalisasi huruf, ubah non-alnum menjadi spasi. */
export function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalisasi nilai sel sebelum dicocokkan ke enum/lookup. */
export function normalizeValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------
//Nominal (Rupiah)
// ---------------------------------------------------------------------------

/**
 * Parse nominal Indonesia.
 * Didukung: "1500000", "1.500.000", "1.500.000,50", "1500000.50",
 * "Rp 1.500.000", "1,5 juta" -> ditolak (return null) karena ambigu.
 * Return null bila bukan angka valid.
 */
export function parseAmount(value: string): number | null {
  let raw = value.trim();
  if (raw === "") return null;

  raw = raw.replace(/^(rp|idr)\s*/i, "");

  let sign = 1;
  if (/^\(.*\)$/.test(raw)) {
    // Notasi akuntansi: (1.500.000) berarti -1.500.000
    raw = raw.slice(1, -1);
    sign = -1;
  } else if (raw.startsWith("-")) {
    sign = -1;
    raw = raw.slice(1);
  }

  raw = raw.replace(/\s/g, "");
  if (raw === "") return null;

  let normalized: string;
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(raw)) {
    // 1.500.000,50 -> kelompok ribuan + desimal koma
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    // 1.500.000 -> kelompok ribuan tanpa desimal
    normalized = raw.replace(/\./g, "");
  } else if (/^\d+,\d+$/.test(raw)) {
    // 1500000,50 -> desimal koma
    normalized = raw.replace(",", ".");
  } else if (/^\d+(\.\d+)?$/.test(raw)) {
    normalized = raw;
  } else {
    return null;
  }

  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  return sign * num;
}

// ---------------------------------------------------------------------------
// Tanggal
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  // Bahasa Indonesia
  januari: 1, jan: 1, january: 1,
  februari: 2, feb: 2, febr: 2, february: 2, pebruari: 2,
  maret: 3, mar: 3, march: 3,
  april: 4, apr: 4,
  mei: 5, may: 5,
  juni: 6, jun: 6, june: 6,
  juli: 7, jul: 7, july: 7,
  agustus: 8, agu: 8, ags: 8, aug: 8, august: 8,
  september: 9, sep: 9, sept: 9,
  oktober: 10, okt: 10, oct: 10, october: 10,
  november: 11, nov: 11, nopember: 11,
  desember: 12, des: 12, dec: 12, december: 12,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function pad(value: number, size = 2): string {
  return String(value).padStart(size, "0");
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  if (year < 1900 || year > 2200) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * Parse tanggal Indonesia menjadi "YYYY-MM-DD".
 * Didukung: 2024-09-01, 01/09/2024, 1-9-2024, 1 Sep 2024, 01 September 2024,
 * 2024/09/01. Return null bila tidak dikenali.
 */
export function parseDate(value: string): string | null {
  let raw = value.trim();
  if (raw === "") return null;

  // Buang label waktu jika ikut terbawa dari Excel ("2024-09-01 00:00:00")
  raw = raw.replace(/\s+\d{1,2}:\d{2}(:\d{2})?(\.\d+)?\s*$/, "").trim();
  if (raw === "") return null;

  const numeric = raw.match(/^(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4})$/);
  if (numeric) {
    const a = Number(numeric[1]);
    const b = Number(numeric[2]);
    const c = Number(numeric[3]);

    // YYYY-MM-DD / YYYY/MM/DD
    if (numeric[1].length === 4) {
      return isValidYmd(a, b, c) ? `${a}-${pad(b)}-${pad(c)}` : null;
    }
    // DD-MM-YYYY / DD/MM/YYYY -> gaya Indonesia (hari lebih dulu)
    if (c >= 100) {
      return isValidYmd(c, b, a) ? `${c}-${pad(b)}-${pad(a)}` : null;
    }
    // MM/DD/YYYY (gaya AS)
    return isValidYmd(c, a, b) ? `${c}-${pad(a)}-${pad(b)}` : null;
  }

  const words = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (words) {
    const day = Number(words[1]);
    const month = MONTHS[normalizeValue(words[2])];
    const year = Number(words[3]);
    if (month && isValidYmd(year, month, day)) {
      return `${year}-${pad(month)}-${pad(day)}`;
    }
    return null;
  }

  // "2024-09" -> awal bulan
  const monthOnly = raw.match(/^(\d{4})[/.\-](\d{1,2})$/);
  if (monthOnly) {
    const year = Number(monthOnly[1]);
    const month = Number(monthOnly[2]);
    if (isValidYmd(year, month, 1)) return `${year}-${pad(month)}-01`;
  }

  return null;
}

/** Hitung selisih hari kalender; dipakai untuk membatasi tanggal masa depan. */
export function daysFromToday(date: string): number {
  const target = new Date(`${date}T00:00:00Z`).getTime();
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / DAY_MS);
}

/** Tanggal hari ini dalam format "YYYY-MM-DD". */
export function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// ---------------------------------------------------------------------------
// Pencocokan enum & lookup
// ---------------------------------------------------------------------------

export interface EnumEntry {
  value: string;
  label: string;
  aliases?: string[];
}

export interface EnumMatch<T extends string> {
  ok: boolean;
  value?: T;
  message?: string;
}

/**
 * Cocokkan input user (label Indonesia, alias, atau nilai enum) ke nilai enum.
 */
export function matchEnum<T extends string>(
  input: string,
  entries: readonly EnumEntry[]
): EnumMatch<T> {
  const normalized = normalizeValue(input);
  if (normalized === "") return { ok: false };

  for (const entry of entries) {
    const candidates = [entry.value, entry.label, ...(entry.aliases ?? [])];
    if (candidates.some((c) => normalizeValue(c) === normalized)) {
      return { ok: true, value: entry.value as T };
    }
  }
  return {
    ok: false,
    message: `Nilai tidak dikenal. Pilihan yang tersedia: ${entries
      .map((e) => e.label)
      .join(", ")}.`,
  };
}

/**
 * Cocokkan input user ke daftar lookup (mis. nama divisi/fakultas/program).
 * Pencocokan insensitive-spasi: "divisi it" tetap cocok dengan "Divisi IT".
 */
export function matchLookup<T extends { id: string; name: string }>(
  input: string,
  items: readonly T[],
  label: string
): { ok: boolean; item?: T; message?: string } {
  const normalized = normalizeValue(input);
  if (normalized === "") return { ok: false };

  const compact = (value: string) => normalizeValue(value).replace(/\s+/g, "");
  const aliasesOf = (item: T): string[] => {
    const record = item as { name: string; aliases?: string[] };
    return [record.name, ...(record.aliases ?? [])];
  };

  for (const item of items) {
    if (aliasesOf(item).some((c) => normalizeValue(c) === normalized)) {
      return { ok: true, item };
    }
  }
  for (const item of items) {
    if (aliasesOf(item).some((c) => compact(c) === compact(normalized))) {
      return { ok: true, item };
    }
  }

  const available = items.slice(0, 8).map((i) => i.name);
  const suffix = items.length > 8 ? ", ..." : "";
  return {
    ok: false,
    message: `${label} tidak ditemukan. Pilihan yang tersedia: ${
      available.join(", ") || "(belum ada data)"
    }${suffix}.`,
  };
}

/** Validasi format email sederhana. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** Validasi nomor telepon Indonesia (digit, spasi, +, -, tanda kurung). */
export function normalizePhone(value: string): string {
  const cleaned = value.trim().replace(/[\s\-().]/g, "");
  if (cleaned === "") return "";
  return /^\+?[0-9]{8,15}$/.test(cleaned) ? cleaned : "";
}

/** Validasi URL http/https. */
export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}