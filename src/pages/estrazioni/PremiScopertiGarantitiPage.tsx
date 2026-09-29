import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ShieldCheck, ShieldAlert, FileText, TrendingUp, FileSpreadsheet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import EstrazioniFilters, { EstrazioniFiltersState, defaultFilters } from "@/components/estrazioni/EstrazioniFilters";
import { format } from "date-fns";
import { exportEstrazioneWorkbook } from "@/lib/estrazioni/exportXlsx";
import { buildEstrazionePdf, downloadEstrazionePdf } from "@/lib/estrazioni/exportPdf";
import { aggregatePivot } from "@/lib/estrazioni/pivot";
import { periodoLabel } from "@/lib/estrazioni/utils";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  type ClassificazioneFilter,
  type CriterioDataFilter,
  type MoraStatusFilter,
  type PremiScopertiRaw,
  type PremiScopertiRow,
  fmtDateIt,
  inDateRange,
  isApertoDaIncassare,
  mapPremiScopertiRow,
} from "@/lib/premiScopertiGarantiti";
import { PENDENTI_OR_GARANTITO_APERTO_FILTER } from "@/lib/garantitoTitolo";

const SELECT = `
  id, numero_titolo, stato, premio_lordo, importo_incassato, ufficio_id, compagnia_id,
  garanzia_da, garanzia_a, limite_mora, mora_giorni, tipo_portafoglio, prodotto_nome,
  data_messa_cassa, data_copertura, conferimento_gestito, fondi_ricevuti, tipo_pagamento,
  sostituisce_polizza, is_appendice_modifica, is_proroga, is_regolazione,
  clienti!titoli_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale),
  compagnia_diretta:compagnie!titoli_compagnia_id_fkey(
    id, nome, codice, gruppo_compagnia, gruppo_compagnia_id,
    gruppi_compagnia:gruppo_compagnia_id(descrizione)
  ),
  compagnia_rapporto:compagnia_rapporti!titoli_compagnia_rapporto_id_fkey(
    id, gruppo_compagnia_id, gruppi_compagnia:gruppo_compagnia_id(descrizione, codice)
  ),
  ramo:rami!titoli_ramo_id_fkey(
    id, codice, descrizione,
    gruppo_ramo:gruppi_ramo!rami_gruppo_ramo_id_fkey(id, codice, descrizione)
  ),
  uffici(nome_ufficio)
`;

