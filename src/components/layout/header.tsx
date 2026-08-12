"use client";

import { usePathname, useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/layout/mobile-nav";

interface HeaderProps {
  user?: { email?: string | null } | null;
}

export function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const pageTitle = (() => {
    if (pathname === "/") return "Dashboard";
    const segment = pathname.split("/")[1];
    const titles: Record<string, string> = {
      programs: "Program Kerja",
      finances: "Keuangan",
      members: "Anggota",
      athletics: "Keatletan",
      achievements: "Prestasi",
      inventory: "Inventaris",
      letters: "Persuratan",
      handovers: "Sertijab",
      projects: "Proyek Insidental",
      reports: "Laporan",
      "audit-logs": "Audit Trail",
      settings: "Pengaturan",
    };
    return titles[segment] || "SIORG";
  })();

  const handleLogout = async () => {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="flex h-14 items-center gap-3 border-b bg-background px-4 sm:px-6 print:hidden">
      <div className="lg:hidden">
        <MobileNav />
      </div>
      <h1 className="text-base sm:text-lg font-semibold truncate">{pageTitle}</h1>
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden sm:inline text-sm text-muted-foreground">{user?.email}</span>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Keluar
        </Button>
      </div>
    </header>
  );
}
