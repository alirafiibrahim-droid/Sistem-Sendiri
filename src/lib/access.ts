// ============================================================================
// SIORG Access Matrix (Hak Akses berdasarkan Role)
// Berdasarkan file "SIORG Hak Akses.xlsx" (13 sheet) + aturan khusus modul
// Keuangan. ADMIN selalu dianggap memiliki akses penuh (konvensi existing).
// ============================================================================

import { apiForbidden } from "./api-response";
import type { AppRole } from "./authz";

export type AccessAction = "read" | "create" | "update" | "delete";

export type AccessModule =
  | "dashboard"
  | "programs"
  | "members"
  | "attendance"
  | "trainings"
  | "training-sessions"
  | "athlete-performance"
  | "achievements"
  | "achievements-verify"
  | "inventory"
  | "inventory-add"
  | "inventory-dispose"
  | "inventory-loan"
  | "letters"
  | "handovers"
  | "projects"
  | "reports"
  | "audit-logs"
  | "settings"
  | "settings-user"
  | "settings-organization"
  | "settings-divisions"
  | "settings-fakultas-jurusan"
  |   "settings-cash-bank"
  | "settings-wallets"
  | "finances"
  // Fitur "Lihat Detail" per modul (baris 'Lihat Detail' pada file Hak Akses)
  | "programs-detail"
  | "members-detail"
  | "athletics-detail"
  | "achievements-detail"
  | "letters-detail"
  | "projects-detail"
  | "finances-detail";

interface AccessRule {
  read: AppRole[];
  create: AppRole[];
  update: AppRole[];
  delete: AppRole[];
}

const ALL_ROLES: AppRole[] = [
  "ADMIN",
  "KETUA_UMUM",
  "WAKIL_KETUA",
  "PENGURUS_INTI",
  "SEKRETARIS",
  "BENDAHARA",
  "KABID",
  "PELATIH",
  "PEMBINA",
  "ANGGOTA",
];

const rule = (read: AppRole[], create: AppRole[], update: AppRole[], deleteRole: AppRole[]): AccessRule => ({
  read,
  create,
  update,
  delete: deleteRole,
});

// Untuk modul dengan hak "baca semua", READ_DEFAULT = semua role.
const READ_ALL = ALL_ROLES;

