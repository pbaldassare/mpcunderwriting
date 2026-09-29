import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Props = {
  field: string;
  sortField: string;
  sortDirection: "asc" | "desc";
  onSort: (field: string) => void;
  children: ReactNode;
  className?: string;
  title?: string;
};

/** Primo click: desc (date più recenti in alto). */
export function SortableTableHead({
  field,
  sortField,
  sortDirection,
  onSort,
  children,
  className,
  title,
}: Props) {
  const Icon = sortField === field ? (sortDirection === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead
      className={cn("cursor-pointer select-none bg-background", className)}
      title={title}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </div>
    </TableHead>
  );
}

export function nextSort(
  currentField: string,
  currentDir: "asc" | "desc",
  field: string,
): { field: string; direction: "asc" | "desc" } {
  if (currentField === field) {
    return { field, direction: currentDir === "desc" ? "asc" : "desc" };
  }
  return { field, direction: "desc" };
}
