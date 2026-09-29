import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Search, Landmark, ExternalLink, CalendarIcon, Filter, Bot, Loader2, X, ChevronDown, MapPin, Link2, History, Building, FileDown, FileText, Plus, Zap, Tag, AlertTriangle, Ban, Heart, RotateCcw, Archive, RefreshCw, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { edgeFunctionErrorMessage } from "@/lib/edgeFunctionError";
import {
  FILTRI_FONTE_LISTA,
  FONTI_RICERCA,
  REGIONI_ITALIANE,
  isEnteBandoGenerico,
  labelFonteBando,
  labelFonteRicerca,
  matchesFiltroFonte,
  matchesFiltroRegione,
  progressMsgRicerca,
  resolveFonteBando,
  type FiltroFonteLista,
  type FonteRicerca,
} from "@/lib/bandiFonti";
import {
  FILTRI_KEYWORD_LISTA,
  KEYWORD_BROKERAGGIO,
  KEYWORD_RICERCA_DEFAULT,
  KEYWORDS_RICERCA,
  keywordDaTesto,
  labelKeywordRicerca,
  matchesFiltroKeyword,
  parseKeywordRicerca,
  type FiltroKeywordLista,
  type KeywordRicerca,
} from "@/lib/bandiKeywords";
import {
  FILTRI_PIPELINE_BANDI,
  FILTRI_PIPELINE_LISTA_PRINCIPALE,
  buildBandoSnapshot,
  effectiveEsitoBando,
  isBandiPartecipatiPath,
  labelEsitoBando,
  matchesFiltroPipeline,
  normalizeBandoInteresse,
  type BandoEsito,
  type BandoInteresseRow,
  type FiltroPipelineBando,
} from "@/lib/bandiInteresse";
import {
  labelVisibilitaBando,
  matchesFiltroVisibilita,
  toastSalvataggioBandi,
  visibilitaBando,
} from "@/lib/bandiVisibilita";
import {
  CANTIERE_AZIONI,
  FILTRI_CANTIERE,
  buildStoricoGaraFromBando,
  effectiveCantiereStato,
  enteSearchToken,
  isBandoInCantiere,
  labelCantiereStato,
  matchStoricoPerEnte,
  matchesFiltroCantiere,
  type FiltroCantiere,
  type StoricoGaraMatch,
} from "@/lib/bandiCantiere";
import {
  buildHarvestNote,
  countNovitaDocumenti,
  documentiVisibili,
  inferTipoDocumentoBando,
  lastHarvestLabel,
  type BandoDocumentoRow,
  type BandoHarvestRunRow,
} from "@/lib/bandiDocumenti";
import {
  HARVEST_URL_LIMIT,
  collectHarvestUrls,
  isBandoMonitorabile,
  isMonitorDue,
} from "@/lib/bandiMonitor";
import { BandiFascicoloArchivio } from "@/components/bandi/BandiFascicoloArchivio";
import {
  dettaglioUpdatePayload,
  labelTipoAvviso,
  labelTipoProcedura,
  mergeDettaglio,
  needsDettaglioHarvest,
  toIsoDate,
} from "@/lib/bandiDettaglio";

interface BandoResult {
  id: string;
  titolo: string;
  ente: string;
  ente_tipo?: string | null;
  importo: number | null;
  scadenza: string | null;
  stato: "aperto" | "scaduto" | "in_valutazione";
  dataPublicazione: string;
  link: string | null;
  categoria: string | null;
  scheda_id?: string | null;
  cig?: string | null;
  localita?: string | null;
  regione?: string | null;
  trattative_count?: number;
  pdf_url?: string | null;
  pdf_path?: string | null;
  keyword?: string | null;
  fonte?: string | null;
  tipo_avviso?: string | null;
  notice_type?: string | null;
  form_type?: string | null;
  aggiudicato?: boolean;
  aggiudicatario?: string | null;
  data_decisione?: string | null;
  data_contratto?: string | null;
  servizio_da?: string | null;
  servizio_a?: string | null;
  tipo_procedura?: string | null;
  data_pubblicazione?: string | null;
}

const statoBadgeVariant = (stato: string) => {
  switch (stato) {
    case "aperto": return "default";
    case "scaduto": return "destructive";
    case "in_valutazione": return "secondary";
    default: return "outline";
  }
};

const statoLabel = (stato: string) => {
  switch (stato) {
    case "aperto": return "Aperto";
    case "scaduto": return "Scaduto";
    case "in_valutazione": return "In valutazione";
    default: return stato;
  }
};

// Upsert bandi into DB with keyword
async function upsertBandiToDB(bandi: BandoResult[], keyword: string) {
  const rows = bandi
    .filter((b) => b.scheda_id)
    .map((b) => {
      const scadenzaDate = toIsoDate(b.scadenza);
      const aggiudicato = !!b.aggiudicato;
      return {
        scheda_id: b.scheda_id!,
        titolo: b.titolo || null,
        oggetto: b.titolo || null,
        ente: b.ente || null,
        ente_tipo: b.ente_tipo || null,
        tipologia: b.categoria || null,
        importo: b.importo ?? null,
        scadenza: scadenzaDate,
        cig: b.cig || null,
        link: b.link || null,
        localita: b.localita || null,
        regione: b.regione || null,
        stato: aggiudicato ? "scaduto" : (b.stato || "aperto"),
        pdf_url: b.pdf_url || null,
        keyword: b.keyword || b.categoria || keyword,
        fonte: resolveFonteBando(b.fonte, b.link),
        tipo_avviso: b.tipo_avviso || (aggiudicato ? "esito" : "gara"),
        notice_type: b.notice_type || null,
        form_type: b.form_type || null,
        aggiudicato,
        aggiudicatario: b.aggiudicatario || null,
        data_decisione: toIsoDate(b.data_decisione),
        data_contratto: toIsoDate(b.data_contratto),
        servizio_da: toIsoDate(b.servizio_da),
        servizio_a: toIsoDate(b.servizio_a),
        tipo_procedura: b.tipo_procedura || null,
        data_pubblicazione: toIsoDate(b.dataPublicazione || b.data_pubblicazione),
        last_harvest_at: new Date().toISOString(),
      };
    });

  if (rows.length === 0) return { salvati: 0, nuovi: 0, giaInArchivio: 0 };

  const schedaIds = rows.map((r) => r.scheda_id);
  const { data: existing, error: existingErr } = await supabase
    .from("bandi_pubblici")
    .select("scheda_id")
    .in("scheda_id", schedaIds);
  if (existingErr) {
    console.error("Lookup bandi esistenti:", existingErr);
    throw existingErr;
  }
  const known = new Set((existing || []).map((r: { scheda_id: string }) => r.scheda_id));

  const { error } = await supabase
    .from("bandi_pubblici")
    .upsert(rows as never, { onConflict: "scheda_id", ignoreDuplicates: false });

  if (error) {
    console.error("Upsert bandi error:", error);
    throw error;
  }
  const nuovi = rows.filter((r) => !known.has(r.scheda_id)).length;
  return { salvati: rows.length, nuovi, giaInArchivio: rows.length - nuovi };
}

async function enrichBandoFromPortale(bando: any) {
  const { data, error } = await supabase.functions.invoke("arricchisci-bando", {
    body: {
      action: "enrich",
      fonte: resolveFonteBando(bando.fonte, bando.link),
      scheda_id: bando.scheda_id,
      titolo: bando.titolo || bando.oggetto,
      cig: bando.cig,
      link: bando.link,
    },
  });
  if (error) throw error;
  const extra = data?.bando || {};
  const merged = mergeDettaglio(
    { ...bando, titolo: bando.titolo || bando.oggetto },
    {
      tipo_avviso: extra.tipo_avviso,
      notice_type: extra.notice_type,
      form_type: extra.form_type,
      aggiudicato: extra.aggiudicato,
      aggiudicatario: extra.aggiudicatario,
      data_decisione: extra.data_decisione,
      data_contratto: extra.data_contratto,
      servizio_da: extra.servizio_da,
      servizio_a: extra.servizio_a,
      tipo_procedura: extra.tipo_procedura,
      data_pubblicazione: extra.dataPublicazione || extra.data_pubblicazione,
      scadenza: extra.scadenza,
      cig: extra.cig,
    },
  );
  const { error: upErr } = await (supabase as any)
    .from("bandi_pubblici")
    .update(dettaglioUpdatePayload(merged))
    .eq("id", bando.id);
  if (upErr) throw upErr;
  return { ...bando, ...merged };
}

function fmtData(value?: string | null) {
  const iso = toIsoDate(value);
  if (!iso) return null;
  return format(new Date(`${iso}T12:00:00`), "dd/MM/yyyy", { locale: it });
}

