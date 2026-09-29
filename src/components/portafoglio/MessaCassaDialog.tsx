import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckSquare, Wallet, Trash2, Calculator, Printer, FileText, Plus, Users, ArrowLeftRight, Building2, Landmark } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
import { handleNotificaMessaCassaOutcome, scheduleOrInvokeNotificaMessaCassa } from "@/lib/notificaMessaCassa";
import { MessaCassaSeraleCheckbox } from "@/components/portafoglio/MessaCassaSeraleCheckbox";
import ContoBancarioSelect from "@/components/anagrafiche/ContoBancarioSelect";
import { Badge } from "@/components/ui/badge";
import { fmtEuro } from "@/lib/formatCurrency";
import { formatDateIT } from "@/lib/formatDate";
import { useAuth } from "@/contexts/AuthContext";
import { safeId } from "@/lib/safeId";
import { filterContiBancariPerSede, shouldScopeClientiPerSede } from "@/lib/filterContiBancariPerSede";
import { resolveTitoloMadreId } from "@/lib/sospensioneQuietanze";
import CigRifField from "@/components/shared/CigRifField";
import { formatCigBadge, isCigFormatoInvalido, isClienteEnte } from "@/lib/cigEnte";
import { normalizeCig } from "@/lib/validateCig";
import {
  buildTrattenutaCtx,
  calcIncassoConTrattenutaProvvigioni,
  type TrattenutaTitoloCtx,
} from "@/lib/trattenutaProvvigioniIncasso";
import {
  defaultModalitaFromAnagrafica,
  MODALITA_INCASSO_OPTIONS,
  type ModalitaIncasso,
} from "@/lib/modalitaIncasso";
import { buildIncassoDateFields, PENDENTI_OR_GARANTITO_APERTO_FILTER } from "@/lib/garantitoTitolo";
import { filterQuietanzeClienteDaIncassare } from "@/lib/messaCassaQuietanzeCliente";
import { canHaveDataCopertura } from "@/lib/quietanze";
import {
  isPagamentoDirettoCompagnia,
  resolveTipoPagamentoTitoloIncasso,
  TIPO_PAGAMENTO_COMPENSAZIONE,
  TIPO_PAGAMENTO_COSTI_CONSULBROKERS,
  TIPO_PAGAMENTO_DIREITO_COMPAGNIA,
} from "@/lib/incassoTipoPagamento";
import {
  creaAnticipoDaTitoloACredito,
  creditoDaPremioLordo,
  isTitoloACredito,
} from "@/lib/anticipoDaTitoloCredito";
import {
  fetchBonificiCandidatiPerIncasso,
  findBestBonificoApertoPerCliente,
  ricongiungiEFinalizzaBonificiMultipliDaIncasso,
  type BonificoCandidato,
} from "@/lib/bonificoDaIncasso";
import { isBonificoNameMatch } from "@/lib/bonificoMatch";
import { TableScrollArea } from "@/components/shared/TableScrollArea";
import {
  isCausaleAccontoCliente,
  isCausaleCompMessaCassaUi,
  isCausaleMessaCassaMenu,
  isDifferenzaBonificoClassificata,
  rettificaDovutoQuietanza,
} from "@/lib/compensazioniMessaCassa";
import { sumMessaCassaProvvigioni } from "@/lib/messaCassaProvvigioni";
import { MessaCassaProvvigioniDisplay } from "@/components/portafoglio/MessaCassaProvvigioniDisplay";
/**
 * Input importo per riga di compensazione contabile.
 *
 * Mantiene un buffer locale stringa per consentire la digitazione naturale
 * (incluso il separatore decimale italiano `,`), senza che il valore venga
 * riarrotondato a ogni keystroke (cosa che faceva "scattare" il cursore e
 * costringeva ad inserire un numero alla volta).
 *
 * Il parse e la persistenza nello stato globale avvengono solo on blur / Enter.
 */
const ImportoCompensazioneInput = ({
  value,
  autoFocus,
  onCommit,
}: {
  value: number;
  autoFocus?: boolean;
  onCommit: (n: number) => void;
}) => {
  const fmt = (n: number) =>
    !n || Number.isNaN(n) ? "" : n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [text, setText] = useState<string>(() => fmt(value));
  const dirty = useRef(false);

  // Riallinea il buffer quando il valore esterno cambia senza che l'utente stia digitando
  useEffect(() => {
    if (!dirty.current) setText(fmt(value));
  }, [value]);

  const commit = () => {
    dirty.current = false;
    const norm = text.trim().replace(/\./g, "").replace(",", ".");
    const n = Number(norm);
    const safe = Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
    onCommit(safe);
    setText(fmt(safe));
  };

  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="decimal"
        placeholder="0,00"
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => {
          dirty.current = true;
          // accetta solo cifre, separatori . , e spazi (per migliaia)
          const cleaned = e.target.value.replace(/[^\d.,\s]/g, "");
          setText(cleaned);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-32 h-8 text-xs text-right pr-5"
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">€</span>
    </div>
  );
};


interface TitoloMin {
  id: string;
  numero_titolo?: string | null;
  premio_lordo?: number | null;
  cliente_anagrafica_id?: string | null;
  /** Nome display (da Incassi) — evita race sul fetch anagrafica per il match bonifico. */
  cliente_nome_display?: string | null;
  /** Prefill ente (dettaglio titolo) se il fetch CIG non è ancora arrivato. */
  is_ente?: boolean;
  ufficio_id?: string | null;
  importo_incassato?: number | null;
  stato?: string | null;
}

export interface BankIncassoContext {
  movimentoId: string;
  contoBancarioId: string | null;
  dataMovimento: string;
  importoByTitoloId: Record<string, number>;
}

/** Prefill da Incassi: apre in modalità Bonifico con conto/movimento suggeriti (importo non forzato). */
export interface PreferredBonificoContext {
  movimentoId: string;
  contoBancarioId: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titoli: TitoloMin[];
  onSuccess?: (dataMessaCassa: string) => void;
  bankIncasso?: BankIncassoContext;
  preferredBonifico?: PreferredBonificoContext | null;
  /** Prefill pagatore (es. scheda cliente → Quietanze). */
  preferredPagatoreId?: string | null;
}

type EffettoContabile = "standard" | "abbuono" | "pag_diretto_compagnia" | "eccedenza";

interface CompensazioneRow {
  tempId: string;
  causale_id: string;
  causale_codice: string;
  causale_descrizione: string;
  segno: "+" | "-";
  importo: number;
  note: string;
  effetto: EffettoContabile;
}

