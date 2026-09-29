import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, CalendarClock, AlertTriangle, TrendingUp, Truck } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, differenceInDays } from "date-fns";
import { it } from "date-fns/locale";
import { fmtEuro0 as fmt } from "@/lib/formatCurrency";
import InfoHint from "@/components/cliente/InfoHint";
import {
  aggregaPremiSinistriPerAnno,
  aggregaSomma,
  dedupeCgaSuTitoli,
  isPolizzaDashAttiva,
  premioAnnuoDash,
  ramoLabelFromJoin,
  topNConAltri,
  topNSinistriPerRamo,
  type ClienteDashPolizza,
  type ClienteDashSinistro,
} from "@/lib/clienteDashboard";
import { isSinistroAperto } from "@/lib/sinistriStati";

const COLORS = ["#0d9488", "#f59e0b", "#6366f1", "#ef4444", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4"];

const ClienteDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [polizze, setPolizze] = useState<ClienteDashPolizza[]>([]);
  const [sinistri, setSinistri] = useState<ClienteDashSinistro[]>([]);
  const [mezziCount, setMezziCount] = useState(0);
  const [today] = useState(() => new Date());

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: clienteIds } = await supabase.rpc("get_my_cliente_ids");
      if (!clienteIds?.length) { setLoading(false); return; }

      const ids = clienteIds.map((c: string) => c);

      const [polRes, cgaRes, sinRes] = await Promise.all([
        supabase
          .from("titoli")
          .select("id, numero_titolo, stato, premio_lordo, frazionamento, periodicita, data_scadenza, durata_da, garanzia_da, sostituisce_polizza, is_appendice_modifica, is_proroga, is_regolazione, libro_matricola, compagnie(nome), rami:rami!titoli_ramo_id_fkey(descrizione, gruppo_ramo:gruppi_ramo!rami_gruppo_ramo_id_fkey(descrizione))")
          .in("cliente_anagrafica_id", ids),
        supabase
          .from("polizza_cga")
          .select("id, numero_polizza, stato, premio_lordo_totale, data_scadenza, data_decorrenza, prodotti_cga(nome_prodotto, compagnia, ramo)")
          .in("cliente_id", ids)
          .eq("stato", "approvato"),
        supabase
          .from("sinistri")
          .select("id, stato, importo_riserva, importo_liquidato, data_apertura, ramo_sinistro")
          .in("cliente_anagrafica_id", ids)
          .neq("stato", "archiviato")
          .order("data_apertura", { ascending: false }),
      ]);

      const titoliMapped: ClienteDashPolizza[] = (polRes.data ?? []).map((t: any) => ({
        id: t.id,
        source: "titoli",
        numero: t.numero_titolo ?? null,
        stato: t.stato ?? null,
        premioRata: Number(t.premio_lordo) || 0,
        frazionamento: t.frazionamento || t.periodicita || null,
        dataScadenza: t.data_scadenza ?? null,
        dataInizio: t.durata_da || t.garanzia_da || null,
        ramo: ramoLabelFromJoin(t.rami),
        compagnia: t.compagnie?.nome || "Altro",
        sostituisce_polizza: t.sostituisce_polizza ?? null,
        is_appendice_modifica: !!t.is_appendice_modifica,
        is_proroga: !!t.is_proroga,
        is_regolazione: !!t.is_regolazione,
        detailPath: `/cliente/polizze/${t.id}#scadenziario`,
      }));

      const cgaMapped: ClienteDashPolizza[] = (cgaRes.data ?? []).map((c: any) => ({
        id: c.id,
        source: "cga",
        numero: c.numero_polizza ?? null,
        stato: "attivo",
        premioRata: Number(c.premio_lordo_totale) || 0,
        frazionamento: null,
        dataScadenza: c.data_scadenza ?? null,
        dataInizio: c.data_decorrenza ?? null,
        ramo: c.prodotti_cga?.ramo || "Altro",
        compagnia: c.prodotti_cga?.compagnia || "Altro",
        sostituisce_polizza: null,
        is_appendice_modifica: false,
        is_proroga: false,
        is_regolazione: false,
        detailPath: `/cliente/assistente?polizza=${c.id}`,
      }));

      setPolizze(dedupeCgaSuTitoli(titoliMapped, cgaMapped));
      setSinistri((sinRes.data ?? []).map((s: any) => ({
        id: s.id,
        stato: s.stato ?? null,
        ramo: s.ramo_sinistro || "Altro",
        importo: Number(s.importo_liquidato) || Number(s.importo_riserva) || 0,
        dataApertura: s.data_apertura ?? null,
      })));

      const lmTitoloIds = (polRes.data ?? [])
        .filter((t: any) => t.libro_matricola && t.libro_matricola !== "no")
        .map((t: any) => t.id);
      if (lmTitoloIds.length) {
        const { count } = await supabase
          .from("libro_matricola_mezzi")
          .select("id", { count: "exact", head: true })
          .in("titolo_id", lmTitoloIds)
          .is("data_esclusione", null);
        setMezziCount(count || 0);
      } else {
        setMezziCount(0);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const attive = useMemo(() => polizze.filter(isPolizzaDashAttiva), [polizze]);
  const premiTotali = useMemo(() => attive.reduce((s, p) => s + premioAnnuoDash(p), 0), [attive]);
  const sinAperti = useMemo(
    () => sinistri.filter((s) => isSinistroAperto(s.stato)).length,
    [sinistri],
  );
  const prossimeScadenze = useMemo(
    () => attive.filter((p) => {
      if (!p.dataScadenza) return false;
      const d = differenceInDays(new Date(p.dataScadenza), today);
      return d <= 90 && d >= 0;
    }).length,
    [attive, today],
  );

  const premiPerRamo = useMemo(
    () => topNConAltri(aggregaSomma(attive, (p) => p.ramo), 6),
    [attive],
  );
  const totRamo = premiPerRamo.reduce((s, x) => s + x.value, 0);

  const premiPerCompagnia = useMemo(
    () => topNConAltri(aggregaSomma(attive, (p) => p.compagnia), 8, "Altre"),
    [attive],
  );

  const sinPerRamo = useMemo(() => topNSinistriPerRamo(sinistri, 6), [sinistri]);

  const barPremiSinistri = useMemo(
    () => aggregaPremiSinistriPerAnno(attive, sinistri),
    [attive, sinistri],
  );

  const kpis = [
    { title: "Polizze Attive", value: attive.length, icon: Shield, color: "text-emerald-600", bg: "bg-emerald-100", link: "/cliente/polizze", hint: "Polizze madri in portafoglio (escluse quietanze, appendici e duplicati CGA)." },
    { title: "Premi Totali", value: fmt(premiTotali), icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-100", link: "/cliente/polizze", hint: "Somma dei premi lordi annui (rata × frazionamento) delle polizze madri attive." },
    { title: "Sinistri Aperti", value: sinAperti, icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-100", link: "/cliente/sinistri", hint: "Sinistri non ancora chiusi o respinti: in valutazione, lavorazione, attesa documenti o liquidazione." },
    { title: "Scadenze 90gg", value: prossimeScadenze, icon: CalendarClock, color: "text-red-600", bg: "bg-red-100", link: "/cliente/scadenze", hint: "Polizze attive che scadono nei prossimi 90 giorni: pianifica i rinnovi per tempo." },
    { title: "Parco Veicoli", value: mezziCount, icon: Truck, color: "text-teal-700", bg: "bg-teal-100", link: "/cliente/parco-veicoli", hint: "Mezzi attivi sul libro matricola delle polizze flotta." },
  ];

  const scadenzeVicine = useMemo(
    () => attive
      .filter((p) => p.dataScadenza)
      .map((p) => ({ ...p, giorni: differenceInDays(new Date(p.dataScadenza!), today) }))
      .filter((p) => p.giorni >= 0)
      .sort((a, b) => a.giorni - b.giorni)
      .slice(0, 4),
    [attive, today],
  );

  const barCompagniaH = Math.min(420, Math.max(260, premiPerCompagnia.length * 36 + 24));
  const barSinH = Math.min(320, Math.max(220, sinPerRamo.length * 36 + 48));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Benvenuto nella tua Area Clienti</h1>
        <p className="text-muted-foreground text-sm mt-1">Panoramica della tua situazione assicurativa</p>
      </div>

      <div data-tour="cl-dash-kpi" className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((k) => (
          <Link key={k.title} to={k.link}>
              <Card className="hover:shadow-lg transition-all cursor-pointer border-l-4" style={{ borderLeftColor: k.color.includes("emerald") ? "#059669" : k.color.includes("blue") ? "#2563eb" : k.color.includes("orange") ? "#ea580c" : k.color.includes("teal") ? "#0f766e" : "#dc2626" }}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      {k.title}
                      {k.hint && <InfoHint text={k.hint} size="xs" />}
                    </p>
                    <p className="text-2xl font-bold text-foreground mt-1">{loading ? "…" : k.value}</p>
                  </div>
                  <div className={`h-11 w-11 rounded-full ${k.bg} flex items-center justify-center`}>
                    <k.icon className={`h-5 w-5 ${k.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ripartizione Premi per Ramo</CardTitle>
            </CardHeader>
            <CardContent>
              {premiPerRamo.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={premiPerRamo}
                      cx="42%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={92}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {premiPerRamo.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      wrapperStyle={{ fontSize: 12, maxWidth: 180 }}
                      formatter={(value: string, entry: { payload?: { value?: number } }) => {
                        const v = Number(entry?.payload?.value) || 0;
                        const pct = totRamo > 0 ? Math.round((v / totRamo) * 100) : 0;
                        return `${value} ${pct}%`;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-12">Nessun dato</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Premi per Compagnia</CardTitle>
            </CardHeader>
            <CardContent>
              {premiPerCompagnia.length > 0 ? (
                <ResponsiveContainer width="100%" height={barCompagniaH}>
                  <BarChart data={premiPerCompagnia} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                    <XAxis type="number" tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={168} tick={{ fontSize: 11 }} interval={0} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="value" fill="#0d9488" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-12">Nessun dato</p>}
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-red-500" /> Prossime Scadenze
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {scadenzeVicine.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nessuna scadenza nei prossimi 90 giorni</p>
              ) : scadenzeVicine.map((s) => (
                <Link
                  key={s.id}
                  to={s.detailPath}
                  className="flex items-center justify-between py-2 px-2 -mx-2 rounded-md border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-sm font-medium truncate">{s.numero}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.ramo}</p>
                    {s.compagnia && <p className="text-[11px] text-muted-foreground/80 truncate">{s.compagnia}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <Badge className={s.giorni <= 30 ? "bg-red-100 text-red-800" : s.giorni <= 60 ? "bg-orange-100 text-orange-800" : "bg-yellow-100 text-yellow-800"}>
                      {s.giorni} gg
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(s.dataScadenza!), "dd MMM yyyy", { locale: it })}</p>
                  </div>
                </Link>
              ))}
              {scadenzeVicine.length > 0 && (
                <div className="pt-2 text-right">
                  <Link to="/cliente/scadenze" className="text-xs text-teal-700 hover:underline">Vedi tutte →</Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" /> Sinistri per Ramo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sinPerRamo.length > 0 ? (
                <ResponsiveContainer width="100%" height={barSinH}>
                  <BarChart data={sinPerRamo} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }}>
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} interval={0} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="aperti" name="Aperti" stackId="s" fill="#f97316" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="chiusi" name="Chiusi" stackId="s" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-12">Nessun sinistro</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-teal-600" /> Premi vs Sinistri per Anno
              </CardTitle>
            </CardHeader>
            <CardContent>
              {barPremiSinistri.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barPremiSinistri}>
                    <XAxis dataKey="anno" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="premi" name="Premi annui" fill="#0d9488" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="sinistri" name="Importo sinistri" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-12">Nessun dato</p>}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Azioni rapide</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link to="/cliente/chat"><Badge variant="secondary" className="cursor-pointer px-3 py-1.5 text-sm hover:bg-muted">💬 Scrivi all&apos;agenzia</Badge></Link>
          <Link to="/cliente/polizze"><Badge variant="secondary" className="cursor-pointer px-3 py-1.5 text-sm hover:bg-muted">📋 Vedi polizze</Badge></Link>
          <Link to="/cliente/sinistri"><Badge variant="secondary" className="cursor-pointer px-3 py-1.5 text-sm hover:bg-muted">⚠️ Sinistri</Badge></Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClienteDashboard;
