"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

export interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutDatum[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}

const FALLBACK_COLORS = ["#bb2233", "#fa8603", "#0a0f24", "#e8848f", "#f7b46b", "#4a5266", "#c0505d", "#e8a24f"];

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DonutDatum }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border bg-background/95 px-2.5 py-1.5 text-xs shadow-lg">
      <p className="font-semibold">{d.label}</p>
      <p className="font-bold" style={{ color: d.color || "var(--primary)" }}>
        {d.value}
      </p>
    </div>
  );
}

export function DonutChart({
  data,
  size = 160,
  thickness = 22,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const filtered = data.filter((d) => d.value > 0);

  const chartData = filtered.map((d, i) => ({
    ...d,
    color: d.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
  }));

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <PieChart width={size} height={size}>
          <Pie
            data={chartData}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius={(size - thickness) / 2}
            outerRadius={size / 2}
            strokeWidth={0}
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-stat-sm font-bold text-foreground">
            {centerValue ?? (total ? String(total) : "0")}
          </span>
          {centerLabel && (
            <span className="text-[10px] text-muted-foreground">
              {centerLabel}
            </span>
          )}
        </div>
      </div>

      <div className="min-w-0 space-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: d.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length] }}
              />
              <span className="break-words text-muted-foreground">{d.label}</span>
            </span>
            <span className="shrink-0 font-semibold">{d.value}</span>
          </div>
        ))}
        {data.length === 0 && (
          <p className="text-sm text-muted-foreground">Tidak ada data</p>
        )}
      </div>
    </div>
  );
}
