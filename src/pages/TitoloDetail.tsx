import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";
import { handleNotificaMessaCassaOutcome, invokeNotificaMessaCassa, scheduleOrInvokeNotificaMessaCassa } from "@/lib/notificaMessaCassa";
import { MessaCassaSeraleCheckbox } from "@/components/portafoglio/MessaCassaSeraleCheckbox";
import { annullaMessaACassa } from "@/lib/annullaMessaACassa";
import { buildGarantitoPayload, buildIncassoDateFields, isInCoperturaGarantita, isGarantitoAperto } from "@/lib/garantitoTitolo";
import { annullaPolizza } from "@/lib/annullaPolizza";
import { resolveStatoContrattoTitolo } from "@/lib/statoContrattoTitolo";
import { FRAZIONAMENTI, derivaFrazionamentoDaRate, frazionamentoToRate } from "@/lib/frazionamento";
import {
  lordoFirmaDaVoci,
  payloadImportoFirma,
  vociDaLordoFirma,
  type VociImportoFirma,
} from "@/lib/importoFirma";
import { syncPeriodoTemporanea } from "@/lib/syncPeriodoTemporanea";
import { syncPeriodoRateo } from "@/lib/syncPeriodoRateo";
import { computeRegolazioneDatePresunte } from "@/lib/regolazioneDatePresunte";
import {
  buildRegolazioneFattoriRows,
  rowsToInsertPayload,
  type RegolazioneFattoreRiga,
} from "@/lib/regolazioneFattori";
import {
  FATTORI_REGOLAZIONE_STANDARD,
  FATTORI_REGOLAZIONE_STANDARD_CODICI,
  mergeFattoriRegolazione,
} from "@/lib/fattoriRegolazioneStandard";
import { RegolazioneFattoriImportiGrid } from "@/components/polizze/RegolazioneFattoriImportiGrid";
import { calcLimiteMora, calcMoraGiorni } from "@/lib/calcLimiteMora";
import { fmtEuro } from "@/lib/formatCurrency";
import { useAccountExecutivesLookup } from "@/hooks/useAccountExecutivesLookup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, FileText, Percent, Clock, ExternalLink, ChevronDown, Calendar, Shield, DollarSign, RefreshCw, LayoutGrid, List, Users, ShieldCheck, StickyNote, Car, UserCheck, CheckSquare, Replace, Ban, XCircle, Download, Eye, Trash2, Pencil, Database, AlertTriangle, Info, User as UserIcon, Building2, Mail, Truck, PauseCircle, PlayCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { TitoloDocumentiTrigger } from "@/components/titolo/TitoloDocumentiDialog";
import MessaCassaDialog from "@/components/portafoglio/MessaCassaDialog";
import CompensazioniBox from "@/components/titolo/CompensazioniBox";
import ModalitaIncassoBox from "@/components/titolo/ModalitaIncassoBox";
import ChatTab from "@/components/ChatTab";
import TimelineTab from "@/components/TimelineTab";
import { toast } from "sonner";
import { isGeneratedCigTemporaneo, normalizeCig } from "@/lib/validateCig";
import CigRifField from "@/components/shared/CigRifField";
import { isCigFormatoInvalido, isClienteEnte } from "@/lib/cigEnte";
import { resolveTitoloMadreId } from "@/lib/sospensioneQuietanze";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/SearchableSelect";
import { RamoSottoramoSelect } from "@/components/polizze/RamoSottoramoSelect";
import { useRcaUsi } from "@/hooks/useRcaLookups";
import { useLookupTipologiaVeicolo } from "@/hooks/useLookupTables";
import { TIPI_VEICOLO } from "@/lib/rcaConstants";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

import {
  TitoloImportiPremiBlock,
  type TitoloImportiPremiBlockHandle,
  type TitoloImportiPremiDisplayTotals,
  type PremiGaranziaDisplayTotals,
} from "@/components/polizze/TitoloImportiPremiBlock";
import { CoassicurazioneImportiBreakdown } from "@/components/polizze/CoassicurazioneImportiBreakdown";
import { ripartoRowsFromDettaglio } from "@/lib/coassicurazione";
import { PolizzaSection } from "@/components/polizze/PolizzaSection";
import { SostituzionePolizzaDialog } from "@/components/polizze/SostituzionePolizzaDialog";
import { EstinzionePolizzaDialog } from "@/components/polizze/EstinzionePolizzaDialog";
import { SospensionePolizzaDialog } from "@/components/polizze/SospensionePolizzaDialog";
import { RiattivazionePolizzaDialog } from "@/components/polizze/RiattivazionePolizzaDialog";
import {
  LibroMatricolaDialog,
  assignProgressivi,
  mapDbToLibroMatricolaRiga,
  rigaToDbPayload,
  type LibroMatricolaRiga,
} from "@/components/polizze/LibroMatricolaDialog";
import {
  buildLibroMatricolaOperazioniDiff,
  insertLibroMatricolaOperazioni,
} from "@/lib/libroMatricolaOps";
// RegolazionePremioDialog rimosso: la regolazione passa da ImmissionePolizzaPage in mode=regolazione
import { TitoloTabs } from "@/components/titolo/TitoloTabs";
import { TitoloHeaderBar } from "@/components/titolo/sections/TitoloHeaderBar";
import { TitoloScopeBanners } from "@/components/titolo/sections/TitoloScopeBanners";
import { TitoloQuietanzePanel } from "@/components/titolo/sections/TitoloQuietanzePanel";
import { TitoloDataPersistenceInfo } from "@/components/titolo/sections/TitoloDataPersistenceInfo";
import { PageContainer } from "@/components/shared/PageContainer";
import { TableScrollArea } from "@/components/shared/TableScrollArea";
import { fetchAppendiciPolizzaForTitolo } from "@/lib/appendiciPolizza";
import { isQuietanza as isQuietanzaTitolo, groupTitoliByPolizza, getTotQuietanze, getQuietanzaRataIndex, isAppendice, baseNumeroPolizza, canHaveDataCopertura } from "@/lib/quietanze";
import { aggiornaNumeroPolizza } from "@/lib/aggiornaNumeroPolizza";
import { verificaNumeroPolizzaDuplicato } from "@/lib/clientiDuplicate";
import ContoBancarioSelect from "@/components/anagrafiche/ContoBancarioSelect";

// Guard difensivo: garantisce che ogni mutation aggiorni SOLO il record corrente.
// Lanciare quindi rifiuta qualsiasi update se l'id passato non coincide con il titolo caricato.
function assertSameTitolo(id: string | undefined, titoloId: string | undefined, ctx: string) {
  if (!id || !titoloId || id !== titoloId) {
    const msg = `[TitoloDetail] Scope violation in ${ctx}: id=${id} titoloId=${titoloId}`;
    console.error(msg);
    throw new Error("Scope record incoerente: ricarica la pagina e riprova.");
  }
}


const fmt = (v: any) => v ?? "—";
const fmtDate = (v: string | null) => v ? format(new Date(v), "dd/MM/yyyy", { locale: it }) : "—";
const fmtBool = (v: boolean | null) => v ? "Sì" : "No";

// Determina se il ramo è Auto/Veicoli o Natanti/Nautica (mostra dati tecnici + card voci).
const RAMI_VEICOLO_NATANTE = new Set([
  "PI", "QA", "QAC", "QC", "QF", "QG", "QR", "QU", "DAB", "PJ",   // auto
  "QN", "QT", "QNA", "DD", "DN", "DNA",                            // natanti / nautica
]);
const RAMI_NATANTE_CODICI = new Set(["QN", "QT", "QNA", "DD", "DN", "DNA", "RV10", "RV11"]);
const isRamoNatante = (ramo: any) => {
  if (!ramo) return false;
  const cod = String(ramo.codice || "").toUpperCase().trim();
  const desc = String(ramo.descrizione || "").toUpperCase();
  if (RAMI_NATANTE_CODICI.has(cod)) return true;
  if (/\bNATANT|\bNAUTIC|\bIMBARC|\bCORPI NAVI/.test(desc)) return true;
  return false;
};
const isRamoAuto = (ramo: any) => {
  if (!ramo) return false;
  const cod = String(ramo.codice || "").toUpperCase().trim();
  const desc = String(ramo.descrizione || "").toUpperCase();
  if (RAMI_VEICOLO_NATANTE.has(cod)) return true;
  if (cod.startsWith("RV")) return true;
  if (/\bAUTO\b|\bAUTOVEIC|\bAUTOCARR|\bVEICOL|\bNATANT|\bNAUTIC|\bIMBARC|\bCORPI NAVI/.test(desc)) return true;
  return false;
};
// Etichetta dinamica per la riga "principale" delle card voci (RCA Auto vs RC Natanti)
const getMainVoceLabel = (ramo: any): string => {
  if (isRamoNatante(ramo)) {
    const cod = String(ramo?.codice || "").toUpperCase();
    if (cod === "DD" || cod === "DN" || cod === "DNA") return "Corpi Nautica";
    return "RC Natanti";
  }
  return "RCA Auto";
};

// Sotto-titolo per i blocchi interni alla sezione Veicolo
const SubBlockTitle = ({ children }: { children: React.ReactNode }) => (
  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mt-3 mb-2 pb-1 border-b border-border/60">
    {children}
  </h4>
);

const FieldRow = React.forwardRef<HTMLDivElement, { label: string; value: React.ReactNode }>(({ label, value }, ref) => (
  <div ref={ref} className="flex justify-between py-1">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm font-mono text-right">{value}</span>
  </div>
));
FieldRow.displayName = "FieldRow";

// Wrapper allineato alla pagina di immissione: stesso look-and-feel.
// Mantiene l'API legacy (title/icon/children/defaultOpen) ma delega a PolizzaSection.
const SectionCollapsible = ({ title, icon: Icon, children, defaultOpen = true }: { title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean }) => (
  <PolizzaSection title={title} icon={Icon} defaultOpen={defaultOpen}>
    {children}
  </PolizzaSection>
);

