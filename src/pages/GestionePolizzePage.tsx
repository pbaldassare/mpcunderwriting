import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import {
  FileEdit,
  Ban,
  RefreshCw,
  Copy,
  Replace,
  PauseCircle,
  PlayCircle,
  XCircle,
  Wallet,
  Undo2,
  Upload,
  FileText,
  Wand2,
  Filter,
  Search,
  Loader2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  Lock,
  Hash,
  FileClock,
  PlusCircle,


} from "lucide-react";
import { PolizzaSection } from "@/components/polizze/PolizzaSection";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { fmtEuro } from "@/lib/formatCurrency";
import { annullaPolizza } from "@/lib/annullaPolizza";
import { annullaMessaACassa } from "@/lib/annullaMessaACassa";
import { SospensionePolizzaDialog } from "@/components/polizze/SospensionePolizzaDialog";
import { RiattivazionePolizzaDialog } from "@/components/polizze/RiattivazionePolizzaDialog";
import { SostituzionePolizzaDialog } from "@/components/polizze/SostituzionePolizzaDialog";
import { StornoTitoloDialog } from "@/components/polizze/StornoTitoloDialog";
import MessaCassaDialog from "@/components/portafoglio/MessaCassaDialog";
import { DuplicaPolizzaDialog } from "@/components/polizze/azioni/DuplicaPolizzaDialog";
import { isDuplicaSorgentePolizza } from "@/lib/duplicaTitolo";
import { AppendiceDialog } from "@/components/polizze/azioni/AppendiceDialog";
import { CaricaDocDialog } from "@/components/polizze/azioni/CaricaDocDialog";
import { SearchableSelect, type SearchableSelectOption } from "@/components/SearchableSelect";
import { ClienteSearchSelect } from "@/components/clienti/ClienteSearchSelect";
import ServerPagination from "@/components/ServerPagination";
import { useServerPagination } from "@/hooks/useServerPagination";
import { AttivitaRecentiPanel } from "@/components/polizze/azioni/AttivitaRecentiPanel";


type OperazioneKey =
  | "nuova_polizza"
  | "appendice"
  | "storno"
  | "rinnovo"
  | "duplica"
  | "sostituzione"
  | "sospensione"
  | "riattivazione"
  | "annulla"
  | "messa_cassa"
  | "annulla_messa_cassa"
  | "carica_doc"
  | "precontrattuale"
  | "cig_temporanei"
  | "regolazioni_attese";


interface Operazione {
  key: OperazioneKey;
  label: string;
  icon: any;
  descrizione: string;
  /** stati polizza filtrati (vuoto = tutti) */
  statiFiltro: string[];
  /** richiede `data_messa_cassa` valorizzata */
  richiedeMessaCassa?: boolean;
  /** richiede `data_messa_cassa` NULL */
  escludeMessaCassa?: boolean;
  /** richiede `cig_temporaneo` valorizzato */
  richiedeCigTemporaneo?: boolean;
  /** richiede `regolazione = true` */
  richiedeRegolazione?: boolean;
  adminOnly?: boolean;
}

