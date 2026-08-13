"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

interface CameraCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (blob: Blob) => Promise<void> | void;
}

export default function CameraCapture({ open, onClose, onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError("");
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            "Tidak dapat mengakses kamera. Periksa izin akses kamera atau gunakan tombol batal. (" +
              (err instanceof Error ? err.message : "") +
              ")"
          );
        }
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || saving) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );
    if (!blob) return;
    setSaving(true);
    try {
      await onCapture(blob);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-background p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Capture Foto Nota</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="aspect-[3/4] w-full rounded-lg bg-black object-cover"
          />
        )}
        <div className="flex items-center justify-center gap-2">
          <Button type="button" onClick={handleCapture} disabled={saving || !!error}>
            <Camera className="mr-2 h-4 w-4" />
            {saving ? "Menyimpan..." : "Ambil Foto"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
        </div>
      </div>
    </div>
  );
}
