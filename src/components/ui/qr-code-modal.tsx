"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface QrCodeModalProps {
  open: boolean;
  label: string;
  title: string;
  dateText: string;
  url: string;
  loading: boolean;
  onClose: () => void;
}

export function QrCodeModal({ open, label, title, dateText, url, loading, onClose }: QrCodeModalProps) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const qrImage = url
    ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(url)}`
    : "";

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-background shadow-2xl">
        <div className="bg-gradient-to-br from-primary to-blue-600 px-6 pb-6 pt-5 text-primary-foreground">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-widest text-primary-foreground/70">
                {label}
              </p>
              <h2 className="mt-1 text-xl font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-primary-foreground/80">{dateText}</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Tutup"
              className="rounded-full bg-white/15 p-2 text-white transition-colors hover:bg-white/30"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="mt-3 text-sm">Memuat QR Code...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="rounded-xl border-2 border-dashed border-muted bg-white p-4 shadow-sm">
                {qrImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrImage}
                    alt="QR Code Absensi"
                    width={260}
                    height={260}
                    className="rounded-lg"
                  />
                ) : (
                  <p className="py-12 text-xs text-muted-foreground">Tidak ada URL QR.</p>
                )}
              </div>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Arahkan kamera ponsel peserta ke QR Code ini untuk mencatat kehadiran.
              </p>
              {url && (
                <Button variant="outline" size="sm" className="mt-3" onClick={handleCopy}>
                  {copied ? "Tersalin!" : "Salin Link Absensi"}
                </Button>
              )}
            </div>
          )}
          <Button variant="ghost" className="mt-5 w-full" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </div>
    </div>
  );
}
