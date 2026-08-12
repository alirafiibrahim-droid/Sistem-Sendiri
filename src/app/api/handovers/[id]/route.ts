import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  apiOk,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiBadRequest,
  apiConflict,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireAccess } from "@/lib/access";
import { handoverUpdateSchema } from "@/lib/validations/handover";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";
import type { HandoverWithCreator } from "@/lib/types/database";

async function attachProfile(
  handover: HandoverWithCreator | null,
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>
): Promise<HandoverWithCreator | null> {
  if (!handover || !handover.created_by) return handover;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", handover.created_by)
    .maybeSingle();

  return { ...handover, profiles: profile || null };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServer();
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { id } = await params;

    const { data, error } = await supabase
      .from("handovers")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return apiNotFound();

    return apiOk(await attachProfile(data as HandoverWithCreator, supabase));
  } catch {
    return apiInternalError();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServer();
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const forbidden = requireAccess(role, "handovers", "update");
    if (forbidden) return forbidden;

    const { id } = await params;
    const body = await request.json();

    const parsed = handoverUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const { data: existing } = await supabase
      .from("handovers")
      .select("id, status, document_url, period_to")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound();

    if (existing.status === "COMPLETED") {
      return apiForbidden(
        "Arsip Serah Terima Jabatan yang telah disahkan tidak dapat diubah kembali."
      );
    }

    const nextStatus = parsed.data.status ?? existing.status;

    if (parsed.data.period_to !== undefined && parsed.data.period_to !== existing.period_to) {
      const { data: rows } = await supabase
        .from("handovers")
        .select("id, period_from, period_to, status")
        .neq("id", id);

      const taken = (rows || []).some(
        (h) => h.period_to === parsed.data.period_to || h.period_from === parsed.data.period_to
      );
      if (taken) {
        return apiConflict(
          `Periode ${parsed.data.period_to} sudah terdaftar pada sertijab lain. Periode berjalan harus unik.`
        );
      }
    }

    if (nextStatus !== existing.status) {
      if (nextStatus === "COMPLETED" && existing.status !== "ONGOING") {
        return apiBadRequest(
          "Sertijab harus berstatus Berjalan (ONGOING) terlebih dahulu sebelum disahkan (COMPLETED)."
        );
      }
      if (nextStatus === "ONGOING" || nextStatus === "COMPLETED") {
        const docUrl = parsed.data.document_url ?? existing.document_url;
        if (!docUrl) {
          return apiBadRequest(
            `Dokumen Berita Acara wajib diunggah sebelum status berubah menjadi ${nextStatus}.`
          );
        }
      }
    }

    const updatePayload: Record<string, unknown> = {};
    if (parsed.data.period_from !== undefined) updatePayload.period_from = parsed.data.period_from;
    if (parsed.data.period_to !== undefined) updatePayload.period_to = parsed.data.period_to;
    if (parsed.data.handover_date !== undefined) updatePayload.handover_date = parsed.data.handover_date;
    if (parsed.data.document_url !== undefined) updatePayload.document_url = parsed.data.document_url;
    if (parsed.data.witnesses !== undefined) updatePayload.witnesses = parsed.data.witnesses;
    updatePayload.status = nextStatus;

    // Gunakan admin client untuk UPDATE agar transisi status -> COMPLETED
    // tidak terblokir oleh policy RLS "handovers_update_not_completed".
    // Otorisasi sudah divalidasi via requireAccess di atas.
    const db = nextStatus === "COMPLETED" ? createSupabaseAdmin() : supabase;

    const { data, error } = await db
      .from("handovers")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("HANDOVERS PATCH ERROR:", error);
      return apiInternalError(error.message);
    }

    // Saat periode Sertijab diselesaikan, semua Program Kerja pada periode
    // tersebut ikut diselesaikan (status COMPLETED) dan terkunci dari edit.
    if (nextStatus === "COMPLETED") {
      const { error: programError } = await createSupabaseAdmin()
        .from("programs")
        .update({ status: "COMPLETED" })
        .eq("handover_id", id);

      if (programError) {
        console.error("HANDOVERS COMPLETE PROGRAMS ERROR:", programError);
      }
    }

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    const existingRow = existing as unknown as Record<string, unknown>;
    const updatedRow = data as unknown as Record<string, unknown>;
    for (const key of ["status", "period_from", "period_to", "handover_date", "document_url"]) {
      if (JSON.stringify(existingRow[key]) !== JSON.stringify(updatedRow[key])) {
        oldValue[key] = existingRow[key] ?? null;
        newValue[key] = updatedRow[key] ?? null;
      }
    }

    await writeAuditLog({
      action: "UPDATE",
      targetTable: "handovers",
      targetId: id,
      userId: uid,
      oldValue: Object.keys(oldValue).length > 0 ? oldValue : null,
      newValue: Object.keys(newValue).length > 0 ? newValue : null,
    });

    return apiOk(await attachProfile(data as HandoverWithCreator, supabase));
  } catch (e) {
    console.error("HANDOVERS PATCH ERROR:", e);
    return apiInternalError();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServer();
    const uid = await getUid(request);
    if (!uid) return apiUnauthorized();

    const role = await getUserRole(request);
    const forbidden = requireAccess(role, "handovers", "delete");
    if (forbidden) return forbidden;

    const { id } = await params;

    const { data: existing } = await supabase
      .from("handovers")
      .select("id, period_from, period_to, status")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound();

    const { error } = await supabase.from("handovers").delete().eq("id", id);

    if (error) return apiInternalError();

    await writeAuditLog({
      action: "DELETE",
      targetTable: "handovers",
      targetId: id,
      userId: uid,
      oldValue: {
        period_from: existing.period_from,
        period_to: existing.period_to,
        status: existing.status,
      },
    });

    return apiOk({ message: "Handover deleted" });
  } catch {
    return apiInternalError();
  }
}
