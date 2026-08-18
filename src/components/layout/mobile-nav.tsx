"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { navItems } from "@/components/layout/sidebar";
import { LogOut, Menu } from "lucide-react";
import type { OrganizationSettings } from "@/lib/types/database";

export function MobileNav() {
  const pathname = usePathname();
  const supabase = createSupabaseClient();
  const [open, setOpen] = useState(false);
  const [orgData, setOrgData] = useState<OrganizationSettings | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userAvatar, setUserAvatar] = useState("");
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    const fetchProfile = () => {
      supabase.auth.getUser().then(({ data: { user: u } }) => {
        if (u) {
          setUserEmail(u.email || "");
          supabase.from("profiles").select("full_name, avatar_url, role").eq("id", u.id).single().then(({ data }) => {
            if (data) {
              setUserName(data.full_name);
              setUserAvatar(data.avatar_url || "");
              setUserRole(data.role);
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

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Buka menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-72 max-w-[85%] p-0 bg-sidebar-bg text-sidebar-foreground border-sidebar-border"
        >
          <SheetTitle className="sr-only">Menu Navigasi</SheetTitle>
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
              if (item.adminOnly && userRole !== "ADMIN") return null;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0 text-sidebar-foreground" strokeWidth={2.5} aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={userAvatar} alt={userName} />
                <AvatarFallback>{userName ? userName.charAt(0).toUpperCase() : "?"}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{userName || "Memuat..."}</p>
                <p className="text-xs text-sidebar-foreground/50 truncate">{userEmail}</p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3 w-full"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
