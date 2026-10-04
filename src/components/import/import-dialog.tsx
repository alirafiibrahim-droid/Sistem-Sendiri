"use client";

// ============================================================================
// SIORG — Import Dialog (Anggota / Keuangan / Inventaris / Persuratan)
// Alur: Unggah CSV -> Skrining -> (Perbaiki & unggah ulang) -> Simpan
//
// Aturan main:
//  - Server adalah sumber kebenaran. Skrining dijalankan ulang saat commit,
//    sehingga file bermasalah tidak akan pernah tersimpan.
//  - Tidak ada partial import: bila satu baris bermasalah, seluruh file ditolak.
//  - User dapat mengunduh file bermasalah (beserta kolom "Baris" & "Alasan")
//    untuk diperbaiki lalu diunggah ulang.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildCsv, downloadCsvFile } from "@/lib/import/csv";
import { getImportSpec } from "@/lib/import/specs";
import type { ImportModuleKey, ImportScreening } from "@/lib/import/types";

type Step = "upload" | "screening";

interface ImportDialogProps {
  module: ImportModuleKey;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dipanggil setelah data berhasil disimpan, untuk refresh tabel. */
  onImported?: () => void;
}

interface CommitResponse {
  saved: boolean;
  created?: number;
  failures?: { line: number; message: string }[];
  screening: ImportScreening;
  message: string;
}

