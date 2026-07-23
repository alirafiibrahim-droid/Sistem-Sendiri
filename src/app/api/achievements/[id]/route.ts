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

    const { data: achievement, error } = await supabase
      .from("achievements")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !achievement) return apiNotFound();

    const { data: participantRows } = await supabase
      .from("achievement_participants")
      .select("*")
      .eq("achievement_id", id);

    const participants = participantRows || [];

    const allUserIds = new Set<string>();
    if (achievement.created_by) allUserIds.add(achievement.created_by);
    for (const p of participants) {
      if (p.user_id) allUserIds.add(p.user_id);
    }

    let profilesMap = new Map<string, { id: string; full_name: string; nim?: string; avatar_url?: string }>();
    if (allUserIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, nim, avatar_url")
        .in("id", [...allUserIds]);

      if (profiles) {
        for (const p of profiles) {
          profilesMap.set(p.id, p);
        }
      }
    }

    const creatorProfile = achievement.created_by
      ? profilesMap.get(achievement.created_by) || null
      : null;

    const participantsWithProfiles = participants.map(
      (p: { id: string; achievement_id: string; user_id: string; juara: string; keterangan: string | null }) => ({
        ...p,
        profiles: profilesMap.get(p.user_id) || null,
      })
    );

    return apiOk({
      ...achievement,
      profiles: creatorProfile,
      achievement_participants: participantsWithProfiles,
    });
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

    const { participants, ...updateData } = body;

    const { data, error } = await supabase
      .from("achievements")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    if (participants !== undefined) {
      await supabase
        .from("achievement_participants")
        .delete()
        .eq("achievement_id", id);

      if (participants.length > 0) {
        const rows = participants.map((p: { user_id: string; juara: string; keterangan?: string }) => ({
          achievement_id: id,
          user_id: p.user_id,
          juara: p.juara,
          keterangan: p.keterangan || null,
        }));

        const { error: participantError } = await supabase
          .from("achievement_participants")
          .insert(rows);

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
