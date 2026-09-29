import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock, Clock, X } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { it } from "date-fns/locale";
import { SearchableSelect } from "@/components/SearchableSelect";
import { DatePicker } from "@/components/contabilita/DatePicker";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Finestra = "tutte" | "20" | "60" | "90" | "custom";

const fmtShort = (d: string | Date) => format(new Date(d), "dd/MM/yy", { locale: it });
const fmtFull = (d: string | Date) => format(new Date(d), "dd/MM/yyyy", { locale: it });

const ClienteScadenze = () => {
  const { user } = useAuth();
  const [polizze, setPolizze] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // filtri
  const [finestra, setFinestra] = useState<Finestra>("tutte");
  const [ramo, setRamo] = useState<string>("");
  const [compagnia, setCompagnia] = useState<string>("");
  const [search, setSearch] = useState("");
  const [dataDa, setDataDa] = useState<Date | null>(null);
  const [dataA, setDataA] = useState<Date | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: clienteIds } = await supabase.rpc("get_my_cliente_ids");
      if (!clienteIds?.length) { setLoading(false); return; }
      const ids = clienteIds.map((c: any) => c);

      const [titoliRes, cgaRes] = await Promise.all([
        supabase
          .from("titoli")
          .select("id, numero_titolo, stato, premio_lordo, data_scadenza, targa_telaio, compagnie(nome), rami(descrizione)")
          .in("cliente_anagrafica_id", ids)
          .eq("stato", "attivo")
          .not("data_scadenza", "is", null)
          .order("data_scadenza", { ascending: true }),
        supabase
          .from("polizza_cga")
          .select("id, numero_polizza, data_scadenza, premio_lordo_totale, prodotti_cga(nome_prodotto, compagnia, ramo)")
          .in("cliente_id", ids)
          .eq("stato", "approvato")
          .not("data_scadenza", "is", null)
          .order("data_scadenza", { ascending: true }),
      ]);

      const fromTitoli = (titoliRes.data ?? []).map((t: any) => ({
        ...t,
        _source: "titoli" as const,
        _detailPath: `/cliente/polizze/${t.id}#scadenziario`,
      }));

      const fromCga = (cgaRes.data ?? []).map((p: any) => ({
        id: p.id,
        _source: "cga" as const,
        _detailPath: `/cliente/assistente?polizza=${p.id}`,
        numero_titolo: p.numero_polizza ?? "—",
        stato: "attivo",
        premio_lordo: p.premio_lordo_totale,
        data_scadenza: p.data_scadenza,
        targa_telaio: null,
        compagnie: p.prodotti_cga?.compagnia ? { nome: p.prodotti_cga.compagnia } : null,
        rami: p.prodotti_cga?.ramo ? { descrizione: p.prodotti_cga.ramo } : null,
      }));

      setPolizze([...fromTitoli, ...fromCga].sort((a: any, b: any) =>
        new Date(a.data_scadenza).getTime() - new Date(b.data_scadenza).getTime()
      ));
      setLoading(false);
    };
    load();
  }, [user]);


  const today = useMemo(() => new Date(), []);

  const withDays = useMemo(
    () => polizze.map(p => ({ ...p, giorni: differenceInDays(new Date(p.data_scadenza), today) })).filter(p => p.giorni >= 0),
    [polizze, today]
  );

  const ramiOptions = useMemo(() => {
    const set = new Map<string, string>();
    withDays.forEach(p => { const r = p.rami?.descrizione; if (r) set.set(r, r); });
    return [{ value: "", label: "Tutti i rami" }, ...Array.from(set.values()).sort().map(r => ({ value: r, label: r }))];
  }, [withDays]);

  const compagnieOptions = useMemo(() => {
    const set = new Map<string, string>();
    withDays.forEach(p => { const c = p.compagnie?.nome; if (c) set.set(c, c); });
    return [{ value: "", label: "Tutte le compagnie" }, ...Array.from(set.values()).sort().map(c => ({ value: c, label: c }))];
  }, [withDays]);

  const filtered = useMemo(() => {
    return withDays.filter(p => {
      if (finestra === "20" && p.giorni > 20) return false;
      if (finestra === "60" && p.giorni > 60) return false;
      if (finestra === "90" && p.giorni > 90) return false;
      if (finestra === "custom") {
        const d = new Date(p.data_scadenza);
        if (dataDa && d < dataDa) return false;
        if (dataA && d > dataA) return false;
      }
      if (ramo && p.rami?.descrizione !== ramo) return false;
      if (compagnia && p.compagnie?.nome !== compagnia) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${p.numero_titolo ?? ""} ${p.targa_telaio ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [withDays, finestra, ramo, compagnia, search, dataDa, dataA]);

  const entro20 = filtered.filter(p => p.giorni <= 20).length;
  const entro60 = filtered.filter(p => p.giorni <= 60).length;
  const entro90 = filtered.filter(p => p.giorni <= 90).length;

  const kpis = [
    { label: "Entro 20 gg", value: entro20, color: "text-red-600", border: "#dc2626" },
    { label: "Entro 60 gg", value: entro60, color: "text-orange-600", border: "#ea580c" },
    { label: "Entro 90 gg", value: entro90, color: "text-yellow-600", border: "#ca8a04" },
  ];

  const resetFiltri = () => {
    setFinestra("tutte"); setRamo(""); setCompagnia(""); setSearch(""); setDataDa(null); setDataA(null);
  };

  const filtriAttivi = finestra !== "tutte" || ramo || compagnia || search || dataDa || dataA;

  if (loading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>;

  const finestre: { v: Finestra; l: string }[] = [
    { v: "tutte", l: "Tutte" },
    { v: "20", l: "≤ 20 gg" },
    { v: "60", l: "≤ 60 gg" },
    { v: "90", l: "≤ 90 gg" },
    { v: "custom", l: "Range date" },
  ];

  return (
    <div data-tour="cl-scad-page" className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
          <CalendarClock className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Scadenziario Polizze</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} di {withDays.length} polizze</p>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        {kpis.map(k => (
          <Card key={k.label} className="border-l-4" style={{ borderLeftColor: k.border }}>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-xs text-muted-foreground font-medium uppercase">{k.label}</p>
              <p className={`text-3xl font-bold mt-1 ${k.color}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtri */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {finestre.map(f => (
              <Button key={f.v} size="sm" variant={finestra === f.v ? "default" : "outline"}
                className={finestra === f.v ? "bg-teal-700 hover:bg-teal-800" : ""}
                onClick={() => setFinestra(f.v)}>
                {f.l}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <SearchableSelect options={ramiOptions} value={ramo} onValueChange={setRamo} placeholder="Garanzia" />
            <SearchableSelect options={compagnieOptions} value={compagnia} onValueChange={setCompagnia} placeholder="Compagnia" />
            <Input placeholder="Cerca n° polizza / targa" value={search} onChange={(e) => setSearch(e.target.value)} />
            {finestra === "custom" && (
              <div className="flex gap-2">
                <DatePicker value={dataDa} onChange={setDataDa} placeholder="Da" />
                <DatePicker value={dataA} onChange={setDataA} placeholder="A" />
              </div>
            )}
            {filtriAttivi && (
              <Button variant="ghost" size="sm" onClick={resetFiltri} className="gap-1.5">
                <X className="h-4 w-4" /> Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista Scadenze */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">Nessuna scadenza con i filtri selezionati</p>
        ) : filtered.map(p => {
          const urgente = p.giorni <= 20;
          const inScadenza = p.giorni <= 60;
          const barWidth = Math.max(5, Math.min(100, 100 - (p.giorni / 365) * 100));
          const barColor = urgente ? "bg-red-500" : inScadenza ? "bg-orange-400" : "bg-yellow-400";

          return (
            <Link key={p.id} to={p._detailPath ?? `/cliente/polizze/${p.id}#scadenziario`} className="block">
              <Card className="hover:shadow-md hover:border-teal-300 transition-all cursor-pointer">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-foreground">{p.numero_titolo}</p>
                        {urgente && <Badge className="bg-red-100 text-red-800 text-xs">🔴 URGENTE</Badge>}
                        {!urgente && inScadenza && <Badge className="bg-orange-100 text-orange-800 text-xs">🟠 IN SCADENZA</Badge>}
                      </div>
                      <p className="text-sm text-teal-700">{p.rami?.descrizione}</p>
                      <p className="text-xs text-muted-foreground">{p.compagnie?.nome}</p>
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${barWidth}%` }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1.5 justify-end">
                        <Clock className={`h-4 w-4 ${urgente ? "text-red-500" : "text-muted-foreground"}`} />
                        <span className={`text-2xl font-bold ${urgente ? "text-red-600" : inScadenza ? "text-orange-600" : "text-foreground"}`}>{p.giorni}</span>
                        <span className="text-xs text-muted-foreground">gg</span>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-xs text-muted-foreground mt-1 cursor-help underline decoration-dotted underline-offset-2">
                            {fmtShort(p.data_scadenza)}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent>{fmtFull(p.data_scadenza)}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default ClienteScadenze;
