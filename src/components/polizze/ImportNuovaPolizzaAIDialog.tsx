import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchableSelect } from "@/components/SearchableSelect";
import { FiscalCodeInput } from "@/components/ui/FiscalCodeInput";
import { Label as UILabel } from "@/components/ui/label";
import { assertFiscalValid } from "@/lib/assertFiscalValid";
import { RamoSottoramoSelect } from "@/components/polizze/RamoSottoramoSelect";
import {
  Sparkles, UploadCloud, Loader2, FileText, CheckCircle2, AlertTriangle,
  UserPlus, ArrowLeft, ArrowRight, Trash2, Calculator, Info, Search,
} from "lucide-react";
import { toast } from "sonner";
import { isDocumentUploadTooLarge, MAX_DOCUMENT_UPLOAD_MB } from "@/lib/uploadLimits";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { fmtEuro as fmtEur } from "@/lib/formatCurrency";
import { TableScrollArea } from "@/components/shared/TableScrollArea";

export type ParsedVeicolo = {
  targa?: string;
  telaio?: string;
  marca?: string;
  modello?: string;
  versione?: string;
  descrizione?: string;
  tipo_veicolo?: string;
  uso_descrizione?: string;
  data_immatricolazione?: string;
  anno_acquisto?: string;
  provincia_circolazione?: string;
  classe_bm?: string;
  cv?: number;
  kw?: number;
  cc?: number;
  posti?: number;
  peso_motrice?: number;
  peso_rimorchio?: number;
  peso_totale?: number;
  alimentazione?: string;
  tipologia_guida?: string;
};

export type ParsedConducente = {
  nome?: string;
  cognome?: string;
  codice_fiscale?: string;
  indirizzo?: string;
  cap?: string;
  citta?: string;
  provincia?: string;
  data_nascita?: string;
  tipo_patente?: string;
  data_rilascio_patente?: string;
  note?: string;
};

export type ParsedPolizzaData = {
  compagnia?: string;
  intermediario?: string;
  contraente_nome?: string;
  contraente_codice_fiscale?: string;
  contraente_partita_iva?: string;
  contraente_indirizzo?: string;
  contraente_comune?: string;
  contraente_provincia?: string;
  contraente_cap?: string;
  contraente_nazione?: string;
  contraente_email?: string;
  contraente_telefono?: string;
  numero_polizza?: string;
  prodotto?: string;
  ramo_descrizione?: string;
  decorrenza?: string;
  scadenza?: string;
  prossima_quietanza?: string;
  frazionamento?: string;
  tacito_rinnovo?: boolean;
  premio_firma_netto?: number;
  premio_firma_accessori?: number;
  premio_firma_imposte?: number;
  premio_firma_lordo?: number;
  premio_quietanza_netto?: number;
  premio_quietanza_accessori?: number;
  premio_quietanza_imposte?: number;
  premio_quietanza_lordo?: number;
  targa?: string;
  veicolo?: ParsedVeicolo;
  conducente?: ParsedConducente;
  garanzie?: {
    descrizione: string;
    codice_sottoramo?: string;
    premio_netto?: number;
    premio_imposte?: number;
    aliquota_tasse_pct?: number;
    ssn?: number;
    match_confidence?: "alta" | "media" | "manuale";
  }[];
};

export type MatchResult = {
  data: ParsedPolizzaData;
  cliente?: { id: string; label: string } | null;
  gruppoCompagnia?: { id: string; label: string } | null;
  compagnia?: { id: string; label: string } | null; // = agenzia (compagnie.id)
  /** ramoId opzionale: nel flusso AI il Sottoramo viene scelto riga per riga (come nel manuale). */
  ramo?: { gruppoRamoId: string; ramoId?: string | null; label: string } | null;
  isNewCliente?: boolean;
  gruppoFinanziarioId?: string;
  tipoCliente?: "privato" | "azienda" | "ente";
  codiceCig?: string;
  /** True quando l'utente ha forzato "Polizza Auto" o il ramo è ZQ — apre il modale veicolo. */
  polizzaAuto?: boolean;
  /** PDF originale caricato per la scansione AI: viene archiviato nei documenti della polizza al salvataggio. */
  sourcePdf?: { name: string; base64: string; mimeType: string };
};

type GruppoFinanziarioOpt = {
  id: string;
  codice: string;
  nome: string;
  tipo_soggetto: "privato" | "azienda" | "ente";
};

type MatchType = "cf" | "piva" | "email" | "name";
type ClienteCand = { id: string; label: string; cf?: string; piva?: string; email?: string; matchType: MatchType };
type GruppoCompagniaCand = { id: string; label: string };
type AgenziaCand = { id: string; label: string; gruppo_compagnia_id: string | null };
type RamoCand = { gruppoRamoId: string; ramoId: string; label: string };
type LogEntry = { ts: number; level: "info" | "success" | "warn" | "error"; msg: string };
type Step = "setup" | "review" | "summary";

const NEW_CLIENTE = "__new__";


const num = (v: any): number | undefined => {
  if (v === "" || v == null) return undefined;
  const n = Number(String(v).replace(",", "."));
  return isNaN(n) ? undefined : n;
};

