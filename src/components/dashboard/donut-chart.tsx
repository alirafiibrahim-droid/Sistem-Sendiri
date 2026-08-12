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

export function DonutChart({
  data,
  size = 160,
  thickness = 22,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((s, d) => s + d.value, 0);

  const segments = data
    .filter((d) => d.value > 0)
    .reduce<{ color: string; dash: number; gap: number; offset: number }[]>(
      (acc, d, i) => {
        const fraction = total > 0 ? d.value / total : 0;
        const dash = fraction * circumference;
        const prevOffset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0;
        acc.push({
          color: d.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
          dash,
          gap: Math.max(circumference - dash, 0),
          offset: prevOffset,
        });
        return acc;
      },
      []
    );

  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label="Diagram donat distribusi data"
        className="shrink-0"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--border, #e2e8f0)"
          strokeWidth={thickness}
        />
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={thickness}
            strokeDasharray={`${seg.dash} ${seg.gap}`}
            strokeDashoffset={-seg.offset}
            transform={`rotate(-90 ${center} ${center})`}
            className="transition-all duration-500"
          />
        ))}
        <text
          x={center}
          y={center - (centerValue ? 4 : 0)}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground text-stat-sm font-bold"
        >
          {centerValue ?? (total ? String(total) : "0")}
        </text>
        {centerLabel && (
          <text
            x={center}
            y={center + 16}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-muted-foreground text-[10px]"
          >
            {centerLabel}
          </text>
        )}
      </svg>

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
