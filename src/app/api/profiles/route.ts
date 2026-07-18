import { createSupabaseServer } from "@/lib/supabase/server";
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
import type { PaginationParams } from "@/lib/types/api";

// GET /api/profiles?page=1&limit=25&search=&role=&status=&division_id=&sort=full_name&order=asc
export async function GET(request: Request) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "25");
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role");
    const status = searchParams.get("status");
    const divisionId = searchParams.get("division_id");
    const sort = searchParams.get("sort") || "full_name";
    const order = searchParams.get("order") || "asc";

    const supabase = await createSupabaseServer();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("profiles")
      .select("*, divisions(id, name)", { count: "exact" });

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,nim.ilike.%${search}%`);
    }
    if (role) query = query.eq("role", role);
    if (status) query = query.eq("status", status);
    if (divisionId) query = query.eq("division_id", divisionId);

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

// POST /api/profiles (Admin/Pengurus Inti only - manual add member)
export async function POST(request: Request) {
  try {
    const role = getUserRole(request);
    if (!role || !["ADMIN", "PENGURUS_INTI"].includes(role)) {
      return apiForbidden();
    }

    const body = await request.json();
    const { email, full_name, nim, phone_number, division_id, role: userRole } = body;

    if (!email || !full_name || !nim) {
      return apiBadRequest("Email, full_name, dan nim wajib diisi.");
    }

    const supabase = await createSupabaseServer();

    // Check duplicate NIM or email
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .or(`nim.eq.${nim},email.eq.${email}`)
      .maybeSingle();

    if (existing) {
      return apiBadRequest("NIM atau Email sudah terdaftar dalam sistem.");
    }

    // Create auth user via service role (invited)
    const { data: authData, error: authError } =
      await supabase.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name,
          nim,
          phone_number,
          role: userRole || "ANGGOTA",
          division_id,
        },
      });

    if (authError) return apiInternalError(authError.message);

    return apiCreated({
      id: authData.user.id,
      message: "Anggota berhasil ditambahkan. Email undangan telah dikirim.",
    });
  } catch {
    return apiInternalError();
  }
}
