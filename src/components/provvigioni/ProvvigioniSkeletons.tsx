import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const KpiCardSkeleton = () => (
  <Card>
    <CardContent className="p-4 flex items-center gap-3">
      <Skeleton className="h-11 w-11 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-28" />
      </div>
    </CardContent>
  </Card>
);

export const KpiRowSkeleton = ({ count = 5 }: { count?: number }) => (
  <div className={`grid grid-cols-2 md:grid-cols-${count} gap-3`}>
    {Array.from({ length: count }).map((_, i) => <KpiCardSkeleton key={i} />)}
  </div>
);

export const ChartSkeleton = () => (
  <Card>
    <CardHeader className="pb-2"><Skeleton className="h-4 w-40" /></CardHeader>
    <CardContent className="h-[260px] flex items-end gap-2 pb-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="flex-1 rounded-t" style={{ height: `${30 + ((i * 37) % 70)}%` }} />
      ))}
    </CardContent>
  </Card>
);

export const FiltersBarSkeleton = () => (
  <div className="rounded-lg border bg-card p-4 flex flex-wrap items-end gap-3">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="space-y-1">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-9 w-[160px]" />
      </div>
    ))}
  </div>
);

export const BadgeSkeleton = ({ className = "" }: { className?: string }) => (
  <Skeleton className={`inline-block h-5 w-20 rounded-full ${className}`} />
);

type CellType = "text" | "num" | "badge" | "short" | "checkbox";
const cellClass = (t: CellType) => {
  switch (t) {
    case "num": return "h-4 w-16 ml-auto";
    case "badge": return "h-5 w-20 rounded-full";
    case "short": return "h-4 w-12";
    default: return "h-4 w-full max-w-[160px]";
  }
};

export const TableRowsSkeleton = ({ rows = 8, cols = 6, cellTypes }: { rows?: number; cols?: number; cellTypes?: CellType[] }) => {
  const types: CellType[] = cellTypes || Array.from({ length: cols }, () => "text" as CellType);
  return (
    <div className="divide-y">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-3 px-4 py-3">
          {types.map((t, c) => (
            <div key={c} className={`flex-1 ${t === "num" ? "text-right" : ""}`}>
              <Skeleton className={cellClass(t)} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

