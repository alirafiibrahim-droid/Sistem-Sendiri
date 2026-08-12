"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

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
    <header className="flex h-14 items-center gap-4 border-b bg-background px-6 print:hidden">
      <div className="lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            S
          </div>
          <span className="font-semibold">SIORG</span>
        </Link>
      </div>
      <h1 className="text-lg font-semibold">{pageTitle}</h1>
      <div className="ml-auto flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{user?.email}</span>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Keluar
        </Button>
      </div>
    </header>
  );
}
