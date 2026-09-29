import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function RcaPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function RcaSegmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      {label && <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>}
      <div className="inline-flex max-w-full flex-wrap rounded-lg border border-border bg-muted/30 p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
              value === option.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RcaToolbar({
  search,
  onSearch,
  searchPlaceholder = "Cerca targa, cliente o n° polizza…",
  count,
  countLabel = "veicoli",
  children,
}: {
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder?: string;
  count?: number;
  countLabel?: string;
  children?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-8"
            />
          </div>
          {count != null && (
            <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
              {count} {countLabel}
            </p>
          )}
        </div>
        {children && <div className="flex flex-wrap items-end gap-x-6 gap-y-3">{children}</div>}
      </CardContent>
    </Card>
  );
}

export function RcaTableCard({ children }: { children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}