export const ACCESS_RULES: Record<AccessModule, AccessRule> = {
  // Sheet 1: Dashboard (Filter, Search)
  dashboard: rule(READ_ALL, [], ["ADMIN", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"], []),

  // Sheet 2: Program kerja (Tambah Data, Lihat Detail + Filter, Search)
  programs: rule(
    READ_ALL,
    ["ADMIN", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "BENDAHARA", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"]
  ),

  // Sheet 3: Anggota (sama dengan Program kerja)
  members: rule(
    READ_ALL,
    ["ADMIN", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "BENDAHARA", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"]
  ),

  // Sheet 4: Absensi (Catat Kehadiran = semua role)
  attendance: rule(
    READ_ALL,
    READ_ALL,
    ["ADMIN", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    []
  ),

  // Sheet 5: Keatletan (Latihan)
  trainings: rule(
    ["ADMIN", "PELATIH", "BENDAHARA", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "PELATIH"],
    ["ADMIN", "PELATIH"],
    ["ADMIN", "PELATIH"]
  ),

  // Sheet 5: Keatletan (Sesi Latihan)
  "training-sessions": rule(
    READ_ALL,
    ["ADMIN", "PELATIH", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "PELATIH", "PENGURUS_INTI", "KETUA_UMUM"],
    ["ADMIN", "PELATIH", "PENGURUS_INTI", "KETUA_UMUM"]
  ),

  // Sheet 5: Keatletan (Matrik Performa -> Pilih Atlet)
  "athlete-performance": rule(READ_ALL, [], READ_ALL, []),

  // Sheet 6: Prestasi (Tambah Data + Verifikasi Prestasi)
  achievements: rule(
    READ_ALL,
    ["ADMIN", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"]
  ),
  "achievements-verify": rule(
    READ_ALL,
    ["ADMIN", "PEMBINA", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "PEMBINA", "WAKIL_KETUA", "KETUA_UMUM"],
    []
  ),

  // Sheet 7: Inventaris (Tambah Barang Baru)
  "inventory-add": rule(
    READ_ALL,
    ["ADMIN", "BENDAHARA", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "BENDAHARA", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "BENDAHARA", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"]
  ),

  // Sheet 7: Inventaris (Hapus Inventaris)
  "inventory-dispose": rule(
    READ_ALL,
    ["ADMIN", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"]
  ),

  // Sheet 7: Inventaris (Pinjam Barang)
  "inventory-loan": rule(
    READ_ALL,
    ["ADMIN", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"]
  ),

  // Module Inventaris aggregate (untuk sidebar): baca semua role
  inventory: rule(READ_ALL, [], [], []),

  // Sheet 8: Persuratan (Tambah Data)
  letters: rule(
    READ_ALL,
    ["ADMIN", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"]
  ),

  // Sheet 9: Sertijab (Tambah Data)
  handovers: rule(
    READ_ALL,
    ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"]
  ),

  // Sheet 10: Proyek Insidental (Tambah Data)
  projects: rule(
    READ_ALL,
    ["ADMIN", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"]
  ),

  // Sheet 11: Laporan (Akses, Print dan Unduh) — semua kecuali Anggota
  reports: rule(
    ["ADMIN", "KETUA_UMUM", "WAKIL_KETUA", "PENGURUS_INTI", "SEKRETARIS", "BENDAHARA", "KABID", "PELATIH", "PEMBINA"],
    ["ADMIN", "KETUA_UMUM", "WAKIL_KETUA", "PENGURUS_INTI", "SEKRETARIS", "BENDAHARA", "KABID", "PELATIH", "PEMBINA"],
    ["ADMIN", "KETUA_UMUM", "WAKIL_KETUA", "PENGURUS_INTI", "SEKRETARIS", "BENDAHARA", "KABID", "PELATIH", "PEMBINA"],
    []
  ),

  // Sheet 12: Audit Trail (Filter) — hanya Admin, Wakil Ketua, Ketua Umum
  "audit-logs": rule(
    ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"],
    [],
    ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"],
    []
  ),

  // Sheet 13: Pengaturan — Profile Saya (semua role)
  settings: rule(READ_ALL, [], READ_ALL, []),

  // Sheet 13: Pengaturan — Pengaturan User (hanya Admin)
  "settings-user": rule(["ADMIN"], ["ADMIN"], ["ADMIN"], []),

  // Sheet 13: Pengaturan — Organisasi
  "settings-organization": rule(
    ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"],
    []
  ),

  // Sheet 13: Pengaturan — Divisi
  "settings-divisions": rule(
    ["ADMIN", "BENDAHARA", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "BENDAHARA", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"]
  ),

  // Sheet 13: Pengaturan — Fakultas & Jurusan
  "settings-fakultas-jurusan": rule(
    ["ADMIN", "BENDAHARA", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "BENDAHARA", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"]
  ),

  // Sheet 13: Pengaturan — Kas & Bank
  "settings-cash-bank": rule(
    ["ADMIN", "BENDAHARA", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "BENDAHARA", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"]
  ),

  // Sheet 13: Pengaturan — Dompet
  "settings-wallets": rule(
    ["ADMIN", "BENDAHARA", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "BENDAHARA", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"]
  ),

  // Modul Keuangan (aturan khusus dari user)
  finances: rule(
    ["ADMIN", "KETUA_UMUM", "WAKIL_KETUA", "PENGURUS_INTI", "BENDAHARA", "SEKRETARIS"],
    ["ADMIN", "BENDAHARA"],
    ["ADMIN", "BENDAHARA", "SEKRETARIS", "KETUA_UMUM", "WAKIL_KETUA"],
    ["ADMIN", "BENDAHARA", "KETUA_UMUM", "WAKIL_KETUA"]
  ),

  // ==========================================================================
  // Fitur "Lihat Detail" (baris 'Lihat Detail' pada file SIORG Hak Akses.xlsx)
  // Read = siapa yang boleh membuka halaman/detail sebuah record.
  // ==========================================================================

  // Sheet 2: Program kerja — Lihat Detail
  "programs-detail": rule(
    ["ADMIN", "BENDAHARA", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "KABID", "BENDAHARA", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"]
  ),

  // Sheet 3: Anggota — Lihat Detail
  "members-detail": rule(
    ["ADMIN", "BENDAHARA", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "KABID", "BENDAHARA", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"]
  ),

  // Sheet 5: Keatletan — Lihat Detail
  "athletics-detail": rule(
    ["ADMIN", "BENDAHARA", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    [],
    ["ADMIN", "BENDAHARA", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    []
  ),

  // Sheet 6: Prestasi — Lihat Detail
  "achievements-detail": rule(
    ["ADMIN", "PEMBINA", "BENDAHARA", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "PEMBINA", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "PEMBINA", "WAKIL_KETUA", "KETUA_UMUM"],
    []
  ),

  // Sheet 8: Persuratan — Lihat Detail
  "letters-detail": rule(
    ["ADMIN", "BENDAHARA", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"]
  ),

  // Sheet 10: Proyek Insidental — Lihat Detail
  "projects-detail": rule(
    ["ADMIN", "BENDAHARA", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"]
  ),

  // Sheet 13: Pengaturan (Kas & Bank / Dompet) — Lihat Detail
  "finances-detail": rule(
    ["ADMIN", "BENDAHARA", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "BENDAHARA", "SEKRETARIS", "PENGURUS_INTI", "WAKIL_KETUA", "KETUA_UMUM"],
    ["ADMIN", "WAKIL_KETUA", "KETUA_UMUM"]
  ),
};

/**
 * Returns true if the given role is allowed to perform `action` on `module`.
 * ADMIN always has full access (except where the rule explicitly blocks —
 * ADMIN is always treated as allowed).
 */
export function canAccess(
  userRole: string | null,
  module: AccessModule,
  action: AccessAction
): boolean {
  if (!userRole) return false;
  if (userRole === "ADMIN") return true;
  const ruleForModule = ACCESS_RULES[module];
  if (!ruleForModule) return false;
  return ruleForModule[action].includes(userRole as AppRole);
}

/**
 * Returns a 403 Forbidden response if the user's role is not allowed to
 * perform `action` on `module`. Returns null if allowed.
 * Use this in API route handlers.
 */
export function requireAccess(
  userRole: string | null,
  module: AccessModule,
  action: AccessAction,
  message?: string
): Response | null {
  if (!canAccess(userRole, module, action)) {
    return apiForbidden(message);
  }
  return null;
}
