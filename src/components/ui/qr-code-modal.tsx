"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden">
        <div className="bg-gradient-to-br from-primary to-blue-600 px-6 pb-6 pt-5 text-primary-foreground">
          <DialogHeader className="text-left">
            <DialogTitle className="text-primary-foreground">
              <p className="text-[11px] font-medium uppercase tracking-widest text-primary-foreground/70">
                {label}
              </p>
              <span className="text-xl font-semibold">{title}</span>
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/80">
              {dateText}
            </DialogDescription>
          </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}
