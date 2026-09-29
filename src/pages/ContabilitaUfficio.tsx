import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Package,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Coins,
  Receipt,
  Hash,
  Search,
  Printer,
  Save,
  Building2,
  User,
  Calendar,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";
import { buildIncassiCoperturePdf, type IncassiCoperturaGruppo } from "@/lib/incassi-coperture-pdf";
import { fmtEuro } from "@/lib/formatCurrency";
import {
  TITOLI_CASSA_SELECT,
  buildRiepilogoTree,
  clienteDisplay,
  dataMessaCassaLabel,
  filtraTitoliCassa,
  flattenAgenzia,
  importiTitolo,
  totaliDaTitoli,
  type GruppoAgenziaMessaCassa,
  type RiepilogoTotali,
  type TitoloCassa,
} from "@/lib/riepilogoMesseACassa";
import {
  resolveTipoPagamentoBadgeVariant,
  resolveTipoPagamentoLabelEcAgenzia,
} from "@/lib/ecAgenziaDisplay";

function SummaryCells({ t }: { t: RiepilogoTotali }) {
  return (
    <>
      <TableCell className="text-right">{t.count}</TableCell>
      <TableCell className="text-right font-mono">€ {t.premio_lordo.toFixed(2)}</TableCell>
      <TableCell className="text-right font-mono">€ {t.provvigioni.toFixed(2)}</TableCell>
      <TableCell className="text-right font-mono font-semibold">€ {t.da_rimettere.toFixed(2)}</TableCell>
    </>
  );
}

