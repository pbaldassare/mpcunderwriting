import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/**
 * Selettore tema chiaro/scuro per il menu profilo utente.
 */
export function ProfileThemeToggle() {
  const { theme, resolved, setTheme } = useTheme();
  const value = theme === "system" ? resolved : theme;

  return (
    <div
      className="px-2 py-2"
      onPointerDown={(e) => e.preventDefault()}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-xs font-medium text-muted-foreground px-1 mb-2">Tema</p>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => {
          if (v === "light" || v === "dark") setTheme(v);
        }}
        className="w-full"
      >
        <ToggleGroupItem
          value="light"
          aria-label="Tema chiaro"
          className="flex-1 gap-1.5 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          <Sun className="w-3.5 h-3.5" />
          Tema chiaro
        </ToggleGroupItem>
        <ToggleGroupItem
          value="dark"
          aria-label="Tema scuro"
          className="flex-1 gap-1.5 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          <Moon className="w-3.5 h-3.5" />
          Tema scuro
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

export default ProfileThemeToggle;
