import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isToday, isSameDay,
} from "date-fns";
import { it } from "date-fns/locale";
import { CalendarEvent, CalendarEventCard } from "./CalendarEventCard";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

interface Props {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
  onDayClick: (date: Date) => void;
}

export function CalendarMonthView({ currentDate, events, onEventClick, onDayClick }: Props) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const eventsByDay = new Map<string, CalendarEvent[]>();
  events.forEach((ev) => {
    const key = ev.date.slice(0, 10);
    if (!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key)!.push(ev);
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
        ))}
      </div>
      {/* Grid */}
      <div className="grid grid-cols-7 flex-1 auto-rows-fr">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDay.get(key) || [];
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);
          return (
            <div
              key={key}
              onClick={() => onDayClick(day)}
              className={`border-b border-r border-border p-1 min-h-[90px] cursor-pointer transition-colors hover:bg-accent/30 ${
                !inMonth ? "bg-muted/30" : ""
              }`}
            >
              <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                today ? "bg-primary text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground"
              }`}>
                {format(day, "d")}
              </div>
              <div className="flex flex-col gap-0.5 overflow-hidden max-h-[60px]">
                {dayEvents.slice(0, 3).map((ev) => (
                  <CalendarEventCard key={ev.id} event={ev} compact onClick={onEventClick} />
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} altri</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
