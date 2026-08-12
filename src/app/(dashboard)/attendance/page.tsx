"use client";

import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SessionType = "program" | "training" | "project";

const SESSION_LABELS: Record<SessionType, string> = {
  program: "Sesi Program Kerja",
  training: "Sesi Latihan",
  project: "Sesi Proyek Insidental",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit", minute: "2-digit",
  });
}

type DashboardRecord = {
  id: string;
  user_id: string;
  user_name: string;
  user_nim: string | null;
  avatar_url: string | null;
  date: string;
  time: string;
  type: SessionType;
  session_name: string;
  method: string;
};

type SessionItem = {
  id: string;
  date: string;
  title: string | null;
  has_attended: boolean;
  program_name?: string;
  session_type?: string | null;
  name?: string | null;
  project_name?: string;
  training_name?: string | null;
  trainings?: { name: string } | null;
};

function AttendanceInner() {
  const searchParams = useSearchParams();
  const preselectedSession = searchParams.get("session") || "";
  const preselectedProgramSession = searchParams.get("program_session") || "";
  const preselectedProjectSession = searchParams.get("project_session") || "";
  const preselectedTrainingSession = searchParams.get("training_session") || "";
  const preselected = preselectedSession || preselectedProgramSession || preselectedProjectSession || preselectedTrainingSession;

  const [mode, setMode] = useState<"select" | "manual" | "qr">(
    preselected ? "qr" : "select"
  );
  const [view, setView] = useState<"presence" | "dashboard">("presence");
  const [sessionType, setSessionType] = useState<SessionType>("program");
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [attendedIds, setAttendedIds] = useState<Set<string>>(new Set());
  const [manualCode, setManualCode] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");

  // Dashboard state
  const [dashboardRecords, setDashboardRecords] = useState<DashboardRecord[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [canViewAll, setCanViewAll] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchSessions = useCallback(async (type: SessionType) => {
    setLoading(true);
    try {
      let url = "";
      if (type === "program") {
        url = "/api/attendance/program-sessions";
      } else if (type === "training") {
        url = "/api/attendance/training-sessions";
      } else {
        url = "/api/attendance/project-sessions";
      }
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        const items = json.data.map((s: SessionItem) => ({
          ...s,
        }));
        setSessions(items);
        const attended = new Set<string>();
        for (const s of items) {
          if (s.has_attended) attended.add(s.id);
        }
        setAttendedIds(attended);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSessions(sessionType);
  }, [sessionType, fetchSessions]);

  const fetchDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    setDashboardError("");
    try {
      const params = new URLSearchParams();
      if (nameFilter) params.set("name", nameFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (methodFilter !== "all") params.set("method", methodFilter);
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      const res = await fetch(`/api/attendance/dashboard?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setDashboardRecords(json.data.records);
        setTotalSessions(json.data.totalSessions);
        setCanViewAll(json.data.canViewAll);
      } else {
        setDashboardError(json.error?.message || "Gagal memuat data kehadiran.");
      }
    } catch {
      setDashboardError("Gagal terhubung ke server.");
    }
    setLoadingDashboard(false);
  }, [nameFilter, typeFilter, methodFilter, startDate, endDate]);

  useEffect(() => {
    if (view !== "dashboard") return;
    const t = setTimeout(() => {
      fetchDashboard();
    }, nameFilter ? 400 : 0);
    return () => clearTimeout(t);
  }, [view, nameFilter, typeFilter, methodFilter, startDate, endDate, fetchDashboard]);

  const handleAttendance = useCallback(async (id: string, method: "MANUAL" | "QR") => {
    setSubmitting(true);
    setMessage(null);

    let url = "";
    let body: Record<string, string> = {};

    if (sessionType === "program") {
      url = "/api/attendance/program-sessions";
      body = { session_id: id, method };
    } else if (sessionType === "training") {
      url = "/api/attendance/training-sessions";
      body = { session_id: id, method };
    } else {
      url = "/api/attendance/project-sessions";
      body = { session_id: id, method };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (json.success) {
      setMessage({ type: "success", text: "Kehadiran berhasil dicatat!" });
      setAttendedIds((prev) => new Set(prev).add(id));
    } else {
      setMessage({
        type: "error",
        text: json.error?.message || "Gagal mencatat kehadiran.",
      });
    }

    setSubmitting(false);
  }, [sessionType]);

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const handleQrDetected = useCallback((value: string) => {
    stopCamera();
    let sessionId = "";
    try {
      const url = new URL(value);
      sessionId = url.searchParams.get("session")
        || url.searchParams.get("program_session")
        || url.searchParams.get("project_session")
        || url.searchParams.get("training_session")
        || "";
    } catch {
      if (/^[0-9a-f-]{36}$/i.test(value)) {
        sessionId = value;
      }
    }
    if (sessionId) {
      // Determine session type from URL param to call correct endpoint
      let detectedType: SessionType | null = null;
      try {
        const url = new URL(value);
        if (url.searchParams.has("program_session")) detectedType = "program";
        else if (url.searchParams.has("project_session")) detectedType = "project";
        else if (url.searchParams.has("training_session")) detectedType = "training";
      } catch {}
      if (detectedType) setSessionType(detectedType);
      handleAttendance(sessionId, "QR");
    } else {
      setMessage({ type: "error", text: "QR Code tidak valid." });
    }
  }, [stopCamera, handleAttendance]);

  const startScanning = useCallback(() => {
    if (scanIntervalRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BD = (globalThis as any).BarcodeDetector;
    if (BD) {
      const detector = new BD({ formats: ["qr_code"] });
      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const value = barcodes[0].rawValue;
            handleQrDetected(value);
          }
        } catch {
          // ignore
        }
      }, 500);
    } else {
      setCameraError("Browser tidak mendukung QR scanner otomatis. Gunakan mode manual.");
    }
  }, [handleQrDetected]);

  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        startScanning();
      }
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Akses kamera ditolak. Berikan izin kamera di browser Anda."
          : "Tidak dapat mengakses kamera. Pastikan browser mendukung kamera."
      );
    }
  }, [startScanning]);

  useEffect(() => {
    if (!preselected || submitting || message) return;
    if (attendedIds.has(preselected)) {
      setMessage({ type: "success", text: "Anda sudah tercatat hadir di sesi ini." });
      return;
    }
    handleAttendance(preselected, "QR");
  }, [preselected, attendedIds, handleAttendance]);

  useEffect(() => {
    return () => { stopCamera(); };
  }, [stopCamera]);

  useEffect(() => {
    if (mode !== "qr" && cameraActive) stopCamera();
  }, [mode, cameraActive, stopCamera]);

  const handleManualAttendance = async () => {
    const code = manualCode.trim().toUpperCase();
    if (!code) {
      setMessage({ type: "error", text: "Kode Unit wajib diisi." });
      return;
    }
    if (!/^[A-Z0-9]{7}$/.test(code)) {
      setMessage({ type: "error", text: "Format Kode Unit tidak valid (7 karakter huruf/angka)." });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    let url = "";
    if (sessionType === "program") {
      url = "/api/attendance/program-sessions";
    } else if (sessionType === "training") {
      url = "/api/attendance/training-sessions";
    } else {
      url = "/api/attendance/project-sessions";
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "MANUAL", session_code: code }),
    });

    const json = await res.json();

    if (json.success) {
      setMessage({ type: "success", text: "Kehadiran berhasil dicatat!" });
      setManualCode("");
      fetchSessions(sessionType);
    } else {
      setMessage({
        type: "error",
        text: json.error?.message || "Gagal mencatat kehadiran.",
      });
    }

    setSubmitting(false);
  };

  const sessionTypes: SessionType[] = ["program", "training", "project"];

  const totalKehadiran = dashboardRecords.length;
  const countProgram = dashboardRecords.filter((r) => r.type === "program").length;
  const countTraining = dashboardRecords.filter((r) => r.type === "training").length;
  const countProject = dashboardRecords.filter((r) => r.type === "project").length;
  const uniqueUsers = new Set(dashboardRecords.map((r) => r.user_id)).size;
  const potential = totalSessions * (uniqueUsers > 0 ? uniqueUsers : 1);
  const attendancePercentage =
    potential > 0 ? Math.min(100, (totalKehadiran / potential) * 100) : 0;

  return (
    <div className={`space-y-6 mx-auto ${view === "dashboard" ? "max-w-5xl" : "max-w-2xl"}`}>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Absensi</h2>
        <p className="text-muted-foreground">
          {view === "dashboard"
            ? "Rekap riwayat kehadiran anggota pada seluruh sesi"
            : "Catat kehadiran Anda pada sesi pertemuan"}
        </p>
      </div>

      <div className="flex gap-3">
        <Button
          variant={view === "presence" ? "default" : "outline"}
          onClick={() => setView("presence")}
        >
          Catat Kehadiran
        </Button>
        <Button
          variant={view === "dashboard" ? "default" : "outline"}
          onClick={() => setView("dashboard")}
        >
          Dashboard
        </Button>
      </div>

      {view === "presence" && (
        <>
          {message && (
            <div
              className={`p-4 rounded-lg border ${
                message.type === "success"
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant={mode === "manual" ? "default" : "outline"}
              onClick={() => setMode("manual")}
            >
              Absensi Manual
            </Button>
            <Button
              variant={mode === "qr" ? "default" : "outline"}
              onClick={() => {
                setMode("qr");
                if (!cameraActive && !cameraError) {
                  setTimeout(() => startCamera(), 100);
                }
              }}
            >
              Scan QR Code
            </Button>
          </div>
        </>
      )}

      {view === "presence" && mode === "manual" && (
        <Card>
          <CardHeader>
            <CardTitle>Absensi Manual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {sessionTypes.map((st) => (
                <Button
                  key={st}
                  variant={sessionType === st ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSessionType(st)}
                >
                  {SESSION_LABELS[st]}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Kode Unit <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <Input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  maxLength={7}
                  placeholder="Contoh: K7MB2X9"
                  className="font-mono uppercase tracking-widest"
                />
                <Button disabled={submitting} onClick={handleManualAttendance}>
                  {submitting ? "Mengirim..." : "Hadir"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Masukkan Kode Unit sesi yang diberikan panitia/pelatih untuk mencatat kehadiran Anda.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Daftar sesi tersedia</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Sesi</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        Memuat...
                      </TableCell>
                    </TableRow>
                  ) : sessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        Tidak ada sesi tersedia.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sessions.map((s) => {
                      const name =
                        sessionType === "program"
                          ? s.program_name || "Sesi Program Kerja"
                          : sessionType === "training"
                            ? s.name || s.session_type || "Sesi Latihan"
                            : s.project_name || "Sesi Proyek Insidental";
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium text-sm max-w-[200px] truncate">
                            {name}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(s.date)}
                          </TableCell>
                          <TableCell>
                            {attendedIds.has(s.id) ? (
                              <Badge variant="success">Hadir</Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {view === "presence" && mode === "qr" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Scan QR Code</span>
              {cameraActive && (
                <Button variant="outline" size="sm" onClick={stopCamera}>
                  Matikan Kamera
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {preselected && !cameraActive ? (
              submitting ? (
                <p className="text-muted-foreground text-center">Mencatat kehadiran...</p>
              ) : (
                <p className="text-muted-foreground text-center">
                  {message?.type === "success" ? "Kehadiran sudah tercatat." : "Memproses absensi..."}
                </p>
              )
            ) : (
              <>
                <div className="relative w-full max-w-md mx-auto aspect-[4/3] bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  {cameraActive && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-48 border-2 border-white/70 rounded-lg" />
                    </div>
                  )}
                </div>

                {cameraError && (
                  <p className="text-sm text-red-500 text-center">{cameraError}</p>
                )}

                {!cameraActive && !cameraError && (
                  <div className="text-center">
                    <Button onClick={startCamera}>Aktifkan Kamera</Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Arahkan kamera ke QR Code untuk absensi
                    </p>
                  </div>
                )}

                {cameraActive && (
                  <p className="text-sm text-muted-foreground text-center">
                    Arahkan kamera ke QR Code... otomatis terdeteksi.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {view === "dashboard" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Filter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {canViewAll && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nama Anggota</label>
                  <Input
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                    placeholder="Cari nama anggota..."
                    className="max-w-xs"
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Jenis Kehadiran</label>
                  <Select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-48"
                  >
                    <option value="all">Semua Jenis</option>
                    <option value="program">Sesi Program Kerja</option>
                    <option value="training">Sesi Latihan</option>
                    <option value="project">Sesi Proyek Insidental</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mode Absen</label>
                  <Select
                    value={methodFilter}
                    onChange={(e) => setMethodFilter(e.target.value)}
                    className="w-40"
                  >
                    <option value="all">Semua Mode</option>
                    <option value="MANUAL">Manual</option>
                    <option value="QR">QR Code</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rentang Tanggal Sesi</label>
                  <DateRangeFilter
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Kehadiran
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{totalKehadiran}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Sesi Program Kerja
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{countProgram}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Sesi Latihan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{countTraining}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Sesi Proyek Insidental
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{countProject}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Persentase Kehadiran
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{attendancePercentage.toFixed(1)}%</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {totalKehadiran} dari {potential} potensi kehadiran
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Riwayat Kehadiran</CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardError && (
                <p className="mb-4 text-sm text-destructive">{dashboardError}</p>
              )}
              {loadingDashboard ? (
                <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p className="text-sm">Memuat data...</p>
                </div>
              ) : dashboardRecords.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  Belum ada data kehadiran.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Anggota</TableHead>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Jam Kehadiran</TableHead>
                        <TableHead>Jenis Kehadiran</TableHead>
                        <TableHead>Nama Sesi</TableHead>
                        <TableHead>Mode Absen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboardRecords.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <p className="font-medium text-sm">{r.user_name}</p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {r.user_nim || "-"}
                            </p>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatDate(r.date)}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatTime(r.time)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {SESSION_LABELS[r.type]}
                          </TableCell>
                          <TableCell className="text-sm max-w-[220px] truncate">
                            {r.session_name}
                          </TableCell>
                          <TableCell>
                            <Badge variant={r.method === "QR" ? "default" : "secondary"}>
                              {r.method}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Memuat...</div>}>
      <AttendanceInner />
    </Suspense>
  );
}
