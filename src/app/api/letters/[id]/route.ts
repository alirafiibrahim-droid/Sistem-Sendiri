import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiUnauthorized,
  apiNotFound,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireAccess } from "@/lib/access";
import { letterFormSchema } from "@/lib/validations/letter";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { attachHandovers } from "@/lib/handover";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";
import type { LetterWithCreator, Profile } from "@/lib/types/database";

async function attachProfiles(
  letters: LetterWithCreator[],
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>
): Promise<LetterWithCreator[]> {
  const userIds = [
    ...new Set(letters.map((l) => l.created_by).filter(Boolean) as string[]),
  ];
  if (userIds.length === 0) return letters;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles || []).map((p: Pick<Profile, "id" | "full_name">) => [p.id, p])
  );

  return letters.map((l) => ({
    ...l,
    profiles: l.created_by ? profileMap.get(l.created_by) || null : null,
  }));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServer();
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const forbidden = requireAccess(role, "letters-detail", "read");
    if (forbidden) return forbidden;

    const { id } = await params;

    const { data, error } = await supabase
      .from("letters")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      if (error) console.error("LETTERS GET ERROR:", error);
      return apiNotFound();
    }

    const result = (await attachProfiles([data as LetterWithCreator], supabase))[0];

    const [withPeriod] = await attachHandovers([result], createSupabaseAdmin());

    return apiOk(withPeriod);
  } catch (e) {
    console.error("LETTERS GET ERROR:", e);
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
    const forbidden = requireAccess(role, "letters", "update");
    if (forbidden) return forbidden;

    const { id } = await params;
    const body = await request.json();

    const parsed = letterFormSchema.partial().safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const { data: existing } = await supabase
      .from("letters")
      .select("id, type, title, sender, date_received_sent, classification")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound();

    const { data, error } = await supabase
      .from("letters")
      .update(parsed.data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("LETTERS PATCH ERROR:", error);
      return apiInternalError(error.message);
    }

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    const existingRow = existing as unknown as Record<string, unknown>;
    const updatedRow = data as unknown as Record<string, unknown>;
    for (const key of ["type", "title", "sender", "date_received_sent", "classification"]) {
      if (JSON.stringify(existingRow[key]) !== JSON.stringify(updatedRow[key])) {
        oldValue[key] = existingRow[key] ?? null;
        newValue[key] = updatedRow[key] ?? null;
      }
    }

    await writeAuditLog({
      action: "UPDATE",
      targetTable: "letters",
      targetId: id,
      userId: uid,
      oldValue: Object.keys(oldValue).length > 0 ? oldValue : null,
      newValue: Object.keys(newValue).length > 0 ? newValue : null,
    });

    const result = (await attachProfiles([data as LetterWithCreator], supabase))[0];

    return apiOk(result);
  } catch (e) {
    console.error("LETTERS PATCH ERROR:", e);
    return apiInternalError();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServer();
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const forbidden = requireAccess(role, "letters", "delete");
    if (forbidden) return forbidden;

    const { id } = await params;

    const { data: existing } = await supabase
      .from("letters")
      .select("id, type, reference_number, title, sender")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound();

    const { error } = await supabase.from("letters").delete().eq("id", id);

    if (error) {
      console.error("LETTERS DELETE ERROR:", error);
      return apiInternalError(error.message);
    }

    await writeAuditLog({
      action: "DELETE",
      targetTable: "letters",
      targetId: id,
      userId: uid,
      oldValue: {
        type: existing.type,
        reference_number: existing.reference_number,
        title: existing.title,
        sender: existing.sender,
      },
    });

    return apiOk({ message: "Letter deleted" });
  } catch (e) {
    console.error("LETTERS DELETE ERROR:", e);
    return apiInternalError();
  }
}
