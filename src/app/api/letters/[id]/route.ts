import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { isAdmin, requireRole } from "@/lib/authz";
import { letterFormSchema } from "@/lib/validations/letter";
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

    return apiOk(result);
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
    const forbidden = requireRole(role, ["PENGURUS_INTI", "KABID"]);
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
      .select("id")
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
    if (!isAdmin(role)) return apiForbidden();

    const { id } = await params;

    const { data: existing } = await supabase
      .from("letters")
      .select("id")
      .eq("id", id)
      .single();

    if (!existing) return apiNotFound();

    const { error } = await supabase.from("letters").delete().eq("id", id);

    if (error) {
      console.error("LETTERS DELETE ERROR:", error);
      return apiInternalError(error.message);
    }

    return apiOk({ message: "Letter deleted" });
  } catch (e) {
    console.error("LETTERS DELETE ERROR:", e);
    return apiInternalError();
  }
}
