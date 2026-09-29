import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  accent?: "primary" | "muted" | "success" | "warning";
}

const accentMap = {
  primary: "text-primary",
  muted: "text-muted-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
};

export const ProvvigioniKpiCard = ({ icon: Icon, label, value, hint, accent = "muted" }: Props) => (
  <Card>
    <CardContent className="p-4 flex items-center gap-3">
      <div className={cn("rounded-lg bg-muted/50 p-2.5", accentMap[accent])}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className={cn("text-xl font-bold tabular-nums truncate", accent === "primary" && "text-primary", "font-sans")}>
          {value}
        </p>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
      </div>
    </CardContent>
  </Card>
);
