import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useServerPagination } from "@/hooks/useServerPagination";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ServerPagination from "@/components/ServerPagination";
import { FilterMultiSelect } from "@/components/shared/FilterMultiSelect";
import { toast } from "sonner";
import { format, differenceInDays, addYears, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Clock, FileSpreadsheet, ArrowLeft, Search, RefreshCw, X } from "lucide-react";
import { resolveClienteNome } from "@/lib/ecClienteAnagrafica";
import {
  calcScadenzaPrescrizione,
  resolveDataAccadimentoPrescrizione,
} from "@/lib/sinistroPrescrizioniReminder";
import SinistroRiepilogoDialog from "@/components/sinistri/SinistroRiepilogoDialog";
import { applyStatoFiltroOperativo, labelStatoSinistro, SINISTRO_STATI } from "@/lib/sinistriStati";

const statiSinistro = [...SINISTRO_STATI];

export default function SinistroPrescrizioniPage() {
  const navigate = useNavigate();

  const [filtroUffici, setFiltroUffici] = useState<string[]>([]);
  const [filtroCompagnie, setFiltroCompagnie] = useState<string[]>([]);
  const [filtroRami, setFiltroRami] = useState<string[]>([]);
  const [filtroStati, setFiltroStati] = useState<string[]>([]);
  const [dataPrescrizioneDal, setDataPrescrizioneDal] = useState<string>("");
  const [dataPrescrizioneAl, setDataPrescrizioneAl] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewSinistroId, setPreviewSinistroId] = useState<string | null>(null);

  const { page, setPage, pageSize, range } = useServerPagination(25, [
    filtroUffici.join(","),
    filtroCompagnie.join(","),
    filtroRami.join(","),
    filtroStati.join(","),
    dataPrescrizioneDal,
    dataPrescrizioneAl,
    search,
  ]);

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici-prescrizioni"],
    queryFn: async () => {
      const { data } = await supabase.from("uffici").select("id, nome_ufficio").eq("attivo", true).order("nome_ufficio");
      return data || [];
    },
  });

  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie-prescrizioni"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      return data || [];
    },
  });

  const { data: rami = [] } = useQuery({
    queryKey: ["rami-prescrizioni"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rami")
        .select("id, descrizione, gruppo_ramo:gruppi_ramo!rami_gruppo_ramo_id_fkey(descrizione)")
        .order("descrizione");
      return data || [];
    },
  });

  const applyFilters = (q: any) => {
    if (filtroUffici.length > 0) q = q.in("ufficio_id", filtroUffici);
    if (filtroCompagnie.length > 0) q = q.in("compagnia_id", filtroCompagnie);
    q = applyStatoFiltroOperativo(q, filtroStati);
    if (filtroRami.length > 0) q = q.in("titoli.ramo_id", filtroRami);
    if (search) {
      q = q.or(`numero_sinistro.ilike.%${search}%,descrizione.ilike.%${search}%`);
    }
    if (dataPrescrizioneDal) {
      const eventoDal = format(addYears(parseISO(dataPrescrizioneDal), -10), "yyyy-MM-dd");
      q = q.gte("data_evento", eventoDal);
    }
    if (dataPrescrizioneAl) {
      q = q.lte("data_evento", dataPrescrizioneAl);
    }
    return q;
  };

  const titoliSelect =
    filtroRami.length > 0
      ? "titoli!inner(numero_titolo, ramo_id, rami(descrizione))"
      : "titoli(numero_titolo, ramo_id, rami(descrizione))";

  const baseSelect = `
        id,
        numero_sinistro,
        stato,
        data_evento,
        data_denuncia,
        data_apertura,
        responsabile_id,
        compagnia_id,
        ufficio_id,
        compagnie(nome),
        profiles!sinistri_responsabile_id_fkey(nome, cognome),
        clienti!sinistri_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale, tipo_cliente),
        ${titoliSelect}
      `;

  const { data: result, isLoading, refetch } = useQuery({
    queryKey: [
      "sinistri-prescrizioni",
      page,
      filtroUffici,
      filtroCompagnie,
      filtroRami,
      filtroStati,
      dataPrescrizioneDal,
      dataPrescrizioneAl,
      search,
    ],
    queryFn: async () => {
      let q = supabase.from("sinistri").select(baseSelect, { count: "exact" });
      q = applyFilters(q);
      const { data, count, error } = await q
        .order("data_evento", { ascending: true, nullsFirst: false })
        .range(range.from, range.to);
      if (error) throw error;
      const rows = (data || []) as unknown as any[];
      const ids = rows.map((s) => s.id).filter(Boolean);
      const scadenzeBySinistro: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: prescRows } = await supabase
          .from("sinistro_prescrizioni")
          .select("sinistro_id, data_scadenza_risposta, oggetto")
          .in("sinistro_id", ids);
        for (const p of prescRows || []) {
          if (!p.sinistro_id || !p.data_scadenza_risposta) continue;
          if (p.oggetto && !String(p.oggetto).includes("prescrizione")) continue;
          const prev = scadenzeBySinistro[p.sinistro_id];
          if (!prev || p.data_scadenza_risposta < prev) {
            scadenzeBySinistro[p.sinistro_id] = p.data_scadenza_risposta;
          }
        }
      }
      return { data: rows, count: count || 0, scadenzeBySinistro };
    },
  });

  const sinistri: any[] = result?.data || [];
  const totalCount = result?.count || 0;
  const scadenzeBySinistro = result?.scadenzeBySinistro || {};

  const getPrescrizioneInfo = (
    dataDenunciaStr: string | null,
    dataEventoStr: string | null,
    dataAperturaStr: string,
    storedScadenza?: string | null,
  ) => {
    const baseStr = resolveDataAccadimentoPrescrizione(dataEventoStr, dataDenunciaStr, dataAperturaStr);
    const scadenzaStr = storedScadenza || calcScadenzaPrescrizione(baseStr);
    const dataPrescrizione = scadenzaStr ? parseISO(scadenzaStr) : addYears(parseISO(dataAperturaStr), 2);
    const oggi = new Date();
    const giorniMancanti = differenceInDays(dataPrescrizione, oggi);

    let colorClass = "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300";
    if (giorniMancanti < 0) {
      colorClass = "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400";
    } else if (giorniMancanti < 30) {
      colorClass = "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300";
    } else if (giorniMancanti <= 90) {
      colorClass = "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300";
    }

    return { dataPrescrizione, giorniMancanti, colorClass };
  };

  const allPageSelected =
    sinistri.length > 0 && sinistri.every((s: { id: string }) => selectedIds.has(s.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        sinistri.forEach((s: { id: string }) => next.delete(s.id));
      } else {
        sinistri.forEach((s: { id: string }) => next.add(s.id));
      }
      return next;
    });
  };

  const mapSinistroToExportRow = (s: any) => {
    const info = getPrescrizioneInfo(s.data_denuncia, s.data_evento, s.data_apertura, scadenzeBySinistro[s.id]);
    return {
      "Numero Sinistro": s.numero_sinistro || "",
      Cliente: resolveClienteNome(s.clienti),
      Compagnia: s.compagnie?.nome || "",
      Ramo: s.titoli?.rami?.descrizione || "—",
      "Data Denuncia": s.data_denuncia ? format(new Date(s.data_denuncia), "dd/MM/yyyy") : "",
      "Data Prescrizione": format(info.dataPrescrizione, "dd/MM/yyyy"),
      "Giorni alla Prescrizione": info.giorniMancanti >= 0 ? info.giorniMancanti : "Prescritto",
      "Stato Sinistro": s.stato?.replace(/_/g, " ") || "",
      Responsabile: s.profiles ? `${s.profiles.nome} ${s.profiles.cognome}` : "",
    };
  };

  const resetFiltri = () => {
    setFiltroUffici([]);
    setFiltroCompagnie([]);
    setFiltroRami([]);
    setFiltroStati([]);
    setDataPrescrizioneDal("");
    setDataPrescrizioneAl("");
    setSearch("");
    setPage(0);
  };

  const handleExportXLSX = async (mode: "all" | "selected" = "all") => {
    try {
      toast.loading("Generazione file Excel in corso...");
      let exportData: any[] = [];

      if (mode === "selected") {
        const selectedOnPage = sinistri.filter((s: { id: string }) => selectedIds.has(s.id));
        if (selectedOnPage.length === 0) {
          toast.dismiss();
          toast.error("Nessun sinistro selezionato");
          return;
        }
        exportData = selectedOnPage;
      } else {
        let q = supabase.from("sinistri").select(`
        numero_sinistro,
        stato,
        data_evento,
        data_denuncia,
        data_apertura,
        compagnie(nome),
        profiles!sinistri_responsabile_id_fkey(nome, cognome),
        clienti!sinistri_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale, tipo_cliente),
        ${titoliSelect}
      `);
        q = applyFilters(q);
        const { data, error } = await q.order("data_denuncia", { ascending: true });
        if (error) throw error;
        exportData = (data || []) as unknown as any[];
      }

      const rows = exportData.map(mapSinistroToExportRow);

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Prescrizioni Sinistri");
      XLSX.writeFile(wb, `prescrizioni_sinistri_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`);
      toast.dismiss();
      toast.success("File Excel esportato con successo");
    } catch (err: any) {
      toast.dismiss();
      toast.error("Errore durante l'esportazione: " + err.message);
    }
  };

  const hasFiltriAttivi =
    filtroUffici.length > 0 ||
    filtroCompagnie.length > 0 ||
    filtroRami.length > 0 ||
    filtroStati.length > 0 ||
    dataPrescrizioneDal !== "" ||
    dataPrescrizioneAl !== "" ||
    search !== "";

  const ramiOptions = rami.map((r: any) => ({
    value: r.id,
    label: r.gruppo_ramo?.descrizione
      ? `${r.gruppo_ramo.descrizione} · ${r.descrizione || "—"}`
      : r.descrizione || "—",
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/sinistri")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Clock className="h-6 w-6 text-primary animate-pulse" /> Termini di prescrizione
            </h1>
            <p className="text-muted-foreground">
              Monitoraggio dei termini legali di prescrizione dei sinistri (art. 2952 c.c. e termini perentori)
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} title="Ricarica dati">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportXLSX("all")}
            disabled={sinistri.length === 0}
            className="gap-2"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-700" /> Esporta XLSX
          </Button>
          {selectedIds.size > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={() => handleExportXLSX("selected")}
              className="gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" /> Esporta selezionati ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Ufficio</Label>
              <FilterMultiSelect
                value={filtroUffici}
                onChange={(v) => {
                  setFiltroUffici(v);
                  setPage(0);
                }}
                options={uffici.map((u: any) => ({ value: u.id, label: u.nome_ufficio }))}
                placeholder="Tutti gli uffici"
                allLabel="Tutti gli uffici"
                searchPlaceholder="Cerca ufficio…"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Ramo</Label>
              <FilterMultiSelect
                value={filtroRami}
                onChange={(v) => {
                  setFiltroRami(v);
                  setPage(0);
                }}
                options={ramiOptions}
                placeholder="Tutti i rami"
                allLabel="Tutti i rami"
                searchPlaceholder="Cerca ramo…"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Compagnia</Label>
              <FilterMultiSelect
                value={filtroCompagnie}
                onChange={(v) => {
                  setFiltroCompagnie(v);
                  setPage(0);
                }}
                options={compagnie.map((c: any) => ({ value: c.id, label: c.nome }))}
                placeholder="Tutte le compagnie"
                allLabel="Tutte le compagnie"
                searchPlaceholder="Cerca compagnia…"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Prescrizione Dal</Label>
              <Input
                type="date"
                value={dataPrescrizioneDal}
                onChange={(e) => {
                  setDataPrescrizioneDal(e.target.value);
                  setPage(0);
                }}
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Prescrizione Al</Label>
              <Input
                type="date"
                value={dataPrescrizioneAl}
                onChange={(e) => {
                  setDataPrescrizioneAl(e.target.value);
                  setPage(0);
                }}
                className="h-9"
              />
            </div>
          </div>

          <div className="flex gap-3 items-end flex-wrap pt-2 border-t">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Label className="text-xs">Ricerca</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per N° sinistro…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            <div className="space-y-1 w-56">
              <Label className="text-xs">Stato</Label>
              <FilterMultiSelect
                value={filtroStati}
                onChange={(v) => {
                  setFiltroStati(v);
                  setPage(0);
                }}
                options={statiSinistro.map((s) => ({ value: s, label: labelStatoSinistro(s) }))}
                placeholder="Tutti gli stati"
                allLabel="Tutti gli stati"
                searchPlaceholder="Cerca stato…"
              />
            </div>

            {hasFiltriAttivi && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFiltri}
                className="text-xs text-muted-foreground hover:text-foreground h-9"
              >
                <X className="h-3.5 w-3.5 mr-1" /> Reset filtri
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">Elenco Pratiche ({totalCount})</CardTitle>
              <CardDescription>
                Visualizzazione dei sinistri e del rispettivo stato di scadenza delle prescrizioni legalmente stabilite.
              </CardDescription>
            </div>
            {selectedIds.size > 0 && (
              <span className="text-xs text-muted-foreground">{selectedIds.size} selezionati</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
              <TableHeader className="table-header-colored">
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allPageSelected}
                      onCheckedChange={toggleSelectAllPage}
                      aria-label="Seleziona tutti"
                    />
                  </TableHead>
                  <TableHead className="w-32">N° Sinistro</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Compagnia</TableHead>
                  <TableHead>Ramo</TableHead>
                  <TableHead className="w-32">Denuncia</TableHead>
                  <TableHead className="w-32">Prescrizione</TableHead>
                  <TableHead className="w-36 text-center">Giorni Residui</TableHead>
                  <TableHead className="w-28">Stato</TableHead>
                  <TableHead>Responsabile</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Caricamento in corso...
                    </TableCell>
                  </TableRow>
                ) : sinistri.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Nessun sinistro trovato con i filtri selezionati
                    </TableCell>
                  </TableRow>
                ) : (
                  sinistri.map((s: any) => {
                    const info = getPrescrizioneInfo(s.data_denuncia, s.data_evento, s.data_apertura, scadenzeBySinistro[s.id]);
                    return (
                      <TableRow
                        key={s.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setPreviewSinistroId(s.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(s.id)}
                            onCheckedChange={() => toggleSelect(s.id)}
                            aria-label={`Seleziona sinistro ${s.numero_sinistro || s.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-semibold text-primary hover:underline">
                          {s.numero_sinistro || "—"}
                        </TableCell>
                        <TableCell>{resolveClienteNome(s.clienti)}</TableCell>
                        <TableCell>{s.compagnie?.nome || "—"}</TableCell>
                        <TableCell>{s.titoli?.rami?.descrizione || "—"}</TableCell>
                        <TableCell>
                          {s.data_denuncia ? format(new Date(s.data_denuncia), "dd/MM/yyyy", { locale: it }) : "—"}
                        </TableCell>
                        <TableCell className="font-medium text-primary">
                          {format(info.dataPrescrizione, "dd/MM/yyyy", { locale: it })}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`${info.colorClass} font-semibold py-0.5 px-2`}>
                            {info.giorniMancanti < 0 ? "Scaduto (Prescritto)" : `${info.giorniMancanti} giorni`}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">
                          <Badge variant="secondary" className="text-[10px]">
                            {s.stato?.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {s.profiles ? `${s.profiles.nome || ""} ${s.profiles.cognome || ""}`.trim() : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          <div className="p-4 border-t">
            <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
          </div>
        </CardContent>
      </Card>

      <SinistroRiepilogoDialog
        sinistroId={previewSinistroId}
        open={!!previewSinistroId}
        onOpenChange={(open) => {
          if (!open) setPreviewSinistroId(null);
        }}
      />
    </div>
  );
}
