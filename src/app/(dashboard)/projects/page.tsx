"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";


const projects = [
  {
    id: "1",
    name: "Panitia Wisuda Darurat",
    urgency: "HIGH",
    startDate: "2026-07-20",
    endDate: "2026-08-10",
    budgetSource: "Sponsor Eksternal + Kas Organisasi",
    status: "ONGOING",
    balance: 1200000,
    milestones: { done: 2, total: 5 },
  },
  {
    id: "2",
    name: "Penggalangan Dana Bencana",
    urgency: "NORMAL",
    startDate: "2026-06-01",
    endDate: "2026-07-31",
    budgetSource: "Donasi Internal",
    status: "CLOSED",
    balance: 0,
    milestones: { done: 3, total: 3 },
  },
  {
    id: "3",
    name: "Workshop Desain Grafis",
    urgency: "NORMAL",
    startDate: "2026-08-15",
    endDate: "2026-08-20",
    budgetSource: "Kas Organisasi",
    status: "APPROVED",
    balance: 500000,
    milestones: { done: 0, total: 4 },
  },
];

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  PROPOSED: "secondary",
  APPROVED: "warning",
  ONGOING: "default",
  CLOSED: "success",
};

const urgencyVariant: Record<string, "destructive" | "warning" | "secondary"> = {
  HIGH: "destructive",
  NORMAL: "warning",
  LOW: "secondary",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Proyek Insidental</h2>
          <p className="text-muted-foreground">Proyek ad-hoc di luar program kerja rutin</p>
        </div>
        <Button>+ Proyek Baru</Button>
      </div>

      <div className="space-y-4">
        {projects.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{p.name}</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{p.startDate} s/d {p.endDate || "Berlangsung"}</span>
                    <span>&middot;</span>
                    <span>{p.budgetSource}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={urgencyVariant[p.urgency]}>{p.urgency}</Badge>
                  <Badge variant={statusVariant[p.status]}>{p.status}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Saldo Dana</p>
                  <p className="text-lg font-semibold">{formatCurrency(p.balance)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Milestone</p>
                  <p className="text-lg font-semibold">{p.milestones.done}/{p.milestones.total}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Progres</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-2 flex-1 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(p.milestones.done / p.milestones.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs">
                      {Math.round((p.milestones.done / p.milestones.total) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline">Lihat Detail</Button>
                {p.status === "APPROVED" && (
                  <Button size="sm">Mulai Proyek</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
