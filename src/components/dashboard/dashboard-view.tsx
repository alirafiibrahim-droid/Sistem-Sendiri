import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { DistributionBars } from "@/components/dashboard/distribution-bars";
import { CashflowChart } from "@/components/dashboard/cashflow-chart";
import { PeriodFilter } from "@/components/dashboard/period-filter";
import {
  type DashboardData,
  PROGRAM_STATUS_LABEL,
  USER_STATUS_LABEL,
  USER_ROLE_LABEL,
  ACHIEVEMENT_STATUS_LABEL,
  ACHIEVEMENT_JUARA_LABEL,
  HANDOVER_STATUS_LABEL,
  PROJECT_STATUS_LABEL,
  INVENTORY_CONDITION_LABEL,
  INVENTORY_LOAN_STATUS_LABEL,
  LETTER_TYPE_LABEL,
  formatRp,
  formatNumber,
} from "@/lib/dashboard";

// ----------------------------------------------------------------------------
// Utilitas tampilan
// ----------------------------------------------------------------------------

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

const PROGRAM_BADGE: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  ONGOING: "warning",
  PLANNED: "secondary",
  COMPLETED: "success",
  CANCELLED: "destructive",
};

const MEMBER_BADGE: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  AKTIF: "success",
  CUTI: "warning",
  ALUMNI: "secondary",
  NONAKTIF: "destructive",
};

const ACHIEVEMENT_BADGE: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "destructive",
};

const HANDOVER_BADGE: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  ONGOING: "success",
  NOT_STARTED: "secondary",
  COMPLETED: "secondary",
};

const PROJECT_BADGE: Record<string, "success" | "warning" | "secondary" | "destructive" | "default"> = {
  PROPOSED: "secondary",
  APPROVED: "default",
  ONGOING: "warning",
  CLOSED: "success",
};

const LOAN_BADGE: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  RETURNED: "secondary",
  OVERDUE: "destructive",
};

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "#6b7280",
  ONGOING: "#bb2233",
  COMPLETED: "#16a34a",
  CANCELLED: "#dc2626",
  AKTIF: "#16a34a",
  CUTI: "#fa8603",
  ALUMNI: "#6b7280",
  NONAKTIF: "#dc2626",
  APPROVED: "#16a34a",
  PENDING: "#fa8603",
  REJECTED: "#dc2626",
  PROPOSED: "#6b7280",
  CLOSED: "#16a34a",
  GOOD: "#16a34a",
  DAMAGED_LIGHT: "#fa8603",
  DAMAGED_HEAVY: "#f97316",
  LOST: "#dc2626",
};

function colorFor(status: string): string {
  return STATUS_COLORS[status] || "#3b82f6";
}

function StatusBadge({
  label,
  variant,
}: {
  label: string;
  variant: "success" | "warning" | "secondary" | "destructive" | "default";
}) {
  return <Badge variant={variant}>{label}</Badge>;
}

