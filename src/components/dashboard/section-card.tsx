import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

interface SectionCardProps {
  title: string;
  icon: string;
  subtitle?: string;
  href?: string;
  children: React.ReactNode;
  className?: string;
}

export function SectionCard({ title, icon, subtitle, href, children, className }: SectionCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg">
            {icon}
          </span>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {href && (
          <Link
            href={href}
            className="text-xs font-medium text-primary hover:underline"
          >
            Lihat semua →
          </Link>
        )}
      </CardHeader>
      <div className="px-6 pb-6 pt-1">{children}</div>
    </Card>
  );
}
