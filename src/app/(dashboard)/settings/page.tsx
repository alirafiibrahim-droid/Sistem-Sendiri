"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { profileFormSchema, orgSettingsFormSchema, divisionFormSchema, fakultasFormSchema, jurusanFormSchema, bankFormSchema, cashAccountFormSchema, walletFormSchema } from "@/lib/validations/settings";
import type { OrganizationSettings, Division, Fakultas, Jurusan, Profile, ProfileWithDivision, UserRole, Bank, CashAccount, WalletWithOwner } from "@/lib/types/database";
import SpiderChart from "@/components/charts/spider-chart";

type FormErrors = Record<string, string>;
type TabId = "profile" | "pengaturan-user" | "organization" | "divisions" | "fakultas-jurusan" | "kas-bank" | "dompet";

const allTabs: { id: TabId; label: string; adminOnly?: boolean }[] = [
  { id: "profile", label: "Profile Saya" },
  { id: "pengaturan-user", label: "Pengaturan User", adminOnly: true },
  { id: "organization", label: "Organisasi", adminOnly: true },
  { id: "divisions", label: "Divisi" },
  { id: "fakultas-jurusan", label: "Fakultas & Jurusan" },
  { id: "kas-bank", label: "Kas & Bank" },
  { id: "dompet", label: "Dompet" },
];

