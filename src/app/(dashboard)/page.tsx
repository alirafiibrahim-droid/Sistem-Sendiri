import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stats = [
  { title: "Program Aktif", value: "12", description: "Program kerja berlangsung", icon: "📋" },
  { title: "Total Anggota", value: "45", description: "Anggota aktif", icon: "👥" },
  { title: "Saldo Kas", value: "Rp 12.500.000", description: "Saldo organisasi", icon: "💰" },
  { title: "Prestasi", value: "8", description: "Prestasi tahun ini", icon: "🏆" },
];

const recentPrograms = [
  { name: "Seminar Kewirausahaan", status: "ONGOING", progress: 65 },
  { name: "Turnamen Futsal", status: "PLANNED", progress: 0 },
  { name: "Bakti Sosial", status: "COMPLETED", progress: 100 },
  { name: "Latihan Atletik", status: "ONGOING", progress: 40 },
];

const recentFinances = [
  { date: "2026-07-10", type: "INCOME", amount: 500000, desc: "Sponsor Seminar" },
  { date: "2026-07-11", type: "EXPENSE", amount: 150000, desc: "Pembelian Spanduk" },
  { date: "2026-07-12", type: "INCOME", amount: 200000, desc: "Iuran Anggota" },
  { date: "2026-07-13", type: "EXPENSE", amount: 75000, desc: "Snack Rapat" },
];

const statusColors: Record<string, string> = {
  ONGOING: "bg-blue-100 text-blue-800",
  PLANNED: "bg-gray-100 text-gray-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Selamat Datang</h2>
        <p className="text-muted-foreground">
          Ringkasan data organisasi Anda
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <span className="text-2xl">{stat.icon}</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Program Kerja Terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentPrograms.map((program) => (
                <div key={program.name} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{program.name}</p>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-32 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${program.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{program.progress}%</span>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusColors[program.status]}`}
                  >
                    {program.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transaksi Terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentFinances.map((tx, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{tx.desc}</p>
                    <p className="text-xs text-muted-foreground">{tx.date}</p>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      tx.type === "INCOME" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {tx.type === "INCOME" ? "+" : "-"} {formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
