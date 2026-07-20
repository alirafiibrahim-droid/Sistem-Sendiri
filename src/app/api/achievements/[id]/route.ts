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
import { isAdmin, isRoleAllowed } from "@/lib/authz";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("achievements")
      .select(
        "*, profiles(id, full_name), achievement_participants(*, profiles(id, full_name, nim, avatar_url))"
      )
      .eq("id", id)
      .single();

    if (error || !data) return apiNotFound();

    return apiOk(data);
  } catch (error) {
    return apiInternalError();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    const role = getUserRole(request);
    if (!uid) return apiUnauthorized();

    const { id } = await params;
    const supabase = await createSupabaseServer();
    const body = await request.json();

    const { data: existing, error: fetchError } = await supabase
      .from("achievements")
      .select("created_by")
      .eq("id", id)
      .single();

    if (fetchError || !existing) return apiNotFound();

    const isCreator = existing.created_by === uid;
    const hasPermission = isRoleAllowed(role, ["PENGURUS_INTI", "KABID"]) || isCreator;

    if (!hasPermission) return apiForbidden();

    const { participant_ids, ...updateData } = body;

    const { data, error } = await supabase
      .from("achievements")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    if (participant_ids !== undefined) {
      await supabase
        .from("achievement_participants")
        .delete()
        .eq("achievement_id", id);

      if (participant_ids.length > 0) {
        const participants = participant_ids.map((userId: string) => ({
          achievement_id: id,
          user_id: userId,
        }));

        const { error: participantError } = await supabase
          .from("achievement_participants")
          .insert(participants);

        if (participantError) throw participantError;
      }
    }

    return apiOk(data);
  } catch (error) {
    return apiInternalError();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    const role = getUserRole(request);
    if (!uid) return apiUnauthorized();

    if (!isAdmin(role)) return apiForbidden();

    const { id } = await params;
    const supabase = await createSupabaseServer();

    await supabase
      .from("achievement_participants")
      .delete()
      .eq("achievement_id", id);

    const { error } = await supabase
      .from("achievements")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return apiOk({ message: "Achievement deleted" });
  } catch (error) {
    return apiInternalError();
  }
}
