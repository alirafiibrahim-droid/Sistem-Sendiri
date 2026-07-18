import { NextResponse } from "next/server";
import type { ApiMeta } from "@/lib/types/api";

// ============================================================================
// SIORG API Response Helpers
// Standardized NextResponse wrappers for consistent JSON output
// ============================================================================

function buildResponse<T>(body: T, status: number) {
  return NextResponse.json(body, { status });
}

// --- Success Responses ---

export function apiOk<T>(data: T, meta?: ApiMeta) {
  return buildResponse(
    { success: true as const, data, ...(meta ? { meta } : {}) },
    200
  );
}

export function apiCreated<T>(data: T) {
  return buildResponse({ success: true as const, data }, 201);
}

export function apiNoContent() {
  return new NextResponse(null, { status: 204 });
}

// --- Error Responses ---

export function apiBadRequest(message: string, details?: unknown) {
  return buildResponse(
    {
      success: false as const,
      error: { code: "BAD_REQUEST", message, details },
    },
    400
  );
}

export function apiUnauthorized(message = "Unauthorized. Silakan login terlebih dahulu.") {
  return buildResponse(
    {
      success: false as const,
      error: { code: "UNAUTHORIZED", message },
    },
    401
  );
}

export function apiForbidden(message = "Anda tidak memiliki akses untuk melakukan operasi ini.") {
  return buildResponse(
    {
      success: false as const,
      error: { code: "FORBIDDEN", message },
    },
    403
  );
}

export function apiNotFound(resource = "Data") {
  return buildResponse(
    {
      success: false as const,
      error: { code: "NOT_FOUND", message: `${resource} tidak ditemukan.` },
    },
    404
  );
}

export function apiConflict(message: string) {
  return buildResponse(
    {
      success: false as const,
      error: { code: "CONFLICT", message },
    },
    409
  );
}

export function apiInternalError(message = "Terjadi kesalahan internal server.") {
  return buildResponse(
    {
      success: false as const,
      error: { code: "INTERNAL_ERROR", message },
    },
    500
  );
}

// --- Helper: Extract user from request ---
// The middleware should have already validated the session
export function getUid(request: Request): string | null {
  return request.headers.get("x-user-id");
}

export function getUserRole(request: Request): string | null {
  return request.headers.get("x-user-role");
}
