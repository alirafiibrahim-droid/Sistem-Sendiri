// ============================================================================
// SIORG CSV Utilities
// Parser & generator CSV kompatibel RFC 4180 tanpa dependency eksternal.
// Menangani: BOM, delimiter (, ; tab |), tanda kutip, tanda kutip terbalik (""),
// baris baru di dalam sel, dan CRLF. Scanner Excel Indonesia juga memakai
// pemisah koma desimal (contoh: 1.500.000,50) — lihat parseAmount().
// ============================================================================

export interface ParsedCsv {
  /** Baris hasil parse, termasuk baris header pada indeks 0. */
  rows: string[][];
  /** Nomor baris fisik (1-based) tempat tiap baris dimulai. */
  startLines: number[];
}

const DELIMITER_CANDIDATES = [",", ";", "\t", "|"] as const;

/**
 * Menebak delimiter berdasarkan 5 baris pertama di luar area kutip.
 * Default koma bila tidak ada kandidat yang muncul.
 */
function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0, "|": 0 };
  let inQuotes = false;
  let newlines = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (ch === "\n") {
      newlines++;
      if (newlines >= 5) break;
      continue;
    }
    if (ch in counts) counts[ch]++;
  }

  let best = ",";
  let bestCount = 0;
  for (const candidate of DELIMITER_CANDIDATES) {
    if (counts[candidate] > bestCount) {
      bestCount = counts[candidate];
      best = candidate;
    }
  }
  return best;
}

/**
 * Parse teks CSV menjadi matriks sel + nomor baris fisik tiap record.
 * `delimiter` opsional; bila diisi, deteksi otomatis dilewati.
 */
export function parseCsv(input: string, delimiter?: string): ParsedCsv {
  const text = input.replace(/^﻿/, "");
  const delim = delimiter ?? detectDelimiter(text);

  const rows: string[][] = [];
  const startLines: number[] = [];

  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };

  const endRow = () => {
    endField();
    rows.push(row);
    startLines.push(rowStartLine);
    row = [];
    rowStartLine = line;
  };

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      if (ch === "\r") {
        if (text[i + 1] === "\n") i++;
        field += "\n";
        line++;
        i++;
        continue;
      }
      if (ch === "\n") {
        field += "\n";
        line++;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    // Kutip pembuka hanya valid bila sel masih kosong (mis. `,"abc"`)
    if (ch === '"' && field.trim() === "") {
      field = "";
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delim) {
      endField();
      i++;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      line++;
      endRow();
      i++;
      continue;
    }

    field += ch;
    i++;
  }

  if (field !== "" || row.length > 0) endRow();

  return { rows, startLines };
}

const NEEDS_QUOTE = /[",\r\n]/;

function escapeCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return NEEDS_QUOTE.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Membangun teks CSV (delimiter koma, line ending CRLF) dari header + baris.
 */
export function buildCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | number | null | undefined)[])[]
): string {
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) lines.push(row.map(escapeCell).join(","));
  return lines.join("\r\n") + "\r\n";
}

/** Memicu dialog unduh file CSV di browser. */
export function downloadCsvFile(filename: string, content: string): void {
  // BOM supaya Excel membaca file sebagai UTF-8 (huruf/emoji tidak rusak)
  const blob = new Blob(["﻿" + content], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}