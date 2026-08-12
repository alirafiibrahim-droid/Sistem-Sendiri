"use client";

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

export default function BarChart({
  data,
  maxScore = 10,
  height = 220,
  className,
}: BarChartProps) {
  const W = 640;
  const H = height;
  const pad = { top: 20, right: 8, bottom: 44, left: 40 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const n = Math.max(data.length, 1);
  const barSlot = plotW / n;
  const barWidth = Math.min(barSlot * 0.55, 48);

  const yAt = (value: number) =>
    pad.top + plotH * (1 - Math.min(Math.max(value, 0), maxScore) / maxScore);

  const gridValues = [0, 2, 4, 6, 8, 10].filter((v) => v <= maxScore);

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label="Grafik batang nilai per kategori"
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

        {data.map((d, i) => {
          const x = pad.left + i * barSlot + (barSlot - barWidth) / 2;
          const y = yAt(d.value);
          const barH = pad.top + plotH - y;
          const color = barColor(d.value);
          return (
            <g key={d.label}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barH, 0)}
                rx={4}
                fill={color}
                opacity={0.9}
              />
              {d.value > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px] font-medium"
                >
                  {d.value}
                </text>
              )}
              <text
                x={x + barWidth / 2}
                y={H - 14}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
