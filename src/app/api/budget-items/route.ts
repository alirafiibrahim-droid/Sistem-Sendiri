import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiBadRequest,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { requireAccess } from "@/lib/access";
import { budgetItemSchema } from "@/lib/validations/budget";
import { writeAuditLog } from "@/lib/audit";

function subtotalOf(quantity: number, unitPrice: number) {
  return Math.round(quantity * unitPrice * 100) / 100;
}

// GET /api/budget-items?program_id=xxx&project_id=xxx (mendukung id jamak dipisah koma)
export async function GET(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { searchParams } = new URL(request.url);
    const programId = searchParams.get("program_id");
    const projectId = searchParams.get("project_id");

    const supabase = await createSupabaseServer();

    let query = supabase
      .from("budget_items")
      .select("*")
      .order("created_at", { ascending: true });

    if (programId) {
      const ids = programId.split(",").filter(Boolean);
      query = ids.length > 1 ? query.in("program_id", ids) : query.eq("program_id", ids[0]);
    }
    if (projectId) {
      const ids = projectId.split(",").filter(Boolean);
      query = ids.length > 1 ? query.in("project_id", ids) : query.eq("project_id", ids[0]);
    }

    const { data, error } = await query;
    if (error) return apiInternalError(error.message);

    const items = data || [];
    const indaks = items.filter((i) => !i.parent_id).map((i) => ({
      ...i,
      children: items.filter((c) => c.parent_id === i.id),
    }));

    return apiOk(indaks, { total: items.length });
  } catch {
    return apiInternalError();
  }
}

// POST /api/budget-items
export async function POST(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const forbidden = requireAccess(role, "programs", "create");
    if (forbidden) return forbidden;

    const body = await request.json();
    const parsed = budgetItemSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const { program_id, project_id, parent_id, name, quantity, unit_price } = parsed.data;
    const subtotal = subtotalOf(quantity, unit_price);

    const supabase = await createSupabaseServer();

    if (parent_id) {
      const { data: parent, error: parentError } = await supabase
        .from("budget_items")
        .select("id, parent_id, subtotal, program_id, project_id")
        .eq("id", parent_id)
        .single();

      if (parentError || !parent) {
        return apiBadRequest("Induk pos yang dipilih tidak ditemukan.");
      }
      if (parent.parent_id) {
        return apiBadRequest("Induk pos yang dipilih bukan Induk Pos.");
      }
      if (parent.program_id !== (program_id ?? null) || parent.project_id !== (project_id ?? null)) {
        return apiBadRequest("Induk pos harus berasal dari program/proyek yang sama.");
      }
      if (Number(parent.subtotal) > 0) {
        return apiBadRequest(
          "Induk pos yang sudah memiliki besar anggaran tidak dapat dipilih sebagai induk."
        );
      }
    }

    const { data, error } = await supabase
      .from("budget_items")
      .insert({
        program_id: program_id || null,
        project_id: project_id || null,
        parent_id: parent_id || null,
        name,
        quantity,
        unit_price,
        subtotal,
        created_by: uid,
      })
      .select()
      .single();

    if (error) return apiInternalError(error.message);

    await writeAuditLog({
      action: "CREATE",
      targetTable: "budget_items",
      targetId: data.id,
      userId: uid,
      newValue: {
        program_id: data.program_id,
        project_id: data.project_id,
        parent_id: data.parent_id,
        name: data.name,
        quantity: data.quantity,
        unit_price: data.unit_price,
        subtotal: data.subtotal,
      },
    });

    return apiCreated({ ...data, children: [] });
  } catch {
    return apiInternalError();
  }
}
