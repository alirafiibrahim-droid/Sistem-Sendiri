// ============================================================================
// SIORG Modul Pelaporan (A13) — Definisi katalog laporan & utilitas
// ============================================================================

export type ReportFilterType =
  | "date_range"
  | "date"
  | "select"
  | "text"
  | "mode";

export interface ReportFilterField {
  key: string;
  label: string;
  type: ReportFilterType;
  required?: boolean;
  options?: { value: string; label: string }[];
  /** Sumber opsi dinamis yang diambil dari API oleh klien. */
  source?: "divisions" | "fakultas" | "jurusan" | "programs" | "projects" | "accounts" | "handovers" | "none";
  defaultValue?: string;
  help?: string;
}

export interface ReportDefinition {
  slug: string;
  code: string;
  title: string;
  description: string;
  module: string;
  icon: string;
  roles: string[];
  filters: ReportFilterField[];
}

// Role inti (ketua umum, wakil, inti, sekretaris, bendahara) + ADMIN
const CORE = [
  "KETUA_UMUM",
  "WAKIL_KETUA",
  "PENGURUS_INTI",
  "SEKRETARIS",
  "BENDAHARA",
];
const CORE_KABID = [...CORE, "KABID"];
const CORE_PELATIH = [...CORE, "PELATIH"];

export const REPORT_MODULES = [
  { key: "Keanggotaan", icon: "👥" },
  { key: "Keuangan", icon: "💰" },
  { key: "Program Kerja", icon: "📋" },
  { key: "Absensi", icon: "📌" },
  { key: "Keatletan", icon: "🏃" },
  { key: "Prestasi", icon: "🏆" },
  { key: "Inventaris", icon: "📦" },
  { key: "Persuratan", icon: "✉️" },
  { key: "Proyek Insidental", icon: "🔧" },
];

const programStatusOptions = [
  { value: "PLANNED", label: "Direncanakan" },
  { value: "ONGOING", label: "Berjalan" },
  { value: "COMPLETED", label: "Selesai" },
  { value: "CANCELLED", label: "Dibatalkan" },
];

const financeTypeOptions = [
  { value: "INCOME", label: "Pemasukan" },
  { value: "EXPENSE", label: "Pengeluaran" },
];

const inventoryCategoryOptions = [
  { value: "ELECTRONICS", label: "Elektronik" },
  { value: "FURNITURE", label: "Meubelair" },
  { value: "STATIONERY", label: "ATK" },
  { value: "DOCUMENTS", label: "Dokumen" },
  { value: "OTHER", label: "Lainnya" },
];

const inventoryConditionOptions = [
  { value: "GOOD", label: "Baik" },
  { value: "DAMAGED_LIGHT", label: "Rusak Ringan" },
  { value: "DAMAGED_HEAVY", label: "Rusak Berat" },
  { value: "LOST", label: "Hilang" },
];

const inventoryLoanStatusOptions = [
  { value: "PENDING", label: "Menunggu" },
  { value: "APPROVED", label: "Disetujui" },
  { value: "REJECTED", label: "Ditolak" },
  { value: "RETURNED", label: "Dikembalikan" },
  { value: "OVERDUE", label: "Terlambat" },
];

const projectStatusOptions = [
  { value: "PROPOSED", label: "Diajukan" },
  { value: "APPROVED", label: "Disetujui" },
  { value: "ONGOING", label: "Berjalan" },
  { value: "CLOSED", label: "Selesai" },
];

const achievementLevelOptions = [
  { value: "Lokal", label: "Lokal" },
  { value: "Kota", label: "Kota" },
  { value: "Provinsi", label: "Provinsi" },
  { value: "Nasional", label: "Nasional" },
  { value: "Internasional", label: "Internasional" },
];

