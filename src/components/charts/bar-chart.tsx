"use client";

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface BarChartProps {
  data: Array<{ label: string; value: number }>;
  maxScore?: number;
  height?: number;
  className?: string;
}

function barColor(value: number) {
  if (value >= 7) return "#16a34a";
  if (value >= 4) return "#fa8603";
  return "#dc2626";
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-background/95 px-2.5 py-1.5 text-xs shadow-lg">
      <p className="font-semibold">{label}</p>
      <p className="font-bold" style={{ color: barColor(payload[0].value) }}>
        Nilai: {payload[0].value}
      </p>
    </div>
  );
}

export default function BarChart({
  data,
  maxScore = 10,
  height = 220,
  className,
}: BarChartProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={data}
          margin={{ top: 20, right: 8, bottom: 4, left: 0 }}
        >
          <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, maxScore]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip content={<CustomTooltip />} cursor={false} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((entry, i) => (
              <Cell key={i} fill={barColor(entry.value)} fillOpacity={0.9} />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
