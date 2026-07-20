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
import { requireRole } from "@/lib/authz";

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
      .from("project_milestones")
      .select("*")
      .eq("project_id", id)
      .order("due_date", { ascending: true });

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
    const forbidden = requireRole(role, ["PENGURUS_INTI", "KABID"]);
    if (forbidden) return forbidden;

    const { id } = await params;
    const body = await request.json();
    const { title, description, due_date } = body;

    if (!title || !due_date) {
      return apiBadRequest("Missing required fields");
    }

    const supabase = await createSupabaseServer();

    const { data: project } = await supabase
      .from("incidental_projects")
      .select("id")
      .eq("id", id)
      .single();

    if (!project) return apiNotFound();

    const { data, error } = await supabase
      .from("project_milestones")
      .insert({
        project_id: id,
        title,
        description,
        due_date,
        is_completed: false,
      })
      .select()
      .single();

    if (error) throw error;

    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
