import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, FileText, Inbox, Loader2, Mail, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useServerPagination } from "@/hooks/useServerPagination";
import ServerPagination from "@/components/ServerPagination";
import DocPreviewDialog from "@/components/cliente/DocPreviewDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FilterSearchableSelect } from "@/components/contabilita/FilterSearchableSelect";
import {
  detectPresetPeriodo,
  fetchComunicazioniIncasso,
  filterComunicazioniByStato,
  groupComunicazioniBySede,
  labelStatoComunicazione,
  normalizeDateRange,
  paginateComunicazioni,
  rangeForPreset,
  todayISODate,
  type ComunicazioneIncassoRow,
  type DocumentoIncassoPreview,
  type FiltroStatoIncasso,
  type PresetPeriodoIncasso,
} from "@/lib/comunicazioniIncasso";

const fmtDateTime = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy HH:mm");
  } catch {
    return iso;
  }
};

const ComunicazioniIncassoTable = ({
  rows,
  loading,
  onPreview,
}: {
  rows: ComunicazioneIncassoRow[];
  loading?: boolean;
  onPreview: (doc: DocumentoIncassoPreview) => void;
}) => {
  const navigate = useNavigate();

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="text-xs">N. polizza</TableHead>
            <TableHead className="text-xs">Nome cliente</TableHead>
            <TableHead className="text-xs">Agenzia di riferimento</TableHead>
            <TableHead className="text-xs">Timestamp invio</TableHead>
            <TableHead className="text-xs">Stato</TableHead>
            <TableHead className="text-xs text-center w-[88px]">Anteprima</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Caricamento…
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                Nessuna comunicazione di incasso per i filtri selezionati
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.titoloId}>
                <TableCell
                  className="text-xs font-mono cursor-pointer hover:underline"
                  onClick={() => navigate(`/titoli/${r.titoloId}`)}
                >
                  {r.numeroPolizza}
                </TableCell>
                <TableCell className="text-xs">{r.clienteNome}</TableCell>
                <TableCell className="text-xs">{r.agenziaNome}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(r.inviatoIl)}</TableCell>
                <TableCell className="text-xs">
                  <Badge
                    variant={r.stato === "inviato" ? "default" : r.stato === "programmato" ? "outline" : "secondary"}
                    className={
                      r.stato === "programmato"
                        ? "border-amber-400/70 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                        : undefined
                    }
                  >
                    {labelStatoComunicazione(r.stato)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {r.documento ? (
                    <button
                      type="button"
                      className="inline-flex flex-col items-center justify-center gap-0.5 w-14 h-16 rounded-md border bg-background hover:bg-accent/60 hover:border-primary/40 transition-colors"
                      title="Apri anteprima email"
                      onClick={() => onPreview(r.documento!)}
                    >
                      <FileText className="h-6 w-6 text-primary" />
                      <span className="text-[9px] uppercase tracking-wide text-muted-foreground">PDF</span>
                    </button>
                  ) : (
                    <span
                      className="inline-flex flex-col items-center justify-center gap-0.5 w-14 h-16 rounded-md border border-dashed text-muted-foreground/70"
                      title="Nessuna email archiviata"
                    >
                      <Mail className="h-5 w-5" />
                      <span className="text-[9px] uppercase tracking-wide">—</span>
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

const ComunicazioniIncassoPage = () => {
  const navigate = useNavigate();
  const { isAdmin, profile, loading: authLoading } = useAuth();
  const isCfo = profile?.ruolo === "cfo";
  const seeAllSedi = isAdmin || isCfo;
  const sedeLockedId = !seeAllSedi && profile?.ufficio_id ? profile.ufficio_id : null;
  const authReady = !authLoading && !!profile && (seeAllSedi || !!sedeLockedId);

  const [dateDa, setDateDa] = useState(() => todayISODate());
  const [dateA, setDateA] = useState(() => todayISODate());
  const [agenziaId, setAgenziaId] = useState<string | null>(null);
  const [stato, setStato] = useState<FiltroStatoIncasso>("tutti");
  const [previewDoc, setPreviewDoc] = useState<DocumentoIncassoPreview | null>(null);

  const presetPeriodo = detectPresetPeriodo(dateDa, dateA);
  const { page, setPage, pageSize } = useServerPagination(25, [dateDa, dateA, agenziaId, stato, sedeLockedId]);

  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie-attive-comunicazioni-incasso"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compagnie")
        .select("id, nome, codice")
        .eq("attiva", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    staleTime: 300_000,
  });

  const agenziaOpts = useMemo(
    () =>
      compagnie.map((c) => ({
        value: c.id,
        label: c.nome,
        description: c.codice || undefined,
        searchText: `${c.nome} ${c.codice || ""}`,
      })),
    [compagnie],
  );

  const { data: allRows = [], isLoading } = useQuery({
    queryKey: ["comunicazioni-incasso", dateDa, dateA, agenziaId, sedeLockedId, seeAllSedi],
    enabled: authReady,
    queryFn: () =>
      fetchComunicazioniIncasso({
        dataDa: dateDa,
        dataA: dateA,
        ufficioId: sedeLockedId,
        agenziaId,
      }),
  });

  const filtered = useMemo(() => filterComunicazioniByStato(allRows, stato), [allRows, stato]);
  const gruppi = useMemo(
    () => (seeAllSedi ? groupComunicazioniBySede(filtered) : []),
    [seeAllSedi, filtered],
  );
  const paged = useMemo(
    () => (seeAllSedi ? filtered : paginateComunicazioni(filtered, page, pageSize)),
    [seeAllSedi, filtered, page, pageSize],
  );

  const applyPreset = (preset: Exclude<PresetPeriodoIncasso, "personalizzato">) => {
    const range = rangeForPreset(preset);
    setDateDa(range.da);
    setDateA(range.a);
  };

  const applyCustomRange = (nextDa: string, nextA: string) => {
    const range = normalizeDateRange(nextDa || dateDa, nextA || dateA);
    setDateDa(range.da);
    setDateA(range.a);
  };

  const resetFilters = () => {
    applyPreset("oggi");
    setAgenziaId(null);
    setStato("tutti");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/portafoglio/estrazioni-stampe")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Inbox className="h-6 w-6 text-primary" />
              Comunicazioni di incasso
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Avvisi email di incasso alle agenzie. Default: oggi
              {seeAllSedi ? " — tutte le sedi, raggruppate." : " — solo la tua sede."}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Periodo</p>
              <ToggleGroup
                type="single"
                value={presetPeriodo === "personalizzato" ? "" : presetPeriodo}
                onValueChange={(v) => {
                  if (v === "oggi" || v === "mese_corrente") applyPreset(v);
                }}
                className="justify-start"
              >
                <ToggleGroupItem value="oggi" className="h-9 px-3 text-xs">
                  Oggi
                </ToggleGroupItem>
                <ToggleGroupItem value="mese_corrente" className="h-9 px-3 text-xs">
                  Mese corrente
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Dal</p>
              <Input
                type="date"
                className="h-9 w-[160px]"
                value={dateDa}
                onChange={(e) => applyCustomRange(e.target.value, dateA)}
              />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Al</p>
              <Input
                type="date"
                className="h-9 w-[160px]"
                value={dateA}
                onChange={(e) => applyCustomRange(dateDa, e.target.value)}
              />
            </div>
            <FilterSearchableSelect
              value={agenziaId}
              onValueChange={setAgenziaId}
              options={agenziaOpts}
              placeholder="Agenzia"
              allLabel="Tutte le agenzie"
              className="w-[260px] h-9"
            />
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Stato</p>
              <ToggleGroup
                type="single"
                value={stato}
                onValueChange={(v) => {
                  if (v) setStato(v as FiltroStatoIncasso);
                }}
                className="justify-start"
              >
                <ToggleGroupItem value="tutti" className="h-9 px-3 text-xs">
                  Tutti
                </ToggleGroupItem>
                <ToggleGroupItem value="inviato" className="h-9 px-3 text-xs">
                  Inviato
                </ToggleGroupItem>
                <ToggleGroupItem value="non_inviato" className="h-9 px-3 text-xs">
                  Non inviato
                </ToggleGroupItem>
                <ToggleGroupItem value="programmato" className="h-9 px-3 text-xs">
                  Programmato
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <Button variant="ghost" size="sm" className="h-9" onClick={resetFilters}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset (oggi)
            </Button>
          </div>
        </CardContent>
      </Card>

      {!authReady ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
          Verifica sede…
        </div>
      ) : seeAllSedi ? (
        gruppi.length === 0 && !isLoading ? (
          <ComunicazioniIncassoTable rows={[]} onPreview={setPreviewDoc} />
        ) : isLoading ? (
          <ComunicazioniIncassoTable rows={[]} loading onPreview={setPreviewDoc} />
        ) : (
          <div className="space-y-6">
            {gruppi.map((g) => (
              <section key={g.sedeId} className="space-y-2">
                <h2 className="text-sm font-semibold text-foreground">
                  {g.sedeNome}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {g.rows.length} comunicazion{g.rows.length === 1 ? "e" : "i"}
                  </span>
                </h2>
                <ComunicazioniIncassoTable rows={g.rows} onPreview={setPreviewDoc} />
              </section>
            ))}
          </div>
        )
      ) : (
        <>
          <ComunicazioniIncassoTable rows={paged} loading={isLoading} onPreview={setPreviewDoc} />
          <ServerPagination
            page={page}
            pageSize={pageSize}
            totalCount={filtered.length}
            onPageChange={setPage}
          />
        </>
      )}

      <DocPreviewDialog
        open={!!previewDoc}
        onOpenChange={(o) => {
          if (!o) setPreviewDoc(null);
        }}
        doc={previewDoc}
      />
    </div>
  );
};

export default ComunicazioniIncassoPage;