export function ImportDialog({
  module,
  open,
  onOpenChange,
  onImported,
}: ImportDialogProps) {
  const spec = getImportSpec(module);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [csv, setCsv] = useState("");
  const [screening, setScreening] = useState<ImportScreening | null>(null);
  const [busy, setBusy] = useState<"idle" | "validating" | "saving">("idle");
  const [error, setError] = useState("");
  const [showValidRows, setShowValidRows] = useState(false);

  const reset = useCallback(() => {
    setStep("upload");
    setFileName("");
    setCsv("");
    setScreening(null);
    setBusy("idle");
    setError("");
    setShowValidRows(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  if (!spec) return null;

  const readApiError = async (res: Response): Promise<string> => {
    try {
      const json = await res.json();
      return json?.error?.message ?? "Terjadi kesalahan pada server.";
    } catch {
      return "Terjadi kesalahan pada server.";
    }
  };

  const handleTemplateDownload = () => {
    const headers = spec.fields.map((field) => field.header);
    const exampleRow = spec.fields.map((field) => field.example ?? "");
    downloadCsvFile(spec.filename, buildCsv(headers, [exampleRow]));
    toast.success("Template CSV berhasil diunduh.");
  };

  const handleFile = async (file: File) => {
    setError("");
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      setError("File harus berformat .csv");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Ukuran file maksimal 2 MB.");
      return;
    }

    const text = await file.text();
    setFileName(file.name);
    setCsv(text);
    setScreening(null);
    setBusy("validating");
    setStep("upload");

    try {
      const res = await fetch(`/api/import/${module}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text }),
      });
      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }
      const json = await res.json();
      setScreening(json.data as ImportScreening);
      setStep("screening");
    } catch {
      setError("Gagal menghubungi server. Periksa koneksi Anda.");
    } finally {
      setBusy("idle");
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const handleSave = async () => {
    if (!screening) return;
    setBusy("saving");
    setError("");

    try {
      const res = await fetch(`/api/import/${module}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });

      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }

      const json = (await res.json()) as { success: boolean; data: CommitResponse };
      const data = json.data;

      if (!data.saved) {
        setScreening(data.screening);
        toast.error(data.message);
        return;
      }

      toast.success(data.message);
      if (data.failures && data.failures.length > 0) {
        toast.warning(
          `${data.failures.length} baris gagal disimpan: baris ${data.failures
            .map((f) => f.line)
            .join(", ")}`
        );
      }
      onImported?.();
      onOpenChange(false);
    } catch {
      setError("Gagal menghubungi server. Periksa koneksi Anda.");
    } finally {
      setBusy("idle");
    }
  };

  const downloadProblemFile = () => {
    if (!screening) return;
    const headers = ["Baris", ...spec.fields.map((f) => f.header), "Alasan"];
    const problemRows = screening.rows
      .filter((row) => !row.valid)
      .map((row) => [
        String(row.line),
        ...spec.fields.map((field) => row.values[field.key] ?? ""),
        row.issues.map((i) => i.message).join(" | "),
      ]);
    downloadCsvFile(
      `data-bermasalah-${module}-${new Date().toISOString().slice(0, 10)}.csv`,
      buildCsv(headers, problemRows)
    );
    toast.success(`${problemRows.length} baris bermasalah berhasil diunduh.`);
  };

  const headerLabel = (key: string) =>
    spec.fields.find((field) => field.key === key)?.header ?? key;

  const blocked = screening
    ? screening.fileErrors.length > 0 || screening.invalidRows > 0 || screening.totalRows === 0
    : true;

  const visibleRows = screening
    ? showValidRows
      ? screening.rows
      : screening.rows.filter((row) => !row.valid)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Impor Data {spec.label}</DialogTitle>
          <DialogDescription>
            Unggah file CSV sesuai template. Sistem akan memeriksa setiap baris sebelum menyimpan data.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Langkah 1: Unggah */}
          {step === "upload" && (
            <>
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                <div className="text-sm">
                  <p className="font-medium">Langkah 1 — Unduh template & isi data</p>
                  <p className="text-muted-foreground">
                    Template berisi {spec.fields.length} kolom yang harus diisi sesuai kebutuhan.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleTemplateDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Template
                </Button>
              </div>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-10 text-center transition-colors hover:border-primary/60 hover:bg-muted/30"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium">
                  Tarik file CSV ke sini atau{" "}
                  <span className="text-primary underline">pilih file</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Format .csv, maksimal 2 MB. Baris pertama harus berisi header kolom.
                </p>
                {fileName && (
                  <p className="mt-1 text-xs font-medium">
                    File terakhir: <span className="underline">{fileName}</span>
                  </p>
                )}
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                  }}
                />
              </div>

              {busy === "validating" && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memeriksa file...
                </p>
              )}

              <details className="rounded-lg border p-3 text-sm">
                <summary className="cursor-pointer font-medium">
                  Lihat kolom yang harus diisi ({spec.fields.length})
                </summary>
                <ul className="mt-2 space-y-1">
                  {spec.fields.map((field) => (
                    <li key={field.key} className="flex gap-2">
                      <span className="font-mono text-xs">{field.header}</span>
                      <span className="text-muted-foreground">
                        {field.required ? "(wajib)" : "(opsional)"}
                        {field.hint ? ` — ${field.hint}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </>
          )}

          {/* Langkah 2: Hasil skrining */}
          {step === "screening" && screening && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryCard
                  label="Total Baris"
                  value={screening.totalRows}
                  icon={<FileSpreadsheet className="h-4 w-4" />}
                />
                <SummaryCard
                  label="Siap Impor"
                  value={screening.validRows}
                  tone={screening.validRows > 0 ? "success" : "neutral"}
                  icon={<CheckCircle2 className="h-4 w-4" />}
                />
                <SummaryCard
                  label="Bermasalah"
                  value={screening.invalidRows}
                  tone={screening.invalidRows > 0 ? "danger" : "neutral"}
                  icon={<XCircle className="h-4 w-4" />}
                />
              </div>

              {screening.fileErrors.map((fileError) => (
                <div
                  key={fileError}
                  className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{fileError}</span>
                </div>
              ))}

              {screening.unknownHeaders.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Kolom ini diabaikan karena tidak dikenali:{" "}
                  {screening.unknownHeaders.join(", ")}
                </p>
              )}

              {visibleRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {showValidRows
                        ? `Semua baris (${screening.rows.length})`
                        : `Baris bermasalah (${screening.invalidRows})`}
                    </p>
                    {screening.validRows > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowValidRows((prev) => !prev)}
                      >
                        {showValidRows ? "Sembunyikan baris valid" : "Tampilkan baris valid"}
                      </Button>
                    )}
                  </div>

                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-14">Baris</TableHead>
                          <TableHead>Isi Baris</TableHead>
                          <TableHead className="w-16">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleRows.map((row) => (
                          <TableRow key={row.line}>
                            <TableCell className="font-mono text-xs align-top">{row.line}</TableCell>
                            <TableCell className="align-top">
                              <p className="text-xs text-muted-foreground">
                                {spec.fields
                                  .map((field) => row.values[field.key])
                                  .filter((value) => value && value !== "")
                                  .join(" • ") || "(kosong)"}
                              </p>
                              {row.issues.length > 0 && (
                                <ul className="mt-1 space-y-0.5">
                                  {row.issues.map((rowIssue, idx) => (
                                    <li key={idx} className="text-xs text-red-600 dark:text-red-400">
                                      • <span className="font-medium">{headerLabel(rowIssue.field ?? "")}:</span>{" "}
                                      {rowIssue.message}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </TableCell>
                            <TableCell className="align-top">
                              {row.valid ? (
                                <Badge className="bg-green-600 hover:bg-green-600">Valid</Badge>
                              ) : (
                                <Badge variant="destructive">Ditolak</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            {step === "screening" && screening && screening.invalidRows > 0 && (
              <Button variant="outline" onClick={downloadProblemFile}>
                <Download className="mr-2 h-4 w-4" />
                Download File Bermasalah
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            {step === "screening" && (
              <Button variant="outline" onClick={reset} disabled={busy !== "idle"}>
                Unggah Ulang
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            {step === "screening" && (
              <Button onClick={handleSave} disabled={blocked || busy !== "idle"}>
                {busy === "saving" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>Simpan {screening?.totalRows ?? 0} Data</>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "neutral" | "success" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-green-600 dark:text-green-400"
      : tone === "danger"
        ? "text-red-600 dark:text-red-400"
        : "";
  return (
    <div className="rounded-lg border p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

interface ImportButtonProps {
  module: ImportModuleKey;
  onImported?: () => void;
  label?: string;
  variant?: "default" | "outline";
  className?: string;
}

/** Tombol "Impor" yang membuka ImportDialog. */
export function ImportButton({
  module,
  onImported,
  label = "Impor",
  variant = "outline",
  className,
}: ImportButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} className={className} onClick={() => setOpen(true)}>
        <Upload className="mr-2 h-4 w-4" />
        {label}
      </Button>
      <ImportDialog
        module={module}
        open={open}
        onOpenChange={setOpen}
        onImported={onImported}
      />
    </>
  );
}