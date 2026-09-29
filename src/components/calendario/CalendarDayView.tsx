import { format, isToday } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarEvent, CalendarEventCard } from "./CalendarEventCard";

interface Props {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
}

export function CalendarDayView({ currentDate, events, onEventClick }: Props) {
  const key = format(currentDate, "yyyy-MM-dd");
  const dayEvents = events.filter((ev) => ev.date.slice(0, 10) === key);
  const today = isToday(currentDate);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className={`text-center py-4 border-b border-border ${today ? "bg-primary/10" : ""}`}>
        <div className="text-sm uppercase text-muted-foreground">{format(currentDate, "EEEE", { locale: it })}</div>
        <div className={`text-3xl font-bold ${today ? "text-primary" : "text-foreground"}`}>{format(currentDate, "d MMMM yyyy", { locale: it })}</div>
      </div>
      <div className="p-4 space-y-2 max-w-2xl mx-auto">
        {dayEvents.length === 0 && (
          <p className="text-center text-muted-foreground py-12">Nessun evento per questo giorno</p>
        )}
        {dayEvents.map((ev) => (
          <div key={ev.id} className="border border-border rounded-lg p-3 hover:bg-accent/30 transition-colors cursor-pointer" onClick={() => onEventClick(ev)}>
            <CalendarEventCard event={ev} onClick={onEventClick} />
            {ev.description && <p className="text-xs text-muted-foreground mt-1 pl-1.5">{ev.description}</p>}
            {ev.trattativaLabel && <p className="text-xs text-muted-foreground mt-0.5 pl-1.5">Trattativa: {ev.trattativaLabel}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
