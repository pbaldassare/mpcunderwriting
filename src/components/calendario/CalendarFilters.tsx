import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarEvent } from "./CalendarEventCard";

const eventTypes: { value: CalendarEvent["type"]; label: string; color: string }[] = [
  { value: "apertura", label: "Aperture", color: "bg-emerald-500" },
  { value: "scadenza", label: "Scadenze", color: "bg-blue-500" },
  { value: "cambio_stato", label: "Cambi stato", color: "bg-amber-500" },
  { value: "nota", label: "Note", color: "bg-muted" },
  { value: "scadenza_task", label: "Task", color: "bg-red-500" },
];

const stati = [
  "aperta", "contatto", "preventivo", "in_negoziazione",
  "proposta_inviata", "chiusa_vinta", "chiusa_persa", "sospesa",
];

interface Props {
  activeTypes: Set<CalendarEvent["type"]>;
  onToggleType: (t: CalendarEvent["type"]) => void;
  statoFilter: string;
  onStatoFilter: (s: string) => void;
  prioritaFilter: string;
  onPrioritaFilter: (p: string) => void;
}

export function CalendarFilters({ activeTypes, onToggleType, statoFilter, onStatoFilter, prioritaFilter, onPrioritaFilter }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground mr-1">Tipo:</span>
      {eventTypes.map((t) => (
        <button
          key={t.value}
          onClick={() => onToggleType(t.value)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
            activeTypes.has(t.value) ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground opacity-50"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${t.color}`} />
          {t.label}
        </button>
      ))}

      <div className="w-px h-6 bg-border mx-1" />

      <Select value={statoFilter} onValueChange={onStatoFilter}>
        <SelectTrigger className="w-[150px] h-8 text-xs">
          <SelectValue placeholder="Tutti gli stati" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti gli stati</SelectItem>
          {stati.map((s) => (
            <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={prioritaFilter} onValueChange={onPrioritaFilter}>
        <SelectTrigger className="w-[130px] h-8 text-xs">
          <SelectValue placeholder="Tutte le priorità" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutte</SelectItem>
          <SelectItem value="urgente">Urgente</SelectItem>
          <SelectItem value="alta">Alta</SelectItem>
          <SelectItem value="media">Media</SelectItem>
          <SelectItem value="bassa">Bassa</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
