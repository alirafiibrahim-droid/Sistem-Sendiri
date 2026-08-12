"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
            S
          </div>
          <CardTitle className="text-2xl">SIORG</CardTitle>
          <CardDescription>Memuat...</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetDone = searchParams.get("reset") === "1";
  const callbackError = searchParams.get("error") === "callback";

  // ─── Mode Lupa Password ───
  const [forgotMode, setForgotMode] = useState(false);
  const [fpEmail, setFpEmail] = useState("");
  const [fpLoading, setFpLoading] = useState(false);
  const [fpError, setFpError] = useState("");
  const [fpSuccess, setFpSuccess] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createSupabaseClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError("");
    setFpSuccess("");

    if (cooldown > 0) return;

    if (!fpEmail || !fpEmail.includes("@")) {
      setFpError("Email wajib diisi dan harus valid.");
      return;
    }

    setFpLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fpEmail }),
      });
      const json = await res.json();
      if (!json.success) {
        const raw = json.error?.message || "";
        const isRateLimit =
          json.error?.code === "TOO_MANY_REQUESTS" ||
          /rate\s?limit/i.test(raw);
        if (isRateLimit) {
          setFpError(
            "Terlalu banyak permintaan reset password dalam waktu singkat. Silakan coba lagi sekitar 1 jam lagi."
          );
          setCooldown(60);
        } else {
          setFpError(raw || "Gagal mengirim link reset.");
        }
        setFpLoading(false);
        return;
      }
      setFpSuccess(
        json.data?.message ||
          "Link reset password telah dikirim ke email Anda. Periksa kotak masuk dan ikuti link yang diberikan."
      );
      setFpLoading(false);
    } catch {
      setFpError("Gagal terhubung ke server.");
      setFpLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
            S
          </div>
          <CardTitle className="text-2xl">{forgotMode ? "Lupa Password" : "SIORG"}</CardTitle>
          <CardDescription>
            {forgotMode
              ? "Masukkan email, kami kirimkan link untuk mengatur password baru"
              : "Sistem Informasi Organisasi Kemahasiswaan"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resetDone && !forgotMode && (
            <p className="mb-4 text-sm text-green-600 text-center">
              Password berhasil diubah. Silakan login dengan password baru Anda.
            </p>
          )}
          {callbackError && !forgotMode && (
            <p className="mb-4 text-sm text-red-500 text-center">
              Link tidak valid atau sudah kedaluwarsa. Silakan ulangi proses lupa password.
            </p>
          )}

          {!forgotMode ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">
                  Email atau Nama Lengkap
                </label>
                <Input
                  id="email"
                  placeholder="email@contoh.com atau Nama Lengkap"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Masuk..." : "Masuk"}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setForgotMode(true); setFpError(""); setFpSuccess(""); }}
                  className="text-sm text-primary hover:underline"
                >
                  Lupa Password?
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="fpEmail">
                  Email
                </label>
                <Input
                  id="fpEmail"
                  type="email"
                  placeholder="email@contoh.com"
                  value={fpEmail}
                  onChange={(e) => setFpEmail(e.target.value)}
                  required
                />
              </div>
              {fpError && (
                <p className="text-sm text-red-500 text-center">{fpError}</p>
              )}
              {fpSuccess && (
                <p className="text-sm text-green-600 text-center">{fpSuccess}</p>
              )}
              {!fpSuccess ? (
                <Button
                  type="submit"
                  className="w-full"
                  disabled={fpLoading || cooldown > 0}
                >
                  {fpLoading
                    ? "Mengirim..."
                    : cooldown > 0
                      ? `Coba lagi dalam ${cooldown} detik`
                      : "Kirim Link Reset"}
                </Button>
              ) : (
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => setForgotMode(false)}
                >
                  Kembali ke Login
                </Button>
              )}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setForgotMode(false); setFpError(""); setFpSuccess(""); }}
                  className="text-sm text-primary hover:underline"
                >
                  Kembali
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