export default function SettingsPage() {
  const supabase = createSupabaseClient();
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [user, setUser] = useState<Profile | null>(null);

  // ─── Profile Tab ───
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [profileAvatarFile, setProfileAvatarFile] = useState<File | null>(null);
  const [profileAvatarPreview, setProfileAvatarPreview] = useState("");
  const [profileErrors, setProfileErrors] = useState<FormErrors>({});
  const [profileLoading, setProfileLoading] = useState(false);

  // ─── Athlete Spider Chart ───
  const [athleteScores, setAthleteScores] = useState<Array<{ category: string; avg_score: number; assessment_count: number }>>([]);

  // ─── Organization Tab ───
  const [orgData, setOrgData] = useState<OrganizationSettings | null>(null);
  const [orgName, setOrgName] = useState("");
  const [orgDesc, setOrgDesc] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [orgPeriod, setOrgPeriod] = useState("");
  const [orgMaintenance, setOrgMaintenance] = useState(false);
  const [orgLogoFile, setOrgLogoFile] = useState<File | null>(null);
  const [orgLogoPreview, setOrgLogoPreview] = useState("");
  const [orgErrors, setOrgErrors] = useState<FormErrors>({});
  const [orgLoading, setOrgLoading] = useState(false);

  // ─── Divisions Tab ───
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [showDivModal, setShowDivModal] = useState(false);
  const [divEditId, setDivEditId] = useState<string | null>(null);
  const [divName, setDivName] = useState("");
  const [divDesc, setDivDesc] = useState("");
  const [divErrors, setDivErrors] = useState<FormErrors>({});
  const [divLoading, setDivLoading] = useState(false);

  // ─── Fakultas & Jurusan Tab ───
  const [fakultasList, setFakultasList] = useState<Fakultas[]>([]);
  const [jurusanList, setJurusanList] = useState<(Jurusan & { fakultas?: Pick<Fakultas, "id" | "name"> | null })[]>([]);
  const [fjTab, setFjTab] = useState<"fakultas" | "jurusan">("fakultas");
  const [showFjModal, setShowFjModal] = useState(false);
  const [fjEditId, setFjEditId] = useState<string | null>(null);
  const [fjName, setFjName] = useState("");
  const [fjDesc, setFjDesc] = useState("");
  const [fjFakultasId, setFjFakultasId] = useState("");
  const [fjErrors, setFjErrors] = useState<FormErrors>({});
  const [fjLoading, setFjLoading] = useState(false);

  // ─── Pengaturan User Tab ───
  const [allUsers, setAllUsers] = useState<ProfileWithDivision[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [userRoleError, setUserRoleError] = useState("");

  // ─── Tambah User Modal ───
  const [showTambahUser, setShowTambahUser] = useState(false);
  const [tambahUserId, setTambahUserId] = useState("");
  const [tambahUserRole, setTambahUserRole] = useState("ANGGOTA");
  const [tambahUserLoading, setTambahUserLoading] = useState(false);
  const [tambahUserError, setTambahUserError] = useState("");

  // ─── Kas & Bank Tab ───
  const [banksList, setBanksList] = useState<Bank[]>([]);
  const [cashList, setCashList] = useState<CashAccount[]>([]);
  const [kbTab, setKbTab] = useState<"bank" | "kas">("bank");
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankEditId, setBankEditId] = useState<string | null>(null);
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [bankDesc, setBankDesc] = useState("");
  const [bankErrors, setBankErrors] = useState<FormErrors>({});
  const [bankLoading, setBankLoading] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashEditId, setCashEditId] = useState<string | null>(null);
  const [cashName, setCashName] = useState("");
  const [cashDesc, setCashDesc] = useState("");
  const [cashErrors, setCashErrors] = useState<FormErrors>({});
  const [cashLoading, setCashLoading] = useState(false);

  // ─── Dompet Tab ───
  const [walletsList, setWalletsList] = useState<WalletWithOwner[]>([]);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletEditId, setWalletEditId] = useState<string | null>(null);
  const [walletName, setWalletName] = useState("");
  const [walletDesc, setWalletDesc] = useState("");
  const [walletBankId, setWalletBankId] = useState("");
  const [walletCashId, setWalletCashId] = useState("");
  const [walletErrors, setWalletErrors] = useState<FormErrors>({});
  const [walletLoading, setWalletLoading] = useState(false);

  const handleTambahUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tambahUserId) { setTambahUserError("Pilih anggota terlebih dahulu."); return; }
    setTambahUserLoading(true);
    setTambahUserError("");
    const res = await fetch(`/api/profiles/${tambahUserId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: tambahUserRole }),
    });
    const json = await res.json();
    setTambahUserLoading(false);
    if (!json.success) {
      setTambahUserError(json.error?.message || "Gagal menyimpan.");
      return;
    }
    setShowTambahUser(false);
    setTambahUserId("");
    setTambahUserRole("ANGGOTA");
    fetchAllUsers();
  };

  // ─── Fetch Current User Profile ───
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (u) {
        supabase.from("profiles").select("*, divisions(id, name), fakultas(id, name), jurusan(id, name)").eq("id", u.id).single().then(({ data }) => {
          if (data) {
            setUser(data);
            setProfileName(data.full_name);
            setProfilePhone(data.phone_number || "");
            setProfileAvatarUrl(data.avatar_url || "");
            setProfileAvatarPreview(data.avatar_url || "");
            if (data.role !== "ADMIN" && (activeTab === "organization" || activeTab === "pengaturan-user")) {
              setActiveTab("profile");
            }
          }
        });
      }
    });
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Fetch Athlete Scores (for spider chart) ───
  useEffect(() => {
    if (!user) return;
    fetch(`/api/athlete-scores?athlete_id=${user.id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setAthleteScores(j.data);
      });
  }, [user]);

  // ─── Fetch All Users (for Pengaturan User) ───
  const fetchAllUsers = useCallback(async () => {
    setUsersLoading(true);
    const params = new URLSearchParams();
    if (userSearch) params.set("search", userSearch);
    params.set("limit", "200");
    const res = await fetch(`/api/profiles?${params}`);
    const json = await res.json();
    if (json.success) setAllUsers(json.data);
    setUsersLoading(false);
  }, [userSearch]);

  useEffect(() => { if (activeTab === "pengaturan-user") fetchAllUsers(); }, [activeTab, fetchAllUsers]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setSavingRole(userId);
    setUserRoleError("");
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);
    if (error) {
      setUserRoleError(error.message);
    } else {
      setAllUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole as UserRole } : u)));
    }
    setSavingRole(null);
  };

  // ─── Fetch Organization Settings ───
  const fetchOrg = useCallback(async () => {
    const res = await fetch("/api/settings");
    const json = await res.json();
    if (json.success && json.data) {
      setOrgData(json.data);
      setOrgName(json.data.org_name);
      setOrgDesc(json.data.org_description);
      setOrgEmail(json.data.org_email || "");
      setOrgPeriod(json.data.period_year);
      setOrgMaintenance(json.data.is_maintenance);
      setOrgLogoPreview(json.data.org_logo_url || "");
    }
  }, []);

  useEffect(() => { fetchOrg(); }, [fetchOrg]);

  // ─── Fetch Divisions ───
  const fetchDivisions = useCallback(async () => {
    const res = await fetch("/api/divisions");
    const json = await res.json();
    if (json.success) setDivisions(json.data);
  }, []);

  useEffect(() => { fetchDivisions(); }, [fetchDivisions]);

  // ─── Fetch Fakultas & Jurusan ───
  const fetchFakultas = useCallback(async () => {
    const res = await fetch("/api/fakultas");
    const json = await res.json();
    if (json.success) setFakultasList(json.data);
  }, []);

  const fetchJurusan = useCallback(async () => {
    const res = await fetch("/api/jurusan");
    const json = await res.json();
    if (json.success) setJurusanList(json.data);
  }, []);

  useEffect(() => { fetchFakultas(); fetchJurusan(); }, [fetchFakultas, fetchJurusan]);

  // ─── Fetch Banks & Cash Accounts ───
  const fetchBanks = useCallback(async () => {
    const res = await fetch("/api/banks");
    const json = await res.json();
    if (json.success) setBanksList(json.data);
  }, []);

  const fetchCash = useCallback(async () => {
    const res = await fetch("/api/cash");
    const json = await res.json();
    if (json.success) setCashList(json.data);
  }, []);

  const fetchWallets = useCallback(async () => {
    const res = await fetch("/api/wallets");
    const json = await res.json();
    if (json.success) setWalletsList(json.data);
  }, []);

  useEffect(() => {
    if (activeTab === "kas-bank") { fetchBanks(); fetchCash(); }
    if (activeTab === "dompet") { fetchWallets(); fetchBanks(); fetchCash(); }
  }, [activeTab, fetchBanks, fetchCash, fetchWallets]);

  // ─── Bank CRUD ───
  const openBankModal = (bank?: Bank) => {
    if (bank) {
      setBankEditId(bank.id);
      setBankName(bank.name);
      setBankAccountNumber(bank.account_number);
      setBankAccountHolder(bank.account_holder);
      setBankDesc(bank.description);
    } else {
      setBankEditId(null);
      setBankName("");
      setBankAccountNumber("");
      setBankAccountHolder("");
      setBankDesc("");
    }
    setBankErrors({});
    setShowBankModal(true);
  };

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = bankFormSchema.safeParse({
      name: bankName,
      account_number: bankAccountNumber,
      account_holder: bankAccountHolder,
      description: bankDesc || undefined,
    });
    if (!parsed.success) {
      const fe: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        if (!fe[key]) fe[key] = issue.message;
      }
      setBankErrors(fe);
      return;
    }
    setBankErrors({});
    setBankLoading(true);
    const url = bankEditId ? `/api/banks/${bankEditId}` : "/api/banks";
    const method = bankEditId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const json = await res.json();
    setBankLoading(false);
    if (!json.success) { setBankErrors({ _form: json.error?.message || "Gagal menyimpan." }); return; }
    setShowBankModal(false);
    fetchBanks();
  };

  const deleteBank = async (id: string) => {
    if (!confirm("Hapus bank ini?")) return;
    await fetch(`/api/banks/${id}`, { method: "DELETE" });
    fetchBanks();
    fetchWallets();
  };

  // ─── Cash Account CRUD ───
  const openCashModal = (cash?: CashAccount) => {
    if (cash) {
      setCashEditId(cash.id);
      setCashName(cash.name);
      setCashDesc(cash.description);
    } else {
      setCashEditId(null);
      setCashName("");
      setCashDesc("");
    }
    setCashErrors({});
    setShowCashModal(true);
  };

  const handleCashSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = cashAccountFormSchema.safeParse({
      name: cashName,
      description: cashDesc || undefined,
    });
    if (!parsed.success) {
      const fe: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        if (!fe[key]) fe[key] = issue.message;
      }
      setCashErrors(fe);
      return;
    }
    setCashErrors({});
    setCashLoading(true);
    const url = cashEditId ? `/api/cash/${cashEditId}` : "/api/cash";
    const method = cashEditId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const json = await res.json();
    setCashLoading(false);
    if (!json.success) { setCashErrors({ _form: json.error?.message || "Gagal menyimpan." }); return; }
    setShowCashModal(false);
    fetchCash();
  };

  const deleteCash = async (id: string) => {
    if (!confirm("Hapus kas ini?")) return;
    await fetch(`/api/cash/${id}`, { method: "DELETE" });
    fetchCash();
    fetchWallets();
  };

  // ─── Wallet CRUD ───
  const openWalletModal = (wallet?: WalletWithOwner) => {
    if (wallet) {
      setWalletEditId(wallet.id);
      setWalletName(wallet.name);
      setWalletDesc(wallet.description);
      setWalletBankId(wallet.bank_id || "");
      setWalletCashId(wallet.cash_account_id || "");
    } else {
      setWalletEditId(null);
      setWalletName("");
      setWalletDesc("");
      setWalletBankId("");
      setWalletCashId("");
    }
    setWalletErrors({});
    setShowWalletModal(true);
  };

  const handleWalletSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = walletFormSchema.safeParse({
      name: walletName,
      description: walletDesc || undefined,
      bank_id: walletBankId || undefined,
      cash_account_id: walletCashId || undefined,
    });
    if (!parsed.success) {
      const fe: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        if (!fe[key]) fe[key] = issue.message;
      }
      setWalletErrors(fe);
      return;
    }
    if (!parsed.data.bank_id && !parsed.data.cash_account_id) {
      setWalletErrors({ bank_id: "Pilih salah satu: Bank atau Kas." });
      return;
    }
    setWalletErrors({});
    setWalletLoading(true);
    const url = walletEditId ? `/api/wallets/${walletEditId}` : "/api/wallets";
    const method = walletEditId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const json = await res.json();
    setWalletLoading(false);
    if (!json.success) { setWalletErrors({ _form: json.error?.message || "Gagal menyimpan." }); return; }
    setShowWalletModal(false);
    fetchWallets();
  };

  const deleteWallet = async (id: string) => {
    if (!confirm("Hapus dompet ini?")) return;
    await fetch(`/api/wallets/${id}`, { method: "DELETE" });
    fetchWallets();
  };

  // ─── Profile Submit ───
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = profileFormSchema.safeParse({
      full_name: profileName,
      phone_number: profilePhone || undefined,
    });
    if (!parsed.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setProfileErrors(fieldErrors);
      return;
    }
    setProfileErrors({});
    setProfileLoading(true);

    let avatarUrl = profileAvatarUrl;

    // Upload avatar if file selected
    if (profileAvatarFile && user) {
      const ext = profileAvatarFile.name.split(".").pop();
      const filePath = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, profileAvatarFile, { upsert: true });

      if (uploadError) {
        setProfileErrors({ _form: "Gagal upload foto: " + uploadError.message });
        setProfileLoading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      avatarUrl = urlData.publicUrl;
    }

    const res = await fetch(`/api/profiles/${user?.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...parsed.data, avatar_url: avatarUrl || null }),
    });
    const json = await res.json();
    if (!json.success) {
      setProfileErrors({ _form: json.error?.message || "Gagal menyimpan." });
    } else {
      setProfileAvatarUrl(avatarUrl);
      setProfileAvatarPreview(avatarUrl);
      setProfileAvatarFile(null);
      window.dispatchEvent(new Event("profile-updated"));
    }
    setProfileLoading(false);
  };

  // ─── Organization Submit ───
  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = orgSettingsFormSchema.safeParse({
      org_name: orgName,
      org_description: orgDesc || undefined,
      org_email: orgEmail || undefined,
      period_year: orgPeriod,
      is_maintenance: orgMaintenance,
    });
    if (!parsed.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setOrgErrors(fieldErrors);
      return;
    }
    setOrgErrors({});
    setOrgLoading(true);

    let logoUrl = orgData?.org_logo_url || "";

    // Upload logo if file selected
    if (orgLogoFile) {
      const ext = orgLogoFile.name.split(".").pop();
      const filePath = `org/logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, orgLogoFile, { upsert: true });

      if (uploadError) {
        setOrgErrors({ _form: "Gagal upload logo: " + uploadError.message });
        setOrgLoading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      logoUrl = urlData.publicUrl;
    }

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...parsed.data, org_logo_url: logoUrl || null }),
    });
    const json = await res.json();
    if (!json.success) {
      setOrgErrors({ _form: json.error?.message || "Gagal menyimpan." });
    } else {
      setOrgData(json.data);
      setOrgLogoPreview(logoUrl);
      setOrgLogoFile(null);
      window.dispatchEvent(new Event("org-settings-updated"));
    }
    setOrgLoading(false);
  };

  // ─── Division: Open Modal ───
  const openDivModal = (div?: Division) => {
    if (div) {
      setDivEditId(div.id);
      setDivName(div.name);
      setDivDesc(div.description);
    } else {
      setDivEditId(null);
      setDivName("");
      setDivDesc("");
    }
    setDivErrors({});
    setShowDivModal(true);
  };

  // ─── Division: Submit ───
  const handleDivSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = divisionFormSchema.safeParse({
      name: divName,
      description: divDesc || undefined,
    });
    if (!parsed.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setDivErrors(fieldErrors);
      return;
    }
    setDivErrors({});
    setDivLoading(true);
    const url = divEditId ? `/api/divisions/${divEditId}` : "/api/divisions";
    const method = divEditId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const json = await res.json();
    setDivLoading(false);
    if (!json.success) {
      setDivErrors({ _form: json.error?.message || "Gagal menyimpan." });
      return;
    }
    setShowDivModal(false);
    fetchDivisions();
  };

  // ─── Division: Delete ───
  const deleteDivision = async (id: string) => {
    if (!confirm("Hapus divisi ini?")) return;
    await fetch(`/api/divisions/${id}`, { method: "DELETE" });
    fetchDivisions();
  };

  // ─── Fakultas/Jurusan: Open Modal ───
  const openFjModal = (item?: (Fakultas | Jurusan) & { fakultas?: Pick<Fakultas, "id" | "name"> | null }) => {
    if (item) {
      setFjEditId(item.id);
      setFjName(item.name);
      setFjDesc(item.description);
      if (fjTab === "jurusan") {
        setFjFakultasId((item as Jurusan).fakultas_id || "");
      } else {
        setFjFakultasId("");
      }
    } else {
      setFjEditId(null);
      setFjName("");
      setFjDesc("");
      setFjFakultasId("");
    }
    setFjErrors({});
    setShowFjModal(true);
  };

  // ─── Fakultas/Jurusan: Submit ───
  const handleFjSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const schema = fjTab === "fakultas" ? fakultasFormSchema : jurusanFormSchema;
    const input = fjTab === "fakultas"
      ? { name: fjName, description: fjDesc || undefined }
      : { name: fjName, description: fjDesc || undefined, fakultas_id: fjFakultasId || undefined };

    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setFjErrors(fieldErrors);
      return;
    }
    setFjErrors({});
    setFjLoading(true);

    const baseUrl = fjTab === "fakultas" ? "/api/fakultas" : "/api/jurusan";
    const url = fjEditId ? `${baseUrl}/${fjEditId}` : baseUrl;
    const method = fjEditId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const json = await res.json();
    setFjLoading(false);
    if (!json.success) {
      setFjErrors({ _form: json.error?.message || "Gagal menyimpan." });
      return;
    }
    setShowFjModal(false);
    fetchFakultas();
    fetchJurusan();
  };

  // ─── Fakultas/Jurusan: Delete ───
  const deleteFj = async (id: string) => {
    if (!confirm(`Hapus ${fjTab === "fakultas" ? "fakultas" : "jurusan"} ini?`)) return;
    const baseUrl = fjTab === "fakultas" ? "/api/fakultas" : "/api/jurusan";
    await fetch(`${baseUrl}/${id}`, { method: "DELETE" });
    fetchFakultas();
    fetchJurusan();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Pengaturan</h2>
        <p className="text-muted-foreground">Konfigurasi profil, organisasi, dan data master</p>
      </div>

      {/* ─── Tab Navigation ─── */}
      <div className="flex gap-1 border-b border-border">
        {allTabs
          .filter((tab) => !tab.adminOnly || user?.role === "ADMIN")
          .map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
      </div>

      {/* ════════════════════════════════════════════════
           TAB 1: PROFILE
           ════════════════════════════════════════════════ */}
      {activeTab === "profile" && (
        <Card>
          <CardHeader>
            <CardTitle>Pengaturan Profil Saya</CardTitle>
            <CardDescription>Ubah data profil pribadi Anda</CardDescription>
          </CardHeader>
          <CardContent>
            {user ? (
              <div className="space-y-6 max-w-2xl">
                {/* Avatar Upload */}
                <div className="flex items-start gap-6">
                  <div className="shrink-0">
                    <Avatar
                      src={profileAvatarPreview || profileAvatarUrl}
                      alt={user.full_name}
                      fallback={user.full_name.charAt(0).toUpperCase()}
                      className="h-24 w-24 text-2xl"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="text-sm font-medium">Foto Profil</label>
                    <p className="text-xs text-muted-foreground">Format: PNG, JPG, atau WebP. Tanpa batas ukuran file.</p>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setProfileAvatarFile(file);
                          setProfileAvatarPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                    />
                    {profileAvatarFile && (
                      <p className="text-xs text-muted-foreground">{profileAvatarFile.name}</p>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-3">Data Diri</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="pname">Nama Lengkap <span className="text-red-500">*</span></label>
                      <Input id="pname" value={profileName} onChange={(e) => setProfileName(e.target.value)} />
                      {profileErrors.full_name && <p className="text-sm text-red-500">{profileErrors.full_name}</p>}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Email</label>
                      <Input value={user.email} disabled />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">NIM</label>
                      <Input value={user.nim} disabled />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="pphone">No. Telepon</label>
                      <Input id="pphone" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} placeholder="-" />
                      {profileErrors.phone_number && <p className="text-sm text-red-500">{profileErrors.phone_number}</p>}
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-3">Informasi Keanggotaan</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Role</span><Badge>{user.role}</Badge></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant={user.status === "AKTIF" ? "success" : "secondary"}>{user.status}</Badge></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Divisi</span><span>{user.divisions?.name ?? "-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Fakultas</span><span>{user.fakultas?.name ?? "-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Jurusan</span><span>{user.jurusan?.name ?? "-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Bergabung</span><span>{new Date(user.joined_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span></div>
                  </div>
                </div>

                {profileErrors._form && <p className="text-sm text-red-500 text-center">{profileErrors._form}</p>}
                <Button type="button" disabled={profileLoading} onClick={handleProfileSubmit}>{profileLoading ? "Menyimpan..." : "Simpan Profil"}</Button>
              </div>
            ) : (
              <p className="text-muted-foreground">Memuat data...</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Athlete Spider Chart (visible on profile tab) */}
      {activeTab === "profile" && user && athleteScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Statistik Kategori Latihan</CardTitle>
            <CardDescription>Skor rata-rata berdasarkan data penilaian</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <SpiderChart
                data={athleteScores.map((s) => ({
                  category: s.category,
                  value: s.avg_score,
                }))}
                size={320}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════════
           TAB 2: PENGATURAN USER
           ════════════════════════════════════════════════ */}
      {activeTab === "pengaturan-user" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pengaturan User</CardTitle>
                <CardDescription>Atur role pengguna dalam sistem.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowTambahUser(true)}>+ Tambah User</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Cari nama atau NIM..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="max-w-sm"
            />
            {userRoleError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
                {userRoleError}
              </div>
            )}
            <div className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>NIM</TableHead>
                    <TableHead>Divisi</TableHead>
                    <TableHead>Fakultas</TableHead>
                    <TableHead>Jurusan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="w-32">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Memuat data...</TableCell>
                    </TableRow>
                  ) : allUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Tidak ada pengguna.</TableCell>
                    </TableRow>
                  ) : (
                    allUsers.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <p className="font-medium">{u.full_name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{u.nim}</TableCell>
                        <TableCell className="text-sm">{u.divisions?.name ?? "-"}</TableCell>
                        <TableCell className="text-sm">{u.fakultas?.name ?? "-"}</TableCell>
                        <TableCell className="text-sm">{u.jurusan?.name ?? "-"}</TableCell>
                        <TableCell>
                          <Badge variant={u.status === "AKTIF" ? "success" : "secondary"}>{u.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            disabled={savingRole === u.id}
                          >
                            <option value="ANGGOTA">Anggota</option>
                            <option value="KABID">Kabid</option>
                            <option value="PELATIH">Pelatih</option>
                            <option value="PEMBINA">Pembina</option>
                            <option value="BENDAHARA">Bendahara</option>
                            <option value="SEKRETARIS">Sekretaris</option>
                            <option value="PENGURUS_INTI">Pengurus Inti</option>
                            <option value="WAKIL_KETUA">Wakil Ketua</option>
                            <option value="KETUA_UMUM">Ketua Umum</option>
                            <option value="ADMIN">Admin</option>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {savingRole === u.id && <span className="text-xs text-muted-foreground">Menyimpan...</span>}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════════
           TAB 3: ORGANIZATION
           ════════════════════════════════════════════════ */}
      {activeTab === "organization" && (
        <Card>
          <CardHeader>
            <CardTitle>Informasi Organisasi</CardTitle>
            <CardDescription>Konfigurasi data organisasi (hanya Admin)</CardDescription>
          </CardHeader>
          <CardContent>
            {user?.role !== "ADMIN" ? (
              <p className="text-muted-foreground text-center py-8">Anda tidak memiliki akses untuk mengubah pengaturan organisasi.</p>
            ) : orgData ? (
              <form onSubmit={handleOrgSubmit} className="space-y-4 max-w-lg">
                {/* Logo Upload */}
                <div className="flex items-start gap-6">
                  <div className="shrink-0">
                    {orgLogoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={orgLogoPreview} alt="Logo Organisasi" className="h-20 w-20 rounded-xl object-cover border" />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-muted text-2xl font-bold text-muted-foreground border">
                        {orgName ? orgName.charAt(0).toUpperCase() : "O"}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="text-sm font-medium">Logo Organisasi</label>
                    <p className="text-xs text-muted-foreground">Format: PNG, JPG, atau WebP. Tanpa batas ukuran file.</p>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setOrgLogoFile(file);
                          setOrgLogoPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                    />
                    {orgLogoFile && (
                      <p className="text-xs text-muted-foreground">{orgLogoFile.name}</p>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="orgName">Nama Organisasi <span className="text-red-500">*</span></label>
                    <Input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                    {orgErrors.org_name && <p className="text-sm text-red-500">{orgErrors.org_name}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="orgDesc">Deskripsi</label>
                    <Input id="orgDesc" value={orgDesc} onChange={(e) => setOrgDesc(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="orgEmail">Email Organisasi</label>
                    <Input id="orgEmail" type="email" value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="orgPeriod">Periode <span className="text-red-500">*</span></label>
                    <Input id="orgPeriod" value={orgPeriod} onChange={(e) => setOrgPeriod(e.target.value)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Mode Pemeliharaan</p>
                      <p className="text-xs text-muted-foreground">Nonaktifkan akses pengguna biasa</p>
                    </div>
                    <button type="button" onClick={() => setOrgMaintenance(!orgMaintenance)}>
                      <Badge variant={orgMaintenance ? "destructive" : "success"}>
                        {orgMaintenance ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </button>
                  </div>
                </div>
                {orgErrors._form && <p className="text-sm text-red-500 text-center">{orgErrors._form}</p>}
                <Button type="submit" disabled={orgLoading}>{orgLoading ? "Menyimpan..." : "Simpan Perubahan"}</Button>
              </form>
            ) : (
              <p className="text-muted-foreground">Memuat data...</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════════
           TAB 3: DIVISIONS
           ════════════════════════════════════════════════ */}
      {activeTab === "divisions" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Divisi</CardTitle>
                <CardDescription>Kelola data divisi organisasi</CardDescription>
              </div>
              <Button size="sm" onClick={() => openDivModal()}>+ Tambah Divisi</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Divisi</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {divisions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      Belum ada divisi.
                    </TableCell>
                  </TableRow>
                ) : (
                  divisions.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{d.description}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => openDivModal(d)}>Edit</Button>
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteDivision(d.id)}>Hapus</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════════
           TAB 4: FAKULTAS & JURUSAN
           ════════════════════════════════════════════════ */}
      {activeTab === "fakultas-jurusan" && (
        <div className="space-y-4">
          {/* Sub-tab Fakultas / Jurusan */}
          <div className="flex gap-1 border-b border-border">
            <button onClick={() => setFjTab("fakultas")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${fjTab === "fakultas" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>Fakultas</button>
            <button onClick={() => setFjTab("jurusan")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${fjTab === "jurusan" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>Jurusan</button>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{fjTab === "fakultas" ? "Fakultas" : "Jurusan"}</CardTitle>
                <Button size="sm" onClick={() => openFjModal()}>+ Tambah</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Deskripsi</TableHead>
                    {fjTab === "jurusan" && <TableHead>Fakultas</TableHead>}
                    <TableHead className="w-24 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(fjTab === "fakultas" ? fakultasList : jurusanList).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={fjTab === "jurusan" ? 4 : 3} className="text-center py-8 text-muted-foreground">
                        Belum ada data.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (fjTab === "fakultas" ? fakultasList : jurusanList).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{item.description}</TableCell>
                        {fjTab === "jurusan" && (
                          <TableCell className="text-muted-foreground text-sm">
                            {(item as typeof jurusanList[number]).fakultas?.name || "-"}
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => openFjModal(item)}>Edit</Button>
                            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteFj(item.id)}>Hapus</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
           </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════════
           TAB 5: KAS & BANK
           ════════════════════════════════════════════════ */}
      {activeTab === "kas-bank" && (
        <div className="space-y-4">
          <div className="flex gap-1 border-b border-border">
            <button onClick={() => setKbTab("bank")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${kbTab === "bank" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>Bank</button>
            <button onClick={() => setKbTab("kas")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${kbTab === "kas" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>Kas</button>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{kbTab === "bank" ? "Data Bank" : "Data Kas"}</CardTitle>
                <Button size="sm" onClick={() => kbTab === "bank" ? openBankModal() : openCashModal()}>+ Tambah</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    {kbTab === "bank" && <TableHead>No. Rekening</TableHead>}
                    {kbTab === "bank" && <TableHead>Atas Nama</TableHead>}
                    <TableHead>Deskripsi</TableHead>
                    <TableHead className="w-24 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(kbTab === "bank" ? banksList : cashList).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={kbTab === "bank" ? 5 : 3} className="text-center py-8 text-muted-foreground">
                        Belum ada data.
                      </TableCell>
                    </TableRow>
                  ) : kbTab === "bank" ? (
                    banksList.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.name}</TableCell>
                        <TableCell className="text-sm font-mono">{b.account_number}</TableCell>
                        <TableCell className="text-sm">{b.account_holder}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{b.description || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => openBankModal(b)}>Edit</Button>
                            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteBank(b.id)}>Hapus</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    cashList.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell colSpan={2} className="text-muted-foreground text-sm">{c.description || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => openCashModal(c)}>Edit</Button>
                            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteCash(c.id)}>Hapus</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════════
           TAB 6: DOMPET
           ════════════════════════════════════════════════ */}
      {activeTab === "dompet" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Dompet</CardTitle>
                <CardDescription>Kelola dompet dalam setiap Bank atau Kas</CardDescription>
              </div>
              <Button size="sm" onClick={() => openWalletModal()}>+ Tambah Dompet</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Dompet</TableHead>
                  <TableHead>Pemilik</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {walletsList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Belum ada dompet.
                    </TableCell>
                  </TableRow>
                ) : (
                  walletsList.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">{w.name}</TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="outline">{w.banks?.name || w.cash_accounts?.name || "-"}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{w.description || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={w.is_active ? "success" : "secondary"}>
                          {w.is_active ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => openWalletModal(w)}>Edit</Button>
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteWallet(w.id)}>Hapus</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════════
           MODAL: Tambah User
           ════════════════════════════════════════════════ */}
      {showTambahUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowTambahUser(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Tambah User</h3>
              <button onClick={() => setShowTambahUser(false)} className="p-1 hover:bg-muted rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleTambahUser} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Pilih Anggota <span className="text-red-500">*</span></label>
                <Select value={tambahUserId} onChange={(e) => setTambahUserId(e.target.value)}>
                  <option value="">-- Pilih anggota --</option>
                  {allUsers
                    .filter((u) => u.id !== user?.id)
                    .sort((a, b) => a.full_name.localeCompare(b.full_name))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.nim}) - {u.role}
                      </option>
                    ))}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Role <span className="text-red-500">*</span></label>
                <Select value={tambahUserRole} onChange={(e) => setTambahUserRole(e.target.value)}>
                  <option value="ANGGOTA">Anggota</option>
                  <option value="KABID">Kabid</option>
                  <option value="PELATIH">Pelatih</option>
                  <option value="PEMBINA">Pembina</option>
                  <option value="BENDAHARA">Bendahara</option>
                  <option value="SEKRETARIS">Sekretaris</option>
                  <option value="PENGURUS_INTI">Pengurus Inti</option>
                  <option value="WAKIL_KETUA">Wakil Ketua</option>
                  <option value="KETUA_UMUM">Ketua Umum</option>
                  <option value="ADMIN">Admin</option>
                </Select>
              </div>
              {tambahUserError && <p className="text-sm text-red-500 text-center">{tambahUserError}</p>}
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={tambahUserLoading} className="flex-1">
                  {tambahUserLoading ? "Menyimpan..." : "Simpan"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowTambahUser(false)}>Batal</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
           MODAL: Divisi / Fakultas / Jurusan
           ════════════════════════════════════════════════ */}
      {(showDivModal || showFjModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setShowDivModal(false); setShowFjModal(false); }} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold">
                  {showDivModal
                    ? (divEditId ? "Edit Divisi" : "Tambah Divisi")
                    : (fjEditId ? `Edit ${fjTab === "fakultas" ? "Fakultas" : "Jurusan"}` : `Tambah ${fjTab === "fakultas" ? "Fakultas" : "Jurusan"}`)}
                </h3>
              </div>
              <button onClick={() => { setShowDivModal(false); setShowFjModal(false); }} className="p-1 hover:bg-muted rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={showDivModal ? handleDivSubmit : handleFjSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nama <span className="text-red-500">*</span></label>
                <Input value={showDivModal ? divName : fjName} onChange={(e) => showDivModal ? setDivName(e.target.value) : setFjName(e.target.value)} />
                {(showDivModal ? divErrors : fjErrors).name && <p className="text-sm text-red-500">{(showDivModal ? divErrors : fjErrors).name}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Deskripsi</label>
                <Input value={showDivModal ? divDesc : fjDesc} onChange={(e) => showDivModal ? setDivDesc(e.target.value) : setFjDesc(e.target.value)} />
              </div>
              {showFjModal && fjTab === "jurusan" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fakultas</label>
                  <Select value={fjFakultasId} onChange={(e) => setFjFakultasId(e.target.value)}>
                    <option value="">Pilih fakultas</option>
                    {fakultasList.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </Select>
                  {fjErrors.fakultas_id && <p className="text-sm text-red-500">{fjErrors.fakultas_id}</p>}
                </div>
              )}
              {(showDivModal ? divErrors : fjErrors)._form && (
                <p className="text-sm text-red-500 text-center">{(showDivModal ? divErrors : fjErrors)._form}</p>
              )}
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={showDivModal ? divLoading : fjLoading} className="flex-1">
                  {(showDivModal ? divLoading : fjLoading) ? "Menyimpan..." : "Simpan"}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowDivModal(false); setShowFjModal(false); }}>Batal</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
           MODAL: Bank
           ════════════════════════════════════════════════ */}
      {showBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowBankModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">{bankEditId ? "Edit Bank" : "Tambah Bank"}</h3>
              <button onClick={() => setShowBankModal(false)} className="p-1 hover:bg-muted rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleBankSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nama Bank <span className="text-red-500">*</span></label>
                <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Contoh: BCA, Mandiri" />
                {bankErrors.name && <p className="text-sm text-red-500">{bankErrors.name}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nomor Rekening <span className="text-red-500">*</span></label>
                <Input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} placeholder="1234567890" />
                {bankErrors.account_number && <p className="text-sm text-red-500">{bankErrors.account_number}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Atas Nama <span className="text-red-500">*</span></label>
                <Input value={bankAccountHolder} onChange={(e) => setBankAccountHolder(e.target.value)} placeholder="Nama pemegang rekening" />
                {bankErrors.account_holder && <p className="text-sm text-red-500">{bankErrors.account_holder}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Keterangan</label>
                <Input value={bankDesc} onChange={(e) => setBankDesc(e.target.value)} placeholder="Opsional" />
              </div>
              {bankErrors._form && <p className="text-sm text-red-500 text-center">{bankErrors._form}</p>}
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={bankLoading} className="flex-1">
                  {bankLoading ? "Menyimpan..." : "Simpan"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowBankModal(false)}>Batal</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
           MODAL: Kas
           ════════════════════════════════════════════════ */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCashModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">{cashEditId ? "Edit Kas" : "Tambah Kas"}</h3>
              <button onClick={() => setShowCashModal(false)} className="p-1 hover:bg-muted rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleCashSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nama Kas <span className="text-red-500">*</span></label>
                <Input value={cashName} onChange={(e) => setCashName(e.target.value)} placeholder="Contoh: Kas Utama" />
                {cashErrors.name && <p className="text-sm text-red-500">{cashErrors.name}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Keterangan</label>
                <Input value={cashDesc} onChange={(e) => setCashDesc(e.target.value)} placeholder="Opsional" />
              </div>
              {cashErrors._form && <p className="text-sm text-red-500 text-center">{cashErrors._form}</p>}
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={cashLoading} className="flex-1">
                  {cashLoading ? "Menyimpan..." : "Simpan"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCashModal(false)}>Batal</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
           MODAL: Dompet
           ════════════════════════════════════════════════ */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowWalletModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">{walletEditId ? "Edit Dompet" : "Tambah Dompet"}</h3>
              <button onClick={() => setShowWalletModal(false)} className="p-1 hover:bg-muted rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleWalletSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nama Dompet <span className="text-red-500">*</span></label>
                <Input value={walletName} onChange={(e) => setWalletName(e.target.value)} placeholder="Contoh: Dompet Operasional" />
                {walletErrors.name && <p className="text-sm text-red-500">{walletErrors.name}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Milik Bank</label>
                <Select value={walletBankId} onChange={(e) => { setWalletBankId(e.target.value); if (e.target.value) setWalletCashId(""); }}>
                  <option value="">Tidak dari bank</option>
                  {banksList.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} - {b.account_number}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Milik Kas</label>
                <Select value={walletCashId} onChange={(e) => { setWalletCashId(e.target.value); if (e.target.value) setWalletBankId(""); }}>
                  <option value="">Tidak dari kas</option>
                  {cashList.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
                {walletErrors.bank_id && <p className="text-sm text-red-500">{walletErrors.bank_id}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Keterangan</label>
                <Input value={walletDesc} onChange={(e) => setWalletDesc(e.target.value)} placeholder="Opsional" />
              </div>
              {walletErrors._form && <p className="text-sm text-red-500 text-center">{walletErrors._form}</p>}
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={walletLoading} className="flex-1">
                  {walletLoading ? "Menyimpan..." : "Simpan"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowWalletModal(false)}>Batal</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
