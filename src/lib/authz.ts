// ============================================================================
// SIORG Authorization Module
// Centralized role-based access control helpers.
// ADMIN = full access to all features. Other roles have graduated access.
// ============================================================================

import { apiForbidden } from "./api-response";

export type AppRole = "ADMIN" | "KETUA_UMUM" | "WAKIL_KETUA" | "PENGURUS_INTI" | "SEKRETARIS" | "BENDAHARA" | "KABID" | "PELATIH" | "PEMBINA" | "ANGGOTA";

/**
 * Role hierarchy levels: higher number = more privileges.
 */
export const ROLE_LEVEL: Record<AppRole, number> = {
  ADMIN: 100,
  KETUA_UMUM: 90,
  WAKIL_KETUA: 80,
  PENGURUS_INTI: 70,
  SEKRETARIS: 65,
  BENDAHARA: 65,
  KABID: 50,
  PEMBINA: 45,
  PELATIH: 40,
  ANGGOTA: 10,
};

/**
 * Returns true if the given role is ADMIN.
 */
export function isAdmin(role: string | null): boolean {
  return role === "ADMIN";
}

/**
 * Returns true if the user's role meets or exceeds the required level.
 * Always returns true for ADMIN regardless of requiredRole.
 */
export function hasMinRole(
  userRole: string | null,
  requiredRole: AppRole
): boolean {
  if (!userRole) return false;
  const userLevel = ROLE_LEVEL[userRole as AppRole] ?? 0;
  const reqLevel = ROLE_LEVEL[requiredRole];
  return userLevel >= reqLevel;
}

/**
 * Returns true if the user's role is in the allowed list.
 * ADMIN is always allowed regardless of the list.
 */
export function isRoleAllowed(
  userRole: string | null,
  allowedRoles: AppRole[]
): boolean {
  if (!userRole) return false;
  if (userRole === "ADMIN") return true;
  return allowedRoles.includes(userRole as AppRole);
}

/**
 * Returns a 403 Forbidden response if the user's role is not allowed.
 * ADMIN is always allowed.
 * Use this in API route handlers.
 */
export function requireRole(
  userRole: string | null,
  allowedRoles: AppRole[],
  message?: string
): Response | null {
  if (!userRole) return apiForbidden("Anda belum login.");
  if (userRole === "ADMIN") return null;
  if (!allowedRoles.includes(userRole as AppRole)) {
    return apiForbidden(message);
  }
  return null;
}

/**
 * Returns a 403 Forbidden response if the user does not meet the minimum role level.
 * ADMIN always passes.
 */
export function requireMinRole(
  userRole: string | null,
  minRole: AppRole,
  message?: string
): Response | null {
  if (!userRole) return apiForbidden("Anda belum login.");
  if (userRole === "ADMIN") return null;
  if (!hasMinRole(userRole, minRole)) {
    return apiForbidden(message);
  }
  return null;
}
