export interface DistributionDatum {
  label: string;
  value: number;
  color?: string;
}

interface DistributionBarsProps {
  data: DistributionDatum[];
  total?: number;
  suffix?: string;
}

const BAR_COLORS = ["#bb2233", "#fa8603", "#0a0f24", "#e8848f", "#f7b46b", "#4a5266", "#c0505d", "#e8a24f", "#6b7280"];

export function DistributionBars({ data, total, suffix = "" }: DistributionBarsProps) {
  const sum = total ?? data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-2.5">
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada data</p>
      ) : (
        data.map((d, i) => {
          const pct = sum > 0 ? Math.round((d.value / sum) * 100) : 0;
          const color = d.color || BAR_COLORS[i % BAR_COLORS.length];
          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="break-words text-muted-foreground">{d.label}</span>
                </span>
                <span className="shrink-0 font-semibold">
                  {d.value}
                  {suffix}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
