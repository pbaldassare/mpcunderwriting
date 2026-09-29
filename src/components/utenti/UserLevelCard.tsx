import { LevelConfig } from "@/lib/userLevels";
import { cn } from "@/lib/utils";

interface Props {
  level: LevelConfig;
  count: number;
  active: boolean;
  onClick: () => void;
}

const UserLevelCard = ({ level, count, active, onClick }: Props) => {
  const Icon = level.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative text-left rounded-xl border-2 p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-md",
        level.bgClass,
        active ? level.borderClass + " shadow-lg ring-2 ring-offset-2 ring-offset-background" : "border-border/40",
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-10 h-10 rounded-lg bg-background/80 flex items-center justify-center", level.color)}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-background/60 px-2 py-0.5 rounded">
          {level.id}
        </span>
      </div>
      <div className="space-y-0.5">
        <h3 className="font-semibold text-foreground text-sm leading-tight">{level.label}</h3>
        <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{level.shortDesc}</p>
      </div>
      <div className="mt-3 pt-3 border-t border-border/40 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-foreground">{count}</span>
        <span className="text-[11px] text-muted-foreground">utenti</span>
      </div>
    </button>
  );
};

export default UserLevelCard;
