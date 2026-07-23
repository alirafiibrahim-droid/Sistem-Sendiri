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
import { NextRequest } from "next/server";

// GET /api/training-sessions/[id]/assessments
// List assessments for this session
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("assessments")
      .select("id, athlete_id, metric_id, value, notes, created_at, profiles(id, full_name, nim), athletic_metrics(id, name, category)")
      .eq("session_id", id)
      .order("created_at", { ascending: false });

    if (error) return apiInternalError();
    return apiOk(data || []);
  } catch {
    return apiInternalError();
  }
}

// POST /api/training-sessions/[id]/assessments
// Create or update assessment for an athlete in this session
// Body: { athlete_id: string, value: number, notes?: string }
// Auto-resolves metric_id from the session's training category
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = getUid(request);
    const role = getUserRole(request);
    if (!uid) return apiUnauthorized();

    const forbidden = requireRole(role, ["ADMIN", "PENGURUS_INTI", "KABID", "PELATIH"]);
    if (forbidden) return forbidden;

    const { id } = await params;
    const body = await request.json();
    const { athlete_id, value, notes } = body;

    if (!athlete_id || value === undefined || value === null) {
      return apiBadRequest("athlete_id dan value wajib diisi.");
    }

    const numValue = Number(value);
    if (isNaN(numValue) || numValue < 1 || numValue > 10) {
      return apiBadRequest("Score harus antara 1-10.");
    }

    const supabase = await createSupabaseServer();

    // Get session to find training category
    const { data: session, error: sErr } = await supabase
      .from("training_sessions")
      .select("id, training_id")
      .eq("id", id)
      .single();

    if (sErr || !session) return apiNotFound("Sesi latihan tidak ditemukan.");

    let category: string | null = null;
    if (session.training_id) {
      const { data: training } = await supabase
        .from("trainings")
        .select("category")
        .eq("id", session.training_id)
        .single();
      category = training?.category || null;
    }
    if (!category) {
      return apiBadRequest("Sesi ini tidak memiliki kategori latihan. Ubah jenis latihan ke data Latihan yang memiliki kategori.");
    }

    // Find the metric for this category
    const { data: metric, error: mErr } = await supabase
      .from("athletic_metrics")
      .select("id")
      .eq("category", category)
      .limit(1)
      .single();

    if (mErr || !metric) {
      return apiBadRequest(`Tidak ditemukan metric untuk kategori ${category}. Jalankan migrasi seed metrics.`);
    }

    // Upsert assessment: one per (session, athlete, metric)
    const { data: existing } = await supabase
      .from("assessments")
      .select("id")
      .eq("session_id", id)
      .eq("athlete_id", athlete_id)
      .eq("metric_id", metric.id)
      .limit(1)
      .maybeSingle();

    let result;

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from("assessments")
        .update({ value: numValue, notes: notes || null })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) return apiInternalError(error.message);
      result = data;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from("assessments")
        .insert({
          session_id: id,
          athlete_id,
          metric_id: metric.id,
          value: numValue,
          notes: notes || null,
        })
        .select()
        .single();
      if (error) return apiInternalError(error.message);
      result = data;
    }

    return apiCreated(result);
  } catch (e) {
    console.error("ASSESSMENTS POST ERROR:", e);
    return apiInternalError();
  }
}