const OPERAZIONI: Operazione[] = [
  { key: "nuova_polizza", label: "Nuova Polizza", icon: PlusCircle, descrizione: "Emetti una nuova polizza", statiFiltro: [] },
  { key: "appendice", label: "Appendice", icon: FileEdit, descrizione: "Aggiungi un'appendice", statiFiltro: ["attivo"] },
  { key: "storno", label: "Storno", icon: Ban, descrizione: "Storna premio e quietanze", statiFiltro: ["attivo"] },
  // { key: "rinnovo", ... } — nascosta su richiesta utente (i rinnovi si gestiscono da pagina dedicata)
  { key: "duplica", label: "Duplica", icon: Copy, descrizione: "Copia una polizza (non le quietanze)", statiFiltro: [] },
  { key: "sostituzione", label: "Sostituzione", icon: Replace, descrizione: "Sostituisci polizza/numero", statiFiltro: ["attivo"] },
  { key: "sospensione", label: "Sospensione", icon: PauseCircle, descrizione: "Sospendi temporaneamente", statiFiltro: ["attivo"] },
  { key: "riattivazione", label: "Riattivazione", icon: PlayCircle, descrizione: "Riattiva polizza sospesa", statiFiltro: ["sospeso"] },
  { key: "annulla", label: "Annulla", icon: XCircle, descrizione: "Annullamento totale", statiFiltro: [], adminOnly: true },
  // { key: "messa_cassa", ... } — nascosta su richiesta utente (gestita dalla scheda polizza)
  // { key: "annulla_messa_cassa", ... } — nascosta su richiesta utente

  { key: "carica_doc", label: "Carica Doc.", icon: Upload, descrizione: "Carica documenti", statiFiltro: [] },
  { key: "precontrattuale", label: "Precontrattuale", icon: FileText, descrizione: "Genera doc. precontrattuale", statiFiltro: [] },
  { key: "cig_temporanei", label: "CIG Temporanei", icon: Hash, descrizione: "Polizze con numero provvisorio", statiFiltro: [], richiedeCigTemporaneo: true },
  { key: "regolazioni_attese", label: "Regolazioni Attese", icon: FileClock, descrizione: "Polizze in attesa di regolazione", statiFiltro: [], richiedeRegolazione: true },
];

const STATI_OPTIONS = ["", "attivo", "sospeso", "scaduto", "incassato", "annullato", "stornato"];

const PICKER_HIDDEN_OPS = new Set<OperazioneKey>(["cig_temporanei", "regolazioni_attese"]);

export type GestioneForcedOp = "cig_temporanei" | "regolazioni_attese";

