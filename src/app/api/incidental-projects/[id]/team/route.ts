import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiNotFound,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireAccess } from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data: project } = await supabase
      .from("incidental_projects")
      .select("id")
      .eq("id", id)
      .single();

    if (!project) return apiNotFound();

    const { data, error } = await supabase
      .from("project_team")
      .select("*, profiles(id, full_name, nim, avatar_url)")
      .eq("project_id", id);

    if (error) throw error;

    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const forbidden = requireAccess(role, "projects", "create");
    if (forbidden) return forbidden;

    const { id } = await params;
    const body = await request.json();
    const { user_id, project_role } = body;

    if (!user_id || !project_role) {
      return apiBadRequest("Missing required fields");
    }

    const supabase = await createSupabaseServer();

    const { data: project } = await supabase
      .from("incidental_projects")
      .select("id")
      .eq("id", id)
      .single();

    if (!project) return apiNotFound();

    const { data: existing } = await supabase
      .from("project_team")
      .select("id")
      .eq("project_id", id)
      .eq("user_id", user_id)
      .single();

    if (existing) {
      return apiBadRequest("User already in team");
    }

    const { data, error } = await supabase
      .from("project_team")
      .insert({
        project_id: id,
        user_id,
        project_role,
      })
      .select("*, profiles(id, full_name, nim, avatar_url)")
      .single();

    if (error) throw error;

    await writeAuditLog({
      action: "CREATE",
      targetTable: "project_team",
      targetId: data.id,
      userId: uid,
      newValue: {
        project_id: id,
        user_id,
        project_role,
      },
    });

    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
