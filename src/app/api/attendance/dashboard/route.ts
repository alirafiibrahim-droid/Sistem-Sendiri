import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiUnauthorized,
  apiInternalError,
  getUid,
  getUserRole,
} from "@/lib/api-response";
import { canAccess } from "@/lib/access";
import { NextRequest } from "next/server";

type DashboardType = "program" | "training" | "project";

interface DashboardRecord {
  id: string;
  user_id: string;
  user_name: string;
  user_nim: string | null;
  avatar_url: string | null;
  date: string;
  time: string;
  type: DashboardType;
  session_name: string;
  method: string;
}

interface RawProgramRow {
  id: string;
  user_id: string;
  method: string;
  created_at: string;
  program_sessions: {
    date: string;
    title: string | null;
    programs: { name: string | null } | null;
  };
}

interface RawTrainingRow {
  id: string;
  athlete_id: string;
  method: string;
  created_at: string;
  training_sessions: { date: string; name: string | null; session_type: string | null };
}

interface RawProjectRow {
  id: string;
  user_id: string;
  method: string;
  created_at: string;
  project_sessions: {
    date: string;
    title: string | null;
    incidental_projects: { name: string | null } | null;
  };
}

async function countSessions(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  type: string,
  startDate: string,
  endDate: string
) {
  let total = 0;

  if (!type || type === "program") {
    let q = supabase.from("program_sessions").select("id", { count: "exact", head: true });
    if (startDate) q = q.gte("date", startDate);
    if (endDate) q = q.lte("date", endDate);
    const { count } = await q;
    total += count ?? 0;
  }

  if (!type || type === "training") {
    let q = supabase.from("training_sessions").select("id", { count: "exact", head: true });
    if (startDate) q = q.gte("date", startDate);
    if (endDate) q = q.lte("date", endDate);
    const { count } = await q;
    total += count ?? 0;
  }

  if (!type || type === "project") {
    let q = supabase.from("project_sessions").select("id", { count: "exact", head: true });
    if (startDate) q = q.gte("date", startDate);
    if (endDate) q = q.lte("date", endDate);
    const { count } = await q;
    total += count ?? 0;
  }

  return total;
}

// GET /api/attendance/dashboard?user_id=&name=&type=&method=&start_date=&end_date=
// Riwayat kehadiran semua user (pengelola) atau riwayat user sendiri (anggota biasa).
export async function GET(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const isManager = canAccess(role, "attendance", "update");

    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get("user_id")?.trim() || "";
    const name = searchParams.get("name")?.trim() || "";
    const type = searchParams.get("type") || "";
    const method = searchParams.get("method") || "";
    const startDate = searchParams.get("start_date")?.trim() || "";
    const endDate = searchParams.get("end_date")?.trim() || "";

    const supabase = await createSupabaseServer();

    let userIdFilter: string | null = null;
    let userIdList: string[] | null = null;

    if (!isManager) {
      userIdFilter = uid;
    } else if (requestedUserId) {
      userIdFilter = requestedUserId;
    }

    if (isManager && name) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .ilike("full_name", `%${name}%`);
      const ids = (profiles || []).map((p) => p.id);
      if (ids.length === 0) {
        const emptyTotal = await countSessions(supabase, type, startDate, endDate);
        return apiOk({ records: [], totalSessions: emptyTotal, canViewAll: isManager });
      }
      userIdList = ids;
    }

    const records: DashboardRecord[] = [];

    if (!type || type === "program") {
      let q = supabase
        .from("program_session_attendants")
        .select("id, user_id, method, created_at, program_sessions!inner(date, title, programs(name))")
        .order("created_at", { ascending: false });
      if (userIdFilter) q = q.eq("user_id", userIdFilter);
      if (userIdList) q = q.in("user_id", userIdList);
      if (method) q = q.eq("method", method);
      if (startDate) q = q.gte("program_sessions.date", startDate);
      if (endDate) q = q.lte("program_sessions.date", endDate);

      const { data, error } = await q;
      if (error) return apiInternalError(error.message);

      for (const r of (data || []) as unknown as RawProgramRow[]) {
        records.push({
          id: r.id,
          user_id: r.user_id,
          user_name: "",
          user_nim: null,
          avatar_url: null,
          date: r.program_sessions?.date || "",
          time: r.created_at,
          type: "program",
          session_name:
            r.program_sessions?.programs?.name || r.program_sessions?.title || "Sesi Program Kerja",
          method: r.method,
        });
      }
    }

    if (!type || type === "training") {
      let q = supabase
        .from("training_session_attendants")
        .select("id, athlete_id, method, created_at, training_sessions!inner(date, name, session_type)")
        .order("created_at", { ascending: false });
      if (userIdFilter) q = q.eq("athlete_id", userIdFilter);
      if (userIdList) q = q.in("athlete_id", userIdList);
      if (method) q = q.eq("method", method);
      if (startDate) q = q.gte("training_sessions.date", startDate);
      if (endDate) q = q.lte("training_sessions.date", endDate);

      const { data, error } = await q;
      if (error) return apiInternalError(error.message);

      for (const r of (data || []) as unknown as RawTrainingRow[]) {
        records.push({
          id: r.id,
          user_id: r.athlete_id,
          user_name: "",
          user_nim: null,
          avatar_url: null,
          date: r.training_sessions?.date || "",
          time: r.created_at,
          type: "training",
          session_name:
            r.training_sessions?.name || r.training_sessions?.session_type || "Sesi Latihan",
          method: r.method,
        });
      }
    }

    if (!type || type === "project") {
      let q = supabase
        .from("project_session_attendants")
        .select("id, user_id, method, created_at, project_sessions!inner(date, title, incidental_projects(name))")
        .order("created_at", { ascending: false });
      if (userIdFilter) q = q.eq("user_id", userIdFilter);
      if (userIdList) q = q.in("user_id", userIdList);
      if (method) q = q.eq("method", method);
      if (startDate) q = q.gte("project_sessions.date", startDate);
      if (endDate) q = q.lte("project_sessions.date", endDate);

      const { data, error } = await q;
      if (error) return apiInternalError(error.message);

      for (const r of (data || []) as unknown as RawProjectRow[]) {
        records.push({
          id: r.id,
          user_id: r.user_id,
          user_name: "",
          user_nim: null,
          avatar_url: null,
          date: r.project_sessions?.date || "",
          time: r.created_at,
          type: "project",
          session_name:
            r.project_sessions?.incidental_projects?.name || r.project_sessions?.title || "Sesi Proyek Insidental",
          method: r.method,
        });
      }
    }

    const allUserIds = [...new Set(records.map((r) => r.user_id).filter(Boolean))];
    const profileMap = new Map<
      string,
      { id: string; full_name: string; nim: string | null; avatar_url: string | null }
    >();

    if (allUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, nim, avatar_url")
        .in("id", allUserIds);

      for (const p of profiles || []) {
        profileMap.set(p.id, {
          id: p.id,
          full_name: p.full_name,
          nim: p.nim ?? null,
          avatar_url: p.avatar_url ?? null,
        });
      }
    }

    const merged = records.map((r) => {
      const profile = profileMap.get(r.user_id);
      return {
        ...r,
        user_name: profile?.full_name || "Unknown",
        user_nim: profile?.nim ?? null,
        avatar_url: profile?.avatar_url ?? null,
      };
    });

    merged.sort((a, b) => (a.time < b.time ? 1 : -1));

    const totalSessions = await countSessions(supabase, type, startDate, endDate);

    return apiOk({ records: merged, totalSessions, canViewAll: isManager });
  } catch {
    return apiInternalError();
  }
}
