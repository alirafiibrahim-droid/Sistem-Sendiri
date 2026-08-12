import { createSupabaseServer } from "@/lib/supabase/server";
import { isProgramLocked } from "@/lib/program-lock";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiForbidden,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireAccess } from "@/lib/access";
import { writeAuditLog } from "@/lib/audit";

// GET /api/programs/[id]/tasks?page=1&limit=25&search=&sort=&order=asc
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "25");
    const search = searchParams.get("search") || "";
    const sort = searchParams.get("sort") || "created_at";
    const order = searchParams.get("order") || "desc";

    const supabase = await createSupabaseServer();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("tasks")
      .select("*, profiles(id, full_name, avatar_url)", { count: "exact" })
      .eq("program_id", id);

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, count, error } = await query
      .order(sort, { ascending: order === "asc" })
      .range(from, to);

    if (error) return apiInternalError(error.message);

    return apiOk(data, {
      total: count ?? 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0,
    });
  } catch {
    return apiInternalError();
  }
}

// POST /api/programs/[id]/tasks (Admin/Pengurus Inti/Kabid only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const userRole = getUserRole(request);
    const forbidden = requireAccess(userRole, "programs", "create");
    if (forbidden) return forbidden;

    const { id } = await params;
    const body = await request.json();
    const { title, description, priority, due_date, assigned_to } = body;

    if (!title) {
      return apiBadRequest("Judul task wajib diisi.");
    }

    const supabase = await createSupabaseServer();

    if (await isProgramLocked(supabase, id)) {
      return apiForbidden("Program pada periode yang telah selesai tidak dapat diubah.");
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        program_id: id,
        title,
        description: description || "",
        priority: priority || "MEDIUM",
        due_date: due_date || null,
        assigned_to: assigned_to || null,
      })
      .select("*, profiles(id, full_name, avatar_url)")
      .single();

    if (error) return apiInternalError(error.message);

    await writeAuditLog({
      action: "CREATE",
      targetTable: "tasks",
      targetId: data.id,
      userId: uid,
      newValue: data,
    });

    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