type CigDraft = {
  cig: string;
  temporaneo: boolean;
  isEnte: boolean;
  original: string;
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;
/** Quadratura stretta: niente tolleranza — delta deve essere 0 (eventuali scostamenti via causali). */
const isBonificoTipo = (tipo: string) => tipo === "bonifico";

interface MovimentoPreview {
  tipo: "entrata" | "uscita";
  categoria: string;
  descrizione: string;
  importo: number;
  titolo?: string;
}

export const MessaCassaDialog = ({
  open,
  onOpenChange,
  titoli: titoliProp,
  onSuccess,
  bankIncasso,
  preferredBonifico = null,
  preferredPagatoreId = null,
}: Props) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  // Lista titoli mutabile: parte dalla selezione iniziale, ma è possibile
  // aggiungere/rimuovere altre quietanze da incassare (anche di altri clienti).
  const [titoli, setTitoli] = useState<TitoloMin[]>(titoliProp);
  const [form, setForm] = useState({
    dataMessaCassa: todayISO(),
    dataPagamento: todayISO(),
    /** Vuoto finché l'utente non sceglie (obbligatorio se c'è cash da incassare). */
    tipoPagamento: "",
    banca: "",
    cashImporto: 0,
  });
  const [anticipiSel, setAnticipiSel] = useState<Record<string, number>>({});
  /** Causali a livello cliente (abbuoni/arrotondamenti/acconti) — non per quietanza. */
  const [compensazioniCliente, setCompensazioniCliente] = useState<CompensazioneRow[]>([]);
  // Ultima riga compensazione aggiunta (per auto-focus sull'importo)
  const [lastAddedCompId, setLastAddedCompId] = useState<string | null>(null);
  // Date specifiche per titolo (override rispetto alle date globali)
  const [datesByTitolo, setDatesByTitolo] = useState<Record<string, { mc: string; pag: string }>>({});
  // Cliente "pagatore" i cui acconti vengono erosi (può differire dai clienti dei titoli)
  const [pagatoreId, setPagatoreId] = useState<string | null>(null);
  const [pagatoreSearch, setPagatoreSearch] = useState("");
  // Ricerca per aggiungere altre quietanze da incassare
  const [titoloSearch, setTitoloSearch] = useState("");
  // Flusso "per cliente": cliente di cui elencare le quietanze da incassare
  const [clienteQuietanze, setClienteQuietanze] = useState<{ id: string; nome: string } | null>(null);
  /** Bonifici scelti dai caricamenti conti (multi-selezione). */
  const [selectedBonificoIds, setSelectedBonificoIds] = useState<string[]>([]);
  const [estrattoSearch, setEstrattoSearch] = useState("");
  /** Se true e ci sono match nome: mostra solo quelli (nasconde gli altri del conto). */
  const [soloMatchNome, setSoloMatchNome] = useState(true);
  const [suggerimentoAltroConto, setSuggerimentoAltroConto] = useState<{
    contoBancarioId: string;
    movimentoId: string;
    ordinante: string | null;
    importo: number;
    contoEtichetta?: string | null;
  } | null>(null);
  const { profile } = useAuth();
  const scopeUfficioId = shouldScopeClientiPerSede(profile?.ruolo, profile?.ufficio_id)
    ? profile!.ufficio_id!
    : null;
  const [clienteQuietanzeSearch, setClienteQuietanzeSearch] = useState("");
  // Quietanze spuntate nella checklist prima dell'aggiunta
  const [quietanzeSel, setQuietanzeSel] = useState<Record<string, boolean>>({});
  /** Modalità incasso/provvigioni per titolo (scelta esplicita, default da anagrafica produttore). */
  const [modalitaByTitolo, setModalitaByTitolo] = useState<Record<string, ModalitaIncasso>>({});
  const [cigById, setCigById] = useState<Record<string, CigDraft>>({});
  const [updateMadreCig, setUpdateMadreCig] = useState(true);
  const [messaCassaSerale, setMessaCassaSerale] = useState(false);

  const isMulti = titoli.length > 1;
  const totaleLordo = titoli.reduce((s, t) => s + (Number(t.premio_lordo) || 0), 0);

  const clienteUnico = useMemo(() => {
    const ids = Array.from(new Set(titoli.map((t) => t.cliente_anagrafica_id).filter(Boolean)));
    return ids.length === 1 ? (ids[0] as string) : null;
  }, [titoli]);

  // Cliente pagatore effettivo: selezione esplicita oppure, se unico, il cliente dei titoli
  const effettivoPagatoreId = pagatoreId || clienteUnico;

  const nomeCliente = (c: any) =>
    c?.ragione_sociale || `${c?.cognome || ""} ${c?.nome || ""}`.trim() || "n/d";

  const { data: anticipi = [] } = useQuery({
    queryKey: ["cliente-anticipi-disponibili", effettivoPagatoreId],
    enabled: !!effettivoPagatoreId && open,
    queryFn: async () => {
      const { data, error } = await (supabase.from("cliente_anticipi") as any)
        .select("id, data_anticipo, importo, importo_residuo, conto_bancario_id, note, titolo_origine_id, conto:conti_bancari(etichetta)")
        .eq("cliente_id", effettivoPagatoreId)
        .eq("segno", "+")
        .gt("importo_residuo", 0)
        .is("rimborsato_il", null)
        .order("data_anticipo", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const titoliACredito = useMemo(
    () => titoli.filter((t) => isTitoloACredito(t)),
    [titoli],
  );
  const totaleCredito = useMemo(
    () => round2(titoliACredito.reduce((s, t) => s + creditoDaPremioLordo(t.premio_lordo), 0)),
    [titoliACredito],
  );

  // Nome del cliente pagatore (per etichette/giroconto)
  const { data: pagatoreCliente } = useQuery({
    queryKey: ["messa-cassa-pagatore", effettivoPagatoreId],
    enabled: !!effettivoPagatoreId && open,
    queryFn: async () => {
      const { data } = await (supabase.from("clienti") as any)
        .select("id, ragione_sociale, cognome, nome")
        .eq("id", effettivoPagatoreId)
        .maybeSingle();
      return data as any;
    },
  });

  // Ricerca clienti per selezione pagatore
  const { data: pagatoreOptions = [] } = useQuery({
    queryKey: ["messa-cassa-clienti-search", pagatoreSearch, scopeUfficioId],
    enabled: open && pagatoreSearch.trim().length >= 2,
    queryFn: async () => {
      const q = pagatoreSearch.trim();
      let query = (supabase.from("clienti") as any)
        .select("id, ragione_sociale, cognome, nome, codice_fiscale, partita_iva")
        .or(`ragione_sociale.ilike.%${q}%,cognome.ilike.%${q}%,codice_fiscale.ilike.%${q}%,partita_iva.ilike.%${q}%`)
        .eq("attivo", true)
        .limit(20);
      if (scopeUfficioId) query = query.eq("ufficio_id", scopeUfficioId);
      const { data } = await query;
      return (data as any[]) || [];
    },
  });

  // Ricerca altre quietanze da incassare (aggiungibili alla messa a cassa).
  // Cerca sia per numero titolo sia per nome/cognome/ragione sociale del cliente.
  const { data: titoliSearchResults = [] } = useQuery({
    queryKey: ["messa-cassa-titoli-search", titoloSearch, titoli.map((t) => t.id).join(","), scopeUfficioId],
    enabled: open && titoloSearch.trim().length >= 2,
    queryFn: async () => {
      const q = titoloSearch.trim();
      const already = new Set(titoli.map((t) => t.id));

      // Prima cerca per numero titolo
      let byNumQ = (supabase.from("titoli") as any)
        .select("id, numero_titolo, premio_lordo, cig_rif, cig_temporaneo, cliente_anagrafica_id, ufficio_id, importo_incassato, stato, clienti:clienti!titoli_cliente_anagrafica_id_fkey(ragione_sociale, cognome, nome, tipo_cliente, gruppi_finanziari(tipo_soggetto))")
        .ilike("numero_titolo", `%${q}%`)
        .or(PENDENTI_OR_GARANTITO_APERTO_FILTER)
        .in("stato", ["attivo", "sospeso"])
        .limit(20);
      if (scopeUfficioId) byNumQ = byNumQ.eq("ufficio_id", scopeUfficioId);
      const { data: byNum } = await byNumQ;

      // Poi cerca per nome cliente e unisci senza duplicati
      let clientiQ = (supabase.from("clienti") as any)
        .select("id")
        .or(`ragione_sociale.ilike.%${q}%,cognome.ilike.%${q}%,nome.ilike.%${q}%`)
        .eq("attivo", true)
        .limit(20);
      if (scopeUfficioId) clientiQ = clientiQ.eq("ufficio_id", scopeUfficioId);
      const { data: clientiMatch } = await clientiQ;
      const clienteIds = (clientiMatch as any[] || []).map((c: any) => c.id);

      let byCliente: any[] = [];
      if (clienteIds.length > 0) {
        let titoliCliQ = (supabase.from("titoli") as any)
          .select("id, numero_titolo, premio_lordo, cig_rif, cig_temporaneo, cliente_anagrafica_id, ufficio_id, importo_incassato, stato, clienti:clienti!titoli_cliente_anagrafica_id_fkey(ragione_sociale, cognome, nome, tipo_cliente, gruppi_finanziari(tipo_soggetto))")
          .in("cliente_anagrafica_id", clienteIds)
          .or(PENDENTI_OR_GARANTITO_APERTO_FILTER)
          .in("stato", ["attivo", "sospeso"])
          .limit(20);
        if (scopeUfficioId) titoliCliQ = titoliCliQ.eq("ufficio_id", scopeUfficioId);
        const { data } = await titoliCliQ;
        byCliente = (data as any[]) || [];
      }

      const merged = new Map<string, any>();
      for (const r of [...((byNum as any[]) || []), ...byCliente]) {
        if (!merged.has(r.id)) merged.set(r.id, r);
      }
      return Array.from(merged.values()).filter((r) => !already.has(r.id)).slice(0, 20);
    },
  });

  // Ricerca clienti per il flusso "aggiungi quietanze di un cliente"
  const { data: clienteQuietanzeOptionsRaw = [] } = useQuery({
    queryKey: ["messa-cassa-cliente-quietanze-search", clienteQuietanzeSearch, scopeUfficioId],
    enabled: open && clienteQuietanzeSearch.trim().length >= 2,
    queryFn: async () => {
      const q = clienteQuietanzeSearch.trim();
      let query = (supabase.from("clienti") as any)
        .select("id, ragione_sociale, cognome, nome, codice_fiscale, partita_iva")
        .or(`ragione_sociale.ilike.%${q}%,cognome.ilike.%${q}%,codice_fiscale.ilike.%${q}%,partita_iva.ilike.%${q}%`)
        .eq("attivo", true)
        .limit(20);
      if (scopeUfficioId) query = query.eq("ufficio_id", scopeUfficioId);
      const { data } = await query;
      return (data as any[]) || [];
    },
  });

  // Tutte le quietanze "da incassare" del cliente selezionato (non ancora messe a cassa).
  // Usa la vista v_portafoglio_quietanze (stessa sorgente del Portafoglio → Carico).
  // Post-processa lato client per escludere le polizze madri che hanno rate figlie
  // nel set restituito: la polizza madre è identificata da sostituisce_polizza IS NULL
  // mentre le sue rate figlie hanno sostituisce_polizza = numero_titolo_madre.
  // Non si usa il filtro .or() su numero_rate_totali perché la view può restituire
  // numero_rate_totali = 1 anche per polizze madri con rinnovi annuali.
  const { data: quietanzeCliente = [] } = useQuery({
    queryKey: ["messa-cassa-quietanze-cliente", clienteQuietanze?.id, titoli.map((t) => t.id).join(",")],
    enabled: open && !!clienteQuietanze?.id,
    queryFn: async () => {
      const { data } = await (supabase.from("v_portafoglio_quietanze") as any)
        .select("id, numero_titolo, premio_lordo, cliente_anagrafica_id, ufficio_id, importo_incassato, stato, data_scadenza, sostituisce_polizza")
        .eq("cliente_anagrafica_id", clienteQuietanze!.id)
        .or(PENDENTI_OR_GARANTITO_APERTO_FILTER)
        .in("stato", ["attivo", "sospeso"])
        .order("data_scadenza", { ascending: true })
        .limit(200);

      const raw = (data as any[]) || [];
      const alreadyIds = new Set(titoli.map((t) => t.id));
      const alreadyNumeri = new Set(
        titoli.map((t) => t.numero_titolo).filter((n): n is string => !!n),
      );
      const ids = raw.map((r) => r.id).filter(Boolean);
      const lordoByTitoloId: Record<string, number> = {};
      let titoliExtra: { id: string; premio_lordo?: number; cig_rif?: string | null; cig_temporaneo?: boolean }[] = [];
      if (ids.length > 0) {
        const { data: titoliLordo } = await (supabase.from("titoli") as any)
          .select("id, premio_lordo, cig_rif, cig_temporaneo")
          .in("id", ids);
        titoliExtra = (titoliLordo as any[]) || [];
        for (const t of titoliExtra) {
          if (t?.id) lordoByTitoloId[t.id] = Number(t.premio_lordo) || 0;
        }
      }
      const filtered = filterQuietanzeClienteDaIncassare(raw, alreadyIds, alreadyNumeri, lordoByTitoloId);
      const cigByTitolo = new Map(
        titoliExtra.map((t) => [t.id, { cig_rif: t.cig_rif, cig_temporaneo: t.cig_temporaneo }]),
      );
      return filtered.map((r) => ({
        ...r,
        cig_rif: cigByTitolo.get(r.id)?.cig_rif ?? (r as any).cig_rif ?? null,
        cig_temporaneo: cigByTitolo.get(r.id)?.cig_temporaneo ?? (r as any).cig_temporaneo ?? false,
      }));
    },
  });

  const { data: clienteQuietanzeIsEnte = false } = useQuery({
    queryKey: ["messa-cassa-cliente-ente", clienteQuietanze?.id],
    enabled: open && !!clienteQuietanze?.id,
    queryFn: async () => {
      const q1 = await (supabase.from("clienti") as any)
        .select("id, tipo_cliente, gruppi_finanziari(tipo_soggetto)")
        .eq("id", clienteQuietanze!.id)
        .maybeSingle();
      if (!q1.error && q1.data) return isClienteEnte(q1.data);
      const q2 = await (supabase.from("clienti") as any)
        .select("id, tipo_cliente")
        .eq("id", clienteQuietanze!.id)
        .maybeSingle();
      return isClienteEnte(q2.data);
    },
  });

  // Abbuoni / arrotondamenti / acconti nello stesso menu. Niente ECCED / sconto / spese.
  const { data: causaliCompRaw = [] } = useQuery({
    queryKey: ["causali-compensazione-messa-cassa-v3"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase.from("causali_contabili") as any)
        .select("id, codice, descrizione, segno_default, effetto_contabile")
        .eq("tipo_tabella", "compensazione_messa_cassa")
        .eq("attivo", true)
        .order("codice");
      if (error) throw error;
      return data as Array<{ id: string; codice: string; descrizione: string; segno_default: "+" | "-"; effetto_contabile: EffettoContabile }>;
    },
  });
  const causaliComp = useMemo(
    () => causaliCompRaw.filter((c) => isCausaleMessaCassaMenu(c.codice)),
    [causaliCompRaw],
  );

  const titoloIds = useMemo(() => titoli.map((t) => t.id), [titoli]);

  const { data: titoliTrattenutaDet = [] } = useQuery({
    queryKey: ["messa-cassa-titoli-trattenuta", titoloIds],
    enabled: open && titoloIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from("titoli") as any)
        .select("id, anagrafica_commerciale_id, produttore_id, provvigioni_quietanza, provvigioni_firma, sostituisce_polizza, percentuale_commerciale")
        .in("id", titoloIds);
      if (error) throw error;
      return data as Array<{
        id: string;
        anagrafica_commerciale_id: string | null;
        produttore_id: string | null;
        provvigioni_quietanza: number | null;
        provvigioni_firma: number | null;
        sostituisce_polizza: string | null;
        percentuale_commerciale: number | null;
      }>;
    },
  });

  const { data: splitCommerciali = [] } = useQuery({
    queryKey: ["messa-cassa-split-commerciali", titoloIds],
    enabled: open && titoloIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from("titoli_split_commerciali") as any)
        .select("titolo_id, percentuale")
        .in("titolo_id", titoloIds);
      if (error) throw error;
      return (data || []) as Array<{ titolo_id: string; percentuale: number | null }>;
    },
  });

  const splitsByTitolo = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const s of splitCommerciali) {
      const arr = m.get(s.titolo_id) || [];
      arr.push(Number(s.percentuale) || 0);
      m.set(s.titolo_id, arr);
    }
    return m;
  }, [splitCommerciali]);

  const provvigioniDisplay = useMemo(() => {
    const ids = new Set(titoloIds);
    return sumMessaCassaProvvigioni(
      titoliTrattenutaDet.filter((t) => ids.has(t.id)),
      splitsByTitolo,
    );
  }, [titoliTrattenutaDet, splitsByTitolo, titoloIds]);

  const prodIdsTrattenuta = useMemo(
    () => Array.from(new Set(titoliTrattenutaDet.map((t) => t.anagrafica_commerciale_id).filter(Boolean))) as string[],
    [titoliTrattenutaDet],
  );

  const { data: produttoriTrattenuta = [] } = useQuery({
    queryKey: ["messa-cassa-prod-trattenuta", prodIdsTrattenuta],
    enabled: open && prodIdsTrattenuta.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from("anagrafiche_professionali") as any)
        .select("id, trattenuta_provvigioni_incasso, percentuale_ra, ragione_sociale, cognome, nome")
        .in("id", prodIdsTrattenuta);
      if (error) throw error;
      return data as Array<{
        id: string;
        trattenuta_provvigioni_incasso: boolean | null;
        percentuale_ra: number | null;
        ragione_sociale: string | null;
        cognome: string | null;
        nome: string | null;
      }>;
    },
  });

  const trattenutaByTitolo = useMemo(() => {
    const prodById = new Map(produttoriTrattenuta.map((p) => [p.id, p]));
    const detById = new Map(titoliTrattenutaDet.map((t) => [t.id, t]));
    const m = new Map<string, TrattenutaTitoloCtx>();
    for (const t of titoli) {
      if (modalitaByTitolo[t.id] !== "produttore_trattiene_provv") continue;
      const det = detById.get(t.id);
      if (!det) continue;
      const ctx = buildTrattenutaCtx(det, prodById, { force: true });
      if (ctx) m.set(t.id, ctx);
    }
    return m;
  }, [titoli, titoliTrattenutaDet, produttoriTrattenuta, modalitaByTitolo]);

  useEffect(() => {
    if (!open || titoliTrattenutaDet.length === 0) return;
    const prodById = new Map(produttoriTrattenuta.map((p) => [p.id, p]));
    setModalitaByTitolo((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const t of titoli) {
        if (next[t.id]) continue;
        const det = titoliTrattenutaDet.find((d) => d.id === t.id);
        const prod = det?.anagrafica_commerciale_id
          ? prodById.get(det.anagrafica_commerciale_id)
          : undefined;
        next[t.id] = defaultModalitaFromAnagrafica(prod?.trattenuta_provvigioni_incasso);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [open, titoli, titoliTrattenutaDet, produttoriTrattenuta]);

  const haTrattenuta = trattenutaByTitolo.size > 0;

  const handleTipoPagamentoChange = (tipo: string) => {
    setSelectedBonificoIds([]);
    const pagDiretto = isPagamentoDirettoCompagnia(tipo);
    if (pagDiretto) setAnticipiSel({});
    setForm((f) => ({
      ...f,
      tipoPagamento: tipo,
      banca: "",
      // Pag. diretto: nessun incasso lato broker
      cashImporto: pagDiretto ? 0 : f.cashImporto,
    }));
  };

  useEffect(() => {
    if (open) {
      const seed = titoliProp;
      const t = bankIncasso?.dataMovimento || todayISO();
      const totLordoSeed = seed.reduce((s, x) => s + (Number(x.premio_lordo) || 0), 0);
      const bankCash = bankIncasso
        ? round2(Object.values(bankIncasso.importoByTitoloId).reduce((s, v) => s + (Number(v) || 0), 0))
        : round2(Math.max(0, totLordoSeed)); // titoli a credito (lordo < 0): cash 0, non importo negativo
      const cliIds = Array.from(new Set(seed.map((x) => x.cliente_anagrafica_id).filter(Boolean)));
      const preferBonifico = !!bankIncasso || !!preferredBonifico;
      setTitoli(seed);
      setForm({
        dataMessaCassa: t,
        dataPagamento: t,
        // Prefill solo da flusso bonifico; altrimenti vuoto (scelta obbligatoria)
        tipoPagamento: preferBonifico ? "bonifico" : "",
        banca: bankIncasso?.contoBancarioId ?? preferredBonifico?.contoBancarioId ?? "",
        cashImporto: bankCash,
      });
      setAnticipiSel({});
      setCompensazioniCliente([]);
      setDatesByTitolo({});
      setPagatoreId(
        preferredPagatoreId ||
          (cliIds.length === 1 ? (cliIds[0] as string) : null),
      );
      setPagatoreSearch("");
      setTitoloSearch("");
      // Da scheda cliente: elenco quietanze già sul pagatore corrente
      setClienteQuietanze(
        preferredPagatoreId
          ? { id: preferredPagatoreId, nome: seed[0]?.cliente_nome_display || "cliente" }
          : null,
      );
      setClienteQuietanzeSearch("");
      setQuietanzeSel({});
      setModalitaByTitolo({});
      setSelectedBonificoIds(
        bankIncasso?.movimentoId
          ? [bankIncasso.movimentoId]
          : preferredBonifico?.movimentoId
            ? [preferredBonifico.movimentoId]
            : [],
      );
      setEstrattoSearch("");
      setSoloMatchNome(true);
      setSuggerimentoAltroConto(null);
      setCigById({});
      setUpdateMadreCig(true);
      setMessaCassaSerale(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bankIncasso?.movimentoId, preferredBonifico?.movimentoId, preferredPagatoreId]);

  // Date effettive per titolo (override oppure default globale del form)
  const getDate = (titoloId: string) =>
    datesByTitolo[titoloId] || { mc: form.dataMessaCassa, pag: form.dataPagamento };
  const setDate = (titoloId: string, patch: Partial<{ mc: string; pag: string }>) =>
    setDatesByTitolo((prev) => {
      const cur = prev[titoloId] || { mc: form.dataMessaCassa, pag: form.dataPagamento };
      return { ...prev, [titoloId]: { ...cur, ...patch } };
    });

  const addTitolo = (row: any) => {
    setTitoli((prev) => {
      if (prev.some((t) => t.id === row.id)) return prev;
      return [
        ...prev,
        {
          id: row.id,
          numero_titolo: row.numero_titolo,
          premio_lordo: row.premio_lordo,
          cliente_anagrafica_id: row.cliente_anagrafica_id,
          ufficio_id: row.ufficio_id,
          importo_incassato: row.importo_incassato,
        },
      ];
    });
    setTitoloSearch("");
  };

  const removeTitolo = (id: string) => {
    setTitoli((prev) => prev.filter((t) => t.id !== id));
    setModalitaByTitolo((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
    setDatesByTitolo((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
    setCigById((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  };

  const titoloIdsKey = titoli.map((t) => t.id).join(",");

  useEffect(() => {
    if (!open) return;
    const ids = titoli.map((t) => t.id);
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase.from("titoli") as any)
        .select("id, cig_rif, cig_temporaneo, cliente_anagrafica_id")
        .in("id", ids);
      if (error || cancelled) return;
      const cliIds = Array.from(
        new Set(((data as any[]) || []).map((r) => r.cliente_anagrafica_id).filter(Boolean)),
      );
      const enteByCli = new Map<string, boolean>();
      if (cliIds.length > 0) {
        let clis: any[] | null = null;
        const q1 = await (supabase.from("clienti") as any)
          .select("id, tipo_cliente, gruppi_finanziari(tipo_soggetto)")
          .in("id", cliIds);
        if (!q1.error) clis = q1.data;
        else {
          const q2 = await (supabase.from("clienti") as any)
            .select("id, tipo_cliente")
            .in("id", cliIds);
          if (!q2.error) clis = q2.data;
        }
        for (const c of clis || []) {
          enteByCli.set(c.id, isClienteEnte(c));
        }
      }
      if (cancelled) return;
      const seedById = new Map(titoli.map((t) => [t.id, t]));
      setCigById((prev) => {
        const next = { ...prev };
        for (const row of (data as any[]) || []) {
          const seed = seedById.get(row.id);
          const ente =
            (row.cliente_anagrafica_id ? enteByCli.get(row.cliente_anagrafica_id) : undefined) ??
            !!seed?.is_ente;
          const existing = next[row.id];
          const dirty = !!existing && existing.cig !== existing.original;
          next[row.id] = {
            cig: dirty ? existing.cig : row.cig_rif || "",
            temporaneo: dirty ? existing.temporaneo : !!row.cig_temporaneo,
            isEnte: ente,
            original: row.cig_rif || "",
          };
        }
        for (const k of Object.keys(next)) {
          if (!ids.includes(k)) delete next[k];
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [open, titoloIdsKey]);

  const enteCigDrafts = useMemo(
    () =>
      titoli
        .map((t) => cigById[t.id])
        .filter((d): d is CigDraft => !!d?.isEnte),
    [titoli, cigById],
  );
  const hasEnteCig = enteCigDrafts.length > 0;
  const cigCondiviso =
    hasEnteCig &&
    enteCigDrafts.every(
      (d) =>
        normalizeCig(d.cig) === normalizeCig(enteCigDrafts[0].cig) &&
        d.temporaneo === enteCigDrafts[0].temporaneo,
    );

  const patchCigEnte = (patch: Partial<CigDraft>, onlyId?: string) => {
    setCigById((prev) => {
      const next = { ...prev };
      const ids = onlyId ? [onlyId] : titoli.filter((t) => prev[t.id]?.isEnte).map((t) => t.id);
      for (const id of ids) {
        if (!next[id]?.isEnte) continue;
        next[id] = { ...next[id], ...patch };
      }
      return next;
    });
  };

  // === Flusso "aggiungi quietanze di un cliente" ===
  // Opzioni per il SearchableSelect del cliente: include sempre quello selezionato
  const clienteQuietanzeSelectOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string; description?: string }>();
    if (clienteQuietanze) map.set(clienteQuietanze.id, { value: clienteQuietanze.id, label: clienteQuietanze.nome });
    for (const c of clienteQuietanzeOptionsRaw as any[]) {
      map.set(c.id, {
        value: c.id,
        label: nomeCliente(c),
        description: c.partita_iva || c.codice_fiscale || undefined,
      });
    }
    return Array.from(map.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteQuietanze, clienteQuietanzeOptionsRaw]);

  const numQuietanzeSel = useMemo(
    () => (quietanzeCliente as any[]).filter((r) => quietanzeSel[r.id]).length,
    [quietanzeCliente, quietanzeSel],
  );
  const tutteQuietanzeSel =
    (quietanzeCliente as any[]).length > 0 && (quietanzeCliente as any[]).every((r) => quietanzeSel[r.id]);

  const toggleQuietanzaSel = (id: string) =>
    setQuietanzeSel((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleTutteQuietanze = () => {
    if (tutteQuietanzeSel) {
      setQuietanzeSel({});
    } else {
      setQuietanzeSel(Object.fromEntries((quietanzeCliente as any[]).map((r) => [r.id, true])));
    }
  };

  const addQuietanzeSelezionate = () => {
    (quietanzeCliente as any[]).filter((r) => quietanzeSel[r.id]).forEach((r) => addTitolo(r));
    setQuietanzeSel({});
  };

  // Beneficiari giroconto: titoli il cui cliente differisce dal pagatore
  const clientiById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const t of titoli) m.set(t.id, t.cliente_anagrafica_id ?? null);
    return m;
  }, [titoli]);

  const titoliGiroconto = useMemo(
    () =>
      effettivoPagatoreId
        ? titoli.filter((t) => t.cliente_anagrafica_id && t.cliente_anagrafica_id !== effettivoPagatoreId)
        : [],
    [titoli, effettivoPagatoreId],
  );

  // Opzioni per il SearchableSelect del cliente pagatore: include sempre il
  // cliente attualmente selezionato (così l'etichetta resta visibile) + risultati ricerca.
  const pagatoreSelectOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string; description?: string }>();
    if (pagatoreCliente?.id) {
      map.set(pagatoreCliente.id, { value: pagatoreCliente.id, label: nomeCliente(pagatoreCliente) });
    }
    for (const c of pagatoreOptions as any[]) {
      map.set(c.id, {
        value: c.id,
        label: nomeCliente(c),
        description: c.partita_iva || c.codice_fiscale || undefined,
      });
    }
    return Array.from(map.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagatoreCliente, pagatoreOptions]);

  // Nomi dei clienti dei titoli correnti (per lista quietanze + banner giroconto)
  const titoliClienteIds = useMemo(
    () => Array.from(new Set(titoli.map((t) => t.cliente_anagrafica_id).filter(Boolean))) as string[],
    [titoli],
  );

  const { data: titoliClienti = [] } = useQuery({
    queryKey: ["messa-cassa-titoli-clienti", titoliClienteIds],
    enabled: open && titoliClienteIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase.from("clienti") as any)
        .select("id, ragione_sociale, cognome, nome")
        .in("id", titoliClienteIds);
      return (data as any[]) || [];
    },
  });

  const clienteNomeById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of titoliClienti as any[]) m.set(c.id, nomeCliente(c));
    if (pagatoreCliente?.id) m.set(pagatoreCliente.id, nomeCliente(pagatoreCliente));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titoliClienti, pagatoreCliente]);

  // === Helpers causali a livello cliente ===
  const addCompCliente = (
    causaleId: string,
    suggestImporto?: number,
    segnoOverride?: "+" | "-",
  ) => {
    const c = causaliComp.find((x) => x.id === causaleId);
    if (!c) return;
    const tempId = safeId();
    const row: CompensazioneRow = {
      tempId,
      causale_id: c.id,
      causale_codice: c.codice,
      causale_descrizione: c.descrizione,
      segno: segnoOverride ?? (c.segno_default as "+" | "-"),
      importo: round2(suggestImporto && suggestImporto > 0 ? suggestImporto : 0),
      note: "",
      effetto: c.effetto_contabile || "standard",
    };
    setCompensazioniCliente((prev) => [...prev, row]);
    setLastAddedCompId(tempId);
  };

  const updateCompCliente = (tempId: string, patch: Partial<CompensazioneRow>) => {
    setCompensazioniCliente((prev) => prev.map((c) => (c.tempId === tempId ? { ...c, ...patch } : c)));
  };

  const removeCompCliente = (tempId: string) => {
    setCompensazioniCliente((prev) => prev.filter((c) => c.tempId !== tempId));
  };

  // === Calcoli quadratura ===
  const allCompensazioni = compensazioniCliente;
  const totaleAnticipiUsati = round2(Object.values(anticipiSel).reduce((s, v) => s + (Number(v) || 0), 0));
  const totaleCompPlus = round2(
    allCompensazioni
      .filter((c) => c.segno === "+" && rettificaDovutoQuietanza(c.causale_codice))
      .reduce((s, c) => s + c.importo, 0),
  );
  const totaleCompMinus = round2(
    allCompensazioni
      .filter((c) => c.segno === "-" && rettificaDovutoQuietanza(c.causale_codice))
      .reduce((s, c) => s + c.importo, 0),
  );
  const dovutoFinale = round2(totaleLordo + totaleCompMinus - totaleCompPlus);

  const totaleDovutoConsul = useMemo(() => {
    const baseLordo = round2(
      titoli.reduce((sum, t) => {
        const lordo = Number(t.premio_lordo) || 0;
        const tr = trattenutaByTitolo.get(t.id);
        if (tr) {
          return sum + calcIncassoConTrattenutaProvvigioni(lordo, tr.provvigioneLorda, tr.percentualeRa).importoVersatoConsul;
        }
        return sum + lordo;
      }, 0),
    );
    // Causali cliente rettificano il dovuto complessivo (non per quietanza)
    return round2(baseLordo + totaleCompMinus - totaleCompPlus);
  }, [titoli, trattenutaByTitolo, totaleCompMinus, totaleCompPlus]);

  const isPagDiretto = isPagamentoDirettoCompagnia(form.tipoPagamento);
  const cashEffettivo = isPagDiretto
    ? 0
    : isMulti
      ? round2(Math.max(0, totaleDovutoConsul - totaleAnticipiUsati))
      : round2(Number(form.cashImporto) || 0);
  const coperto = round2(cashEffettivo + totaleAnticipiUsati);
  const delta = round2(totaleDovutoConsul - coperto);
  /** Surplus di cassa/anticipi rispetto al dovuto (es. Contanti 383 su premio 176 → 207). */
  const surplusIncasso = round2(Math.max(0, -delta));

  // Chiusura conguaglio a credito: nessun cash/acconto da quadrare
  const isChiusuraCredito = dovutoFinale < 0;
  // Pag. diretto compagnia: premio già versato in compagnia → chiusura a incasso 0.
  const quadrato = isPagDiretto
    ? cashEffettivo === 0 && totaleAnticipiUsati === 0
    : bankIncasso
      ? true
      : isChiusuraCredito
        ? totaleAnticipiUsati === 0 && cashEffettivo === 0
        : delta === 0;

  const isBonifico = isBonificoTipo(form.tipoPagamento);
  /** Pannello conti+estratti visibile per ogni bonifico (anche incasso a 0). */
  const showBonificoPanel = isBonifico && !isPagDiretto;
  /** Collegamento obbligatorio movimento solo se c'è cash da quadrare sul conto. */
  const needsBonificoLink = !bankIncasso && cashEffettivo > 0 && isBonifico && !!form.banca;
  /** Carica estratti appena c'è un conto (anche con cash 0). */
  const canLoadEstratti = open && !bankIncasso && isBonifico && !!form.banca;

  const clienteIdsPerBonifico = useMemo(() => {
    const ids = new Set<string>();
    for (const t of titoli) {
      if (t.cliente_anagrafica_id) ids.add(t.cliente_anagrafica_id);
    }
    if (effettivoPagatoreId) ids.add(effettivoPagatoreId);
    return Array.from(ids);
  }, [titoli, effettivoPagatoreId]);

  const clienteNomiPerBonifico = useMemo(() => {
    const names = new Set<string>();
    for (const id of clienteIdsPerBonifico) {
      const n = clienteNomeById.get(id);
      if (n) names.add(n);
    }
    for (const t of titoli) {
      const n = (t.cliente_nome_display || "").trim();
      if (n) names.add(n);
    }
    return Array.from(names);
  }, [clienteIdsPerBonifico, clienteNomeById, titoli]);

  const { data: bonificiCandidati = [], isFetching: bonificiLoading } = useQuery({
    queryKey: [
      "messa-cassa-bonifici-candidati",
      form.banca,
      clienteIdsPerBonifico.join(","),
      clienteNomiPerBonifico.join("|"),
    ],
    enabled: canLoadEstratti,
    queryFn: () =>
      fetchBonificiCandidatiPerIncasso({
        contoBancarioId: form.banca,
        clienteIds: clienteIdsPerBonifico,
        clienteNomi: clienteNomiPerBonifico,
      }),
  });

  const nameMatchCandidati = useMemo(
    () => bonificiCandidati.filter((b) => isBonificoNameMatch(b.matchReason)),
    [bonificiCandidati],
  );

  useEffect(() => {
    if (!canLoadEstratti) return;
    // Mantieni selezioni ancora valide sul conto corrente
    const valid = selectedBonificoIds.filter((id) => bonificiCandidati.some((b) => b.id === id));
    if (valid.length > 0) {
      if (valid.length !== selectedBonificoIds.length) setSelectedBonificoIds(valid);
      return;
    }
    // Preferenza da Incassi (scelta esplicita dell'utente sul badge)
    if (preferredBonifico?.movimentoId && bonificiCandidati.some((b) => b.id === preferredBonifico.movimentoId)) {
      setSelectedBonificoIds([preferredBonifico.movimentoId]);
      return;
    }
    // Nessun flag automatico: anche con 1 solo match nome resta da spuntare a mano
    setSelectedBonificoIds([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canLoadEstratti,
    form.banca,
    preferredBonifico?.movimentoId,
    bonificiCandidati.map((b) => `${b.id}:${b.matchReason}`).join(","),
  ]);

  const toggleBonificoSelezionato = (id: string, dataMovimento?: string | null) => {
    setSelectedBonificoIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    if (dataMovimento) {
      setForm((f) => ({ ...f, dataPagamento: dataMovimento }));
    }
  };

  // Se sul conto corrente non c'è match nome, cerca su altri conti e suggerisci di cambiare
  useEffect(() => {
    if (!canLoadEstratti || !form.banca || bonificiLoading) {
      setSuggerimentoAltroConto(null);
      return;
    }
    if (nameMatchCandidati.length > 0 || clienteNomiPerBonifico.length === 0) {
      setSuggerimentoAltroConto(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const best = await findBestBonificoApertoPerCliente({
          clienteIds: clienteIdsPerBonifico,
          clienteNomi: clienteNomiPerBonifico,
          excludeContoId: form.banca,
        });
        if (cancelled || !best?.conto_bancario_id) {
          if (!cancelled) setSuggerimentoAltroConto(null);
          return;
        }
        setSuggerimentoAltroConto({
          contoBancarioId: best.conto_bancario_id,
          movimentoId: best.id,
          ordinante: best.ordinante,
          importo: best.importo,
          contoEtichetta: best.conto_etichetta,
        });
      } catch {
        if (!cancelled) setSuggerimentoAltroConto(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    canLoadEstratti,
    form.banca,
    bonificiLoading,
    nameMatchCandidati.length,
    clienteIdsPerBonifico.join(","),
    clienteNomiPerBonifico.join("|"),
  ]);

  const selectedBonifici: BonificoCandidato[] = useMemo(
    () => bonificiCandidati.filter((b) => selectedBonificoIds.includes(b.id)),
    [bonificiCandidati, selectedBonificoIds],
  );
  const totaleBonificiSelezionati = useMemo(
    () => round2(selectedBonifici.reduce((s, b) => s + (Number(b.importo) || 0), 0)),
    [selectedBonifici],
  );

  /** Eccedenza (+) / mancanza (−) bonifici rispetto al cash applicato. */
  const eccedenzaBonifico = selectedBonifici.length > 0
    ? round2(totaleBonificiSelezionati - cashEffettivo)
    : 0;
  /** ACC_* segno +: eccedenza → acconto attivo in Acconti e compensazioni. */
  const totaleAccAttivo = round2(
    compensazioniCliente
      .filter((c) => isCausaleAccontoCliente(c.causale_codice) && c.segno === "+" && c.importo > 0)
      .reduce((s, c) => s + c.importo, 0),
  );
  /** ACC_* segno −: mancanza → accredito passivo in Acconti e compensazioni. */
  const totaleAccPassivo = round2(
    compensazioniCliente
      .filter((c) => isCausaleAccontoCliente(c.causale_codice) && c.segno === "-" && c.importo > 0)
      .reduce((s, c) => s + c.importo, 0),
  );
  /**
   * Differenza bonifico classificata a mano (niente auto):
   * eccedenza → ACC attivo (+); mancanza → ACC passivo (−);
   * oppure ABB/ARROT che azzerano la differenza riallineando il dovuto.
   */
  const differenzaBonificoClassificata = isDifferenzaBonificoClassificata({
    diff: eccedenzaBonifico,
    accAttivo: totaleAccAttivo,
    accPassivo: totaleAccPassivo,
  });
  /** Importo suggerito in tendina: |differenza bonifico| se c'è, altrimenti |delta|. */
  const suggestCompImporto = round2(
    Math.abs(eccedenzaBonifico) > 0 ? Math.abs(eccedenzaBonifico) : Math.abs(delta),
  );
  /** Con incasso residuo (o pag. diretto) il tipo pagamento è obbligatorio. */
  const tipoPagamentoObbligatorio =
    !bankIncasso && (cashEffettivo > 0 || isPagDiretto || totaleDovutoConsul > 0);
  const tipoPagamentoOk = !tipoPagamentoObbligatorio || !!form.tipoPagamento;
  const puoConfermare = quadrato && differenzaBonificoClassificata && tipoPagamentoOk;

  const { data: contiBonificoRaw = [] } = useQuery({
    queryKey: ["messa-cassa-conti-bonifico"],
    enabled: open && showBonificoPanel && !bankIncasso,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conti_bancari" as any)
        .select("id, etichetta, iban, intestato_a, banca, tipo, is_default, attivo, conti_bancari_uffici(ufficio_id)")
        .eq("attivo", true)
        .in("tipo", ["generico", "incasso_clienti"])
        .order("is_default", { ascending: false })
        .order("etichetta");
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 60_000,
  });

  const contiBonifico = useMemo(
    () =>
      filterContiBancariPerSede(contiBonificoRaw, {
        ruolo: profile?.ruolo,
        ufficioId: profile?.ufficio_id,
      }),
    [contiBonificoRaw, profile?.ruolo, profile?.ufficio_id],
  );

  // Preseleziona il conto default (o il primo) quando si sceglie Bonifico
  useEffect(() => {
    if (!open || bankIncasso || !showBonificoPanel) return;
    if (form.banca) return;
    if (preferredBonifico?.contoBancarioId) {
      setForm((f) => ({ ...f, banca: preferredBonifico.contoBancarioId || "" }));
      return;
    }
    if (contiBonifico.length === 0) return;
    const def = contiBonifico.find((c: any) => c.is_default) || contiBonifico[0];
    if (def?.id) setForm((f) => ({ ...f, banca: def.id }));
  }, [open, bankIncasso, showBonificoPanel, contiBonifico, form.banca, preferredBonifico?.contoBancarioId]);

  const estrattiFiltrati = useMemo(() => {
    const base =
      soloMatchNome && nameMatchCandidati.length > 0 ? nameMatchCandidati : bonificiCandidati;
    const q = estrattoSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter((b) => {
      const hay = `${b.ordinante || ""} ${b.descrizione || ""} ${b.importo} ${b.stato}`.toLowerCase();
      return hay.includes(q);
    });
  }, [bonificiCandidati, nameMatchCandidati, soloMatchNome, estrattoSearch]);

  // Allinea l'incasso applicato al dovuto rettificato (anche dopo ABB/ARROT attivi/passivi)
  useEffect(() => {
    if (!open || isMulti || bankIncasso) return;
    setForm((f) => ({ ...f, cashImporto: round2(Math.max(0, totaleDovutoConsul - totaleAnticipiUsati)) }));
  }, [open, isMulti, bankIncasso, totaleDovutoConsul, totaleAnticipiUsati]);

  // === Anteprima scritture contabili ===
  const movimentiPreview: MovimentoPreview[] = useMemo(() => {
    return compensazioniCliente.map((c) => {
      const categoria = isCausaleAccontoCliente(c.causale_codice)
        ? "acconto_cliente"
        : c.effetto === "abbuono"
          ? "abbuono"
          : c.effetto === "pag_diretto_compagnia"
            ? "pag_diretto_compagnia"
            : "compensazione_titolo";
      return {
        tipo: (c.segno === "+" ? "uscita" : "entrata") as "entrata" | "uscita",
        categoria,
        descrizione: `${c.causale_codice} — ${c.causale_descrizione}${c.note ? " · " + c.note : ""}`,
        importo: c.importo,
        titolo: undefined,
      };
    });
  }, [compensazioniCliente]);

  const stampaRiepilogo = () => {
    const t = titoli[0];
    const rows: string[] = [];
    rows.push(`<tr><td>Premio lordo</td><td style="text-align:right">${fmtEuro(totaleLordo)}</td></tr>`);
    rows.push(`<tr><td>Provvigioni attive</td><td style="text-align:right">${fmtEuro(provvigioniDisplay.attive)}</td></tr>`);
    rows.push(`<tr><td>Provvigioni passive</td><td style="text-align:right">${fmtEuro(provvigioniDisplay.passive)}</td></tr>`);
    compensazioniCliente.forEach((c) => {
      rows.push(`<tr><td>${c.segno} ${c.causale_codice} — ${c.causale_descrizione}${c.note ? " (" + c.note + ")" : ""}</td><td style="text-align:right">${c.segno === "+" ? "− " : "+ "}${fmtEuro(c.importo)}</td></tr>`);
    });
    rows.push(`<tr style="border-top:1px solid #999"><td><strong>Dovuto finale</strong></td><td style="text-align:right"><strong>${fmtEuro(dovutoFinale)}</strong></td></tr>`);
    if (totaleAnticipiUsati > 0) rows.push(`<tr><td>Acconti utilizzati</td><td style="text-align:right">− ${fmtEuro(totaleAnticipiUsati)}</td></tr>`);
    rows.push(`<tr><td>Incasso applicato (${form.tipoPagamento})</td><td style="text-align:right">− ${fmtEuro(cashEffettivo)}</td></tr>`);
    rows.push(`<tr style="border-top:2px solid #000"><td><strong>Delta finale</strong></td><td style="text-align:right"><strong>${fmtEuro(delta)}</strong></td></tr>`);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Riepilogo Messa a Cassa</title>
<style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{font-size:18px;margin:0 0 4px}h2{font-size:13px;margin:0 0 16px;color:#666;font-weight:normal}table{width:100%;border-collapse:collapse;font-size:13px}td{padding:6px 4px}</style>
</head><body>
<h1>Riepilogo Messa a Cassa</h1>
<h2>Polizza ${t?.numero_titolo || t?.id?.slice(0, 8) || ""} — ${form.dataMessaCassa}</h2>
<table>${rows.join("")}</table>
<p style="margin-top:24px;font-size:11px;color:#888">Stampato il ${new Date().toLocaleString("it-IT")}</p>
<script>window.onload=()=>window.print()</script>
</body></html>`;
    const w = window.open("", "_blank", "width=700,height=800");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const toggleAnticipo = (aId: string, residuo: number) => {
    setAnticipiSel((prev) => {
      if (prev[aId] !== undefined) {
        const { [aId]: _, ...rest } = prev;
        return rest;
      }
      const giaUsato = Object.values(prev).reduce((s, v) => s + v, 0);
      const daCoprire = Math.max(0, totaleDovutoConsul - giaUsato - (isMulti ? 0 : cashEffettivo));
      return { ...prev, [aId]: Math.min(residuo, daCoprire) };
    });
  };

  const setImportoAnticipo = (aId: string, val: string, residuo: number) => {
    const n = Math.max(0, Math.min(residuo, Number(val.replace(",", ".")) || 0));
    setAnticipiSel((prev) => ({ ...prev, [aId]: n }));
    if (!isMulti) {
      setForm((f) => {
        const altriAnticipi = Object.entries(anticipiSel)
          .filter(([k]) => k !== aId)
          .reduce((s, [, v]) => s + v, 0);
        const newCash = round2(Math.max(0, totaleDovutoConsul - altriAnticipi - n));
        return { ...f, cashImporto: newCash };
      });
    }
  };

  const autoQuadra = () => {
    if (isMulti) return;
    setForm((f) => ({ ...f, cashImporto: round2(Math.max(0, totaleDovutoConsul - totaleAnticipiUsati)) }));
  };

  const handleConferma = async () => {
    if (titoli.length === 0) return;
    if (!quadrato) {
      toast.error(
        `Non quadra: delta ${fmtEuro(delta)}. Riduci l'incasso applicato oppure aggiungi abbuono/arrotondamento manuale.`,
      );
      return;
    }
    if (tipoPagamentoObbligatorio && !form.tipoPagamento) {
      toast.error("Seleziona il tipo di pagamento");
      return;
    }
    if (selectedBonifici.length > 0 && !differenzaBonificoClassificata) {
      if (eccedenzaBonifico < 0) {
        toast.error(
          `Mancano ${fmtEuro(-eccedenzaBonifico)} sui bonifici: classifica con ACC_* (accredito passivo, segno −) oppure abbassa il dovuto con ABB_ATT/ARROT_A, oppure aggiungi un movimento.`,
        );
      } else {
        toast.error(
          `Eccedenza bonifico ${fmtEuro(eccedenzaBonifico)}: classifica con ACC_* (acconto attivo, segno +) oppure alza il dovuto con ABB_PAS/ARROT_P. Nessun percorso automatico.`,
        );
      }
      return;
    }
    if (isBonificoTipo(form.tipoPagamento) && !form.banca && !bankIncasso?.contoBancarioId) {
      toast.error("Seleziona il conto Consulbrokers per il bonifico");
      return;
    }
    if (titoli.some((t) => cigById[t.id]?.isEnte && isCigFormatoInvalido(cigById[t.id].cig, cigById[t.id].temporaneo))) {
      toast.error("CIG definitivo non valido: 10 caratteri alfanumerici, oppure spunta Temporaneo");
      return;
    }
    if (
      needsBonificoLink &&
      bonificiCandidati.length > 0 &&
      selectedBonificoIds.length === 0
    ) {
      toast.error("Seleziona uno o più bonifici tra i caricamenti del conto, oppure verifica in Incassi → Bonifici aperti");
      return;
    }

    for (const t of titoli) {
      const { data: row } = await supabase
        .from("titoli")
        .select("id, stato, sostituisce_polizza, numero_titolo, importo_incassato, data_messa_cassa, is_appendice_modifica, is_proroga, is_regolazione")
        .eq("id", t.id)
        .maybeSingle();
      if (row?.stato === "sospeso") {
        toast.error(`Impossibile incassare: titolo ${t.numero_titolo ?? t.id} è sospeso`);
        return;
      }
      if (row && !canHaveDataCopertura(row as any)) {
        toast.error(
          `La polizza madre ${row.numero_titolo ?? t.id} non si mette a cassa — apri la quietanza`,
        );
        return;
      }
      if (row?.sostituisce_polizza && row.numero_titolo) {
        const madreId = await resolveTitoloMadreId(supabase, t.id);
        const { data: madre } = await supabase
          .from("titoli")
          .select("stato, numero_titolo")
          .eq("id", madreId)
          .maybeSingle();
        if (madre?.stato === "sospeso") {
          toast.error(`Impossibile incassare: polizza madre ${madre.numero_titolo ?? madreId} è sospesa`);
          return;
        }
      }
    }

    const abbuoniCliente = compensazioniCliente.filter((c) => isCausaleCompMessaCassaUi(c.causale_codice));
    const accontiCliente = compensazioniCliente.filter(
      (c) => isCausaleAccontoCliente(c.causale_codice) && c.importo > 0,
    );
    if (accontiCliente.length > 0) {
      const cliAcc = effettivoPagatoreId || titoli.find((x) => x.cliente_anagrafica_id)?.cliente_anagrafica_id;
      if (!cliAcc) {
        toast.error("Per creare acconti (ACC_*) seleziona il cliente pagatore");
        return;
      }
    }

    setLoading(true);

    const anticipiOrdered = Object.entries(anticipiSel).filter(([, v]) => v > 0).map(([id, v]) => ({ id, residuo: v }));
    const anticipiById = new Map((anticipi as any[]).map((a) => [a.id as string, a]));
    const { data: userResp } = await supabase.auth.getUser();
    const userId = userResp.user?.id ?? null;

    let ok = 0, ko = 0;
    const notificaTitoloIds: string[] = [];
    let accontiCreati = 0;
    let accontiImporto = 0;
    const cashByTitolo: Record<string, number> = {};
    const movimentoBancarioIdEffettivo =
      bankIncasso?.movimentoId ?? selectedBonificoIds[0] ?? null;
    /** Prima quietanza effettivamente processata riceve gli abbuoni cliente. */
    let titoloIdPerAbbuoni: string | null = null;

    for (const t of titoli) {
      if (t.stato === "sospeso") {
        toast.error(`Impossibile incassare: titolo in sospensione (${(t as any).numero_titolo || t.id})`);
        ko++;
        continue;
      }
      if ((t as any).sostituisce_polizza && (t as any).numero_titolo) {
        const { data: madre } = await supabase
          .from("titoli")
          .select("stato")
          .eq("numero_titolo", (t as any).numero_titolo)
          .is("sostituisce_polizza", null)
          .order("riga", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (madre?.stato === "sospeso") {
          toast.error(`Impossibile incassare: polizza ${(t as any).numero_titolo} sospesa`);
          ko++;
          continue;
        }
      }

      if (!titoloIdPerAbbuoni) titoloIdPerAbbuoni = t.id;

      const lordo = Number(t.premio_lordo) || 0;
      const d = getDate(t.id);

      const { data: titoloRow } = await supabase
        .from("titoli")
        .select("conferimento_gestito, data_copertura, data_messa_cassa, importo_incassato")
        .eq("id", t.id)
        .maybeSingle();

      const abbuoniForThis = t.id === titoloIdPerAbbuoni ? abbuoniCliente : [];
      const compForThis = abbuoniForThis;
      const compPlusT = abbuoniForThis
        .filter((c) => c.segno === "+")
        .reduce((s, c) => s + c.importo, 0);
      const compMinusT = abbuoniForThis
        .filter((c) => c.segno === "-")
        .reduce((s, c) => s + c.importo, 0);
      const dovutoT = round2(lordo + compMinusT - compPlusT);

      let daCoprireT = dovutoT;
      const utilizziPerTitolo: Array<{ anticipo_id: string; importo_utilizzato: number }> = [];
      for (const a of anticipiOrdered) {
        if (daCoprireT <= 0 || a.residuo <= 0) continue;
        const usato = Math.min(daCoprireT, a.residuo);
        if (usato > 0) {
          utilizziPerTitolo.push({ anticipo_id: a.id, importo_utilizzato: round2(usato) });
          a.residuo -= usato;
          daCoprireT -= usato;
        }
      }

      const usatoTitolo = round2(utilizziPerTitolo.reduce((s, u) => s + u.importo_utilizzato, 0));
      const bankImporto = bankIncasso?.importoByTitoloId[t.id];
      const pagDirettoTitolo =
        isPagamentoDirettoCompagnia(form.tipoPagamento) ||
        compForThis.some((c) => c.effetto === "pag_diretto_compagnia");

      let residuoCash: number;
      if (pagDirettoTitolo) {
        residuoCash = 0;
      } else if (bankImporto != null) {
        const maxCash = round2(Math.max(0, dovutoT - usatoTitolo));
        residuoCash = round2(Math.min(Number(bankImporto) || 0, maxCash));
        const trBank = trattenutaByTitolo.get(t.id);
        if (trBank) {
          residuoCash = calcIncassoConTrattenutaProvvigioni(
            residuoCash,
            trBank.provvigioneLorda,
            trBank.percentualeRa,
          ).importoVersatoConsul;
        }
      } else {
        residuoCash = round2(dovutoT - usatoTitolo);
        const tr = trattenutaByTitolo.get(t.id);
        if (tr) {
          residuoCash = calcIncassoConTrattenutaProvvigioni(
            round2(dovutoT - usatoTitolo),
            tr.provvigioneLorda,
            tr.percentualeRa,
          ).importoVersatoConsul;
        }
      }
      const tr = trattenutaByTitolo.get(t.id);
      const haCompensazioni = compForThis.length > 0;
      const tipoPagamentoPrincipale = pagDirettoTitolo
        ? TIPO_PAGAMENTO_DIREITO_COMPAGNIA
        : bankIncasso
          ? "bonifico"
          : form.tipoPagamento;
      const anticipiDaContoBancario =
        utilizziPerTitolo.length > 0 &&
        utilizziPerTitolo.every((u) => !!anticipiById.get(u.anticipo_id)?.conto_bancario_id);
      const tipoPag = resolveTipoPagamentoTitoloIncasso({
        dovuto: dovutoT,
        usatoAnticipi: usatoTitolo,
        residuoCash,
        haCompensazioni,
        tipoPagamentoPrincipale,
        anticipiDaContoBancario,
      });

      let bancaLabel: string | null = null;
      const bancaId = form.banca || bankIncasso?.contoBancarioId || "";
      if (residuoCash > 0 && isBonificoTipo(form.tipoPagamento) && bancaId) {
        const { data: conto } = await (supabase.from("conti_bancari") as any)
          .select("etichetta, banca, iban").eq("id", bancaId).maybeSingle();
        bancaLabel = conto?.etichetta || conto?.banca || bancaId;
      }

      if (residuoCash > 0) cashByTitolo[t.id] = residuoCash;

      const prevIncassato = Number(titoloRow?.importo_incassato ?? t.importo_incassato) || 0;
      // residuoCash è la quota incasso/bonifico; usatoTitolo è la quota coperta da acconti.
      // Entrambe contribuiscono all'importo_incassato, altrimenti i pagamenti
      // fatti interamente con acconti lasciano il titolo in stato "attivo".
      // Pag. diretto: importo_incassato resta 0 (premio già in compagnia).
      const nuovoIncassato = pagDirettoTitolo
        ? 0
        : round2(prevIncassato + residuoCash + usatoTitolo);
      const isFullIncasso = pagDirettoTitolo || nuovoIncassato >= dovutoT;

      const payload: any = {
        importo_incassato: nuovoIncassato,
        tipo_pagamento: tipoPag,
        updated_at: new Date().toISOString(),
      };
      if (isFullIncasso) {
        const dateFields = buildIncassoDateFields(
          {
            conferimento_gestito: titoloRow?.conferimento_gestito,
            data_copertura: titoloRow?.data_copertura,
            data_messa_cassa: titoloRow?.data_messa_cassa,
          },
          d.mc,
        );
        payload.stato = "incassato";
        payload.data_messa_cassa = dateFields.data_messa_cassa;
        payload.data_pagamento = d.pag;
        payload.data_decorrenza_rinnovo = d.mc;
        payload.data_incasso = dateFields.data_incasso;
        payload.data_copertura = dateFields.data_copertura;
        if (titoloRow?.conferimento_gestito) {
          payload.fondi_ricevuti = true;
        }
      }
      if (bancaLabel) payload.banca_pagamento = bancaLabel;
      // Pagamento diretto compagnia: premio pagato dal cliente in compagnia →
      // nessuna entrata banca lato broker; E/C compagnia vede solo la provvigione.
      if (pagDirettoTitolo) {
        payload.pag_diretto_compagnia = true;
        payload.tipo_pagamento = TIPO_PAGAMENTO_DIREITO_COMPAGNIA;
      }
      const cigDraft = cigById[t.id];
      if (cigDraft?.isEnte) {
        payload.cig_rif = normalizeCig(cigDraft.cig) || null;
        payload.cig_temporaneo = !!cigDraft.temporaneo;
      }

      const { error } = await (supabase.from("titoli") as any).update(payload).eq("id", t.id);
      if (error) { ko++; continue; }

      // Titolo a credito (es. appendice −150): crea acconto cliente riutilizzabile
      if (isFullIncasso && creditoDaPremioLordo(lordo) > 0 && t.cliente_anagrafica_id) {
        const resAcc = await creaAnticipoDaTitoloACredito(supabase, {
          titoloId: t.id,
          clienteId: t.cliente_anagrafica_id,
          premioLordo: lordo,
          numeroTitolo: t.numero_titolo,
          dataAnticipo: d.mc,
          userId,
        });
        if (!resAcc.ok) {
          toast.warning(`Titolo chiuso ma acconto non creato (${t.numero_titolo ?? t.id}): ${resAcc.error}`);
        } else if (!resAcc.skipped && resAcc.importo) {
          accontiCreati += 1;
          accontiImporto = round2(accontiImporto + resAcc.importo);
          await logAttivita({
            azione: "anticipo_da_titolo_credito",
            entita_tipo: "titolo",
            entita_id: t.id,
            dettagli_json: {
              anticipo_id: resAcc.anticipoId,
              importo: resAcc.importo,
              cliente_id: t.cliente_anagrafica_id,
            },
          });
        }
      }

      if (utilizziPerTitolo.length > 0) {
        const rows = utilizziPerTitolo.map((u) => ({
          ...u,
          titolo_id: t.id,
          data_utilizzo: form.dataMessaCassa,
          creato_da: userId,
        }));
        const { error: errU } = await (supabase.from("cliente_anticipi_utilizzi") as any).insert(rows);
        if (errU) {
          toast.error(`Errore registrazione acconti su ${t.numero_titolo ?? t.id}: ${errU.message}`);
        } else {
          const totUtilizzo = round2(utilizziPerTitolo.reduce((s, u: any) => s + Number(u.importo_utilizzato || 0), 0));
          if (totUtilizzo > 0) {
            const { error: errMA } = await (supabase.from("movimenti_contabili") as any).insert({
              ufficio_id: t.ufficio_id || null,
              tipo: "entrata",
              categoria: "utilizzo_anticipo",
              riferimento_tipo: "titolo",
              riferimento_id: t.id,
              importo: totUtilizzo,
              data_movimento: form.dataMessaCassa,
              descrizione: `Utilizzo acconto cliente su titolo ${t.numero_titolo ?? t.id}`,
              stato: "registrato",
              created_by: userId,
            });
            if (errMA) toast.warning(`Acconto registrato ma prima nota non aggiornata: ${errMA.message}`);
          }
        }
      }

      // Giroconto inter-cliente: se gli acconti del cliente pagatore coprono la
      // quietanza di un cliente diverso, registra una partita di giroconto per
      // ciascun acconto utilizzato (visibile negli E/C di entrambi i clienti).
      if (
        effettivoPagatoreId &&
        t.cliente_anagrafica_id &&
        t.cliente_anagrafica_id !== effettivoPagatoreId &&
        utilizziPerTitolo.length > 0
      ) {
        const giroRows = utilizziPerTitolo.map((u) => ({
          data: d.mc,
          cliente_pagatore_id: effettivoPagatoreId,
          cliente_beneficiario_id: t.cliente_anagrafica_id,
          titolo_id: t.id,
          anticipo_id: u.anticipo_id,
          importo: u.importo_utilizzato,
          note: `Acconto ${clienteNomeById.get(effettivoPagatoreId) || "pagatore"} usato per quietanza ${t.numero_titolo ?? t.id} di ${t.cliente_anagrafica_id ? clienteNomeById.get(t.cliente_anagrafica_id) || "altro cliente" : "altro cliente"}`,
          created_by: userId,
        }));
        const { error: errG } = await (supabase.from("giroconti_cliente") as any).insert(giroRows);
        if (errG) toast.warning(`Giroconto inter-cliente non registrato su ${t.numero_titolo ?? t.id}: ${errG.message}`);
      }

      // Abbuoni/arrotondamenti → sulla quietanza (titoli_compensazioni)
      if (abbuoniForThis.length > 0) {
        const compRows = abbuoniForThis.map((c) => ({
          titolo_id: t.id,
          causale_id: c.causale_id,
          causale_codice: c.causale_codice,
          causale_descrizione: c.causale_descrizione,
          importo: c.importo,
          segno: c.segno,
          note: c.note || null,
          creato_da: userId,
        }));
        const { error: errC } = await (supabase.from("titoli_compensazioni") as any).insert(compRows);
        if (errC) {
          toast.error(`Errore registrazione abbuoni su ${t.numero_titolo ?? t.id}: ${errC.message}`);
        } else {
          const categoriaFor = (eff: EffettoContabile) =>
            eff === "abbuono" ? "abbuono" : "compensazione_titolo";
          const movRows = abbuoniForThis.map((c) => ({
            ufficio_id: t.ufficio_id || null,
            tipo: c.segno === "+" ? "uscita" : "entrata",
            categoria: categoriaFor(c.effetto),
            riferimento_tipo: "titolo",
            riferimento_id: t.id,
            importo: c.importo,
            data_movimento: form.dataMessaCassa,
            descrizione: `${c.causale_codice} — ${c.causale_descrizione}${c.note ? " · " + c.note : ""}`,
            stato: "registrato",
            created_by: userId,
          }));
          if (movRows.length > 0) {
            const { error: errM } = await (supabase.from("movimenti_contabili") as any).insert(movRows);
            if (errM) toast.warning(`Abbuoni salvati ma prima nota non aggiornata: ${errM.message}`);
          }
        }
      }

      if (isFullIncasso && modalitaByTitolo[t.id] === "produttore_trattiene_provv" && tr) {
        const calcTr = calcIncassoConTrattenutaProvvigioni(dovutoT, tr.provvigioneLorda, tr.percentualeRa);
        const { error: errMod } = await (supabase.from("titoli_modalita_incasso") as any).insert({
          titolo_id: t.id,
          modalita: "produttore_trattiene_provv",
          anagrafica_commerciale_id: tr.prodId,
          importo_dovuto_lordo: dovutoT,
          importo_provvigione_lorda: tr.provvigioneLorda,
          importo_ra: tr.ritenutaAcconto,
          importo_trattenuto_netto: tr.trattenutoNetto,
          importo_versato_consul: calcTr.importoVersatoConsul,
          stato: "attiva",
          applicata_da: userId,
        });
        if (errMod) {
          toast.warning(`Incasso ok ma modalità non salvata su ${t.numero_titolo ?? t.id}: ${errMod.message}`);
        }
      }

      ok++;
      await logAttivita({
        azione: isFullIncasso ? "messa_a_cassa" : "incasso_parziale",
        entita_tipo: "titolo",
        entita_id: t.id,
        dettagli_json: {
          data_messa_cassa: isFullIncasso ? form.dataMessaCassa : null,
          tipo_pagamento: tipoPag,
          modalita_incasso: modalitaByTitolo[t.id] || "standard",
          anticipi_usati: utilizziPerTitolo,
          compensazioni: compForThis.map((c) => ({ codice: c.causale_codice, segno: c.segno, importo: c.importo })),
          residuo_cash: residuoCash,
          importo_incassato_totale: nuovoIncassato,
          incasso_parziale: !isFullIncasso,
          movimento_bancario_id: movimentoBancarioIdEffettivo,
          trattenuta_provvigioni: tr
            ? {
                prod_id: tr.prodId,
                provvigione_lorda: tr.provvigioneLorda,
                ritenuta: tr.ritenutaAcconto,
                trattenuto_netto: tr.trattenutoNetto,
              }
            : null,
          bulk: isMulti,
        },
      });
      try {
        await supabase.functions.invoke("calcola-provvigioni", { body: { titolo_id: t.id } });
        if (tr?.prodId && isFullIncasso) {
          const { error: errPag } = await (supabase.from("provvigioni_generate") as any)
            .update({ pagata: true })
            .eq("titolo_id", t.id)
            .eq("anagrafica_commerciale_id", tr.prodId)
            .eq("tipo_destinatario", "commerciale");
          if (errPag) {
            toast.warning(`Provvigione non segnata pagata su ${t.numero_titolo ?? t.id}: ${errPag.message}`);
          }
        }
      } catch {
        toast.warning(`Calcolo provvigioni non completato su ${t.numero_titolo ?? t.id}`);
      }
      if (isFullIncasso) {
        notificaTitoloIds.push(t.id);
      }
    }

    if (ok > 0 && updateMadreCig && cigCondiviso && hasEnteCig) {
      const cigVal = normalizeCig(enteCigDrafts[0].cig) || null;
      const tempVal = !!enteCigDrafts[0].temporaneo;
      const seenMadre = new Set<string>();
      for (const t of titoli) {
        if (!cigById[t.id]?.isEnte) continue;
        const madreId = await resolveTitoloMadreId(supabase, t.id);
        if (!madreId || madreId === t.id || seenMadre.has(madreId)) continue;
        seenMadre.add(madreId);
        const { error: errMadre } = await (supabase.from("titoli") as any)
          .update({
            cig_rif: cigVal,
            cig_temporaneo: tempVal,
            updated_at: new Date().toISOString(),
          })
          .eq("id", madreId);
        if (errMadre) {
          toast.warning(`CIG aggiornato sulla quietanza ma non sulla madre: ${errMadre.message}`);
        }
      }
    }

    // Acconti (ACC_*) a livello cliente → una sola volta sul pagatore
    if (ok > 0 && accontiCliente.length > 0) {
      const clienteAnticipoId =
        effettivoPagatoreId || titoli.find((x) => x.cliente_anagrafica_id)?.cliente_anagrafica_id || null;
      if (!clienteAnticipoId) {
        toast.warning("Acconti non creati: cliente pagatore non determinato");
      } else {
        const contoId = form.banca || bankIncasso?.contoBancarioId || null;
        const dataAnticipo = form.dataMessaCassa;
        const quietanzeLabel = titoli
          .map((t) => t.numero_titolo || t.id.slice(0, 8))
          .slice(0, 5)
          .join(", ");
        const anticipoRows = accontiCliente.map((c) => ({
          cliente_id: clienteAnticipoId,
          data_anticipo: dataAnticipo,
          conto_bancario_id: contoId,
          importo: c.importo,
          causale_id: c.causale_id,
          segno: c.segno === "-" ? "-" : "+",
          // Passivo (−): partita in Acconti e compensazioni senza residuo spendibile
          importo_residuo: c.segno === "-" ? 0 : c.importo,
          note:
            c.segno === "-"
              ? `Accredito passivo / mancanza bonifico da messa a cassa (${quietanzeLabel}${titoli.length > 5 ? "…" : ""})${c.note ? " · " + c.note : ""}`
              : `Acconto attivo da messa a cassa (${quietanzeLabel}${titoli.length > 5 ? "…" : ""})${c.note ? " · " + c.note : ""}`,
          creato_da: userId,
        }));
        const { error: errAcc } = await (supabase.from("cliente_anticipi") as any).insert(anticipoRows);
        if (errAcc) {
          toast.warning(`Acconti cliente non creati: ${errAcc.message}`);
        } else {
          accontiCreati += anticipoRows.length;
          accontiImporto = round2(
            accontiImporto + anticipoRows.reduce((s, r) => s + (Number(r.importo) || 0), 0),
          );
        }
      }
    }

    if (notificaTitoloIds.length > 0) {
      scheduleOrInvokeNotificaMessaCassa(notificaTitoloIds, { serale: messaCassaSerale })
        .then((outcome) => {
          handleNotificaMessaCassaOutcome(outcome, () => {
            queryClient.invalidateQueries({ queryKey: ["documenti", "titolo"] });
          });
        })
        .catch(() => toast.warning("Notifica agenzia non inviata"));
    }

    if (ok > 0 && !bankIncasso && selectedBonificoIds.length > 0 && Object.keys(cashByTitolo).length > 0) {
      const pagatore = effettivoPagatoreId || titoli.find((t) => t.cliente_anagrafica_id)?.cliente_anagrafica_id;
      if (pagatore) {
        try {
          const titoliLink = titoli
            .filter((t) => (cashByTitolo[t.id] || 0) > 0 && t.cliente_anagrafica_id)
            .map((t) => ({
              titoloId: t.id,
              clienteId: t.cliente_anagrafica_id as string,
              importo: cashByTitolo[t.id],
            }));
          const movimentiImporti: Record<string, number> = {};
          for (const b of selectedBonifici) movimentiImporti[b.id] = Number(b.importo) || 0;
          await ricongiungiEFinalizzaBonificiMultipliDaIncasso({
            movimentoIds: selectedBonificoIds,
            movimentiImporti,
            clientePagatoreId: pagatore,
            contoBancarioId: form.banca || null,
            dataMessaCassa: form.dataMessaCassa,
            titoli: titoliLink,
            userId,
            clienteLabel: clienteNomeById.get(pagatore) || "Cliente",
            ufficioIdHint: titoli.find((t) => t.ufficio_id)?.ufficio_id ?? null,
            // Mai auto-acconto da surplus: gli ACC_* li crea solo la classificazione manuale sopra
            skipClienteAnticipoInsert: true,
          });
          toast.success(
            selectedBonificoIds.length > 1
              ? `${selectedBonificoIds.length} bonifici collegati e segnati sui caricamenti conti`
              : "Bonifico collegato e segnato sui caricamenti conti",
          );
          queryClient.invalidateQueries({ queryKey: ["movimenti-bancari"] });
          queryClient.invalidateQueries({ queryKey: ["mov-bancari"] });
          queryClient.invalidateQueries({ queryKey: ["ricongiungimento"] });
          queryClient.invalidateQueries({ queryKey: ["incassi-bonifici-aperti"] });
          queryClient.invalidateQueries({ queryKey: ["messa-cassa-bonifici-candidati"] });
        } catch (e: any) {
          toast.warning(
            `Incasso ok, ma collegamento bonifico non completato: ${e?.message || "errore"}. Verifica in Incassi → Bonifici aperti.`,
          );
        }
      } else {
        toast.warning("Incasso ok, ma manca il cliente pagatore per collegare il bonifico");
      }
    } else if (ok > 0 && needsBonificoLink && bonificiCandidati.length === 0) {
      toast.warning(
        "Incasso registrato senza bonifico in caricamento: importa il movimento da Caricamento Mov. Bancari, poi abbinalo in Incassi → Bonifici aperti.",
      );
    }

    setLoading(false);
    if (ok > 0) {
      const parziali = bankIncasso && titoli.some((t) => {
        const imp = bankIncasso.importoByTitoloId[t.id] ?? 0;
        const lordo = Number(t.premio_lordo) || 0;
        return imp > 0 && imp < lordo;
      });
      toast.success(
        isMulti
          ? `${ok} polizze processate${ko > 0 ? `, ${ko} errori` : ""}${parziali ? " (alcune parziali, restano in carico)" : ""}${accontiCreati ? ` · ${accontiCreati} acconti creati (${fmtEuro(accontiImporto)})` : ""}`
          : accontiCreati
            ? `Conguaglio chiuso — creato acconto cliente ${fmtEuro(accontiImporto)}`
            : parziali
              ? "Incasso parziale registrato — quietanza resta in carico"
              : "Polizza incassata"
      );
      queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-carico-totale"] });
      queryClient.invalidateQueries({ queryKey: ["titolo"] });
      queryClient.invalidateQueries({ queryKey: ["cliente-anticipi"] });
      queryClient.invalidateQueries({ queryKey: ["cliente-anticipi-disponibili"] });
      queryClient.invalidateQueries({ queryKey: ["anticipi-globale"] });
      queryClient.invalidateQueries({ queryKey: ["anticipi-residuo-by-clienti"] });
      queryClient.invalidateQueries({ queryKey: ["titoli-compensazioni"] });
      queryClient.invalidateQueries({ queryKey: ["cliente-abbuoni"] });
      queryClient.invalidateQueries({ queryKey: ["titoli-modalita-incasso"] });
      queryClient.invalidateQueries({ queryKey: ["provvigioni-generate"] });
      queryClient.invalidateQueries({ queryKey: ["ec-produttori"] });
      queryClient.invalidateQueries({ queryKey: ["polizze_cliente"] });
      queryClient.invalidateQueries({ queryKey: ["ec-agenzia-contab"] });
      queryClient.invalidateQueries({ queryKey: ["messa-cassa-bonifici-candidati"] });
      onSuccess?.(form.dataMessaCassa);
      onOpenChange(false);
    } else {
      toast.error("Operazione fallita");
    }
  };

  // === UI: modalità incasso/provvigioni per titolo ===
  const renderModalitaPanel = (titoloId: string, label?: string) => {
    const det = titoliTrattenutaDet.find((d) => d.id === titoloId);
    if (!det?.anagrafica_commerciale_id) return null;
    const prodById = new Map(produttoriTrattenuta.map((p) => [p.id, p]));
    const prod = prodById.get(det.anagrafica_commerciale_id);
    const value = modalitaByTitolo[titoloId] || "standard";
    const ctx =
      value === "produttore_trattiene_provv"
        ? buildTrattenutaCtx(det, prodById, { force: true })
        : null;
    if (value === "produttore_trattiene_provv" && !ctx) {
      return (
        <div className="rounded-md border border-amber-300 bg-amber-50/50 p-3 text-xs text-amber-900">
          Modalità «trattenuta» non applicabile: nessuna provvigione produttore su questo titolo.
        </div>
      );
    }

    return (
      <div className="rounded-md border border-violet-300/70 bg-violet-50/40 dark:bg-violet-950/20 p-3 space-y-2">
        <div className="text-sm font-medium text-violet-900 dark:text-violet-200">
          Modalità provvigioni / incasso{label ? ` — ${label}` : ""}
        </div>
        <Select
          value={value}
          onValueChange={(v) =>
            setModalitaByTitolo((prev) => ({ ...prev, [titoloId]: v as ModalitaIncasso }))
          }
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODALITA_INCASSO_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          {MODALITA_INCASSO_OPTIONS.find((o) => o.value === value)?.description}
        </p>
        {ctx && (
          <div className="text-xs space-y-0.5 pt-1 border-t border-violet-200/60">
            <div className="flex justify-between">
              <span>Produttore</span>
              <span className="font-medium">{ctx.prodNome}</span>
            </div>
            <div className="flex justify-between">
              <span>Provvigione trattenuta</span>
              <span className="font-mono">{fmtEuro(ctx.provvigioneLorda)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Netto (dopo RA {ctx.percentualeRa}%)</span>
              <span className="font-mono">{fmtEuro(ctx.trattenutoNetto)}</span>
            </div>
          </div>
        )}
        {prod?.trattenuta_provvigioni_incasso && value === "standard" && (
          <p className="text-[10px] text-amber-700 dark:text-amber-400 italic">
            Default anagrafica: trattenuta — per questo incasso hai scelto standard.
          </p>
        )}
      </div>
    );
  };

  /**
   * Causali a livello cliente (niente picker quietanza).
   * ABB/ARROT rettificano il dovuto complessivo; ACC_* → scheda Acconti del pagatore.
   */
  const renderCompensazioniClientePanel = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <Calculator className="w-4 h-4" /> Abbuoni, arrotondamenti e acconti
        </div>
        <Select
          value=""
          onValueChange={(v) => {
            if (!v) return;
            const c = causaliComp.find((x) => x.id === v);
            let segnoAcc: "+" | "-" | undefined;
            if (c && isCausaleAccontoCliente(c.codice) && Math.abs(eccedenzaBonifico) > 0) {
              segnoAcc = eccedenzaBonifico < 0 ? "-" : "+";
            }
            addCompCliente(v, suggestCompImporto, segnoAcc);
          }}
        >
          <SelectTrigger className="w-64 h-8 text-xs">
            <SelectValue placeholder="+ Aggiungi causale…" />
          </SelectTrigger>
          <SelectContent>
            {causaliComp.map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-xs">
                <span className="font-mono mr-2">{c.segno_default}</span>
                {c.codice} — {c.descrizione}
                {isCausaleAccontoCliente(c.codice) ? (
                  <span className="text-muted-foreground ml-1">(acconto cliente)</span>
                ) : null}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Abbuoni/arrotondamenti rettificano il dovuto. <span className="font-mono">ACC_*</span>{" "}
        → scheda Acconti e compensazioni: segno + acconto attivo (eccedenza), segno − accredito passivo (mancanza).
        Nessuna classificazione automatica.
      </p>

      {compensazioniCliente.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          {eccedenzaBonifico > 0
            ? `Nessuna riga. Classifica l'eccedenza di ${fmtEuro(eccedenzaBonifico)} (ACC_* attivo oppure ABB_PAS/ARROT_P).`
            : eccedenzaBonifico < 0
              ? `Nessuna riga. Classifica la mancanza di ${fmtEuro(-eccedenzaBonifico)} (ACC_* passivo oppure ABB_ATT/ARROT_A).`
              : "Nessuna riga. Opzionale: abbuono / arrotondamento / acconto."}
        </p>
      ) : (
        <div className="space-y-1.5">
          {compensazioniCliente.map((c) => (
            <div key={c.tempId} className="flex items-center gap-2 bg-background/80 rounded px-2 py-1.5">
              <button
                type="button"
                onClick={() => updateCompCliente(c.tempId, { segno: c.segno === "+" ? "-" : "+" })}
                title={c.segno === "+" ? "Riduce il dovuto — clicca per invertire" : "Aumenta il dovuto — clicca per invertire"}
                className={`font-mono text-sm font-bold w-6 h-6 rounded border transition-colors ${
                  c.segno === "+"
                    ? "text-green-600 border-green-300 hover:bg-green-50"
                    : "text-red-600 border-red-300 hover:bg-red-50"
                }`}
              >
                {c.segno}
              </button>
              <div className="flex-1 text-xs min-w-0">
                <div className="font-medium">{c.causale_codice}</div>
                <div className="text-muted-foreground truncate">
                  {c.causale_descrizione}
                  {isCausaleAccontoCliente(c.causale_codice)
                    ? c.segno === "-"
                      ? " · accredito passivo (Acconti)"
                      : " · acconto attivo (Acconti)"
                    : ""}
                </div>
              </div>
              <Input
                type="text"
                placeholder="note"
                value={c.note}
                onChange={(e) => updateCompCliente(c.tempId, { note: e.target.value })}
                className="w-28 h-8 text-xs"
              />
              <ImportoCompensazioneInput
                value={c.importo}
                autoFocus={lastAddedCompId === c.tempId}
                onCommit={(n) => updateCompCliente(c.tempId, { importo: n })}
              />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeCompCliente(c.tempId)}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] overflow-y-auto">
        <MessaCassaSeraleCheckbox
          checked={messaCassaSerale}
          onCheckedChange={setMessaCassaSerale}
          id="messa-cassa-serale-incasso"
        />
        <DialogHeader className="pr-52">
          <DialogTitle>
            {titoliACredito.length > 0 && titoliACredito.length === titoli.length
              ? "Chiusura conguaglio a credito"
              : "Conferma Messa a Cassa"}
          </DialogTitle>
          <DialogDescription>
            {isMulti ? (
              <>Incasso multiplo: <strong>{titoli.length} polizze</strong> — totale lordo {fmtEuro(totaleLordo)}</>
            ) : (
              <>Polizza {titoli[0]?.numero_titolo || titoli[0]?.id?.slice(0, 8) || ""} — Lordo {fmtEuro(totaleLordo)}</>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {titoliACredito.length > 0 && (
            <div className="rounded-md border border-violet-300 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-800 px-3 py-2 text-xs text-violet-900 dark:text-violet-200">
              <strong>Conguaglio a credito</strong>
              {titoliACredito.length === 1 ? (
                <> ({titoliACredito[0].numero_titolo || "titolo"}): </>
              ) : (
                <> ({titoliACredito.length} titoli): </>
              )}
              verrà creato un <strong>acconto cliente di {fmtEuro(totaleCredito)}</strong> utilizzabile
              sulle prossime messe a cassa oppure segnabile come rimborsato/bonificato.
              Non è un incasso in entrata.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data Messa a Cassa</Label>
              <Input type="date" value={form.dataMessaCassa} onChange={(e) => setForm(f => ({ ...f, dataMessaCassa: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Data Pagamento</Label>
              <Input type="date" value={form.dataPagamento} onChange={(e) => setForm(f => ({ ...f, dataPagamento: e.target.value }))} className="mt-1" />
            </div>
          </div>

          {/* Cliente pagatore: i cui acconti vengono erosi (può differire dai clienti dei titoli) */}
          <div>
            <Label className="text-xs flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Acconti erosi dal cliente pagatore
            </Label>
            <SearchableSelect
              options={pagatoreSelectOptions}
              value={effettivoPagatoreId || ""}
              onValueChange={(v) => setPagatoreId(v || null)}
              onSearchChange={setPagatoreSearch}
              searchValue={pagatoreSearch}
              serverSideSearch
              clearable
              clearLabel="— Nessun pagatore —"
              placeholder="Seleziona cliente pagatore..."
              searchPlaceholder="Cerca cliente (nome, CF, P.IVA)..."
              className="mt-1"
            />
          </div>

          {/* Aggiungi altre quietanze da incassare — flusso "per cliente" */}
          <div className="rounded-md border bg-muted/30 p-3 space-y-3">
            <Label className="text-xs flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Aggiungi quietanze di un cliente
            </Label>
            <SearchableSelect
              options={clienteQuietanzeSelectOptions}
              value={clienteQuietanze?.id || ""}
              onValueChange={(v) => {
                if (!v) {
                  setClienteQuietanze(null);
                  setQuietanzeSel({});
                  return;
                }
                const c = (clienteQuietanzeOptionsRaw as any[]).find((x) => x.id === v);
                setClienteQuietanze({ id: v, nome: c ? nomeCliente(c) : clienteQuietanze?.nome || "cliente" });
                setQuietanzeSel({});
              }}
              onSearchChange={setClienteQuietanzeSearch}
              searchValue={clienteQuietanzeSearch}
              serverSideSearch
              clearable
              clearLabel="— Nessun cliente —"
              placeholder="Cerca cliente per vedere le sue quietanze..."
              searchPlaceholder="Cerca cliente (nome, CF, P.IVA)..."
            />

            {clienteQuietanze && (
              <div className="space-y-1.5">
                {(quietanzeCliente as any[]).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Nessuna quietanza da incassare per <strong>{clienteQuietanze.nome}</strong>.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={toggleTutteQuietanze}
                        className="text-[11px] text-primary hover:underline"
                      >
                        {tutteQuietanzeSel ? "Deseleziona tutte" : "Seleziona tutte"}
                      </button>
                      <span className="text-[11px] text-muted-foreground">
                        {(quietanzeCliente as any[]).length} quietanze da incassare
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {(quietanzeCliente as any[]).map((r) => (
                        <label
                          key={r.id}
                          className="flex items-center gap-2 bg-background/70 rounded px-2 py-1.5 text-xs cursor-pointer"
                        >
                          <Checkbox
                            checked={!!quietanzeSel[r.id]}
                            onCheckedChange={() => toggleQuietanzaSel(r.id)}
                          />
                          <span className="font-mono font-medium shrink-0">{r.numero_titolo || r.id.slice(0, 8)}</span>
                          <span className="font-mono shrink-0">{fmtEuro(Number(r.premio_lordo) || 0)}</span>
                          <span className="text-muted-foreground truncate min-w-0">
                            {r.data_scadenza ? `scad. ${new Date(r.data_scadenza).toLocaleDateString("it-IT")}` : "—"}
                            {clienteQuietanzeIsEnte
                              ? ` · ${formatCigBadge(r.cig_rif, r.cig_temporaneo)}`
                              : ""}
                          </span>
                        </label>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      disabled={numQuietanzeSel === 0}
                      onClick={addQuietanzeSelezionate}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Aggiungi {numQuietanzeSel > 0 ? `${numQuietanzeSel} ` : ""}quietanze selezionate
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Ricerca rapida per numero titolo (opzionale) */}
            <div className="pt-2 border-t space-y-1.5">
              <Label className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Plus className="w-3 h-3" /> Oppure cerca per numero titolo
              </Label>
              <SearchableSelect
                options={(titoliSearchResults as any[]).map((r) => {
                  const ente = isClienteEnte(r.clienti);
                  const cig = ente ? ` · ${formatCigBadge(r.cig_rif, r.cig_temporaneo)}` : "";
                  return {
                    value: r.id,
                    label: `${r.numero_titolo || r.id.slice(0, 8)}  ${fmtEuro(Number(r.premio_lordo) || 0)}`,
                    description: `${nomeCliente(r.clienti)}${cig}`,
                  };
                })}
                value=""
                onValueChange={(id) => {
                  const row = (titoliSearchResults as any[]).find((r) => r.id === id);
                  if (row) addTitolo(row);
                }}
                onSearchChange={setTitoloSearch}
                searchValue={titoloSearch}
                serverSideSearch
                placeholder="Cerca quietanza da aggiungere..."
                searchPlaceholder="Cerca numero titolo..."
              />
            </div>

            {/* Quietanze già in incasso */}
            <div className="space-y-1 pt-1">
              {titoli.map((t) => (
                <div key={t.id} className="flex items-center gap-2 bg-background/70 rounded px-2 py-1.5 text-xs">
                  <span className="font-mono font-medium shrink-0">{t.numero_titolo || t.id.slice(0, 8)}</span>
                  <span className="font-mono shrink-0">{fmtEuro(Number(t.premio_lordo) || 0)}</span>
                  <span className="text-muted-foreground truncate min-w-0 flex-1">
                    {t.cliente_anagrafica_id ? clienteNomeById.get(t.cliente_anagrafica_id) || "…" : "—"}
                    {cigById[t.id]?.isEnte ? ` · ${formatCigBadge(cigById[t.id].cig, cigById[t.id].temporaneo)}` : ""}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    disabled={titoli.length <= 1}
                    title={titoli.length <= 1 ? "Deve restare almeno una quietanza" : "Rimuovi"}
                    onClick={() => removeTitolo(t.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            {hasEnteCig && (
              <div className="rounded-md border border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
                {cigCondiviso ? (
                  <CigRifField
                    idPrefix="mc-cig"
                    cig={enteCigDrafts[0].cig}
                    temporaneo={enteCigDrafts[0].temporaneo}
                    warningEmpty
                    onCigChange={(cig) => patchCigEnte({ cig })}
                    onTemporaneoChange={(temporaneo, cig) =>
                      patchCigEnte(cig !== undefined ? { temporaneo, cig } : { temporaneo })
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    <p className="text-[11px] text-muted-foreground">
                      I CIG delle quietanze ente non coincidono: modifica per riga.
                    </p>
                    {titoli.filter((t) => cigById[t.id]?.isEnte).map((t) => (
                      <div key={t.id} className="space-y-1">
                        <p className="text-[11px] font-mono font-medium">{t.numero_titolo || t.id.slice(0, 8)}</p>
                        <CigRifField
                          idPrefix={`mc-cig-${t.id}`}
                          cig={cigById[t.id].cig}
                          temporaneo={cigById[t.id].temporaneo}
                          warningEmpty
                          onCigChange={(cig) => patchCigEnte({ cig }, t.id)}
                          onTemporaneoChange={(temporaneo, cig) =>
                            patchCigEnte(cig !== undefined ? { temporaneo, cig } : { temporaneo }, t.id)
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
                {cigCondiviso && (
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      id="mc-cig-madre"
                      checked={updateMadreCig}
                      onCheckedChange={(v) => setUpdateMadreCig(v === true)}
                    />
                    <Label htmlFor="mc-cig-madre" className="text-[11px] cursor-pointer">
                      Aggiorna anche la polizza madre
                    </Label>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Banner giroconto inter-cliente */}
          {titoliGiroconto.length > 0 && (
            <div className="rounded-md border border-amber-400/60 bg-amber-50/60 dark:bg-amber-950/30 p-3 flex gap-2 text-xs text-amber-900 dark:text-amber-200">
              <ArrowLeftRight className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                Gli acconti di <strong>{effettivoPagatoreId ? clienteNomeById.get(effettivoPagatoreId) || "pagatore" : "pagatore"}</strong>{" "}
                copriranno {titoliGiroconto.length}{" "}
                {titoliGiroconto.length === 1 ? "polizza di un altro cliente" : "polizze di altri clienti"}.
                Verrà registrata una partita di <strong>giroconto inter-cliente</strong> negli estratti conto di entrambi i clienti.
              </div>
            </div>
          )}

          {effettivoPagatoreId && anticipi.length > 0 && (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Wallet className="w-4 h-4" /> Acconti disponibili del cliente pagatore
              </div>
              {anticipi.map((a) => {
                const selected = anticipiSel[a.id] !== undefined;
                return (
                  <div key={a.id} className="flex items-center gap-2 bg-background/60 rounded px-2 py-1.5">
                    <Checkbox checked={selected} onCheckedChange={() => toggleAnticipo(a.id, Number(a.importo_residuo))} />
                    <div className="flex-1 text-xs">
                      <div className="font-medium">{new Date(a.data_anticipo).toLocaleDateString("it-IT")} — {a.conto?.etichetta || "n/d"}</div>
                      <div className="text-muted-foreground">Residuo: {fmtEuro(Number(a.importo_residuo))}</div>
                    </div>
                    {selected && (
                      <Input
                        type="number" step="0.01" min="0" max={Number(a.importo_residuo)}
                        value={anticipiSel[a.id]}
                        onChange={(e) => setImportoAnticipo(a.id, e.target.value, Number(a.importo_residuo))}
                        className="w-28 h-8 text-xs"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Cash + tipo pagamento (single titolo) */}
          {!isMulti && cashEffettivo >= 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{haTrattenuta ? "Importo versato a Consulbrokers" : "Importo incassato"}</Label>
                <div className="flex gap-1 mt-1">
                  <Input
                    type="number" step="0.01" min="0"
                    value={isPagDiretto ? 0 : form.cashImporto}
                    disabled={isPagDiretto}
                    onChange={(e) => setForm(f => ({ ...f, cashImporto: round2(Number(e.target.value) || 0) }))}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={autoQuadra}
                    disabled={isPagDiretto}
                    title="Imposta al valore che fa quadrare"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="mt-2">
                  <MessaCassaProvvigioniDisplay
                    attive={provvigioniDisplay.attive}
                    passive={provvigioniDisplay.passive}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">
                  Tipo Pagamento {tipoPagamentoObbligatorio && <span className="text-destructive">*</span>}
                </Label>
                <Select
                  value={form.tipoPagamento || undefined}
                  onValueChange={handleTipoPagamentoChange}
                >
                  <SelectTrigger className={`mt-1 ${tipoPagamentoObbligatorio && !form.tipoPagamento ? "ring-1 ring-amber-500" : ""}`}>
                    <SelectValue placeholder="— Seleziona tipo pagamento —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contanti">Contanti</SelectItem>
                    <SelectItem value="pos">POS</SelectItem>
                    <SelectItem value="bonifico">Bonifico</SelectItem>
                    <SelectItem value="assegno">Assegno</SelectItem>
                    <SelectItem value={TIPO_PAGAMENTO_COSTI_CONSULBROKERS}>
                      Costi Consulbrokers
                    </SelectItem>
                    <SelectItem value={TIPO_PAGAMENTO_COMPENSAZIONE}>
                      Compensazione
                    </SelectItem>
                    <SelectItem value={TIPO_PAGAMENTO_DIREITO_COMPAGNIA}>
                      Pagamento diretto compagnia
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Bulk: tipo pagamento (anche per pag. diretto a incasso 0) */}
          {isMulti && !bankIncasso && (cashEffettivo > 0 || isPagDiretto || totaleDovutoConsul > 0) && (
            <div>
              <Label className="text-xs">
                Tipo Pagamento <span className="text-destructive">*</span>{" "}
                {totaleAnticipiUsati > 0 && !isPagDiretto && (
                  <span className="text-muted-foreground">(parte residua)</span>
                )}
              </Label>
              <Select
                value={form.tipoPagamento || undefined}
                onValueChange={handleTipoPagamentoChange}
              >
                <SelectTrigger className={`mt-1 ${!form.tipoPagamento ? "ring-1 ring-amber-500" : ""}`}>
                  <SelectValue placeholder="— Seleziona tipo pagamento —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contanti">Contanti</SelectItem>
                  <SelectItem value="pos">POS</SelectItem>
                  <SelectItem value="bonifico">Bonifico</SelectItem>
                  <SelectItem value="assegno">Assegno</SelectItem>
                  <SelectItem value={TIPO_PAGAMENTO_COSTI_CONSULBROKERS}>
                    Costi Consulbrokers
                  </SelectItem>
                  <SelectItem value={TIPO_PAGAMENTO_COMPENSAZIONE}>
                    Compensazione
                  </SelectItem>
                  <SelectItem value={TIPO_PAGAMENTO_DIREITO_COMPAGNIA}>
                    Pagamento diretto compagnia
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {(isMulti || cashEffettivo < 0) && titoli.length > 0 && (
            <MessaCassaProvvigioniDisplay
              attive={provvigioniDisplay.attive}
              passive={provvigioniDisplay.passive}
            />
          )}

          {showBonificoPanel && (
            <div className="rounded-lg border border-primary/20 bg-muted/20 p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-primary" />
                    Ricongiungimento bonifico
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    1) Conto (default preselezionato) · 2) Estratto/movimento da collegare
                    {cashEffettivo > 0
                      ? ` all'incasso (${fmtEuro(cashEffettivo)})`
                      : " (anche su incasso tecnico a €0)"}.
                  </p>
                </div>
                {bankIncasso && (
                  <Badge variant="secondary" className="text-[10px]">
                    Già collegato da flusso bonifico
                  </Badge>
                )}
                {preferredBonifico?.movimentoId && !bankIncasso && (
                  <Badge variant="outline" className="text-[10px] border-sky-400 text-sky-800">
                    Proposto da Incassi (match nome)
                  </Badge>
                )}
              </div>

              {bankIncasso ? (
                <div>
                  <Label className="text-xs">Conto Consulbrokers</Label>
                  <ContoBancarioSelect
                    tipi={["generico", "incasso_clienti"]}
                    value={form.banca || bankIncasso.contoBancarioId}
                    onChange={(id) => setForm((f) => ({ ...f, banca: id || "" }))}
                    placeholder="Cerca conto..."
                    showPreview
                    className="mt-1"
                    disabled
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4">
                  {/* STEP 1 — Conti */}
                  <div className="rounded-md border bg-background p-3 space-y-2 min-h-[280px]">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" />
                      1. Conto
                    </Label>
                    <div className="max-h-[340px] overflow-y-auto space-y-1.5 pr-0.5">
                      {contiBonifico.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-4 text-center">
                          Nessun conto disponibile per la tua sede.
                        </p>
                      ) : (
                        contiBonifico.map((c: any) => {
                          const selected = form.banca === c.id;
                          const iban = String(c.iban || "");
                          const ibanShort =
                            iban.length > 12 ? `${iban.slice(0, 4)}…${iban.slice(-4)}` : iban;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedBonificoIds([]);
                                setEstrattoSearch("");
                                setForm((f) => ({ ...f, banca: c.id }));
                              }}
                              className={`w-full text-left rounded-md border px-2.5 py-2 transition-colors ${
                                selected
                                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                                  : "hover:bg-muted/60"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-medium truncate">
                                  {c.etichetta || c.banca || "Conto"}
                                </span>
                                {c.is_default && (
                                  <Badge variant="outline" className="text-[9px] shrink-0">
                                    default
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                {ibanShort}
                              </div>
                              {c.banca && (
                                <div className="text-[10px] text-muted-foreground truncate">{c.banca}</div>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* STEP 2 — Estratti */}
                  <div className="rounded-md border bg-background p-3 space-y-2 min-h-[280px]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label className="text-xs flex items-center gap-1.5">
                        <Landmark className="h-3.5 w-3.5" />
                        2. Estratti / movimenti da congiungere
                      </Label>
                      {bonificiLoading && (
                        <span className="text-[10px] text-muted-foreground">Caricamento…</span>
                      )}
                    </div>

                    {!form.banca ? (
                      <div className="flex h-[240px] items-center justify-center text-center px-4">
                        <p className="text-sm text-muted-foreground">
                          Seleziona un <strong>conto</strong> a sinistra per vedere gli estratti caricati
                          e scegliere il bonifico da collegare.
                        </p>
                      </div>
                    ) : (
                      <>
                        <Input
                          placeholder="Filtra per ordinante o descrizione…"
                          value={estrattoSearch}
                          onChange={(e) => setEstrattoSearch(e.target.value)}
                          className="h-8 text-xs"
                        />
                        {nameMatchCandidati.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 text-[10px]">
                            <Badge variant="default" className="font-normal">
                              {nameMatchCandidati.length} match nome
                            </Badge>
                            <button
                              type="button"
                              className="underline text-muted-foreground hover:text-foreground"
                              onClick={() => setSoloMatchNome((v) => !v)}
                            >
                              {soloMatchNome
                                ? `Mostra tutti i movimenti del conto (${bonificiCandidati.length})`
                                : "Mostra solo match nome"}
                            </button>
                          </div>
                        )}
                        {suggerimentoAltroConto && (
                          <div className="rounded border border-sky-300 bg-sky-50 dark:bg-sky-950/30 px-2 py-2 text-xs text-sky-900 dark:text-sky-100 space-y-1.5">
                            <p>
                              Nessun match nome su questo conto. Trovato bonifico di{" "}
                              <strong>{suggerimentoAltroConto.ordinante || "cliente"}</strong>{" "}
                              ({fmtEuro(suggerimentoAltroConto.importo)})
                              {suggerimentoAltroConto.contoEtichetta
                                ? <> su <strong>{suggerimentoAltroConto.contoEtichetta}</strong></>
                                : null}
                              .
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                setForm((f) => ({ ...f, banca: suggerimentoAltroConto.contoBancarioId }));
                                setSelectedBonificoIds([suggerimentoAltroConto.movimentoId]);
                                setSoloMatchNome(true);
                              }}
                            >
                              Vai al conto e seleziona
                            </Button>
                          </div>
                        )}
                        {estrattiFiltrati.length > 1 && (
                          <p className="text-[10px] text-muted-foreground">
                            Elenco ordinato per corrispondenza nome (cliente/ordinante), non per importo.
                            Puoi selezionare più bonifici insieme se serve coprire l'incasso.
                            {selectedBonificoIds.length > 0
                              ? ` Selezionati: ${selectedBonificoIds.length} · ${fmtEuro(totaleBonificiSelezionati)}.`
                              : " Spunta uno o più movimenti."}
                          </p>
                        )}
                        {estrattiFiltrati.length === 0 && !bonificiLoading ? (
                          <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-2">
                            {soloMatchNome && bonificiCandidati.length > 0
                              ? "Nessun match nome su questo conto. Usa «Mostra tutti» oppure cambia conto / importa il bonifico."
                              : "Nessun movimento aperto su questo conto. Puoi comunque incassare; poi importa da Caricamento Mov. Bancari e abbina in Incassi → Bonifici aperti."}
                          </p>
                        ) : (
                          <TableScrollArea className="max-h-[320px] rounded border">
                            <table className="w-full min-w-max text-xs">
                              <thead className="sticky top-0 bg-muted/90 backdrop-blur z-10">
                                <tr className="border-b text-left text-muted-foreground">
                                  <th className="w-8 p-2" />
                                  <th className="p-2 font-medium">#</th>
                                  <th className="p-2 font-medium">Data</th>
                                  <th className="p-2 font-medium text-right">Importo</th>
                                  <th className="p-2 font-medium">Ordinante / descrizione</th>
                                  <th className="p-2 font-medium">Match nome</th>
                                  <th className="p-2 font-medium">Stato</th>
                                </tr>
                              </thead>
                              <tbody>
                                {estrattiFiltrati.map((b, idx) => {
                                  const selected = selectedBonificoIds.includes(b.id);
                                  const reason =
                                    b.matchReason === "cliente"
                                      ? "Cliente"
                                      : b.matchReason === "ordinante"
                                        ? "Ordinante"
                                        : "Conto";
                                  const preferred = preferredBonifico?.movimentoId === b.id;
                                  return (
                                    <tr
                                      key={b.id}
                                      className={`border-b last:border-0 cursor-pointer ${
                                        selected ? "bg-primary/10" : preferred ? "bg-sky-50" : "hover:bg-muted/40"
                                      }`}
                                      onClick={() => toggleBonificoSelezionato(b.id, b.data_movimento)}
                                    >
                                      <td className="p-2 align-top" onClick={(e) => e.stopPropagation()}>
                                        <Checkbox
                                          checked={selected}
                                          onCheckedChange={() => toggleBonificoSelezionato(b.id, b.data_movimento)}
                                          aria-label={`Seleziona bonifico ${fmtEuro(b.importo)}`}
                                        />
                                      </td>
                                      <td className="p-2 align-top text-muted-foreground tabular-nums">
                                        {idx + 1}
                                      </td>
                                      <td className="p-2 align-top whitespace-nowrap tabular-nums">
                                        {formatDateIT(b.data_movimento)}
                                      </td>
                                      <td className="p-2 align-top text-right font-medium tabular-nums whitespace-nowrap">
                                        {fmtEuro(b.importo)}
                                      </td>
                                      <td className="p-2 align-top min-w-[160px]">
                                        <div className="font-medium line-clamp-1">
                                          {b.ordinante || "—"}
                                        </div>
                                        {b.descrizione && (
                                          <div className="text-[10px] text-muted-foreground line-clamp-2">
                                            {b.descrizione}
                                          </div>
                                        )}
                                      </td>
                                      <td className="p-2 align-top">
                                        <div className="flex flex-col gap-0.5">
                                          <Badge
                                            variant={b.matchReason === "cliente" || b.matchReason === "ordinante" ? "default" : "outline"}
                                            className="text-[9px] font-normal w-fit"
                                          >
                                            {reason}
                                          </Badge>
                                          {preferred && (
                                            <span className="text-[9px] text-sky-700">da Incassi</span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="p-2 align-top capitalize text-muted-foreground">
                                        {b.stato}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </TableScrollArea>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Incasso a zero (regolazione/proroga) */}
          {totaleDovutoConsul === 0 && !isPagDiretto && (
            <div className="rounded-md border border-blue-300 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 p-3 text-sm">
              Incasso tecnico a <strong>€0,00</strong>: conferma per registrare messa a cassa e tutte le conseguenze contabili.
            </div>
          )}

          {isPagDiretto && (
            <div className="rounded-md border border-orange-300 bg-orange-50 dark:bg-orange-950/30 text-orange-900 dark:text-orange-200 p-3 text-sm">
              <strong>Pagamento diretto compagnia:</strong> il cliente ha versato il premio in compagnia.
              Nessun incasso lato broker; in E/C resta solo la provvigione. La quietanza viene chiusa a messa a cassa.
            </div>
          )}

          {/* Riepilogo quadratura */}
          <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span>Premio lordo {isMulti ? "(totale polizze)" : "polizza"}</span><span>{fmtEuro(totaleLordo)}</span></div>
            {totaleCompMinus > 0 && (
              <div className="flex justify-between text-red-600"><span>+ Compensazioni che aumentano dovuto</span><span>+ {fmtEuro(totaleCompMinus)}</span></div>
            )}
            {totaleCompPlus > 0 && (
              <div className="flex justify-between text-green-600"><span>− Compensazioni che riducono dovuto</span><span>− {fmtEuro(totaleCompPlus)}</span></div>
            )}
            <div className="flex justify-between font-semibold border-t pt-1"><span>Dovuto cliente</span><span>{fmtEuro(dovutoFinale)}</span></div>
            {Array.from(trattenutaByTitolo.values()).map((tr) => (
              <div key={tr.titoloId} className="rounded border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-2 space-y-0.5 my-1">
                <div className="font-medium text-amber-800 dark:text-amber-300">Trattenuta provvigioni — {tr.prodNome}</div>
                <div className="flex justify-between"><span>− Provvigione trattenuta</span><span>− {fmtEuro(tr.provvigioneLorda)}</span></div>
                <div className="flex justify-between"><span>+ RA versata ({tr.percentualeRa}%)</span><span>+ {fmtEuro(tr.ritenutaAcconto)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Netto trattenuto produttore</span><span>{fmtEuro(tr.trattenutoNetto)}</span></div>
              </div>
            ))}
            {haTrattenuta && (
              <div className="flex justify-between font-semibold"><span>Da incassare (Consulbrokers)</span><span>{fmtEuro(totaleDovutoConsul)}</span></div>
            )}
            {totaleAnticipiUsati > 0 && (
              <div className="flex justify-between text-primary"><span>− Acconti utilizzati</span><span>− {fmtEuro(totaleAnticipiUsati)}</span></div>
            )}
            <div className="flex justify-between"><span>− Incasso applicato</span><span>− {fmtEuro(cashEffettivo)}</span></div>
            {surplusIncasso > 0 && (
              <div className="rounded border border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 p-2 space-y-0.5 my-1">
                <div className="font-medium text-amber-800 dark:text-amber-300">
                  Incasso superiore al dovuto ({fmtEuro(surplusIncasso)})
                </div>
                <p className="text-[10px] text-amber-800 dark:text-amber-300">
                  Riduci l&apos;importo incassato applicato, oppure registra un acconto dalla scheda Acconti del cliente.
                </p>
              </div>
            )}
            {selectedBonifici.length > 0 && (
              <div className="rounded border border-primary/30 bg-primary/5 p-2 space-y-0.5 my-1">
                <div className="font-medium text-primary">
                  {selectedBonifici.length === 1
                    ? "Bonifico selezionato per congiungimento"
                    : `${selectedBonifici.length} bonifici selezionati per congiungimento`}
                </div>
                <div className="flex justify-between">
                  <span>Importo movimenti</span>
                  <span>{fmtEuro(totaleBonificiSelezionati)}</span>
                </div>
                {eccedenzaBonifico > 0 && (
                  <div className="space-y-0.5 text-amber-900 dark:text-amber-200">
                    <div className="flex justify-between font-medium">
                      <span>Eccedenza rispetto all&apos;incasso (da classificare tu)</span>
                      <span>{fmtEuro(eccedenzaBonifico)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {differenzaBonificoClassificata
                        ? `Classificata: acconto attivo ${fmtEuro(totaleAccAttivo)}. Va in Acconti e compensazioni.`
                        : "ACC_* (segno +) → acconto attivo, oppure ABB_PAS/ARROT_P per alzare il dovuto. Nessun automatico."}
                    </p>
                  </div>
                )}
                {eccedenzaBonifico < 0 && (
                  <div className="space-y-0.5 text-amber-900 dark:text-amber-200">
                    <div className="flex justify-between font-medium">
                      <span>Mancano rispetto all&apos;incasso (da classificare tu)</span>
                      <span>{fmtEuro(-eccedenzaBonifico)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {differenzaBonificoClassificata
                        ? `Classificata: accredito passivo ${fmtEuro(totaleAccPassivo)}. Va in Acconti e compensazioni.`
                        : "ACC_* (segno −, impostato in automatico) → accredito passivo, oppure ABB_ATT/ARROT_A per abbassare il dovuto."}
                    </p>
                  </div>
                )}
                {eccedenzaBonifico === 0 && (
                  <div className="text-green-700">Bonifici allineati all&apos;incasso ✓</div>
                )}
              </div>
            )}

            {/* Causali a livello cliente (niente selezione quietanza) */}
            {titoli.length > 0 && (
              <div className="rounded border border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/20 p-2 space-y-2 my-1">
                {renderCompensazioniClientePanel()}
              </div>
            )}

            <div className={`flex justify-between font-bold border-t pt-1 ${puoConfermare ? "text-green-700" : "text-red-700"}`}>
              <span>{puoConfermare ? "✅ Quadrato" : "⚠️ Da quadrare"}</span>
              <span>{fmtEuro(delta)}</span>
            </div>
          </div>

          {/* Anteprima scritture contabili */}
          {movimentiPreview.length > 0 && (
            <div className="rounded-md border bg-background p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Anteprima scritture in Prima Nota ({movimentiPreview.length})
              </div>
              <div className="text-xs space-y-1">
                {movimentiPreview.map((m, i) => (
                  <div key={i} className="flex justify-between gap-2 border-b last:border-0 pb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`font-mono px-1.5 py-0.5 rounded text-[10px] ${m.tipo === "entrata" ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"}`}>
                        {m.tipo}
                      </span>
                      {m.titolo && <span className="font-mono text-[10px] text-muted-foreground">{m.titolo}</span>}
                      <span className="truncate">{m.descrizione}</span>
                    </div>
                    <span className="font-mono">{fmtEuro(m.importo)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modalità — single quietanza */}
          {!isMulti && titoli[0] && renderModalitaPanel(titoli[0].id)}

          {/* Date + modalità per quietanza (bulk) */}
          {isMulti && (
            <div className="rounded-md border bg-card p-3 space-y-3">
              <div className="text-sm font-medium flex items-center gap-2">
                Date per quietanza
                <span className="text-[10px] text-muted-foreground">(override rispetto alle date globali)</span>
              </div>
              <div className="space-y-2">
                {titoli.map((t) => (
                  <div key={t.id} className="space-y-2 border-b last:border-0 pb-2 last:pb-0">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                      <span className="text-xs font-mono truncate text-muted-foreground">
                        {t.numero_titolo || t.id.slice(0, 8)}
                      </span>
                      <div className="flex items-center gap-1">
                        <Label className="text-[10px] text-muted-foreground whitespace-nowrap">M.C.</Label>
                        <Input
                          type="date"
                          value={getDate(t.id).mc}
                          onChange={(e) => setDate(t.id, { mc: e.target.value })}
                          className="h-7 text-xs w-36"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Pag.</Label>
                        <Input
                          type="date"
                          value={getDate(t.id).pag}
                          onChange={(e) => setDate(t.id, { pag: e.target.value })}
                          className="h-7 text-xs w-36"
                        />
                      </div>
                    </div>
                    {renderModalitaPanel(t.id, t.numero_titolo || undefined)}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm font-medium text-destructive">
              ⚠️ Operazione irreversibile senza privilegi admin. Quadratura: incasso applicato + acconti usati = dovuto rettificato.
              Differenze bonifico: classificale tu (abbuono / arrotondamento / acconto) — niente acconto automatico.
            </p>
          </div>
        </div>
        <DialogFooter>
          {!isMulti && (
            <Button variant="outline" onClick={stampaRiepilogo} disabled={loading} title="Stampa riepilogo per l'operatore">
              <Printer className="w-4 h-4 mr-1" /> Stampa
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annulla</Button>
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={
              loading ||
              !puoConfermare ||
              !tipoPagamentoOk ||
              (isBonifico && !form.banca && !bankIncasso?.contoBancarioId) ||
              (needsBonificoLink && bonificiCandidati.length > 0 && selectedBonificoIds.length === 0)
            }
            onClick={handleConferma}
          >
            <CheckSquare className="w-4 h-4 mr-1" />
            {loading
              ? "In corso..."
              : titoliACredito.length > 0 && titoliACredito.length === titoli.length
                ? isMulti
                  ? `Chiudi conguagli (${titoli.length})`
                  : "Chiudi conguaglio a credito"
                : isMulti
                  ? `Conferma Incasso (${titoli.length})`
                  : "Conferma Incasso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MessaCassaDialog;
