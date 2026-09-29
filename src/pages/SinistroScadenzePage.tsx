import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  format, 
  differenceInDays, 
  addDays, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  parseISO
} from "date-fns";
import { it } from "date-fns/locale";
import { CalendarCheck, List, Calendar as CalendarIcon, ChevronLeft, ChevronRight, CheckCircle2, ArrowLeft, RefreshCw, X } from "lucide-react";
import { resolveClienteNome } from "@/lib/ecClienteAnagrafica";
import { isArchiviato } from "@/lib/sinistriStati";

type ScadenzaItem = {
  id: string;
  source: "checklist" | "evento" | "prescrizione";
  tipo: string;
  descrizione: string;
  sinistro_id: string;
  numero_sinistro: string;
  cliente: string;
  responsabile_id: string;
  responsabile_nome: string;
  data_scadenza: Date;
  completato: boolean;
};

export default function SinistroScadenzePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<"lista" | "calendario">("lista");
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Filtri
  const [filtroResponsabile, setFiltroResponsabile] = useState<string>("tutti");
  const [filtroTipo, setFiltroTipo] = useState<string>("tutti");
  const [filtroCompletato, setFiltroCompletato] = useState<string>("no"); // default "no" (mostra attive)
  const [dataScadenzaDal, setDataScadenzaDal] = useState<string>("");
  const [dataScadenzaAl, setDataScadenzaAl] = useState<string>("");

  // Query lookups
  const { data: responsabili = [] } = useQuery({
    queryKey: ["responsabili-scadenze"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome, cognome").eq("attivo", true).order("cognome");
      return data || [];
    }
  });

  // Query checklist e eventi sinistri
  const { data: rawData, isLoading, refetch } = useQuery({
    queryKey: ["sinistri-scadenze-dati"],
    queryFn: async () => {
      // 1. Carichiamo le checklist non completate (o tutte a seconda del filtro)
      const { data: checklistData, error: errChecklist } = await supabase.from("sinistro_checklist").select(`
        id, 
        descrizione, 
        completato, 
        created_at,
        sinistri(
          id, 
          numero_sinistro, 
          stato,
          data_apertura, 
          responsabile_id, 
          profiles!sinistri_responsabile_id_fkey(nome, cognome),
          clienti!sinistri_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale, tipo_cliente)
        )
      `);
      if (errChecklist) throw errChecklist;

      // 2. Carichiamo gli eventi
      const { data: eventiData, error: errEventi } = await supabase.from("sinistro_eventi").select(`
        id, 
        tipo_evento, 
        data_scadenza, 
        stato, 
        note,
        sinistri(
          id, 
          numero_sinistro, 
          stato,
          responsabile_id, 
          profiles!sinistri_responsabile_id_fkey(nome, cognome),
          clienti!sinistri_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale, tipo_cliente)
        )
      `);
      if (errEventi) throw errEventi;

      // 3. Prescrizioni perentorie con scadenza risposta attiva
      const { data: prescrizioniData, error: errPresc } = await supabase.from("sinistro_prescrizioni").select(`
        id,
        oggetto,
        destinatario_tipo,
        destinatario_label,
        data_scadenza_risposta,
        stato,
        sinistri(
          id,
          numero_sinistro,
          stato,
          responsabile_id,
          profiles!sinistri_responsabile_id_fkey(nome, cognome),
          clienti!sinistri_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale, tipo_cliente)
        )
      `).in("stato", ["bozza", "inviata"]);
      if (errPresc) throw errPresc;

      // Mappiamo entrambi nei tipi unificati ScadenzaItem
      const items: ScadenzaItem[] = [];

      // Mappatura Checklist
      (checklistData || []).forEach((c: any) => {
        if (!c.sinistri || isArchiviato(c.sinistri.stato)) return;
        // La scadenza della checklist è calcolata come created_at + 15 giorni, o data_apertura + 15 giorni
        const baseDate = c.created_at ? parseISO(c.created_at) : parseISO(c.sinistri.data_apertura);
        const dataScadenza = addDays(baseDate, 15);
        const clienteNome = resolveClienteNome(c.sinistri.clienti);

        items.push({
          id: c.id,
          source: "checklist",
          tipo: "checklist",
          descrizione: c.descrizione,
          sinistro_id: c.sinistri.id,
          numero_sinistro: c.sinistri.numero_sinistro || "—",
          cliente: clienteNome,
          responsabile_id: c.sinistri.responsabile_id || "",
          responsabile_nome: c.sinistri.profiles ? `${c.sinistri.profiles.nome || ""} ${c.sinistri.profiles.cognome || ""}`.trim() : "—",
          data_scadenza: dataScadenza,
          completato: !!c.completato
        });
      });

      // Mappatura Eventi
      (eventiData || []).forEach((e: any) => {
        if (!e.sinistri || isArchiviato(e.sinistri.stato)) return;
        const dataScadenza = parseISO(e.data_scadenza);
        const clienteNome = resolveClienteNome(e.sinistri.clienti);

        items.push({
          id: e.id,
          source: "evento",
          tipo: e.tipo_evento,
          descrizione: e.note || e.tipo_evento.replace(/_/g, " "),
          sinistro_id: e.sinistri.id,
          numero_sinistro: e.sinistri.numero_sinistro || "—",
          cliente: clienteNome,
          responsabile_id: e.sinistri.responsabile_id || "",
          responsabile_nome: e.sinistri.profiles ? `${e.sinistri.profiles.nome || ""} ${e.sinistri.profiles.cognome || ""}`.trim() : "—",
          data_scadenza: dataScadenza,
          completato: e.stato === "completato"
        });
      });

      // Mappatura Prescrizioni
      (prescrizioniData || []).forEach((p: any) => {
        if (!p.sinistri || isArchiviato(p.sinistri.stato)) return;
        const dataScadenza = parseISO(p.data_scadenza_risposta);
        const clienteNome = resolveClienteNome(p.sinistri.clienti);

        items.push({
          id: p.id,
          source: "prescrizione",
          tipo: "prescrizione",
          descrizione: p.oggetto + (p.destinatario_label ? ` → ${p.destinatario_label}` : ""),
          sinistro_id: p.sinistri.id,
          numero_sinistro: p.sinistri.numero_sinistro || "—",
          cliente: clienteNome,
          responsabile_id: p.sinistri.responsabile_id || "",
          responsabile_nome: p.sinistri.profiles ? `${p.sinistri.profiles.nome || ""} ${p.sinistri.profiles.cognome || ""}`.trim() : "—",
          data_scadenza: dataScadenza,
          completato: false,
        });
      });

      return items;
    }
  });

  // Mutazioni di completamento
  const completeChecklist = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sinistro_checklist").update({ completato: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sinistri-scadenze-dati"] });
      toast.success("Checklist completata");
    }
  });

  const completeEvento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sinistro_eventi").update({ stato: "completato" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sinistri-scadenze-dati"] });
      toast.success("Evento completato");
    }
  });

  const completePrescrizione = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sinistro_prescrizioni").update({ stato: "risposta_ricevuta" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sinistri-scadenze-dati"] });
      toast.success("Prescrizione segnata come risposta ricevuta");
    }
  });

  const handleToggleCompletato = (item: ScadenzaItem) => {
    if (item.completato) return; // Non consentiamo di "de-completare" per semplicità o logica di workflow
    if (item.source === "checklist") {
      completeChecklist.mutate(item.id);
    } else if (item.source === "prescrizione") {
      completePrescrizione.mutate(item.id);
    } else {
      completeEvento.mutate(item.id);
    }
  };

  // Applicazione dei filtri in memoria (per supportare viste miste e calendari in tempo reale)
  const filteredItems = useMemo(() => {
    if (!rawData) return [];
    return rawData.filter((item) => {
      // 1. Filtro completato
      if (filtroCompletato === "si" && !item.completato) return false;
      if (filtroCompletato === "no" && item.completato) return false;

      // 2. Filtro responsabile
      if (filtroResponsabile !== "tutti" && item.responsabile_id !== filtroResponsabile) return false;

      // 3. Filtro tipo scadenza
      if (filtroTipo !== "tutti") {
        if (filtroTipo === "checklist" && item.source !== "checklist") return false;
        if (filtroTipo === "evento" && item.source !== "evento") return false;
        if (filtroTipo === "prescrizione" && item.source !== "prescrizione") return false;
      }

      // 4. Filtro Date
      if (dataScadenzaDal) {
        const dal = new Date(dataScadenzaDal);
        dal.setHours(0, 0, 0, 0);
        if (item.data_scadenza < dal) return false;
      }
      if (dataScadenzaAl) {
        const al = new Date(dataScadenzaAl);
        al.setHours(23, 59, 59, 999);
        if (item.data_scadenza > al) return false;
      }

      return true;
    });
  }, [rawData, filtroCompletato, filtroResponsabile, filtroTipo, dataScadenzaDal, dataScadenzaAl]);

  // Calcolo colori di urgenza
  const getUrgenzaInfo = (dataScadenza: Date) => {
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const scad = new Date(dataScadenza);
    scad.setHours(0, 0, 0, 0);
    
    const giorniMancanti = differenceInDays(scad, oggi);
    
    let colorClass = "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300";
    if (giorniMancanti < 0) {
      colorClass = "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400"; // grigio (scaduto)
    } else if (giorniMancanti < 30) {
      colorClass = "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300"; // rosso
    } else if (giorniMancanti <= 90) {
      colorClass = "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300"; // arancione
    }

    return {
      giorniMancanti,
      colorClass
    };
  };

  // Navigazione Mese Calendario
  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  // Generazione griglia calendario
  const calendarDays = useMemo(() => {
    const startMonth = startOfMonth(currentMonth);
    const endMonth = endOfMonth(currentMonth);
    const startCalendar = startOfWeek(startMonth, { weekStartsOn: 1 }); // inizia da Lunedì
    const endCalendar = endOfWeek(endMonth, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: startCalendar, end: endCalendar });
  }, [currentMonth]);

  const resetFiltri = () => {
    setFiltroResponsabile("tutti");
    setFiltroTipo("tutti");
    setFiltroCompletato("no");
    setDataScadenzaDal("");
    setDataScadenzaAl("");
  };

  const hasFiltriAttivi = filtroResponsabile !== "tutti" || filtroTipo !== "tutti" || filtroCompletato !== "all" || dataScadenzaDal !== "" || dataScadenzaAl !== "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/sinistri")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarCheck className="h-6 w-6 text-primary" /> Scadenziario Sinistri
            </h1>
            <p className="text-muted-foreground">Calendario e scadenze delle checklist, eventi e prescrizioni perentorie</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} title="Ricarica">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <div className="border rounded-lg p-0.5 flex bg-muted">
            <Button 
              variant={viewMode === "lista" ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setViewMode("lista")}
              className="h-8 px-3 text-xs"
            >
              <List className="h-3.5 w-3.5 mr-1.5" /> Lista
            </Button>
            <Button 
              variant={viewMode === "calendario" ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setViewMode("calendario")}
              className="h-8 px-3 text-xs"
            >
              <CalendarIcon className="h-3.5 w-3.5 mr-1.5" /> Calendario
            </Button>
          </div>
        </div>
      </div>

      {/* Filtri */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Responsabile */}
            <div className="space-y-1">
              <Label className="text-xs">Responsabile</Label>
              <SearchableSelect
                value={filtroResponsabile}
                onValueChange={setFiltroResponsabile}
                placeholder="Tutti"
                clearable={true}
                clearLabel="Tutti"
                options={[{ value: "tutti", label: "Tutti" }, ...responsabili.map((r: any) => ({ value: r.id, label: `${r.cognome || ""} ${r.nome || ""}`.trim() }))]}
              />
            </div>

            {/* Tipo Scadenza */}
            <div className="space-y-1">
              <Label className="text-xs">Tipo Scadenza</Label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tutti">Tutte le scadenze</SelectItem>
                  <SelectItem value="checklist">Solo Checklist</SelectItem>
                  <SelectItem value="evento">Solo Eventi</SelectItem>
                  <SelectItem value="prescrizione">Solo Prescrizioni</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Completato */}
            <div className="space-y-1">
              <Label className="text-xs">Completato</Label>
              <Select value={filtroCompletato} onValueChange={setFiltroCompletato}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="No (Attive)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti (Storico)</SelectItem>
                  <SelectItem value="no">No (Attive)</SelectItem>
                  <SelectItem value="si">Sì (Completate)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Scadenza Dal */}
            <div className="space-y-1">
              <Label className="text-xs">Scadenza Dal</Label>
              <Input type="date" value={dataScadenzaDal} onChange={(e) => setDataScadenzaDal(e.target.value)} className="h-9" />
            </div>

            {/* Scadenza Al */}
            <div className="space-y-1">
              <Label className="text-xs">Scadenza Al</Label>
              <Input type="date" value={dataScadenzaAl} onChange={(e) => setDataScadenzaAl(e.target.value)} className="h-9" />
            </div>
          </div>

          {hasFiltriAttivi && (
            <div className="flex justify-end pt-2 border-t">
              <Button variant="ghost" size="sm" onClick={resetFiltri} className="text-xs text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5 mr-1" /> Reset filtri
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* VISTA LISTA */}
      {viewMode === "lista" && (
        <Card>
          <CardContent className="p-0">
            <Table>
                <TableHeader className="table-header-colored">
                  <TableRow>
                    <TableHead className="w-12 text-center">Stato</TableHead>
                    <TableHead className="w-32">Tipo</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead className="w-32">Sinistro</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="w-32">Data Scadenza</TableHead>
                    <TableHead className="w-32 text-center">Urgenza</TableHead>
                    <TableHead>Responsabile</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell>
                    </TableRow>
                  ) : filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nessuna scadenza trovata</TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => {
                      const urgenza = getUrgenzaInfo(item.data_scadenza);
                      return (
                        <TableRow 
                          key={`${item.source}-${item.id}`} 
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <TableCell className="text-center">
                            <Checkbox 
                              checked={item.completato} 
                              onCheckedChange={() => handleToggleCompletato(item)}
                              disabled={item.completato}
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-[10px]">
                              {item.tipo.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium max-w-xs truncate" title={item.descrizione}>
                            {item.descrizione}
                          </TableCell>
                          <TableCell>
                            <span 
                              className="font-semibold cursor-pointer hover:underline text-primary"
                              onClick={() => navigate(`/sinistri/${item.sinistro_id}`)}
                            >
                              {item.numero_sinistro}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{item.cliente}</TableCell>
                          <TableCell>{format(item.data_scadenza, "dd/MM/yyyy")}</TableCell>
                          <TableCell className="text-center">
                            {item.completato ? (
                              <Badge className="bg-green-100 text-green-800 border-green-200 py-0.5 px-2">Completato</Badge>
                            ) : (
                              <Badge variant="outline" className={`${urgenza.colorClass} py-0.5 px-2`}>
                                {urgenza.giorniMancanti < 0 
                                  ? "Scaduto" 
                                  : `${urgenza.giorniMancanti} gg`
                                }
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.responsabile_nome}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
          </CardContent>
        </Card>
      )}

      {/* VISTA CALENDARIO */}
      {viewMode === "calendario" && (
        <Card className="p-4 shadow-sm">
          {/* Header Mese Calendario */}
          <div className="flex items-center justify-between pb-4">
            <h2 className="text-lg font-bold text-primary capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: it })}
            </h2>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={handlePrevMonth} className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())} className="h-8 text-xs">
                Oggi
              </Button>
              <Button variant="outline" size="icon" onClick={handleNextMonth} className="h-8 w-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Griglia Calendario */}
          <div className="grid grid-cols-7 gap-1 bg-muted/40 p-1 rounded-lg">
            {/* Intestazioni Settimana */}
            {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((dayName) => (
              <div key={dayName} className="text-center py-2 text-xs font-semibold text-muted-foreground">
                {dayName}
              </div>
            ))}

            {/* Giorni del Mese */}
            {calendarDays.map((day) => {
              const dayScadenze = filteredItems.filter((item) => isSameDay(item.data_scadenza, day));
              const attive = dayScadenze.filter(s => !s.completato);
              const isCurrent = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, new Date());

              return (
                <div 
                  key={day.toString()} 
                  className={`min-h-[90px] border rounded bg-card p-1.5 flex flex-col justify-between transition-all ${
                    !isCurrent ? "opacity-30" : ""
                  } ${isToday ? "ring-2 ring-primary border-primary" : "border-muted/60"}`}
                >
                  <div className="flex justify-between items-center">
                    <span className={`text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center ${
                      isToday ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground"
                    }`}>
                      {format(day, "d")}
                    </span>
                    {attive.length > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 min-w-4 flex items-center justify-center">
                        {attive.length}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-1 flex-1 flex flex-col justify-end">
                    {dayScadenze.length > 0 ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="ghost" 
                            className="w-full text-[10px] h-6 p-0 hover:bg-muted text-left font-medium text-primary flex items-center justify-between px-1"
                          >
                            <span>Dettagli ({dayScadenze.length})</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-3 shadow-lg" align="start">
                          <h4 className="font-bold text-sm text-primary mb-2 border-b pb-1">
                            Scadenze del {format(day, "dd MMMM yyyy", { locale: it })}
                          </h4>
                          <div className="space-y-2 max-h-[250px] overflow-y-auto">
                            {dayScadenze.map((scad) => (
                              <div key={scad.id} className="p-2 border rounded text-xs space-y-1 bg-card">
                                <div className="flex justify-between items-center">
                                  <Badge className="text-[8px] scale-90 origin-left">
                                    {scad.tipo.replace(/_/g, " ")}
                                  </Badge>
                                  <span className="font-semibold text-[10px] text-muted-foreground">
                                    {scad.numero_sinistro}
                                  </span>
                                </div>
                                <p className="font-semibold">{scad.descrizione}</p>
                                <p className="text-[10px] text-muted-foreground">Cliente: {scad.cliente}</p>
                                <div className="flex justify-between items-center pt-1 border-t">
                                  <span className="text-[9px] text-muted-foreground">Resp: {scad.responsabile_nome}</span>
                                  <div className="flex items-center gap-1.5">
                                    <Checkbox 
                                      checked={scad.completato} 
                                      onCheckedChange={() => handleToggleCompletato(scad)}
                                      disabled={scad.completato}
                                      id={`check-pop-${scad.id}`}
                                    />
                                    <Label htmlFor={`check-pop-${scad.id}`} className="text-[10px] cursor-pointer">
                                      {scad.completato ? "Fatto" : "Completa"}
                                    </Label>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <div className="h-6" /> // spacer
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