const TitoloDetail = () => {
  // v2 - regolazione editabile
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();

  // --- Annulla Incasso dialog state ---
  const [annullaDialogOpen, setAnnullaDialogOpen] = useState(false);
  const [annullaContrattoOpen, setAnnullaContrattoOpen] = useState(false);
  const [annullaPassword, setAnnullaPassword] = useState("");
  const [annullaLoading, setAnnullaLoading] = useState(false);
  const [sostituzioneOpen, setSostituzioneOpen] = useState(false);
  const [estinzioneOpen, setEstinzioneOpen] = useState(false);
  const [sospensioneOpen, setSospensioneOpen] = useState(false);
  const [riattivazioneOpen, setRiattivazioneOpen] = useState(false);
  // regolazioneOpen rimosso: ora navighiamo a /portafoglio/immissione?mode=regolazione

  // --- Rinnovo dialog state ---
  

  // --- Conferimento Gestito dialog state ---
  const [conferimentoDialogOpen, setConferimentoDialogOpen] = useState(false);
  const [conferimentoAccettato, setConferimentoAccettato] = useState(false);
  const [conferimentoMessaCassaSerale, setConferimentoMessaCassaSerale] = useState(false);
  const [conferimentoForm, setConferimentoForm] = useState({
    dataCopertura: "",
    dataDecorrenza: "",
    cig_rif: "",
    cig_temporaneo: false,
    updateMadre: true,
  });

  // --- Emittenda: modifica N° polizza anche se locked ---
  const [editNumeroEmittendaOpen, setEditNumeroEmittendaOpen] = useState(false);
  const [editNumeroEmittendaValue, setEditNumeroEmittendaValue] = useState("");
  const [editNumeroEmittendaSaving, setEditNumeroEmittendaSaving] = useState(false);
  const [matricolaDialogOpen, setMatricolaDialogOpen] = useState(false);
  const [righeMatricola, setRigheMatricola] = useState<LibroMatricolaRiga[]>([]);
  const [matricolaSaving, setMatricolaSaving] = useState(false);

  const { data: titolo, isLoading } = useQuery({
    queryKey: ["titolo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titoli")
        .select("*, prodotti(nome_prodotto, compagnie(nome)), uffici(nome_ufficio), produttore:profiles!titoli_produttore_id_fkey(nome, cognome, ruolo), cliente:profiles!titoli_cliente_id_fkey(nome, cognome), cliente_anagrafica:clienti!titoli_cliente_anagrafica_id_fkey(id, tipo_cliente, nome, cognome, ragione_sociale, attivita, gruppo_statistico, gruppo_finanziario_id, gruppi_finanziari(nome, tipo_soggetto)), compagnia_diretta:compagnie!titoli_compagnia_id_fkey(id, nome, codice, tipo, gruppo_compagnia, gruppo_compagnia_id, gruppi_compagnia:gruppo_compagnia_id(descrizione)), compagnia_rapporto:compagnia_rapporti!titoli_compagnia_rapporto_id_fkey(id, codice_rapporto, tipo_rapporto, gruppo_compagnia_id, gruppi_compagnia:gruppo_compagnia_id(id, descrizione, codice)), ramo:rami!titoli_ramo_id_fkey(id, codice, descrizione, aliquota_tasse_ramo, aliquota_tasse_ard, gruppo_ramo_id, gruppo_ramo:gruppi_ramo!rami_gruppo_ramo_id_fkey(id, codice, descrizione)), commerciale:profiles!titoli_commerciale_id_fkey(nome, cognome, ruolo), anagrafica_commerciale:anagrafiche_professionali!titoli_anagrafica_commerciale_id_fkey(id, ragione_sociale, nome, cognome)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: movimentiPolizza = [] } = useQuery({
    queryKey: ["movimenti-polizza", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimenti_polizza")
        .select("*")
        .eq("titolo_id", id!)
        .order("riga", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: veicolo } = useQuery({
    queryKey: ["veicolo-polizza", id],
    queryFn: async () => {
      const { data } = await supabase.from("veicoli_polizza").select("*").eq("titolo_id", id!).maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: premiGaranzia = [] } = useQuery({
    queryKey: ["premi-garanzia", id],
    queryFn: async () => {
      const { data } = await supabase.from("premi_garanzia_polizza").select("*").eq("titolo_id", id!).order("ordine");
      return data || [];
    },
    enabled: !!id,
  });

  const { data: conducente } = useQuery({
    queryKey: ["conducente-polizza", id],
    queryFn: async () => {
      const { data } = await supabase.from("conducenti_polizza").select("*").eq("titolo_id", id!).maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: provvigioni = [] } = useQuery({
    queryKey: ["provvigioni", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provvigioni_generate")
        .select("*, profiles(nome, cognome)")
        .eq("titolo_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Admin anagrafica id (Consulbrokers SPA / casa madre) — dynamic from settings
  const { data: adminAnagraficaId } = useQuery({
    queryKey: ["admin_anagrafica_id"],
    queryFn: async () => {
      const { data } = await supabase
        .from("impostazioni_sistema")
        .select("valore_json")
        .eq("chiave", "admin_anagrafica_id")
        .maybeSingle();
      return (data?.valore_json as { anagrafica_id?: string | null } | null)?.anagrafica_id ?? null;
    },
  });

  const { data: riparto = [] } = useQuery({
    queryKey: ["riparto", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dettaglio_riparto")
        .select("*, compagnie(nome, codice)")
        .eq("titolo_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: coassCompagnie = [] } = useQuery<any[]>({
    queryKey: ["coass-compagnie-labels"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("compagnie")
        .select("id, nome, codice, tipo, gruppo_compagnia_id")
        .eq("attivo", true);
      return (data || []) as any[];
    },
    staleTime: 60_000,
  });

  const { data: coassGruppi = [] } = useQuery({
    queryKey: ["coass-gruppi-labels"],
    queryFn: async () => {
      const { data } = await supabase.from("gruppi_compagnia").select("id, nome, codice, descrizione");
      return data || [];
    },
    staleTime: 60_000,
  });

  const { data: appendiciPolizza = [] } = useQuery({
    queryKey: ["appendici-polizza", id],
    queryFn: () => fetchAppendiciPolizzaForTitolo(supabase, id!),
    enabled: !!id,
  });

  // Numeri polizza storici (sostituzione/sospensione/riattivazione con cambio numero)
  const { data: numeriStorici = [] } = useQuery({
    queryKey: ["titoli-numeri-storici", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("titoli_numeri_storici")
        .select("*")
        .eq("titolo_id", id!)
        .order("cambiato_il", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  // Catena polizza: madre + quietanze + appendici (per banner + pannello "Quietanze")
  const numeroTitolo = titolo?.numero_titolo || null;
  const numeroTitoloCatena = titolo && numeroTitolo
    ? (isAppendice(titolo as any) ? baseNumeroPolizza(numeroTitolo) : numeroTitolo)
    : null;
  const { data: catenaTitoli = [] } = useQuery({
    queryKey: ["catena-titoli", numeroTitoloCatena],
    queryFn: async () => {
      const base = numeroTitoloCatena!;
      const selectCols =
        "id, numero_titolo, riga, sostituisce_polizza, garanzia_da, garanzia_a, premio_lordo, stato, data_messa_cassa, created_at, coassicurazione, is_appendice_modifica, is_proroga, is_regolazione, libro_matricola";
      const [exact, suffixed] = await Promise.all([
        supabase.from("titoli").select(selectCols).eq("numero_titolo", base),
        supabase.from("titoli").select(selectCols).like("numero_titolo", `${base}/%`),
      ]);
      const seen = new Set<string>();
      const merged: any[] = [];
      for (const row of [...(exact.data || []), ...(suffixed.data || [])]) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        merged.push(row);
      }
      merged.sort((a, b) => {
        const da = a.garanzia_da || a.created_at || "";
        const db = b.garanzia_da || b.created_at || "";
        return String(da).localeCompare(String(db));
      });
      return merged;
    },
    enabled: !!numeroTitoloCatena,
  });

  const libroMatricolaOwnerId = useMemo(() => {
    if (!titolo) return null;
    if (!(titolo as any).sostituisce_polizza) return titolo.id;
    const m = (catenaTitoli || []).find(
      (x: any) =>
        !x.sostituisce_polizza &&
        !x.is_regolazione &&
        !x.is_proroga &&
        !x.is_appendice_modifica,
    );
    return m?.id ?? null;
  }, [titolo, catenaTitoli]);

  const isLibroMatricolaTitolo = useMemo(() => {
    const flag = (v: unknown) => typeof v === "string" && v.length > 0 && v !== "no";
    if (flag((titolo as any)?.libro_matricola)) return true;
    const m = (catenaTitoli || []).find((x: any) => x.id === libroMatricolaOwnerId);
    return flag(m?.libro_matricola);
  }, [titolo, catenaTitoli, libroMatricolaOwnerId]);

  const { data: mezziMatricolaDb = [], refetch: refetchMezziMatricola } = useQuery({
    queryKey: ["libro-matricola-mezzi", libroMatricolaOwnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("libro_matricola_mezzi")
        .select("*")
        .eq("titolo_id", libroMatricolaOwnerId!)
        .order("n_progressivo", { ascending: true, nullsFirst: false })
        .order("data_inclusione", { ascending: true })
        .order("targa", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!libroMatricolaOwnerId && isLibroMatricolaTitolo,
  });

  // Allinea riparto coass su quietanze con madre coassicurata (se mancante o incompleto)
  useEffect(() => {
    if (!id || !titolo) return;
    const catene = catenaTitoli?.length ? groupTitoliByPolizza(catenaTitoli) : [];
    const catena = catene.find((c) => (c.all || []).some((x) => x.id === titolo.id));
    const madreRow = catena?.madre;
    const needsCoass = !!(titolo.coassicurazione || madreRow?.coassicurazione);
    if (!needsCoass) return;
    if ((riparto || []).length >= 2) return;

    let cancelled = false;
    (async () => {
      const { error } = await (supabase.rpc as any)("sync_riparto_coassicurazione_titolo", {
        p_titolo_id: id,
      });
      if (!cancelled && !error) {
        queryClient.invalidateQueries({ queryKey: ["riparto", id] });
        queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, titolo, catenaTitoli, riparto, queryClient]);

  // Quietanza madre della regolazione (se il titolo corrente è una RG)
  const madreQuietanzaId: string | null = (titolo as any)?.is_regolazione
    ? (titolo as any).regolazione_quietanza_id || null
    : null;
  const { data: madreQuietanza } = useQuery({
    queryKey: ["madre-quietanza", madreQuietanzaId],
    enabled: !!madreQuietanzaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("titoli")
        .select("id, numero_titolo, garanzia_da, garanzia_a, sostituisce_polizza, riga")
        .eq("id", madreQuietanzaId!)
        .maybeSingle();
      return data;
    },
  });

  // Regolazioni collegate al titolo corrente (visualizzate sul titolo madre)
  const { data: regolazioniCollegate = [] } = useQuery({
    queryKey: ["regolazioni-collegate", id],
    enabled: !!id && !(titolo as any)?.is_regolazione && !(titolo as any)?.is_proroga && !(titolo as any)?.is_appendice_modifica,
    queryFn: async () => {
      const { data } = await supabase
        .from("titoli")
        .select("id, numero_titolo, premio_lordo, premio_netto, provvigioni_firma, stato, data_messa_cassa, garanzia_da, garanzia_a, created_at")
        .eq("regolazione_quietanza_id", id!)
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  const { data: prorogheCollegate = [] } = useQuery({
    queryKey: ["proroghe-collegate", id],
    enabled: !!id && !(titolo as any)?.is_regolazione && !(titolo as any)?.is_proroga && !(titolo as any)?.is_appendice_modifica,
    queryFn: async () => {
      const { data } = await supabase
        .from("titoli")
        .select("id, numero_titolo, premio_lordo, premio_netto, provvigioni_firma, stato, data_messa_cassa, garanzia_da, garanzia_a, created_at")
        .eq("proroga_polizza_madre_id", id!)
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  const madreProrogaId: string | null = (titolo as any)?.is_proroga
    ? (titolo as any).proroga_polizza_madre_id || null
    : null;
  const { data: madreProroga } = useQuery({
    queryKey: ["madre-proroga", madreProrogaId],
    enabled: !!madreProrogaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("titoli")
        .select("id, numero_titolo, garanzia_a, data_scadenza")
        .eq("id", madreProrogaId!)
        .maybeSingle();
      return data;
    },
  });

  // Stato del contratto (tabella `polizze`) — separato dallo stato della quietanza (titoli.stato).
  // Nel nuovo modello la polizza NON viene mai messa a cassa: lo è la quietanza.
  const polizzaIdLookup = (titolo as any)?.polizza_id || null;
  const { data: polizzaStato } = useQuery({
    queryKey: ["polizza-stato", polizzaIdLookup],
    enabled: !!polizzaIdLookup,
    queryFn: async () => {
      const { data } = await supabase
        .from("polizze")
        .select("stato")
        .eq("id", polizzaIdLookup!)
        .maybeSingle();
      return (data as any)?.stato as string | null;
    },
  });




  // --- Cassa dialog state ---
  const [cassaDialogOpen, setCassaDialogOpen] = useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [cassaForm, setCassaForm] = useState({ dataMessaCassa: todayStr, dataPagamento: todayStr, dataDecorrenza: todayStr, tipoPagamento: "", banca: "" });


  // --- Regolazione edit state ---
  const [editingReg, setEditingReg] = useState(false);
  const [regForm, setRegForm] = useState({
    regolazione: false,
    regolazione_date_presunte: [] as string[],
    regolazione_note: "",
  });
  const [regRighe, setRegRighe] = useState<RegolazioneFattoreRiga[]>([]);

  // --- Commerciale split state (multi-produttore) ---
  type SplitRow = {
    id?: string;
    anagrafica_commerciale_id: string | null;
    commerciale_user_id: string | null;
    percentuale: number;
  };
  const [editingComm, setEditingComm] = useState(false);
  const [splitsForm, setSplitsForm] = useState<SplitRow[]>([]);
  // Flag: provvigioni produttore personalizzate solo per questa quietanza (escluse dal sync madre)
  const [splitPersonalizzatoForm, setSplitPersonalizzatoForm] = useState(false);
  // AE (Account Executive) — secondo intermediario provvigionato, indipendente dai Produttori
  const [aeForm, setAeForm] = useState<{ ae_anagrafica_id: string | null; percentuale_ae: number }>({
    ae_anagrafica_id: null, percentuale_ae: 0,
  });
  // AE: lista globale, indipendente dalla Sede del titolo
  const { data: aeLookupData } = useAccountExecutivesLookup();
  const aeLookup = aeLookupData?.options ?? [];

  const { data: anagraficheComm = [] } = useQuery({
    queryKey: ["anagrafiche-commerciali"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anagrafiche_professionali")
        .select("id, ragione_sociale, cognome, nome, percentuale_base, tipo")
        .eq("attivo", true)
        .in("tipo", ["corrispondente", "account_executive", "executive", "produttore_sede"])
        .order("ragione_sociale");
      return (data || []).map((a: any) => ({
        value: a.id,
        label: a.ragione_sociale || `${a.cognome || ""} ${a.nome || ""}`.trim(),
        percentuale_base: a.percentuale_base ?? 0,
      }));
    },
    enabled: editingComm,
  });

  // Carica split correnti del titolo
  const { data: titoloSplits = [] } = useQuery({
    queryKey: ["titolo-splits", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titoli_split_commerciali")
        .select("id, anagrafica_commerciale_id, commerciale_user_id, percentuale, ordine, anagrafica:anagrafiche_professionali!titoli_split_commerciali_anagrafica_commerciale_id_fkey(id, ragione_sociale, nome, cognome, percentuale_base)")
        .eq("titolo_id", id!)
        .order("ordine", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const startEditComm = () => {
    if (titoloSplits && titoloSplits.length > 0) {
      setSplitsForm(titoloSplits.map((s: any) => ({
        id: s.id,
        anagrafica_commerciale_id: s.anagrafica_commerciale_id,
        commerciale_user_id: s.commerciale_user_id,
        percentuale: Number(s.percentuale) || 0,
      })));
    } else if (titolo && titolo.anagrafica_commerciale_id) {
      setSplitsForm([{
        anagrafica_commerciale_id: titolo.anagrafica_commerciale_id,
        commerciale_user_id: titolo.commerciale_id ?? null,
        percentuale: titolo.percentuale_commerciale ?? 100,
      }]);
    } else {
      setSplitsForm([]);
    }
    setAeForm({
      ae_anagrafica_id: titolo?.ae_anagrafica_id ?? null,
      percentuale_ae: Number(titolo?.percentuale_ae) || 0,
    });
    setSplitPersonalizzatoForm(!!(titolo as any)?.split_personalizzato);
    setEditingComm(true);
  };

  const saveCommMutation = useMutation({
    mutationFn: async () => {
      const isChildQuietanza = !!titolo?.sostituisce_polizza;
      const wasPersonalizzato = !!(titolo as any)?.split_personalizzato;

      // Disattivazione del flag su una quietanza figlia → re-sync dai valori della madre
      if (isChildQuietanza && wasPersonalizzato && !splitPersonalizzatoForm) {
        assertSameTitolo(id, titolo?.id, "saveCommMutation:resync");
        const { error: flagErr } = await supabase
          .from("titoli")
          .update({ split_personalizzato: false } as any)
          .eq("id", id!);
        if (flagErr) throw flagErr;
        const { error: resyncErr } = await supabase.rpc("resync_split_commerciali_from_madre", { p_child_id: id! } as any);
        if (resyncErr) throw resyncErr;
        if (titolo?.stato === "incassato") {
          await supabase.functions.invoke("calcola-provvigioni", { body: { titolo_id: id } });
        }
        return;
      }

      const cleaned = splitsForm.filter(s => s.anagrafica_commerciale_id && s.percentuale > 0);
      const sum = cleaned.reduce((acc, s) => acc + Number(s.percentuale || 0), 0);
      // Sulle quietanze figlie l'AE non è personalizzabile: usa sempre i valori del titolo
      const aeIdSave = isChildQuietanza
        ? (titolo?.ae_anagrafica_id ?? null)
        : (aeForm.ae_anagrafica_id ?? null);
      const aePerc = aeIdSave ? Math.max(0, Number(isChildQuietanza ? titolo?.percentuale_ae : aeForm.percentuale_ae) || 0) : 0;
      const sumTot = sum + aePerc;
      if (sumTot > 100.001) throw new Error(`Somma percentuali (Produttori ${sum.toFixed(2)}% + AE ${aePerc.toFixed(2)}% = ${sumTot.toFixed(2)}%) supera 100.`);
      const ids = new Set(cleaned.map(s => s.anagrafica_commerciale_id));
      if (ids.size !== cleaned.length) throw new Error("Produttori duplicati nello split.");

      const currentById = new Map<string, any>(titoloSplits.map((s: any) => [s.id, s]));
      const formIds = new Set(cleaned.filter(s => s.id).map(s => s.id!));

      const toDelete = titoloSplits.filter((s: any) => !formIds.has(s.id));
      for (const s of toDelete) {
        const { error } = await supabase.from("titoli_split_commerciali").delete().eq("id", s.id);
        if (error) throw error;
      }

      for (let i = 0; i < cleaned.length; i++) {
        const s = cleaned[i];
        if (s.id) {
          const cur = currentById.get(s.id);
          if (!cur) continue;
          if (Number(cur.percentuale) !== Number(s.percentuale)
              || cur.anagrafica_commerciale_id !== s.anagrafica_commerciale_id
              || cur.commerciale_user_id !== s.commerciale_user_id
              || cur.ordine !== i) {
            const { error } = await supabase
              .from("titoli_split_commerciali")
              .update({
                anagrafica_commerciale_id: s.anagrafica_commerciale_id,
                commerciale_user_id: s.commerciale_user_id,
                percentuale: s.percentuale,
                ordine: i,
              })
              .eq("id", s.id);
            if (error) throw error;
          }
        } else {
          const { error } = await supabase
            .from("titoli_split_commerciali")
            .insert({
              titolo_id: id!,
              anagrafica_commerciale_id: s.anagrafica_commerciale_id,
              commerciale_user_id: s.commerciale_user_id,
              percentuale: s.percentuale,
              ordine: i,
            });
          if (error) throw error;
        }
      }

      // Sync legacy fields su titoli (primo split = principale)
      const primary = cleaned[0];
      let nomeLeggibile: string | null = null;
      if (primary?.anagrafica_commerciale_id) {
        const sel = anagraficheComm.find((a: any) => a.value === primary.anagrafica_commerciale_id);
        nomeLeggibile = sel?.label || null;
      }
      assertSameTitolo(id, titolo?.id, "saveCommMutation");
      const { error: tErr } = await supabase
        .from("titoli")
        .update({
          anagrafica_commerciale_id: primary?.anagrafica_commerciale_id ?? null,
          commerciale_id: primary?.commerciale_user_id ?? null,
          percentuale_commerciale: primary?.percentuale ?? null,
          produttore_nome: nomeLeggibile,
          ae_anagrafica_id: aeIdSave,
          ae_nome: (() => {
            if (!aeIdSave) return null;
            const a = (aeLookup || []).find((x: any) => x.value === aeIdSave);
            return a ? a.label : (titolo?.ae_nome ?? null);
          })(),
          percentuale_ae: aePerc,
          // Il flag ha effetto solo sulle quietanze figlie; sulla madre resta false
          split_personalizzato: isChildQuietanza ? splitPersonalizzatoForm : false,
        } as any)
        .eq("id", id!);
      if (tErr) throw tErr;

      const isMadre =
        !titolo?.sostituisce_polizza &&
        !(titolo as any)?.is_regolazione &&
        !(titolo as any)?.is_proroga &&
        !(titolo as any)?.is_appendice_modifica;
      if (isMadre) {
        const { error: syncErr } = await supabase.rpc("sync_split_commerciali_to_children", { p_madre_id: id! });
        if (syncErr) throw syncErr;
      }

      if (titolo?.stato === "incassato") {
        await supabase.functions.invoke("calcola-provvigioni", { body: { titolo_id: id } });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      queryClient.invalidateQueries({ queryKey: ["titolo-splits", id] });
      queryClient.invalidateQueries({ queryKey: ["provvigioni", id] });
      const wasPersonalizzato = !!(titolo as any)?.split_personalizzato;
      const isChild = !!titolo?.sostituisce_polizza;
      if (isChild && wasPersonalizzato && !splitPersonalizzatoForm) {
        toast.success("Split ripristinati dalla polizza madre");
      } else {
        toast.success("Split commerciali aggiornati");
      }
      setEditingComm(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: titoloRegolazioneFattori = [] } = useQuery({
    queryKey: ["titolo-regolazione-fattori", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titoli_regolazione_fattori")
        .select("id, fattore_id, ramo_id, importo_esposto, anno, data_presunta, note, fattori_regolazione(id, codice, descrizione)")
        .eq("titolo_id", id!)
        .order("anno");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const regolazioneRamoIdDetail = titolo?.ramo_id ?? null;

  const { data: fattoriRegolazioneStandardDetail = [], isLoading: loadingFattoriStdDetail } = useQuery({
    queryKey: ["fattori-regolazione-standard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fattori_regolazione")
        .select("id, codice, descrizione, attivo")
        .in("codice", [...FATTORI_REGOLAZIONE_STANDARD_CODICI])
        .eq("attivo", true);
      if (error) throw error;
      const byCodice = new Map((data ?? []).map((f: any) => [f.codice as string, f]));
      return FATTORI_REGOLAZIONE_STANDARD.map((s) => {
        const f = byCodice.get(s.codice);
        if (!f) return null;
        return {
          id: f.id as string,
          codice: f.codice as string,
          descrizione: (f.descrizione as string) || s.descrizione,
        };
      }).filter(Boolean) as Array<{ id: string; codice: string; descrizione: string }>;
    },
    enabled: editingReg || !!titolo?.regolazione,
  });

  const { data: regolazioneFattoriCustomDetail = [], isLoading: loadingRegFattoriCustomDetail } = useQuery({
    queryKey: ["sottoramo-fattori-attivi", regolazioneRamoIdDetail],
    queryFn: async () => {
      if (!regolazioneRamoIdDetail) return [];
      const { data, error } = await supabase
        .from("sottoramo_fattori_regolazione")
        .select("fattore_id, fattori_regolazione(id, codice, descrizione, attivo)")
        .eq("ramo_id", regolazioneRamoIdDetail)
        .eq("attivo", true);
      if (error) throw error;
      return (data ?? [])
        .map((row: any) => row.fattori_regolazione)
        .filter((f: any) => f && f.attivo !== false)
        .map((f: any) => ({
          id: f.id as string,
          codice: f.codice as string,
          descrizione: f.descrizione as string,
        }));
    },
    enabled: !!regolazioneRamoIdDetail && (editingReg || !!titolo?.regolazione),
  });

  const regolazioneFattoriLinkedDetail = useMemo(
    () => mergeFattoriRegolazione(fattoriRegolazioneStandardDetail, regolazioneFattoriCustomDetail),
    [fattoriRegolazioneStandardDetail, regolazioneFattoriCustomDetail],
  );
  const loadingRegFattoriDetail = loadingFattoriStdDetail || loadingRegFattoriCustomDetail;

  const startEditReg = () => {
    if (titolo) {
      const arr = Array.isArray((titolo as any).regolazione_date_presunte)
        ? ([...(titolo as any).regolazione_date_presunte] as string[])
        : ((titolo as any).regolazione_data_presunta
            ? [(titolo as any).regolazione_data_presunta as string]
            : []);
      setRegForm({
        regolazione: titolo.regolazione ?? false,
        regolazione_date_presunte: arr,
        regolazione_note: (titolo as any).regolazione_note ?? "",
      });
      setRegRighe(
        buildRegolazioneFattoriRows({
          existing: (titoloRegolazioneFattori as any[]).map((r) => ({
            fattore_id: r.fattore_id,
            anno: r.anno,
            importo_esposto: Number(r.importo_esposto) || 0,
            data_presunta: r.data_presunta,
          })),
          fattori: regolazioneFattoriLinkedDetail,
        }),
      );
    }
    setEditingReg(true);
  };

  const autoFillRegDatePresunte = () => {
    if (!titolo) return;
    const dates = computeRegolazioneDatePresunte({
      durataDa: titolo.durata_da,
      garanziaDa: titolo.garanzia_da,
      anniDurata: titolo.anni_durata ?? 1,
    });
    if (dates.length) {
      setRegForm((p) => ({ ...p, regolazione_date_presunte: dates }));
    } else {
      toast.error("Imposta durata da / garanzia da e anni durata per calcolare le date");
    }
  };

  const saveRegMutation = useMutation({
    mutationFn: async () => {
      assertSameTitolo(id, titolo?.id, "saveRegMutation");
      const dates = regForm.regolazione
        ? regForm.regolazione_date_presunte.filter(Boolean)
        : [];
      const firstCodice = regForm.regolazione && regRighe[0]
        ? (regolazioneFattoriLinkedDetail.find((f) => f.id === regRighe[0].fattore_id)?.codice
            ?? regRighe[0].fattore_codice
            ?? null)
        : null;
      const { error } = await supabase
        .from("titoli")
        .update({
          regolazione: regForm.regolazione,
          regolazione_date_presunte: regForm.regolazione
            ? (dates.length ? dates : null)
            : null,
          regolazione_data_presunta: regForm.regolazione
            ? (dates[0] || null)
            : null,
          regolazione_fattore: regForm.regolazione ? firstCodice : null,
          regolazione_note: regForm.regolazione ? (regForm.regolazione_note || null) : null,
        } as any)
        .eq("id", id!);
      if (error) throw error;

      // Replace: cancella sempre, reinserisci solo le righe esplicite in lista
      const { error: delErr } = await supabase
        .from("titoli_regolazione_fattori")
        .delete()
        .eq("titolo_id", id!);
      if (delErr) throw delErr;

      if (regForm.regolazione && regRighe.length > 0) {
        if (!regolazioneRamoIdDetail) {
          throw new Error("Seleziona il sottoramo della polizza per salvare i fattori di regolazione");
        }
        const insertRows = rowsToInsertPayload(id!, regolazioneRamoIdDetail, regRighe);
        const { error: insErr } = await supabase
          .from("titoli_regolazione_fattori")
          .insert(insertRows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      queryClient.invalidateQueries({ queryKey: ["titolo-regolazione-fattori", id] });
      toast.success("Regolazione aggiornata");
      setEditingReg(false);
    },
    onError: (e: any) => toast.error(e.message),
  });


  // --- Contratto edit state ---
  const [editingContratto, setEditingContratto] = useState(false);
  const [contrattoForm, setContrattoForm] = useState({
    cig_rif: "",
    cig_temporaneo: false,
    vincolo: "" as string,
    vincolo_attivo: false,
    descrizione_polizza: "",
    prodotto_nome: "",
    note: "",
    numero_titolo: "",
    compagnia_id: "" as string | null,
    gruppo_compagnia_id: "" as string | null,
    compagnia_rapporto_id: "" as string | null,
    ramo_id: "" as string | null,
    gruppo_ramo_id: null as string | null,
  });
  const [cigTemporaneoLoading, setCigTemporaneoLoading] = useState(false);

  const generaCigTemporaneo = useCallback(async () => {
    setCigTemporaneoLoading(true);
    try {
      const { data, error } = await supabase.rpc("next_cig_temporaneo");
      if (error) throw error;
      const num = String(data || "").trim();
      if (!num) throw new Error("CIG temporaneo vuoto");
      setContrattoForm((p) => ({ ...p, cig_rif: num }));
      return num;
    } catch (e: any) {
      toast.error(e?.message || "Impossibile generare il CIG temporaneo");
      return null;
    } finally {
      setCigTemporaneoLoading(false);
    }
  }, []);

  const onCigTemporaneoChange = useCallback(async (checked: boolean) => {
    setContrattoForm((p) => ({ ...p, cig_temporaneo: checked }));
    if (!checked) return;
    const cig = normalizeCig(contrattoForm.cig_rif);
    if (!cig || isGeneratedCigTemporaneo(cig)) {
      const num = await generaCigTemporaneo();
      if (!num) setContrattoForm((p) => ({ ...p, cig_temporaneo: false }));
    }
  }, [contrattoForm.cig_rif, generaCigTemporaneo]);

  const { data: produttoriOpts = [] } = useQuery({
    queryKey: ["produttori-anagrafiche"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anagrafiche_professionali")
        .select("id, nome, cognome, ragione_sociale, tipo")
        .in("tipo", ["account_executive", "corrispondente", "responsabile_sede"])
        .eq("attivo", true)
        .order("cognome");
      return (data || []).map((p: any) => {
        const label = p.ragione_sociale || `${p.cognome || ""} ${p.nome || ""}`.trim();
        return { value: label, label };
      });
    },
    enabled: editingContratto,
  });

  // Compagnie + gruppi + mappa rapporti (per filtro Compagnia ↔ Agenzia, broker/pluri)
  const { data: compagnieRaw = [] } = useQuery({
    queryKey: ["agenzie-attive-titolo"],
    enabled: editingContratto,
    queryFn: async () => {
      const { data } = await supabase
        .from("compagnie")
        .select("id, nome, codice, tipo, gruppo_compagnia, gruppo_compagnia_id")
        .eq("attiva", true)
        .order("nome");
      return data || [];
    },
  });

  const { data: gruppiCompagniaList = [] } = useQuery({
    queryKey: ["gruppi-compagnia-titolo"],
    enabled: editingContratto,
    queryFn: async () => {
      const { data } = await supabase
        .from("gruppi_compagnia")
        .select("id, descrizione, codice")
        .order("descrizione");
      return data || [];
    },
  });

  // Mappa: agenzia_id (broker/pluri) -> set di gruppi compagnia con cui ha rapporti attivi
  const { data: rapportiMap } = useQuery({
    queryKey: ["compagnia-rapporti-map-titolo"],
    enabled: editingContratto,
    queryFn: async () => {
      const { data } = await supabase
        .from("compagnia_rapporti")
        .select("compagnia_id, gruppo_compagnia_id")
        .eq("attivo", true);
      const m = new Map<string, string[]>();
      (data || []).forEach((r: any) => {
        if (!r.compagnia_id || !r.gruppo_compagnia_id) return;
        const arr = m.get(r.compagnia_id) || [];
        if (!arr.includes(r.gruppo_compagnia_id)) arr.push(r.gruppo_compagnia_id);
        m.set(r.compagnia_id, arr);
      });
      return m;
    },
  });

  // Lista agenzie filtrate per gruppo compagnia selezionato (logica identica a Immissione)
  const brokerPluriPerGruppo = (() => {
    if (!contrattoForm.gruppo_compagnia_id || !rapportiMap) return [] as string[];
    const out: string[] = [];
    rapportiMap.forEach((gruppi, agId) => {
      if (gruppi.includes(contrattoForm.gruppo_compagnia_id!)) out.push(agId);
    });
    return out;
  })();

  const agenziaEditSel = useMemo(
    () => (compagnieRaw || []).find((c: any) => c.id === contrattoForm.compagnia_id) as any,
    [compagnieRaw, contrattoForm.compagnia_id],
  );
  const isBrokerLikeEdit = useMemo(() => {
    const tipo = (agenziaEditSel?.tipo || "").toLowerCase();
    return tipo === "broker" || tipo === "plurimandataria";
  }, [agenziaEditSel]);

  // Rapporti attivi: per broker/pluri filtrati sul gruppo compagnia (come Immissione)
  const { data: rapportiAgenziaEdit = [] } = useQuery({
    queryKey: [
      "compagnia_rapporti_attivi_edit",
      contrattoForm.compagnia_id,
      contrattoForm.gruppo_compagnia_id,
      isBrokerLikeEdit,
    ],
    enabled:
      editingContratto &&
      !!contrattoForm.compagnia_id &&
      (!isBrokerLikeEdit || !!contrattoForm.gruppo_compagnia_id),
    queryFn: async () => {
      let q = supabase
        .from("compagnia_rapporti")
        .select("id, codice_rapporto, tipo_rapporto, gruppo_compagnia_id, attivo")
        .eq("compagnia_id", contrattoForm.compagnia_id as string)
        .eq("attivo", true);
      if (isBrokerLikeEdit && contrattoForm.gruppo_compagnia_id) {
        q = q.eq("gruppo_compagnia_id", contrattoForm.gruppo_compagnia_id);
      }
      const { data } = await q.order("codice_rapporto");
      return data || [];
    },
  });

  // Auto-seleziona rapporto se uno solo / reset se non più valido
  useEffect(() => {
    if (!editingContratto) return;
    if (!contrattoForm.compagnia_id) {
      if (contrattoForm.compagnia_rapporto_id) {
        setContrattoForm((p) => ({ ...p, compagnia_rapporto_id: null }));
      }
      return;
    }
    if (isBrokerLikeEdit && !contrattoForm.gruppo_compagnia_id) {
      if (contrattoForm.compagnia_rapporto_id) {
        setContrattoForm((p) => ({ ...p, compagnia_rapporto_id: null }));
      }
      return;
    }
    const list = rapportiAgenziaEdit || [];
    if (list.length === 1 && contrattoForm.compagnia_rapporto_id !== list[0].id) {
      setContrattoForm((p) => ({ ...p, compagnia_rapporto_id: list[0].id }));
    } else if (list.length === 0 && contrattoForm.compagnia_rapporto_id) {
      setContrattoForm((p) => ({ ...p, compagnia_rapporto_id: null }));
    } else if (
      list.length >= 2 &&
      contrattoForm.compagnia_rapporto_id &&
      !list.find((r: any) => r.id === contrattoForm.compagnia_rapporto_id)
    ) {
      setContrattoForm((p) => ({ ...p, compagnia_rapporto_id: null }));
    }
  }, [
    rapportiAgenziaEdit,
    contrattoForm.compagnia_id,
    contrattoForm.gruppo_compagnia_id,
    contrattoForm.compagnia_rapporto_id,
    editingContratto,
    isBrokerLikeEdit,
  ]);

  const startEditContratto = () => {
    if (titolo) {
      const t: any = titolo;
      const vincoloVal = (t.vincolo || (t.vincolo_attivo ? "altro" : "")) as string;
      const tipoAg = (t.compagnia_diretta?.tipo || "").toLowerCase();
      const isBroker = tipoAg === "broker" || tipoAg === "plurimandataria";
      // Compagnia assicurativa = gruppo da rapporto (broker) oppure da anagrafica agenzia
      const gruppoFromRapporto = t.compagnia_rapporto?.gruppo_compagnia_id ?? null;
      const gruppoFromAgenzia = t.compagnia_diretta?.gruppo_compagnia_id ?? null;
      setContrattoForm({
        cig_rif: t.cig_rif ?? "",
        cig_temporaneo: !!t.cig_temporaneo,
        vincolo: vincoloVal,
        vincolo_attivo: !!t.vincolo_attivo,
        descrizione_polizza: t.descrizione_polizza ?? "",
        prodotto_nome: t.prodotto_nome ?? "",
        note: t.note ?? "",
        numero_titolo: t.numero_titolo ?? "",
        compagnia_id: t.compagnia_id ?? null,
        gruppo_compagnia_id: (isBroker ? gruppoFromRapporto : null) || gruppoFromAgenzia || gruppoFromRapporto,
        compagnia_rapporto_id: t.compagnia_rapporto_id ?? null,
        ramo_id: t.ramo_id ?? null,
        gruppo_ramo_id: t.ramo?.gruppo_ramo_id ?? null,
      });
    }
    setEditingContratto(true);
  };

  const saveContrattoMutation = useMutation({
    mutationFn: async () => {
      // Compute diff vs current titolo for activity log
      const before: Record<string, any> = {};
      const after: Record<string, any> = {};
      const vincoloAttivo = !!contrattoForm.vincolo && contrattoForm.vincolo !== "nessuno";

      if (!contrattoForm.gruppo_compagnia_id) {
        throw new Error("Seleziona la Compagnia Assicurativa");
      }
      if (!contrattoForm.compagnia_id) {
        throw new Error("Seleziona l'Agenzia di Riferimento");
      }

      const ag = (compagnieRaw || []).find((c: any) => c.id === contrattoForm.compagnia_id) as any;
      const tipoAg = (ag?.tipo || "").toLowerCase();
      const isBroker = tipoAg === "broker" || tipoAg === "plurimandataria";

      // Risolvi rapporto coerente con gruppo compagnia (come ImmissionePolizzaPage).
      // Per broker/pluri: sempre query DB sul gruppo scelto, mai riusare un rapporto stale.
      // Per agenzie/direzioni: compagnia_rapporto_id = null (gruppo da anagrafica agenzia).
      let rapportoId: string | null = null;
      let rapportoSel: any = null;

      if (isBroker) {
        const { data: rapRows, error: rapErr } = await supabase
          .from("compagnia_rapporti")
          .select("id, codice_rapporto, tipo_rapporto, gruppo_compagnia_id, attivo")
          .eq("compagnia_id", contrattoForm.compagnia_id)
          .eq("gruppo_compagnia_id", contrattoForm.gruppo_compagnia_id)
          .eq("attivo", true)
          .order("codice_rapporto");
        if (rapErr) throw rapErr;
        const list = rapRows || [];
        if (list.length === 0) {
          throw new Error(
            "Nessun rapporto attivo tra questa agenzia e la Compagnia Assicurativa selezionata",
          );
        }
        const pickedId = contrattoForm.compagnia_rapporto_id || null;
        if (list.length >= 2 && !pickedId) {
          throw new Error("Seleziona il Rapporto Agenzia (più rapporti per questa compagnia)");
        }
        if (pickedId && !list.some((r: any) => r.id === pickedId)) {
          throw new Error("Il Rapporto Agenzia non corrisponde alla Compagnia Assicurativa selezionata");
        }
        rapportoSel = (pickedId ? list.find((r: any) => r.id === pickedId) : null) || list[0];
        rapportoId = rapportoSel.id;
      } else if (
        contrattoForm.compagnia_id &&
        (rapportiAgenziaEdit || []).length >= 2 &&
        !contrattoForm.compagnia_rapporto_id
      ) {
        throw new Error("Seleziona il Rapporto Agenzia (l'agenzia ha più rapporti attivi)");
      }

      const fieldsForLog: { key: string; newVal: any }[] = [
        { key: "cig_rif", newVal: contrattoForm.cig_rif || null },
        { key: "vincolo", newVal: contrattoForm.vincolo || null },
        { key: "vincolo_attivo", newVal: vincoloAttivo },
        { key: "descrizione_polizza", newVal: contrattoForm.descrizione_polizza || null },
        { key: "prodotto_nome", newVal: contrattoForm.prodotto_nome || null },
        { key: "note", newVal: contrattoForm.note.trim() || null },
        { key: "compagnia_id", newVal: contrattoForm.compagnia_id || null },
        { key: "compagnia_rapporto_id", newVal: rapportoId },
        { key: "ramo_id", newVal: contrattoForm.ramo_id || null },
      ];
      fieldsForLog.forEach(({ key, newVal }) => {
        const oldV = (titolo as any)?.[key] ?? null;
        if (oldV !== newVal) { before[key] = oldV; after[key] = newVal; }
      });
      if (contrattoForm.gruppo_compagnia_id) {
        after.gruppo_compagnia_id = contrattoForm.gruppo_compagnia_id;
      }

      assertSameTitolo(id, titolo?.id, "saveContrattoMutation");

      // N° polizza: solo se non locked; aggiorna tutta la catena (non la singola riga)
      const lockedNow =
        !!(titolo as any)?.data_messa_cassa ||
        (titolo as any)?.stato === "incassato" ||
        (titolo as any)?.stato === "stornato";
      const numeroNuovo = (contrattoForm.numero_titolo || "").trim();
      const numeroCorrente = ((titolo as any)?.numero_titolo || "").trim();
      if (!lockedNow && numeroNuovo !== numeroCorrente) {
        if (!numeroNuovo) {
          throw new Error("Il N° Polizza è obbligatorio");
        }
        const dup = await verificaNumeroPolizzaDuplicato(supabase, {
          numeroTitolo: numeroNuovo,
          compagniaId: (contrattoForm.compagnia_id || (titolo as any)?.compagnia_id) || null,
          excludeTitoloId: titolo?.id,
        });
        if (dup.duplicato) {
          throw new Error(`Numero polizza già presente: ${numeroNuovo}`);
        }
        await aggiornaNumeroPolizza({
          titoloId: titolo!.id,
          numeroCorrente,
          numeroNuovo,
          causale: "emittenda",
          motivo: "Cambio numero polizza",
        });
        before.numero_titolo = numeroCorrente;
        after.numero_titolo = numeroNuovo;
      }

      const { error } = await supabase
        .from("titoli")
        .update({
          cig_rif: contrattoForm.cig_rif || null,
          vincolo: contrattoForm.vincolo || null,
          vincolo_attivo: vincoloAttivo,
          descrizione_polizza: contrattoForm.descrizione_polizza || null,
          prodotto_nome: contrattoForm.prodotto_nome || null,
          note: contrattoForm.note.trim() || null,
          compagnia_id: contrattoForm.compagnia_id || null,
          compagnia_rapporto_id: isBroker ? rapportoId : null,
          codice_rapporto: isBroker ? (rapportoSel?.codice_rapporto || null) : null,
          ramo_id: contrattoForm.ramo_id || null,
        })
        .eq("id", id!);
      if (error) throw error;

      if (Object.keys(after).length > 0) {
        await logAttivita({
          azione: "modifica_contratto",
          entita_tipo: "titolo",
          entita_id: id!,
          dettagli_json: { campi_modificati: Object.keys(after), before, after },
          severity: "info",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      queryClient.invalidateQueries({ queryKey: ["timeline", "titolo", id] });
      queryClient.invalidateQueries({ queryKey: ["catena-titoli"] });
      toast.success("Contratto aggiornato");
      setEditingContratto(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // --- Periodo edit state ---
  const [editingPeriodo, setEditingPeriodo] = useState(false);
  const [periodoForm, setPeriodoForm] = useState({
    durata_da: "" as string,
    durata_a: "" as string,
    anni_durata: "" as string,
    rate: "" as string,
    frazionamento: "Annuale" as string,
    garanzia_da: "" as string,
    garanzia_a: "" as string,
    data_competenza: "" as string,
    data_scadenza: "" as string,
    limite_mora: "" as string,
    mora_giorni: "" as string,
    tacito_rinnovo: true as boolean,
    riforma_alla_scadenza: false as boolean,
    polizza_temporanea: false as boolean,
    polizza_rateo: false as boolean,
    disdetta_giorni: "" as string,
  });

  useEffect(() => {
    if (!editingPeriodo || !periodoForm.polizza_temporanea) return;
    const synced = syncPeriodoTemporanea({
      durataDa: periodoForm.durata_da,
      durataA: periodoForm.durata_a,
    });
    setPeriodoForm((p) => {
      if (
        p.garanzia_da === synced.garanzia_da &&
        p.garanzia_a === synced.garanzia_a &&
        p.data_competenza === synced.data_competenza
      ) {
        return p;
      }
      return { ...p, ...synced };
    });
  }, [editingPeriodo, periodoForm.polizza_temporanea, periodoForm.durata_da, periodoForm.durata_a]);

  useEffect(() => {
    if (!editingPeriodo || !periodoForm.polizza_rateo || periodoForm.polizza_temporanea) return;
    const synced = syncPeriodoRateo({
      garanziaDa: periodoForm.garanzia_da,
      durataDa: periodoForm.durata_da,
      garanziaA: periodoForm.garanzia_a,
      frazionamento: periodoForm.frazionamento,
      durataATouched: true,
      currentDurataA: periodoForm.durata_a,
      anniDurata: Math.max(1, parseInt(periodoForm.anni_durata) || 1),
    });
    setPeriodoForm((p) => {
      const next = {
        ...p,
        ...(synced.garanzia_da ? { garanzia_da: synced.garanzia_da } : {}),
        data_competenza: synced.data_competenza,
        ...(synced.applyDurataA && synced.durata_a ? { durata_a: synced.durata_a } : {}),
      };
      if (
        p.garanzia_da === next.garanzia_da &&
        p.data_competenza === next.data_competenza &&
        p.durata_a === next.durata_a
      ) {
        return p;
      }
      return next;
    });
  }, [
    editingPeriodo,
    periodoForm.polizza_rateo,
    periodoForm.polizza_temporanea,
    periodoForm.garanzia_da,
    periodoForm.garanzia_a,
    periodoForm.durata_da,
    periodoForm.durata_a,
    periodoForm.frazionamento,
    periodoForm.anni_durata,
  ]);

  const startEditPeriodo = () => {
    if (titolo) {
      const t: any = titolo;
      setPeriodoForm({
        durata_da: t.durata_da ?? "",
        durata_a: t.durata_a ?? "",
        anni_durata: t.anni_durata != null ? String(t.anni_durata) : "",
        rate: t.rate != null ? String(t.rate) : "",
        frazionamento: t.frazionamento || derivaFrazionamentoDaRate(t.rate, t.anni_durata),
        garanzia_da: t.garanzia_da ?? "",
        garanzia_a: t.garanzia_a ?? "",
        data_competenza: t.data_competenza ?? "",
        data_scadenza: t.data_scadenza ?? "",
        mora_giorni: t.mora_giorni != null ? String(t.mora_giorni) : "",
        limite_mora: calcLimiteMora(t.garanzia_da, t.mora_giorni != null ? String(t.mora_giorni) : "") || (t.limite_mora ?? ""),
        tacito_rinnovo: t.tacito_rinnovo ?? true,
        riforma_alla_scadenza: !!t.riforma_alla_scadenza,
        polizza_temporanea: !!t.polizza_temporanea,
        polizza_rateo: !!t.polizza_rateo,
        disdetta_giorni: t.disdetta_giorni != null ? String(t.disdetta_giorni) : "",
      });
    }
    setEditingPeriodo(true);
  };

  // Auto-suggested anni_durata from durata_da/_a
  const suggestedAnniDurata = (() => {
    if (!periodoForm.durata_da || !periodoForm.durata_a) return null;
    const d1 = new Date(periodoForm.durata_da);
    const d2 = new Date(periodoForm.durata_a);
    const months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    return Math.round((months / 12) * 10) / 10;
  })();
  const isPoliennaleEdit = suggestedAnniDurata != null && suggestedAnniDurata > 1.08;

  const savePeriodoMutation = useMutation({
    mutationFn: async () => {
      // Validations
      const errs: string[] = [];
      const dDa = periodoForm.durata_da ? new Date(periodoForm.durata_da) : null;
      const dA = periodoForm.durata_a ? new Date(periodoForm.durata_a) : null;
      const gDa = periodoForm.garanzia_da ? new Date(periodoForm.garanzia_da) : null;
      const gA = periodoForm.garanzia_a ? new Date(periodoForm.garanzia_a) : null;
      if (dDa && dA && dDa > dA) errs.push("Durata Da non può essere successiva a Durata A");
      if (gDa && gA && gDa > gA) errs.push("Garanzia Da non può essere successiva a Garanzia A");
      if (dDa && gDa && gDa < dDa) errs.push("Garanzia Da deve essere ≥ Durata Da");
      if (dA && gA && gA > dA) errs.push("Garanzia A deve essere ≤ Durata A");
      if (errs.length) throw new Error(errs.join(" • "));

      const before: Record<string, any> = {};
      const after: Record<string, any> = {};
      const fields: (keyof typeof periodoForm)[] = [
        "durata_da", "durata_a", "anni_durata", "rate", "frazionamento", "garanzia_da", "garanzia_a",
        "data_competenza", "data_scadenza", "limite_mora", "mora_giorni", "tacito_rinnovo", "riforma_alla_scadenza", "polizza_temporanea", "polizza_rateo", "disdetta_giorni",
      ];
      const numericFields = new Set(["anni_durata", "rate", "mora_giorni", "disdetta_giorni"]);
      const booleanFields = new Set(["tacito_rinnovo", "riforma_alla_scadenza", "polizza_temporanea", "polizza_rateo"]);
      if (periodoForm.polizza_temporanea) {
        periodoForm.tacito_rinnovo = false;
        periodoForm.frazionamento = "";
        periodoForm.rate = "1";
        periodoForm.anni_durata = "";
        periodoForm.polizza_rateo = false;
      } else if (periodoForm.polizza_rateo) {
        periodoForm.polizza_temporanea = false;
      } else if (periodoForm.frazionamento) {
        const anni = Number(periodoForm.anni_durata) || 1;
        periodoForm.rate = String(frazionamentoToRate(periodoForm.frazionamento, anni));
      }
      if (periodoForm.garanzia_da) {
        periodoForm.limite_mora =
          calcLimiteMora(periodoForm.garanzia_da, periodoForm.mora_giorni) || periodoForm.limite_mora;
      }
      const payload: Record<string, any> = {};
      fields.forEach((f) => {
        const raw = periodoForm[f];
        let newV: any;
        if (booleanFields.has(f as string)) {
          newV = Boolean(raw);
        } else {
          newV = raw === "" || raw == null ? null : (numericFields.has(f as string) ? Number(raw) : raw);
        }
        const oldV = titolo?.[f] ?? null;
        if (oldV !== newV) { before[f] = oldV; after[f] = newV; }
        payload[f] = newV;
      });

      assertSameTitolo(id, titolo?.id, "savePeriodoMutation");
      const { error } = await supabase.from("titoli").update(payload).eq("id", id!);
      if (error) throw error;

      if (Object.keys(after).length > 0) {
        await logAttivita({
          azione: "modifica_periodo",
          entita_tipo: "titolo",
          entita_id: id!,
          dettagli_json: { campi_modificati: Object.keys(after), before, after },
          severity: "info",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      queryClient.invalidateQueries({ queryKey: ["timeline", "titolo", id] });
      toast.success("Periodo aggiornato");
      setEditingPeriodo(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // --- Importi edit state ---
  const [editingImporti, setEditingImporti] = useState(false);
  const premiBlockRef = useRef<TitoloImportiPremiBlockHandle>(null);
  const [premiDisplayTotals, setPremiDisplayTotals] = useState<TitoloImportiPremiDisplayTotals | null>(null);
  useEffect(() => {
    setPremiDisplayTotals(null);
  }, [id]);
  const [vociRcaTotali, setVociRcaTotali] = useState<{ netto: number; tasse: number; lordo: number } | null>(null);
  const vociRcaSyncTimer = useRef<any>(null);
  const vociRcaQuietanzaTimer = useRef<any>(null);
  const [importiForm, setImportiForm] = useState({
    premio_netto: "" as string,
    addizionali: "" as string,
    tasse: "" as string,
    premio_lordo: "" as string,
    provvigioni_firma: "" as string,
    brokeraggio_firma: "" as string,
    premio_netto_quietanza: "" as string,
    addizionali_quietanza: "" as string,
    tasse_quietanza: "" as string,
    provvigioni_quietanza: "" as string,
    brokeraggio_quietanza: "" as string,
    percentuale_brokeraggio: "" as string,
    valuta: "EUR" as string,
    cambio: "" as string,
    indicizzata: false as boolean,
    rimborso: false as boolean,
  });
  const [lordoFirmaTouched, setLordoFirmaTouched] = useState(false);

  // Helper: ricalcola lordo firma da netto+add+tasse
  const recalcLordoFirma = (netto: string, addiz: string, tasse: string) => {
    const n = parseFloat(netto);
    const a = parseFloat(addiz);
    const t = parseFloat(tasse);
    if (isNaN(n) && isNaN(a) && isNaN(t)) return "";
    return ((isNaN(n) ? 0 : n) + (isNaN(a) ? 0 : a) + (isNaN(t) ? 0 : t)).toFixed(2);
  };

  const valutaOpts = [
    { value: "EUR", label: "EUR €" },
    { value: "USD", label: "USD $" },
    { value: "GBP", label: "GBP £" },
    { value: "CHF", label: "CHF" },
  ];

  const [importoFirmaOpen, setImportoFirmaOpen] = useState(false);
  const [importoFirmaForm, setImportoFirmaForm] = useState<VociImportoFirma>({
    netto: 0,
    tasse: 0,
    ssn: 0,
    addizionali: 0,
  });
  const [importoFirmaLordo, setImportoFirmaLordo] = useState("");

  const openImportoFirma = () => {
    const row: any = titolo;
    const voci: VociImportoFirma = {
      netto: Number(row?.premio_netto) || 0,
      tasse: Number(row?.tasse) || 0,
      ssn: Number(row?.ssn_firma) || 0,
      addizionali: Number(row?.addizionali) || 0,
    };
    setImportoFirmaForm(voci);
    setImportoFirmaLordo(String(lordoFirmaDaVoci(voci) || Number(row?.premio_lordo) || 0));
    setImportoFirmaOpen(true);
  };

  const saveImportoFirmaMutation = useMutation({
    mutationFn: async () => {
      if (!id || !titolo) throw new Error("Titolo non disponibile");
      const payload = payloadImportoFirma(importoFirmaForm);
      assertSameTitolo(id, titolo.id, "saveImportoFirmaMutation");
      const { error } = await supabase.from("titoli").update(payload).eq("id", id);
      if (error) throw error;
      await logAttivita({
        azione: "modifica_importo_firma",
        entita_tipo: "titolo",
        entita_id: id,
        dettagli_json: { before: { premio_lordo: titolo.premio_lordo }, after: payload },
        severity: "info",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      queryClient.invalidateQueries({ queryKey: ["timeline", "titolo", id] });
      toast.success("Importo firma aggiornato");
      setImportoFirmaOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Impossibile salvare l'importo firma"),
  });

  const startEditImporti = () => {
    if (titolo) {
      const t: any = titolo;
      setImportiForm({
        premio_netto: t.premio_netto != null ? String(t.premio_netto) : "",
        addizionali: t.addizionali != null ? String(t.addizionali) : "",
        tasse: t.tasse != null ? String(t.tasse) : "",
        premio_lordo: t.premio_lordo != null ? String(t.premio_lordo) : "",
        provvigioni_firma: t.provvigioni_firma != null ? String(t.provvigioni_firma) : "",
        brokeraggio_firma: t.brokeraggio_firma != null ? String(t.brokeraggio_firma) : "",
        premio_netto_quietanza: t.premio_netto_quietanza != null ? String(t.premio_netto_quietanza) : "",
        addizionali_quietanza: t.addizionali_quietanza != null ? String(t.addizionali_quietanza) : "",
        tasse_quietanza: t.tasse_quietanza != null ? String(t.tasse_quietanza) : "",
        provvigioni_quietanza: t.provvigioni_quietanza != null ? String(t.provvigioni_quietanza) : "",
        brokeraggio_quietanza: t.brokeraggio_quietanza != null ? String(t.brokeraggio_quietanza) : "",
        percentuale_brokeraggio: t.percentuale_brokeraggio != null ? String(t.percentuale_brokeraggio) : "",
        valuta: t.valuta ?? "EUR",
        cambio: t.cambio != null ? String(t.cambio) : "",
        indicizzata: !!t.indicizzata,
        rimborso: !!t.rimborso,
      });
    }
    setLordoFirmaTouched(false);
    setEditingImporti(true);
  };

  // Auto-calculated lordo (firma) suggestion
  const suggestedLordoFirma = (() => {
    const n = parseFloat(importiForm.premio_netto);
    const a = parseFloat(importiForm.addizionali);
    const ta = parseFloat(importiForm.tasse);
    if (isNaN(n) && isNaN(a) && isNaN(ta)) return null;
    return (isNaN(n) ? 0 : n) + (isNaN(a) ? 0 : a) + (isNaN(ta) ? 0 : ta);
  })();
  const suggestedLordoQuietanza = (() => {
    const n = parseFloat(importiForm.premio_netto_quietanza);
    const a = parseFloat(importiForm.addizionali_quietanza);
    const ta = parseFloat(importiForm.tasse_quietanza);
    if (isNaN(n) && isNaN(a) && isNaN(ta)) return null;
    return (isNaN(n) ? 0 : n) + (isNaN(a) ? 0 : a) + (isNaN(ta) ? 0 : ta);
  })();

  const saveImportiMutation = useMutation({
    mutationFn: async () => {
      await premiBlockRef.current?.saveDraft();

      const numericFields = [
        "percentuale_brokeraggio",
        "brokeraggio_firma",
        "brokeraggio_quietanza",
      ] as const;

      const errs: string[] = [];
      numericFields.forEach((f) => {
        const v = importiForm[f];
        if (v !== "" && v != null) {
          const n = Number(v);
          if (isNaN(n)) errs.push(`${f}: valore non numerico`);
          else if (n < 0) errs.push(`${f}: deve essere ≥ 0`);
        }
      });
      if (errs.length) throw new Error(errs.join(" • "));

      const before: Record<string, any> = {};
      const after: Record<string, any> = {};
      const payload: Record<string, any> = {
        valuta: importiForm.valuta || "EUR",
        cambio: 1,
        indicizzata: !!importiForm.indicizzata,
        rimborso: !!importiForm.rimborso,
        percentuale_brokeraggio:
          importiForm.percentuale_brokeraggio === "" ? null : Number(importiForm.percentuale_brokeraggio),
        brokeraggio_firma:
          importiForm.brokeraggio_firma === "" ? null : Number(importiForm.brokeraggio_firma),
        brokeraggio_quietanza:
          importiForm.brokeraggio_quietanza === "" ? null : Number(importiForm.brokeraggio_quietanza),
      };

      (Object.keys(payload) as Array<keyof typeof payload>).forEach((f) => {
        const newV = payload[f];
        const oldV = titolo?.[f as string] ?? (typeof newV === "boolean" ? false : null);
        if (oldV !== newV) {
          before[f as string] = oldV;
          after[f as string] = newV;
        }
      });

      assertSameTitolo(id, titolo?.id, "saveImportiMutation");
      if (Object.keys(after).length === 0) return { autoFixes: [] as string[] };

      const { error } = await supabase.from("titoli").update(payload).eq("id", id!);
      if (error) throw error;

      await logAttivita({
        azione: "modifica_importi",
        entita_tipo: "titolo",
        entita_id: id!,
        dettagli_json: { campi_modificati: Object.keys(after), before, after },
        severity: "info",
      });

      return { autoFixes: [] as string[] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      queryClient.invalidateQueries({ queryKey: ["timeline", "titolo", id] });
      toast.success("Importi aggiornati");
      setEditingImporti(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // --- Veicolo edit state ---
  const [editingVeicolo, setEditingVeicolo] = useState(false);
  const [veicoloForm, setVeicoloForm] = useState<any>({});
  const { data: rcaUsi = [] } = useRcaUsi();
  const { data: tipiVeicoloLookup = [] } = useLookupTipologiaVeicolo();
  const TIPI_VEICOLO_OPTS = tipiVeicoloLookup.length > 0 ? tipiVeicoloLookup : TIPI_VEICOLO;
  const CLASSI_BM_OPTS = Array.from({ length: 18 }, (_, i) => ({ value: String(i + 1), label: `Classe ${i + 1}` }));
  const ALIMENTAZIONE_OPTS = ["BENZINA","DIESEL","GPL","METANO","ELETTRICA","IBRIDA","IBRIDA PLUG-IN","BIFUEL","ALTRO"].map((v) => ({ value: v, label: v }));
  const TIPOLOGIA_GUIDA_OPTS = ["LIBERA","ESPERTA"].map((v) => ({ value: v, label: v }));

  const startEditVeicolo = () => {
    const v: any = veicolo || { titolo_id: id };
    setVeicoloForm({
      settore: v.settore ?? "",
      tipo_veicolo: v.tipo_veicolo ?? "",
      uso: v.uso ?? "",
      targa: v.targa ?? "",
      marca: v.marca ?? "",
      modello: v.modello ?? "",
      versione: v.versione ?? "",
      veicolo_descrizione: v.veicolo_descrizione ?? "",
      telaio: v.telaio ?? "",
      data_immatricolazione: v.data_immatricolazione ?? "",
      anno_acquisto: v.anno_acquisto != null ? String(v.anno_acquisto) : "",
      provincia_circolazione: v.provincia_circolazione ?? "",
      classe_bm: v.classe_bm ?? "",
      massimale_1: v.massimale_1 != null ? String(v.massimale_1) : "",
      massimale_2: v.massimale_2 != null ? String(v.massimale_2) : "",
      massimale_3: v.massimale_3 != null ? String(v.massimale_3) : "",
      peius: !!v.peius,
      franchigia: v.franchigia != null ? String(v.franchigia) : "",
      temporanea: !!v.temporanea,
      carico_scarico: !!v.carico_scarico,
      rimorchio: !!v.rimorchio,
      competizione: !!v.competizione,
      cv: v.cv != null ? String(v.cv) : "",
      kw: v.kw != null ? String(v.kw) : "",
      cc: v.cc != null ? String(v.cc) : "",
      posti: v.posti != null ? String(v.posti) : "",
      peso_motrice: v.peso_motrice != null ? String(v.peso_motrice) : "",
      peso_rimorchio: v.peso_rimorchio != null ? String(v.peso_rimorchio) : "",
      peso_totale: v.peso_totale != null ? String(v.peso_totale) : "",
      tipologia_guida: v.tipologia_guida ?? "",
      tipo_alimentazione: v.tipo_alimentazione ?? "",
    });
    setEditingVeicolo(true);
  };

  const saveVeicoloMutation = useMutation({
    mutationFn: async () => {
      const intFields = ["anno_acquisto","cv","kw","cc","posti","peso_motrice","peso_rimorchio","peso_totale"];
      const numFields = ["massimale_1","massimale_2","massimale_3","franchigia"];
      const boolFields = ["peius","temporanea","carico_scarico","rimorchio","competizione"];
      const payload: any = { titolo_id: id };
      Object.keys(veicoloForm).forEach((k) => {
        const raw = veicoloForm[k];
        if (boolFields.includes(k)) payload[k] = !!raw;
        else if (intFields.includes(k)) payload[k] = raw === "" || raw == null ? null : parseInt(raw, 10);
        else if (numFields.includes(k)) payload[k] = raw === "" || raw == null ? null : Number(raw);
        else payload[k] = raw === "" ? null : raw;
      });
      // Validations
      const errs: string[] = [];
      [...intFields, ...numFields].forEach((f) => {
        if (payload[f] != null && (isNaN(payload[f]) || payload[f] < 0)) errs.push(`${f}: deve essere ≥ 0`);
      });
      if (payload.targa) payload.targa = String(payload.targa).toUpperCase().trim();
      if (payload.telaio) payload.telaio = String(payload.telaio).toUpperCase().trim();
      if (payload.telaio && payload.telaio.length !== 17) errs.push("Telaio (VIN) deve avere 17 caratteri");
      if (errs.length) throw new Error(errs.join(" • "));

      const { error } = await supabase.from("veicoli_polizza").upsert(payload, { onConflict: "titolo_id" });
      if (error) throw error;

      await logAttivita({
        azione: veicolo ? "modifica_veicolo" : "crea_veicolo",
        entita_tipo: "titolo",
        entita_id: id!,
        dettagli_json: { campi: Object.keys(veicoloForm) },
        severity: "info",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["veicolo-polizza", id] });
      queryClient.invalidateQueries({ queryKey: ["timeline", "titolo", id] });
      toast.success("Dati veicolo salvati");
      setEditingVeicolo(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // --- Premi Garanzia edit state ---
  const [editingPremi, setEditingPremi] = useState(false);
  const [premiRows, setPremiRows] = useState<any[]>([]);

  const startEditPremi = () => {
    const rows = premiGaranzia.map((p) => ({
      id: p.id,
      garanzia: p.garanzia ?? "",
      capitale: p.capitale != null ? String(p.capitale) : "",
      tasso: p.tasso != null ? String(p.tasso) : "",
      firma: p.firma != null ? String(p.firma) : "",
      rata: p.rata != null ? String(p.rata) : "",
      annuo: p.annuo != null ? String(p.annuo) : "",
      ssn: p.ssn != null ? String(p.ssn) : "",
      ordine: p.ordine ?? 0,
      _existing: true,
    }));
    setPremiRows(rows);
    setEditingPremi(true);
  };

  const addPremiRow = () => {
    setPremiRows((prev) => [
      ...prev,
      { garanzia: "", capitale: "", tasso: "", firma: "", rata: "", annuo: "", ssn: "", ordine: prev.length, _existing: false, _new: true },
    ]);
  };

  const removePremiRow = (idx: number) => {
    setPremiRows((prev) => prev.map((r, i) => (i === idx ? { ...r, _deleted: true } : r)));
  };

  const updatePremiRow = (idx: number, field: string, value: any) => {
    setPremiRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const savePremiMutation = useMutation({
    mutationFn: async () => {
      const errs: string[] = [];
      const numFields = ["capitale","tasso","firma","rata","annuo"];
      premiRows.forEach((r, i) => {
        if (r._deleted) return;
        if (!r.garanzia || !String(r.garanzia).trim()) errs.push(`Riga ${i + 1}: garanzia obbligatoria`);
        numFields.forEach((f) => {
          if (r[f] !== "" && r[f] != null) {
            const n = Number(r[f]);
            if (isNaN(n) || n < 0) errs.push(`Riga ${i + 1}: ${f} non valido`);
          }
        });
      });
      if (errs.length) throw new Error(errs.join(" • "));

      // Delete removed existing rows
      const toDelete = premiRows.filter((r) => r._deleted && r._existing).map((r) => r.id);
      if (toDelete.length) {
        const { error } = await supabase.from("premi_garanzia_polizza").delete().in("id", toDelete);
        if (error) throw error;
      }
      // Upsert remaining
      const toUpsert = premiRows
        .filter((r) => !r._deleted)
        .map((r, i) => ({
          ...(r._existing ? { id: r.id } : {}),
          titolo_id: id,
          garanzia: String(r.garanzia).trim(),
          capitale: r.capitale === "" ? null : Number(r.capitale),
          tasso: r.tasso === "" ? null : Number(r.tasso),
          firma: r.firma === "" ? null : Number(r.firma),
          rata: r.rata === "" ? null : Number(r.rata),
          annuo: r.annuo === "" ? null : Number(r.annuo),
          ssn: r.ssn === "" || r.ssn == null ? 0 : Number(r.ssn),
          ordine: i,
        }));
      if (toUpsert.length) {
        const { error } = await supabase.from("premi_garanzia_polizza").upsert(toUpsert);
        if (error) throw error;
      }

      await logAttivita({
        azione: "modifica_premi_garanzia",
        entita_tipo: "titolo",
        entita_id: id!,
        dettagli_json: { righe_totali: toUpsert.length, righe_eliminate: toDelete.length },
        severity: "info",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["premi-garanzia", id] });
      queryClient.invalidateQueries({ queryKey: ["timeline", "titolo", id] });
      toast.success("Premi per garanzia salvati");
      setEditingPremi(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const changeStatoMutation = useMutation({
    mutationFn: async (params: string | { nuovoStato: string; cassaData?: typeof cassaForm; conferimentoGestito?: boolean }) => {
      const nuovoStato = typeof params === "string" ? params : params.nuovoStato;
      const cassaData = typeof params === "string" ? undefined : params.cassaData;
      const isConferimento = typeof params !== "string" && params.conferimentoGestito;
      const vecchioStato = titolo?.stato;
      const updatePayload: any = { stato: nuovoStato, updated_at: new Date().toISOString() };
      if (nuovoStato === "incassato" && cassaData && !isConferimento) {
        const dateFields = buildIncassoDateFields(
          {
            conferimento_gestito: titolo?.conferimento_gestito,
            data_copertura: titolo?.data_copertura,
            data_messa_cassa: titolo?.data_messa_cassa,
          },
          cassaData.dataMessaCassa,
        );
        updatePayload.data_messa_cassa = dateFields.data_messa_cassa;
        updatePayload.data_incasso = dateFields.data_incasso;
        updatePayload.data_copertura = dateFields.data_copertura;
        updatePayload.data_decorrenza_rinnovo = cassaData.dataDecorrenza;
        updatePayload.data_pagamento = cassaData.dataPagamento || null;
        updatePayload.tipo_pagamento = cassaData.tipoPagamento || null;
        if (titolo?.conferimento_gestito) {
          updatePayload.fondi_ricevuti = true;
        }
        if (cassaData.tipoPagamento === "bonifico" && cassaData.banca) {
          const { data: conto } = await (supabase.from("conti_bancari") as any)
            .select("etichetta, banca").eq("id", cassaData.banca).maybeSingle();
          updatePayload.banca_pagamento = conto?.etichetta || conto?.banca || cassaData.banca;
        }
      } else if ((nuovoStato === "attivo" || nuovoStato === "annullato") && vecchioStato === "incassato") {
        // Reset dei campi messa a cassa quando si esce dallo stato 'incassato'
        updatePayload.data_messa_cassa = null;
        updatePayload.data_pagamento = null;
        updatePayload.data_decorrenza_rinnovo = null;
        updatePayload.data_incasso = null;
        updatePayload.importo_incassato = null;
        updatePayload.tipo_pagamento = null;
        updatePayload.banca_pagamento = null;
        updatePayload.conferimento_gestito = false;
        updatePayload.fondi_ricevuti = true;
        updatePayload.data_conferimento_gestito = null;
        updatePayload.data_copertura = null;
      }
      const { error } = await supabase.from("titoli").update(updatePayload).eq("id", id!);
      if (error) throw error;
      if (user) {
        await logAttivita({ azione: "cambio_stato_titolo", entita_tipo: "titolo", entita_id: id!, dettagli_json: { stato_precedente: vecchioStato, nuovo_stato: nuovoStato } });
      }
      if (nuovoStato === "incassato" && !isConferimento) {
        await supabase.functions.invoke("calcola-provvigioni", { body: { titolo_id: id } });
        // Notifica formale all'agenzia/rapporto (non bloccante, ma con feedback errore)
        invokeNotificaMessaCassa([id!])
          .then(({ data, error }) => {
            if (error) toast.warning(`Notifica messa a cassa non inviata: ${error.message ?? error}`);
            else if (data?.skipped) { /* già inviata */ }
            else if (data?.recipient) toast.success(`Notifica inviata a ${data.recipient}`);
            if (data?.documenti_archiviati) queryClient.invalidateQueries({ queryKey: ["documenti", "titolo"] });
            if (data?.archive_error) toast.warning(`Archivio PDF non creato: ${data.archive_error}`);
          })
          .catch((e) => toast.warning(`Notifica messa a cassa fallita: ${e?.message ?? e}`));
      }

      // Cerca quietanza generata automaticamente dal trigger DB
      let quietanzaGenerata: { id: string; data_decorrenza: string | null; data_scadenza: string | null } | null = null;
      if (nuovoStato === "incassato" && titolo?.numero_titolo) {
        const { data: succ } = await supabase
          .from("titoli")
          .select("id, durata_da, data_scadenza")
          .eq("sostituisce_polizza", titolo.numero_titolo)
          .eq("sostituisce_riga", titolo.riga ?? 0)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (succ) {
          quietanzaGenerata = { id: succ.id, data_decorrenza: succ.durata_da, data_scadenza: succ.data_scadenza };
        }
      }
      return { quietanzaGenerata };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      queryClient.invalidateQueries({ queryKey: ["provvigioni", id] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
      queryClient.invalidateQueries({ queryKey: ["polizze_cliente"] });
      toast.success("Stato aggiornato");
      if (res?.quietanzaGenerata) {
        const d = res.quietanzaGenerata.data_decorrenza
          ? new Date(res.quietanzaGenerata.data_decorrenza).toLocaleDateString("it-IT")
          : "";
        toast.success(
          `Quietanza successiva generata${d ? ` con decorrenza ${d}` : ""}`,
          {
            description: "Compare in Incassi del periodo target.",
            action: {
              label: "Apri",
              onClick: () => navigate(`/titoli/${res.quietanzaGenerata!.id}`),
            },
            duration: 8000,
          }
        );
      }
      setCassaDialogOpen(false);
      setConferimentoDialogOpen(false);
    },
    onError: (err: any) => toast.error(err?.message || "Errore aggiornamento stato"),
  });

  const conferimentoGestitoMutation = useMutation({
    mutationFn: async (form: {
      dataCopertura: string;
      dataDecorrenza: string;
      cig_rif: string;
      cig_temporaneo: boolean;
      updateMadre: boolean;
    }) => {
      if (!canHaveDataCopertura(titolo as any)) {
        throw new Error("La polizza madre non può avere copertura — apri la quietanza");
      }
      const ente = isClienteEnte((titolo as any)?.cliente_anagrafica);
      if (ente && isCigFormatoInvalido(form.cig_rif, form.cig_temporaneo)) {
        throw new Error("CIG definitivo non valido: 10 caratteri alfanumerici, oppure spunta Temporaneo");
      }
      const payload = buildGarantitoPayload(form);
      if (ente) {
        payload.cig_rif = normalizeCig(form.cig_rif) || null;
        payload.cig_temporaneo = !!form.cig_temporaneo;
      }
      const { error } = await supabase.from("titoli").update(payload).eq("id", id!);
      if (error) throw error;
      if (ente && form.updateMadre) {
        const madreId = await resolveTitoloMadreId(supabase, id!);
        if (madreId && madreId !== id) {
          const { error: errMadre } = await supabase
            .from("titoli")
            .update({
              cig_rif: normalizeCig(form.cig_rif) || null,
              cig_temporaneo: !!form.cig_temporaneo,
              updated_at: new Date().toISOString(),
            })
            .eq("id", madreId);
          if (errMadre) throw new Error(`Garantito ok ma CIG madre non aggiornato: ${errMadre.message}`);
        }
      }
      await (supabase.from("quietanze") as any)
        .update({ data_copertura: form.dataCopertura, updated_at: new Date().toISOString() })
        .eq("titolo_id", id!);
      if (user) {
        await logAttivita({
          azione: "conferimento_gestito",
          entita_tipo: "titolo",
          entita_id: id!,
          dettagli_json: {
            data_copertura: form.dataCopertura,
            data_decorrenza_rinnovo: form.dataDecorrenza,
            cig_rif: ente ? normalizeCig(form.cig_rif) || null : undefined,
          },
        });
      }
      const res = await scheduleOrInvokeNotificaMessaCassa([id!], {
        serale: conferimentoMessaCassaSerale,
      });
      return res;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
      queryClient.invalidateQueries({ queryKey: ["ec-agenzia-contab"] });
      queryClient.invalidateQueries({ queryKey: ["polizze_cliente"] });
      toast.success("Copertura garantita");
      handleNotificaMessaCassaOutcome(res, () => {
        queryClient.invalidateQueries({ queryKey: ["documenti", "titolo"] });
      });
      if (res.mode === "sent" && res.data?.recipient && (res.data.agenzie ?? 1) <= 1 && !res.data.archive_error && !res.error) {
        toast.success(`Notifica inviata a ${res.data.recipient}`);
      }
      setConferimentoDialogOpen(false);
    },
    onError: (err: any) => toast.error(err?.message || "Errore copertura garantita"),
  });

  const segnaFondiRicevutiMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("titoli").update({ fondi_ricevuti: true, updated_at: new Date().toISOString() }).eq("id", id!);
      if (error) throw error;
      if (user) {
        await logAttivita({ azione: "fondi_ricevuti", entita_tipo: "titolo", entita_id: id!, dettagli_json: { conferimento_gestito: true } });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      toast.success("Fondi segnati come ricevuti");
    },
    onError: () => toast.error("Errore"),
  });

  const annullaFondiMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("titoli").update({ fondi_ricevuti: false, updated_at: new Date().toISOString() }).eq("id", id!);
      if (error) throw error;
      if (user) {
        await logAttivita({ azione: "fondi_ricevuti_annullato", entita_tipo: "titolo", entita_id: id!, dettagli_json: { conferimento_gestito: true } });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      toast.success("Fondi riportati in attesa");
    },
    onError: () => toast.error("Errore"),
  });

  const updateDateMutation = useMutation({
    mutationFn: async ({ field, value }: { field: "data_messa_cassa" | "data_pagamento" | "data_decorrenza_rinnovo" | "data_copertura"; value: string | null }) => {
      if (field === "data_copertura" && !canHaveDataCopertura(titolo as any)) {
        throw new Error("La polizza madre non può avere data copertura");
      }
      const { error } = await supabase.from("titoli").update({ [field]: value || null, updated_at: new Date().toISOString() }).eq("id", id!);
      if (error) throw error;
      if (field === "data_copertura") {
        await (supabase.from("quietanze") as any)
          .update({ data_copertura: value || null, updated_at: new Date().toISOString() })
          .eq("titolo_id", id!);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      toast.success("Data aggiornata");
    },
    onError: () => toast.error("Errore aggiornamento data"),
  });

  if (isLoading) return <p className="text-muted-foreground p-8">Caricamento...</p>;
  if (!titolo) return <p className="text-destructive p-8">Titolo non trovato</p>;

  const t = titolo;

  // Polizza poliennale: durata > 13 mesi tra decorrenza e scadenza
  const isPoliennale = (() => {
    if (!t.durata_da || !t.data_scadenza) return false;
    const start = new Date(t.durata_da);
    const end = new Date(t.data_scadenza);
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return months > 13;
  })();
  // Mostra "Messa a Cassa" se mai messa a cassa, se garantito aperto, o se poliennale attiva
  const inCopertura = isInCoperturaGarantita(t);
  const garantitoAperto = isGarantitoAperto(t);
  const showMessaACassa = !t.data_messa_cassa || garantitoAperto || (isPoliennale && t.stato === "attivo");

  // Lock generale: una quietanza messa a cassa o stornata non è più una "bozza".
  // La polizza madre è un frontespizio: non si mette a cassa.
  const isLocked = !!t.data_messa_cassa || t.stato === "incassato" || t.stato === "stornato";
  const isEmittenda = !!(t as any).emittenda;
  const isRegolazione = !!(t as any).is_regolazione;
  const isProroga = !!(t as any).is_proroga;
  const isAppendiceModifica = !!(t as any).is_appendice_modifica;
  const isAppendiceTitolo = isAppendice(t as any);
  // AM/PR/RG: titolo-incasso one-shot (non polizza madre)
  const isTitoloDerivato = isAppendiceTitolo;

  // Catena polizza: usata per banner "scope" e pannello "Quietanze sorelle"
  const isQuietanzaCorrente = isQuietanzaTitolo(t);
  /** Su quietanza già conclusa, appendice o polizza temporanea: niente dualismo Firma/Quietanza. */
  const nascondiPremioQuietanza =
    isAppendiceTitolo ||
    !!t.polizza_temporanea ||
    (isQuietanzaCorrente && (t.stato === "incassato" || !!t.data_messa_cassa));
  const catene = catenaTitoli && catenaTitoli.length > 0
    ? groupTitoliByPolizza(catenaTitoli)
    : [];
  const catenaCorrente = catene.find((c) => (c.all || []).some((x) => x.id === t.id));
  const totRate = catenaCorrente ? getTotQuietanze(catenaCorrente) : 0;
  const rataIndex = catenaCorrente ? getQuietanzaRataIndex(t, catenaCorrente) : 0;
  const madre = catenaCorrente?.madre || null;
  // Catena di id (madre per prima, poi le rate) per condividere i Documenti su tutta la polizza+quietanze.
  const chainIds: string[] = catenaCorrente
    ? [
        ...(catenaCorrente.madre ? [catenaCorrente.madre.id] : []),
        ...catenaCorrente.all.filter((x) => x.id !== catenaCorrente.madre?.id).map((x) => x.id),
      ]
    : [t.id];

  // "Polizza madre" con rate successive: l'incasso si fa solo sulle singole quietanze, NON qui.
  const isMadreConRate = !!catenaCorrente && !!madre && madre.id === t.id && totRate > 0;
  const primaRataDaIncassare = isMadreConRate
    ? (catenaCorrente!.rate.find((x: any) => x.stato === "attivo" && !x.data_messa_cassa) || null)
    : null;

  // Polizza originale (madre): sostituisce_polizza === null, non è appendice/regolazione/proroga.
  // Su queste l'incasso NON si fa mai — solo sulle quietanze, regolazioni e appendici.
  const isPolizzaMadre =
    !t.sostituisce_polizza &&
    !isAppendiceTitolo;
  const importiLocked = isPolizzaMadre ? t.stato === "stornato" : isLocked;

  // Stato contratto: tabella `polizze` (attiva/sospesa) con fallback su `titoli.stato`.
  // I dialog Gestione Polizze aggiornano titoli.stato; il badge header legge polizze.stato.
  const statoContratto = resolveStatoContrattoTitolo(t.stato, polizzaStato);
  const isContrattoSospeso = statoContratto.isSospeso;
  const isContrattoAttivo = statoContratto.isAttivo;
  const isContrattoAnnullato = statoContratto.isAnnullato;
  const sospensioneDisabled = !isContrattoAttivo;
  const riattivazioneDisabled = !isContrattoSospeso;
  const sospensioneDisabledTitle = isContrattoSospeso
    ? "La polizza è già sospesa: non si può sospendere di nuovo"
    : isContrattoAnnullato
      ? "Non si può sospendere una polizza annullata"
      : "Sospensione disponibile solo per polizze attive";
  const riattivazioneDisabledTitle = isContrattoAttivo
    ? "La polizza è già attiva: non si può riattivare di nuovo"
    : "Riattivazione disponibile solo per polizze sospese";
  const refreshDopoOperazionePolizza = () => {
    queryClient.invalidateQueries({ queryKey: ["titolo", id] });
    queryClient.invalidateQueries({ queryKey: ["polizza-stato"] });
    queryClient.invalidateQueries({ queryKey: ["catena-titoli"] });
  };

  const documentiTrigger = (
    <TitoloDocumentiTrigger
      titoloId={id!}
      chainIds={isAppendiceTitolo ? [t.id] : chainIds}
      appendiciPolizza={appendiciPolizza}
      isAppendiceView={isAppendiceTitolo}
    />
  );
  // Sulla polizza madre Documenti sta accanto a Precontrattuale, non in header.
  const documentiAccantoPrecontrattuale = !isTitoloDerivato && t.stato !== "scaduto";

  return (
    <PageContainer variant="detail">
      {/* Header — sticky sotto la topbar globale */}
      <TitoloHeaderBar
        t={t}
        polizzaStato={statoContratto.polizzaStatoDisplay}
        rataIndex={rataIndex}
        totRate={totRate}
        isQuietanzaCorrente={isQuietanzaCorrente}
        onEditImportoFirma={!isLocked && isPolizzaMadre ? openImportoFirma : undefined}
        documentiAction={documentiAccantoPrecontrattuale ? undefined : documentiTrigger}
        polizzaMadre={(isQuietanzaCorrente || isAppendiceTitolo) && madre ? {
          id: madre.id,
          numero_titolo: madre.numero_titolo,
        } : null}
        onBack={() => t.cliente_anagrafica?.id ? navigate(`/archivi/clienti/${t.cliente_anagrafica.id}?tab=polizze`) : navigate("/portafoglio/incassi")}
        madre={isProroga && madreProroga ? {
          id: (madreProroga as any).id,
          numero_titolo: (madreProroga as any).numero_titolo,
        } : madreQuietanza ? {
          id: (madreQuietanza as any).id,
          numero_titolo: (madreQuietanza as any).numero_titolo,
          garanzia_da: (madreQuietanza as any).garanzia_da,
          garanzia_a: (madreQuietanza as any).garanzia_a,
          rataLabel: (madreQuietanza as any).sostituisce_polizza
            ? `Rata ${(madreQuietanza as any).riga ?? ""}`.trim()
            : "Polizza",
        } : null}
      />



      {/* Banner di blocco + banner scope quietanza */}
      {!isAppendiceTitolo && (
        <TitoloScopeBanners
          t={t}
          isLocked={isLocked}
          isQuietanzaCorrente={isQuietanzaCorrente}
          totRate={totRate}
          rataIndex={rataIndex}
          madre={madre}
          onNavigateMadre={(id) => navigate(`/titoli/${id}`)}
        />
      )}

      {/* Pannello "Quietanze di questa polizza" — non sull'appendice */}
      {!isAppendiceTitolo && (
        <TitoloQuietanzePanel
          t={t}
          totRate={totRate}
          catena={catenaCorrente || null}
          onNavigate={(rid) => navigate(`/titoli/${rid}`)}
        />
      )}

      {/* Pannello "Regolazioni collegate" — solo per titoli non-RG con almeno una RG */}
      {!isTitoloDerivato && regolazioniCollegate.length > 0 && (
        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="pb-3 bg-orange-50/60 dark:bg-orange-950/20 border-b">
            <CardTitle className="text-sm sm:text-base font-semibold text-orange-900 dark:text-orange-100 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Regolazioni collegate ({regolazioniCollegate.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <TableScrollArea>
            <table className="w-full min-w-max text-sm">
              <thead className="text-xs uppercase text-muted-foreground bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2">Numero</th>
                  <th className="text-left px-3 py-2">Periodo</th>
                  <th className="text-right px-3 py-2">Premio Lordo</th>
                  <th className="text-left px-3 py-2">Stato</th>
                  <th className="text-left px-3 py-2">Messa a cassa</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {regolazioniCollegate.map((rg: any) => (
                  <tr
                    key={rg.id}
                    className="border-t hover:bg-orange-50/40 dark:hover:bg-orange-950/20 cursor-pointer"
                    onClick={() => navigate(`/titoli/${rg.id}`)}
                  >
                    <td className="px-3 py-2 font-mono">{rg.numero_titolo}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {rg.garanzia_da ? new Date(rg.garanzia_da).toLocaleDateString("it-IT") : "—"}
                      {rg.garanzia_a ? ` → ${new Date(rg.garanzia_a).toLocaleDateString("it-IT")}` : ""}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtEuro(rg.premio_lordo)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={rg.stato === "incassato" ? "default" : "secondary"} className={rg.stato === "incassato" ? "bg-amber-500 hover:bg-amber-600" : ""}>
                        {rg.stato}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {rg.data_messa_cassa ? new Date(rg.data_messa_cassa).toLocaleDateString("it-IT") : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">›</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </TableScrollArea>
          </CardContent>
        </Card>
      )}

      {!isTitoloDerivato && prorogheCollegate.length > 0 && (
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="pb-3 bg-blue-50/60 dark:bg-blue-950/20 border-b">
            <CardTitle className="text-sm sm:text-base font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Proroghe collegate ({prorogheCollegate.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <TableScrollArea>
            <table className="w-full min-w-max text-sm">
              <thead className="text-xs uppercase text-muted-foreground bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2">Numero</th>
                  <th className="text-left px-3 py-2">Periodo</th>
                  <th className="text-right px-3 py-2">Premio Lordo</th>
                  <th className="text-left px-3 py-2">Stato</th>
                  <th className="text-left px-3 py-2">Messa a cassa</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {prorogheCollegate.map((pr: any) => (
                  <tr
                    key={pr.id}
                    className="border-t hover:bg-blue-50/40 dark:hover:bg-blue-950/20 cursor-pointer"
                    onClick={() => navigate(`/titoli/${pr.id}`)}
                  >
                    <td className="px-3 py-2 font-mono">{pr.numero_titolo}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {pr.garanzia_da ? new Date(pr.garanzia_da).toLocaleDateString("it-IT") : "—"}
                      {pr.garanzia_a ? ` → ${new Date(pr.garanzia_a).toLocaleDateString("it-IT")}` : ""}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtEuro(pr.premio_lordo)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={pr.stato === "incassato" ? "default" : "secondary"} className={pr.stato === "incassato" ? "bg-blue-500 hover:bg-blue-600" : ""}>
                        {pr.stato}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {pr.data_messa_cassa ? new Date(pr.data_messa_cassa).toLocaleDateString("it-IT") : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">›</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </TableScrollArea>
          </CardContent>
        </Card>
      )}


      {/* Card dedicata: rinnovo in attesa di messa a cassa della polizza precedente */}
      {!isAppendiceTitolo && t.stato === "in_attesa_rinnovo" && (
        <Card className="border-orange-400 bg-orange-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600" /> Rinnovo in attesa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Questo titolo è un rinnovo della polizza{" "}
              <span className="font-mono font-semibold">{t.sostituisce_polizza}</span>
              .
              Diventerà <strong>attivo automaticamente</strong> quando la polizza precedente verrà messa a cassa,
              e solo allora apparirà in <em>Incassi</em> di scadenza.
            </p>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                className="text-orange-700 border-orange-400 hover:bg-orange-100"
                onClick={async () => {
                  if (!confirm("Forzare l'attivazione di questo rinnovo senza attendere la messa a cassa della polizza precedente?")) return;
                  const { error } = await supabase.from("titoli").update({ stato: "attivo", updated_at: new Date().toISOString() }).eq("id", id);
                  if (error) { toast.error("Errore: " + error.message); return; }
                  await logAttivita({ azione: "forza_attivazione_rinnovo", entita_tipo: "titolo", entita_id: id!, dettagli_json: { polizza_precedente: t.sostituisce_polizza } });
                  toast.success("Rinnovo attivato");
                  queryClient.invalidateQueries({ queryKey: ["titolo"] });
                  queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
                }}
              >
                Forza attivazione
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Operazioni — nascosto per scaduto */}
      {t.stato !== "scaduto" && (
        <Card className="border-l-4 border-l-teal-600 shadow-sm">
          <CardHeader className="pb-3 bg-teal-50/60 dark:bg-teal-950/20 border-b"><CardTitle className="text-sm sm:text-base font-semibold text-teal-900 dark:text-teal-100">Operazioni</CardTitle></CardHeader>
          <CardContent className="flex gap-2 flex-wrap">
            {isContrattoSospeso && (
              <div className="w-full -mt-1 mb-1 rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-800 px-3 py-2 text-xs text-yellow-900 dark:text-yellow-200">
                Questa polizza è attualmente sospesa.
              </div>
            )}
            {isRegolazione && (
              <div className="w-full -mt-1 mb-1 rounded-md border border-orange-300 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 px-3 py-2 text-xs text-orange-900 dark:text-orange-200">
                Questo titolo è una <strong>Regolazione</strong>{madreQuietanza ? <> collegata a <span className="font-medium">{(madreQuietanza as any).numero_titolo}</span></> : null}. Sono disponibili solo Messa a Cassa e Annullamento.
              </div>
            )}
            {isProroga && (
              <div className="w-full -mt-1 mb-1 rounded-md border border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 px-3 py-2 text-xs text-blue-900 dark:text-blue-200">
                Questo titolo è una <strong>Proroga</strong>{madreProroga ? <> della polizza <button type="button" className="font-medium underline" onClick={() => navigate(`/titoli/${(madreProroga as any).id}`)}>{(madreProroga as any).numero_titolo}</button></> : null}.
                All&apos;incasso la scadenza della polizza madre verrà estesa automaticamente.
              </div>
            )}
            {isAppendiceModifica && (
              <div className="w-full -mt-1 mb-1 rounded-md border border-violet-300 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-800 px-3 py-2 text-xs text-violet-900 dark:text-violet-200">
                Questo titolo è un&apos;<strong>Appendice di modifica</strong>
                {madre ? (
                  <> della polizza{" "}
                    <button type="button" className="font-medium underline" onClick={() => navigate(`/titoli/${madre.id}`)}>
                      {madre.numero_titolo}
                    </button>
                  </>
                ) : null}
                . Non genera quietanze né consente sostituzione/estinzione/nuove appendici: sono disponibili incasso/messa a cassa e annullamento.
              </div>
            )}
            {isAppendiceTitolo && Number(t.premio_lordo) < -0.009 && !t.data_messa_cassa && t.stato === "attivo" && (
              <div className="w-full -mt-1 mb-1 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
                <strong>Appendice a credito</strong> ({fmtEuro(Math.abs(Number(t.premio_lordo) || 0))}).
                Alla messa a cassa verrà creato un <strong>acconto cliente</strong> utilizzabile
                sulle prossime quietanze oppure segnabile come rimborsato/bonificato
                (Contabilità → Acconti clienti).
              </div>
            )}
            
            {isPolizzaMadre && !isContrattoAnnullato && (
              <span
                className="inline-flex"
                title={sospensioneDisabled ? sospensioneDisabledTitle : "Sospendi temporaneamente la copertura"}
              >
                <Button
                  variant="outline"
                  size="sm"
                  disabled={sospensioneDisabled}
                  onClick={() => setSospensioneOpen(true)}
                >
                  <PauseCircle className="w-4 h-4 mr-1" /> Sospensione
                </Button>
              </span>
            )}
            {isPolizzaMadre && !isContrattoAnnullato && (
              <span
                className="inline-flex"
                title={riattivazioneDisabled ? riattivazioneDisabledTitle : "Riattiva la polizza sospesa"}
              >
                <Button
                  variant="outline"
                  size="sm"
                  disabled={riattivazioneDisabled}
                  onClick={() => setRiattivazioneOpen(true)}
                >
                  <PlayCircle className="w-4 h-4 mr-1" /> Riattivazione
                </Button>
              </span>
            )}
            {!isTitoloDerivato && !isContrattoAnnullato && (
              <Button variant="outline" size="sm" onClick={() => setSostituzioneOpen(true)}>
                <Replace className="w-4 h-4 mr-1" /> Sostituzione
              </Button>
            )}
            {!isTitoloDerivato && !isContrattoAnnullato && (
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setEstinzioneOpen(true)}>
                <Ban className="w-4 h-4 mr-1" /> Estinzione
              </Button>
            )}
            {!isTitoloDerivato && !isContrattoAnnullato && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/portafoglio/appendici?polizza=${encodeURIComponent(t.numero_titolo || "")}&clienteId=${encodeURIComponent(t.cliente_anagrafica?.id || "")}&titoloId=${encodeURIComponent(t.id)}`)}>
                <FileText className="w-4 h-4 mr-1" /> Appendici
              </Button>
            )}
            {!isTitoloDerivato && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/portafoglio/doc-precontrattuale?titoloId=${encodeURIComponent(t.id)}&clienteId=${encodeURIComponent(t.cliente_anagrafica?.id || "")}`)}>
                <FileText className="w-4 h-4 mr-1" /> Precontrattuale
              </Button>
            )}
            {documentiAccantoPrecontrattuale && documentiTrigger}
            {isLibroMatricolaTitolo && libroMatricolaOwnerId && (
              <Button
                variant="outline"
                size="sm"
                className="border-primary/40 text-primary hover:bg-primary/5"
                onClick={() => {
                  setRigheMatricola(
                    (mezziMatricolaDb || []).map((row: any) => mapDbToLibroMatricolaRiga(row)),
                  );
                  setMatricolaDialogOpen(true);
                }}
              >
                <Truck className="w-4 h-4 mr-1" />
                Libro Matricola ({mezziMatricolaDb.length} mezzi)
              </Button>
            )}
            {isAdmin && !isMadreConRate && (t.stato === "incassato" || !!t.data_messa_cassa || (!!t.conferimento_gestito && !!t.data_copertura)) && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/50 hover:bg-destructive/10"
                onClick={() => { setAnnullaPassword(""); setAnnullaDialogOpen(true); }}
                disabled={changeStatoMutation.isPending}
                title="Riporta la quietanza a 'da incassare' ed elimina provvigioni/movimenti collegati"
              >
                <XCircle className="w-4 h-4 mr-1" />
                {t.stato === "incassato" ? "Annulla incasso" : inCopertura || garantitoAperto ? "Annulla copertura garantita" : t.data_messa_cassa ? "Annulla messa a cassa" : "Annulla copertura garantita"}
              </Button>
            )}
            {!isQuietanzaCorrente && !isContrattoAnnullato && (
            <AlertDialog open={annullaContrattoOpen} onOpenChange={setAnnullaContrattoOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/50 hover:bg-destructive/10"
                >
                  <XCircle className="w-4 h-4 mr-1" />{" "}
                  {isAppendiceTitolo
                    ? "Annulla appendice (irreversibile)"
                    : "Annulla polizza (irreversibile)"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {isAppendiceTitolo
                      ? "Conferma annullamento appendice"
                      : "Conferma annullamento polizza"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Annullando {isAppendiceTitolo ? "l'appendice" : "la polizza"}{" "}
                    {t.numero_titolo} verranno <strong>eliminati in transazione</strong>:
                    quietanze successive, provvigioni (anche se già pagate), righe pagamento provvigioni,
                    righe rimessa, testate rimessa rimaste vuote, movimenti contabili, movimenti polizza
                    e split commerciali collegati. Resterà solo il log dell&apos;operazione come traccia.
                    Questa azione è irreversibile.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async (e) => {
                      e.preventDefault();
                      const res = await annullaPolizza(id!);
                      if (!res.ok) { toast.error(res.error || "Errore annullamento"); return; }
                      const entitaLabel = isAppendiceTitolo ? "Appendice" : "Polizza";
                      toast.success(
                        `${entitaLabel} annullata — eliminati: ${res.quietanzeEliminate ?? 0} quietanze, ${res.provvigioniEliminate ?? 0} provvigioni (${res.pagamentiRigheEliminate ?? 0} righe pagamento), ${res.rimessaDettagliEliminati ?? 0} righe rimessa, ${res.rimesseTestateEliminate ?? 0} testate rimessa, ${res.movimentiEliminati ?? 0} movimenti contabili, ${res.movimentiPolizzaEliminati ?? 0} movimenti polizza, ${res.splitsEliminati ?? 0} split${res.includevaProvvigioniPagate ? " (incluse provvigioni già pagate)" : ""}.`,
                        { duration: 8000 }
                      );
                      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
                      queryClient.invalidateQueries({ queryKey: ["polizza-stato"] });
                      queryClient.invalidateQueries({ queryKey: ["catena-titoli"] });
                      setAnnullaContrattoOpen(false);
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Conferma annullamento
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            )}

            {!isTitoloDerivato && !isContrattoAnnullato && (
              <Button
                variant="outline"
                size="sm"
                disabled={!t.data_messa_cassa && !t.data_copertura}
                title={!t.data_messa_cassa && !t.data_copertura ? "Disponibile solo dopo copertura o messa a cassa" : "Reinvia email di notifica all'agenzia/compagnia"}
                onClick={async () => {
                  const tid = toast.loading("Invio notifica messa a cassa...");
                  const { data, error } = await invokeNotificaMessaCassa([t.id], { force: true });
                  toast.dismiss(tid);
                  if (error) {
                    toast.error(`Notifica non inviata: ${error.message ?? error}`);
                  } else {
                    toast.success(`Notifica inviata a ${data?.recipient ?? "destinatario"}`);
                    queryClient.invalidateQueries({ queryKey: ["log-attivita", t.id] });
                    if (data?.documenti_archiviati) queryClient.invalidateQueries({ queryKey: ["documenti", "titolo"] });
                    if (data?.archive_error) toast.warning(`Archivio PDF non creato: ${data.archive_error}`);
                  }
                }}
              >
                <Mail className="w-4 h-4 mr-1" /> Reinvia notifica
              </Button>
            )}

            {/* ===== Callout: sulla Polizza madre l'incasso si fa sulle singole quietanze ===== */}
            {(isMadreConRate || isPolizzaMadre) && !isContrattoAnnullato && (
              <div className="w-full mt-2 pt-4 border-t">
                <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-900 flex items-start gap-2">
                  <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <strong>L'incasso si effettua sulla singola quietanza/rata.</strong>{" "}
                    Apri la rata da incassare dalla lista <em>Quietanze di questa polizza</em> qui sopra. La polizza madre non si mette a cassa.
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-blue-300 text-blue-700 hover:bg-blue-100"
                        disabled={!primaRataDaIncassare}
                        onClick={() => primaRataDaIncassare && navigate(`/titoli/${(primaRataDaIncassare as any).id}`)}
                      >
                        <ArrowLeft className="w-4 h-4 mr-1 rotate-180" />
                        {primaRataDaIncassare ? "Vai alla prima rata da incassare" : "Nessuna rata da incassare"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== Sotto-sezione Messa a Cassa unificata ===== */}
            {!isMadreConRate && !isPolizzaMadre && (t.stato === "attivo" || t.stato === "incassato") && showMessaACassa && (
              <div className="w-full mt-2 pt-4 border-t">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2 text-teal-900 dark:text-teal-100">
                    <DollarSign className="w-4 h-4" /> Messa a Cassa
                  </h4>
                  <div className="flex items-center gap-2">
                    {isPoliennale && <Badge variant="outline" className="text-xs">Poliennale</Badge>}
                    <Badge variant={t.stato === "incassato" ? "default" : inCopertura || garantitoAperto ? "default" : "secondary"} className={t.stato === "incassato" ? "bg-amber-500 hover:bg-amber-600" : inCopertura || garantitoAperto ? "bg-orange-500 hover:bg-orange-600" : ""}>
                      {t.stato === "incassato" ? "Incassato" : inCopertura || garantitoAperto ? "In Copertura" : "Da incassare"}
                    </Badge>
                  </div>
                </div>

                {/* Date — griglia responsive con label uppercase + input/valore allineato */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  {t.stato === "incassato" ? (
                    <>
                      {[
                        { label: "Data Messa a Cassa", field: "data_messa_cassa" as const, value: t.data_messa_cassa },
                        { label: "Data Pagamento", field: "data_pagamento" as const, value: t.data_pagamento },
                        { label: "Data Decorrenza Rinnovo", field: "data_decorrenza_rinnovo" as const, value: t.data_decorrenza_rinnovo },
                      ].map((d) => (
                        <div key={d.field} className="rounded-md border bg-card/40 px-3 py-2">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{d.label}</label>
                          <Input
                            type="date"
                            className="mt-1 h-9 text-sm font-medium tabular-nums"
                            value={d.value || ""}
                            onChange={(e) => updateDateMutation.mutate({ field: d.field, value: e.target.value })}
                          />
                        </div>
                      ))}
                    </>
                  ) : inCopertura || garantitoAperto ? (
                    <>
                      <div className="rounded-md border border-orange-200 bg-orange-50/50 px-3 py-2">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-orange-700">Data Copertura</label>
                        <Input
                          type="date"
                          className="mt-1 h-9 text-sm font-medium tabular-nums"
                          value={t.data_copertura || ""}
                          onChange={(e) => updateDateMutation.mutate({ field: "data_copertura", value: e.target.value })}
                        />
                      </div>
                      <div className="rounded-md border border-orange-200 bg-orange-50/50 px-3 py-2">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-orange-700">Data Messa a Cassa</label>
                        <Input
                          type="date"
                          className="mt-1 h-9 text-sm font-medium tabular-nums"
                          value={t.data_messa_cassa || ""}
                          onChange={(e) => updateDateMutation.mutate({ field: "data_messa_cassa", value: e.target.value })}
                        />
                      </div>
                      <div className="rounded-md border bg-card/40 px-3 py-2">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Data Decorrenza Rinnovo</label>
                        <Input
                          type="date"
                          className="mt-1 h-9 text-sm font-medium tabular-nums"
                          value={t.data_decorrenza_rinnovo || ""}
                          onChange={(e) => updateDateMutation.mutate({ field: "data_decorrenza_rinnovo", value: e.target.value })}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {["Data Messa a Cassa", "Data Pagamento", "Data Decorrenza Rinnovo"].map((label) => (
                        <div key={label} className="rounded-md border border-dashed bg-muted/20 px-3 py-2">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
                          <div className="mt-1 h-9 flex items-center text-sm text-muted-foreground tabular-nums">—</div>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* Tipo pagamento / Banca */}
                {t.stato === "incassato" && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
                    <span><span className="font-medium text-foreground">Tipo Pagamento:</span> {fmt(t.tipo_pagamento)}</span>
                    {t.tipo_pagamento === "bonifico" && t.banca_pagamento && (
                      <span><span className="font-medium text-foreground">Banca:</span> {fmt(t.banca_pagamento)}</span>
                    )}
                  </div>
                )}

                {/* Compensazioni contabili applicate (read-only) */}
                {t.stato === "incassato" && <CompensazioniBox titoloId={t.id} />}
                {t.stato === "incassato" && (
                  <ModalitaIncassoBox titoloId={t.id} canEdit={!isLocked} />
                )}

                {/* Badges Garantito / Fondi */}
                {(inCopertura || garantitoAperto || (t.stato === "incassato" && t.conferimento_gestito)) && (
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <Badge className="bg-orange-500 text-white hover:bg-orange-600">Garantito</Badge>
                    {!t.fondi_ricevuti ? (
                      <>
                        <Badge variant="destructive">In Attesa Fondi</Badge>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 text-xs border-green-500 text-green-600 hover:bg-green-50" disabled={segnaFondiRicevutiMutation.isPending}>
                              <CheckSquare className="w-3 h-3 mr-1" /> Segna Fondi Ricevuti
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Conferma ricezione fondi</AlertDialogTitle>
                              <AlertDialogDescription>Confermi che i fondi per questo titolo sono stati effettivamente ricevuti?</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction onClick={() => segnaFondiRicevutiMutation.mutate()}>Conferma</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    ) : (
                      <>
                        <Badge className="bg-green-600 text-white hover:bg-green-700">Fondi Ricevuti</Badge>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 text-xs border-red-400 text-red-500 hover:bg-red-50" disabled={annullaFondiMutation.isPending}>
                              <XCircle className="w-3 h-3 mr-1" /> Annulla Fondi Ricevuti
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Annullare ricezione fondi?</AlertDialogTitle>
                              <AlertDialogDescription>Sei sicuro di voler riportare questo titolo in stato "In Attesa Fondi"?</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => annullaFondiMutation.mutate()}>Conferma annullamento</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                )}

                {/* Banner anti-doppio-incasso — non per garantito ancora da convertire in incasso pieno */}
                {t.data_messa_cassa && !isPoliennale && !garantitoAperto && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        className="mt-3 w-full text-left flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 hover:bg-blue-100 transition-colors cursor-pointer"
                      >
                        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <strong>Quietanza già messa a cassa il {new Date(t.data_messa_cassa).toLocaleDateString("it-IT")}.</strong>{" "}
                          Le azioni <em>Incassa</em> e <em>Garantito</em> non sono disponibili su questa rata.
                          <span className="ml-1 underline decoration-dotted">Maggiori dettagli</span>
                        </div>
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <Info className="w-5 h-5 text-blue-600" /> Quietanza già incassata
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                          <div className="space-y-2 text-sm">
                            <p>
                              Questa quietanza è stata <strong>messa a cassa il {new Date(t.data_messa_cassa).toLocaleDateString("it-IT")}</strong> e non può essere incassata una seconda volta: il sistema applica una protezione anti-doppio-incasso a livello di database. La polizza (contratto) resta invece attiva: la messa a cassa è una proprietà della rata, non del contratto.
                            </p>
                            <p className="text-muted-foreground">
                              Le azioni <em>Incassa</em> e <em>Garantito</em> tornano disponibili solo dopo l'annullamento della messa a cassa precedente.
                            </p>

                            {isAdmin ? (
                              <p className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900">
                                In quanto <strong>Amministratore</strong> puoi usare il pulsante <em>Annulla Incasso / Messa a Cassa</em> qui sotto per sbloccare la polizza, quindi procedere con un nuovo incasso.
                              </p>
                            ) : (
                              <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground">
                                Per sbloccare la polizza è necessario contattare un Amministratore.
                              </p>
                            )}
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogAction>Ho capito</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {/* Azioni */}
                <div className="mt-3 flex gap-2 flex-wrap">
                  {t.stato === "attivo" && (!t.data_messa_cassa || isPoliennale || garantitoAperto) && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => {
                      const today = new Date().toISOString().slice(0, 10);
                      setCassaForm({ dataMessaCassa: today, dataPagamento: today, dataDecorrenza: today, tipoPagamento: "", banca: "" });
                      setCassaDialogOpen(true);
                    }} disabled={changeStatoMutation.isPending}>
                      <CheckSquare className="w-4 h-4 mr-1" /> {garantitoAperto ? "Incassa (fondi ricevuti)" : "Incassa"}
                    </Button>
                  )}
                  {t.stato === "attivo" && !t.data_messa_cassa && !garantitoAperto && (
                    <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => {
                      const today = new Date().toISOString().slice(0, 10);
                      setConferimentoForm({
                        dataCopertura: today,
                        dataDecorrenza: today,
                        cig_rif: (t as any).cig_rif || "",
                        cig_temporaneo: !!(t as any).cig_temporaneo,
                        updateMadre: true,
                      });
                      setConferimentoAccettato(false);
                      setConferimentoMessaCassaSerale(false);
                      setConferimentoDialogOpen(true);
                    }} disabled={conferimentoGestitoMutation.isPending}>
                      <Shield className="w-4 h-4 mr-1" /> Garantito
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dove sono salvati i dati — sezione informativa sulla persistenza delle operazioni ciclo vita */}
      {!isAppendiceTitolo && <TitoloDataPersistenceInfo />}

      {/* MESSA A CASSA — ora integrata nella card Operazioni sopra */}

      {/* Dialog Conferma Messa a Cassa — unificato con anticipi e compensazioni */}
      <MessaCassaDialog
        open={cassaDialogOpen}
        onOpenChange={setCassaDialogOpen}
        titoli={[{
          id: t.id,
          numero_titolo: t.numero_titolo,
          premio_lordo: t.premio_lordo,
          cliente_anagrafica_id: t.cliente_anagrafica_id,
          cliente_nome_display: t.cliente_anagrafica
            ? (t.cliente_anagrafica.tipo_cliente === "privato"
              ? `${t.cliente_anagrafica.cognome || ""} ${t.cliente_anagrafica.nome || ""}`.trim()
              : t.cliente_anagrafica.ragione_sociale || null)
            : null,
          ufficio_id: t.ufficio_id,
          is_ente: isClienteEnte(t.cliente_anagrafica),
        }]}
        preferredPagatoreId={t.cliente_anagrafica_id || null}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["titolo", t.id] });
          queryClient.invalidateQueries({ queryKey: ["titoli"] });
          queryClient.invalidateQueries({ queryKey: ["titoli-compensazioni"] });
          queryClient.invalidateQueries({ queryKey: ["compensazioni-by-titoli"] });
        }}
      />

      {/* Dialog Rinnovo Polizza */}
      

      {/* Dialog Garantito */}
      <Dialog open={conferimentoDialogOpen} onOpenChange={setConferimentoDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <MessaCassaSeraleCheckbox
            checked={conferimentoMessaCassaSerale}
            onCheckedChange={setConferimentoMessaCassaSerale}
            id="messa-cassa-serale-conferimento"
          />
          <DialogHeader className="pr-52">
            <DialogTitle>Garantito</DialogTitle>
            <DialogDescription>Polizza {t.numero_titolo || t.id.slice(0, 8)} — Messa a cassa garantita (senza fondi)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-orange-400 bg-orange-50 p-3 text-sm text-orange-800 space-y-2">
              <p className="font-semibold">⚠️ Dichiarazione di Responsabilità — Circolare 02 Consulbrokers</p>
              <p className="font-medium">Procedura operativa 03, punto 3:</p>
              <p>Le polizze, una volta inserite <strong>NON DEVONO ESSERE GARANTITE</strong>, ma dovranno essere effettivamente incassate; casi particolari devono essere concordati <strong>PER ISCRITTO</strong> con la Direzione seguendo i criteri di seguito esposti:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Coperture fino ad euro <strong>1.000,00</strong>: occorre l'autorizzazione dell'Amministratore Delegato</li>
                <li>Coperture fino ad euro <strong>10.000,00</strong>: occorre l'autorizzazione di due Amministratori Delegati</li>
                <li>Coperture oltre euro <strong>10.000,00</strong>: occorre l'autorizzazione del CDA</li>
              </ul>
              <p>Tutto quanto non regolarizzato alla data di chiusura del mese non verrà rimesso alle agenzie entro il giorno 10 del mese successivo.</p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="conferimento-accettato" checked={conferimentoAccettato} onCheckedChange={(v) => setConferimentoAccettato(!!v)} />
              <Label htmlFor="conferimento-accettato" className="text-sm font-medium">Dichiaro di aver ottenuto l'autorizzazione necessaria e di assumermi la responsabilità dell'incasso</Label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data Copertura</Label>
                <Input type="date" value={conferimentoForm.dataCopertura} onChange={(e) => setConferimentoForm(f => ({ ...f, dataCopertura: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Data Decorrenza Rinnovo</Label>
                <Input type="date" value={conferimentoForm.dataDecorrenza} onChange={(e) => setConferimentoForm(f => ({ ...f, dataDecorrenza: e.target.value }))} className="mt-1" />
              </div>
            </div>
            {isClienteEnte(t.cliente_anagrafica) && (
              <div className="rounded-md border border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
                <CigRifField
                  idPrefix="gar-cig"
                  cig={conferimentoForm.cig_rif}
                  temporaneo={conferimentoForm.cig_temporaneo}
                  warningEmpty
                  onCigChange={(cig) => setConferimentoForm((f) => ({ ...f, cig_rif: cig }))}
                  onTemporaneoChange={(temporaneo, cig) =>
                    setConferimentoForm((f) => ({
                      ...f,
                      cig_temporaneo: temporaneo,
                      ...(cig !== undefined ? { cig_rif: cig } : {}),
                    }))
                  }
                />
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="gar-cig-madre"
                    checked={conferimentoForm.updateMadre}
                    onCheckedChange={(v) => setConferimentoForm((f) => ({ ...f, updateMadre: v === true }))}
                  />
                  <Label htmlFor="gar-cig-madre" className="text-[11px] cursor-pointer">
                    Aggiorna anche la polizza madre
                  </Label>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Vengono impostate data copertura e data messa a cassa. I fondi restano in attesa; tipo/data pagamento e importo si compilano all&apos;incasso effettivo.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConferimentoDialogOpen(false)}>Annulla</Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              disabled={!conferimentoAccettato || conferimentoGestitoMutation.isPending}
              onClick={() => conferimentoGestitoMutation.mutate(conferimentoForm)}
            >
              <Shield className="w-4 h-4 mr-1" /> Conferma Garantito
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={annullaDialogOpen} onOpenChange={setAnnullaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t?.stato === "incassato" ? "Conferma annullamento incasso" : inCopertura || garantitoAperto ? "Conferma annullamento copertura garantita" : "Conferma annullamento messa a cassa"}</DialogTitle>
            <DialogDescription>Verifica la tua identità per procedere. La polizza madre non verrà modificata.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 space-y-2">
              <p className="text-sm font-medium text-destructive">
                ⚠️ Operazione riservata agli amministratori. Verranno rimossi/riportati indietro in transazione:
              </p>
              <ul className="text-xs text-destructive/90 list-disc pl-4 space-y-0.5">
                <li>Provvigioni generate e relative righe di pagamento (blocco se già liquidate)</li>
                <li>Movimenti contabili collegati (compensazioni, utilizzi acconto)</li>
                <li>Righe rimessa in bozza (blocco se rimessa in pagamento/pagata)</li>
                <li>Acconti cliente utilizzati (residuo ripristinato)</li>
                <li>Eventuale rata successiva auto-generata non incassata</li>
                <li>La quietanza torna a <strong>«da incassare»</strong> e sparisce dagli estratti conto incassati</li>
              </ul>
              <p className="text-xs text-muted-foreground">La polizza madre non viene toccata.</p>
            </div>
            <div>
              <Label className="text-xs">Password</Label>
              <Input type="password" value={annullaPassword} onChange={(e) => setAnnullaPassword(e.target.value)} placeholder="Inserisci la tua password" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnnullaDialogOpen(false)}>Annulla</Button>
            <Button variant="destructive" disabled={!annullaPassword || annullaLoading} onClick={async () => {
              setAnnullaLoading(true);
              try {
                const { error } = await supabase.auth.signInWithPassword({ email: user?.email || "", password: annullaPassword });
                if (error) {
                  toast.error("Password non corretta");
                  return;
                }
                const res = await annullaMessaACassa(id!);
                if (!res.ok) {
                  toast.error(res.error || "Operazione fallita");
                  return;
                }
                toast.success(
                  `${t?.stato === "incassato" ? "Incasso annullato" : inCopertura || garantitoAperto ? "Copertura garantita annullata" : "Messa a cassa annullata"} (${res.provvigioniEliminate ?? 0} provv., ${res.movimentiEliminati ?? 0} mov.${(res.bonificiRiaperti ?? 0) > 0 ? `, ${res.bonificiRiaperti} bonifici riaperti` : ""}${res.rataSuccessivaEliminata ? ", rata successiva rimossa" : ""})`
                );
                queryClient.invalidateQueries({ queryKey: ["titolo", id] });
                queryClient.invalidateQueries({ queryKey: ["provvigioni", id] });
                queryClient.invalidateQueries({ queryKey: ["dashboard-ufficio"] });
                queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
                queryClient.invalidateQueries({ queryKey: ["portafoglio-carico-totale"] });
                queryClient.invalidateQueries({ queryKey: ["portafoglio"] });
                queryClient.invalidateQueries({ queryKey: ["incassi-bonifici-aperti"] });
                queryClient.invalidateQueries({ queryKey: ["messa-cassa-bonifici-candidati"] });
                setAnnullaDialogOpen(false);
              } catch {
                toast.error("Errore di verifica");
              } finally {
                setAnnullaLoading(false);
              }
            }}>
              Conferma Annullamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isAppendiceTitolo && (<>
      <SectionCollapsible title="Contratto" icon={FileText}>
        <div className="flex justify-end mb-2 gap-2 flex-wrap items-center">
          <div className="flex items-center gap-1.5 mr-auto">
            <Checkbox
              id="view-emittenda-flag"
              checked={isEmittenda}
              onCheckedChange={async (v) => {
                const next = v === true;
                try {
                  assertSameTitolo(id, t.id, "toggle-emittenda-view");
                  const { error } = await supabase
                    .from("titoli")
                    .update({ emittenda: next } as any)
                    .eq("numero_titolo", t.numero_titolo);
                  if (error) throw error;
                  queryClient.invalidateQueries({ queryKey: ["titolo", id] });
                  toast.success(next ? "Flag Emittenda attivato" : "Flag Emittenda disattivato");
                } catch (e: any) {
                  toast.error(e?.message || "Errore aggiornamento Emittenda");
                }
              }}
            />
            <Label htmlFor="view-emittenda-flag" className="font-normal cursor-pointer text-xs text-muted-foreground">
              Emittenda
            </Label>
          </div>
          {(!isLocked || isEmittenda) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditNumeroEmittendaValue(t.numero_titolo || "");
                setEditNumeroEmittendaOpen(true);
              }}
              title={
                isEmittenda
                  ? "Emittenda: il N° polizza è modificabile anche dopo messa a cassa"
                  : "Modifica il N° polizza su tutta la catena (polizza non a cassa)"
              }
            >
              <Pencil className="w-4 h-4 mr-1" /> Modifica N° polizza
            </Button>
          )}
          {!editingContratto ? (
            <Button variant="ghost" size="sm" onClick={startEditContratto} disabled={isLocked} title={isLocked ? "Quietanza messa a cassa: modifiche bloccate" : undefined}>
              <Pencil className="w-4 h-4 mr-1" /> Modifica
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditingContratto(false)}>Annulla</Button>
              <Button size="sm" onClick={() => saveContrattoMutation.mutate()} disabled={saveContrattoMutation.isPending}>
                {saveContrattoMutation.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </>
          )}
        </div>

        {!editingContratto ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-1">
            <FieldRow label="Compagnia" value={
              <span>{
                t.compagnia_rapporto?.gruppi_compagnia?.descrizione
                || t.compagnia_diretta?.gruppi_compagnia?.descrizione
                || t.compagnia_diretta?.gruppo_compagnia
                || "—"
              }</span>
            } />
            <FieldRow label="Agenzia di rif." value={
              <span>{t.compagnia_diretta?.codice || ""} - {t.compagnia_diretta?.nome || t.prodotti?.compagnie?.nome || "—"}</span>
            } />
            <FieldRow label="Codice Rapporto" value={fmt(t.compagnia_rapporto?.codice_rapporto || t.codice_rapporto)} />
            <FieldRow label="Gruppo Ramo" value={fmt(t.ramo?.gruppo_ramo?.descrizione)} />
            <FieldRow label="Garanzia" value={`${t.ramo?.codice || ""} ${t.ramo?.descrizione || "—"}`} />
            <FieldRow label="Prodotto" value={fmt(t.prodotto_nome || t.prodotti?.nome_prodotto)} />
            <FieldRow
              label="Numero Polizza"
              value={
                <span className="inline-flex items-center gap-1.5">
                  {fmt(t.numero_titolo)}
                  {isEmittenda && <Badge variant="outline" className="text-[10px]">Emittenda</Badge>}
                </span>
              }
            />
            <FieldRow label="Note" value={fmt(t.note)} />
            {t.cliente_anagrafica ? (
              <div className="flex justify-between py-1">
                <span className="text-xs text-muted-foreground">Cliente</span>
                <Button variant="link" className="h-auto p-0 text-sm" onClick={() => navigate(`/archivi/clienti/${t.cliente_anagrafica.id}?tab=polizze`)}>
                  {t.cliente_anagrafica.tipo_cliente === "privato"
                    ? `${t.cliente_anagrafica.cognome || ""} ${t.cliente_anagrafica.nome || ""}`.trim()
                    : t.cliente_anagrafica.ragione_sociale || "—"}
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </div>
            ) : <FieldRow label="Cliente" value="—" />}
            {(t.cliente_anagrafica?.gruppi_finanziari?.tipo_soggetto === "ente" || t.cliente_anagrafica?.tipo_cliente === "ente") && (
              <FieldRow label="CIG/Rif." value={fmt(t.cig_rif)} />
            )}
            <FieldRow label="Vincolo" value={t.vincolo ? (t.vincolo.charAt(0).toUpperCase() + t.vincolo.slice(1)) : (t.vincolo_attivo ? "Sì" : "No")} />
            {t.descrizione_polizza && <div className="md:col-span-3"><FieldRow label="Descrizione" value={t.descrizione_polizza} /></div>}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Compagnia + Agenzia di Riferimento — stessa logica/stile di ImmissionePolizzaPage */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Compagnia Assicurativa <span className="text-destructive">*</span></Label>
                <SearchableSelect
                  className="h-8 text-xs"
                  value={contrattoForm.gruppo_compagnia_id || ""}
                  onValueChange={(v) => {
                    setContrattoForm((p) => {
                      const next = { ...p, gruppo_compagnia_id: v || null } as typeof p;
                      // resetta agenzia/rapporto se non più coerenti
                      const ag = (compagnieRaw || []).find((c: any) => c.id === p.compagnia_id) as any;
                      if (ag && v) {
                        const tipo = (ag.tipo || "").toLowerCase();
                        if ((tipo === "agenzia" || tipo === "direzione") && ag.gruppo_compagnia_id !== v) {
                          next.compagnia_id = null;
                          next.compagnia_rapporto_id = null;
                        } else if (tipo === "broker" || tipo === "plurimandataria") {
                          next.compagnia_rapporto_id = null;
                        }
                      }
                      return next;
                    });
                  }}
                  placeholder={(gruppiCompagniaList || []).length === 0 ? "Caricamento compagnie…" : "— Seleziona compagnia —"}
                  options={(() => {
                    const ag = (compagnieRaw || []).find((c: any) => c.id === contrattoForm.compagnia_id) as any;
                    const tipoSel = (ag?.tipo || "").toLowerCase();
                    let allowed: string[] | null = null;
                    if (ag && (tipoSel === "broker" || tipoSel === "plurimandataria")) {
                      allowed = rapportiMap?.get(contrattoForm.compagnia_id!) || [];
                    }
                    return (gruppiCompagniaList || [])
                      .filter((g: any) => !allowed || allowed.includes(g.id))
                      .map((g: any) => ({ value: g.id, label: g.descrizione || g.codice || "—" }));
                  })()}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Agenzia di Riferimento <span className="text-destructive">*</span></Label>
                <SearchableSelect
                  className="h-8 text-xs"
                  value={contrattoForm.compagnia_id || ""}
                  onValueChange={(v) => {
                    setContrattoForm((p) => {
                      const next = { ...p, compagnia_id: v || null, compagnia_rapporto_id: null } as typeof p;
                      const ag = (compagnieRaw || []).find((c: any) => c.id === v) as any;
                      const tipo = (ag?.tipo || "").toLowerCase();
                      if ((tipo === "agenzia" || tipo === "direzione") && ag?.gruppo_compagnia_id) {
                        next.gruppo_compagnia_id = ag.gruppo_compagnia_id;
                      } else if (tipo === "broker" || tipo === "plurimandataria") {
                        const gruppi = rapportiMap?.get(v) || [];
                        if (gruppi.length === 1) {
                          next.gruppo_compagnia_id = gruppi[0];
                        } else if (gruppi.length > 1 && p.gruppo_compagnia_id && !gruppi.includes(p.gruppo_compagnia_id)) {
                          next.gruppo_compagnia_id = null;
                        }
                      }
                      return next;
                    });
                  }}
                  placeholder="— Cerca agenzia / broker —"
                  options={(compagnieRaw || [])
                    .filter((c: any) => {
                      const tipo = (c.tipo || "").toLowerCase();
                      if (contrattoForm.gruppo_compagnia_id) {
                        if (tipo === "agenzia" || tipo === "direzione") return c.gruppo_compagnia_id === contrattoForm.gruppo_compagnia_id;
                        if (tipo === "broker" || tipo === "plurimandataria") return brokerPluriPerGruppo.includes(c.id);
                        return false;
                      }
                      return tipo === "agenzia" || tipo === "direzione" || tipo === "broker" || tipo === "plurimandataria";
                    })
                    .map((c: any) => {
                      const tipo = (c.tipo || "").toLowerCase();
                      const tipoLabel = tipo ? tipo.charAt(0).toUpperCase() + tipo.slice(1) : "";
                      return {
                        value: c.id,
                        label: `${c.codice || ""} - ${c.nome || ""}`,
                        description: tipoLabel,
                        searchText: `${c.tipo || ""} ${c.gruppo_compagnia || ""}`,
                      };
                    })}
                />
              </div>
            </div>

            {/* Rapporto Agenzia */}
            {contrattoForm.compagnia_id && (rapportiAgenziaEdit || []).length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Rapporto Agenzia {(rapportiAgenziaEdit || []).length >= 2 && <span className="text-destructive">*</span>}
                  </Label>
                  {(rapportiAgenziaEdit || []).length === 1 ? (
                    <div className="h-8 px-2 flex items-center text-xs rounded-md border bg-muted/30">
                      {rapportiAgenziaEdit[0].codice_rapporto || "—"}
                      {rapportiAgenziaEdit[0].tipo_rapporto ? ` · ${rapportiAgenziaEdit[0].tipo_rapporto}` : ""}
                    </div>
                  ) : (
                    <SearchableSelect
                      className={`h-8 text-xs ${!contrattoForm.compagnia_rapporto_id ? "ring-1 ring-amber-500" : ""}`}
                      value={contrattoForm.compagnia_rapporto_id || ""}
                      onValueChange={(v) => setContrattoForm((p) => ({ ...p, compagnia_rapporto_id: v || null }))}
                      placeholder="— Seleziona rapporto —"
                      options={rapportiAgenziaEdit.map((r: any) => ({
                        value: r.id,
                        label: r.codice_rapporto || "—",
                        description: r.tipo_rapporto || undefined,
                      }))}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Ramo / Sottoramo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5 md:col-span-2">
                <RamoSottoramoSelect
                  gruppoRamoId={contrattoForm.gruppo_ramo_id || null}
                  ramoId={contrattoForm.ramo_id || null}
                  onChange={({ gruppoRamoId, ramoId }) =>
                    setContrattoForm((p: any) => ({ ...p, gruppo_ramo_id: gruppoRamoId, ramo_id: ramoId }))
                  }
                />
              </div>
            </div>

            {/* N° Polizza: editabile se !isLocked; se locked+emittenda via dialog; altrimenti bloccato */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className={`text-xs flex items-center gap-1 ${!isLocked || isEmittenda ? "" : "text-muted-foreground"}`}>
                  {!isLocked || isEmittenda ? "Numero Polizza" : "🔒 Numero Polizza"}
                </Label>
                {!isLocked ? (
                  <Input
                    value={contrattoForm.numero_titolo}
                    onChange={(e) => setContrattoForm((p) => ({ ...p, numero_titolo: e.target.value }))}
                    placeholder="N° polizza"
                    className="h-8 text-xs font-mono"
                  />
                ) : (
                  <div className="h-8 px-2 flex items-center text-xs font-mono rounded-md border bg-muted/30">
                    {fmt(t.numero_titolo)}
                    {isEmittenda && (
                      <span className="ml-auto text-[10px] text-muted-foreground font-sans">
                        modificabile via «Modifica N° polizza»
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Note</Label>
                <Input
                  value={contrattoForm.note}
                  onChange={(e) => setContrattoForm(p => ({ ...p, note: e.target.value }))}
                  placeholder="Note opzionali"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">🔒 Cliente</Label>
                <div className="h-8 px-2 flex items-center text-xs rounded-md border bg-muted/30">
                  {t.cliente_anagrafica
                    ? (t.cliente_anagrafica.tipo_cliente === "privato"
                      ? `${t.cliente_anagrafica.cognome || ""} ${t.cliente_anagrafica.nome || ""}`.trim()
                      : t.cliente_anagrafica.ragione_sociale || "—")
                    : "—"}
                </div>
              </div>
            </div>

            {/* Prodotto */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">Prodotto</Label>
                <Input
                  type="text"
                  className="h-8 text-xs"
                  placeholder="Nome prodotto (testo libero)"
                  value={contrattoForm.prodotto_nome}
                  onChange={(e) => setContrattoForm(p => ({ ...p, prodotto_nome: e.target.value }))}
                />
              </div>
            </div>

            {/* CIG (solo Ente) + Vincolo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(t.cliente_anagrafica?.gruppi_finanziari?.tipo_soggetto === "ente" || t.cliente_anagrafica?.tipo_cliente === "ente") && (
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    CIG/Rif. <span className="text-destructive" title="Obbligatorio per Enti">*</span>
                  </Label>
                  <Input
                    value={contrattoForm.cig_rif}
                    onChange={(e) => setContrattoForm(p => ({ ...p, cig_rif: e.target.value.toUpperCase() }))}
                    maxLength={contrattoForm.cig_temporaneo ? 40 : 10}
                    placeholder={contrattoForm.cig_temporaneo ? "CIG temporaneo" : "10 caratteri alfanumerici"}
                    className="h-8 text-xs font-mono"
                  />
                  <div className="flex items-center gap-2 mt-1">
                    <Checkbox
                      id="cig-temp-detail"
                      checked={contrattoForm.cig_temporaneo}
                      disabled={cigTemporaneoLoading}
                      onCheckedChange={(v) => void onCigTemporaneoChange(v === true)}
                    />
                    <Label htmlFor="cig-temp-detail" className="text-[10px] cursor-pointer">
                      CIG temporaneo (formato libero){cigTemporaneoLoading ? "…" : ""}
                    </Label>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Vincolo</Label>
                <SearchableSelect
                  className="h-8 text-xs"
                  value={contrattoForm.vincolo}
                  onValueChange={(v) => setContrattoForm(p => ({ ...p, vincolo: v }))}
                  placeholder="— Specificare vincolo —"
                  options={[
                    { value: "nessuno", label: "Nessuno" },
                    { value: "ipoteca", label: "Ipoteca" },
                    { value: "leasing", label: "Leasing" },
                    { value: "pegno", label: "Pegno" },
                    { value: "cessione", label: "Cessione" },
                    { value: "altro", label: "Altro" },
                  ]}
                />
              </div>
            </div>

            {/* Descrizione */}
            <div className="space-y-1.5">
              <Label className="text-xs">Descrizione</Label>
              <Textarea
                className="text-xs"
                value={contrattoForm.descrizione_polizza}
                onChange={(e) => setContrattoForm(p => ({ ...p, descrizione_polizza: e.target.value }))}
                rows={3}
                maxLength={1000}
              />
            </div>
          </div>
        )}
      </SectionCollapsible>


      {/* PERIODO */}
      <SectionCollapsible title="Periodo" icon={Calendar}>
        <div className="flex justify-end mb-2 gap-2">
          {!editingPeriodo ? (
            <Button variant="ghost" size="sm" onClick={startEditPeriodo} disabled={isLocked} title={isLocked ? "Quietanza messa a cassa: modifiche bloccate" : undefined}>
              <Pencil className="w-4 h-4 mr-1" /> Modifica
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditingPeriodo(false)}>Annulla</Button>
              <Button size="sm" onClick={() => savePeriodoMutation.mutate()} disabled={savePeriodoMutation.isPending}>
                {savePeriodoMutation.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </>
          )}
        </div>

        {!editingPeriodo ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
            <FieldRow label="Durata Da" value={fmtDate(t.durata_da)} />
            <FieldRow label="Durata A" value={fmtDate(t.durata_a)} />
            <FieldRow label="Anni Durata" value={fmt(t.anni_durata)} />
            <FieldRow label="Frazionamento" value={t.polizza_temporanea ? "—" : (t.frazionamento || derivaFrazionamentoDaRate(t.rate, t.anni_durata))} />
            <FieldRow label="Polizza temporanea" value={t.polizza_temporanea ? "Sì" : "No"} />
            <FieldRow label="Polizza rateo" value={t.polizza_rateo ? "Sì" : "No"} />
            <FieldRow label="Garanzia Da" value={fmtDate(t.garanzia_da)} />
            <FieldRow label="Garanzia A" value={fmtDate(t.garanzia_a)} />
            <FieldRow label="Data Competenza" value={fmtDate(t.data_competenza)} />
            <FieldRow label="Data Scadenza" value={fmtDate(t.data_scadenza)} />
            <FieldRow label="Limite Mora" value={fmtDate(t.limite_mora)} />
            <FieldRow label="GG Mora" value={fmt(t.mora_giorni)} />
            <FieldRow label="Tacito Rinnovo" value={t.tacito_rinnovo ? "Sì" : "No"} />
            <FieldRow label="Disdetta (giorni)" value={fmt(t.disdetta_giorni)} />
            <FieldRow label="Riforma alla scadenza" value={t.riforma_alla_scadenza ? "Sì" : "No"} />
            <FieldRow label="Valuta" value={fmt(t.valuta)} />
            <FieldRow label="Indicizzata" value={fmtBool(t.indicizzata)} />
            <FieldRow label="Rimborso" value={fmtBool(t.rimborso)} />
            <FieldRow label="Formato Elettronico" value={fmtBool(t.formato_elettronico)} />
            <FieldRow label="Incassato" value={fmtEuro(t.importo_incassato)} />
            <FieldRow label="Data Incasso" value={fmtDate(t.data_incasso)} />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
            {!t.sostituisce_polizza && (
              <div className="col-span-2 md:col-span-4 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                <Label className="text-xs">Polizza temporanea</Label>
                <div className="flex items-center gap-2 h-9 mt-1">
                  <Switch
                    checked={periodoForm.polizza_temporanea}
                    onCheckedChange={(v) => setPeriodoForm(p => ({
                      ...p,
                      polizza_temporanea: v,
                      polizza_rateo: v ? false : p.polizza_rateo,
                      tacito_rinnovo: v ? false : p.tacito_rinnovo,
                      frazionamento: v ? "" : (p.frazionamento || "Annuale"),
                      rate: v ? "1" : p.rate,
                    }))}
                    disabled={periodoForm.polizza_rateo}
                  />
                  <span className="text-sm text-muted-foreground">
                    {periodoForm.polizza_temporanea ? "Sì — una sola quietanza, senza rinnovi" : "No"}
                  </span>
                </div>
              </div>
            )}
            {!t.sostituisce_polizza && (
              <div className="col-span-2 md:col-span-4 rounded-md border border-blue-500/30 bg-blue-500/5 px-3 py-2">
                <Label className="text-xs">Polizza rateo</Label>
                <div className="flex items-center gap-2 h-9 mt-1">
                  <Switch
                    checked={periodoForm.polizza_rateo}
                    onCheckedChange={(v) => setPeriodoForm(p => ({
                      ...p,
                      polizza_rateo: v,
                      polizza_temporanea: v ? false : p.polizza_temporanea,
                    }))}
                    disabled={periodoForm.polizza_temporanea}
                  />
                  <span className="text-sm text-muted-foreground">
                    {periodoForm.polizza_rateo ? "Sì — primo rateo libero, successive per frazionamento" : "No"}
                  </span>
                </div>
              </div>
            )}
            {([
              ["durata_da", "Durata Da"],
              ["durata_a", "Durata A"],
              ["garanzia_da", "Garanzia Da"],
              ["garanzia_a", "Garanzia A"],
              ["data_competenza", "Data Competenza"],
              ["data_scadenza", "Data Scadenza"],
              ["limite_mora", "Limite Mora"],
            ] as const).map(([field, label]) => (
              <div key={field}>
                <Label className="text-xs">{label}</Label>
                <Input
                  type="date"
                  value={periodoForm[field]?.slice(0, 10) || ""}
                  onChange={(e) => setPeriodoForm(p => {
                    const next: any = { ...p, [field]: e.target.value };
                    if (field === "garanzia_a" && e.target.value) {
                      if (!p.data_scadenza) next.data_scadenza = e.target.value;
                    }
                    if (field === "garanzia_da" && e.target.value) {
                      next.limite_mora = calcLimiteMora(e.target.value, p.mora_giorni);
                    }
                    if (field === "limite_mora" && e.target.value) {
                      next.mora_giorni = calcMoraGiorni(p.garanzia_da, e.target.value);
                    }
                    return next;
                  })}
                />
              </div>
            ))}

            <div>
              <Label className="text-xs">Anni Durata</Label>
              <Input
                type="number"
                step="0.1"
                value={periodoForm.anni_durata}
                onChange={(e) => setPeriodoForm(p => ({ ...p, anni_durata: e.target.value }))}
                disabled={periodoForm.polizza_temporanea}
              />
              {suggestedAnniDurata != null && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground">Suggerito: {suggestedAnniDurata}</span>
                  {isPoliennaleEdit && <Badge variant="secondary" className="text-[10px]">Poliennale</Badge>}
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">Frazionamento</Label>
              <Select
                value={periodoForm.frazionamento || "Annuale"}
                onValueChange={(v) => setPeriodoForm(p => ({ ...p, frazionamento: v }))}
                disabled={periodoForm.polizza_temporanea}
              >
                <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                <SelectContent>
                  {FRAZIONAMENTI.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">GG Mora</Label>
              <Input
                type="number"
                min="0"
                value={periodoForm.mora_giorni}
                onChange={(e) => setPeriodoForm(p => {
                  const v = e.target.value;
                  const next: any = { ...p, mora_giorni: v };
                  next.limite_mora = calcLimiteMora(p.garanzia_da, v);
                  return next;
                })}
                placeholder="15"
              />
            </div>


            <div>
              <Label className="text-xs">Disdetta (giorni)</Label>
              <Input
                type="number"
                min="0"
                value={periodoForm.disdetta_giorni}
                onChange={(e) => setPeriodoForm(p => ({ ...p, disdetta_giorni: e.target.value }))}
                placeholder="60"
              />
            </div>

            <div className="col-span-1">
              <Label className="text-xs">Tacito Rinnovo</Label>
              <div className="flex items-center gap-2 h-9">
                <Switch
                  checked={periodoForm.tacito_rinnovo}
                  onCheckedChange={(v) => setPeriodoForm(p => ({ ...p, tacito_rinnovo: v }))}
                  disabled={periodoForm.polizza_temporanea}
                />
                <span className="text-sm text-muted-foreground">
                  {periodoForm.tacito_rinnovo ? "Sì" : "No"}
                </span>
              </div>
            </div>
            <div className="col-span-1">
              <Label className="text-xs">Riforma alla scadenza</Label>
              <div className="flex items-center gap-2 h-9">
                <Switch
                  checked={periodoForm.riforma_alla_scadenza}
                  onCheckedChange={(v) => setPeriodoForm(p => ({ ...p, riforma_alla_scadenza: v }))}
                />
                <span className="text-sm text-muted-foreground">
                  {periodoForm.riforma_alla_scadenza ? "Sì" : "No"}
                </span>
              </div>
            </div>
          </div>
        )}
      </SectionCollapsible>

      {/* REGOLAZIONE */}
      <SectionCollapsible title="Regolazione" icon={Shield} defaultOpen={false}>
        <div className="flex justify-end mb-2 gap-2">
          {!editingReg ? (
            <Button variant="ghost" size="sm" onClick={startEditReg} disabled={isLocked} title={isLocked ? "Quietanza messa a cassa: modifiche bloccate" : undefined}>
              <Pencil className="w-4 h-4 mr-1" /> Modifica
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditingReg(false)}>Annulla</Button>
              <Button size="sm" onClick={() => saveRegMutation.mutate()} disabled={saveRegMutation.isPending}>
                {saveRegMutation.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </>
          )}
        </div>

        {!editingReg ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
            <FieldRow label="Regolazione" value={fmtBool(t.regolazione)} />
            <div className="col-span-2 md:col-span-3 text-xs">
              <span className="text-muted-foreground">Date presunte: </span>
              <span>
                {(() => {
                  const arr = Array.isArray((t as any).regolazione_date_presunte)
                    ? ((t as any).regolazione_date_presunte as string[])
                    : ((t as any).regolazione_data_presunta
                        ? [(t as any).regolazione_data_presunta as string]
                        : []);
                  if (!arr.length) return "—";
                  return arr.map((d, i) => `Anno ${i + 1}: ${fmtDate(d)}`).join(" · ");
                })()}
              </span>
            </div>
            <div className="col-span-2 md:col-span-4 text-xs space-y-1">
              <span className="text-muted-foreground">Fattori / importi esposti: </span>
              {(titoloRegolazioneFattori as any[]).length === 0 ? (
                <span>
                  {fmt({
                    fatturato: "Fatturato",
                    num_dipendenti: "N° dipendenti",
                    retribuzioni: "Retribuzioni",
                    altro: "Altro",
                  }[(t as any).regolazione_fattore as string] ?? null) || "—"}
                </span>
              ) : (
                <ul className="mt-1 space-y-0.5">
                  {(titoloRegolazioneFattori as any[]).map((row) => {
                    const f = row.fattori_regolazione;
                    return (
                      <li key={row.id} className="tabular-nums">
                        <span className="font-mono">{row.anno}</span>
                        {" · "}
                        {f?.descrizione || f?.codice || "—"}
                        {" · "}
                        {fmtEuro(Number(row.importo_esposto) || 0)}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {(t as any).regolazione_note && (
              <div className="col-span-2 md:col-span-4 text-xs">
                <span className="text-muted-foreground">Note: </span>
                <span>{(t as any).regolazione_note}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-md border bg-muted/40 p-3">
              <Switch
                id="reg-check"
                checked={regForm.regolazione}
                onCheckedChange={(v) => {
                  const on = !!v;
                  setRegForm((p) => {
                    let dates = p.regolazione_date_presunte;
                    if (on && dates.length === 0 && titolo) {
                      dates = computeRegolazioneDatePresunte({
                        durataDa: titolo.durata_da,
                        garanziaDa: titolo.garanzia_da,
                        anniDurata: titolo.anni_durata ?? 1,
                      });
                    }
                    return { ...p, regolazione: on, regolazione_date_presunte: dates };
                  });
                }}
              />
              <Label htmlFor="reg-check" className="font-medium">Polizza in regolazione (promemoria)</Label>
            </div>

            {regForm.regolazione && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-md border border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                <div className="space-y-2 md:col-span-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs">Date presunte regolazione</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={autoFillRegDatePresunte}
                    >
                      Calcola da durata
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {(regForm.regolazione_date_presunte.length
                      ? regForm.regolazione_date_presunte
                      : [""]
                    ).map((date, idx) => (
                      <div key={idx} className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">
                          Anno {idx + 1}
                        </Label>
                        <Input
                          type="date"
                          value={date}
                          onChange={(e) => {
                            const v = e.target.value;
                            setRegForm((p) => {
                              const next = p.regolazione_date_presunte.length
                                ? [...p.regolazione_date_presunte]
                                : [""];
                              while (next.length <= idx) next.push("");
                              next[idx] = v;
                              return { ...p, regolazione_date_presunte: next };
                            });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <RegolazioneFattoriImportiGrid
                  ramoId={regolazioneRamoIdDetail}
                  datePresunte={regForm.regolazione_date_presunte}
                  fattori={regolazioneFattoriLinkedDetail}
                  righe={regRighe}
                  onChange={setRegRighe}
                  loading={loadingRegFattoriDetail}
                  fallbackAnno={
                    titolo?.durata_a
                      ? Number(String(titolo.durata_a).slice(0, 4))
                      : new Date().getFullYear() + 1
                  }
                />
                <div className="space-y-1 md:col-span-3">
                  <Label className="text-xs">Note</Label>
                  <Input
                    value={regForm.regolazione_note}
                    onChange={(e) => setRegForm(p => ({ ...p, regolazione_note: e.target.value }))}
                    placeholder="Eventuali note sul promemoria"
                  />
                </div>
              </div>
            )}
          </div>

        )}
      </SectionCollapsible>
      </>)}

      {/* COMMERCIALE & SPLIT */}
      <SectionCollapsible title="Commerciale & Provvigioni" icon={Percent}>
        {editingComm ? (
          (() => {
            const sumPerc = splitsForm.reduce((acc, s) => acc + (Number(s.percentuale) || 0), 0);
            const aePerc = aeForm.ae_anagrafica_id ? Math.max(0, Number(aeForm.percentuale_ae) || 0) : 0;
            const sumTot = sumPerc + aePerc;
            const consulPerc = Math.max(0, Math.round((100 - sumTot) * 100) / 100);
            const overflow = sumTot > 100.001;
            const dupIds = (() => {
              const seen = new Map<string, number>();
              splitsForm.forEach(s => { if (s.anagrafica_commerciale_id) seen.set(s.anagrafica_commerciale_id, (seen.get(s.anagrafica_commerciale_id) || 0) + 1); });
              return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k));
            })();
            const isChildQuietanza = !!titolo?.sostituisce_polizza;
            return (
              <div className="space-y-3">
                {isChildQuietanza && (
                  <div className="flex items-start gap-3 p-3 rounded-md border bg-violet-50/50 dark:bg-violet-950/10 border-violet-200">
                    <Switch
                      checked={splitPersonalizzatoForm}
                      onCheckedChange={setSplitPersonalizzatoForm}
                    />
                    <div className="flex-1">
                      <Label className="text-xs font-semibold">Provvigioni produttore personalizzate per questa quietanza</Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Se attivo, le percentuali split di questa rata non vengono più sovrascritte dagli aggiornamenti della polizza madre.
                        Disattivandolo, la quietanza torna ad ereditare i valori della madre.
                      </p>
                    </div>
                  </div>
                )}
                <div className={cn("space-y-2", isChildQuietanza && !splitPersonalizzatoForm && "opacity-50 pointer-events-none")}>
                  {splitsForm.length === 0 && (
                    <div className="text-xs text-muted-foreground italic px-3 py-2 border rounded-md bg-muted/30">
                      Nessun produttore — l'intera quota va a Consulbrokers SPA.
                    </div>
                  )}
                  {splitsForm.map((row, idx) => {
                    const sel = anagraficheComm.find(a => a.value === row.anagrafica_commerciale_id);
                    const def = sel?.percentuale_base;
                    const isDup = row.anagrafica_commerciale_id && dupIds.has(row.anagrafica_commerciale_id);
                    return (
                      <div key={idx} className={cn("grid grid-cols-12 gap-2 items-end p-2 border rounded-md", isDup && "border-red-400 bg-red-50 dark:bg-red-950/20")}>
                        <div className="col-span-12 md:col-span-7">
                          <Label className="text-[11px]">Produttore</Label>
                          <SearchableSelect
                            options={anagraficheComm}
                            value={row.anagrafica_commerciale_id || ""}
                            onValueChange={(v) => {
                              const a = anagraficheComm.find(x => x.value === v);
                              setSplitsForm(prev => prev.map((r, i) => i === idx ? {
                                ...r,
                                anagrafica_commerciale_id: v,
                                percentuale: r.percentuale > 0 ? r.percentuale : (a?.percentuale_base || 0),
                              } : r));
                            }}
                            placeholder="Seleziona produttore..."
                          />
                          {isDup && <p className="text-[10px] text-red-600 mt-0.5">Produttore duplicato</p>}
                        </div>
                        <div className="col-span-8 md:col-span-3">
                          <Label className="text-[11px]">% Provvigione</Label>
                          <Input
                            type="number" min={0} max={100} step={0.01}
                            value={row.percentuale}
                            onChange={(e) => setSplitsForm(prev => prev.map((r, i) => i === idx ? { ...r, percentuale: Number(e.target.value) } : r))}
                          />
                          {def != null && Number(def) !== Number(row.percentuale) && (
                            <button type="button" className="text-[10px] text-teal-700 underline hover:no-underline mt-0.5"
                              onClick={() => setSplitsForm(prev => prev.map((r, i) => i === idx ? { ...r, percentuale: Number(def) } : r))}>
                              Usa default ({def}%)
                            </button>
                          )}
                        </div>
                        <div className="col-span-4 md:col-span-2 flex justify-end">
                          <Button size="sm" variant="ghost" type="button"
                            onClick={() => setSplitsForm(prev => prev.filter((_, i) => i !== idx))}>
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Button size="sm" variant="outline" type="button"
                  disabled={isChildQuietanza && !splitPersonalizzatoForm}
                  onClick={() => setSplitsForm(prev => [...prev, { anagrafica_commerciale_id: null, commerciale_user_id: null, percentuale: 0 }])}>
                  + Aggiungi produttore
                </Button>

                {/* Account Executive — ereditato dalla madre sulle quietanze; non personalizzabile */}
                <div className={cn(
                  "grid grid-cols-12 gap-2 items-end p-2 border rounded-md bg-sky-50/40 dark:bg-sky-950/10",
                  isChildQuietanza && "opacity-60 pointer-events-none",
                )}>
                  <div className="col-span-12 md:col-span-7">
                    <Label className="text-[11px]">Account Executive {isChildQuietanza && <span className="text-muted-foreground font-normal">(dalla polizza madre)</span>}</Label>
                    <SearchableSelect
                      options={[{ value: "", label: "— Nessun AE —" }, ...aeLookup]}
                      value={aeForm.ae_anagrafica_id || ""}
                      onValueChange={(v) => setAeForm(p => ({ ...p, ae_anagrafica_id: v || null }))}
                      placeholder="Seleziona Account Executive..."
                    />
                  </div>
                  <div className="col-span-12 md:col-span-5">
                    <Label className="text-[11px]">% AE</Label>
                    <Input
                      type="number" min={0} max={100} step={0.01}
                      value={aeForm.percentuale_ae}
                      onChange={(e) => setAeForm(p => ({ ...p, percentuale_ae: Number(e.target.value) || 0 }))}
                      disabled={!aeForm.ae_anagrafica_id}
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div className={cn("p-3 rounded-md border text-sm", overflow ? "border-red-400 bg-red-50 dark:bg-red-950/20 text-red-800" : "bg-muted/40")}>
                  <div className="flex justify-between"><span>Totale produttori:</span> <strong className="font-mono tabular-nums">{sumPerc.toFixed(2)}%</strong></div>
                  {aePerc > 0 && (
                    <div className="flex justify-between"><span>Account Executive:</span> <strong className="font-mono tabular-nums">{aePerc.toFixed(2)}%</strong></div>
                  )}
                  <div className="flex justify-between"><span>Consulbrokers SPA (residuo):</span> <strong className="font-mono tabular-nums">{consulPerc.toFixed(2)}%</strong></div>
                  {overflow && <div className="text-xs mt-1">⚠ La somma (Produttori + AE) supera 100% — riduci le percentuali per salvare.</div>}
                </div>

                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveCommMutation.mutate()}
                    disabled={saveCommMutation.isPending || overflow || dupIds.size > 0}>
                    {saveCommMutation.isPending ? "Salvataggio..." : "Salva"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingComm(false)}>Annulla</Button>
                </div>
              </div>
            );
          })()
        ) : (
          <>
            {(() => {
              const provvF = t.provvigioni_firma;
              const provvQ = t.provvigioni_quietanza;
              // Costruisci lista effettiva produttori (DB splits con fallback legacy)
              type EffSplit = { id?: string; anagrafica_commerciale_id: string | null; name: string; perc: number; isAdmin: boolean };
              const effective: EffSplit[] = (titoloSplits && titoloSplits.length > 0)
                ? titoloSplits.map((s: any) => {
                    const a = s.anagrafica;
                    const name = a ? (a.ragione_sociale || `${a.cognome || ""} ${a.nome || ""}`.trim()) : "—";
                    return {
                      id: s.id,
                      anagrafica_commerciale_id: s.anagrafica_commerciale_id,
                      name,
                      perc: Number(s.percentuale) || 0,
                      isAdmin: !!adminAnagraficaId && s.anagrafica_commerciale_id === adminAnagraficaId,
                    };
                  })
                : (t.anagrafica_commerciale_id ? [{
                    anagrafica_commerciale_id: t.anagrafica_commerciale_id,
                    name: (() => {
                      const a: any = t.anagrafica_commerciale;
                      return a ? (a.ragione_sociale || `${a.cognome || ""} ${a.nome || ""}`.trim()) : (t.produttore_nome || "—");
                    })(),
                    perc: t.percentuale_commerciale ?? 100,
                    isAdmin: !!adminAnagraficaId && t.anagrafica_commerciale_id === adminAnagraficaId,
                  }] : []);

              const sumPerc = effective.reduce((a, s) => a + s.perc, 0);
              const aePercDisp = Number(t.percentuale_ae) || 0;
              const aeIdDisp = t.ae_anagrafica_id;
              const aeNameDisp = t.ae_nome || "—";
              const consulPerc = Math.max(0, Math.round((100 - sumPerc - aePercDisp) * 100) / 100);
              const hasAdminInList = effective.some(e => e.isAdmin);

              return (
                <div className="space-y-3">
                  {!!(t as any).split_personalizzato && (
                    <div className="text-xs px-3 py-2 rounded-md bg-violet-50 border border-violet-200 text-violet-900 flex items-center gap-2">
                      <Percent className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Provvigioni produttore <strong>personalizzate</strong> per questa quietanza: non seguono gli aggiornamenti della polizza madre.</span>
                    </div>
                  )}
                  {hasAdminInList && (
                    <div className="text-xs px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-amber-900">
                      Uno dei produttori è Consulbrokers SPA (admin) → la sua quota è <strong>solo statistica</strong> e va sommata al residuo agenzia.
                    </div>
                  )}

                  <div className="space-y-2">
                    {effective.map((e, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-teal-50 to-transparent dark:from-teal-950/20 border">
                        <div className="w-9 h-9 rounded-full bg-teal-600 text-white flex items-center justify-center flex-shrink-0">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] uppercase font-semibold text-muted-foreground">Produttore {i + 1}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-600 text-white font-mono">{e.perc}%</span>
                            {e.isAdmin && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">statistico</span>}
                          </div>
                          <div className="text-sm font-semibold truncate">{e.name}</div>
                        </div>
                      </div>
                    ))}
                    {aeIdDisp && aePercDisp > 0 && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-sky-50 to-transparent dark:from-sky-950/20 border border-sky-200">
                        <div className="w-9 h-9 rounded-full bg-sky-600 text-white flex items-center justify-center flex-shrink-0">
                          <UserCheck className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] uppercase font-semibold text-muted-foreground">Account Executive</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-600 text-white font-mono">{aePercDisp}%</span>
                          </div>
                          <div className="text-sm font-semibold truncate">{aeNameDisp}</div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-950/20 border border-amber-200">
                      <div className="w-9 h-9 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] uppercase font-semibold text-muted-foreground">Quota Agenzia (residuo)</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-mono">{consulPerc}%</span>
                        </div>
                        <div className="text-sm font-semibold truncate">Consulbrokers SPA</div>
                      </div>
                    </div>
                  </div>


                  {(provvF == null && provvQ == null) && (
                    <div className="text-xs text-muted-foreground italic">Nessuna provvigione impostata. Le card di split appariranno sotto i premi nella sezione "Importi".</div>
                  )}
                </div>
              );
            })()}
            <Button size="sm" variant="outline" className="mt-3" onClick={startEditComm} disabled={isLocked} title={isLocked ? "Quietanza messa a cassa: modifiche bloccate" : undefined}>
              <Pencil className="w-3 h-3 mr-1" /> Modifica
            </Button>
          </>
        )}
      </SectionCollapsible>

      {/* IMPORTI */}
      {(() => {
        // Helper di split provvigioni multi-produttore riusato nella sezione Importi
        type EffSplit = { name: string; perc: number; isAdmin: boolean };
        const effective: EffSplit[] = (titoloSplits && titoloSplits.length > 0)
          ? titoloSplits.map((s: any) => {
              const a = s.anagrafica;
              const name = a ? (a.ragione_sociale || `${a.cognome || ""} ${a.nome || ""}`.trim()) : "—";
              return {
                name,
                perc: Number(s.percentuale) || 0,
                isAdmin: !!adminAnagraficaId && s.anagrafica_commerciale_id === adminAnagraficaId,
              };
            })
          : (t.anagrafica_commerciale_id ? [{
              name: (() => {
                const a: any = t.anagrafica_commerciale;
                return a ? (a.ragione_sociale || `${a.cognome || ""} ${a.nome || ""}`.trim()) : (t.produttore_nome || "—");
              })(),
              perc: t.percentuale_commerciale ?? 100,
              isAdmin: !!adminAnagraficaId && t.anagrafica_commerciale_id === adminAnagraficaId,
            }] : []);
        const sumPerc = effective.reduce((a, s) => a + s.perc, 0);
        const consulPerc = Math.max(0, Math.round((100 - sumPerc) * 100) / 100);

        const renderSplitImporti = (title: string, provv: number | null | undefined, accent: "teal" | "amber") => {
          if (provv == null || provv === 0) return null;
          // Importi per produttore + residuo agenzia
          const rows = effective.map(e => ({
            name: e.name,
            pct: e.perc,
            importo: Math.round((provv * e.perc) / 100 * 100) / 100,
            isAdmin: e.isAdmin,
          }));
          const importoConsulResiduo = Math.round((provv * consulPerc) / 100 * 100) / 100;
          // Quota economica admin = residuo + somme delle righe isAdmin (statistiche)
          const adminEcon = importoConsulResiduo + rows.filter(r => r.isAdmin).reduce((a, r) => a + r.importo, 0);
          return (
            <div className="rounded-lg border bg-card p-3 space-y-2 mt-3">
              <div className="flex items-center justify-between">
                <span className={cn("text-[11px] uppercase font-bold tracking-wide", accent === "teal" ? "text-teal-700 dark:text-teal-300" : "text-amber-700 dark:text-amber-300")}>{title}</span>
                <span className="font-mono tabular-nums text-sm font-semibold">{fmtEuro(provv)}</span>
              </div>
              <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
                {rows.map((r, i) => (
                  <div key={i} className="bg-teal-600" style={{ width: `${r.pct}%`, opacity: 1 - i * 0.15 }} />
                ))}
                <div className="bg-amber-500 flex-1" />
              </div>
              <div className="grid grid-cols-1 gap-1 text-xs">
                {rows.map((r, i) => (
                  <div key={i} className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-teal-600 flex-shrink-0" />
                    <span className="text-muted-foreground truncate">
                      {r.name} <span className="opacity-60">({r.pct}%)</span>
                      {r.isAdmin && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-800">stat</span>}
                    </span>
                    <span className="ml-auto font-mono tabular-nums text-teal-900 dark:text-teal-200 font-semibold">{fmtEuro(r.importo)}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5 min-w-0 pt-1 border-t mt-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                  <span className="text-muted-foreground truncate">Consulbrokers SPA <span className="opacity-60">({consulPerc}%)</span></span>
                  <span className="ml-auto font-mono tabular-nums text-amber-900 dark:text-amber-200 font-semibold">{fmtEuro(adminEcon)}</span>
                </div>
              </div>
            </div>
          );
        };
        const sFirma = t.provvigioni_firma;
        const sQui = t.provvigioni_quietanza;
        const fTot = premiDisplayTotals?.firma;
        const qTot = premiDisplayTotals?.quietanza;
        /** Usa totale garanzia se sul titolo manca (0/null) — tipico dopo import. */
        const prefer = (stored: number | null | undefined, computed: number | undefined, hasRows?: boolean) => {
          const s = stored == null || Number.isNaN(Number(stored)) ? null : Number(stored);
          if (hasRows && computed != null && (s == null || s === 0) && computed > 0) return computed;
          return s ?? (hasRows ? computed ?? null : null);
        };
        const preferLordo = (
          storedLordo: number | null | undefined,
          storedNetto: number | null | undefined,
          storedTasse: number | null | undefined,
          computed: PremiGaranziaDisplayTotals | undefined,
        ) => {
          const s = storedLordo == null ? null : Number(storedLordo);
          if (!computed?.hasRows || !(computed.lordo > 0)) return s;
          const tasseStored = Number(storedTasse) || 0;
          const nettoStored = Number(storedNetto) || 0;
          if (tasseStored === 0 && computed.tasse > 0 && s != null && Math.abs(s - nettoStored) < 0.02) {
            return computed.lordo;
          }
          return prefer(s, computed.lordo, true);
        };
        /** In modifica: totali live dalle garanzie; in lettura: prefer titolo/garanzia. */
        const pick = (stored: number | null | undefined, computed: number | undefined, hasRows?: boolean) => {
          if (editingImporti && hasRows && computed != null) return computed;
          return prefer(stored, computed, hasRows);
        };
        const pickLordo = (
          storedLordo: number | null | undefined,
          storedNetto: number | null | undefined,
          storedTasse: number | null | undefined,
          computed: PremiGaranziaDisplayTotals | undefined,
        ) => {
          if (editingImporti && computed?.hasRows) return computed.lordo;
          return preferLordo(storedLordo, storedNetto, storedTasse, computed);
        };
        const nettoF = pick(t.premio_netto, fTot?.netto, fTot?.hasRows);
        const tasseF = pick(t.tasse, fTot?.tasse, fTot?.hasRows);
        const lordoF = pickLordo(t.premio_lordo, t.premio_netto, t.tasse, fTot);
        const provvF = pick(t.provvigioni_firma, fTot?.provvigioni, fTot?.hasRows);
        const nettoQ = pick(t.premio_netto_quietanza, qTot?.netto, qTot?.hasRows);
        const tasseQ = pick(t.tasse_quietanza, qTot?.tasse, qTot?.hasRows);
        const lordoStoredQ = (Number(t.premio_netto_quietanza) || 0) + (Number(t.tasse_quietanza) || 0);
        const lordoQ = pickLordo(
          lordoStoredQ > 0 ? lordoStoredQ : null,
          t.premio_netto_quietanza,
          t.tasse_quietanza,
          qTot,
        );
        const provvQ = pick(
          t.provvigioni_quietanza,
          qTot?.hasRows ? qTot.provvigioni : fTot?.provvigioni,
          qTot?.hasRows || fTot?.hasRows,
        );
        const splitF = provvF ?? sFirma;
        const splitQ = provvQ ?? sQui;
        return (
      <SectionCollapsible title="Importi" icon={DollarSign}>
        <div className="flex justify-between items-center mb-2 gap-2">
          {isPolizzaMadre && !t.polizza_temporanea ? (
            <p className="text-[11px] text-muted-foreground italic">
              L'importo firma è netto + tasse + SSN + accessori. Modificalo dal titolo in alto o da <b>Modifica</b>.
            </p>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap gap-2">
            {isPolizzaMadre && (
              <Button
                variant="outline"
                size="sm"
                disabled={importiLocked}
                onClick={() => { void premiBlockRef.current?.copiaInQuietanza(); }}
                title="Copia i dati della polizza nella quietanza figlia anche dopo la creazione"
              >
                Copia in Quietanza
              </Button>
            )}
            {!editingImporti ? (
              <Button variant="ghost" size="sm" onClick={startEditImporti} disabled={importiLocked} title={importiLocked ? (isPolizzaMadre ? "Polizza stornata: modifiche bloccate" : "Quietanza messa a cassa: modifiche bloccate") : undefined}>
                <Pencil className="w-4 h-4 mr-1" /> Modifica
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => {
                  void (async () => {
                    await premiBlockRef.current?.revertDraft();
                    setEditingImporti(false);
                  })();
                }}>Annulla</Button>
                <Button size="sm" onClick={() => saveImportiMutation.mutate()} disabled={saveImportiMutation.isPending}>
                  {saveImportiMutation.isPending ? "Salvataggio..." : "Salva"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Totali premi/provvigioni sempre visibili (view + edit) */}
        <div className={`mb-4 grid grid-cols-1 ${nascondiPremioQuietanza ? "" : "sm:grid-cols-2"} gap-2`}>
          <div className="rounded-md border border-teal-300 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/30 px-3 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-teal-800 dark:text-teal-200">Firma</span>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
              <span>
                <span className="text-[10px] text-muted-foreground uppercase mr-1">Premio lordo</span>
                <span className="font-mono font-semibold tabular-nums">{fmtEuro(lordoF)}</span>
              </span>
              <span>
                <span className="text-[10px] text-muted-foreground uppercase mr-1">Provvigioni</span>
                <span className="font-mono font-semibold tabular-nums">{fmtEuro(provvF)}</span>
              </span>
            </div>
          </div>
          {!nascondiPremioQuietanza && (
            <div className="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 px-3 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">Quietanza</span>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
                <span>
                  <span className="text-[10px] text-muted-foreground uppercase mr-1">Premio lordo</span>
                  <span className="font-mono font-semibold tabular-nums">{fmtEuro(lordoQ)}</span>
                </span>
                <span>
                  <span className="text-[10px] text-muted-foreground uppercase mr-1">Provvigioni</span>
                  <span className="font-mono font-semibold tabular-nums">{fmtEuro(provvQ)}</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {!editingImporti ? (
          <div className="space-y-4">
            {/* Dettaglio Firma / Quietanza (netto, tasse, brokeraggio, split) */}
            <div className={`grid grid-cols-1 ${nascondiPremioQuietanza ? "" : "md:grid-cols-2"} gap-4`}>
              <div className="rounded-md border border-teal-200 dark:border-teal-900 bg-teal-50/50 dark:bg-teal-950/20 p-3">
                <h4 className="text-xs font-bold uppercase mb-2 text-teal-800 dark:text-teal-200">Premio alla Firma</h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div><div className="text-[10px] text-muted-foreground uppercase">Netto</div><div className="font-mono">{fmtEuro(nettoF)}</div></div>
                  <div><div className="text-[10px] text-muted-foreground uppercase">Tasse</div><div className="font-mono">{fmtEuro(tasseF)}</div></div>
                  <div><div className="text-[10px] text-muted-foreground uppercase">Lordo</div><div className="font-mono font-semibold">{fmtEuro(lordoF)}</div></div>
                </div>
                <div className="mt-2 pt-2 border-t border-teal-200 dark:border-teal-900">
                  <FieldRow label="Provvigioni" value={fmtEuro(provvF)} />
                  <FieldRow label="Brokeraggio" value={fmtEuro(t.brokeraggio_firma)} />
                  {renderSplitImporti("Split", splitF, "teal")}
                </div>
              </div>
              {!nascondiPremioQuietanza && (
              <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                <h4 className="text-xs font-bold uppercase mb-2 text-amber-800 dark:text-amber-200">Premio alla Quietanza</h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div><div className="text-[10px] text-muted-foreground uppercase">Netto</div><div className="font-mono">{fmtEuro(nettoQ)}</div></div>
                  <div><div className="text-[10px] text-muted-foreground uppercase">Tasse</div><div className="font-mono">{fmtEuro(tasseQ)}</div></div>
                  <div><div className="text-[10px] text-muted-foreground uppercase">Lordo</div><div className="font-mono font-semibold">{fmtEuro(lordoQ)}</div></div>
                </div>
                <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-900">
                  <FieldRow label="Provvigioni" value={fmtEuro(provvQ)} />
                  <FieldRow label="Brokeraggio" value={fmtEuro(t.brokeraggio_quietanza)} />
                  {renderSplitImporti("Split", splitQ, "amber")}
                </div>
              </div>
              )}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground pt-2 border-t">
              <span>Valuta: <strong className="text-foreground">{t.valuta || "EUR"}</strong></span>
              <span>Indicizzata: <strong className="text-foreground">{t.indicizzata ? "Sì" : "No"}</strong></span>
              <span>Rimborso: <strong className="text-foreground">{t.rimborso ? "Sì" : "No"}</strong></span>
              <span>Formato Elettronico: <strong className="text-foreground">{t.formato_elettronico ? "Sì" : "No"}</strong></span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs px-3 py-2 rounded-md bg-blue-50 border border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-200">
              ℹ️ Modifica premi, garanzie, valuta e brokeraggio qui sotto. Premi <strong>Salva</strong> in alto per confermare tutte le modifiche.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Valuta</Label>
                <SearchableSelect
                  options={valutaOpts}
                  value={importiForm.valuta}
                  onValueChange={(v) => setImportiForm({ ...importiForm, valuta: v, cambio: "1" })}
                  placeholder="Valuta"
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={importiForm.indicizzata}
                  onCheckedChange={(c) => setImportiForm({ ...importiForm, indicizzata: c })} />
                <Label className="text-xs">Indicizzata</Label>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={importiForm.rimborso}
                  onCheckedChange={(c) => setImportiForm({ ...importiForm, rimborso: c })} />
                <Label className="text-xs">Rimborso</Label>
              </div>
            </div>

            {/* Brokeraggio — quota del Produttore (default da % Provv. Consulenza) */}
            <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="text-xs font-semibold uppercase text-primary">Brokeraggio</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">% Brokeraggio</Label>
                  <Input
                    type="number" step="0.01" min="0" max="100"
                    value={importiForm.percentuale_brokeraggio}
                    onChange={(e) => setImportiForm({ ...importiForm, percentuale_brokeraggio: e.target.value })}
                    className="h-8 text-xs font-mono"
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label className="text-xs">Brokeraggio Firma €</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    value={importiForm.brokeraggio_firma}
                    onChange={(e) => setImportiForm({ ...importiForm, brokeraggio_firma: e.target.value })}
                    className="h-8 text-xs font-mono"
                    placeholder="0,00"
                  />
                </div>
                {!nascondiPremioQuietanza && (
                <div>
                  <Label className="text-xs">Brokeraggio Quietanza €</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    value={importiForm.brokeraggio_quietanza}
                    onChange={(e) => setImportiForm({ ...importiForm, brokeraggio_quietanza: e.target.value })}
                    className="h-8 text-xs font-mono"
                    placeholder="0,00"
                  />
                </div>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                Default da <b>% Provv. Consulenza</b> del Produttore. Modifica % per ricalcolare manualmente gli importi (Netto Firma/Quietanza × %).
              </p>
            </div>
          </div>
        )}

        {/* Composizione voci per garanzia — Firma + Quietanza.
            Stesso componente di ImmissionePolizzaPage: SSN per riga (rami.ssn_attivo),
            provvigioni con 2 decimali, totale lordo = netto + tasse + ssn + addizionali. */}
        <div className="mt-6 pt-4 border-t-2 border-dashed border-teal-200 dark:border-teal-900 space-y-4">
          <TitoloImportiPremiBlock
            ref={premiBlockRef}
            titoloId={t.id}
            gruppoRamoId={t.ramo?.gruppo_ramo_id || null}
            ramoDescrizione={t.ramo?.descrizione || null}
            isLocked={importiLocked}
            draftMode={editingImporti}
            showQuietanza={!nascondiPremioQuietanza}
            hideFirma={isQuietanzaCorrente && rataIndex > 1}
            appendiceMode={isAppendiceTitolo}
            fallbackPremiTitoloId={
              isQuietanzaCorrente && madre?.id && madre.id !== t.id ? madre.id : null
            }
            addizionaliFirma={t.addizionali}
            addizionaliQuietanza={t.addizionali_quietanza}
            provvigioniFirma={t.provvigioni_firma}
            provvigioniQuietanza={t.provvigioni_quietanza}
            onDisplayTotalsChange={setPremiDisplayTotals}
          />
          {(t.coassicurazione || madre?.coassicurazione) && riparto.length >= 2 && (
            <>
              <p className="text-[11px] text-teal-800 dark:text-teal-200 bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/80 rounded px-2 py-1.5">
                <Users className="inline w-3.5 h-3.5 mr-1" />
                Coassicurazione: le quote restano quelle della polizza madre; gli importi si ricalcolano automaticamente al salvataggio dei premi.
              </p>
              <CoassicurazioneImportiBreakdown
                ripartoRows={ripartoRowsFromDettaglio(riparto)}
                compagnieList={coassCompagnie as any[]}
                gruppiCompagniaList={coassGruppi as any[]}
                totNetto={Number(t.premio_netto) || 0}
                totAccessori={Number(t.addizionali) || 0}
                totTasse={Number(t.tasse) || 0}
                totSsn={Number(t.ssn_firma) || 0}
                lordo={Number(t.premio_lordo) || 0}
                provvFirma={Number(t.provvigioni_quietanza ?? t.provvigioni_firma) || 0}
              />
            </>
          )}
          {renderSplitImporti(isAppendiceTitolo ? "Provvigioni" : "Provvigioni alla Firma", sFirma, "teal")}
          {!nascondiPremioQuietanza && renderSplitImporti("Provvigioni Quietanza", sQui, "amber")}
        </div>
      </SectionCollapsible>
        );
      })()}


      {!isAppendiceTitolo && (<>
      {/* NUMERI POLIZZA STORICI */}
      {numeriStorici.length > 0 && (
        <SectionCollapsible title="Numeri polizza storici" icon={RefreshCw} defaultOpen={false}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Causale</TableHead>
                <TableHead>Numero precedente</TableHead>
                <TableHead>Numero nuovo</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {numeriStorici.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="tabular-nums">{r.cambiato_il ? new Date(r.cambiato_il).toLocaleString("it-IT") : "—"}</TableCell>
                  <TableCell className="capitalize">{r.causale}</TableCell>
                  <TableCell className="font-mono">{r.numero_precedente}</TableCell>
                  <TableCell className="font-mono font-semibold">{r.numero_nuovo}</TableCell>
                  <TableCell className="text-muted-foreground">{r.motivo || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCollapsible>
      )}

      {/* SOSTITUZIONI / STORNI */}
      {(t.sostituisce_polizza || t.storno_polizza) && (
        <SectionCollapsible title="Sostituzioni / Storni" icon={RefreshCw} defaultOpen={false}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1">
            <FieldRow label="Sostituisce Polizza" value={fmt(t.sostituisce_polizza)} />
            <FieldRow label="Storno Polizza" value={fmt(t.storno_polizza)} />
          </div>
        </SectionCollapsible>
      )}

      {/* DETTAGLIO RIPARTO */}
      <SectionCollapsible title="Dettaglio Riparto" icon={LayoutGrid} defaultOpen={!!t.coassicurazione}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agenzia</TableHead>
              <TableHead className="text-right">Quota %</TableHead>
              <TableHead className="text-right">Netto</TableHead>
              <TableHead className="text-right">Add.</TableHead>
              <TableHead className="text-right">Tasse</TableHead>
              <TableHead className="text-right">Totale</TableHead>
              <TableHead className="text-right">Provv. Netto</TableHead>
              <TableHead>Pag.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {riparto.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.compagnie?.nome || "—"}</TableCell>
                <TableCell className="text-right font-mono">{r.quota_percentuale}%</TableCell>
                <TableCell className="text-right font-mono">{fmtEuro(r.netto)}</TableCell>
                <TableCell className="text-right font-mono">{fmtEuro(r.addizionali)}</TableCell>
                <TableCell className="text-right font-mono">{fmtEuro(r.tasse)}</TableCell>
                <TableCell className="text-right font-mono">{fmtEuro(r.totale)}</TableCell>
                <TableCell className="text-right font-mono">{fmtEuro(r.provv_netto)}</TableCell>
                <TableCell>{r.tipo_pagamento || "—"}</TableCell>
              </TableRow>
            ))}
            {riparto.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nessun riparto</TableCell></TableRow>}
          </TableBody>
        </Table>
      </SectionCollapsible>

      {/* DETTAGLIO MOVIMENTI */}
      <SectionCollapsible title="Dettaglio Movimenti" icon={List}>
        <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data Mov.</TableHead>
                <TableHead>Effetto</TableHead>
                <TableHead>Scadenza</TableHead>
                <TableHead>Rinnovo</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead>Val</TableHead>
                <TableHead className="text-right">Premio</TableHead>
                <TableHead className="text-right">Provv.</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="w-12">Inc</TableHead>
                <TableHead>Copertura</TableHead>
                <TableHead>Incasso</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimentiPolizza.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs">{fmtDate(m.data_movimento)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(m.data_effetto)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(m.data_scadenza)}</TableCell>
                  <TableCell className="text-xs">{fmt(m.tipo_rinnovo)}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{fmt(m.descrizione)}</TableCell>
                  <TableCell className="text-xs">{m.valuta || "EUR"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{fmtEuro(m.premio)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{fmtEuro(m.provvigioni)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{m.tipo}</Badge></TableCell>
                  <TableCell className="text-center">{m.incassato ? "✓" : ""}</TableCell>
                  <TableCell className="text-xs">{fmtDate(m.data_copertura)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(m.data_incasso)}</TableCell>
                  <TableCell><Badge variant={m.stato === "attivo" ? "default" : "secondary"} className="text-[10px]">{m.stato}</Badge></TableCell>
                </TableRow>
              ))}
              {movimentiPolizza.length === 0 && (
                <TableRow><TableCell colSpan={15} className="text-center text-muted-foreground">Nessun movimento registrato</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
      </SectionCollapsible>

      {/* === SEZIONE DATI VEICOLO / RCA AUTO ===
          Visibile solo se il ramo della polizza è di tipo Auto/Veicoli,
          oppure (caso legacy) se esiste già un record veicoli_polizza collegato. */}
      {(isRamoAuto(t.ramo) || veicolo) && (
      <SectionCollapsible title={isRamoNatante(t.ramo) ? "Dati Natante / Imbarcazione" : "Dati Veicolo (RCA Auto)"} icon={Car}>
        <div className="flex justify-between items-center mb-2 gap-2">
          <div>
            {!isRamoAuto(t.ramo) && veicolo && (
              <Badge variant="outline" className="text-xs">Dati legacy — ramo non auto</Badge>
            )}
          </div>
          <div className="flex gap-2">
          {!editingVeicolo ? (
            <Button variant="ghost" size="sm" onClick={startEditVeicolo} disabled={isLocked} title={isLocked ? "Quietanza messa a cassa: modifiche bloccate" : undefined}>
              <Pencil className="w-4 h-4 mr-1" /> {veicolo ? "Modifica" : "Aggiungi"}
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditingVeicolo(false)}>Annulla</Button>
              <Button size="sm" onClick={() => saveVeicoloMutation.mutate()} disabled={saveVeicoloMutation.isPending}>
                {saveVeicoloMutation.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </>
          )}
          </div>
        </div>

        {!editingVeicolo ? (
          veicolo ? (
            <div className="space-y-2">
              {/* 1. Identificazione veicolo */}
              <SubBlockTitle>Identificazione veicolo</SubBlockTitle>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
                <FieldRow label="Settore" value={fmt(veicolo.settore)} />
                <FieldRow label="Tipo" value={fmt(veicolo.tipo_veicolo)} />
                <FieldRow label="Uso" value={fmt(rcaUsi.find((o: any) => o.value === veicolo.uso)?.label)} />
                <FieldRow label="Targa" value={fmt(veicolo.targa)} />
                <FieldRow label="Marca" value={fmt(veicolo.marca)} />
                <FieldRow label="Modello" value={fmt(veicolo.modello)} />
                <FieldRow label="Versione" value={fmt(veicolo.versione)} />
                <FieldRow label="Veicolo" value={fmt(veicolo.veicolo_descrizione)} />
                <FieldRow label="Telaio" value={fmt(veicolo.telaio)} />
                <FieldRow label="Immatricolazione" value={fmtDate(veicolo.data_immatricolazione)} />
                <FieldRow label="Anno Acquisto" value={fmt(veicolo.anno_acquisto)} />
                <FieldRow label="Prov. Circolazione" value={fmt(veicolo.provincia_circolazione)} />
              </div>

              {/* 2. Dati tecnici */}
              <SubBlockTitle>Dati tecnici</SubBlockTitle>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
                <FieldRow label="CV" value={fmt(veicolo.cv)} />
                <FieldRow label="KW" value={fmt(veicolo.kw)} />
                <FieldRow label="CC" value={fmt(veicolo.cc)} />
                <FieldRow label="Posti" value={fmt(veicolo.posti)} />
                <FieldRow label="Peso Mot." value={fmt(veicolo.peso_motrice)} />
                <FieldRow label="Peso Rim." value={fmt(veicolo.peso_rimorchio)} />
                <FieldRow label="Peso Tot." value={fmt(veicolo.peso_totale)} />
                <FieldRow label="Alimentazione" value={fmt(veicolo.tipo_alimentazione)} />
                <FieldRow label="Tipologia Guida" value={fmt(veicolo.tipologia_guida)} />
              </div>

              {/* 3. Garanzie e massimali */}
              <SubBlockTitle>Garanzie e massimali</SubBlockTitle>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
                <FieldRow label="Massimale 1" value={fmtEuro(veicolo.massimale_1)} />
                <FieldRow label="Massimale 2" value={fmtEuro(veicolo.massimale_2)} />
                <FieldRow label="Massimale 3" value={fmtEuro(veicolo.massimale_3)} />
                <FieldRow label="Franchigia" value={fmtEuro(veicolo.franchigia)} />
                <FieldRow label="Peius" value={fmtBool(veicolo.peius)} />
                <FieldRow label="Temporanea" value={fmtBool(veicolo.temporanea)} />
                <FieldRow label="Carico/Scarico" value={fmtBool(veicolo.carico_scarico)} />
                <FieldRow label="Rimorchio" value={fmtBool(veicolo.rimorchio)} />
                <FieldRow label="Competizione" value={fmtBool(veicolo.competizione)} />
              </div>

              {/* 4. Bonus / Malus */}
              <SubBlockTitle>Bonus / Malus</SubBlockTitle>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
                <FieldRow label="Classe B/M (CU)" value={fmt(veicolo.classe_bm)} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Nessun dato veicolo. Clicca "Aggiungi" per inserirli.</p>
          )
        ) : (
          <div className="space-y-3">
            {/* 1. Identificazione veicolo */}
            <SubBlockTitle>Identificazione veicolo</SubBlockTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <div><Label className="text-xs">Settore</Label><Input value={veicoloForm.settore} onChange={(e) => setVeicoloForm({ ...veicoloForm, settore: e.target.value })} /></div>
              <div><Label className="text-xs">Tipo Veicolo</Label><SearchableSelect options={TIPI_VEICOLO_OPTS} value={veicoloForm.tipo_veicolo} onValueChange={(v) => setVeicoloForm({ ...veicoloForm, tipo_veicolo: v })} placeholder="Seleziona..." /></div>
              <div>
                <Label className="text-xs">Uso</Label>
                <SearchableSelect options={rcaUsi} value={veicoloForm.uso} onValueChange={(v) => setVeicoloForm({ ...veicoloForm, uso: v })} placeholder="Seleziona..." />
                {veicoloForm.uso && rcaUsi.length > 0 && !rcaUsi.some((o: any) => o.value === veicoloForm.uso) && (
                  <p className="text-xs text-destructive mt-1">⚠ Valore "Uso" non corrispondente a nessuna voce in tabella RCA Usi.</p>
                )}
              </div>
              <div><Label className="text-xs">Targa</Label><Input value={veicoloForm.targa} onChange={(e) => setVeicoloForm({ ...veicoloForm, targa: e.target.value.toUpperCase() })} /></div>
              <div><Label className="text-xs">Marca</Label><Input value={veicoloForm.marca} onChange={(e) => setVeicoloForm({ ...veicoloForm, marca: e.target.value.toUpperCase() })} /></div>
              <div><Label className="text-xs">Modello</Label><Input value={veicoloForm.modello} onChange={(e) => setVeicoloForm({ ...veicoloForm, modello: e.target.value.toUpperCase() })} /></div>
              <div><Label className="text-xs">Versione</Label><Input value={veicoloForm.versione} onChange={(e) => setVeicoloForm({ ...veicoloForm, versione: e.target.value })} /></div>
              <div><Label className="text-xs">Descrizione Veicolo</Label><Input value={veicoloForm.veicolo_descrizione} onChange={(e) => setVeicoloForm({ ...veicoloForm, veicolo_descrizione: e.target.value })} /></div>
              <div><Label className="text-xs">Telaio (VIN)</Label><Input maxLength={17} value={veicoloForm.telaio} onChange={(e) => setVeicoloForm({ ...veicoloForm, telaio: e.target.value.toUpperCase() })} /></div>
              <div><Label className="text-xs">Immatricolazione</Label><Input type="date" value={veicoloForm.data_immatricolazione || ""} onChange={(e) => setVeicoloForm({ ...veicoloForm, data_immatricolazione: e.target.value })} /></div>
              <div><Label className="text-xs">Anno Acquisto</Label><Input type="number" value={veicoloForm.anno_acquisto} onChange={(e) => setVeicoloForm({ ...veicoloForm, anno_acquisto: e.target.value })} /></div>
              <div><Label className="text-xs">Prov. Circolazione</Label><Input maxLength={2} value={veicoloForm.provincia_circolazione} onChange={(e) => setVeicoloForm({ ...veicoloForm, provincia_circolazione: e.target.value.toUpperCase() })} /></div>
            </div>

            {/* 2. Dati tecnici */}
            <SubBlockTitle>Dati tecnici</SubBlockTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <div><Label className="text-xs">CV</Label><Input type="number" value={veicoloForm.cv} onChange={(e) => setVeicoloForm({ ...veicoloForm, cv: e.target.value })} /></div>
              <div><Label className="text-xs">KW</Label><Input type="number" value={veicoloForm.kw} onChange={(e) => setVeicoloForm({ ...veicoloForm, kw: e.target.value })} /></div>
              <div><Label className="text-xs">CC</Label><Input type="number" value={veicoloForm.cc} onChange={(e) => setVeicoloForm({ ...veicoloForm, cc: e.target.value })} /></div>
              <div><Label className="text-xs">Posti</Label><Input type="number" value={veicoloForm.posti} onChange={(e) => setVeicoloForm({ ...veicoloForm, posti: e.target.value })} /></div>
              <div><Label className="text-xs">Peso Motrice (kg)</Label><Input type="number" value={veicoloForm.peso_motrice} onChange={(e) => setVeicoloForm({ ...veicoloForm, peso_motrice: e.target.value })} /></div>
              <div><Label className="text-xs">Peso Rimorchio (kg)</Label><Input type="number" value={veicoloForm.peso_rimorchio} onChange={(e) => setVeicoloForm({ ...veicoloForm, peso_rimorchio: e.target.value })} /></div>
              <div><Label className="text-xs">Peso Totale (kg)</Label><Input type="number" value={veicoloForm.peso_totale} onChange={(e) => setVeicoloForm({ ...veicoloForm, peso_totale: e.target.value })} /></div>
              <div><Label className="text-xs">Alimentazione</Label><SearchableSelect options={ALIMENTAZIONE_OPTS} value={veicoloForm.tipo_alimentazione} onValueChange={(v) => setVeicoloForm({ ...veicoloForm, tipo_alimentazione: v })} placeholder="Seleziona..." /></div>
              <div><Label className="text-xs">Tipologia Guida</Label><SearchableSelect options={TIPOLOGIA_GUIDA_OPTS} value={veicoloForm.tipologia_guida} onValueChange={(v) => setVeicoloForm({ ...veicoloForm, tipologia_guida: v })} placeholder="Seleziona..." /></div>
            </div>

            {/* 3. Garanzie e massimali */}
            <SubBlockTitle>Garanzie e massimali</SubBlockTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <div><Label className="text-xs">Massimale 1 €</Label><Input type="number" step="0.01" value={veicoloForm.massimale_1} onChange={(e) => setVeicoloForm({ ...veicoloForm, massimale_1: e.target.value })} /></div>
              <div><Label className="text-xs">Massimale 2 €</Label><Input type="number" step="0.01" value={veicoloForm.massimale_2} onChange={(e) => setVeicoloForm({ ...veicoloForm, massimale_2: e.target.value })} /></div>
              <div><Label className="text-xs">Massimale 3 €</Label><Input type="number" step="0.01" value={veicoloForm.massimale_3} onChange={(e) => setVeicoloForm({ ...veicoloForm, massimale_3: e.target.value })} /></div>
              <div><Label className="text-xs">Franchigia €</Label><Input type="number" step="0.01" value={veicoloForm.franchigia} onChange={(e) => setVeicoloForm({ ...veicoloForm, franchigia: e.target.value })} /></div>
              <div className="flex items-center gap-2 pt-5"><Switch checked={veicoloForm.peius} onCheckedChange={(v) => setVeicoloForm({ ...veicoloForm, peius: v })} /><Label className="text-xs">Peius</Label></div>
              <div className="flex items-center gap-2 pt-5"><Switch checked={veicoloForm.temporanea} onCheckedChange={(v) => setVeicoloForm({ ...veicoloForm, temporanea: v })} /><Label className="text-xs">Temporanea</Label></div>
              <div className="flex items-center gap-2 pt-5"><Switch checked={veicoloForm.carico_scarico} onCheckedChange={(v) => setVeicoloForm({ ...veicoloForm, carico_scarico: v })} /><Label className="text-xs">Carico/Scarico</Label></div>
              <div className="flex items-center gap-2 pt-5"><Switch checked={!!veicoloForm.rimorchio} onCheckedChange={(v) => setVeicoloForm({ ...veicoloForm, rimorchio: v })} /><Label className="text-xs">Rimorchio</Label></div>
              <div className="flex items-center gap-2 pt-5"><Switch checked={!!veicoloForm.competizione} onCheckedChange={(v) => setVeicoloForm({ ...veicoloForm, competizione: v })} /><Label className="text-xs">Competizione</Label></div>
            </div>

            {/* 4. Bonus / Malus */}
            <SubBlockTitle>Bonus / Malus</SubBlockTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <div><Label className="text-xs">Classe B/M (CU)</Label><SearchableSelect options={CLASSI_BM_OPTS} value={veicoloForm.classe_bm} onValueChange={(v) => setVeicoloForm({ ...veicoloForm, classe_bm: v })} placeholder="Seleziona..." /></div>
            </div>
          </div>
        )}
      </SectionCollapsible>
      )}

      {conducente && (
        <SectionCollapsible title="Dati Conducente" icon={UserCheck}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
            <FieldRow label="Nome" value={fmt(conducente.nome)} />
            <FieldRow label="Cognome" value={fmt(conducente.cognome)} />
            <FieldRow label="Indirizzo" value={fmt(conducente.indirizzo)} />
            <FieldRow label="CAP" value={fmt(conducente.cap)} />
            <FieldRow label="Città" value={fmt(conducente.citta)} />
            <FieldRow label="Provincia" value={fmt(conducente.provincia)} />
            <FieldRow label="Data Nascita" value={fmtDate(conducente.data_nascita)} />
            <FieldRow label="Tipo Patente" value={fmt(conducente.tipo_patente)} />
            <FieldRow label="Rilascio Patente" value={fmtDate(conducente.data_rilascio_patente)} />
            {conducente.note && <div className="col-span-full"><FieldRow label="Note" value={conducente.note} /></div>}
          </div>
        </SectionCollapsible>
      )}

      </>)}

      {/* Tabs */}
      <TitoloTabs
        id={id!}
        t={t}
        movimentiPolizza={movimentiPolizza}
        provvigioni={provvigioni}
        appendiciPolizza={appendiciPolizza}
        navigate={navigate}
        chainIds={isAppendiceTitolo ? [t.id] : chainIds}
        variant={isAppendiceTitolo ? "appendice" : "full"}
      />


      <Dialog open={editNumeroEmittendaOpen} onOpenChange={setEditNumeroEmittendaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifica N° polizza</DialogTitle>
            <DialogDescription>
              {isEmittenda
                ? "Emittenda: il numero si aggiorna su tutte le quietanze/figli della polizza e resta modificabile anche dopo messa a cassa."
                : "Il numero si aggiorna su tutte le quietanze e i titoli collegati della polizza."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">N° Polizza</Label>
            <Input
              value={editNumeroEmittendaValue}
              onChange={(e) => setEditNumeroEmittendaValue(e.target.value)}
              className="h-9 font-mono text-sm"
              placeholder="N° polizza"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditNumeroEmittendaOpen(false)} disabled={editNumeroEmittendaSaving}>
              Annulla
            </Button>
            <Button
              disabled={editNumeroEmittendaSaving}
              onClick={async () => {
                if (isLocked && !isEmittenda) {
                  toast.error("N° polizza bloccato: titolo messo a cassa o stornato");
                  return;
                }
                const nuovo = editNumeroEmittendaValue.trim();
                if (!nuovo) {
                  toast.error("Il N° Polizza è obbligatorio");
                  return;
                }
                if (nuovo === (t.numero_titolo || "").trim()) {
                  setEditNumeroEmittendaOpen(false);
                  return;
                }
                setEditNumeroEmittendaSaving(true);
                try {
                  assertSameTitolo(id, t.id, "emittenda-numero");
                  const dup = await verificaNumeroPolizzaDuplicato(supabase, {
                    numeroTitolo: nuovo,
                    compagniaId: t.compagnia_id || null,
                    excludeTitoloId: t.id,
                  });
                  if (dup.duplicato) {
                    toast.error(`Numero polizza già presente: ${nuovo}`);
                    return;
                  }
                  await aggiornaNumeroPolizza({
                    titoloId: t.id,
                    numeroCorrente: t.numero_titolo,
                    numeroNuovo: nuovo,
                    causale: "emittenda",
                    motivo: isEmittenda ? "Cambio numero polizza emittenda" : "Cambio numero polizza",
                  });
                  toast.success("N° polizza aggiornato");
                  setEditNumeroEmittendaOpen(false);
                  if (editingContratto) {
                    setContrattoForm((p) => ({ ...p, numero_titolo: nuovo }));
                  }
                  queryClient.invalidateQueries({ queryKey: ["titolo", id] });
                  queryClient.invalidateQueries({ queryKey: ["catena-titoli"] });
                } catch (e: any) {
                  toast.error(e?.message || "Errore aggiornamento numero");
                } finally {
                  setEditNumeroEmittendaSaving(false);
                }
              }}
            >
              {editNumeroEmittendaSaving ? "Salvataggio…" : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SospensionePolizzaDialog
        open={sospensioneOpen}
        onOpenChange={setSospensioneOpen}
        titoloId={t.id}
        numeroPolizza={t.numero_titolo || undefined}
        onDone={refreshDopoOperazionePolizza}
      />

      <RiattivazionePolizzaDialog
        open={riattivazioneOpen}
        onOpenChange={setRiattivazioneOpen}
        titoloId={t.id}
        numeroPolizza={t.numero_titolo || undefined}
        onDone={refreshDopoOperazionePolizza}
      />

      <SostituzionePolizzaDialog
        open={sostituzioneOpen}
        onOpenChange={setSostituzioneOpen}
        titoloId={t.id}
        numeroPolizza={t.numero_titolo || undefined}
        onDone={() => queryClient.invalidateQueries({ queryKey: ["titolo", id] })}
      />

      <EstinzionePolizzaDialog
        open={estinzioneOpen}
        onOpenChange={setEstinzioneOpen}
        titoloId={t.id}
        numeroPolizza={t.numero_titolo || undefined}
        onDone={() => queryClient.invalidateQueries({ queryKey: ["titolo", id] })}
      />

      {isLibroMatricolaTitolo && libroMatricolaOwnerId && (
        <LibroMatricolaDialog
          open={matricolaDialogOpen}
          onOpenChange={setMatricolaDialogOpen}
          righe={righeMatricola}
          onChange={setRigheMatricola}
          saving={matricolaSaving}
          onSave={async (righeValideRaw) => {
            try {
              setMatricolaSaving(true);
              const ownerId = libroMatricolaOwnerId;
              if (!ownerId) throw new Error("Titolo libro matricola non trovato");
              const existing = (mezziMatricolaDb || []) as any[];
              const existingIds = new Set(existing.map((r) => r.id as string));
              const righeValide = assignProgressivi(righeValideRaw);
              const keepIds = new Set(righeValide.map((r) => r.id).filter(Boolean) as string[]);

              const toDelete = [...existingIds].filter((x) => !keepIds.has(x));
              if (toDelete.length) {
                const { error: delErr } = await supabase.from("libro_matricola_mezzi").delete().in("id", toDelete);
                if (delErr) throw delErr;
              }

              const saved: LibroMatricolaRiga[] = [];
              for (const r of righeValide) {
                const payload = rigaToDbPayload(r, ownerId);
                if (r.id && existingIds.has(r.id)) {
                  const { error: upErr } = await supabase
                    .from("libro_matricola_mezzi")
                    .update(payload)
                    .eq("id", r.id);
                  if (upErr) throw upErr;
                  saved.push(r);
                } else {
                  const { data: inserted, error: insErr } = await supabase
                    .from("libro_matricola_mezzi")
                    .insert(payload)
                    .select("id")
                    .single();
                  if (insErr) throw insErr;
                  saved.push({ ...r, id: inserted?.id });
                }
              }

              const ops = buildLibroMatricolaOperazioniDiff(existing, saved, toDelete);
              await insertLibroMatricolaOperazioni(ownerId, ops, user?.id || null);

              await refetchMezziMatricola();
              queryClient.invalidateQueries({ queryKey: ["libro-matricola-mezzi", ownerId] });
              toast.success("Libro matricola aggiornato");
              setMatricolaDialogOpen(false);
            } catch (e: any) {
              toast.error(e?.message || "Errore salvataggio libro matricola");
            } finally {
              setMatricolaSaving(false);
            }
          }}
        />
      )}

      {/* RegolazionePremioDialog deprecato: la regolazione ora apre ImmissionePolizzaPage in mode=regolazione */}

      <Dialog open={importoFirmaOpen} onOpenChange={setImportoFirmaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifica importo firma</DialogTitle>
            <DialogDescription>
              Il lordo è la somma di netto, tasse, SSN e accessori. Cambiando il lordo si aggiorna il netto
              (se le altre voci superano il nuovo lordo vengono azzerate).
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Importo firma (lordo)</Label>
              <Input
                type="number"
                step="0.01"
                value={importoFirmaLordo}
                onChange={(e) => {
                  const raw = e.target.value;
                  setImportoFirmaLordo(raw);
                  const n = Number(raw);
                  if (!Number.isNaN(n)) setImportoFirmaForm(vociDaLordoFirma(n, importoFirmaForm));
                }}
                className="h-9 font-mono"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Netto</Label>
              <Input
                type="number"
                step="0.01"
                value={importoFirmaForm.netto}
                onChange={(e) => {
                  const next = { ...importoFirmaForm, netto: Number(e.target.value) || 0 };
                  setImportoFirmaForm(next);
                  setImportoFirmaLordo(String(lordoFirmaDaVoci(next)));
                }}
                className="h-9 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tasse</Label>
              <Input
                type="number"
                step="0.01"
                value={importoFirmaForm.tasse}
                onChange={(e) => {
                  const next = { ...importoFirmaForm, tasse: Number(e.target.value) || 0 };
                  setImportoFirmaForm(next);
                  setImportoFirmaLordo(String(lordoFirmaDaVoci(next)));
                }}
                className="h-9 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>SSN</Label>
              <Input
                type="number"
                step="0.01"
                value={importoFirmaForm.ssn}
                onChange={(e) => {
                  const next = { ...importoFirmaForm, ssn: Number(e.target.value) || 0 };
                  setImportoFirmaForm(next);
                  setImportoFirmaLordo(String(lordoFirmaDaVoci(next)));
                }}
                className="h-9 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Accessori</Label>
              <Input
                type="number"
                step="0.01"
                value={importoFirmaForm.addizionali}
                onChange={(e) => {
                  const next = { ...importoFirmaForm, addizionali: Number(e.target.value) || 0 };
                  setImportoFirmaForm(next);
                  setImportoFirmaLordo(String(lordoFirmaDaVoci(next)));
                }}
                className="h-9 font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportoFirmaOpen(false)} disabled={saveImportoFirmaMutation.isPending}>
              Annulla
            </Button>
            <Button onClick={() => saveImportoFirmaMutation.mutate()} disabled={saveImportoFirmaMutation.isPending}>
              {saveImportoFirmaMutation.isPending ? "Salvataggio..." : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
};

export default TitoloDetail;