export const REPORT_CATALOG: ReportDefinition[] = [
  // ------------------------- KATEGORI: KATEGORI
  {
    slug: "rpt-mbr-01",
    code: "RPT-MBR-01",
    title: "Laporan Total Anggota",
    description:
      "Ringkasan total anggota atau detail (nama, email, jurusan, fakultas, tanggal dibuat) berdasarkan rentang waktu dan filter fakultas/jurusan.",
    module: "Keanggotaan",
    icon: "👥",
    roles: CORE_KABID,
    filters: [
      {
        key: "mode",
        label: "Mode Laporan",
        type: "mode",
        options: [
          { value: "detail", label: "Detail" },
          { value: "ringkas", label: "Ringkas" },
        ],
        defaultValue: "detail",
      },
      {
        key: "date_from",
        label: "Tanggal Awal",
        type: "date",
        required: true,
      },
      { key: "date_to", label: "Tanggal Akhir", type: "date" },
      { key: "fakultas_id", label: "Fakultas", type: "select", source: "fakultas" },
      { key: "jurusan_id", label: "Jurusan", type: "select", source: "jurusan" },
    ],
  },
  // ------------------------- KEUANGAN
  {
    slug: "rpt-fin-01",
    code: "RPT-FIN-01",
    title: "Realisasi Anggaran per Program Kerja",
    description:
      "Perbandingan anggaran (rencana) setiap proker terhadap realisasi pengeluaran yang mereferensikan proker tersebut, lengkap dengan sisa dan persentase.",
    module: "Keuangan",
    icon: "💰",
    roles: CORE_KABID,
    filters: [
      { key: "division_id", label: "Divisi", type: "select", source: "divisions" },
      { key: "status", label: "Status Proker", type: "select", options: programStatusOptions },
    ],
  },
  {
    slug: "rpt-fin-02",
    code: "RPT-FIN-02",
    title: "Total Saldo Kas/Bank/Dompet",
    description:
      "Saldo seluruh Kas, Bank, dan Dompet organisasi pada tanggal cut-off yang dipilih.",
    module: "Keuangan",
    icon: "💰",
    roles: CORE,
    filters: [
      { key: "cut_off_date", label: "Tanggal Cut-off", type: "date", required: true },
      { key: "account_id", label: "Akun", type: "select", source: "accounts" },
    ],
  },
  {
    slug: "rpt-fin-03",
    code: "RPT-FIN-03",
    title: "Pemasukan / Pengeluaran",
    description:
      "Seluruh mutasi pemasukan dan/atau pengeluaran dalam rentang tanggal, dengan ringkasan total dan selisih.",
    module: "Keuangan",
    icon: "💰",
    roles: CORE,
    filters: [
      { key: "date_from", label: "Tanggal Awal", type: "date", required: true },
      { key: "date_to", label: "Tanggal Akhir", type: "date" },
      { key: "type", label: "Tipe Transaksi", type: "select", options: financeTypeOptions },
      { key: "program_id", label: "Program Kerja", type: "select", source: "programs" },
      { key: "account_id", label: "Akun", type: "select", source: "accounts" },
    ],
  },
  // ------------------------- PROGRAM KERJA
  {
    slug: "rpt-prg-01",
    code: "RPT-PRG-01",
    title: "Laporan Program Kerja per Periode",
    description:
      "Total program kerja pada periode Sertijab tertentu, lengkap dengan divisi, status, jadwal, dan anggaran.",
    module: "Program Kerja",
    icon: "📋",
    roles: CORE_KABID,
    filters: [
      {
        key: "handover_id",
        label: "Periode Sertijab",
        type: "select",
        source: "handovers",
        required: true,
      },
      { key: "division_id", label: "Divisi", type: "select", source: "divisions" },
      { key: "status", label: "Status Proker", type: "select", options: programStatusOptions },
    ],
  },
  {
    slug: "rpt-prg-02",
    code: "RPT-PRG-02",
    title: "Laporan Nilai per Program Kerja",
    description:
      "Ringkasan total nilai per program kerja (mode Ringkas) atau rincian nilai per sesi kegiatan (mode Detail) dari penilaian peserta.",
    module: "Program Kerja",
    icon: "📋",
    roles: CORE_KABID,
    filters: [
      {
        key: "handover_id",
        label: "Periode Sertijab",
        type: "select",
        source: "handovers",
        required: true,
      },
      {
        key: "mode",
        label: "Mode Laporan",
        type: "mode",
        options: [
          { value: "detail", label: "Detail" },
          { value: "ringkas", label: "Ringkas" },
        ],
        defaultValue: "detail",
      },
      { key: "program_id", label: "Program Kerja", type: "select", source: "programs" },
      { key: "division_id", label: "Divisi", type: "select", source: "divisions" },
    ],
  },
  {
    slug: "rpt-prg-03",
    code: "RPT-PRG-03",
    title: "Laporan Absensi per Program Kerja",
    description:
      "Ringkasan total peserta hadir per program kerja (mode Ringkas) atau rincian anggota yang hadir per program (mode Detail).",
    module: "Program Kerja",
    icon: "📋",
    roles: CORE_KABID,
    filters: [
      {
        key: "handover_id",
        label: "Periode Sertijab",
        type: "select",
        source: "handovers",
        required: true,
      },
      {
        key: "mode",
        label: "Mode Laporan",
        type: "mode",
        options: [
          { value: "detail", label: "Detail" },
          { value: "ringkas", label: "Ringkas" },
        ],
        defaultValue: "detail",
      },
      { key: "program_id", label: "Program Kerja", type: "select", source: "programs" },
      { key: "division_id", label: "Divisi", type: "select", source: "divisions" },
    ],
  },
  // ------------------------- ABSENSI
  {
    slug: "rpt-att-01",
    code: "RPT-ATT-01",
    title: "Rekap Kehadiran per Kegiatan/Sesi",
    description:
      "Kehadiran per sesi kegiatan program kerja: tanggal, jam, jumlah hadir dan tidak hadir, serta daftar nama hadir.",
    module: "Absensi",
    icon: "📌",
    roles: CORE_KABID,
    filters: [
      { key: "date_from", label: "Tanggal Awal", type: "date", required: true },
      { key: "date_to", label: "Tanggal Akhir", type: "date" },
      { key: "program_id", label: "Program Kerja", type: "select", source: "programs" },
    ],
  },
  {
    slug: "rpt-att-02",
    code: "RPT-ATT-02",
    title: "Rekap Kehadiran per Anggota",
    description:
      "Total kehadiran dan persentase kehadiran setiap anggota beserta rincian sesi yang dihadiri (tanggal & jam).",
    module: "Absensi",
    icon: "📌",
    roles: CORE_KABID,
    filters: [
      { key: "date_from", label: "Tanggal Awal", type: "date", required: true },
      { key: "date_to", label: "Tanggal Akhir", type: "date" },
      { key: "division_id", label: "Divisi", type: "select", source: "divisions" },
    ],
  },
  // ------------------------- KEATLETAN
  {
    slug: "rpt-ath-01",
    code: "RPT-ATH-01",
    title: "Rekap Kehadiran Pelatih",
    description:
      "Jumlah sesi latihan yang diampu setiap pelatih (role PELATIH) beserta rincian sesinya.",
    module: "Keatletan",
    icon: "🏃",
    roles: CORE_PELATIH,
    filters: [
      { key: "date_from", label: "Tanggal Awal", type: "date", required: true },
      { key: "date_to", label: "Tanggal Akhir", type: "date" },
    ],
  },
  {
    slug: "rpt-ath-02",
    code: "RPT-ATH-02",
    title: "Rata-rata Nilai per Atlet",
    description:
      "Nilai rata-rata tiap atlet per variabel metrik performa (baris = atlet, kolom = metrik).",
    module: "Keatletan",
    icon: "🏃",
    roles: CORE_PELATIH,
    filters: [
      { key: "date_from", label: "Tanggal Awal", type: "date" },
      { key: "date_to", label: "Tanggal Akhir", type: "date" },
    ],
  },
  {
    slug: "rpt-ath-03",
    code: "RPT-ATH-03",
    title: "Rata-rata Nilai Seluruh Atlet",
    description:
      "Nilai rata-rata seluruh atlet per metrik performa, beserta nilai terendah dan tertinggi.",
    module: "Keatletan",
    icon: "🏃",
    roles: CORE_PELATIH,
    filters: [
      { key: "date_from", label: "Tanggal Awal", type: "date" },
      { key: "date_to", label: "Tanggal Akhir", type: "date" },
    ],
  },
  // ------------------------- PRESTASI
  {
    slug: "rpt-ach-01",
    code: "RPT-ACH-01",
    title: "Rekap Prestasi per Periode",
    description:
      "Prestasi yang telah disetujui (APPROVED) pada periode tanggal tertentu beserta peserta yang terlibat.",
    module: "Prestasi",
    icon: "🏆",
    roles: CORE_KABID,
    filters: [
      { key: "date_from", label: "Tanggal Awal", type: "date", required: true },
      { key: "date_to", label: "Tanggal Akhir", type: "date" },
      { key: "level", label: "Tingkat", type: "select", options: achievementLevelOptions },
    ],
  },
  // ------------------------- INVENTARIS
  {
    slug: "rpt-inv-01",
    code: "RPT-INV-01",
    title: "Total Item Inventaris",
    description: "Total jenis barang dan total unit stok inventaris, dirinci per kategori.",
    module: "Inventaris",
    icon: "📦",
    roles: CORE_KABID,
    filters: [
      { key: "category", label: "Kategori", type: "select", options: inventoryCategoryOptions },
    ],
  },
  {
    slug: "rpt-inv-02",
    code: "RPT-INV-02",
    title: "Total Nilai (Rp) Inventaris",
    description: "Total nilai inventaris berdasarkan stok dikali harga satuan (unit_price).",
    module: "Inventaris",
    icon: "📦",
    roles: CORE_KABID,
    filters: [
      { key: "category", label: "Kategori", type: "select", options: inventoryCategoryOptions },
    ],
  },
  {
    slug: "rpt-inv-03",
    code: "RPT-INV-03",
    title: "Pembelian Inventaris",
    description: "Riwayat pembelian barang inventaris dalam rentang tanggal.",
    module: "Inventaris",
    icon: "📦",
    roles: CORE_KABID,
    filters: [
      { key: "date_from", label: "Tanggal Awal", type: "date", required: true },
      { key: "date_to", label: "Tanggal Akhir", type: "date" },
    ],
  },
  {
    slug: "rpt-inv-04",
    code: "RPT-INV-04",
    title: "Peminjaman Inventaris",
    description: "Riwayat peminjaman barang beserta status dan total transaksi per status.",
    module: "Inventaris",
    icon: "📦",
    roles: CORE_KABID,
    filters: [
      { key: "date_from", label: "Tanggal Awal", type: "date", required: true },
      { key: "date_to", label: "Tanggal Akhir", type: "date" },
      { key: "status", label: "Status", type: "select", options: inventoryLoanStatusOptions },
    ],
  },
  {
    slug: "rpt-inv-05",
    code: "RPT-INV-05",
    title: "Penghapusan Inventaris",
    description: "Riwayat penghapusan aset (disposal) beserta nilai yang dihapus.",
    module: "Inventaris",
    icon: "📦",
    roles: CORE_KABID,
    filters: [
      { key: "date_from", label: "Tanggal Awal", type: "date", required: true },
      { key: "date_to", label: "Tanggal Akhir", type: "date" },
    ],
  },
  {
    slug: "rpt-inv-06",
    code: "RPT-INV-06",
    title: "Kondisi Inventaris",
    description: "Ringkasan jumlah unit per kondisi barang serta rincian barang per kondisi.",
    module: "Inventaris",
    icon: "📦",
    roles: CORE_KABID,
    filters: [
      { key: "category", label: "Kategori", type: "select", options: inventoryCategoryOptions },
      { key: "condition", label: "Kondisi", type: "select", options: inventoryConditionOptions },
    ],
  },
  // ------------------------- PERSURATAN
  {
    slug: "rpt-ltr-01",
    code: "RPT-LTR-01",
    title: "Surat Masuk per Periode",
    description: "Arsip surat masuk pada rentang tanggal yang dipilih.",
    module: "Persuratan",
    icon: "✉️",
    roles: CORE_KABID,
    filters: [
      { key: "date_from", label: "Tanggal Awal", type: "date", required: true },
      { key: "date_to", label: "Tanggal Akhir", type: "date" },
    ],
  },
  {
    slug: "rpt-ltr-02",
    code: "RPT-LTR-02",
    title: "Surat Keluar per Periode",
    description: "Arsip surat keluar pada rentang tanggal yang dipilih.",
    module: "Persuratan",
    icon: "✉️",
    roles: CORE_KABID,
    filters: [
      { key: "date_from", label: "Tanggal Awal", type: "date", required: true },
      { key: "date_to", label: "Tanggal Akhir", type: "date" },
    ],
  },
  // ------------------------- PROYEK INSIDENTAL
  {
    slug: "rpt-prj-01",
    code: "RPT-PRJ-01",
    title: "Total Proyek Insidental",
    description: "Total proyek insidental pada periode tertentu beserta total dana proyek.",
    module: "Proyek Insidental",
    icon: "🔧",
    roles: CORE_KABID,
    filters: [
      { key: "date_from", label: "Tanggal Awal", type: "date", required: true },
      { key: "date_to", label: "Tanggal Akhir", type: "date" },
      { key: "status", label: "Status", type: "select", options: projectStatusOptions },
    ],
  },
  {
    slug: "rpt-prj-02",
    code: "RPT-PRJ-02",
    title: "Anggaran Proyek Insidental",
    description: "Total anggaran, dana masuk, dan dana keluar setiap proyek insidental.",
    module: "Proyek Insidental",
    icon: "🔧",
    roles: CORE_KABID,
    filters: [
      { key: "date_from", label: "Tanggal Awal", type: "date", required: true },
      { key: "date_to", label: "Tanggal Akhir", type: "date" },
      { key: "status", label: "Status", type: "select", options: projectStatusOptions },
    ],
  },
];