function TitoliDetailTable({ titoli, navigate }: { titoli: TitoloCassa[]; navigate: (path: string) => void }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>N° Titolo</TableHead>
          <TableHead>Rata</TableHead>
          <TableHead>Data cassa</TableHead>
          <TableHead className="text-right">Premio Lordo</TableHead>
          <TableHead className="text-right">Provvigioni</TableHead>
          <TableHead className="text-right">Netto</TableHead>
          <TableHead>Tipo Pagamento</TableHead>
          <TableHead>Tipo Incasso</TableHead>
          <TableHead className="w-8"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {titoli.map((t) => {
          const { lordo, provv, netto } = importiTitolo(t);
          const tp = t.tipo_pagamento;
          const pagLabel = resolveTipoPagamentoLabelEcAgenzia(tp);
          const pagVariant = resolveTipoPagamentoBadgeVariant(tp);
          return (
            <TableRow key={t.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate(`/titoli/${t.id}`)}>
              <TableCell className="font-mono text-sm">{t.numero_titolo || "—"}</TableCell>
              <TableCell className="text-sm">
                {t.riga != null && t.riga > 0 ? (
                  <Badge variant="outline" className="text-xs font-mono">
                    rg.{t.riga}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs capitalize">
                    {t.tipo || "polizza"}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-sm">{dataMessaCassaLabel(t.data_messa_cassa)}</TableCell>
              <TableCell className="text-right font-mono text-sm">€ {lordo.toFixed(2)}</TableCell>
              <TableCell className="text-right font-mono text-sm">€ {provv.toFixed(2)}</TableCell>
              <TableCell className="text-right font-mono text-sm font-semibold">€ {netto.toFixed(2)}</TableCell>
              <TableCell>
                <Badge variant={pagVariant as any} className="text-xs">
                  {pagLabel}
                </Badge>
              </TableCell>
              <TableCell>
                {t.conferimento_gestito ? (
                  <Badge variant={t.fondi_ricevuti ? "default" : "secondary"} className="text-xs">
                    {t.fondi_ricevuti ? "Cop. Garantita ✓" : "In Attesa Fondi"}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    Incasso diretto
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

const ContabilitaUfficio = () => {
  const navigate = useNavigate();
  const [meseCorrente, setMeseCorrente] = useState(new Date());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");

  const meseDa = format(startOfMonth(meseCorrente), "yyyy-MM-dd");
  const meseA = format(endOfMonth(meseCorrente), "yyyy-MM-dd");
  const meseLabel = format(meseCorrente, "MMMM yyyy", { locale: it });

  const { data: titoliFlat = [] } = useQuery({
    queryKey: ["titoli-cassa-mese", meseDa, meseA],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titoli")
        .select(TITOLI_CASSA_SELECT)
        .eq("stato", "incassato")
        .gte("data_messa_cassa", meseDa)
        .lte("data_messa_cassa", meseA);
      if (error) throw error;
      return ((data || []) as unknown) as TitoloCassa[];
    },
  });

  const titoliFiltrati = useMemo(() => filtraTitoliCassa(titoliFlat, searchTerm), [titoliFlat, searchTerm]);
  const albero = useMemo(() => buildRiepilogoTree(titoliFiltrati), [titoliFiltrati]);
  const totaliCassa = useMemo(() => totaliDaTitoli(titoliFiltrati), [titoliFiltrati]);

  const fmt = fmtEuro;
  const isOpen = (key: string) => !!expanded[key];
  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const { profile } = useAuth() as any;
  const [busy, setBusy] = useState(false);

  type Scope = { type: "globale" } | { type: "agenzia"; gruppo: GruppoAgenziaMessaCassa };

  const buildPdfData = (scope: Scope) => {
    const tipoPagLabel = (tp: string | null | undefined) => resolveTipoPagamentoLabelEcAgenzia(tp);
    const tipoIncassoLabel = (t: TitoloCassa) =>
      t.conferimento_gestito ? (t.fondi_ricevuti ? "Cop. Garantita" : "In Attesa Fondi") : "Incasso diretto";

    const sourceGruppi: GruppoAgenziaMessaCassa[] = scope.type === "agenzia" ? [scope.gruppo] : albero;

    const gruppi: IncassiCoperturaGruppo[] = sourceGruppi.map((g) => {
      const titoli = flattenAgenzia(g);
      return {
        agenzia: g.nome,
        count: g.count,
        premio_lordo: g.premio_lordo,
        provvigioni: g.provvigioni,
        da_rimettere: g.da_rimettere,
        titoli: titoli.map((t) => {
          const { lordo, provv, netto } = importiTitolo(t);
          return {
            numero_titolo: t.numero_titolo,
            cliente: clienteDisplay(t),
            premio_lordo: lordo,
            provvigioni: provv,
            netto,
            tipo_pagamento: tipoPagLabel(t.tipo_pagamento),
            tipo_incasso: `${tipoIncassoLabel(t)} · ${dataMessaCassaLabel(t.data_messa_cassa)}`,
          };
        }),
      };
    });

    const totali =
      scope.type === "agenzia"
        ? {
            count: scope.gruppo.count,
            premio_lordo: scope.gruppo.premio_lordo,
            provvigioni: scope.gruppo.provvigioni,
            da_rimettere: scope.gruppo.da_rimettere,
          }
        : totaliCassa;

    const filtroAgenzia = scope.type === "agenzia" ? scope.gruppo.nome : searchTerm || undefined;

    return {
      meseLabel,
      sedeNome: profile?.ufficio?.nome_ufficio || profile?.nome_ufficio || "Sede",
      generatoIl: format(new Date(), "dd/MM/yyyy HH:mm"),
      filtroAgenzia,
      gruppi,
      totali,
    };
  };

  const fileName = (scope: Scope) => {
    const ym = format(meseCorrente, "yyyy-MM");
    if (scope.type === "agenzia") {
      const slug = scope.gruppo.nome.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
      return `Riepilogo_Messe_a_Cassa_${slug}_${ym}.pdf`;
    }
    return `Riepilogo_Messe_a_Cassa_${ym}.pdf`;
  };

  const handleStampa = async (scope: Scope = { type: "globale" }) => {
    try {
      setBusy(true);
      const bytes = await buildIncassiCoperturePdf(buildPdfData(scope));
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const w = window.open(url, "_blank");
      if (w) w.addEventListener("load", () => { try { w.print(); } catch {} });
    } catch (e: any) {
      toast.error("Errore stampa: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const handleSalva = async (scope: Scope = { type: "globale" }) => {
    try {
      setBusy(true);
      const bytes = await buildIncassiCoperturePdf(buildPdfData(scope));
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const name = fileName(scope);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      const isAgenzia = scope.type === "agenzia";
      const entitaTipo = isAgenzia ? "compagnia" : "sede";
      const entitaId = isAgenzia ? scope.gruppo.compagnia_id : profile?.ufficio_id || null;

      if (entitaId) {
        const path = `${entitaTipo}/${entitaId}/incassi_coperture/${Date.now()}_${name}`;
        const { error: upErr } = await supabase.storage
          .from("documenti_generali")
          .upload(path, blob, { contentType: "application/pdf", upsert: false });
        if (upErr) throw upErr;
        const { data: u } = await supabase.auth.getUser();
        const { error: dbErr } = await supabase.from("documenti").insert({
          nome_file: name,
          path_storage: path,
          bucket_name: "documenti_generali",
          entita_tipo: entitaTipo,
          entita_id: entitaId,
          categoria: "Riepilogo Messe a Cassa",
          visibile_al_cliente: false,
          caricato_da: u?.user?.id ?? null,
        } as any);
        if (dbErr) throw dbErr;
        await logAttivita({
          azione: "stampa_incassi_coperture",
          entita_tipo: entitaTipo,
          entita_id: entitaId,
          dettagli_json: {
            mese: format(meseCorrente, "yyyy-MM"),
            titoli: isAgenzia ? scope.gruppo.count : totaliCassa.count,
            agenzia: isAgenzia ? scope.gruppo.nome : undefined,
          },
        });
        toast.success(isAgenzia ? `PDF agenzia "${scope.gruppo.nome}" salvato` : "PDF salvato e archiviato");
      } else {
        toast.success("PDF generato");
      }
    } catch (e: any) {
      toast.error("Errore salvataggio: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const indent = (level: number) => ({ paddingLeft: `${12 + level * 20}px` });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Riepilogo Messe a Cassa</h1>
          <p className="text-muted-foreground">
            Riepilogo consultivo per mese — espandi per agenzia, cliente, polizza e data
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleStampa()} disabled={busy}>
            <Printer className="w-4 h-4 mr-1" />
            Stampa
          </Button>
          <Button size="sm" onClick={() => handleSalva()} disabled={busy}>
            <Save className="w-4 h-4 mr-1" />
            Salva PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <Hash className="w-3.5 h-3.5" /> Titoli a Cassa
            </CardDescription>
            <CardTitle className="text-xl">{totaliCassa.count}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <FileText className="w-3.5 h-3.5" /> Premio Lordo
            </CardDescription>
            <CardTitle className="text-xl text-blue-600">{fmt(totaliCassa.premio_lordo)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <Coins className="w-3.5 h-3.5" /> Provvigioni
            </CardDescription>
            <CardTitle className="text-xl text-green-600">{fmt(totaliCassa.provvigioni)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <Receipt className="w-3.5 h-3.5" /> Da Rimettere
            </CardDescription>
            <CardTitle className="text-xl text-orange-600">{fmt(totaliCassa.da_rimettere)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMeseCorrente((prev) => subMonths(prev, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-semibold capitalize min-w-[140px] text-center">{meseLabel}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMeseCorrente((prev) => addMonths(prev, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca agenzia, cliente, polizza, data..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="w-5 h-5" />
              Riepilogo Messe a Cassa — {meseLabel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {albero.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nessun titolo messo a cassa nel mese selezionato</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Dettaglio</TableHead>
                    <TableHead className="text-right">Titoli</TableHead>
                    <TableHead className="text-right">Premio Lordo</TableHead>
                    <TableHead className="text-right">Provvigioni</TableHead>
                    <TableHead className="text-right">Da Rimettere</TableHead>
                    <TableHead className="text-right w-[150px]">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {albero.map((agenzia) => {
                    const kA = `a:${agenzia.compagnia_id}`;
                    return (
                      <Fragment key={kA}>
                        <TableRow className="cursor-pointer hover:bg-muted/50 bg-muted/20" onClick={() => toggle(kA)}>
                          <TableCell className="px-2">
                            {isOpen(kA) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </TableCell>
                          <TableCell className="font-semibold" style={indent(0)}>
                            <span className="inline-flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              {agenzia.nome}
                            </span>
                          </TableCell>
                          <SummaryCells t={agenzia} />
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Stampa PDF agenzia"
                                disabled={busy}
                                onClick={() => handleStampa({ type: "agenzia", gruppo: agenzia })}
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Salva PDF agenzia"
                                disabled={busy}
                                onClick={() => handleSalva({ type: "agenzia", gruppo: agenzia })}
                              >
                                <Save className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {isOpen(kA) &&
                          agenzia.clienti.map((cliente) => {
                            const kC = `${kA}|c:${cliente.cliente_id}`;
                            return (
                              <Fragment key={kC}>
                                <TableRow className="cursor-pointer hover:bg-muted/40" onClick={() => toggle(kC)}>
                                  <TableCell className="px-2">
                                    {isOpen(kC) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </TableCell>
                                  <TableCell className="font-medium" style={indent(1)}>
                                    <span className="inline-flex items-center gap-1.5">
                                      <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                      {cliente.nome}
                                    </span>
                                  </TableCell>
                                  <SummaryCells t={cliente} />
                                  <TableCell />
                                </TableRow>

                                {isOpen(kC) &&
                                  cliente.polizze.map((polizza) => {
                                    const kP = `${kC}|p:${polizza.numero_titolo}`;
                                    return (
                                      <Fragment key={kP}>
                                        <TableRow className="cursor-pointer hover:bg-muted/30" onClick={() => toggle(kP)}>
                                          <TableCell className="px-2">
                                            {isOpen(kP) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                          </TableCell>
                                          <TableCell style={indent(2)}>
                                            <span className="inline-flex items-center gap-1.5 font-mono text-sm">
                                              <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                              Polizza {polizza.numero_titolo}
                                            </span>
                                          </TableCell>
                                          <SummaryCells t={polizza} />
                                          <TableCell />
                                        </TableRow>

                                        {isOpen(kP) &&
                                          polizza.dateGroups.map((gruppoData) => {
                                            const kD = `${kP}|d:${gruppoData.dataKey}`;
                                            return (
                                              <Fragment key={kD}>
                                                <TableRow className="cursor-pointer hover:bg-muted/20" onClick={() => toggle(kD)}>
                                                  <TableCell className="px-2">
                                                    {isOpen(kD) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                  </TableCell>
                                                  <TableCell style={indent(3)}>
                                                    <span className="inline-flex items-center gap-1.5 text-sm">
                                                      <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                                      {gruppoData.dataLabel}
                                                    </span>
                                                  </TableCell>
                                                  <SummaryCells t={gruppoData} />
                                                  <TableCell />
                                                </TableRow>

                                                {isOpen(kD) && (
                                                  <TableRow>
                                                    <TableCell colSpan={7} className="bg-muted/30 p-0">
                                                      <div className="p-3 pl-16">
                                                        <TitoliDetailTable titoli={gruppoData.titoli} navigate={navigate} />
                                                      </div>
                                                    </TableCell>
                                                  </TableRow>
                                                )}
                                              </Fragment>
                                            );
                                          })}
                                      </Fragment>
                                    );
                                  })}
                              </Fragment>
                            );
                          })}
                      </Fragment>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell />
                    <TableCell className="font-bold">Totale</TableCell>
                    <TableCell className="text-right font-bold">{totaliCassa.count}</TableCell>
                    <TableCell className="text-right font-mono font-bold">€ {totaliCassa.premio_lordo.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">€ {totaliCassa.provvigioni.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">€ {totaliCassa.da_rimettere.toFixed(2)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ContabilitaUfficio;