function EmptyState({ text = "Belum ada data" }: { text?: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>;
}

// ----------------------------------------------------------------------------
// Modul: Program Kerja
// ----------------------------------------------------------------------------

function ProgramSection({ data }: { data: DashboardData["programs"] }) {
  const donut = data.byStatus.map((s) => ({
    label: PROGRAM_STATUS_LABEL[s.status] || s.status,
    value: s.count,
    color: colorFor(s.status),
  }));

  return (
    <SectionCard title="Program Kerja" icon="📋" subtitle="Program kerja organisasi" href="/programs">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Total Proker" value={formatNumber(data.total)} />
        <StatCard label="Berjalan" value={formatNumber(data.active)} tone="warning" />
        <StatCard
          label="Direncanakan"
          value={formatNumber(data.byStatus.find((s) => s.status === "PLANNED")?.count || 0)}
          tone="muted"
        />
        <StatCard
          label="Selesai"
          value={formatNumber(data.byStatus.find((s) => s.status === "COMPLETED")?.count || 0)}
          tone="success"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Distribusi Status</h4>
          <DonutChart data={donut} centerLabel="Proker" />
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Terdekat / Berjalan</h4>
          {data.upcoming.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {data.upcoming.map((p) => (
                <Link key={p.id} href={`/programs/${p.id}`} className="block rounded-lg border p-3 hover:bg-secondary/40">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium">{p.name}</p>
                    <StatusBadge label={PROGRAM_STATUS_LABEL[p.status] || p.status} variant={PROGRAM_BADGE[p.status] || "secondary"} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.division_name || "Tanpa Divisi"} · {formatDate(p.start_date)}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${p.score != null ? Math.min(100, p.score * 10) : 0}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-foreground">
                        {p.score != null ? p.score.toFixed(1) : "-"}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                      {formatRp(p.budget_estimate)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

// ----------------------------------------------------------------------------
// Modul: Keuangan
// ----------------------------------------------------------------------------

function FinanceSection({ data }: { data: DashboardData["finances"] }) {
  if (!data.visible) {
    return (
      <SectionCard title="Keuangan" icon="💰" subtitle="Arus kas organisasi" href="/finances">
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Data keuangan hanya dapat diakses oleh pengurus yang berwenang.
          </CardContent>
        </Card>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Keuangan" icon="💰" subtitle="Arus kas organisasi" href="/finances">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard
          label="Saldo Kas"
          value={formatRp(data.balance)}
          tone={data.balance >= 0 ? "success" : "danger"}
        />
        <StatCard label="Pemasukan" value={formatRp(data.income)} tone="success" />
        <StatCard label="Pengeluaran" value={formatRp(data.expense)} tone="danger" />
        <StatCard label="Transaksi (6 bln)" value={formatNumber(data.monthly.length)} tone="muted" hint="Bulan tercatat" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Arus Kas 6 Bulan Terakhir</h4>
          <CashflowChart data={data.monthly} />
        </div>
        <div className="min-w-0">
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Transaksi Terbaru</h4>
          {data.recent.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-2">
              {data.recent.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                  </div>
                  <span
                    className={`text-sm font-semibold ${tx.type === "INCOME" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                  >
                    {tx.type === "INCOME" ? "+" : "-"} {formatRp(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

// ----------------------------------------------------------------------------
// Modul: Anggota
// ----------------------------------------------------------------------------

function MembersSection({ data }: { data: DashboardData["members"] }) {
  const donut = data.byStatus.map((s) => ({
    label: USER_STATUS_LABEL[s.status] || s.status,
    value: s.count,
    color: colorFor(s.status),
  }));

  return (
    <SectionCard title="Anggota" icon="👥" subtitle="Direktori pengurus & anggota" href="/members">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Total Anggota" value={formatNumber(data.total)} />
        <StatCard label="Aktif" value={formatNumber(data.active)} tone="success" />
        <StatCard
          label="Cuti"
          value={formatNumber(data.byStatus.find((s) => s.status === "CUTI")?.count || 0)}
          tone="warning"
        />
        <StatCard
          label="Alumni"
          value={formatNumber(data.byStatus.find((s) => s.status === "ALUMNI")?.count || 0)}
          tone="muted"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Status Keanggotaan</h4>
          <DonutChart data={donut} centerLabel="Anggota" />
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Distribusi per Divisi</h4>
          <DistributionBars
            data={data.byDivision.slice(0, 6).map((d) => ({ label: d.name, value: d.count }))}
          />
          {data.byDivision.length > 6 && (
            <p className="mt-2 text-xs text-muted-foreground">
              +{data.byDivision.length - 6} divisi lainnya
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Anggota Terbaru</h4>
        {data.recent.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
            {data.recent.map((m) => (
              <Link key={m.id} href={`/members/${m.id}`} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 hover:bg-secondary/40">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.nim} · {m.division_name || "Tanpa Divisi"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary">{USER_ROLE_LABEL[m.role] || m.role}</Badge>
                  <StatusBadge label={USER_STATUS_LABEL[m.status] || m.status} variant={MEMBER_BADGE[m.status] || "secondary"} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ----------------------------------------------------------------------------
// Modul: Absensi
// ----------------------------------------------------------------------------

function AttendanceSection({ data }: { data: DashboardData["attendance"] }) {
  const avg = data.totalSessions > 0 ? Math.round(data.totalRecords / data.totalSessions) : 0;

  return (
    <SectionCard title="Absensi" icon="📌" subtitle="Kehadiran kegiatan & latihan" href="/attendance">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Total Sesi" value={formatNumber(data.totalSessions)} />
        <StatCard label="Total Kehadiran" value={formatNumber(data.totalRecords)} tone="success" />
        <StatCard label="Rata-rata/Sesi" value={formatNumber(avg)} tone="warning" />
        <StatCard label="Jenis Sesi" value={formatNumber(data.byType.length)} tone="muted" />
      </div>

      <div className="mt-4">
        <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Kehadiran per Jenis Sesi</h4>
        {data.byType.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
            {data.byType.map((t) => (
              <div key={t.label} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span className="text-muted-foreground">{t.label}</span>
                <span className="font-semibold">
                  {formatNumber(t.records)} <span className="text-xs font-normal text-muted-foreground">hadir / {formatNumber(t.sessions)} sesi</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ----------------------------------------------------------------------------
// Modul: Keatletan
// ----------------------------------------------------------------------------

function AthleticsSection({ data }: { data: DashboardData["athletics"] }) {
  return (
    <SectionCard title="Keatletan" icon="🏃" subtitle="Latihan & performa atlet" href="/athletics">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Atlet" value={formatNumber(data.athleteCount)} />
        <StatCard label="Sesi Latihan" value={formatNumber(data.sessionCount)} tone="warning" />
        <StatCard label="Kehadiran" value={formatNumber(data.attendanceCount)} tone="success" />
        <StatCard label="Penilaian" value={formatNumber(data.assessmentCount)} tone="muted" />
      </div>
      <Card className="mt-4">
        <CardContent className="p-4">
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Sesi Latihan Terbaru</h4>
          {data.recentSessions.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-2">
              {data.recentSessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(s.date)}
                      {s.duration_minutes ? ` · ${s.duration_minutes} menit` : ""}
                      {s.intensity ? ` · Intensitas ${s.intensity}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold">{formatNumber(s.attendance)}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Hadir</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </SectionCard>
  );
}

// ----------------------------------------------------------------------------
// Modul: Prestasi
// ----------------------------------------------------------------------------

function AchievementSection({ data }: { data: DashboardData["achievements"] }) {
  const donut = data.byStatus.map((s) => ({
    label: ACHIEVEMENT_STATUS_LABEL[s.status] || s.status,
    value: s.count,
    color: colorFor(s.status),
  }));

  return (
    <SectionCard title="Prestasi" icon="🏆" subtitle="Pencapaian organisasi" href="/achievements">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Total Prestasi" value={formatNumber(data.total)} />
        <StatCard label="Terverifikasi" value={formatNumber(data.approved)} tone="success" />
        <StatCard
          label="Menunggu"
          value={formatNumber(data.byStatus.find((s) => s.status === "PENDING")?.count || 0)}
          tone="warning"
        />
        <StatCard
          label="Ditolak"
          value={formatNumber(data.byStatus.find((s) => s.status === "REJECTED")?.count || 0)}
          tone="danger"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Status Prestasi</h4>
          <DonutChart data={donut} centerLabel="Prestasi" />
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Prestasi Terbaru</h4>
          {data.recent.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-2">
              {data.recent.map((a) => (
                <div key={a.id} className="rounded-lg border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <StatusBadge label={ACHIEVEMENT_STATUS_LABEL[a.status] || a.status} variant={ACHIEVEMENT_BADGE[a.status] || "secondary"} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.level || "-"}
                    {a.juara ? ` · ${ACHIEVEMENT_JUARA_LABEL[a.juara] || a.juara}` : ""} · {formatDate(a.achievement_date)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

// ----------------------------------------------------------------------------
// Modul: Inventaris
// ----------------------------------------------------------------------------

function InventorySection({ data }: { data: DashboardData["inventory"] }) {
  return (
    <SectionCard title="Inventaris" icon="📦" subtitle="Aset & barang organisasi" href="/inventory">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Jenis Barang" value={formatNumber(data.itemCount)} />
        <StatCard label="Total Unit" value={formatNumber(data.totalStock)} />
        <StatCard label="Total Nilai" value={formatRp(data.totalValue)} tone="success" />
        <StatCard label="Pinjaman Aktif" value={formatNumber(data.activeLoans)} tone={data.activeLoans > 0 ? "warning" : "muted"} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Kondisi Barang (unit)</h4>
          <DistributionBars
            data={data.byCondition.map((c) => ({
              label: INVENTORY_CONDITION_LABEL[c.label] || c.label,
              value: c.count,
              color: colorFor(c.label),
            }))}
          />
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Peminjaman Terbaru</h4>
          {data.recentLoans.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-2">
              {data.recentLoans.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.item_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.borrower_name} · {formatNumber(l.quantity)} unit · {formatDate(l.borrow_date)}
                    </p>
                  </div>
                  <StatusBadge label={INVENTORY_LOAN_STATUS_LABEL[l.status] || l.status} variant={LOAN_BADGE[l.status] || "secondary"} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

// ----------------------------------------------------------------------------
// Modul: Persuratan
// ----------------------------------------------------------------------------

function LettersSection({ data }: { data: DashboardData["letters"] }) {
  return (
    <SectionCard title="Persuratan" icon="✉️" subtitle="Arsip surat masuk & keluar" href="/letters">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Total Surat" value={formatNumber(data.total)} />
        <StatCard label="Surat Masuk" value={formatNumber(data.incoming)} tone="success" />
        <StatCard label="Surat Keluar" value={formatNumber(data.outgoing)} tone="warning" />
        <StatCard label="Klasifikasi" value="-" tone="muted" />
      </div>

      <div className="mt-4">
        <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Surat Terbaru</h4>
        {data.recent.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
            {data.recent.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{l.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.reference_number} · {formatDate(l.date_received_sent)}
                  </p>
                </div>
                <StatusBadge label={LETTER_TYPE_LABEL[l.type] || l.type} variant={l.type === "INCOMING" ? "success" : "warning"} />
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ----------------------------------------------------------------------------
// Modul: Sertijab
// ----------------------------------------------------------------------------

function HandoverSection({ data }: { data: DashboardData["handovers"] }) {
  return (
    <SectionCard title="Sertijab" icon="📝" subtitle="Serah terima jabatan & periode" href="/handovers">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Total Periode" value={formatNumber(data.total)} />
        <StatCard
          label="Berjalan"
          value={formatNumber(data.byStatus.find((s) => s.status === "ONGOING")?.count || 0)}
          tone="success"
        />
        <StatCard
          label="Selesai"
          value={formatNumber(data.byStatus.find((s) => s.status === "COMPLETED")?.count || 0)}
          tone="muted"
        />
        <StatCard
          label="Belum Berjalan"
          value={formatNumber(data.byStatus.find((s) => s.status === "NOT_STARTED")?.count || 0)}
          tone="warning"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {data.current && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Periode Berjalan</h4>
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">
                    {data.current.period_from} – {data.current.period_to}
                  </p>
                  <StatusBadge label={HANDOVER_STATUS_LABEL[data.current.status] || data.current.status} variant={HANDOVER_BADGE[data.current.status] || "secondary"} />
                </div>
                {data.current.handover_date && (
                  <p className="mt-1 text-xs text-muted-foreground">Sertijab: {formatDate(data.current.handover_date)}</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Riwayat Periode</h4>
          {data.history.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-2">
              {data.history.map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span className="font-medium">
                    {h.period_from} – {h.period_to}
                  </span>
                  <StatusBadge label={HANDOVER_STATUS_LABEL[h.status] || h.status} variant={HANDOVER_BADGE[h.status] || "secondary"} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

// ----------------------------------------------------------------------------
// Modul: Proyek Insidental
// ----------------------------------------------------------------------------

function ProjectsSection({ data }: { data: DashboardData["projects"] }) {
  return (
    <SectionCard title="Proyek Insidental" icon="🔧" subtitle="Proyek di luar program kerja" href="/projects">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Total Proyek" value={formatNumber(data.total)} />
        <StatCard
          label="Berjalan"
          value={formatNumber(data.byStatus.find((s) => s.status === "ONGOING")?.count || 0)}
          tone="warning"
        />
        <StatCard label="Dana Masuk" value={formatRp(data.totalIncome)} tone="success" />
        <StatCard label="Dana Keluar" value={formatRp(data.totalExpense)} tone="danger" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Status Proyek</h4>
          <DistributionBars
            data={data.byStatus.map((s) => ({
              label: PROJECT_STATUS_LABEL[s.status] || s.status,
              value: s.count,
              color: colorFor(s.status),
            }))}
          />
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Proyek Terbaru</h4>
          {data.recent.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-2">
              {data.recent.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(p.start_date)}</p>
                  </div>
                  <StatusBadge label={PROJECT_STATUS_LABEL[p.status] || p.status} variant={PROJECT_BADGE[p.status] || "secondary"} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

// ----------------------------------------------------------------------------
// Komponen utama
// ----------------------------------------------------------------------------

export default function DashboardView({ data }: { data: DashboardData }) {
  const { overview } = data;
  const canSeeFinance = data.finances.visible;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="break-words text-xl font-bold tracking-tight sm:text-2xl">
            Selamat Datang, {overview.userName}
          </h2>
          <p className="break-words text-muted-foreground">
            {overview.orgName} · {overview.periodLabel || "Periode belum ditetapkan"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <PeriodFilter periods={data.periods} selected={data.selectedPeriodId} />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{USER_ROLE_LABEL[overview.userRole] || overview.userRole}</Badge>
            <span>{overview.dateLabel}</span>
          </div>
        </div>
      </div>

      {/* Ringkasan cepat */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/programs" className="group">
          <Card className="p-4 transition-colors group-hover:border-primary/50">
            <CardContent className="p-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">📋 Program Berjalan</p>
              <p className="mt-1.5 break-words text-stat font-bold text-foreground">{formatNumber(data.programs.active)}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/members" className="group">
          <Card className="p-4 transition-colors group-hover:border-primary/50">
            <CardContent className="p-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">👥 Anggota Aktif</p>
              <p className="mt-1.5 break-words text-stat font-bold text-foreground">{formatNumber(data.members.active)}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/finances" className="group">
          <Card className="p-4 transition-colors group-hover:border-primary/50">
            <CardContent className="p-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">💰 Saldo Kas</p>
              <p className="mt-1.5 min-w-0 break-words text-stat font-bold text-foreground">
                {canSeeFinance ? formatRp(data.finances.balance) : "—"}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/achievements" className="group">
          <Card className="p-4 transition-colors group-hover:border-primary/50">
            <CardContent className="p-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">🏆 Prestasi Terverifikasi</p>
              <p className="mt-1.5 break-words text-stat font-bold text-foreground">{formatNumber(data.achievements.approved)}</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Modul-modul operasi */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ProgramSection data={data.programs} />
        <FinanceSection data={data.finances} />
        <MembersSection data={data.members} />
        <AttendanceSection data={data.attendance} />
        <AthleticsSection data={data.athletics} />
        <AchievementSection data={data.achievements} />
        <InventorySection data={data.inventory} />
        <LettersSection data={data.letters} />
        <HandoverSection data={data.handovers} />
        <ProjectsSection data={data.projects} />
      </div>
    </div>
  );
}
