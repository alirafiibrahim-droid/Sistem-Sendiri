"use client";

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export interface LineChartPoint {
  date: string;
  value: number;
}

export interface LineChartSeries {
  category: string;
  points: LineChartPoint[];
}

interface LineChartProps {
  series: LineChartSeries[];
  maxScore?: number;
  height?: number;
  className?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  STRENGTH: "Strength",
  POWER: "Power",
  SPEED: "Speed",
  AGILITY: "Agility",
  ENDURANCE: "Endurance",
  FLEXIBILITY: "Flexibility",
  TEKNIK: "Teknik",
  MENTAL: "Mental",
  GAME_INTELLIGENCE: "Game Intelligence",
};

const PALETTE = [
  "#bb2233", "#fa8603", "#0a0f24", "#e8848f", "#4a5266",
  "#f7b46b", "#c0505d", "#e8a24f", "#6b7280",
];

function formatShortDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit" });
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-background/95 px-2.5 py-1.5 text-xs shadow-lg">
      <p className="mb-1 font-semibold">{label ? formatShortDate(label) : ""}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-medium" style={{ color: PALETTE[i % PALETTE.length] }}>
          {CATEGORY_LABELS[p.dataKey] || p.dataKey}: {p.value}
        </p>
      ))}
    </div>
  );
}

export default function LineChart({
  series,
  maxScore = 10,
  height = 280,
  className,
}: LineChartProps) {
  if (series.length === 0) return null;

  const dates = Array.from(
    new Set(series.flatMap((s) => s.points.map((p) => p.date)))
  ).sort((a, b) => a.localeCompare(b));

  const chartData = dates.map((date) => {
    const row: Record<string, string | number | null> = { date };
    for (const s of series) {
      const pt = s.points.find((p) => p.date === date);
      row[s.category] = pt ? pt.value : null;
    }
    return row;
  });

  return (
    <div className={className}>
      <RechartsLineChart
        width={640}
        height={height}
        data={chartData}
        margin={{ top: 20, right: 28, bottom: 4, left: 0 }}
      >
        <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, maxScore]}
          tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip content={<CustomTooltip />} />
        {series.map((s, i) => (
          <Line
            key={s.category}
            type="monotone"
            dataKey={s.category}
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth={2}
            dot={{ r: 4, fill: "white", strokeWidth: 2, stroke: PALETTE[i % PALETTE.length] }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        ))}
      </RechartsLineChart>
      <div className="flex justify-center gap-4 mt-2">
        {series.map((s, i) => (
          <span
            key={s.category}
            className="flex items-center gap-1.5 text-xs font-medium"
          >
            <span
              className="w-3 h-0.5 rounded-full"
              style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
            />
            {CATEGORY_LABELS[s.category] || s.category}
          </span>
        ))}
      </div>
    </div>
  );
}
