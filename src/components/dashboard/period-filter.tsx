"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PeriodOption } from "@/lib/dashboard";

interface PeriodFilterProps {
  periods: PeriodOption[];
  selected: string;
}

export function PeriodFilter({ periods, selected }: PeriodFilterProps) {
  const router = useRouter();
  const pathname = usePathname();

  if (periods.length === 0) return null;

  function handleChange(value: string) {
    const params = new URLSearchParams();
    params.set("periode", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
      <span className="hidden sm:inline">Periode</span>
      <Select
        value={selected}
        onValueChange={handleChange}
      >
        <SelectTrigger className="w-auto min-w-48" aria-label="Pilih periode">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {periods.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.label}
            </SelectItem>
          ))}
          <SelectItem value="all">Semua Periode</SelectItem>
        </SelectContent>
      </Select>
    </label>
  );
}
