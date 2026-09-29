import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // ISO date
  type: "apertura" | "scadenza" | "cambio_stato" | "nota" | "scadenza_task";
  trattativaId: string;
  trattativaLabel?: string;
  priorita?: string;
  stato?: string;
  completata?: boolean;
  description?: string;
}

const typeColors: Record<CalendarEvent["type"], string> = {
  apertura: "bg-emerald-500/90 text-white",
  scadenza: "bg-blue-500/90 text-white",
  cambio_stato: "bg-amber-500/90 text-white",
  nota: "bg-muted text-muted-foreground",
  scadenza_task: "bg-red-500/90 text-white",
};

const typeLabels: Record<CalendarEvent["type"], string> = {
  apertura: "Apertura",
  scadenza: "Scadenza",
  cambio_stato: "Cambio stato",
  nota: "Nota",
  scadenza_task: "Task",
};

interface Props {
  event: CalendarEvent;
  compact?: boolean;
  onClick?: (event: CalendarEvent) => void;
}

export function CalendarEventCard({ event, compact, onClick }: Props) {
  const colorClass = event.type === "scadenza_task" && event.completata
    ? "bg-muted text-muted-foreground line-through"
    : typeColors[event.type];

  const card = (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(event); }}
      className={`w-full text-left rounded px-1.5 py-0.5 text-[11px] leading-tight truncate cursor-pointer hover:opacity-80 transition-opacity ${colorClass}`}
    >
      {compact ? event.title : `${typeLabels[event.type]}: ${event.title}`}
    </button>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent side="right" className="max-w-[260px] text-xs">
          <p className="font-semibold">{typeLabels[event.type]}</p>
          <p>{event.title}</p>
          {event.trattativaLabel && <p className="text-muted-foreground mt-1">Trattativa: {event.trattativaLabel}</p>}
          {event.description && <p className="text-muted-foreground mt-1">{event.description}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
