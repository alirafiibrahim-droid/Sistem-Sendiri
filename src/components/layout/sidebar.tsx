"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import type { OrganizationSettings } from "@/lib/types/database";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "📊" },
  { label: "Program Kerja", href: "/programs", icon: "📋" },
  { label: "Keuangan", href: "/finances", icon: "💰" },
  { label: "Anggota", href: "/members", icon: "👥" },
  { label: "Absensi", href: "/attendance", icon: "📌" },
  { label: "Keatletan", href: "/athletics", icon: "🏃" },
  { label: "Prestasi", href: "/achievements", icon: "🏆" },
  { label: "Inventaris", href: "/inventory", icon: "📦" },
  { label: "Persuratan", href: "/letters", icon: "✉️" },
  { label: "Sertijab", href: "/handovers", icon: "📝" },
  { label: "Proyek Insidental", href: "/projects", icon: "🔧" },
  { label: "Pengaturan", href: "/settings", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();
  const supabase = createSupabaseClient();
  const [orgData, setOrgData] = useState<OrganizationSettings | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userAvatar, setUserAvatar] = useState("");

  useEffect(() => {
    const fetchProfile = () => {
      supabase.auth.getUser().then(({ data: { user: u } }) => {
        if (u) {
          setUserEmail(u.email || "");
          supabase.from("profiles").select("full_name, avatar_url").eq("id", u.id).single().then(({ data }) => {
            if (data) {
              setUserName(data.full_name);
              setUserAvatar(data.avatar_url || "");
            }
          });
        }
      });
    };
    const fetchOrg = () => {
      fetch("/api/settings").then((r) => r.json()).then((json) => {
        if (json.success && json.data) setOrgData(json.data);
      });
    };
    fetchProfile();
    fetchOrg();
    window.addEventListener("profile-updated", fetchProfile);
    window.addEventListener("org-settings-updated", fetchOrg);
    return () => {
      window.removeEventListener("profile-updated", fetchProfile);
      window.removeEventListener("org-settings-updated", fetchOrg);
    };
  }, [supabase]);

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r bg-sidebar-bg text-sidebar-foreground">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Link href="/" className="flex items-center gap-2">
          {orgData?.org_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={orgData.org_logo_url} alt="Logo" className="h-8 w-8 rounded-lg object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              S
            </div>
          )}
          <span className="font-semibold text-lg">{orgData?.org_name || "SIORG"}</span>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-white"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white"
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar
            src={userAvatar}
            alt={userName}
            fallback={userName ? userName.charAt(0).toUpperCase() : "?"}
            className="h-9 w-9 text-sm"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userName || "Memuat..."}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{userEmail}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
