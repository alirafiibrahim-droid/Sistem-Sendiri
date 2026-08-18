"use client";

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export interface CashflowPoint {
  month: string;
  income: number;
  expense: number;
}

interface CashflowChartProps {
  data: CashflowPoint[];
  height?: number;
}

const INCOME_COLOR = "#16a34a";
const EXPENSE_COLOR = "#dc2626";

function formatAxis(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}M`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}rb`;
  return String(value);
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-background/95 px-2.5 py-1.5 text-xs shadow-lg">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-medium" style={{ color: p.dataKey === "income" ? INCOME_COLOR : EXPENSE_COLOR }}>
          {p.dataKey === "income" ? "Pemasukan" : "Pengeluaran"}: Rp{p.value.toLocaleString("id-ID")}
        </p>
      ))}
    </div>
  );
}

export function CashflowChart({ data, height = 220 }: CashflowChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Tidak ada data</p>;
  }

  return (
    <div>
      <RechartsBarChart
        width={640}
        height={height}
        data={data}
        margin={{ top: 18, right: 8, bottom: 4, left: 0 }}
      >
        <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatAxis}
          tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} cursor={false} />
        <Bar dataKey="income" fill={INCOME_COLOR} radius={[3, 3, 0, 0]} fillOpacity={0.9} maxBarSize={28} />
        <Bar dataKey="expense" fill={EXPENSE_COLOR} radius={[3, 3, 0, 0]} fillOpacity={0.9} maxBarSize={28} />
      </RechartsBarChart>
      <div className="mt-2 flex justify-center gap-4 text-xs font-medium">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: INCOME_COLOR }} />
          Pemasukan
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: EXPENSE_COLOR }} />
          Pengeluaran
        </span>
      </div>
    </div>
  );
}
