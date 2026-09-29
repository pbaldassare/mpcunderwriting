import { NavLink } from "react-router-dom";
import { Star, Clock, X, Pin, PinOff, User, FileText, AlertTriangle, Handshake, Building2 } from "lucide-react";
import { useRecentEntities, type EntityKind, type RecentEntity } from "@/hooks/useRecentEntities";
import { isLegacyPath, isLegacyLabel } from "./AppSidebar";

const ICONS: Record<EntityKind, typeof User> = {
  cliente: User,
  prospect: User,
  polizza: FileText,
  sinistro: AlertTriangle,
  trattativa: Handshake,
  compagnia: Building2,
};

interface Props {
  collapsed: boolean;
}

const Row = ({
  item,
  pinned,
  onTogglePin,
  onRemove,
}: {
  item: RecentEntity;
  pinned: boolean;
  onTogglePin: () => void;
  onRemove?: () => void;
}) => {
  const Icon = ICONS[item.kind] || FileText;
  return (
    <div className="group flex items-center gap-1.5 pr-1 rounded-md hover:bg-white/8">
      <NavLink
        to={item.path}
        title={`${item.label}${item.sub ? " · " + item.sub : ""}`}
        className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 text-[12px] text-white/75 hover:text-white"
      >
        <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" />
        <span className="truncate">{item.label}</span>
      </NavLink>
      <button
        onClick={onTogglePin}
        title={pinned ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
        className="opacity-0 group-hover:opacity-100 text-white/50 hover:text-white p-1"
      >
        {pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
      </button>
      {onRemove && (
        <button
          onClick={onRemove}
          title="Rimuovi dai recenti"
          className="opacity-0 group-hover:opacity-100 text-white/50 hover:text-white p-1"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

const RecentiPreferitiSidebar = ({ collapsed }: Props) => {
  const { recent: recentRaw, pinned: pinnedRaw, togglePin, removeRecent } = useRecentEntities();
  const recent = recentRaw.filter((r) => !isLegacyPath(r.path) && !isLegacyLabel(r.label));
  const pinned = pinnedRaw.filter((p) => !isLegacyPath(p.path) && !isLegacyLabel(p.label));

  if (collapsed) return null;
  if (recent.length === 0 && pinned.length === 0) return null;

  return (
    <div className="mb-3 pb-2 border-b border-white/10">
      {pinned.length > 0 && (
        <>
          <div className="flex items-center gap-1.5 px-3 pt-1 pb-1 text-white/40 uppercase text-[10px] tracking-wider">
            <Star className="w-3 h-3" /> Preferiti
          </div>
          {pinned.map((p) => (
            <Row
              key={`p-${p.kind}-${p.id}`}
              item={p}
              pinned
              onTogglePin={() => togglePin(p)}
            />
          ))}
        </>
      )}
      {recent.length > 0 && (
        <>
          <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-white/40 uppercase text-[10px] tracking-wider">
            <Clock className="w-3 h-3" /> Recenti
          </div>
          {recent.map((r) => {
            const isPinned = pinned.some((p) => p.kind === r.kind && p.id === r.id);
            return (
              <Row
                key={`r-${r.kind}-${r.id}`}
                item={r}
                pinned={isPinned}
                onTogglePin={() => togglePin(r)}
                onRemove={() => removeRecent(r.kind, r.id)}
              />
            );
          })}
        </>
      )}
    </div>
  );
};

export default RecentiPreferitiSidebar;
