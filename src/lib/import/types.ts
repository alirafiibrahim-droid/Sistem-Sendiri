// ============================================================================
// SIORG Import — Shared Types
// ============================================================================

import type { AccessModule } from "@/lib/access";

export type ImportModuleKey = "members" | "finances" | "inventory" | "letters";

export interface ImportField {
  /** Key internal field, dipakai sebagai kolom pada baris hasil parse. */
  key: string;
  /** Header kolom pada file CSV (bahasa Indonesia). */
  header: string;
  required: boolean;
  /** Nilai contoh pada template. */
  example: string;
  /** Penjelasan format/nilai yang diizinkan. */
  hint?: string;
}

export interface ImportRowIssue {
  /** Key field yang bermasalah, atau null bila masalahnya menyangkut seluruh baris. */
  field: string | null;
  message: string;
}

export interface ImportScreeningRow {
  /** Nomor baris pada file CSV (baris header = 1). */
  line: number;
  /** Nilai mentah per field sesuai file CSV. */
  values: Record<string, string>;
  issues: ImportRowIssue[];
  valid: boolean;
}

export interface ImportScreening {
  module: ImportModuleKey;
  /** Jumlah baris data (tidak termasuk header). */
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ImportScreeningRow[];
  /** Masalah tingkat file: header salah, file kosong, kelebihan baris, dll. */
  fileErrors: string[];
  /** Header yang tidak dikenali (diabaikan, tidak membuat baris gagal). */
  unknownHeaders: string[];
}

export interface ImportCommitFailure {
  line: number;
  message: string;
}

export interface ImportCommitResult {
  module: ImportModuleKey;
  created: number;
  failures: ImportCommitFailure[];
}

/**
 * Data referensi yang dibutuhkan validator. Berisi plain object hasil query
 * Supabase agar definisi modul tetap aman diimport dari client component.
 */
export interface NamedLookup {
  id: string;
  name: string;
  /** Label alternatif yang juga diterima di CSV. */
  aliases?: string[];
}

export interface ImportContext {
  divisions: NamedLookup[];
  fakultas: NamedLookup[];
  jurusan: NamedLookup[];
  programs: NamedLookup[];
  projects: NamedLookup[];
  wallets: NamedLookup[];
  banks: NamedLookup[];
  cashAccounts: NamedLookup[];
  handovers: ImportHandoverLookup[];
  /** NIM yang sudah terdaftar. */
  existingNims: Set<string>;
  /** Email yang sudah terdaftar. */
  existingEmails: Set<string>;
  /** Nomor referensi surat yang sudah terdaftar. */
  existingLetterRefs: Set<string>;
}

export interface ImportHandoverLookup {
  id: string;
  period_from: string;
  period_to: string;
  label: string;
  aliases: string[];
}

/**
 * Spec satu modul impor: definisi kolom template + aturan validasi baris.
 * `toRecord` mengubah nilai CSV menjadi payload insert (dipanggil server).
 */
export interface ImportModuleSpec {
  key: ImportModuleKey;
  label: string;
  singular: string;
  /** Modul pada access matrix yang mengatur izin impor. */
  accessModule: AccessModule;
  filename: string;
  fields: ImportField[];
  /** Baris contoh tambahan pada template. */
  examples: Record<string, string>[];
  /** Header modul ini (dipakai untuk konteks pesan error). */
  headerMap: Record<string, string>;
  /**
   * Validasi 1 baris. `seen` berisi nilai yang sudah dipakai baris sebelumnya
   * pada file yang sama, untuk mendeteksi duplikasi di dalam file.
   */
  validateRow(
    values: Record<string, string>,
    ctx: ImportContext,
    seen: ImportSeenState
  ): ImportRowIssue[];
  /** Ubah nilai CSV menjadi payload siap simpan. Dipanggil hanya saat commit. */
  toRecord(values: Record<string, string>, ctx: ImportContext): Record<string, unknown>;
  /** Apakah insert boleh dilakukan sekaligus (bulk) atau per baris. */
  bulkInsert: boolean;
}

export interface ImportSeenState {
  nims: Set<string>;
  emails: Set<string>;
  letterRefs: Set<string>;
  signature: Set<string>;
}

export function createSeenState(): ImportSeenState {
  return {
    nims: new Set(),
    emails: new Set(),
    letterRefs: new Set(),
    signature: new Set(),
  };
}