export function getReportBySlug(slug: string): ReportDefinition | undefined {
  return REPORT_CATALOG.find((r) => r.slug === slug);
}

export function isReportAllowed(report: ReportDefinition, role: string | null): boolean {
  if (!role) return false;
  if (role === "ADMIN") return true;
  return report.roles.includes(role);
}

export function canAccessReports(role: string | null): boolean {
  return REPORT_CATALOG.some((r) => isReportAllowed(r, role));
}

// ----------------------------------------------------------------------------
// Label & format helpers
// ----------------------------------------------------------------------------

export function formatRp(value: number | null | undefined): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const PROGRAM_STATUS_LABEL: Record<string, string> = {
  PLANNED: "Direncanakan",
  ONGOING: "Berjalan",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

export const FINANCE_TYPE_LABEL: Record<string, string> = {
  INCOME: "Pemasukan",
  EXPENSE: "Pengeluaran",
};

export const LOAN_STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  RETURNED: "Dikembalikan",
  OVERDUE: "Terlambat",
};

export const INVENTORY_CONDITION_LABEL: Record<string, string> = {
  GOOD: "Baik",
  DAMAGED_LIGHT: "Rusak Ringan",
  DAMAGED_HEAVY: "Rusak Berat",
  LOST: "Hilang",
};

export const INVENTORY_CATEGORY_LABEL: Record<string, string> = {
  ELECTRONICS: "Elektronik",
  FURNITURE: "Meubelair",
  STATIONERY: "ATK",
  DOCUMENTS: "Dokumen",
  OTHER: "Lainnya",
};

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  PROPOSED: "Diajukan",
  APPROVED: "Disetujui",
  ONGOING: "Berjalan",
  CLOSED: "Selesai",
};

export const LETTER_TYPE_LABEL: Record<string, string> = {
  INCOMING: "Surat Masuk",
  OUTGOING: "Surat Keluar",
};

export const ACHIEVEMENT_JUARA_LABEL: Record<string, string> = {
  JUARA_I: "Juara I",
  JUARA_II: "Juara II",
  JUARA_III: "Juara III",
  JUARA_HARAPAN: "Juara Harapan",
};
