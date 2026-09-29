import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarEvent } from "@/components/calendario/CalendarEventCard";
import { CalendarFilters } from "@/components/calendario/CalendarFilters";
import { CalendarMonthView } from "@/components/calendario/CalendarMonthView";
import { CalendarWeekView } from "@/components/calendario/CalendarWeekView";
import { CalendarDayView } from "@/components/calendario/CalendarDayView";
import { TrattativaDetailDialog } from "@/components/trattative/TrattativaDetailDialog";

type ViewMode = "month" | "week" | "day";

export default function CalendarioTrattativePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>("month");
  const [activeTypes, setActiveTypes] = useState<Set<CalendarEvent["type"]>>(
    new Set(["apertura", "scadenza", "cambio_stato", "nota", "scadenza_task"])
  );
  const [statoFilter, setStatoFilter] = useState("all");
  const [prioritaFilter, setPrioritaFilter] = useState("all");
  const [selectedTrattativaId, setSelectedTrattativaId] = useState<string | null>(null);

  // Calcola range visibile
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (view === "month") {
      const ms = startOfMonth(currentDate);
      const me = endOfMonth(currentDate);
      return { rangeStart: startOfWeek(ms, { weekStartsOn: 1 }), rangeEnd: endOfWeek(me, { weekStartsOn: 1 }) };
    }
    if (view === "week") {
      return { rangeStart: startOfWeek(currentDate, { weekStartsOn: 1 }), rangeEnd: endOfWeek(currentDate, { weekStartsOn: 1 }) };
    }
    return { rangeStart: currentDate, rangeEnd: currentDate };
  }, [currentDate, view]);

  const startISO = format(rangeStart, "yyyy-MM-dd");
  const endISO = format(rangeEnd, "yyyy-MM-dd");

  // Query trattative
  const { data: trattative = [] } = useQuery({
    queryKey: ["cal-trattative", startISO, endISO, statoFilter, prioritaFilter],
    queryFn: async () => {
      let q = supabase.from("trattative").select("id, prodotto, sottoprodotto, stato, priorita, data_apertura, data_scadenza, data_chiusura, prospect_id, cliente_id");
      if (statoFilter !== "all") q = q.eq("stato", statoFilter);
      if (prioritaFilter !== "all") q = q.eq("priorita", prioritaFilter);
      const { data } = await q;
      return data || [];
    },
  });

  // Query eventi
  const trattativaIds = trattative.map((t) => t.id);
  const { data: eventi = [] } = useQuery({
    queryKey: ["cal-eventi", trattativaIds, startISO, endISO],
    queryFn: async () => {
      if (!trattativaIds.length) return [];
      const { data } = await supabase
        .from("trattativa_eventi")
        .select("id, trattativa_id, tipo_evento, descrizione, data_evento, created_at")
        .in("trattativa_id", trattativaIds);
      return data || [];
    },
    enabled: trattativaIds.length > 0,
  });

  // Query scadenze
  const { data: scadenze = [] } = useQuery({
    queryKey: ["cal-scadenze", trattativaIds, startISO, endISO],
    queryFn: async () => {
      if (!trattativaIds.length) return [];
      const { data } = await supabase
        .from("trattativa_scadenze")
        .select("id, trattativa_id, titolo, data_scadenza, completata, note")
        .in("trattativa_id", trattativaIds);
      return data || [];
    },
    enabled: trattativaIds.length > 0,
  });

  // Build calendar events
  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    const result: CalendarEvent[] = [];
    const trattMap = new Map(trattative.map((t) => [t.id, t]));

    const label = (t: any) => t.prodotto || t.sottoprodotto || "Trattativa";

    // Aperture
    if (activeTypes.has("apertura")) {
      trattative.forEach((t) => {
        if (t.data_apertura) {
          result.push({ id: `ap-${t.id}`, title: label(t), date: t.data_apertura, type: "apertura", trattativaId: t.id, trattativaLabel: label(t), priorita: t.priorita || undefined, stato: t.stato });
        }
      });
    }

    // Scadenze trattativa
    if (activeTypes.has("scadenza")) {
      trattative.forEach((t) => {
        if (t.data_scadenza) {
          result.push({ id: `sc-${t.id}`, title: `Scad. ${label(t)}`, date: t.data_scadenza, type: "scadenza", trattativaId: t.id, trattativaLabel: label(t), priorita: t.priorita || undefined, stato: t.stato });
        }
      });
    }

    // Eventi timeline
    eventi.forEach((ev) => {
      const t = trattMap.get(ev.trattativa_id);
      const evDate = ev.data_evento || ev.created_at;
      if (!evDate) return;
      const tipo = ev.tipo_evento === "cambio_stato" ? "cambio_stato" : "nota";
      if (!activeTypes.has(tipo)) return;
      result.push({ id: `ev-${ev.id}`, title: ev.descrizione, date: evDate, type: tipo, trattativaId: ev.trattativa_id, trattativaLabel: t ? label(t) : undefined, description: ev.descrizione });
    });

    // Scadenze task
    if (activeTypes.has("scadenza_task")) {
      scadenze.forEach((s) => {
        const t = trattMap.get(s.trattativa_id);
        result.push({ id: `st-${s.id}`, title: s.titolo, date: s.data_scadenza, type: "scadenza_task", trattativaId: s.trattativa_id, trattativaLabel: t ? label(t) : undefined, completata: s.completata || false, description: s.note || undefined });
      });
    }

    return result;
  }, [trattative, eventi, scadenze, activeTypes]);

  // Navigation
  const goToday = () => setCurrentDate(new Date());
  const goPrev = () => {
    if (view === "month") setCurrentDate((d) => subMonths(d, 1));
    else if (view === "week") setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => subDays(d, 1));
  };
  const goNext = () => {
    if (view === "month") setCurrentDate((d) => addMonths(d, 1));
    else if (view === "week") setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addDays(d, 1));
  };

  const toggleType = (t: CalendarEvent["type"]) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  };

  const handleEventClick = (ev: CalendarEvent) => setSelectedTrattativaId(ev.trattativaId);
  const handleDayClick = (date: Date) => { setCurrentDate(date); setView("day"); };

  const headerLabel = view === "month"
    ? format(currentDate, "MMMM yyyy", { locale: it })
    : view === "week"
      ? `Settimana del ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM", { locale: it })}`
      : format(currentDate, "d MMMM yyyy", { locale: it });

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 p-4 border-b border-border bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalIcon className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold capitalize">{headerLabel}</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={goToday}>Oggi</Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrev}><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNext}><ChevronRight className="w-4 h-4" /></Button>
            <div className="w-px h-6 bg-border mx-1" />
            {(["month", "week", "day"] as const).map((v) => (
              <Button key={v} variant={view === v ? "default" : "ghost"} size="sm" onClick={() => setView(v)} className="capitalize text-xs">
                {v === "month" ? "Mese" : v === "week" ? "Settimana" : "Giorno"}
              </Button>
            ))}
          </div>
        </div>
        <CalendarFilters activeTypes={activeTypes} onToggleType={toggleType} statoFilter={statoFilter} onStatoFilter={setStatoFilter} prioritaFilter={prioritaFilter} onPrioritaFilter={setPrioritaFilter} />
      </div>

      {/* Calendar */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {view === "month" && <CalendarMonthView currentDate={currentDate} events={calendarEvents} onEventClick={handleEventClick} onDayClick={handleDayClick} />}
        {view === "week" && <CalendarWeekView currentDate={currentDate} events={calendarEvents} onEventClick={handleEventClick} />}
        {view === "day" && <CalendarDayView currentDate={currentDate} events={calendarEvents} onEventClick={handleEventClick} />}
      </div>

      {/* Detail dialog */}
      {selectedTrattativaId && (() => {
        const t = trattative.find((tr) => tr.id === selectedTrattativaId);
        if (!t) return null;
        return (
          <TrattativaDetailDialog
            trattativa={t}
            open={!!selectedTrattativaId}
            onOpenChange={(open) => { if (!open) setSelectedTrattativaId(null); }}
          />
        );
      })()}
    </div>
  );
}
