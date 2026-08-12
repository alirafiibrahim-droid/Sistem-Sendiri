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
import { writeAuditLog } from "@/lib/audit";

// GET /api/inventory?page=1&limit=25&search=&category=&condition=
export async function GET(request: Request) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "25");
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const condition = searchParams.get("condition") || "";

    const supabase = await createSupabaseServer();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("inventory_items")
      .select("*", { count: "exact" });

    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
    }
    if (category) {
      query = query.eq("category", category);
    }
    if (condition) {
      query = query.eq("condition", condition);
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
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

// POST /api/inventory (Admin/Pengurus Inti/Kabid)
export async function POST(request: Request) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const userRole = getUserRole(request);
    const forbidden = requireAccess(userRole, "inventory-add", "create");
    if (forbidden) return forbidden;

    const body = await request.json();
    const { name, category, stock, unit_price, condition, location, description, photo_url } = body;

    if (!name || !category || !stock || !location) {
      return apiBadRequest("Nama, kategori, stok, dan lokasi wajib diisi.");
    }

    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
      .from("inventory_items")
      .insert({
        name,
        category,
        stock: Number(stock),
        unit_price: unit_price !== undefined && unit_price !== "" ? Number(unit_price) : 0,
        condition: condition || "GOOD",
        location,
        description: description || "",
        photo_url: photo_url || null,
        created_by: uid,
      })
      .select()
      .single();

    if (error) return apiInternalError(error.message);

    await writeAuditLog({
      action: "CREATE",
      targetTable: "inventory_items",
      targetId: data.id,
      userId: uid,
      newValue: {
        name: data.name,
        category: data.category,
        stock: data.stock,
        unit_price: data.unit_price,
        condition: data.condition,
        location: data.location,
      },
    });

    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
