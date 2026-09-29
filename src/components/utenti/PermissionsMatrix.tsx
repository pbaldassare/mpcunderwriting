import { Checkbox } from "@/components/ui/checkbox";
import { PERMISSION_GROUPS } from "@/lib/userLevels";
import { cn } from "@/lib/utils";

interface Props {
  permissions: Record<string, boolean>;
  onChange: (key: string, value: boolean) => void;
  disabled?: boolean;
}

const PermissionsMatrix = ({ permissions, onChange, disabled }: Props) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {PERMISSION_GROUPS.map((group) => (
        <div
          key={group.label}
          className="rounded-lg border bg-card/50 p-3 space-y-2"
        >
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </h4>
          <div className="space-y-1.5">
            {group.items.map((item) => {
              const checked = !!permissions[item.key];
              return (
                <label
                  key={item.key}
                  className={cn(
                    "flex items-center gap-2.5 text-sm cursor-pointer rounded px-1.5 py-1 hover:bg-muted/40 transition-colors",
                    disabled && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(v) => onChange(item.key, !!v)}
                  />
                  <span className="text-foreground/90">{item.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PermissionsMatrix;
