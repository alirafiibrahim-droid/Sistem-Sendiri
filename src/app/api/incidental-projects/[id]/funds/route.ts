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
      .from("project_funds")
      .select("*, profiles(id, full_name)")
      .eq("project_id", id)
      .order("date", { ascending: false });

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
    const { type, amount, source, description, date, receipt_url } = body;

    if (!type || amount == null || !date) {
      return apiBadRequest("Missing required fields");
    }

    if (!["INCOME", "EXPENSE"].includes(type)) {
      return apiBadRequest("Invalid fund type");
    }

    const supabase = await createSupabaseServer();

    const { data: project } = await supabase
      .from("incidental_projects")
      .select("id")
      .eq("id", id)
      .single();

    if (!project) return apiNotFound();

    const { data, error } = await supabase
      .from("project_funds")
      .insert({
        project_id: id,
        type,
        amount,
        source,
        description,
        date,
        receipt_url,
        created_by: uid,
      })
      .select("*, profiles(id, full_name)")
      .single();

    if (error) throw error;

    await writeAuditLog({
      action: "CREATE",
      targetTable: "project_funds",
      targetId: data.id,
      userId: uid,
      newValue: {
        project_id: id,
        type,
        amount,
        source,
        description,
        date,
        receipt_url: receipt_url || null,
      },
    });

    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
