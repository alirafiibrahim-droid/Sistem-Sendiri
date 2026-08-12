import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// Alfabet tanpa karakter ambigu (I, L, O, 0, 1) agar mudah dibaca/diucapkan
export const SESSION_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const SESSION_CODE_LENGTH = 7;
export const SESSION_CODE_PATTERN = /^[A-Z0-9]{7}$/;

export type SessionCodeTable =
  | "program_sessions"
  | "training_sessions"
  | "project_sessions";

export function generateSessionCode(): string {
  let code = "";
  for (let i = 0; i < SESSION_CODE_LENGTH; i++) {
    code += SESSION_CODE_ALPHABET[randomInt(SESSION_CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeSessionCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isValidSessionCode(code: string): boolean {
  return SESSION_CODE_PATTERN.test(code);
}

// Generate N kode unik yang belum dipakai di tabel sesi terkait
export async function generateUniqueSessionCodes(
  supabase: SupabaseClient,
  table: SessionCodeTable,
  count: number
): Promise<string[]> {
  const codes = new Set<string>();
  while (codes.size < count) {
    const candidate = generateSessionCode();
    if (codes.has(candidate)) continue;

    const { data, error } = await supabase
      .from(table)
      .select("session_code")
      .eq("session_code", candidate)
      .maybeSingle();

    if (error || !data) codes.add(candidate);
  }
  return [...codes];
}
