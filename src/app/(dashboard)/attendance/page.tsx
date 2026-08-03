"use client";

import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    day: "2-digit", month: "short", year: "numeric",
  });
}

type SessionItem = {
  id: string;
  date: string;
  title: string | null;
  has_attended: boolean;
  program_name?: string;
  session_type?: string | null;
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
  const [sessionType, setSessionType] = useState<SessionType>("program");
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [attendedIds, setAttendedIds] = useState<Set<string>>(new Set());

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");

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

  useEffect(() => {
    if (!preselected || submitting || message) return;
    if (attendedIds.has(preselected)) {
      setMessage({ type: "success", text: "Anda sudah tercatat hadir di sesi ini." });
      return;
    }
    handleAttendance(preselected, "QR");
  }, [preselected, attendedIds]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, []);

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [stopCamera]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { stopCamera(); };
  }, [stopCamera]);

  useEffect(() => {
    if (mode !== "qr" && cameraActive) stopCamera();
  }, [mode, cameraActive, stopCamera]);

  const handleAttendance = async (id: string, method: "MANUAL" | "QR") => {
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
  };

  const sessionTypes: SessionType[] = ["program", "training", "project"];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Absensi</h2>
        <p className="text-muted-foreground">Catat kehadiran Anda pada sesi pertemuan</p>
      </div>

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

      {mode === "manual" && (
        <Card>
          <CardHeader>
            <CardTitle>Pilih Sesi</CardTitle>
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

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Sesi</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Aksi</TableHead>
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
                          ? s.session_type || "Sesi Latihan"
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
                            <Button
                              size="sm"
                              disabled={submitting}
                              onClick={() => handleAttendance(s.id, "MANUAL")}
                            >
                              {submitting ? "Mengirim..." : "Hadir"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {mode === "qr" && (
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
