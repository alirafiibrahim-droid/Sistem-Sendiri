"use client";

import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TrainingSessionWithCoach } from "@/lib/types/database";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function ScanPageInner() {
  const searchParams = useSearchParams();
  const preselectedSession = searchParams.get("session") || "";

  const [mode, setMode] = useState<"select" | "manual" | "qr">(
    preselectedSession ? "qr" : "select"
  );
  const [sessions, setSessions] = useState<TrainingSessionWithCoach[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [attendedSessions, setAttendedSessions] = useState<Set<string>>(new Set());
  const [manualCode, setManualCode] = useState("");

  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/training-sessions?limit=50");
    const json = await res.json();
    if (json.success) setSessions(json.data);
    setLoading(false);
  }, []);

  const handleAttendance = useCallback(async (sessionId: string, method: "MANUAL" | "QR") => {
    setSubmitting(true);
    setMessage(null);

    const res = await fetch(`/api/training-sessions/${sessionId}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method }),
    });

    const json = await res.json();

    if (json.success) {
      setMessage({ type: "success", text: "Kehadiran berhasil dicatat!" });
      setAttendedSessions((prev) => new Set(prev).add(sessionId));
    } else {
      setMessage({
        type: "error",
        text: json.error?.message || "Gagal mencatat kehadiran.",
      });
    }

    setSubmitting(false);
  }, []);

  // Stop camera
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

  // Handle QR code detected
  const handleQrDetected = useCallback((value: string) => {
    stopCamera();

    // Extract session ID from URL like /athletics/scan?session=<id>
    let sessionId = "";
    try {
      const url = new URL(value);
      sessionId = url.searchParams.get("session") || "";
    } catch {
      // Maybe it's just a raw UUID
      if (/^[0-9a-f-]{36}$/i.test(value)) {
        sessionId = value;
      }
    }

    if (sessionId) {
      handleAttendance(sessionId, "QR");
    } else {
      setMessage({ type: "error", text: "QR Code tidak valid. Bukan link absensi yang dikenali." });
    }
  }, [stopCamera, handleAttendance]);

  // Scan QR from video frames
  const startScanning = useCallback(() => {
    if (scanIntervalRef.current) return;

    // Try native BarcodeDetector first
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
          // ignore detection errors
        }
      }, 500);
    } else {
      // Fallback: canvas-based detection not available, prompt manual
      setCameraError("Browser tidak mendukung QR scanner otomatis. Gunakan mode manual atau salin link absensi.");
    }
  }, [handleQrDetected]);

  // Start camera
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
    fetchSessions();
  }, [fetchSessions]);

  // Auto-submit if session param is provided
  useEffect(() => {
    if (!preselectedSession || submitting || message) return;
    if (attendedSessions.has(preselectedSession)) {
      setMessage({ type: "success", text: "Anda sudah tercatat hadir di sesi ini." });
      return;
    }
    handleAttendance(preselectedSession, "QR");
  }, [preselectedSession, attendedSessions, handleAttendance]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Stop camera when switching away from QR mode
  useEffect(() => {
    if (mode !== "qr" && cameraActive) {
      stopCamera();
    }
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

    const res = await fetch("/api/attendance/training-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "MANUAL", session_code: code }),
    });

    const json = await res.json();

    if (json.success) {
      setMessage({ type: "success", text: "Kehadiran berhasil dicatat!" });
      setManualCode("");
      fetchSessions();
    } else {
      setMessage({
        type: "error",
        text: json.error?.message || "Gagal mencatat kehadiran.",
      });
    }

    setSubmitting(false);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Absensi Sesi Latihan</h2>
        <p className="text-muted-foreground">Pilih metode absensi atau scan QR code</p>
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

      {/* Mode selector */}
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

      {/* Manual mode */}
      {mode === "manual" && (
        <Card>
          <CardHeader>
            <CardTitle>Absensi Manual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                Masukkan Kode Unit sesi latihan yang diberikan pelatih untuk mencatat kehadiran Anda.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Daftar sesi latihan</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Jenis Latihan</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        Memuat sesi...
                      </TableCell>
                    </TableRow>
                  ) : sessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        Tidak ada sesi latihan tersedia.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sessions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm">{formatDate(s.date)}</TableCell>
                        <TableCell className="font-medium">
                          {s.name || s.session_type || "-"}
                          {(s.trainings || []).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(s.trainings || []).map((t) => (
                                <Badge key={t.id} variant="outline" className="text-[10px]">
                                  {t.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {attendedSessions.has(s.id) ? (
                            <Badge variant="success">Hadir</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
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

      {/* QR mode with camera */}
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
            {preselectedSession && !cameraActive ? (
              submitting ? (
                <p className="text-muted-foreground text-center">Mencatat kehadiran...</p>
              ) : (
                <p className="text-muted-foreground text-center">
                  {message?.type === "success" ? "Kehadiran sudah tercatat." : "Memproses absensi..."}
                </p>
              )
            ) : (
              <>
                {/* Video element for camera */}
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
                    <Button onClick={startCamera}>
                      Aktifkan Kamera
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Arahkan kamera ke QR Code yang ditampilkan oleh pelatih
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

export default function ScanAttendancePage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Memuat...</div>}>
      <ScanPageInner />
    </Suspense>
  );
}
