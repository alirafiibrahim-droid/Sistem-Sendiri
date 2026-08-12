import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const toneStyles: Record<string, string> = {
  default: "text-foreground",
  success: "text-green-600 dark:text-green-400",
  warning: "text-orange-600 dark:text-orange-400",
  danger: "text-red-600 dark:text-red-400",
  muted: "text-muted-foreground",
};

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger" | "muted";
  className?: string;
}

export function StatCard({ label, value, hint, tone = "default", className }: StatCardProps) {
  return (
    <Card className={cn("p-4", className)}>
      <CardContent className="p-0">
        <p className="text-[11px] font-medium uppercase leading-snug tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={cn("mt-1.5 min-w-0 break-words text-stat font-bold leading-tight", toneStyles[tone])}>
          {value}
        </p>
        {hint && <CardDescription className="mt-1.5 text-xs">{hint}</CardDescription>}
      </CardContent>
    </Card>
  );
}