const GestionePolizzePage = ({ forcedOp }: { forcedOp?: GestioneForcedOp } = {}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, hasPermission } = useAuth();
  const canTitoli = isAdmin || hasPermission("titoli");
  const [searchParams, setSearchParams] = useSearchParams();

  const [opKey, setOpKey] = useState<OperazioneKey | null>(
    forcedOp ?? ((searchParams.get("op") as OperazioneKey | null) || null),
  );
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("q") || "");
  const [statoFilter, setStatoFilter] = useState<string>("");
  const [scadDal, setScadDal] = useState("");
  const [scadAl, setScadAl] = useState("");
  const [clienteId, setClienteId] = useState<string>(searchParams.get("cliente") || "");
  const [compagniaId, setCompagniaId] = useState<string>("");

  const [sortBy, setSortBy] = useState<"data_scadenza" | "numero_titolo">("data_scadenza");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // debounce ricerca 350ms (memory: 350ms debounce)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Persist filters in URL (so back-navigation from /titoli/:id restores state)
  useEffect(() => {
    if (forcedOp) return;
    const params: Record<string, string> = {};
    if (opKey) params.op = opKey;
    if (debouncedSearch) params.q = debouncedSearch;
    if (clienteId) params.cliente = clienteId;
    setSearchParams(params, { replace: true });
  }, [forcedOp, opKey, debouncedSearch, clienteId, setSearchParams]);

  useEffect(() => {
    if (forcedOp) {
      setOpKey(forcedOp);
      return;
    }
    const op = searchParams.get("op");
    if (op === "cig_temporanei") {
      navigate("/portafoglio/estrazioni/cig-temporanei", { replace: true });
    } else if (op === "regolazioni_attese") {
      navigate("/portafoglio/estrazioni/regolazioni-attese", { replace: true });
    }
  }, [forcedOp, searchParams, navigate]);

  // dialog state
  const [target, setTarget] = useState<{ id: string; numero: string } | null>(null);
  const [sospensioneOpen, setSospensioneOpen] = useState(false);
  const [riattivazioneOpen, setRiattivazioneOpen] = useState(false);
  const [sostituzioneOpen, setSostituzioneOpen] = useState(false);
  const [stornoOpen, setStornoOpen] = useState(false);
  const [duplicaOpen, setDuplicaOpen] = useState(false);
  const [appendiceOpen, setAppendiceOpen] = useState(false);
  const [caricaDocOpen, setCaricaDocOpen] = useState(false);
  const [messaCassaOpen, setMessaCassaOpen] = useState(false);
  const [messaCassaTitolo, setMessaCassaTitolo] = useState<any | null>(null);
  const [annullaConfirm, setAnnullaConfirm] = useState(false);
  const [annullaMCConfirm, setAnnullaMCConfirm] = useState(false);
  const [annullaLoading, setAnnullaLoading] = useState(false);

  const operazione = useMemo(() => OPERAZIONI.find((o) => o.key === opKey) || null, [opKey]);

  const statiAttivi = useMemo(() => {
    if (!operazione) return [] as string[];
    if (statoFilter) return [statoFilter];
    return operazione.statiFiltro;
  }, [operazione, statoFilter]);

  // Paginazione standard 25/pagina (memory)
  const { page, setPage, pageSize, range, resetPage } = useServerPagination(25, [
    opKey,
    debouncedSearch,
    statoFilter,
    scadDal,
    scadAl,
    clienteId,
    compagniaId,
    sortBy,
    sortDir,
  ]);

  // Conteggio live CIG temporanei (per badge sulla card)
  const { data: cigCount = 0 } = useQuery({
    queryKey: ["gestione-polizze-cig-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("titoli")
        .select("id", { count: "exact", head: true })
        .eq("cig_temporaneo", true);
      return count ?? 0;
    },
  });

  // Conteggio live Regolazioni attese (per badge sulla card)
  const { data: regCount = 0 } = useQuery({
    queryKey: ["gestione-polizze-reg-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("titoli")
        .select("id", { count: "exact", head: true })
        .eq("regolazione", true)
        .in("stato", ["attivo", "sospeso", "incassato"]);
      return count ?? 0;
    },
  });

  const { data: compagnieOpts = [] } = useQuery({
    queryKey: ["gestione-polizze-compagnie-opts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("compagnie")
        .select("id, nome")
        .eq("attiva", true)
        .order("nome", { ascending: true })
        .limit(500);
      return ((data || []) as any[]).map<SearchableSelectOption>((c) => ({
        value: c.id,
        label: c.nome,
      }));
    },
  });

  const { data: result, isFetching } = useQuery({
    queryKey: [
      "gestione-polizze",
      opKey,
      debouncedSearch,
      statiAttivi.join(","),
      scadDal,
      scadAl,
      clienteId,
      compagniaId,
      sortBy,
      sortDir,
      page,
    ],
    enabled: !!opKey,
    queryFn: async () => {
      // Pre-filtro CIG (operazione dedicata)
      let cigIds: string[] | null = null;
      const needsCigWith = operazione?.richiedeCigTemporaneo;
      if (needsCigWith) {
        const { data: cigRows } = await supabase
          .from("titoli")
          .select("id")
          .eq("cig_temporaneo", true);
        cigIds = (cigRows || []).map((r: any) => r.id);
        if (cigIds.length === 0) return { rows: [], count: 0, cigMap: {}, regMap: {} };
      }

      // Pre-filtro Regolazione (operazione dedicata)
      let regIds: string[] | null = null;
      const needsRegWith = operazione?.richiedeRegolazione;
      if (needsRegWith) {
        const { data: regRows } = await supabase
          .from("titoli")
          .select("id, regolazione_data_presunta")
          .eq("regolazione", true)
          .order("regolazione_data_presunta", { ascending: true, nullsFirst: false });
        regIds = (regRows || []).map((r: any) => r.id);
        if (regIds.length === 0) return { rows: [], count: 0, cigMap: {}, regMap: {} };
      }

      let q = supabase
        .from("v_portafoglio_titoli")
        .select(
          "id, numero_titolo, compagnia_id, compagnia_nome, ramo_nome, cliente_nome_display, cliente_anagrafica_id, stato, garanzia_da, garanzia_a, data_scadenza, premio_lordo, data_messa_cassa, ufficio_id, sostituisce_polizza, cig_rif, is_regolazione, regolazione_quietanza_id",
          { count: "exact" },
        )
        .order(sortBy, { ascending: sortDir === "asc" })
        .range(range.from, range.to);

      if (needsCigWith && cigIds) q = q.in("id", cigIds);
      if (needsRegWith && regIds) q = q.in("id", regIds);
      if (statiAttivi.length > 0) q = q.in("stato", statiAttivi);
      if (operazione?.richiedeMessaCassa) q = q.not("data_messa_cassa", "is", null);
      if (operazione?.escludeMessaCassa) q = q.is("data_messa_cassa", null);
      if (scadDal) q = q.gte("data_scadenza", scadDal);
      if (scadAl) q = q.lte("data_scadenza", scadAl);
      // NB: in titoli il cliente può essere su cliente_id OPPURE su cliente_anagrafica_id
      // (legacy: nonostante il nome, contiene clienti.id). Filtrare su entrambi.
      if (clienteId) {
        q = q.or(`cliente_id.eq.${clienteId},cliente_anagrafica_id.eq.${clienteId}`);
      }
      if (compagniaId) q = q.eq("compagnia_id", compagniaId);
      // Duplica: solo polizze madre, mai quietanze/regolazioni
      if (opKey === "duplica") {
        q = q.is("sostituisce_polizza", null);
        q = q.eq("is_regolazione", false);
      }
      if (debouncedSearch && opKey !== "duplica") {
        const s = debouncedSearch;
        q = q.or(
          `numero_titolo.ilike.%${s}%,cliente_nome_display.ilike.%${s}%,compagnia_nome.ilike.%${s}%`,
        );
      }
      const { data, error, count } = await q;
      if (error) throw error;

      const rows = data || [];
      let cigMap: Record<string, { cig_temporaneo: boolean; cig_rif: string | null }> = {};
      let regMap: Record<string, { regolazione: boolean; data_presunta: string | null; fattore: string | null; note: string | null }> = {};
      if (rows.length > 0) {
        const ids = rows.map((r: any) => r.id);
        const { data: extra } = await supabase
          .from("titoli")
          .select("id, cig_temporaneo, cig_rif, regolazione, regolazione_data_presunta, regolazione_fattore, regolazione_note")
          .in("id", ids);
        cigMap = Object.fromEntries(
          (extra || []).map((r: any) => [r.id, { cig_temporaneo: !!r.cig_temporaneo, cig_rif: r.cig_rif }]),
        );
        regMap = Object.fromEntries(
          (extra || []).map((r: any) => [r.id, {
            regolazione: !!r.regolazione,
            data_presunta: r.regolazione_data_presunta,
            fattore: r.regolazione_fattore,
            note: r.regolazione_note,
          }]),
        );
      }
      return { rows, count: count ?? 0, cigMap, regMap };
    },
  });

  const polizze = useMemo(() => {
    const rows = result?.rows ?? [];
    if (opKey !== "duplica") return rows;
    return rows.filter((p: any) => isDuplicaSorgentePolizza(p));
  }, [result?.rows, opKey]);
  const totalCount = result?.count ?? 0;
  const cigMap = result?.cigMap ?? {};
  const regMap = (result as any)?.regMap ?? {};

  const handleSelect = (op: OperazioneKey) => {
    setOpKey(op);
    setSearch("");
    setStatoFilter("");
    setClienteId("");
    setCompagniaId("");
    resetPage();
  };

  const toggleSort = (col: "data_scadenza" | "numero_titolo") => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["gestione-polizze"] });
    queryClient.invalidateQueries({ queryKey: ["titoli"] });
    queryClient.invalidateQueries({ queryKey: ["v_portafoglio_titoli"] });
    queryClient.invalidateQueries({ queryKey: ["log_attivita_gestione_polizze"] });
  };


  const esegui = (row: any) => {
    if (!operazione) return;
    if (operazione.adminOnly && !isAdmin) {
      toast.error("Operazione riservata agli amministratori");
      return;
    }
    if (!canTitoli) {
      toast.error("Permesso 'titoli' mancante");
      return;
    }
    if (operazione.key === "duplica" && !isDuplicaSorgentePolizza(row)) {
      toast.error("La duplica riguarda solo le polizze, non le quietanze");
      return;
    }
    const t = { id: row.id, numero: row.numero_titolo || row.id.slice(0, 8) };
    setTarget(t);


    switch (operazione.key) {
      case "appendice":
        setAppendiceOpen(true);
        return;
      case "rinnovo":
        navigate(`/portafoglio/rinnovi?titoloId=${row.id}`);
        return;
      case "precontrattuale":
        navigate(`/portafoglio/doc-precontrattuale?titoloId=${row.id}`);
        return;
      case "carica_doc":
        setCaricaDocOpen(true);
        return;
      case "duplica":
        setDuplicaOpen(true);
        return;
      case "storno":
        setStornoOpen(true);
        return;
      case "sospensione":
        setSospensioneOpen(true);
        return;
      case "riattivazione":
        setRiattivazioneOpen(true);
        return;
      case "sostituzione":
        setSostituzioneOpen(true);
        return;
      case "messa_cassa":
        setMessaCassaTitolo(row);
        setMessaCassaOpen(true);
        return;
      case "annulla":
        setAnnullaConfirm(true);
        return;
      case "annulla_messa_cassa":
        setAnnullaMCConfirm(true);
        return;
      case "cig_temporanei":
        navigate(`/titoli/${row.id}`);
        return;
      case "regolazioni_attese":
        navigate(`/titoli/${row.id}?section=regolazione`);
        return;
    }
  };

  const confermaAnnulla = async () => {
    if (!target) return;
    setAnnullaLoading(true);
    try {
      const res = await annullaPolizza(target.id);
      if (res.ok) {
        toast.success("Polizza annullata");
        refreshAll();
      } else {
        toast.error(res.error || "Errore annullamento");
      }
    } finally {
      setAnnullaLoading(false);
      setAnnullaConfirm(false);
    }
  };

  const confermaAnnullaMC = async () => {
    if (!target) return;
    setAnnullaLoading(true);
    try {
      const res = await annullaMessaACassa(target.id);
      if (res.ok) {
        toast.success("Messa a cassa annullata");
        refreshAll();
      } else {
        toast.error(res.error || "Errore annullamento messa a cassa");
      }
    } finally {
      setAnnullaLoading(false);
      setAnnullaMCConfirm(false);
    }
  };

  const visibleOps = OPERAZIONI.filter(
    (o) => (isAdmin || !o.adminOnly) && !PICKER_HIDDEN_OPS.has(o.key),
  );

  return (
    <TooltipProvider>
    <div className="space-y-5">
      <div>
        {forcedOp && operazione ? (
          <div className="flex items-start gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/portafoglio/estrazioni-stampe")}
              aria-label="Torna a Estrazioni e Stampe"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <operazione.icon className="w-6 h-6 text-primary" />
                {operazione.label}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {operazione.descrizione}
                {forcedOp === "cig_temporanei" && (
                  <span data-testid="cig-count-badge">{cigCount > 0 ? ` · ${cigCount}` : <span className="sr-only">0</span>}</span>
                )}
                {forcedOp === "regolazioni_attese" && (
                  <span data-testid="reg-count-badge">{regCount > 0 ? ` · ${regCount}` : <span className="sr-only">0</span>}</span>
                )}
              </p>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Wand2 className="w-6 h-6 text-teal-600" />
              Gestione Polizze
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Scegli l'operazione, filtra cliente/polizza ed esegui. Le azioni sono identiche a quelle disponibili
              dalla scheda polizza.
            </p>
          </>
        )}
      </div>

      {!forcedOp && <PolizzaSection title="1. Scegli operazione" icon={Wand2} defaultOpen>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2">
          {visibleOps.map((op) => {
            const Icon = op.icon;
            const active = op.key === opKey;
            const disabled = !canTitoli;
            const card = (
              <button
                key={op.key}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  if (op.key === "nuova_polizza") {
                    navigate("/portafoglio/immissione");
                    return;
                  }
                  handleSelect(op.key);
                }}
                aria-label={`operazione-${op.key}`}
                data-op={op.key}
                title={op.descrizione}
                className={`relative text-left rounded-md border px-2 py-2 transition w-full h-[68px] flex flex-col justify-between ${
                  disabled
                    ? "opacity-60 cursor-not-allowed border-border bg-muted/30"
                    : "hover:border-teal-600 hover:shadow-sm"
                } ${
                  op.key === "nuova_polizza"
                    ? "border-teal-600 bg-teal-600 text-white hover:bg-teal-700 hover:border-teal-700"
                    : active
                    ? "border-teal-600 bg-teal-50 dark:bg-teal-950/30 ring-1 ring-teal-600"
                    : "border-border bg-card"
                }`}

              >
                {op.adminOnly && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" title="admin" />
                )}
                {disabled && (
                  <Lock className="absolute top-1 right-1 w-3 h-3 text-muted-foreground" />
                )}
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${op.key === "nuova_polizza" ? "text-white" : active ? "text-teal-600" : "text-muted-foreground"}`} />
                  <span className="font-medium text-xs leading-tight">{op.label}</span>
                </div>
                <p className={`text-[10px] truncate leading-tight ${op.key === "nuova_polizza" ? "text-white/85" : "text-muted-foreground"}`}>{op.descrizione}</p>

              </button>
            );
            return disabled ? (
              <Tooltip key={op.key}>
                <TooltipTrigger asChild>
                  <div>{card}</div>
                </TooltipTrigger>
                <TooltipContent>Permesso "titoli" mancante</TooltipContent>
              </Tooltip>
            ) : (
              card
            );
          })}
        </div>
      </PolizzaSection>}

      {operazione && (
        <>
          <PolizzaSection title={forcedOp ? "Filtra polizza" : "2. Filtra polizza"} icon={Filter} defaultOpen>
            <div className={`grid grid-cols-1 ${opKey === "duplica" ? "" : "md:grid-cols-2"} gap-3`}>
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <ClienteSearchSelect
                  value={clienteId}
                  onValueChange={setClienteId}
                  placeholder="Tutti i clienti"
                  searchPlaceholder="Nome, più nomi, indirizzo, CF…"
                  clearable
                  clearLabel="— Tutti —"
                />
              </div>
              {opKey !== "duplica" && (
              <div className="space-y-1.5">
                <Label>N° polizza</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="N° polizza..."
                    className="pl-8"
                    aria-label="ricerca-libera"
                  />
                </div>
              </div>
              )}
            </div>
          </PolizzaSection>



          <PolizzaSection title={forcedOp ? `Risultati — ${operazione.label}` : `3. Risultati — ${operazione.label}`} icon={operazione.icon} defaultOpen>
            <div className="mb-3 text-sm text-muted-foreground bg-teal-50 border border-teal-200 rounded-md px-3 py-2">
              {opKey === "duplica" ? (
                <>👉 Solo polizze (non quietanze). Clicca <strong>"Esegui Duplica"</strong> sulla riga per copiare i dati tecnici.</>
              ) : (
                <>
              👉 Trova la polizza nella tabella e clicca <strong>"{operazione.key === "appendice" ? "Crea" : "Esegui"} {operazione.label}"</strong> sulla riga
              (colonna a destra, sempre visibile) per aprire il dialog e salvare l'operazione in database.
                </>
              )}
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button
                          type="button"
                          onClick={() => toggleSort("numero_titolo")}
                          className="inline-flex items-center gap-1 hover:text-teal-700"
                        >
                          N° Polizza
                          {sortBy === "numero_titolo" &&
                            (sortDir === "asc" ? (
                              <ArrowUp className="w-3 h-3" />
                            ) : (
                              <ArrowDown className="w-3 h-3" />
                            ))}
                        </button>
                      </TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Compagnia</TableHead>
                      <TableHead>Garanzia</TableHead>
                      <TableHead>Decorr.</TableHead>
                      <TableHead>
                        <button
                          type="button"
                          onClick={() => toggleSort("data_scadenza")}
                          className="inline-flex items-center gap-1 hover:text-teal-700"
                        >
                          Scad.
                          {sortBy === "data_scadenza" &&
                            (sortDir === "asc" ? (
                              <ArrowUp className="w-3 h-3" />
                            ) : (
                              <ArrowDown className="w-3 h-3" />
                            ))}
                        </button>
                      </TableHead>
                      <TableHead className="text-right">Premio</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>CIG</TableHead>
                      <TableHead>Reg.</TableHead>
                      <TableHead className="sticky right-0 bg-background z-10 text-right border-l shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.15)] min-w-[180px]">Azione</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {isFetching && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-6">
                          <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                          Caricamento...
                        </TableCell>
                      </TableRow>
                    )}
                    {!isFetching && (polizze?.length ?? 0) === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-6 text-sm text-muted-foreground">
                          Nessuna polizza corrisponde ai filtri impostati.
                        </TableCell>
                      </TableRow>
                    )}
                    {!isFetching &&
                      polizze?.map((p: any, idx: number) => {
                        const cig = cigMap[p.id];
                        const reg = regMap[p.id];
                        const today = new Date().toISOString().slice(0, 10);
                        const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
                        const regBadgeStyle = reg?.regolazione
                          ? reg.data_presunta && reg.data_presunta < today
                            ? "bg-red-100 text-red-800 border-red-300"
                            : reg.data_presunta && reg.data_presunta <= in30
                            ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                            : "bg-amber-100 text-amber-800 border-amber-300"
                          : "";
                        return (
                        <TableRow key={p.id} className={p.is_regolazione ? "bg-orange-50/40" : idx % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                          <TableCell className="font-mono text-xs">
                            {p.is_regolazione && <span className="text-orange-600 mr-1" title="Regolazione collegata">↳</span>}
                            <button
                              type="button"
                              onClick={() => navigate(`/titoli/${p.id}`)}
                              className="text-teal-700 hover:underline"
                            >
                              {p.numero_titolo || p.id.slice(0, 8)}
                            </button>
                            {opKey !== "duplica" && (p.is_regolazione ? (
                              <Badge className="ml-1 text-[10px] bg-orange-500 hover:bg-orange-600 text-white">
                                regolazione
                              </Badge>
                            ) : p.sostituisce_polizza && (
                              <Badge variant="outline" className="ml-1 text-[10px]">
                                quietanza
                              </Badge>
                            ))}
                          </TableCell>
                          <TableCell>{p.cliente_nome_display || "—"}</TableCell>
                          <TableCell>{p.compagnia_nome || "—"}</TableCell>
                          <TableCell>{p.ramo_nome || "—"}</TableCell>
                          <TableCell className="text-xs">{p.garanzia_da || "—"}</TableCell>
                          <TableCell className="text-xs">{p.data_scadenza || p.garanzia_a || "—"}</TableCell>
                          <TableCell className="text-right text-xs">
                            {p.premio_lordo != null ? fmtEuro(Number(p.premio_lordo)) : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {p.stato}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {cig?.cig_temporaneo ? (
                              <Badge className="bg-orange-100 text-orange-800 border-orange-300 text-[10px]" data-testid="cig-badge-temp">
                                <Hash className="w-3 h-3 mr-0.5" />
                                Temp.{cig.cig_rif ? ` ${cig.cig_rif}` : ""}
                              </Badge>
                            ) : cig?.cig_rif ? (
                              <Badge variant="outline" className="text-[10px]">{cig.cig_rif}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {reg?.regolazione ? (
                              <Badge className={`${regBadgeStyle} text-[10px] gap-0.5`} data-testid="reg-badge">
                                <FileClock className="w-3 h-3" />
                                {reg.data_presunta
                                  ? new Date(reg.data_presunta).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "2-digit" })
                                  : "Attesa"}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className={`sticky right-0 z-10 text-right border-l shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.15)] ${idx % 2 === 0 ? "bg-background" : "bg-muted/30"}`}>
                            <Button
                              size="sm"
                              onClick={() => esegui(p)}
                              data-tour="esegui-riga"
                              className="gap-1 bg-teal-700 hover:bg-teal-800 text-white font-semibold shadow-sm"
                            >
                              <operazione.icon className="w-3.5 h-3.5" />
                              {operazione.key === "appendice" ? "Crea" : "Esegui"} {operazione.label}
                            </Button>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <ServerPagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setPage}
            />
          </PolizzaSection>

          {!forcedOp && (
            <PolizzaSection title="4. Attività recenti" icon={Wand2} defaultOpen={false}>
              <AttivitaRecentiPanel operationKey={opKey} operationLabel={operazione.label} />
            </PolizzaSection>
          )}
        </>
      )}


      {/* Dialogs */}
      {target && (
        <>
          <StornoTitoloDialog
            open={stornoOpen}
            onOpenChange={setStornoOpen}
            titoloId={target.id}
            numeroPolizza={target.numero}
            onDone={refreshAll}
          />
          <SospensionePolizzaDialog
            open={sospensioneOpen}
            onOpenChange={setSospensioneOpen}
            titoloId={target.id}
            numeroPolizza={target.numero}
            onDone={refreshAll}
          />
          <RiattivazionePolizzaDialog
            open={riattivazioneOpen}
            onOpenChange={setRiattivazioneOpen}
            titoloId={target.id}
            numeroPolizza={target.numero}
            onDone={refreshAll}
          />
          <SostituzionePolizzaDialog
            open={sostituzioneOpen}
            onOpenChange={setSostituzioneOpen}
            titoloId={target.id}
            numeroPolizza={target.numero}
            onDone={refreshAll}
          />
          <DuplicaPolizzaDialog
            open={duplicaOpen}
            onOpenChange={setDuplicaOpen}
            titoloId={target.id}
            numeroPolizza={target.numero}
            onDone={refreshAll}
          />
          <AppendiceDialog
            open={appendiceOpen}
            onOpenChange={setAppendiceOpen}
            titoloId={target.id}
            numeroTitolo={target.numero}
            onCreated={refreshAll}
          />
          <CaricaDocDialog
            open={caricaDocOpen}
            onOpenChange={setCaricaDocOpen}
            titoloId={target.id}
            numeroTitolo={target.numero}
            onUploaded={refreshAll}
          />
        </>
      )}

      {messaCassaTitolo && (
        <MessaCassaDialog
          open={messaCassaOpen}
          onOpenChange={setMessaCassaOpen}
          titoli={[
            {
              id: messaCassaTitolo.id,
              numero_titolo: messaCassaTitolo.numero_titolo,
              premio_lordo: messaCassaTitolo.premio_lordo,
              cliente_anagrafica_id: messaCassaTitolo.cliente_anagrafica_id,
              ufficio_id: messaCassaTitolo.ufficio_id,
            },
          ]}
          onSuccess={refreshAll}
        />
      )}

      <AlertDialog open={annullaConfirm} onOpenChange={setAnnullaConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annullare la polizza {target?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              L'annullamento esegue il cascade-delete di provvigioni (anche pagate), rimesse, movimenti e
              quietanze. Il titolo resta in stato "annullato" come ancora per il log. Operazione irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={annullaLoading}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confermaAnnulla();
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={annullaLoading}
            >
              {annullaLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Conferma annullamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={annullaMCConfirm} onOpenChange={setAnnullaMCConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annullare la messa a cassa di {target?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              La polizza tornerà in stato "attivo" e i dati di incasso verranno azzerati. Le compensazioni e i
              movimenti contabili collegati verranno rimossi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={annullaLoading}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confermaAnnullaMC();
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={annullaLoading}
            >
              {annullaLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>

  );
};

export default GestionePolizzePage;
