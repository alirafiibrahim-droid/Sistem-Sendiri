"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Tooltip,
} from "recharts";

interface SpiderChartProps {
  data: Array<{ category: string; value: number }>;
  maxScore?: number;
  size?: number;
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

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { category: string; value: number } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border bg-background/95 px-2.5 py-1.5 text-xs shadow-lg">
      <p className="font-semibold">
        {CATEGORY_LABELS[d.category] || d.category}
      </p>
      <p className="font-bold text-primary">Nilai: {d.value}</p>
    </div>
  );
}

export default function SpiderChart({
  data,
  maxScore = 10,
  size = 300,
  className,
}: SpiderChartProps) {
  if (data.length === 0) return null;

  const chartData = data.map((d) => ({
    ...d,
    label: CATEGORY_LABELS[d.category] || d.category,
  }));

  return (
    <div className={className} style={{ width: size, height: size }}>
      <RadarChart
        width={size}
        height={size}
        data={chartData}
        cx="50%"
        cy="50%"
        outerRadius="70%"
      >
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis
          dataKey="label"
          tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontWeight: 500 }}
        />
        <Radar
          dataKey="value"
          stroke="var(--primary)"
          fill="var(--primary)"
          fillOpacity={0.15}
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--primary)", stroke: "white", strokeWidth: 2 }}
        />
        <Tooltip content={<CustomTooltip />} />
      </RadarChart>
    </div>
  );
}
