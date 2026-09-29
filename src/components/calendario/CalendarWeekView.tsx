import { startOfWeek, addDays, format, isToday } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarEvent, CalendarEventCard } from "./CalendarEventCard";

interface Props {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
}

export function CalendarWeekView({ currentDate, events, onEventClick }: Props) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const eventsByDay = new Map<string, CalendarEvent[]>();
  events.forEach((ev) => {
    const key = ev.date.slice(0, 10);
    if (!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key)!.push(ev);
  });

  return (
    <div className="grid grid-cols-7 flex-1 min-h-0 gap-px bg-border">
      {days.map((day) => {
        const key = format(day, "yyyy-MM-dd");
        const dayEvents = eventsByDay.get(key) || [];
        const today = isToday(day);
        return (
          <div key={key} className="bg-background flex flex-col min-h-[300px]">
            <div className={`text-center py-2 border-b border-border ${today ? "bg-primary/10" : ""}`}>
              <div className="text-[10px] uppercase text-muted-foreground">{format(day, "EEE", { locale: it })}</div>
              <div className={`text-lg font-semibold ${today ? "text-primary" : "text-foreground"}`}>{format(day, "d")}</div>
            </div>
            <div className="flex-1 p-1 space-y-0.5 overflow-y-auto">
              {dayEvents.map((ev) => (
                <CalendarEventCard key={ev.id} event={ev} onClick={onEventClick} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
