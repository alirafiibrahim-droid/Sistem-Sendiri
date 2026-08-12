import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { buildDashboardData } from "@/lib/dashboard";
import DashboardView from "@/components/dashboard/dashboard-view";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams: Promise<{ periode?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, division_id")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role || null;
  const kabidDivisionId = role === "KABID" ? profile?.division_id || null : null;

  const data = await buildDashboardData(supabase, {
    uid: user.id,
    role,
    kabidDivisionId,
    periodId: params.periode || null,
  });

  return <DashboardView data={data} />;
}