export function ImportNuovaPolizzaAIDialog({
  open,
  onOpenChange,
  onApply,
  lockedClienteId,
  lockedClienteLabel,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onApply: (m: MatchResult) => void;
  /** Se fornito, il dialog non chiede il cliente: usa direttamente questo id (anagrafica già aperta). */
  lockedClienteId?: string;
  lockedClienteLabel?: string;
}) {
  const [step, setStep] = useState<Step>("setup");
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [data, setData] = useState<ParsedPolizzaData>({});

  const [clienteCandidates, setClienteCandidates] = useState<ClienteCand[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState<string>("");
  const [gruppoCompagniaCandidates, setGruppoCompagniaCandidates] = useState<GruppoCompagniaCand[]>([]);
  const [selectedGruppoCompagniaId, setSelectedGruppoCompagniaId] = useState<string>("");
  const [agenziaCandidates, setAgenziaCandidates] = useState<AgenziaCand[]>([]);
  const [selectedAgenziaId, setSelectedAgenziaId] = useState<string>("");
  const [ramoCandidates, setRamoCandidates] = useState<RamoCand[]>([]);
  const [selectedGruppoRamoId, setSelectedGruppoRamoId] = useState<string>("");
  const [selectedGruppoRamoCodice, setSelectedGruppoRamoCodice] = useState<string>("");
  const [selectedSottoramoId, setSelectedSottoramoId] = useState<string>("");
  const [forzaPolizzaAuto, setForzaPolizzaAuto] = useState<boolean>(false);
  const [polizzaAutoTouched, setPolizzaAutoTouched] = useState<boolean>(false);
  const [gruppiFinanziari, setGruppiFinanziari] = useState<GruppoFinanziarioOpt[]>([]);
  const [selectedGruppoFinanziarioId, setSelectedGruppoFinanziarioId] = useState<string>("");
  const [codiceCigNew, setCodiceCigNew] = useState<string>("");
  const [sourcePdf, setSourcePdf] = useState<{ name: string; base64: string; mimeType: string } | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Quando l'utente sceglie un Ramo: carica il codice del gruppo e (se non è stato
  // toccato dall'utente) attiva automaticamente "Polizza Auto" per i rami ZQ.
  useEffect(() => {
    if (!selectedGruppoRamoId) {
      setSelectedGruppoRamoCodice("");
      if (!polizzaAutoTouched) setForzaPolizzaAuto(false);
      return;
    }
    (async () => {
      const { data: gr } = await supabase
        .from("gruppi_ramo" as any)
        .select("codice")
        .eq("id", selectedGruppoRamoId)
        .maybeSingle();
      const cod = String((gr as any)?.codice || "").toUpperCase();
      setSelectedGruppoRamoCodice(cod);
      if (!polizzaAutoTouched) setForzaPolizzaAuto(cod === "ZQ");
    })();
  }, [selectedGruppoRamoId, polizzaAutoTouched]);

  // Carica i gruppi finanziari quando si entra in review con cliente nuovo
  useEffect(() => {
    if (step !== "review") return;
    if (gruppiFinanziari.length > 0) return;
    (async () => {
      const { data: rows } = await supabase
        .from("gruppi_finanziari" as any)
        .select("id, codice, nome, tipo_soggetto")
        .eq("attivo", true)
        .order("codice");
      setGruppiFinanziari((rows || []) as unknown as GruppoFinanziarioOpt[]);
    })();
  }, [step, gruppiFinanziari.length]);

  const reset = () => {
    setStep("setup");
    setParsing(false);
    setProgress(0);
    setProgressLabel("");
    setLogs([]);
    setFileName(null);
    setData({});
    setClienteCandidates([]);
    setSelectedClienteId("");
    setGruppoCompagniaCandidates([]);
    setSelectedGruppoCompagniaId("");
    setAgenziaCandidates([]);
    setSelectedAgenziaId("");
    setRamoCandidates([]);
    setSelectedGruppoRamoId("");
    setSelectedGruppoRamoCodice("");
    setSelectedSottoramoId("");
    setForzaPolizzaAuto(false);
    setPolizzaAutoTouched(false);
    setSelectedGruppoFinanziarioId("");
    setCodiceCigNew("");
    setSourcePdf(null);
  };

  const log = (level: LogEntry["level"], msg: string) =>
    setLogs((l) => [...l, { ts: Date.now(), level, msg }]);

  const setPhase = (p: number, label: string) => {
    setProgress(p);
    setProgressLabel(label);
    log("info", label);
  };

  const updateField = <K extends keyof ParsedPolizzaData>(k: K, v: ParsedPolizzaData[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  const lookupClienti = async (d: ParsedPolizzaData): Promise<ClienteCand[]> => {
    const cf = (d.contraente_codice_fiscale || "").replace(/\s+/g, "").toUpperCase();
    const piva = (d.contraente_partita_iva || "").replace(/\s+/g, "");
    const email = (d.contraente_email || "").replace(/\s+/g, "").toLowerCase();
    const out: ClienteCand[] = [];
    const seen = new Set<string>();

    const buildLabel = (c: any) =>
      `${c.ragione_sociale || `${c.cognome || ""} ${c.nome || ""}`.trim()}${c.codice_fiscale ? ` — CF ${c.codice_fiscale}` : ""}${c.partita_iva ? ` — PIVA ${c.partita_iva}` : ""}`;

    const classify = (c: any): MatchType => {
      if (cf && (c.codice_fiscale || "").toUpperCase() === cf) return "cf";
      if (piva && (c.partita_iva || "") === piva) return "piva";
      if (email && (c.email || "").toLowerCase() === email) return "email";
      return "name";
    };

    if (cf || piva || email) {
      const orParts: string[] = [];
      if (cf) orParts.push(`codice_fiscale.ilike.${cf}`);
      if (piva) orParts.push(`partita_iva.ilike.${piva}`);
      if (email) orParts.push(`email.ilike.${email}`);
      const { data: rows } = await supabase
        .from("clienti")
        .select("id, ragione_sociale, cognome, nome, codice_fiscale, partita_iva, email")
        .or(orParts.join(","))
        .limit(5);
      const before = out.length;
      (rows || []).forEach((c: any) => {
        if (seen.has(c.id)) return;
        seen.add(c.id);
        out.push({
          id: c.id,
          label: buildLabel(c),
          cf: c.codice_fiscale,
          piva: c.partita_iva,
          email: c.email,
          matchType: classify(c),
        });
      });
      if (out.length === before) {
        log("warn", `CF/P.IVA/Email presenti (${[cf, piva, email].filter(Boolean).join(" / ")}) ma nessuna corrispondenza esatta — provo ricerca per nome`);
      } else {
        const best = out[0];
        log("success", `Match ESATTO su ${best.matchType.toUpperCase()}: ${best.label}`);
      }
    }
    if (out.length < 5) {
      const nameRaw = (d.contraente_nome || "").trim();
      if (nameRaw.length >= 3) {
        const tokens = nameRaw.split(/\s+/).filter((t) => t.length >= 3).slice(0, 2);
        if (tokens.length) {
          const orFilter = tokens
            .flatMap((t) => [`ragione_sociale.ilike.%${t}%`, `cognome.ilike.%${t}%`, `nome.ilike.%${t}%`])
            .join(",");
          const { data: rows } = await supabase
            .from("clienti")
            .select("id, ragione_sociale, cognome, nome, codice_fiscale, partita_iva, email")
            .or(orFilter)
            .limit(10);
          (rows || []).forEach((c: any) => {
            if (seen.has(c.id) || out.length >= 5) return;
            seen.add(c.id);
            out.push({
              id: c.id,
              label: buildLabel(c),
              cf: c.codice_fiscale,
              piva: c.partita_iva,
              email: c.email,
              matchType: "name",
            });
          });
        }
      }
    }
    // Ordina: cf > piva > email > name
    const rank: Record<MatchType, number> = { cf: 0, piva: 1, email: 2, name: 3 };
    out.sort((a, b) => rank[a.matchType] - rank[b.matchType]);
    return out;
  };

  const lookupGruppiCompagnia = async (d: ParsedPolizzaData): Promise<GruppoCompagniaCand[]> => {
    const compName = (d.compagnia || "").trim();
    if (!compName) return [];
    const tokens = compName.split(/\s+/).filter((t) => t.length >= 3).slice(0, 3);
    const lower = compName.toLowerCase();
    const orFilter = tokens.length
      ? tokens.map((t) => `descrizione.ilike.%${t}%`).join(",")
      : `descrizione.ilike.%${compName}%`;
    const { data: rows } = await supabase
      .from("gruppi_compagnia" as any)
      .select("id, codice, descrizione, attivo")
      .eq("attivo", true)
      .or(orFilter)
      .limit(10);
    const out: GruppoCompagniaCand[] = [];
    const seen = new Set<string>();
    (rows || [])
      .map((g: any) => {
        const desc = (g.descrizione || "").toLowerCase();
        const score =
          (desc === lower ? 100 : 0) +
          (desc.includes(lower) ? 50 : 0) +
          tokens.reduce((a, t) => a + (desc.includes(t.toLowerCase()) ? 10 : 0), 0);
        return { ...g, score };
      })
      .sort((a: any, b: any) => b.score - a.score)
      .forEach((g: any) => {
        if (seen.has(g.id) || out.length >= 5) return;
        seen.add(g.id);
        out.push({ id: g.id, label: `${g.codice ? g.codice + " - " : ""}${g.descrizione}` });
      });
    return out;
  };

  const loadAgenzieByGruppo = async (gruppoCompagniaId: string): Promise<AgenziaCand[]> => {
    if (!gruppoCompagniaId) return [];
    const { data: rows } = await supabase
      .from("compagnie")
      .select("id, codice, nome, gruppo_compagnia_id")
      .eq("gruppo_compagnia_id", gruppoCompagniaId)
      .eq("attiva", true)
      .order("nome")
      .limit(50);
    return (rows || []).map((c: any) => ({
      id: c.id,
      label: `${c.codice ? c.codice + " - " : ""}${c.nome}`,
      gruppo_compagnia_id: c.gruppo_compagnia_id,
    }));
  };

  const lookupRami = async (d: ParsedPolizzaData): Promise<RamoCand[]> => {
    const ramoDesc = (d.ramo_descrizione || "").trim();
    if (!ramoDesc) return [];
    const tokens = ramoDesc
      .replace(/[^\p{L}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .slice(0, 4);
    if (!tokens.length) return [];
    const orFilter = tokens.map((t) => `descrizione.ilike.%${t}%`).join(",");
    const { data: rows } = await supabase
      .from("rami")
      .select("id, codice, descrizione, gruppo_ramo_id, gruppi_ramo:gruppo_ramo_id(descrizione)")
      .or(orFilter)
      .limit(10);
    const out: RamoCand[] = [];
    (rows || []).forEach((r: any) => {
      if (!r.gruppo_ramo_id || out.length >= 5) return;
      const gName = r.gruppi_ramo?.descrizione || "";
      out.push({
        gruppoRamoId: r.gruppo_ramo_id,
        ramoId: r.id,
        label: `${gName ? gName + " · " : ""}${r.codice} - ${r.descrizione}`,
      });
    });
    return out;
  };

  const handleFile = async (file: File) => {
    if (!file) return;
    if (isDocumentUploadTooLarge(file.size)) {
      toast.error(`File troppo grande (max ${MAX_DOCUMENT_UPLOAD_MB} MB)`);
      return;
    }
    if (!selectedGruppoRamoId) {
      toast.error("Seleziona prima il Ramo per aiutare l'estrazione");
      return;
    }
    setFileName(file.name);
    setParsing(true);
    setLogs([]);
    setProgress(0);
    try {
      setPhase(5, "Caricamento contesto Ramo / sottorami…");
      // Carico Gruppo Ramo + elenco sottorami ammessi per dare contesto all'AI
      const [{ data: gr }, { data: sottorami }] = await Promise.all([
        supabase.from("gruppi_ramo" as any).select("id, codice, descrizione").eq("id", selectedGruppoRamoId).maybeSingle(),
        supabase.from("rami").select("codice, descrizione").eq("gruppo_ramo_id", selectedGruppoRamoId).eq("attivo", true).order("codice"),
      ]);
      const gruppoRamoCtx = gr as any
        ? { id: (gr as any).id, codice: (gr as any).codice, descrizione: (gr as any).descrizione }
        : null;
      const sottoramiAmmessi = (sottorami || []).map((s: any) => ({ codice: s.codice, descrizione: s.descrizione }));
      log("success", `Ramo: ${gruppoRamoCtx?.codice} — ${gruppoRamoCtx?.descrizione} · ${sottoramiAmmessi.length} sottorami ammessi`);

      setPhase(15, `Lettura file (${(file.size / 1024).toFixed(0)} KB)…`);
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      setPhase(25, "Conversione base64…");
      const b64 = btoa(bin);
      // Conserva il PDF originale: verrà archiviato fra i documenti della polizza al salvataggio.
      setSourcePdf({ name: file.name, base64: b64, mimeType: file.type || "application/pdf" });
      setPhase(40, "Analisi del documento in corso (con catalogo sottorami)…");
      const isZQ = String(gruppoRamoCtx?.codice || "").toUpperCase() === "ZQ";
      const wantsVeicolo = forzaPolizzaAuto || isZQ;
      if (wantsVeicolo) log("info", `Polizza Auto attiva — l'AI estrarrà i dati veicolo/conducente se presenti.`);
      const { data: resp, error } = await supabase.functions.invoke("parse-polizza-completa", {
        body: {
          fileBase64: b64,
          mimeType: file.type || "application/pdf",
          gruppo_ramo: gruppoRamoCtx,
          sottorami_ammessi: sottoramiAmmessi,
          forza_veicolo: wantsVeicolo,
        },
      });
      if (error) throw error;
      if ((resp as any)?.error) throw new Error((resp as any).error);
      const parsed: ParsedPolizzaData = (resp as any)?.data || {};
      setPhase(70, "Estrazione dati completata");
      log("success", `Numero polizza: ${parsed.numero_polizza || "—"}`);
      log("success", `Compagnia: ${parsed.compagnia || "—"}`);
      log("success", `Contraente: ${parsed.contraente_nome || "—"}`);
      log("success", `Voci di garanzia estratte: ${parsed.garanzie?.length || 0}`);

      setData(parsed);

      // Cliente: skip lookup se locked dall'anagrafica corrente
      if (lockedClienteId) {
        setSelectedClienteId(lockedClienteId);
        log("info", `Cliente già fissato dall'anagrafica: ${lockedClienteLabel || lockedClienteId}`);
      } else {
        setPhase(80, "Ricerca cliente nel database…");
        const cli = await lookupClienti(parsed);
        setClienteCandidates(cli);
        const exact = cli.find((c) => c.matchType === "cf" || c.matchType === "piva" || c.matchType === "email");
        if (exact) {
          setSelectedClienteId(exact.id);
        } else if (cli.length) {
          log("warn", `Nessun match esatto — ${cli.length} candidato/i solo per nome`);
          setSelectedClienteId(NEW_CLIENTE);
        } else {
          log("warn", "Nessun cliente trovato — andrà creato");
          setSelectedClienteId(NEW_CLIENTE);
        }
      }

      setPhase(88, "Ricerca compagnia assicurativa…");
      const grComp = await lookupGruppiCompagnia(parsed);
      setGruppoCompagniaCandidates(grComp);
      if (grComp.length) {
        log("success", `${grComp.length} compagnia/e (gruppo) candidata/e`);
        setSelectedGruppoCompagniaId(grComp[0].id);
        const ag = await loadAgenzieByGruppo(grComp[0].id);
        setAgenziaCandidates(ag);
        if (ag.length === 1) {
          setSelectedAgenziaId(ag[0].id);
          log("success", `Agenzia auto-selezionata: ${ag[0].label}`);
        } else if (ag.length > 1) {
          log("info", `${ag.length} agenzie nel gruppo — selezionane una`);
        } else {
          log("warn", "Nessuna agenzia attiva per questo gruppo");
        }
      } else {
        log("warn", "Nessuna compagnia (gruppo) trovata");
      }

      // Ramo: già scelto dall'utente nello step Setup, NON viene cambiato dall'AI
      log("success", `Ramo confermato (scelto manualmente): ${gruppoRamoCtx?.codice} — ${gruppoRamoCtx?.descrizione}`);

      setPhase(100, "Completato — applico al form");
      log("success", "Pronto — dati trasferiti al form");

      // Auto-apply diretto: niente step intermedi. Le correzioni si fanno nel form.
      const firstGrComp = grComp[0] || null;
      let agFresh: AgenziaCand[] = [];
      if (firstGrComp) {
        agFresh = await loadAgenzieByGruppo(firstGrComp.id);
      }
      const firstAg = agFresh[0] || null;

      const cliente: { id: string; label: string } | null = lockedClienteId
        ? { id: lockedClienteId, label: lockedClienteLabel || "Cliente corrente" }
        : null;

      const result: MatchResult = {
        data: parsed,
        cliente,
        gruppoCompagnia: firstGrComp ? { id: firstGrComp.id, label: firstGrComp.label } : null,
        compagnia: firstAg ? { id: firstAg.id, label: firstAg.label } : null,
        ramo: selectedGruppoRamoId
          ? { gruppoRamoId: selectedGruppoRamoId, ramoId: null, label: "" }
          : null,
        isNewCliente: !lockedClienteId,
        polizzaAuto: wantsVeicolo,
        sourcePdf: sourcePdf ?? { name: file.name, base64: b64, mimeType: file.type || "application/pdf" },
      };

      onApply(result);
      toast.success("Dati importati — completa/correggi nel form");
      // Mostra un riepilogo semplice (chiudibile) PRIMA di chiudere il dialog.
      setStep("summary");
    } catch (e: any) {
      console.error(e);
      log("error", `Errore: ${e?.message || "sconosciuto"}`);
      toast.error("Estrazione fallita: " + (e?.message || "errore"));
    } finally {
      setParsing(false);
    }
  };

  const recalculaLordo = (which: "firma" | "quietanza") => {
    const k: any = which === "firma"
      ? ["premio_firma_netto", "premio_firma_imposte", "premio_firma_accessori", "premio_firma_lordo"]
      : ["premio_quietanza_netto", "premio_quietanza_imposte", "premio_quietanza_accessori", "premio_quietanza_lordo"];
    const tot = (Number((data as any)[k[0]]) || 0) + (Number((data as any)[k[1]]) || 0) + (Number((data as any)[k[2]]) || 0);
    updateField(k[3] as any, Number(tot.toFixed(2)) as any);
    toast.success(`Lordo ${which} ricalcolato: ${fmtEur(tot)}`);
  };

  const isNewCliente = selectedClienteId === NEW_CLIENTE;
  const selectedGruppoFinanziario = useMemo(
    () => gruppiFinanziari.find((g) => g.id === selectedGruppoFinanziarioId) || null,
    [gruppiFinanziari, selectedGruppoFinanziarioId],
  );
  const tipoClienteAuto = selectedGruppoFinanziario?.tipo_soggetto;
  const cigRequired = tipoClienteAuto === "ente";
  const newClienteReady =
    !isNewCliente || (!!selectedGruppoFinanziarioId && (!cigRequired || codiceCigNew.trim().length > 0));

  const buildResult = (): MatchResult => {
    // Cliente locked: ritorna direttamente quello dell'anagrafica corrente
    let cliente: { id: string; label: string } | null = null;
    if (lockedClienteId) {
      cliente = { id: lockedClienteId, label: lockedClienteLabel || "Cliente corrente" };
    } else if (selectedClienteId && selectedClienteId !== NEW_CLIENTE) {
      const found = clienteCandidates.find((c) => c.id === selectedClienteId);
      cliente = found ? { id: found.id, label: found.label } : null;
    }
    const gruppoComp = gruppoCompagniaCandidates.find((g) => g.id === selectedGruppoCompagniaId) || null;
    const agenzia = agenziaCandidates.find((a) => a.id === selectedAgenziaId) || null;
    // Ramo: solo gruppoRamoId (scelto in Setup). I sottorami sono nelle voci di garanzia.
    const ramo = selectedGruppoRamoId
      ? {
          gruppoRamoId: selectedGruppoRamoId,
          ramoId: null,
          label: "",
        }
      : null;
    const effIsNewCliente = lockedClienteId ? false : isNewCliente;
    return {
      data,
      cliente,
      gruppoCompagnia: gruppoComp ? { id: gruppoComp.id, label: gruppoComp.label } : null,
      compagnia: agenzia ? { id: agenzia.id, label: agenzia.label } : null,
      ramo,
      isNewCliente: effIsNewCliente,
      gruppoFinanziarioId: effIsNewCliente ? selectedGruppoFinanziarioId || undefined : undefined,
      tipoCliente: effIsNewCliente ? tipoClienteAuto : undefined,
      codiceCig: effIsNewCliente && cigRequired ? codiceCigNew.trim() || undefined : undefined,
      polizzaAuto: forzaPolizzaAuto || selectedGruppoRamoCodice === "ZQ",
      sourcePdf: sourcePdf ?? undefined,
    };
  };

  const canProceed =
    (lockedClienteId ? true : !!selectedClienteId && newClienteReady) &&
    !!selectedGruppoCompagniaId &&
    !!selectedAgenziaId &&
    !!selectedGruppoRamoId;

  const apply = () => {
    if (!lockedClienteId) {
      if (!selectedClienteId) {
        toast.error("Seleziona un cliente esistente o scegli 'Crea nuovo cliente'");
        return;
      }
      if (isNewCliente && !selectedGruppoFinanziarioId) {
        toast.error("Seleziona il Gruppo Finanziario per il nuovo cliente");
        return;
      }
      if (isNewCliente && cigRequired && !codiceCigNew.trim()) {
        toast.error("Inserisci il Codice CIG (obbligatorio per gli Enti)");
        return;
      }
      try {
        assertFiscalValid([
          { label: "Codice Fiscale Contraente", value: data.contraente_codice_fiscale, kind: "cf-azienda" },
          { label: "Partita IVA Contraente", value: data.contraente_partita_iva, kind: "piva" },
        ]);
      } catch (err: any) {
        toast.error(err.message);
        return;
      }
    }
    onApply(buildResult());
    onOpenChange(false);
    reset();
  };

  const clienteOptions = useMemo(
    () => [
      ...clienteCandidates.map((c) => ({ value: c.id, label: c.label })),
      { value: NEW_CLIENTE, label: "➕ Crea nuovo cliente da questi dati…" },
    ],
    [clienteCandidates],
  );

  const bestMatch = useMemo(
    () => clienteCandidates.find((c) => c.matchType === "cf" || c.matchType === "piva" || c.matchType === "email") || null,
    [clienteCandidates],
  );
  const matchLevel: "esatto" | "parziale" | "nessuno" = useMemo(() => {
    if (bestMatch) return "esatto";
    if (clienteCandidates.length > 0) return "parziale";
    return "nessuno";
  }, [bestMatch, clienteCandidates.length]);


  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal-600" />
            Importa polizza da PDF (AI)
          </DialogTitle>
          <DialogDescription>
            Scegli il Ramo e carica la scheda di polizza: i dati estratti vengono applicati direttamente al form.
          </DialogDescription>
        </DialogHeader>

        {/* PROGRESS + LOG */}
        {(parsing || logs.length > 0) && step === "setup" && (
          <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{progressLabel || "In attesa…"}</span>
              <span className="tabular-nums text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <ScrollArea className="h-32 rounded border bg-background">
              <div ref={logScrollRef} className="p-2 space-y-0.5 text-[11px] font-mono">
                {logs.map((l, i) => (
                  <div
                    key={i}
                    className={cn(
                      l.level === "error" && "text-destructive",
                      l.level === "warn" && "text-amber-600",
                      l.level === "success" && "text-teal-700",
                      l.level === "info" && "text-muted-foreground",
                    )}
                  >
                    [{new Date(l.ts).toLocaleTimeString("it-IT")}] {l.msg}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* STEP SETUP: Cliente (read-only se locked) + Ramo + Dropzone */}
        {step === "setup" && (
          <div className="space-y-4">
            {/* Cliente: badge read-only se locked, altrimenti messaggio neutro */}
            {lockedClienteId ? (
              <div className="rounded border p-3 text-xs flex gap-2 items-start bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900 text-teal-800 dark:text-teal-200">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold">Cliente: {lockedClienteLabel || "—"}</div>
                  <div className="opacity-80">Preso dall'anagrafica corrente — la polizza verrà associata a questo cliente.</div>
                </div>
              </div>
            ) : (
              <div className="rounded border p-3 text-xs flex gap-2 items-start bg-muted/40 border-border text-muted-foreground">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                Il Cliente verrà ricercato (o creato) dopo l'analisi del PDF.
              </div>
            )}

            {/* Selezione SOLO Gruppo Ramo OBBLIGATORIA prima del PDF.
                I sottorami vengono estratti dal PDF voce per voce (come nel manuale). */}
            <div className="border rounded-lg p-3 space-y-2">
              <Label className="text-xs font-semibold">
                Ramo della polizza <span className="text-destructive">*</span>
              </Label>
              <RamoSottoramoSelect
                gruppoRamoId={selectedGruppoRamoId || null}
                ramoId={null}
                onChange={({ gruppoRamoId }) => {
                  setSelectedGruppoRamoId(gruppoRamoId || "");
                }}
                hideLabels
                gruppoOnly
              />
              <p className="text-[11px] text-muted-foreground">
                Seleziona il <strong>Ramo</strong>: l'AI riceverà l'elenco dei sottorami ammessi e mapperà
                ogni voce di garanzia del PDF al sottoramo corretto. I sottorami vengono presi dal PDF
                (uno per riga, esattamente come nel form manuale).
              </p>
            </div>

            {/* Switch Polizza Auto — auto-ON quando ramo ZQ; resta editabile */}
            <div className="border rounded-lg p-3 flex items-start gap-3 bg-muted/20">
              <Switch
                id="forza-polizza-auto"
                checked={forzaPolizzaAuto}
                onCheckedChange={(v) => { setForzaPolizzaAuto(!!v); setPolizzaAutoTouched(true); }}
              />
              <div className="flex-1 space-y-1">
                <Label htmlFor="forza-polizza-auto" className="text-xs font-semibold cursor-pointer">
                  Polizza Auto {selectedGruppoRamoCodice === "ZQ" && <Badge variant="secondary" className="ml-1 text-[10px]">auto da ramo ZQ</Badge>}
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Attivalo se la polizza è una RCA Auto (o contiene un veicolo identificato): l'AI proverà
                  a estrarre <strong>targa, telaio, marca, modello, classe BM, alimentazione, cv/kw/cc, posti</strong> e il
                  conducente — <strong>solo se realmente presenti nel PDF</strong>, senza inventarli.
                </p>
              </div>
            </div>

            {/* Dropzone — disabilitata finché manca il Ramo */}
            <div
              onDragOver={(e) => { if (!selectedGruppoRamoId) return; e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                if (!selectedGruppoRamoId) return;
                e.preventDefault(); setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              onClick={() => {
                if (!selectedGruppoRamoId) {
                  toast.error("Seleziona prima il Ramo");
                  return;
                }
                if (!parsing) fileInput.current?.click();
              }}
              className={cn(
                "border-2 border-dashed rounded-lg p-10 text-center transition-colors",
                !selectedGruppoRamoId
                  ? "border-muted-foreground/20 bg-muted/20 cursor-not-allowed opacity-60"
                  : dragOver
                    ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30 cursor-pointer"
                    : "border-muted-foreground/30 hover:border-teal-400 cursor-pointer",
                parsing && "opacity-60 cursor-wait",
              )}
            >
              <input
                ref={fileInput}
                type="file"
                className="hidden"
                accept="application/pdf,image/*"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              {parsing ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                  <span>Analisi in corso… non chiudere il dialog</span>
                  {fileName && <span className="text-xs">{fileName}</span>}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <UploadCloud className="h-10 w-10 text-teal-600" />
                  <span className="font-medium">
                    {selectedGruppoRamoId
                      ? "Trascina la scheda di polizza o clicca per selezionare"
                      : "Seleziona prima il Ramo per abilitare il caricamento"}
                  </span>
                  <span className="text-xs">PDF o immagini, max {MAX_DOCUMENT_UPLOAD_MB} MB</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP SUMMARY: riepilogo esteso dei dati estratti (dati già applicati al form) */}
        {step === "summary" && (() => {
          const v = data.veicolo || {};
          const c = data.conducente || {};
          const hasVeicolo = !!(v.targa || v.telaio || v.marca || v.modello || v.tipo_veicolo);
          const hasConducente = !!(c.nome || c.cognome || c.codice_fiscale);
          const grComp = gruppoCompagniaCandidates.find((g) => g.id === selectedGruppoCompagniaId);
          const agenzia = agenziaCandidates.find((a) => a.id === selectedAgenziaId);
          const Row = ({ label, value }: { label: string; value: any }) => (
            <div className="grid grid-cols-[180px_1fr] gap-2 px-3 py-1.5 text-xs">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium break-words">{value || <span className="text-muted-foreground">—</span>}</span>
            </div>
          );
          const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
            <div className="border rounded-lg overflow-hidden">
              <div className="px-3 py-1.5 bg-muted/50 text-[11px] font-semibold uppercase tracking-wide">{title}</div>
              <div className="divide-y">{children}</div>
            </div>
          );
          const confBadge = (cf?: "alta" | "media" | "manuale") => {
            if (cf === "alta") return <Badge className="bg-teal-600 hover:bg-teal-700 text-white">alta</Badge>;
            if (cf === "media") return <Badge variant="secondary" className="bg-amber-100 text-amber-900 hover:bg-amber-100">media</Badge>;
            return <Badge variant="outline" className="text-amber-700 border-amber-400">manuale</Badge>;
          };
          return (
            <div className="space-y-3">
              <div className="rounded-lg border border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-teal-950/30 p-3 text-sm text-teal-800 dark:text-teal-200 flex gap-2 items-start">
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Dati importati nel form</div>
                  <div className="text-xs opacity-80">Verifica qui sotto cosa l'AI ha estratto dal PDF. Puoi chiudere e correggere direttamente nel form.</div>
                </div>
              </div>

              <Section title="Anagrafica polizza">
                <Row label="Numero polizza" value={data.numero_polizza} />
                <Row label="Compagnia (PDF)" value={data.compagnia} />
                <Row label="Gruppo compagnia" value={grComp?.label} />
                <Row label="Agenzia" value={agenzia?.label} />
                <Row label="Prodotto" value={data.prodotto} />
                <Row label="Contraente" value={data.contraente_nome} />
                <Row label="CF / P.IVA" value={[data.contraente_codice_fiscale, data.contraente_partita_iva].filter(Boolean).join(" / ")} />
                <Row label="Indirizzo" value={[data.contraente_indirizzo, data.contraente_cap, data.contraente_comune, data.contraente_provincia].filter(Boolean).join(" — ")} />
                <Row label="Email / Tel" value={[data.contraente_email, data.contraente_telefono].filter(Boolean).join(" / ")} />
              </Section>

              <Section title="Periodo & Premi">
                <Row label="Decorrenza → Scadenza" value={`${data.decorrenza || "—"} → ${data.scadenza || "—"}`} />
                <Row label="Frazionamento" value={data.frazionamento} />
                <Row label="Tacito rinnovo" value={typeof data.tacito_rinnovo === "boolean" ? (data.tacito_rinnovo ? "Sì" : "No") : null} />
                <Row label="Prossima quietanza" value={data.prossima_quietanza} />
                <Row label="Premio firma" value={`netto ${fmtEur(data.premio_firma_netto)} · acc ${fmtEur(data.premio_firma_accessori)} · imp ${fmtEur(data.premio_firma_imposte)} · LORDO ${fmtEur(data.premio_firma_lordo)}`} />
                <Row label="Premio quietanza" value={`netto ${fmtEur(data.premio_quietanza_netto)} · acc ${fmtEur(data.premio_quietanza_accessori)} · imp ${fmtEur(data.premio_quietanza_imposte)} · LORDO ${fmtEur(data.premio_quietanza_lordo)}`} />
              </Section>

              {hasVeicolo && (
                <Section title="Veicolo (RCA Auto)">
                  <Row label="Targa / Telaio" value={[v.targa, v.telaio].filter(Boolean).join(" / ")} />
                  <Row label="Marca / Modello" value={[v.marca, v.modello, v.versione].filter(Boolean).join(" ")} />
                  <Row label="Tipo veicolo" value={v.tipo_veicolo} />
                  <Row label="Uso" value={v.uso_descrizione} />
                  <Row label="Immatricolazione" value={v.data_immatricolazione} />
                  <Row label="Provincia circolazione" value={v.provincia_circolazione} />
                  <Row label="Classe BM" value={v.classe_bm} />
                  <Row label="CV / KW / CC" value={[v.cv, v.kw, v.cc].filter((x) => x != null).join(" / ")} />
                  <Row label="Posti" value={v.posti} />
                  <Row label="Alimentazione" value={v.alimentazione} />
                  <Row label="Peso totale" value={v.peso_totale} />
                </Section>
              )}

              {hasConducente && (
                <Section title="Conducente abituale">
                  <Row label="Nome" value={[c.cognome, c.nome].filter(Boolean).join(" ")} />
                  <Row label="Codice fiscale" value={c.codice_fiscale} />
                  <Row label="Data nascita" value={c.data_nascita} />
                  <Row label="Indirizzo" value={[c.indirizzo, c.cap, c.citta, c.provincia].filter(Boolean).join(" — ")} />
                  <Row label="Patente" value={[c.tipo_patente, c.data_rilascio_patente].filter(Boolean).join(" — rilasciata ")} />
                </Section>
              )}

              <div>
                <div className="text-xs font-semibold mb-1">Garanzie estratte ({data.garanzie?.length || 0})</div>
                <TableScrollArea className="border rounded-lg">
                  <table className="w-full min-w-max text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2">Descrizione</th>
                        <th className="text-left p-2 w-24">Sottoramo</th>
                        <th className="text-left p-2 w-24">Match</th>
                        <th className="text-right p-2 w-24">Netto</th>
                        <th className="text-right p-2 w-24">Imposte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.garanzie || []).map((g, i) => (
                        <tr key={i} className={i % 2 ? "bg-muted/20" : ""}>
                          <td className="p-2">{g.descrizione}</td>
                          <td className="p-2">
                            {g.codice_sottoramo
                              ? <Badge variant="secondary" className="font-mono">{g.codice_sottoramo}</Badge>
                              : <span className="text-amber-600">—</span>}
                          </td>
                          <td className="p-2">{confBadge(g.match_confidence)}</td>
                          <td className="p-2 text-right tabular-nums">{fmtEur(g.premio_netto)}</td>
                          <td className="p-2 text-right tabular-nums">{fmtEur(g.premio_imposte)}</td>
                        </tr>
                      ))}
                      {(!data.garanzie || data.garanzie.length === 0) && (
                        <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">Nessuna garanzia estratta</td></tr>
                      )}
                    </tbody>
                  </table>
                </TableScrollArea>
                <p className="text-[11px] text-muted-foreground mt-1">
                  <strong>Match</strong>: <em>alta</em> = sottoramo certo (AI o regola sinonimo) · <em>media</em> = best-guess fuzzy, controlla nel form · <em>manuale</em> = scegli tu nel form.
                </p>
              </div>

              <DialogFooter>
                <Button onClick={() => { onOpenChange(false); reset(); }}>Chiudi</Button>
              </DialogFooter>
            </div>
          );
        })()}

      </DialogContent>
    </Dialog>
  );
}

// (helper components rimossi: il dialog non ha più step di revisione/riepilogo)

