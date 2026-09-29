import { useState, useMemo } from "react";
import { useServerPagination } from "@/hooks/useServerPagination";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { Archive, Search, Eye } from "lucide-react";
import { NuovaPolizzaButton } from "@/components/shared/NuovaPolizzaButton";
import { format } from "date-fns";
import ServerPagination from "@/components/ServerPagination";
import { RamoSottoramoFilter, expandRamoFilter } from "@/components/polizze/RamoSottoramoFilter";
import { useRamiAll } from "@/hooks/useRamiLookup";
import { useCompensazioniByTitoli } from "@/hooks/useCompensazioniByTitoli";
import { CompensazioneBadge } from "@/components/portafoglio/CompensazioneBadge";
import { TipoFilterSegmented } from "@/components/polizze/TipoFilterSegmented";
import { TipoPolizzaBadge } from "@/components/polizze/TipoPolizzaBadge";
import { rowBorderClass, isQuietanzaRow, displayStatoPolizza, messaCassaRowBgClass, isMessaACassa } from "@/lib/polizzeDisplay";

const rowHref = (p: any) =>
  p?.sostituisce_polizza
    ? `/quietanze/${p.quietanza_id}`
    : `/polizze/${p.polizza_id}`;

const PortafoglioStoricoPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filtroCompagnia, setFiltroCompagnia] = useState("tutte");
  const [filtroGruppoRamo, setFiltroGruppoRamo] = useState<string | null>(null);
  const [filtroRamo, setFiltroRamo] = useState<string | null>(null);
  const [filtroStato, setFiltroStato] = useState("tutti");
  const [filtroTipo, setFiltroTipo] = useState<"polizze" | "quietanze" | "regolazioni" | "garantiti">("quietanze");
  const { data: ramiAll = [] } = useRamiAll();
  const { ramoIds: filterRamoIds } = expandRamoFilter(filtroGruppoRamo, filtroRamo, ramiAll);
  const { page, setPage, pageSize, range } = useServerPagination(25, [search, filtroCompagnia, filtroGruppoRamo, filtroRamo, filtroStato, filtroTipo]);

  const today = format(new Date(), "yyyy-MM-dd");

  const { data: compagnie } = useQuery({
    queryKey: ["agenzie-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      return data || [];
    },
  });

  // rami list now provided via useRamiAll above

  const buildFilter = (q: any) => {
    if (filtroStato === "tutti") {
      q = q.or(`stato.eq.scaduto,stato.eq.estinto,and(stato.eq.attivo,garanzia_a.lt.${today})`);
    } else {
      q = q.eq("stato", filtroStato);
      if (filtroStato === "attivo") {
        q = q.lt("garanzia_a", today);
      }
    }
    if (search) {
      q = q.or(`numero_titolo.ilike.%${search}%,cliente_nome_display.ilike.%${search}%,cliente_codice.ilike.%${search}%,targa_telaio.ilike.%${search}%`);
    }
    if (filtroCompagnia !== "tutte") q = q.eq("compagnia_id", filtroCompagnia);
    if (filterRamoIds && filterRamoIds.length > 0) q = q.in("ramo_id", filterRamoIds);
    if (filtroTipo === "polizze") q = q.is("sostituisce_polizza", null).or("is_regolazione.is.null,is_regolazione.eq.false");
    else if (filtroTipo === "quietanze") q = q.not("sostituisce_polizza", "is", null).or("is_regolazione.is.null,is_regolazione.eq.false");
    else if (filtroTipo === "regolazioni") q = q.eq("is_regolazione", true);
    return q;
  };

  const { data: result, isLoading } = useQuery({
    queryKey: ["portafoglio-storico", search, filtroCompagnia, filterRamoIds, filtroStato, filtroTipo, page, today],
    queryFn: async () => {
      let q = supabase.from("v_portafoglio_quietanze").select(
        "id, quietanza_id, polizza_id, numero_titolo, compagnia_nome, ramo_nome, cliente_nome_display, cliente_codice, stato, garanzia_da, garanzia_a, data_scadenza, premio_lordo, rate, ae_nome, specialist, produttore_nome, produttori_display, provvigioni_firma, provvigioni_quietanza, targa_telaio, compagnia_id, ramo_id, data_sospensione, limite_riattivazione, cliente_anagrafica_id, sostituisce_polizza, is_regolazione, regolazione_quietanza_id",
        { count: "exact" }
      );
      q = buildFilter(q);
      const { data, count } = await q
        .order("data_scadenza", { ascending: false })
        .range(range.from, range.to);
      return { data: data || [], count: count || 0 };
    },
  });

  const polizze = result?.data || [];
  const totalCount = result?.count || 0;

  const titoloIdsRiga = useMemo(() => polizze.map((p: any) => p.id), [polizze]);
  const { data: compensazioniMap } = useCompensazioniByTitoli(titoloIdsRiga);


  const fmtCurrency = (v: number | null) =>
    v != null ? `€ ${Number(v).toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "—";

  const fmtDate = (d: string | null) =>
    d ? format(new Date(d), "dd/MM/yyyy") : "—";

  const frazLabel = (r: number | null) => {
    if (!r) return "—";
    const map: Record<number, string> = { 1: "Ann.", 2: "Sem.", 3: "Trim.", 4: "Quad.", 12: "Mens." };
    return map[r] || String(r);
  };

  const statoBadgeVariant = (stato: string) => {
    switch (stato) {
      case "attivo": return "default" as const;
      case "sospeso": return "secondary" as const;
      case "scaduto": return "destructive" as const;
      case "estinto": return "destructive" as const;
      case "incassato": return "outline" as const;
      default: return "secondary" as const;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Storico Polizze</h1>
          <p className="text-sm text-muted-foreground">Polizze scadute o con copertura terminata — sola consultazione</p>
        </div>
        <NuovaPolizzaButton />
      </div>

      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="rounded-lg bg-muted p-3">
            <Archive className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Polizze in archivio</p>
            <p className="text-2xl font-bold text-foreground">{totalCount}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per n° polizza, cliente, codice, targa..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <Select value={filtroStato} onValueChange={(v) => { setFiltroStato(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti gli stati</SelectItem>
            <SelectItem value="scaduto">Scaduto</SelectItem>
            <SelectItem value="estinto">Estinto</SelectItem>
            <SelectItem value="attivo">Attivo (garanzia scaduta)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroCompagnia} onValueChange={(v) => { setFiltroCompagnia(v); setPage(0); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Agenzia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutte">Tutte le agenzie</SelectItem>
            {compagnie?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <RamoSottoramoFilter
          gruppoRamoId={filtroGruppoRamo}
          ramoId={filtroRamo}
          onChange={({ gruppoRamoId, ramoId }) => {
            setFiltroGruppoRamo(gruppoRamoId);
            setFiltroRamo(ramoId);
            setPage(0);
          }}
        />
        <TipoFilterSegmented
          value={filtroTipo}
          onChange={(v) => { setFiltroTipo(v); setPage(0); }}
          withRegolazioni
        />
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Caricamento...</div>
      ) : polizze.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">Nessuna polizza trovata nello storico</div>
      ) : (
        <>
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Polizza</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cliente</TableHead>
                  
                  <TableHead>Agenzia</TableHead>
                  <TableHead>Garanzia</TableHead>
                  <TableHead>Inizio Garanzia</TableHead>
                  <TableHead>Fine Garanzia</TableHead>
                  <TableHead>Targa</TableHead>
                  <TableHead>Fraz</TableHead>
                  <TableHead className="text-right">Lordo</TableHead>
                  <TableHead className="text-right">Attive</TableHead>
                  <TableHead className="text-right">Passive</TableHead>
                  <TableHead>AE</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Dt. Sosp.</TableHead>
                  <TableHead>Lim. Riatt.</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {polizze.map((p: any, idx: number) => {
                  const isQ = isQuietanzaRow(p);
                  const statoShown = displayStatoPolizza(p);
                  return (
                  <TableRow
                    key={p.id}
                    className={`cursor-pointer ${rowBorderClass(p)} ${messaCassaRowBgClass(p)} ${!isMessaACassa(p) && isQ ? "hover:bg-muted/40" : ""} ${p.is_regolazione ? "bg-orange-50/40" : idx % 2 === 1 && !isMessaACassa(p) && !isQ ? "bg-muted/30" : ""}`}
                    onClick={() => navigate(rowHref(p))}
                  >
                    <TableCell className={`font-medium ${isQ ? "pl-8 font-normal text-muted-foreground" : ""}`}>
                      {isQ && <span className="mr-1 text-muted-foreground">└</span>}
                      {p.is_regolazione && <span className="text-orange-600 mr-1" title="Regolazione collegata">↳</span>}
                      {p.numero_titolo || "—"}
                    </TableCell>
                    <TableCell>
                      {p.is_regolazione
                        ? <Badge className="bg-orange-500 hover:bg-orange-600 text-white">Regolazione</Badge>
                        : isQ
                          ? <TipoPolizzaBadge tipo="quietanza" messaACassa={isMessaACassa(p)} />
                          : <TipoPolizzaBadge tipo="polizza" />}
                    </TableCell>
                    <TableCell>{p.cliente_nome_display || "—"}</TableCell>
                    <TableCell>{p.compagnia_nome || "—"}</TableCell>
                    <TableCell>{p.ramo_nome || "—"}</TableCell>
                    <TableCell>{isQ ? fmtDate(p.garanzia_da) : "—"}</TableCell>
                    <TableCell>{isQ ? fmtDate(p.garanzia_a) : "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{p.targa_telaio || "—"}</TableCell>
                    <TableCell>{frazLabel(p.rate)}</TableCell>
                    <TableCell className="text-right">{fmtCurrency(p.premio_lordo)}</TableCell>
                    <TableCell className="text-right">{fmtCurrency(p.provvigioni_firma)}</TableCell>
                    <TableCell className="text-right">{fmtCurrency(p.provvigioni_quietanza)}</TableCell>
                    <TableCell className="text-sm">{p.ae_nome || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge variant={statoBadgeVariant(statoShown)}>{statoShown}</Badge>
                        <CompensazioneBadge summary={compensazioniMap?.get(p.id)} titoloId={p.id} />
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{fmtDate(p.data_sospensione)}</TableCell>
                    <TableCell className="text-sm">{fmtDate(p.limite_riattivazione)}</TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Apri dettaglio (sola consultazione)"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(rowHref(p));
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
        </>
      )}
      
    </div>
  );
};

export default PortafoglioStoricoPage;
