"use client";

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
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316",
];

function formatShortDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

export default function LineChart({
  series,
  maxScore = 10,
  height = 280,
  className,
}: LineChartProps) {
  const W = 640;
  const H = height;
  const pad = { top: 20, right: 28, bottom: 44, left: 40 };

  // Sumbu X = tanggal (satu titik per kategori per hari karena penilaian
  // variabel yang sama pada hari yang sama sudah dirata-ratakan di API).
  const dates = Array.from(
    new Set(series.flatMap((s) => s.points.map((p) => p.date)))
  ).sort((a, b) => a.localeCompare(b));
  const n = Math.max(dates.length, 2);
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const xAt = (date: string) =>
    pad.left + (dates.indexOf(date) / (n - 1)) * plotW;
  const yAt = (value: number) =>
    pad.top +
    plotH *
      (1 - Math.min(Math.max(value, 0), maxScore) / maxScore);

  const gridValues = [0, 2, 4, 6, 8, 10].filter((v) => v <= maxScore);
  const labelStep = Math.max(1, Math.ceil(dates.length / 6));

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label="Grafik progres nilai performa"
      >
        {gridValues.map((v) => (
          <g key={v}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={yAt(v)}
              y2={yAt(v)}
              stroke="currentColor"
              className="text-border"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={pad.left - 8}
              y={yAt(v)}
              textAnchor="end"
              dominantBaseline="central"
              className="fill-muted-foreground text-[10px]"
            >
              {v}
            </text>
          </g>
        ))}

        {dates.map((d, i) =>
          i % labelStep === 0 ? (
            <text
              key={d}
              x={xAt(d)}
              y={H - 14}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {formatShortDate(d)}
            </text>
          ) : null
        )}

        {series.map((s, si) => {
          const color = PALETTE[si % PALETTE.length];
          const pts = s.points.map((p) => ({ x: xAt(p.date), y: yAt(p.value), p }));
          const line = pts.map((pt) => `${pt.x},${pt.y}`).join(" ");
          return (
            <g key={s.category}>
              <polyline
                points={line}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {pts.map((pt, i) => (
                <g key={i}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={4}
                    fill="white"
                    stroke={color}
                    strokeWidth={2}
                  />
                  <text
                    x={pt.x}
                    y={pt.y - 9}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[9px] font-medium"
                  >
                    {pt.p.value}
                  </text>
                </g>
              ))}
            </g>
          );
        })}
      </svg>

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
