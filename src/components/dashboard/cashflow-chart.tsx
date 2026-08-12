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

export function CashflowChart({ data, height = 220 }: CashflowChartProps) {
  const W = 640;
  const H = height;
  const pad = { top: 18, right: 8, bottom: 30, left: 44 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const maxValue = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  const niceMax = Math.ceil(maxValue / 100000) * 100000 || maxValue;
  const max = Math.max(niceMax, 1);

  const yAt = (value: number) => pad.top + plotH * (1 - Math.min(Math.max(value, 0), max) / max);

  const gridValues = 4;
  const gridLines = Array.from({ length: gridValues + 1 }, (_, i) => (max / gridValues) * i);

  const n = Math.max(data.length, 1);
  const groupSlot = plotW / n;
  const barWidth = Math.min(groupSlot * 0.28, 28);

  function formatAxis(value: number): string {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}M`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}rb`;
    return String(value);
  }

  return (
    <div>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada data</p>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          role="img"
          aria-label="Grafik arus kas bulanan"
        >
          {gridLines.map((v) => (
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
                {formatAxis(v)}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const cx = pad.left + i * groupSlot + groupSlot / 2;
            const incomeY = yAt(d.income);
            const expenseY = yAt(d.expense);
            const incomeH = Math.max(pad.top + plotH - incomeY, 0);
            const expenseH = Math.max(pad.top + plotH - expenseY, 0);
            return (
              <g key={d.month}>
                <rect
                  x={cx - barWidth - 2}
                  y={incomeY}
                  width={barWidth}
                  height={incomeH}
                  rx={3}
                  fill={INCOME_COLOR}
                  opacity={0.9}
                />
                <rect
                  x={cx + 2}
                  y={expenseY}
                  width={barWidth}
                  height={expenseH}
                  rx={3}
                  fill={EXPENSE_COLOR}
                  opacity={0.9}
                />
                <text
                  x={cx}
                  y={H - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {d.month}
                </text>
              </g>
            );
          })}
        </svg>
      )}
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