// Auto-create prospects from enti
async function autoCreateProspects(bandi: BandoResult[], ufficio_id: string | undefined) {
  const entiUnici = [...new Set(bandi.map((b) => b.ente).filter((ente) => !isEnteBandoGenerico(ente)))];
  let created = 0;
  for (const ente of entiUnici) {
    // Check if already exists
    const { data: existing } = await supabase
      .from("prospect")
      .select("id")
      .eq("ragione_sociale", ente)
      .limit(1);
    
    if (existing && existing.length > 0) continue;

    const sample = bandi.find((b) => b.ente === ente);
    const { error } = await supabase.from("prospect").insert({
      ragione_sociale: ente,
      tipo_cliente: "ente",
      fonte: labelFonteBando(resolveFonteBando(sample?.fonte, sample?.link)),
      stato: "nuovo",
      ufficio_id: ufficio_id || null,
    });
    if (!error) created++;
  }
  return created;
}

async function logRicerca(
  regioni: string[],
  count: number,
  userId: string | undefined,
  fonte: string,
) {
  await supabase.from("ricerche_bandi").insert({
    regioni,
    risultati_count: count,
    eseguita_da: userId || null,
    fonte,
  } as never);
}

export default function BandiPubbliciPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isPartecipati = isBandiPartecipatiPath(pathname);

  const [regioniSelezionate, setRegioniSelezionate] = useState<string[]>([]);
  const [importoMin, setImportoMin] = useState("");
  const [importoMax, setImportoMax] = useState("");
  const [statoBando, setStatoBando] = useState<string>("");
  const [dataDa, setDataDa] = useState<Date>();
  const [dataA, setDataA] = useState<Date>();
  const [risultatiLive, setRisultatiLive] = useState<BandoResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [fonte, setFonte] = useState<FonteRicerca>("tutte");
  const [keywordRicerca, setKeywordRicerca] = useState<KeywordRicerca>(KEYWORD_RICERCA_DEFAULT);
  const [filtroFonte, setFiltroFonte] = useState<FiltroFonteLista>("tutte");
  const [filtroKeyword, setFiltroKeyword] = useState<FiltroKeywordLista>("tutte");
  const [filtroPipeline, setFiltroPipeline] = useState<FiltroPipelineBando>(
    isPartecipati ? "voglio_partecipare" : "nuovi",
  );
  const [filtroCantiere, setFiltroCantiere] = useState<FiltroCantiere>("da_approfondire");

  useEffect(() => {
    setFiltroPipeline(isPartecipati ? "voglio_partecipare" : "nuovi");
    setFiltroCantiere("da_approfondire");
  }, [isPartecipati]);
  const [regioniOpen, setRegioniOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState("");
  const [showStoria, setShowStoria] = useState(false);
  const [apiCallCount, setApiCallCount] = useState(0);

  // Dialog crea trattativa
  const [creaTrattativaOpen, setCreaTrattativaOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [creatingTrattativa, setCreatingTrattativa] = useState(false);
  const [selectedBando, setSelectedBando] = useState<any>(null);
  const [trattativaProdotto, setTrattativaProdotto] = useState("");
  const [trattativaNote, setTrattativaNote] = useState("");
  const [trattativaPremio, setTrattativaPremio] = useState("");
  const [trattativaScadenza, setTrattativaScadenza] = useState("");
  const [existingTrattative, setExistingTrattative] = useState<any[]>([]);
  const [nonPartecipoOpen, setNonPartecipoOpen] = useState(false);
  const [nonPartecipoBando, setNonPartecipoBando] = useState<any>(null);
  const [nonPartecipoMotivo, setNonPartecipoMotivo] = useState("");
  const [savingEsito, setSavingEsito] = useState(false);
  const [harvestingId, setHarvestingId] = useState<string | null>(null);
  const [monitoringAll, setMonitoringAll] = useState(false);
  const [fascicoloBando, setFascicoloBando] = useState<any>(null);
  const [fascicoloOpen, setFascicoloOpen] = useState(false);
  const [archivioBando, setArchivioBando] = useState<any>(null);
  const [archivioOpen, setArchivioOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const searchActiveRef = useRef(false);
  const enrichTriedRef = useRef<Set<string>>(new Set());
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load bandi from DB
  const { data: bandiDB = [], refetch: refetchBandi } = useQuery({
    queryKey: ["bandi_pubblici", statoBando],
    queryFn: async () => {
      const applyStato = (q: any) =>
        statoBando && statoBando !== "tutti" ? q.eq("stato", statoBando) : q;

      let query = applyStato(
        (supabase as any)
          .from("bandi_pubblici")
          .select("*, bandi_trattative(id, trattativa_id), bandi_interesse(*)")
          .order("created_at", { ascending: false }),
      );

      let { data, error } = await query;
      if (error) {
        const fallback = await applyStato(
          supabase
            .from("bandi_pubblici")
            .select("*, bandi_trattative(id, trattativa_id)")
            .order("created_at", { ascending: false }),
        );
        if (fallback.error) throw fallback.error;
        data = fallback.data;
        const ids = (data || []).map((b: { id: string }) => b.id);
        const interessi = ids.length
          ? await (supabase as any).from("bandi_interesse").select("*").in("bando_id", ids)
          : { data: [] };
        const byBando = new Map(
          ((interessi.data || []) as BandoInteresseRow[]).map((row) => [row.bando_id, row]),
        );
        return (data || []).map((b: any) => ({
          ...b,
          trattative_count: b.bandi_trattative?.length || 0,
          interesse: byBando.get(b.id) ?? null,
        }));
      }
      return (data || []).map((b: any) => ({
        ...b,
        trattative_count: b.bandi_trattative?.length || 0,
        interesse: normalizeBandoInteresse(b.bandi_interesse),
      }));
    },
  });

  // Load ricerche recenti
  const { data: ricercheRecenti = [] } = useQuery({
    queryKey: ["ricerche_bandi_recenti"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ricerche_bandi")
        .select("*, profiles:eseguita_da(nome, cognome)")
        .order("eseguita_il", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  const toggleRegione = (regione: string) => {
    setRegioniSelezionate((prev) =>
      prev.includes(regione) ? prev.filter((r) => r !== regione) : [...prev, regione]
    );
  };

  const toggleTutte = () => {
    if (regioniSelezionate.length === REGIONI_ITALIANE.length) {
      setRegioniSelezionate([]);
    } else {
      setRegioniSelezionate([...REGIONI_ITALIANE]);
    }
  };

  const removeRegione = (regione: string) => {
    setRegioniSelezionate((prev) => prev.filter((r) => r !== regione));
  };

  const stopSearch = useCallback(() => {
    searchActiveRef.current = false;
    if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; }
  }, []);

  useEffect(() => { return () => stopSearch(); }, [stopSearch]);

  const cercaBandi = async () => {
    stopSearch();
    searchActiveRef.current = true;
    setLoading(true);
    setHasSearched(true);
    setRisultatiLive([]);
    setElapsedSeconds(0);
    setSearchError(null);
    setProgressMsg(progressMsgRicerca(fonte));
    setApiCallCount(prev => prev + 1);

    elapsedTimerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    try {
      const requestBody = {
        regioni: regioniSelezionate.length > 0 ? regioniSelezionate : undefined,
        importoMin: importoMin || undefined,
        importoMax: importoMax || undefined,
        statoBando: statoBando || undefined,
        dataDa: dataDa ? format(dataDa, "yyyy-MM-dd") : undefined,
        dataA: dataA ? format(dataA, "yyyy-MM-dd") : undefined,
        fonte,
        keyword: keywordRicerca,
      };

      const { data, error } = await supabase.functions.invoke("cerca-bandi", {
        body: { action: "start", ...requestBody },
      });
      if (!searchActiveRef.current) return;
      const startErr = edgeFunctionErrorMessage(data, error);
      if (startErr && !data?.bandi) throw new Error(startErr);
      const startData = data;
      if (!startData) throw new Error("Ricerca non avviata. Riprova tra poco.");

      if (startData?.status === "completed" || (Array.isArray(startData?.bandi) && startData.done)) {
        const bandi: BandoResult[] = startData.bandi || [];
        stopSearch();
        setLoading(false);
        setProgressMsg("");
        setRisultatiLive(bandi);
        if (bandi.length > 0) {
          try {
            const salvati = await upsertBandiToDB(
              bandi.map((b) => ({
                ...b,
                keyword: b.keyword || b.categoria || keywordDaTesto(`${b.titolo} ${b.categoria || ""}`),
              })),
              KEYWORD_BROKERAGGIO,
            );
            const prospectCount = await autoCreateProspects(
              bandi.filter((b) => !isEnteBandoGenerico(b.ente)),
              profile?.ufficio_id,
            );
            await refetchBandi();
            toast.success(
              `${startData.message || `${bandi.length} bando/i trovati.`} ${toastSalvataggioBandi(salvati.nuovi, salvati.giaInArchivio)}`.trim(),
            );
            if (startData.warning) toast.warning(startData.warning);
            if (prospectCount > 0) toast.info(`${prospectCount} nuovi prospect creati.`);
          } catch {
            toast.warning("Risultati trovati ma errore nel salvataggio");
          }
        } else {
          toast.info(startData.message || "Nessun bando trovato con i criteri specificati");
          if (startData.warning) toast.warning(startData.warning);
        }
        await logRicerca(regioniSelezionate, bandi.length, profile?.id, fonte);
        queryClient.invalidateQueries({ queryKey: ["ricerche_bandi_recenti"] });
        return;
      }

      throw new Error("Risposta incompleta. Riprova tra poco.");
    } catch (err: any) {
      console.error("Errore avvio ricerca bandi:", err);
      stopSearch();
      setLoading(false);
      setSearchError(err.message || "Errore durante l'avvio della ricerca");
      toast.error(err.message || "Errore durante la ricerca dei bandi");
    }
  };

  const resetFiltri = () => {
    stopSearch();
    setRegioniSelezionate([]);
    setImportoMin("");
    setImportoMax("");
    setStatoBando("");
    setDataDa(undefined);
    setDataA(undefined);
    setRisultatiLive([]);
    setHasSearched(false);
    setSearchError(null);
    setProgressMsg("");
    setElapsedSeconds(0);
    setKeywordRicerca(KEYWORD_RICERCA_DEFAULT);
    setFiltroKeyword("tutte");
  };

  const openCreaTrattativaDialog = async (bando: any) => {
    setSelectedBando(bando);
    setExistingTrattative([]);
    // Pre-fill fields
    setTrattativaProdotto(bando.keyword || KEYWORD_BROKERAGGIO);
    setTrattativaPremio(bando.importo ? String(bando.importo) : "");
    setTrattativaScadenza(bando.scadenza || "");
    const noteLines = [
      bando.titolo || bando.oggetto || "",
      bando.cig ? `CIG: ${bando.cig}` : "",
      bando.link ? `Link: ${bando.link}` : "",
    ].filter(Boolean).join("\n");
    setTrattativaNote(noteLines);
    setCreaTrattativaOpen(true);

    // Check for existing trattative linked to this bando
    try {
      const { data: linked } = await supabase
        .from("bandi_trattative")
        .select("trattativa_id, trattative:trattativa_id(id, prodotto, stato, data_apertura, premio_previsto, fonte)")
        .eq("bando_id", bando.id);

      if (linked && linked.length > 0) {
        const trattative = linked
          .map((l: any) => l.trattative)
          .filter(Boolean);
        setExistingTrattative(trattative);
      }
    } catch (err) {
      console.error("Errore check trattative esistenti:", err);
    }
  };

  const handleConfirmCreaTrattativa = async () => {
    if (!selectedBando) return;
    setCreatingTrattativa(true);

    try {
      // Find or create prospect from ente
      let prospectId: string | null = null;
      const { data: existingProspect } = await supabase
        .from("prospect")
        .select("id")
        .eq("ragione_sociale", selectedBando.ente)
        .limit(1);

      if (existingProspect && existingProspect.length > 0) {
        prospectId = existingProspect[0].id;
      } else {
        const { data: newProspect, error: pErr } = await supabase.from("prospect").insert({
          ragione_sociale: selectedBando.ente,
          tipo_cliente: "ente",
          fonte: labelFonteBando(resolveFonteBando(selectedBando.fonte, selectedBando.link)),
          stato: "nuovo",
          ufficio_id: profile?.ufficio_id || null,
        }).select("id").single();
        if (pErr) throw pErr;
        prospectId = newProspect.id;
      }

      // Create trattativa
      const { data: trattativa, error: tErr } = await supabase.from("trattative").insert({
        prospect_id: prospectId,
        prodotto: trattativaProdotto || null,
        premio_previsto: trattativaPremio ? Number(trattativaPremio) : null,
        data_scadenza: trattativaScadenza || null,
        note: trattativaNote || null,
        stato: "aperta",
        fonte: labelFonteBando(resolveFonteBando(selectedBando.fonte, selectedBando.link)),
        ufficio_id: profile?.ufficio_id || null,
        created_by: profile?.id || null,
        data_apertura: new Date().toISOString().split("T")[0],
      }).select("id").single();

      if (tErr) throw tErr;

      // Link bando-trattativa
      await supabase.from("bandi_trattative").insert({
        bando_id: selectedBando.id,
        trattativa_id: trattativa.id,
      });

      const snapshot =
        selectedBando.interesse?.snapshot_json &&
        Object.keys(selectedBando.interesse.snapshot_json).length > 0
          ? selectedBando.interesse.snapshot_json
          : buildBandoSnapshot(selectedBando);
      const { error: interesseErr } = await (supabase as any)
        .from("bandi_interesse")
        .upsert({
          bando_id: selectedBando.id,
          esito: "in_trattativa",
          motivo: selectedBando.interesse?.motivo ?? null,
          snapshot_json: snapshot,
          harvest_at: selectedBando.interesse?.harvest_at ?? new Date().toISOString(),
          harvest_note: selectedBando.interesse?.harvest_note ?? "Trattativa creata dal bando",
          deciso_da: profile?.id || null,
          deciso_il: new Date().toISOString(),
          cantiere_stato: "in_trattativa",
          cantiere_il: new Date().toISOString(),
          storico_gara_id: selectedBando.interesse?.storico_gara_id ?? null,
        }, { onConflict: "bando_id" });
      if (interesseErr) {
        console.error("Errore esito in_trattativa:", interesseErr);
      }

      toast.success("Trattativa creata e collegata al bando!");
      setCreaTrattativaOpen(false);
      setConfirmOpen(false);
      refetchBandi();
      queryClient.invalidateQueries({ queryKey: ["trattative"] });
    } catch (err: any) {
      console.error("Errore creazione trattativa:", err);
      toast.error("Errore: " + (err.message || "Impossibile creare la trattativa"));
    } finally {
      setCreatingTrattativa(false);
    }
  };

  const upsertInteresse = async (
    bando: any,
    esito: BandoEsito,
    extra: {
      motivo?: string | null;
      harvest_at?: string | null;
      harvest_note?: string | null;
      snapshot_json?: Record<string, unknown>;
      cantiere_stato?: string | null;
      cantiere_il?: string | null;
      storico_gara_id?: string | null;
    } = {},
  ) => {
    const { error } = await (supabase as any).from("bandi_interesse").upsert({
      bando_id: bando.id,
      esito,
      motivo: extra.motivo ?? bando.interesse?.motivo ?? null,
      snapshot_json: extra.snapshot_json ?? buildBandoSnapshot(bando),
      harvest_at: extra.harvest_at ?? bando.interesse?.harvest_at ?? null,
      harvest_note: extra.harvest_note ?? bando.interesse?.harvest_note ?? null,
      deciso_da: profile?.id || null,
      deciso_il: new Date().toISOString(),
      cantiere_stato: extra.cantiere_stato ?? bando.interesse?.cantiere_stato ?? null,
      cantiere_il: extra.cantiere_il ?? bando.interesse?.cantiere_il ?? null,
      storico_gara_id: extra.storico_gara_id ?? bando.interesse?.storico_gara_id ?? null,
    }, { onConflict: "bando_id" });
    if (error) throw error;
  };

  const handleVoglioPartecipare = async (bando: any) => {
    setHarvestingId(bando.id);
    try {
      let harvested = bando;
      try {
        harvested = await enrichBandoFromPortale(bando);
      } catch (enrichErr) {
        console.warn("Arricchimento portale non riuscito:", enrichErr);
      }
      let harvestNote = "Dati portale salvati";
      if (harvested.aggiudicatario) {
        harvestNote = `Aggiudicato a ${harvested.aggiudicatario}`;
      } else if (harvested.pdf_path) {
        harvestNote = "PDF già in archivio";
      } else if (harvested.pdf_url) {
        const { error } = await supabase.functions.invoke("scarica-bando-pdf", {
          body: { bando_id: harvested.id, pdf_url: harvested.pdf_url },
        });
        harvestNote = error
          ? `PDF non scaricato: ${error.message}`
          : "PDF salvato in archivio";
      }
      await upsertInteresse(harvested, "voglio_partecipare", {
        harvest_at: new Date().toISOString(),
        harvest_note: harvestNote,
        snapshot_json: buildBandoSnapshot(harvested),
        cantiere_stato: "da_approfondire",
        cantiere_il: new Date().toISOString(),
      });
      toast.success("Bando spostato in Bandi partecipati");
      await refetchBandi();
      navigate("/bandi-pubblici/partecipati");
    } catch (err: any) {
      console.error("Errore voglio partecipare:", err);
      toast.error(err.message || "Impossibile salvare la decisione");
    } finally {
      setHarvestingId(null);
    }
  };

  const handleConfirmNonPartecipo = async () => {
    if (!nonPartecipoBando) return;
    setSavingEsito(true);
    try {
      await upsertInteresse(nonPartecipoBando, "non_partecipo", {
        motivo: nonPartecipoMotivo.trim() || null,
        snapshot_json: buildBandoSnapshot(nonPartecipoBando),
        cantiere_stato: isPartecipati ? "abbandonato" : nonPartecipoBando.interesse?.cantiere_stato ?? null,
        cantiere_il: isPartecipati ? new Date().toISOString() : nonPartecipoBando.interesse?.cantiere_il ?? null,
      });
      toast.success("Bando nascosto da «Nuovi». Lo trovi in Non partecipo.");
      setNonPartecipoOpen(false);
      setNonPartecipoBando(null);
      setNonPartecipoMotivo("");
      refetchBandi();
    } catch (err: any) {
      console.error("Errore non partecipo:", err);
      toast.error(err.message || "Impossibile salvare la decisione");
    } finally {
      setSavingEsito(false);
    }
  };

  const handleRimettiInValutazione = async (bando: any) => {
    setSavingEsito(true);
    try {
      const { error } = await (supabase as any)
        .from("bandi_interesse")
        .delete()
        .eq("bando_id", bando.id);
      if (error) throw error;
      if (!bando.visto_il) {
        await (supabase as any)
          .from("bandi_pubblici")
          .update({
            visto_il: new Date().toISOString(),
            visto_da: profile?.id || null,
          })
          .eq("id", bando.id)
          .is("visto_il", null);
      }
      toast.success("Bando rimesso tra i già visti");
      refetchBandi();
    } catch (err: any) {
      console.error("Errore rimetti in valutazione:", err);
      toast.error(err.message || "Impossibile ripristinare il bando");
    } finally {
      setSavingEsito(false);
    }
  };

  const handleCambiaCantiere = async (bando: any, stato: string) => {
    setSavingEsito(true);
    try {
      await upsertInteresse(bando, bando.interesse?.esito || "voglio_partecipare", {
        cantiere_stato: stato,
        cantiere_il: new Date().toISOString(),
        snapshot_json: buildBandoSnapshot(bando),
      });
      toast.success(`Stato cantiere: ${labelCantiereStato(stato)}`);
      refetchBandi();
    } catch (err: any) {
      toast.error(err.message || "Impossibile aggiornare lo stato");
    } finally {
      setSavingEsito(false);
    }
  };

  const handleArchiviaStorico = async () => {
    if (!archivioBando) return;
    setArchiving(true);
    try {
      const payload = buildStoricoGaraFromBando(archivioBando, profile?.id);
      let storicoId: string | null = null;
      const { data, error } = await (supabase as any)
        .from("storico_gare")
        .insert(payload)
        .select("id")
        .single();
      if (error) {
        const existing = await (supabase as any)
          .from("storico_gare")
          .select("id")
          .eq("bando_id", archivioBando.id)
          .maybeSingle();
        if (!existing.data?.id) throw error;
        storicoId = existing.data.id;
      } else {
        storicoId = data.id;
      }
      await upsertInteresse(archivioBando, archivioBando.interesse?.esito || "voglio_partecipare", {
        cantiere_stato: "archiviato_storico",
        cantiere_il: new Date().toISOString(),
        storico_gara_id: storicoId,
        snapshot_json: buildBandoSnapshot(archivioBando),
      });
      toast.success("Bando archiviato in Storico Gare");
      setArchivioOpen(false);
      setArchivioBando(null);
      refetchBandi();
      queryClient.invalidateQueries({ queryKey: ["storico_gare"] });
      queryClient.invalidateQueries({ queryKey: ["storico_match_bandi"] });
    } catch (err: any) {
      console.error("Errore archivio storico:", err);
      toast.error(err.message || "Impossibile scrivere lo Storico Gare");
    } finally {
      setArchiving(false);
    }
  };

  const handleAggiornaPortale = async (bando: any, opts?: { generate?: boolean }) => {
    setHarvestingId(bando.id);
    const motore = resolveFonteBando(bando.fonte, bando.link);
    const { data: run, error: runErr } = await (supabase as any)
      .from("bandi_harvest_run")
      .insert({
        bando_id: bando.id,
        motore,
        created_by: profile?.id || null,
        esito: "ok",
      })
      .select("id")
      .single();
    if (runErr || !run?.id) {
      setHarvestingId(null);
      toast.error(runErr?.message || "Impossibile avviare l'harvest");
      return;
    }

    let arricchito = false;
    let nuovi = 0;
    let aggiornati = 0;
    let errore: string | null = null;
    let harvested = bando;
    try {
      try {
        harvested = await enrichBandoFromPortale(bando);
        arricchito = true;
      } catch (enrichErr: any) {
        errore = enrichErr?.message || "Arricchimento portale non riuscito";
      }

      let extraUrls: string[] = [];
      let metaByUrl = new Map<string, { url: string; tipo?: string; nome?: string }>();
      try {
        const { data: mon, error: monErr } = await supabase.functions.invoke("genera-monitor-bando", {
          body: { bando_id: bando.id, action: opts?.generate ? "generate" : "refresh" },
        });
        if (monErr) {
          errore = [errore, monErr.message].filter(Boolean).join(" · ");
        } else {
          extraUrls = Array.isArray(mon?.urls) ? mon.urls : [];
          const docsMeta = Array.isArray(mon?.script?.documenti) ? mon.script.documenti : [];
          metaByUrl = new Map(
            docsMeta
              .filter((d: { url?: string }) => d?.url)
              .map((d: { url: string; tipo?: string; nome?: string }) => [d.url.split("#")[0], d]),
          );
          if (mon?.errore) errore = [errore, mon.errore].filter(Boolean).join(" · ");
        }
      } catch (monCatch: any) {
        errore = [errore, monCatch?.message || "Refresh script non riuscito"].filter(Boolean).join(" · ");
      }

      const primaryUrl = harvested.pdf_url || bando.pdf_url;
      const urls = collectHarvestUrls({
        pdfUrl: primaryUrl,
        extraUrls,
        limit: HARVEST_URL_LIMIT,
      });
      for (const pdfUrl of urls) {
        const meta = metaByUrl.get(pdfUrl);
        const { data: pdfData, error: pdfErr } = await supabase.functions.invoke("scarica-bando-pdf", {
          body: {
            bando_id: bando.id,
            pdf_url: pdfUrl,
            harvest_run_id: run.id,
            tipo: meta?.tipo || inferTipoDocumentoBando(meta?.nome, pdfUrl),
            nome: meta?.nome,
            primario: pdfUrl === primaryUrl,
          },
        });
        if (pdfErr) {
          errore = [errore, pdfErr.message].filter(Boolean).join(" · ");
        } else if (pdfData?.stato === "nuovo") {
          nuovi += 1;
        } else if (pdfData?.stato === "aggiornato") {
          aggiornati += 1;
        }
      }

      const note = buildHarvestNote({ arricchito, nuovi, aggiornati, errore });
      await (supabase as any)
        .from("bandi_harvest_run")
        .update({
          concluso_il: new Date().toISOString(),
          esito: errore ? "parziale" : "ok",
          documenti_nuovi: nuovi,
          documenti_aggiornati: aggiornati,
          errore,
          novita_json: { arricchito, nuovi, aggiornati },
        })
        .eq("id", run.id);

      const nextCantiere = bando.interesse?.cantiere_stato === "da_approfondire" || !bando.interesse?.cantiere_stato
        ? "in_monitoraggio"
        : bando.interesse?.cantiere_stato;
      await upsertInteresse(bando, bando.interesse?.esito || "voglio_partecipare", {
        harvest_at: new Date().toISOString(),
        harvest_note: note,
        cantiere_stato: nextCantiere,
        cantiere_il: new Date().toISOString(),
        snapshot_json: buildBandoSnapshot(harvested),
      });
      toast.success(note);
      refetchBandi();
      queryClient.invalidateQueries({ queryKey: ["bandi_documenti"] });
      queryClient.invalidateQueries({ queryKey: ["bandi_harvest_run"] });
      queryClient.invalidateQueries({ queryKey: ["bandi_monitor_script"] });
    } catch (err: any) {
      await (supabase as any)
        .from("bandi_harvest_run")
        .update({
          concluso_il: new Date().toISOString(),
          esito: "errore",
          errore: err.message || "Errore harvest",
        })
        .eq("id", run.id);
      toast.error(err.message || "Harvest non riuscito");
    } finally {
      setHarvestingId(null);
    }
  };

  const handleScaricaTuttiDocumenti = (bando: any) => handleAggiornaPortale(bando, { generate: true });

  const regioniLabel = regioniSelezionate.length === 0
    ? "Tutte le regioni"
    : regioniSelezionate.length === REGIONI_ITALIANE.length
      ? "Tutte le regioni selezionate"
      : `${regioniSelezionate.length} region${regioniSelezionate.length === 1 ? 'e' : 'i'}`;

  const bandiByFonte = useMemo(
    () => bandiDB.filter((b: {
      fonte?: string | null;
      link?: string | null;
      keyword?: string | null;
      titolo?: string | null;
      ente?: string | null;
      oggetto?: string | null;
      regione?: string | null;
      localita?: string | null;
    }) =>
      matchesFiltroFonte(b.fonte, b.link, filtroFonte) &&
      matchesFiltroKeyword(b.keyword, b.titolo, filtroKeyword) &&
      matchesFiltroRegione(b, regioniSelezionate),
    ),
    [bandiDB, filtroFonte, filtroKeyword, regioniSelezionate],
  );

  const cantiereBandi = useMemo(
    () => bandiByFonte.filter((b: {
      interesse?: BandoInteresseRow | null;
      trattative_count?: number;
    }) => isBandoInCantiere(
      effectiveEsitoBando(b.interesse, b.trattative_count),
      b.interesse?.cantiere_stato,
      b.trattative_count,
    )),
    [bandiByFonte],
  );

  const displayBandi = useMemo(
    () => {
      const source = isPartecipati ? cantiereBandi : bandiByFonte;
      return source.filter((b: {
        interesse?: BandoInteresseRow | null;
        trattative_count?: number;
        visto_il?: string | null;
      }) => {
        const esito = effectiveEsitoBando(b.interesse, b.trattative_count);
        if (isPartecipati) {
          const cantiere = effectiveCantiereStato({
            esito,
            cantiere: b.interesse?.cantiere_stato,
            storicoGaraId: b.interesse?.storico_gara_id,
            trattativeCount: b.trattative_count,
          });
          return matchesFiltroCantiere(cantiere, filtroCantiere);
        }
        const vis = visibilitaBando({ esito, visto_il: b.visto_il });
        if (filtroPipeline === "nuovi" || filtroPipeline === "gia_visti") {
          return matchesFiltroVisibilita(vis, filtroPipeline);
        }
        return matchesFiltroPipeline(esito, filtroPipeline);
      });
    },
    [bandiByFonte, cantiereBandi, filtroCantiere, filtroPipeline, isPartecipati],
  );

  const cantiereCounts = useMemo(() => {
    const counts: Record<FiltroCantiere, number> = {
      da_approfondire: 0,
      in_monitoraggio: 0,
      pronto_trattativa: 0,
      in_trattativa: 0,
      archiviato_storico: 0,
      tutti: cantiereBandi.length,
    };
    for (const b of cantiereBandi as {
      interesse?: BandoInteresseRow | null;
      trattative_count?: number;
    }[]) {
      const esito = effectiveEsitoBando(b.interesse, b.trattative_count);
      const cantiere = effectiveCantiereStato({
        esito,
        cantiere: b.interesse?.cantiere_stato,
        storicoGaraId: b.interesse?.storico_gara_id,
        trattativeCount: b.trattative_count,
      });
      if (cantiere && cantiere !== "abbandonato") counts[cantiere] += 1;
    }
    return counts;
  }, [cantiereBandi]);

  const storicoTokens = useMemo(() => {
    if (!isPartecipati) return [];
    return [...new Set(
      (cantiereBandi as { ente?: string | null }[])
        .map((b) => enteSearchToken(b.ente))
        .filter((t) => t.length >= 4),
    )].slice(0, 8);
  }, [cantiereBandi, isPartecipati]);

  const { data: storicoMatchRows = [] } = useQuery({
    queryKey: ["storico_match_bandi", storicoTokens],
    enabled: isPartecipati && storicoTokens.length > 0,
    queryFn: async () => {
      const orFilter = storicoTokens.map((t) => `ente_nome.ilike.%${t}%`).join(",");
      const { data, error } = await (supabase as any)
        .from("v_storico_gare")
        .select("id, ente_nome, anno_riferimento, esito, broker_incumbent, data_fine_mandato, bando_id")
        .or(orFilter)
        .order("anno_riferimento", { ascending: false })
        .limit(80);
      if (error) throw error;
      return (data || []) as StoricoGaraMatch[];
    },
  });

  const cantiereIds = useMemo(
    () => (cantiereBandi as { id: string }[]).map((b) => b.id),
    [cantiereBandi],
  );

  const { data: documentiCantiere = [] } = useQuery({
    queryKey: ["bandi_documenti", cantiereIds],
    enabled: isPartecipati && cantiereIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bandi_documenti")
        .select("id, bando_id, tipo, nome, mime, url_origine, storage_path, hash_sha256, stato, visto_il, scaricato_il")
        .in("bando_id", cantiereIds)
        .neq("stato", "rimosso")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as BandoDocumentoRow[];
    },
  });

  const { data: harvestRuns = [] } = useQuery({
    queryKey: ["bandi_harvest_run", cantiereIds],
    enabled: isPartecipati && cantiereIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bandi_harvest_run")
        .select("id, bando_id, avviato_il, concluso_il, esito, motore, documenti_nuovi, documenti_aggiornati, novita_json, errore")
        .in("bando_id", cantiereIds)
        .order("avviato_il", { ascending: false })
        .limit(80);
      if (error) throw error;
      return (data || []) as BandoHarvestRunRow[];
    },
  });

  const bandiCheckScaduti = useMemo(() => {
    return (cantiereBandi as {
      id: string;
      interesse?: BandoInteresseRow | null;
      trattative_count?: number;
    }[]).filter((b) => {
      const esito = effectiveEsitoBando(b.interesse, b.trattative_count);
      const cantiere = effectiveCantiereStato({
        esito,
        cantiere: b.interesse?.cantiere_stato,
        storicoGaraId: b.interesse?.storico_gara_id,
        trattativeCount: b.trattative_count,
      });
      const last = harvestRuns.find((r) => r.bando_id === b.id)?.avviato_il
        || b.interesse?.harvest_at;
      return isBandoMonitorabile(cantiere) && isMonitorDue(last);
    });
  }, [cantiereBandi, harvestRuns]);

  const handleMonitoraScaduti = async () => {
    const coda = bandiCheckScaduti.slice(0, 5);
    if (coda.length === 0) {
      toast.info("Nessun bando con check scaduto");
      return;
    }
    setMonitoringAll(true);
    try {
      for (const bando of coda) {
        await handleAggiornaPortale(bando);
      }
    } finally {
      setMonitoringAll(false);
    }
  };

  const pipelineCounts = useMemo(() => {
    const counts: Record<FiltroPipelineBando, number> = {
      nuovi: 0,
      gia_visti: 0,
      voglio_partecipare: 0,
      non_partecipo: 0,
      in_trattativa: 0,
      tutti: bandiByFonte.length,
    };
    for (const b of bandiByFonte as {
      interesse?: BandoInteresseRow | null;
      trattative_count?: number;
      visto_il?: string | null;
    }[]) {
      const esito = effectiveEsitoBando(b.interesse, b.trattative_count);
      const vis = visibilitaBando({ esito, visto_il: b.visto_il });
      if (vis === "nuovo") counts.nuovi += 1;
      else if (vis === "gia_visto") counts.gia_visti += 1;
      else if (esito) counts[esito] += 1;
    }
    return counts;
  }, [bandiByFonte]);

  const emptyListaMsg = (() => {
    if (isPartecipati) {
      const label = FILTRI_CANTIERE.find((f) => f.value === filtroCantiere)?.label ?? "questa lista";
      return {
        title: cantiereBandi.length === 0 ? "Nessun bando partecipato" : `Nessun bando in «${label}»`,
        hint: cantiereBandi.length === 0
          ? "Dalla lista Bandi Pubblici clicca «Voglio partecipare» per spostarlo qui."
          : "Cambia tab del cantiere o manda un bando in Storico Gare / trattativa.",
      };
    }
    if (bandiDB.length === 0) {
      return hasSearched
        ? { title: "Nessun bando trovato", hint: "Prova ad allargare i filtri o un'altra regione." }
        : { title: "Nessun bando in archivio", hint: "Clicca \"Cerca Bandi\" per cercare su TED Europa, Mondo Appalti e Infordat." };
    }
    if (
      regioniSelezionate.length > 0 &&
      regioniSelezionate.length < REGIONI_ITALIANE.length &&
      bandiByFonte.length === 0
    ) {
      return {
        title: "Nessun bando per le regioni selezionate",
        hint: "Togli o cambia il filtro Regioni per vedere di nuovo l'archivio.",
      };
    }
    const label = FILTRI_PIPELINE_BANDI.find((f) => f.value === filtroPipeline)?.label ?? "questa lista";
    return {
      title: `Nessun bando in «${label}»`,
      hint: filtroPipeline === "nuovi"
        ? "Il click sul titolo apre la scheda senza togliere il bando da qui. Poi decidi se partecipare."
        : filtroPipeline === "gia_visti"
          ? "Qui restano i bandi già aperti in passato. I nuovi restano in Nuovi finché non decidi."
          : "Cambia lista o fonte per vedere altri bandi.",
    };
  })();

  useEffect(() => {
    if (!isPartecipati) return;
    const missing = displayBandi.filter((b: { id: string }) =>
      !enrichTriedRef.current.has(b.id) && needsDettaglioHarvest(b),
    );
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const bando of missing.slice(0, 10)) {
        enrichTriedRef.current.add(bando.id);
        try {
          await enrichBandoFromPortale(bando);
        } catch (err) {
          console.warn("enrich partecipati", err);
        }
        if (cancelled) return;
      }
      if (!cancelled) refetchBandi();
    })();
    return () => {
      cancelled = true;
    };
  }, [isPartecipati, displayBandi, refetchBandi]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        {isPartecipati ? <Heart className="h-8 w-8 text-primary" /> : <Landmark className="h-8 w-8 text-primary" />}
        <div>
          <h1 className="text-3xl font-bold">{isPartecipati ? "Bandi partecipati" : "Bandi Pubblici"}</h1>
          <p className="text-muted-foreground">
            {isPartecipati
              ? "Cantiere: approfondisci, monitora i documenti, crea trattativa o manda in Storico Gare"
              : `Nuovi e già visti restano in archivio. Poi decidi se partecipare — ${labelKeywordRicerca(keywordRicerca)}`}
          </p>
        </div>
        {isPartecipati && (
        <div className="ml-auto flex items-center gap-3">
          {bandiCheckScaduti.length > 0 && (
            <Badge variant="outline" className="gap-1.5 py-1">
              {bandiCheckScaduti.length} check scadut{bandiCheckScaduti.length === 1 ? "o" : "i"}
            </Badge>
          )}
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5"
            disabled={monitoringAll || harvestingId !== null}
            onClick={() => void handleMonitoraScaduti()}
          >
            {monitoringAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Monitora scaduti
          </Button>
        </div>
        )}
        {!isPartecipati && (
        <div className="ml-auto flex items-center gap-3">
          {apiCallCount > 0 && (
            <Badge variant="outline" className="gap-1.5 py-1">
              <Zap className="h-3.5 w-3.5" />
              {apiCallCount} chiamat{apiCallCount === 1 ? "a" : "e"} API
            </Badge>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowStoria(!showStoria)}>
            <History className="h-4 w-4" />
            Ricerche recenti
          </Button>
        </div>
        )}
      </div>

      {!isPartecipati && showStoria && ricercheRecenti.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ultime ricerche</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ricercheRecenti.map((r: any) => (
                <div key={r.id} className="flex items-center gap-3 text-sm border-b pb-2 last:border-0">
                  <span className="text-muted-foreground">
                    {format(new Date(r.eseguita_il), "dd/MM/yyyy HH:mm", { locale: it })}
                  </span>
                  <span>
                    {r.regioni?.length > 0 ? r.regioni.join(", ") : "Tutte le regioni"}
                  </span>
                  <Badge variant="outline">{labelFonteRicerca(r.fonte)}</Badge>
                  <Badge variant="outline" className="ml-auto">{r.risultati_count} risultati</Badge>
                  {r.profiles && (
                    <span className="text-xs text-muted-foreground">
                      da {r.profiles.nome} {r.profiles.cognome}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!isPartecipati && <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">Fonte:</Label>
              <Select value={fonte} onValueChange={(v) => setFonte(v as FonteRicerca)}>
                <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONTI_RICERCA.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">Keyword:</Label>
              <Select
                value={keywordRicerca}
                onValueChange={(v) => setKeywordRicerca(parseKeywordRicerca(v))}
              >
                <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KEYWORDS_RICERCA.map((k) => (
                    <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="gap-2" disabled={loading}>
              <Filter className="h-4 w-4" /> Filtri
            </Button>
            <Button onClick={cercaBandi} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? "Ricerca..." : "Cerca Bandi"}
            </Button>
            {loading && (
              <Button variant="outline" onClick={() => { stopSearch(); setLoading(false); setProgressMsg(""); }} className="gap-2">
                <X className="h-4 w-4" /> Annulla
              </Button>
            )}
          </div>

          {showFilters && (
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Regioni</Label>
                <Popover open={regioniOpen} onOpenChange={setRegioniOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={loading}>
                      {regioniLabel}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0" align="start">
                    <div className="p-3 border-b">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="tutte-regioni" checked={regioniSelezionate.length === REGIONI_ITALIANE.length} onCheckedChange={toggleTutte} />
                        <label htmlFor="tutte-regioni" className="text-sm font-medium cursor-pointer">Seleziona tutte</label>
                      </div>
                    </div>
                    <div className="max-h-[250px] overflow-y-auto p-2 space-y-1">
                      {REGIONI_ITALIANE.map((regione) => (
                        <div key={regione} className="flex items-center space-x-2 py-1 px-1 rounded hover:bg-accent cursor-pointer" onClick={() => toggleRegione(regione)}>
                          <Checkbox id={`regione-${regione}`} checked={regioniSelezionate.includes(regione)} onCheckedChange={() => toggleRegione(regione)} />
                          <label htmlFor={`regione-${regione}`} className="text-sm cursor-pointer flex-1">{regione}</label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                {regioniSelezionate.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {regioniSelezionate.map((regione) => (
                      <Badge key={regione} variant="secondary" className="gap-1 pr-1">
                        {regione}
                        <button onClick={() => removeRegione(regione)} className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5" disabled={loading}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Importo minimo (€)</Label>
                  <Input type="number" placeholder="0" value={importoMin} onChange={(e) => setImportoMin(e.target.value)} disabled={loading} />
                </div>
                <div className="space-y-2">
                  <Label>Importo massimo (€)</Label>
                  <Input type="number" placeholder="Nessun limite" value={importoMax} onChange={(e) => setImportoMax(e.target.value)} disabled={loading} />
                </div>
                <div className="space-y-2">
                  <Label>Stato bando</Label>
                  <Select value={statoBando} onValueChange={setStatoBando}>
                    <SelectTrigger><SelectValue placeholder="Tutti gli stati" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tutti">Tutti</SelectItem>
                      <SelectItem value="aperto">Aperto</SelectItem>
                      <SelectItem value="scaduto">Scaduto</SelectItem>
                      <SelectItem value="in_valutazione">In valutazione</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Pubblicato dal</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataDa && "text-muted-foreground")} disabled={loading}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataDa ? format(dataDa, "dd/MM/yyyy", { locale: it }) : "Seleziona data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dataDa} onSelect={setDataDa} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Pubblicato fino al</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataA && "text-muted-foreground")} disabled={loading}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataA ? format(dataA, "dd/MM/yyyy", { locale: it }) : "Seleziona data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dataA} onSelect={setDataA} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="ghost" onClick={resetFiltri} disabled={loading}>Resetta filtri</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>}

      {/* Loading / Error states during live search */}
      {!isPartecipati && loading && (
        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              <Bot className="h-8 w-8 text-primary animate-pulse" />
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-medium">Ricerca in corso...</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {progressMsg || "Ricerca sui portali gare."}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Tempo trascorso: {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}
              </p>
              {risultatiLive.length > 0 && (
                <p className="text-sm text-primary font-medium mt-2">{risultatiLive.length} risultato/i trovati finora...</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!isPartecipati && !loading && searchError && (
        <Card>
          <CardContent className="py-16 text-center">
            <Search className="mx-auto h-16 w-16 text-destructive/30 mb-4" />
            <h3 className="text-lg font-medium text-destructive">Errore nella ricerca</h3>
            <p className="text-sm text-muted-foreground mt-2">{searchError}</p>
          </CardContent>
        </Card>
      )}

      {/* Bandi from DB — filtri visibili anche a lista vuota per recuperare «Non partecipo» */}
      {!loading && !searchError && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {displayBandi.length} bando/i
                {filtroFonte === "tutte" ? " in questa lista" : ` da ${labelFonteBando(filtroFonte)}`}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 p-0.5" role="tablist" aria-label="Filtro fonte bandi">
                  {FILTRI_FONTE_LISTA.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      role="tab"
                      aria-selected={filtroFonte === f.value}
                      onClick={() => setFiltroFonte(f.value)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        filtroFonte === f.value
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 p-0.5" role="tablist" aria-label="Filtro keyword bandi">
                  {FILTRI_KEYWORD_LISTA.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      role="tab"
                      aria-selected={filtroKeyword === f.value}
                      onClick={() => setFiltroKeyword(f.value)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        filtroKeyword === f.value
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {isPartecipati && (
            <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-border bg-muted/50 p-0.5 w-fit" role="tablist" aria-label="Cantiere bandi partecipati">
              {FILTRI_CANTIERE.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="tab"
                  aria-selected={filtroCantiere === f.value}
                  onClick={() => setFiltroCantiere(f.value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    filtroCantiere === f.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                  <span className="ml-1 tabular-nums text-[10px] text-muted-foreground">{cantiereCounts[f.value]}</span>
                </button>
              ))}
            </div>
            )}
            {!isPartecipati && (
            <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-border bg-muted/50 p-0.5 w-fit" role="tablist" aria-label="Lista interesse bandi">
              {FILTRI_PIPELINE_LISTA_PRINCIPALE.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="tab"
                  aria-selected={filtroPipeline === f.value}
                  onClick={() => setFiltroPipeline(f.value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    filtroPipeline === f.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                  <span className="ml-1 tabular-nums text-[10px] text-muted-foreground">{pipelineCounts[f.value]}</span>
                </button>
              ))}
            </div>
            )}
          </div>
          {displayBandi.map((bando: any) => {
            const esito = effectiveEsitoBando(bando.interesse, bando.trattative_count);
            const vis = visibilitaBando({ esito, visto_il: bando.visto_il });
            const cantiere = effectiveCantiereStato({
              esito,
              cantiere: bando.interesse?.cantiere_stato,
              storicoGaraId: bando.interesse?.storico_gara_id,
              trattativeCount: bando.trattative_count,
            });
            const storicoHits = isPartecipati
              ? matchStoricoPerEnte(bando.ente, storicoMatchRows)
              : [];
            const docsBando = isPartecipati
              ? documentiVisibili(documentiCantiere.filter((d) => d.bando_id === bando.id))
              : [];
            const novitaDoc = countNovitaDocumenti(docsBando);
            const lastRun = isPartecipati
              ? harvestRuns.find((r) => r.bando_id === bando.id)
              : undefined;
            const checkDue = isPartecipati && isBandoMonitorabile(cantiere)
              && isMonitorDue(lastRun?.avviato_il || bando.interesse?.harvest_at);
            const busy = harvestingId === bando.id || savingEsito || archiving || monitoringAll;
            return (
            <Card
              key={bando.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-lg">
                      {bando.link ? (
                        <a
                          href={bando.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {bando.titolo || bando.oggetto}
                        </a>
                      ) : (
                        bando.titolo || bando.oggetto
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Building className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-medium text-foreground">{bando.ente}</span>
                      {bando.ente_tipo && (
                        <Badge variant="outline" className="text-xs">{bando.ente_tipo}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <Badge
                      variant={esito === "voglio_partecipare" ? "default" : esito === "non_partecipo" ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      {isPartecipati && cantiere
                        ? labelCantiereStato(cantiere)
                        : esito ? labelEsitoBando(esito) : labelVisibilitaBando(vis)}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {labelFonteBando(resolveFonteBando(bando.fonte, bando.link))}
                    </Badge>
                    {bando.keyword && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Tag className="h-3 w-3" />
                        {bando.keyword}
                      </Badge>
                    )}
                    {bando.trattative_count > 0 && (
                      <Badge variant="outline" className="gap-1">
                        <Link2 className="h-3 w-3" />
                        {bando.trattative_count} trattativ{bando.trattative_count === 1 ? "a" : "e"}
                      </Badge>
                    )}
                    {bando.tipo_avviso && (
                      <Badge variant={bando.aggiudicato || bando.tipo_avviso === "esito" ? "destructive" : "outline"} className="text-xs">
                        {labelTipoAvviso(bando.tipo_avviso)}
                      </Badge>
                    )}
                    <Badge variant={statoBadgeVariant(bando.stato)}>
                      {statoLabel(bando.stato)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  {bando.importo != null && Number(bando.importo) > 0 && (
                    <div>
                      <span className="text-muted-foreground">Importo: </span>
                      <span className="font-medium">€{Number(bando.importo).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {bando.scadenza && (
                    <div>
                      <span className="text-muted-foreground">Scadenza offerta: </span>
                      <span className="font-medium">{fmtData(bando.scadenza) || format(new Date(bando.scadenza), "dd/MM/yyyy", { locale: it })}</span>
                    </div>
                  )}
                  {bando.aggiudicatario && (
                    <div>
                      <span className="text-muted-foreground">Aggiudicato a: </span>
                      <span className="font-medium">{bando.aggiudicatario}</span>
                    </div>
                  )}
                  {bando.data_decisione && (
                    <div>
                      <span className="text-muted-foreground">Decisione: </span>
                      <span className="font-medium">{fmtData(bando.data_decisione)}</span>
                    </div>
                  )}
                  {bando.data_contratto && (
                    <div>
                      <span className="text-muted-foreground">Contratto: </span>
                      <span className="font-medium">{fmtData(bando.data_contratto)}</span>
                    </div>
                  )}
                  {fmtData(bando.data_pubblicazione) && (
                    <div>
                      <span className="text-muted-foreground">Pubblicato il: </span>
                      <span className="font-medium">{fmtData(bando.data_pubblicazione)}</span>
                    </div>
                  )}
                  {(bando.servizio_da || bando.servizio_a) && (
                    <div>
                      <span className="text-muted-foreground">Periodo servizio: </span>
                      <span className="font-medium">
                        {[fmtData(bando.servizio_da), fmtData(bando.servizio_a)].filter(Boolean).join(" – ")}
                      </span>
                    </div>
                  )}
                  {labelTipoProcedura(bando.tipo_procedura) && (
                    <div>
                      <span className="text-muted-foreground">Procedura: </span>
                      <span>{labelTipoProcedura(bando.tipo_procedura)}</span>
                    </div>
                  )}
                  {bando.tipologia && (
                    <div>
                      <span className="text-muted-foreground">Tipologia: </span>
                      <span>{bando.tipologia}</span>
                    </div>
                  )}
                  {bando.cig && (
                    <div>
                      <span className="text-muted-foreground">CIG: </span>
                      <span className="font-mono text-xs">{bando.cig}</span>
                    </div>
                  )}
                  {(bando.localita || bando.regione) && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{[bando.localita, bando.regione].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  {bando.interesse?.motivo && esito === "non_partecipo" && (
                    <div className="w-full text-xs text-muted-foreground">
                      Motivo: {bando.interesse.motivo}
                    </div>
                  )}
                  {bando.interesse?.harvest_note && esito === "voglio_partecipare" && (
                    <div className="w-full text-xs text-muted-foreground">
                      {bando.interesse.harvest_note}
                    </div>
                  )}
                  {isPartecipati && storicoHits.length > 0 && (
                    <div className="w-full text-xs text-muted-foreground">
                      Storico Gare: {storicoHits.map((s) => (
                        `${s.ente_nome}${s.anno_riferimento ? ` ${s.anno_riferimento}` : ""}${s.broker_incumbent ? ` · ${s.broker_incumbent}` : ""}${s.esito ? ` · ${s.esito}` : ""}`
                      )).join(" · ")}
                    </div>
                  )}
                  {isPartecipati && (
                    <div className="w-full flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {(novitaDoc.nuovi + novitaDoc.aggiornati) > 0 && (
                        <Badge variant="default" className="text-[10px]">
                          {novitaDoc.nuovi + novitaDoc.aggiornati} doc nuovi/aggiornati
                        </Badge>
                      )}
                      <span>
                        {docsBando.length} document{docsBando.length === 1 ? "o" : "i"} in archivio
                        {lastHarvestLabel(lastRun?.avviato_il || bando.interesse?.harvest_at)
                          ? ` · ultimo check ${lastHarvestLabel(lastRun?.avviato_il || bando.interesse?.harvest_at)}`
                          : ""}
                      </span>
                      {checkDue && (
                        <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700">
                          Check scaduto
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
                    {esito !== "non_partecipo" && esito !== "in_trattativa" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 h-7 text-xs"
                        disabled={busy}
                        onClick={() => {
                          setNonPartecipoBando(bando);
                          setNonPartecipoMotivo("");
                          setNonPartecipoOpen(true);
                        }}
                      >
                        <Ban className="h-3 w-3" /> Non partecipo
                      </Button>
                    )}
                    {esito !== "voglio_partecipare" && esito !== "in_trattativa" && esito !== "non_partecipo" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="gap-1 h-7 text-xs"
                        disabled={busy}
                        onClick={() => handleVoglioPartecipare(bando)}
                      >
                        {harvestingId === bando.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Heart className="h-3 w-3" />}
                        Voglio partecipare
                      </Button>
                    )}
                    {esito === "non_partecipo" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 h-7 text-xs"
                        disabled={busy}
                        onClick={() => handleRimettiInValutazione(bando)}
                      >
                        <RotateCcw className="h-3 w-3" /> Rimetti in valutazione
                      </Button>
                    )}
                    {isPartecipati && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFascicoloBando(bando);
                          setFascicoloOpen(true);
                        }}
                      >
                        <FolderOpen className="h-3 w-3" /> Archivio documenti
                      </Button>
                    )}
                    {isPartecipati && cantiere && cantiere !== "archiviato_storico" && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-1 h-7 text-xs"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleScaricaTuttiDocumenti(bando);
                          }}
                        >
                          {harvestingId === bando.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />}
                          Scarica tutti i documenti
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="gap-1 h-7 text-xs"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleAggiornaPortale(bando);
                          }}
                        >
                          {harvestingId === bando.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                          Aggiorna dal portale
                        </Button>
                        {CANTIERE_AZIONI.filter((a) => a.value !== cantiere).map((a) => (
                          <Button
                            key={a.value}
                            variant="outline"
                            size="sm"
                            className="gap-1 h-7 text-xs"
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleCambiaCantiere(bando, a.value);
                            }}
                          >
                            {a.label}
                          </Button>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 h-7 text-xs"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            setArchivioBando(bando);
                            setArchivioOpen(true);
                          }}
                        >
                          <Archive className="h-3 w-3" /> Manda in Storico Gare
                        </Button>
                      </>
                    )}
                    {isPartecipati && cantiere === "archiviato_storico" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate("/trattative/storico-gare");
                        }}
                      >
                        <Archive className="h-3 w-3" /> Apri Storico Gare
                      </Button>
                    )}
                    {esito === "voglio_partecipare" && (
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-1 h-7 text-xs"
                        onClick={() => openCreaTrattativaDialog(bando)}
                      >
                        <Plus className="h-3 w-3" /> Crea Trattativa
                      </Button>
                    )}
                    {esito !== "voglio_partecipare" && (
                      <Button
                        variant={esito === "in_trattativa" ? "outline" : "default"}
                        size="sm"
                        className="gap-1 h-7 text-xs"
                        onClick={() => openCreaTrattativaDialog(bando)}
                      >
                        <Plus className="h-3 w-3" /> Crea Trattativa
                      </Button>
                    )}
                    {bando.pdf_path ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 h-7 text-xs"
                        onClick={async () => {
                          const { data } = await supabase.storage.from("documenti_generali").createSignedUrl(bando.pdf_path!, 3600);
                          if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                          else toast.error("Errore apertura PDF");
                        }}
                      >
                        <FileText className="h-3 w-3" /> Apri PDF
                      </Button>
                    ) : bando.pdf_url ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 h-7 text-xs"
                        onClick={async () => {
                          toast.info("Download PDF in corso...");
                          const { error } = await supabase.functions.invoke("scarica-bando-pdf", {
                            body: { bando_id: bando.id, pdf_url: bando.pdf_url },
                          });
                          if (error) {
                            toast.error("Errore download PDF: " + error.message);
                          } else {
                            toast.success("PDF scaricato e salvato");
                            refetchBandi();
                          }
                        }}
                      >
                        <FileDown className="h-3 w-3" /> Scarica PDF
                      </Button>
                    ) : null}
                    {bando.link && (
                      <a href={bando.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-sm">
                        Vedi bando <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
          {displayBandi.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center">
                {bandiDB.length === 0 && !hasSearched ? (
                  <Landmark className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
                ) : (
                  <Search className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
                )}
                <h3 className="text-lg font-medium text-muted-foreground">{emptyListaMsg.title}</h3>
                <p className="text-sm text-muted-foreground/70 mt-2">{emptyListaMsg.hint}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={archivioOpen} onOpenChange={(open) => {
        setArchivioOpen(open);
        if (!open) setArchivioBando(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Manda in Storico Gare
            </DialogTitle>
            <DialogDescription>
              Crea una riga di intelligence in Storico Gare. Non apre una trattativa e non cambia i KPI commerciali.
            </DialogDescription>
          </DialogHeader>
          {archivioBando && (
            <div className="space-y-2 text-sm">
              <p className="font-medium">{archivioBando.titolo || archivioBando.oggetto}</p>
              <p className="text-muted-foreground">{archivioBando.ente}</p>
              {matchStoricoPerEnte(archivioBando.ente, storicoMatchRows).length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Esistono già {matchStoricoPerEnte(archivioBando.ente, storicoMatchRows).length} gare
                  storiche per questo ente: la nuova riga si aggiunge, non le sovrascrive.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchivioOpen(false)} disabled={archiving}>Annulla</Button>
            <Button onClick={() => void handleArchiviaStorico()} disabled={archiving} className="gap-1">
              {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
              Archivia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BandiFascicoloArchivio
        open={fascicoloOpen}
        onOpenChange={(open) => {
          setFascicoloOpen(open);
          if (!open) setFascicoloBando(null);
        }}
        bando={fascicoloBando}
        documenti={fascicoloBando
          ? documentiVisibili(documentiCantiere.filter((d) => d.bando_id === fascicoloBando.id))
          : []}
        downloading={!!fascicoloBando && harvestingId === fascicoloBando.id}
        onScaricaTutti={fascicoloBando && fascicoloBando.interesse?.cantiere_stato !== "archiviato_storico"
          ? () => void handleScaricaTuttiDocumenti(fascicoloBando)
          : undefined}
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ["bandi_documenti"] });
        }}
      />

      <Dialog open={nonPartecipoOpen} onOpenChange={(open) => {
        setNonPartecipoOpen(open);
        if (!open) {
          setNonPartecipoBando(null);
          setNonPartecipoMotivo("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5" />
              Non partecipo
            </DialogTitle>
            <DialogDescription>
              Il bando sparisce da «Nuovi» / «Già visti» ma resta in archivio. Puoi recuperarlo dalla lista Non partecipo.
            </DialogDescription>
          </DialogHeader>
          {nonPartecipoBando && (
            <div className="space-y-3">
              <p className="text-sm font-medium">{nonPartecipoBando.titolo || nonPartecipoBando.oggetto}</p>
              <div className="space-y-1.5">
                <Label htmlFor="motivo-non-partecipo">Motivo (facoltativo)</Label>
                <Textarea
                  id="motivo-non-partecipo"
                  value={nonPartecipoMotivo}
                  onChange={(e) => setNonPartecipoMotivo(e.target.value)}
                  rows={3}
                  placeholder="Es. importo troppo basso, ente fuori zona…"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNonPartecipoOpen(false)} disabled={savingEsito}>Annulla</Button>
            <Button variant="secondary" onClick={handleConfirmNonPartecipo} disabled={savingEsito} className="gap-1">
              {savingEsito ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Crea Trattativa da Bando */}
      <Dialog open={creaTrattativaOpen} onOpenChange={setCreaTrattativaOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Crea Trattativa dal Bando
            </DialogTitle>
          </DialogHeader>
          {selectedBando && (
            <div className="space-y-4 pt-2">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium">{selectedBando.titolo || selectedBando.oggetto}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building className="h-3 w-3" />
                  {selectedBando.ente}
                </p>
                <div className="flex gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Tag className="h-3 w-3" />
                    {selectedBando.keyword || KEYWORD_BROKERAGGIO}
                  </Badge>
                  <Badge variant="outline" className="text-xs">Fonte: {labelFonteBando(resolveFonteBando(selectedBando.fonte, selectedBando.link))}</Badge>
                </div>
              </div>

              {existingTrattative.length > 0 && (
                <Alert className="border-destructive/30 bg-destructive/5">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <AlertTitle>Trattativa già esistente per questo bando</AlertTitle>
                  <AlertDescription>
                    <div className="space-y-1 mt-1">
                      {existingTrattative.map((t: any) => (
                        <div key={t.id} className="text-xs flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{t.stato}</Badge>
                          <span>{t.prodotto || "—"}</span>
                          {t.data_apertura && <span className="text-muted-foreground">aperta il {format(new Date(t.data_apertura), "dd/MM/yyyy", { locale: it })}</span>}
                          {t.premio_previsto && <span>€{Number(t.premio_previsto).toLocaleString("it-IT")}</span>}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs mt-2 text-muted-foreground">Puoi comunque crearne un'altra se necessario.</p>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Prodotto</Label>
                  <Input
                    value={trattativaProdotto}
                    onChange={(e) => setTrattativaProdotto(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Premio previsto (€)</Label>
                  <Input
                    type="number"
                    value={trattativaPremio}
                    onChange={(e) => setTrattativaPremio(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Scadenza</Label>
                <Input
                  type="date"
                  value={trattativaScadenza}
                  onChange={(e) => setTrattativaScadenza(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Note</Label>
                <Textarea
                  value={trattativaNote}
                  onChange={(e) => setTrattativaNote(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="text-xs text-muted-foreground">
                Il prospect <strong>{selectedBando.ente}</strong> verrà creato automaticamente se non esiste già. La trattativa sarà collegata a questo bando.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreaTrattativaOpen(false)}>Annulla</Button>
            <Button onClick={() => setConfirmOpen(true)} className="gap-1">
              <Plus className="h-4 w-4" /> Crea Trattativa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conferma creazione */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma creazione trattativa</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  Stai per creare una nuova trattativa per <strong>{selectedBando?.ente}</strong> con
                  prodotto "{trattativaProdotto}" e fonte "{labelFonteBando(resolveFonteBando(selectedBando?.fonte, selectedBando?.link))}".
                  {trattativaPremio && <> Premio previsto: €{Number(trattativaPremio).toLocaleString("it-IT")}.</>}
                </p>
                {existingTrattative.length > 0 && (
                  <p className="mt-2 font-semibold text-destructive">
                    ⚠️ Attenzione: esiste già {existingTrattative.length} trattativa/e collegata/e a questo bando.
                  </p>
                )}
                <p className="mt-2">Vuoi procedere?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={creatingTrattativa}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCreaTrattativa} disabled={creatingTrattativa}>
              {creatingTrattativa ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
