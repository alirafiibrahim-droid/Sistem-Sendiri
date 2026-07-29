"use client";

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

const CATEGORY_SHORT: Record<string, string> = {
  STRENGTH: "STR",
  POWER: "PWR",
  SPEED: "SPD",
  AGILITY: "AGI",
  ENDURANCE: "END",
  FLEXIBILITY: "FLX",
  TEKNIK: "TEK",
  MENTAL: "MEN",
  GAME_INTELLIGENCE: "GI",
};

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export default function SpiderChart({
  data,
  maxScore = 10,
  size = 300,
  className,
}: SpiderChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size / 2) * 0.7;
  const n = data.length;
  if (n === 0) return null;

  const angleStep = 360 / Math.max(n, 3);
  const levels = 5;

  // Grid polygons
  const gridLevels = Array.from({ length: levels }, (_, i) => {
    const r = (radius * (i + 1)) / levels;
    const points = Array.from({ length: n }, (_, j) => {
      const p = polarToCartesian(cx, cy, r, j * angleStep);
      return `${p.x},${p.y}`;
    }).join(" ");
    return points;
  });

  // Axis lines
  const axes = Array.from({ length: n }, (_, j) => {
    const end = polarToCartesian(cx, cy, radius, j * angleStep);
    return { x1: cx, y1: cy, x2: end.x, y2: end.y };
  });

  // Data polygon
  const dataPoints = data.map((d, j) => {
    const r = (Math.min(d.value, maxScore) / maxScore) * radius;
    return polarToCartesian(cx, cy, r, j * angleStep);
  });
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // Labels
  const labels = data.map((d, j) => {
    const labelR = radius + 28;
    const p = polarToCartesian(cx, cy, labelR, j * angleStep);
    return { ...d, ...p, label: CATEGORY_LABELS[d.category] || d.category };
  });

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="mx-auto"
      >
        {/* Grid */}
        {gridLevels.map((pts, i) => (
          <polygon
            key={i}
            points={pts}
            fill="none"
            stroke="currentColor"
            className="text-border"
            strokeWidth={1}
          />
        ))}

        {/* Axes */}
        {axes.map((a, i) => (
          <line
            key={i}
            x1={a.x1}
            y1={a.y1}
            x2={a.x2}
            y2={a.y2}
            stroke="currentColor"
            className="text-border"
            strokeWidth={1}
          />
        ))}

        {/* Data area */}
        <polygon
          points={dataPolygon}
          fill="hsl(var(--primary) / 0.15)"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
        />

        {/* Data dots */}
        {dataPoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4}
            fill="hsl(var(--primary))"
            stroke="white"
            strokeWidth={2}
          />
        ))}

        {/* Labels */}
        {labels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={l.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-muted-foreground text-[11px] font-medium"
          >
            {l.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