const PremiScopertiGarantitiPage = () => {
  const navigate = useNavigate();
  const { isAdmin, profile, loading: authLoading } = useAuth();
  const isCfo = profile?.ruolo === "cfo";
  const seeAllSedi = isAdmin || isCfo;
  const lockUfficioId = !seeAllSedi && profile?.ufficio_id ? profile.ufficio_id : null;
  const authReady = !authLoading && !!profile;

  const [filters, setFilters] = useState<EstrazioniFiltersState>(() => ({
    ...defaultFilters,
    ufficio_id: lockUfficioId,
  }));
  const [filtroTipo, setFiltroTipo] = useState<ClassificazioneFilter>("tutti");
  const [filtroMora, setFiltroMora] = useState<MoraStatusFilter>("tutti");
  const [criterioData, setCriterioData] = useState<CriterioDataFilter>("smart");
  const [exportingPdf, setExportingPdf] = useState(false);
  const periodo = periodoLabel(filters.dateFrom, filters.dateTo);

  useEffect(() => {
    if (!lockUfficioId) return;
    setFilters((prev) => (prev.ufficio_id === lockUfficioId ? prev : { ...prev, ufficio_id: lockUfficioId }));
  }, [lockUfficioId]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: [
      "premi-scoperti-garantiti",
      filters.ufficio_id,
      filters.compagnia_id,
      filters.dateFrom?.toISOString(),
      filters.dateTo?.toISOString(),
      criterioData,
      seeAllSedi,
      lockUfficioId,
    ],
    enabled: authReady && (seeAllSedi || !!lockUfficioId),
    queryFn: async () => {
      let query = supabase
        .from("titoli")
        .select(SELECT)
        .or(PENDENTI_OR_GARANTITO_APERTO_FILTER)
        .in("stato", ["attivo", "sospeso"])
        .limit(5000);

      const ufficioId = lockUfficioId || filters.ufficio_id;
      if (ufficioId) query = query.eq("ufficio_id", ufficioId);
      if (filters.compagnia_id) query = query.eq("compagnia_id", filters.compagnia_id);

      const { data: titoli, error } = await query
        .order("ufficio_id", { ascending: true })
        .order("limite_mora", { ascending: true, nullsFirst: false });
      if (error) throw error;

      return ((titoli || []) as PremiScopertiRaw[])
        .filter(isApertoDaIncassare)
        .map((t) => mapPremiScopertiRow(t, criterioData))
        .filter((r) => inDateRange(r.dateKey, filters.dateFrom, filters.dateTo))
        .sort((a, b) => {
          const sedeCmp = a.sede.localeCompare(b.sede, "it");
          if (sedeCmp !== 0) return sedeCmp;
          const moraCmp = (a.limiteMora || "9999").localeCompare(b.limiteMora || "9999");
          if (moraCmp !== 0) return moraCmp;
          return a.cliente.localeCompare(b.cliente, "it");
        });
    },
  });

  const filtered = useMemo(() => {
    return rows.filter((t) => {
      if (filtroTipo === "scoperti" && t.classificazione !== "scoperto") return false;
      if (filtroTipo === "garantiti" && t.classificazione !== "garantito") return false;
      if (filtroMora !== "tutti" && t.moraStatus !== filtroMora) return false;
      return true;
    });
  }, [rows, filtroTipo, filtroMora]);

  const garantiti = filtered.filter((t) => t.classificazione === "garantito");
  const scoperti = filtered.filter((t) => t.classificazione === "scoperto");
  const totGarantiti = garantiti.reduce((s, t) => s + t.premioLordo, 0);
  const totScoperti = scoperti.reduce((s, t) => s + t.premioLordo, 0);
  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

  const pivotSede = useMemo(
    () =>
      aggregatePivot(
        filtered,
        (t: PremiScopertiRow) => t.sede,
        (t: PremiScopertiRow) => ({
          premio: t.premioLordo,
          incassato: t.classificazione === "garantito" ? t.premioLordo : 0,
        }),
      ),
    [filtered],
  );

  const pivotAgenzia = useMemo(
    () =>
      aggregatePivot(
        filtered,
        (t: PremiScopertiRow) => t.agenzia,
        (t: PremiScopertiRow) => ({
          premio: t.premioLordo,
          incassato: t.classificazione === "garantito" ? t.premioLordo : 0,
        }),
      ),
    [filtered],
  );

  const pivotClassificazione = useMemo(
    () =>
      aggregatePivot(
        filtered,
        (t: PremiScopertiRow) => (t.classificazione === "garantito" ? "Garantito" : "Scoperto"),
        (t: PremiScopertiRow) => ({ premio: t.premioLordo, incassato: 0 }),
      ),
    [filtered],
  );

  const commentary = useMemo(() => {
    if (!filtered.length) return `Nessun dato nel periodo ${periodo}.`;
    return [
      `Premi scoperti e garantiti — periodo ${periodo} (criterio data: ${criterioDataLabel(criterioData)}).`,
      `${garantiti.length} garantiti (${fmt(totGarantiti)}), ${scoperti.length} scoperti (${fmt(totScoperti)}).`,
      `Organizzati per sede (${new Set(filtered.map((r) => r.sede)).size} sedi).`,
    ].join("\n");
  }, [filtered, periodo, garantiti.length, scoperti.length, totGarantiti, totScoperti, criterioData]);

  const exportExcel = () => {
    exportEstrazioneWorkbook({
      title: "Premi Scoperti e Garantiti — Consulnet",
      subtitle: `Periodo: ${periodo}`,
      metaRows: [
        [],
        ["N. garantiti", garantiti.length],
        ["N. scoperti", scoperti.length],
        ["Totale garantito (€)", Number(totGarantiti.toFixed(2))],
        ["Totale scoperto (€)", Number(totScoperti.toFixed(2))],
      ],
      filtri: {
        Periodo: periodo,
        "Criterio data": criterioDataLabel(criterioData),
        Classificazione: filtroTipo === "tutti" ? "Tutti" : filtroTipo === "scoperti" ? "Solo scoperti" : "Solo garantiti",
        "Limite mora": moraFilterLabel(filtroMora),
        Sede: lockUfficioId ? "Sede profilo" : filters.ufficio_id || "Tutte",
      },
      commentary,
      dettaglio: {
        name: "Dettaglio",
        rows: filtered.map((t) => ({
          Sede: t.sede,
          Cliente: t.cliente,
          Agenzia: t.agenzia,
          Ramo: t.ramo,
          Garanzia: t.garanzia,
          "N. Polizza": t.numeroTitolo,
          "Importo (€)": Number(t.premioLordo.toFixed(2)),
          "Scadenza garanzia": t.garanziaA || "",
          "Limite mora": t.limiteMora || "",
          "Tipo documento": t.tipoDocumento,
          Classificazione: t.classificazione === "garantito" ? "Garantito" : "Scoperto",
        })),
      },
      pivots: [
        { dimensione: "Sede", rows: pivotSede },
        { dimensione: "Agenzia", rows: pivotAgenzia },
        { dimensione: "Classificazione", rows: pivotClassificazione },
      ],
      fileName: `premi_scoperti_garantiti_${format(new Date(), "yyyyMMdd")}.xlsx`,
    });
    toast.success("Excel generato");
  };

  const exportPdf = async () => {
    try {
      setExportingPdf(true);
      const bytes = await buildEstrazionePdf({
        title: "Premi Scoperti e Garantiti",
        subtitle: `Periodo: ${periodo}`,
        kpis: [
          { label: "Garantiti", value: String(garantiti.length) },
          { label: "Scoperti", value: String(scoperti.length) },
          { label: "Tot. garantito", value: fmt(totGarantiti) },
          { label: "Tot. scoperto", value: fmt(totScoperti) },
        ],
        commentary,
        pivotTables: [
          { title: "Pivot per Sede", rows: pivotSede },
          { title: "Pivot per Agenzia", rows: pivotAgenzia },
          { title: "Pivot per Classificazione", rows: pivotClassificazione },
        ],
      });
      downloadEstrazionePdf(bytes, `premi_scoperti_garantiti_${format(new Date(), "yyyyMMdd")}.pdf`);
      toast.success("PDF generato");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore generazione PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  const kpiCards = [
    { label: "N. Garantiti", value: garantiti.length.toString(), icon: ShieldCheck, color: "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400" },
    { label: "N. Scoperti", value: scoperti.length.toString(), icon: ShieldAlert, color: "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400" },
    { label: "Totale Garantito", value: fmt(totGarantiti), icon: TrendingUp, color: "text-teal-600 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400" },
    { label: "Totale Scoperto", value: fmt(totScoperti), icon: FileText, color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/portafoglio/estrazioni-stampe")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Premi Scoperti e Garantiti</h1>
            <p className="text-sm text-muted-foreground">
              Titoli aperti (non a cassa): scoperti vs copertura garantita — Excel pivot e PDF
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportExcel} disabled={!filtered.length}>
            <FileSpreadsheet className="mr-2 h-4 w-4 text-green-700" /> Esporta Excel
          </Button>
          <Button variant="outline" onClick={exportPdf} disabled={!filtered.length || exportingPdf}>
            <FileText className="mr-2 h-4 w-4" /> {exportingPdf ? "PDF..." : "Report PDF"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", kpi.color)}>
                <kpi.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="text-lg font-bold">{isLoading ? "..." : kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <EstrazioniFilters
        filters={filters}
        onChange={setFilters}
        showUfficio
        showCompagnia
        lockUfficioId={lockUfficioId}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as ClassificazioneFilter)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Classificazione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti</SelectItem>
            <SelectItem value="scoperti">Solo scoperti</SelectItem>
            <SelectItem value="garantiti">Solo garantiti</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroMora} onValueChange={(v) => setFiltroMora(v as MoraStatusFilter)}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Limite mora" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Limite mora: tutti</SelectItem>
            <SelectItem value="scaduti">Mora scaduta</SelectItem>
            <SelectItem value="in_corso">Mora in corso</SelectItem>
            <SelectItem value="senza_limite">Senza limite mora</SelectItem>
          </SelectContent>
        </Select>

        <Select value={criterioData} onValueChange={(v) => setCriterioData(v as CriterioDataFilter)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Criterio data" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="smart">Data: limite mora (o garanzia)</SelectItem>
            <SelectItem value="limite_mora">Data: solo limite mora</SelectItem>
            <SelectItem value="garanzia_a">Data: fine garanzia</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sede</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Agenzia</TableHead>
              <TableHead>Ramo</TableHead>
              <TableHead>Garanzia</TableHead>
              <TableHead>N. Polizza</TableHead>
              <TableHead className="text-right">Importo</TableHead>
              <TableHead>Scad. garanzia</TableHead>
              <TableHead>Limite mora</TableHead>
              <TableHead>Tipo doc.</TableHead>
              <TableHead>Classificazione</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  Caricamento...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  Nessun dato
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm whitespace-nowrap">{t.sede}</TableCell>
                  <TableCell>{t.cliente}</TableCell>
                  <TableCell>{t.agenzia}</TableCell>
                  <TableCell className="text-sm">{t.ramo}</TableCell>
                  <TableCell className="text-sm">{t.garanzia}</TableCell>
                  <TableCell className="font-mono text-sm">{t.numeroTitolo}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{fmt(t.premioLordo)}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmtDateIt(t.garanziaA)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className={cn(t.moraStatus === "scaduto" && "text-destructive font-medium")}>
                      {fmtDateIt(t.limiteMora)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{t.tipoDocumento}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.classificazione === "garantito" ? "default" : "destructive"}>
                      {t.classificazione === "garantito" ? "Garantito" : "Scoperto"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

function criterioDataLabel(c: CriterioDataFilter): string {
  if (c === "limite_mora") return "Limite mora";
  if (c === "garanzia_a") return "Fine garanzia";
  return "Limite mora (fallback garanzia)";
}

function moraFilterLabel(m: MoraStatusFilter): string {
  if (m === "scaduti") return "Mora scaduta";
  if (m === "in_corso") return "Mora in corso";
  if (m === "senza_limite") return "Senza limite mora";
  return "Tutti";
}

export default PremiScopertiGarantitiPage;
