import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect, type SearchableSelectOption } from "@/components/SearchableSelect";
import { toast } from "sonner";
import { Loader2, AlertCircle, Receipt, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DatePicker } from "@/components/contabilita/DatePicker";
import { logAttivita } from "@/lib/logAttivita";
import { resolveTitoloMadreId } from "@/lib/sospensioneQuietanze";
import { fetchAppendiciPolizzaForTitolo } from "@/lib/appendiciPolizza";
import {
  aggregateGaranziePremi,
  calcProvvigioniAppendice,
  creaAppendiceIncasso,
  type AppendiceTipo,
} from "@/lib/appendicePremi";
import { PolizzaEditorInline, type PolizzaEditorHandle, type PolizzaEditorState } from "@/components/polizze/PolizzaEditorInline";
import { OperazionePolizzaDialogShell } from "@/components/polizze/operazione/OperazionePolizzaDialogShell";
import { OperazioneAllegatoField } from "@/components/polizze/operazione/OperazioneAllegatoField";
import { PolizzaSection } from "@/components/polizze/PolizzaSection";

const TIPI_APPENDICE = [
  { value: "modifica", label: "Modifica" },
  { value: "proroga", label: "Appendice di proroga" },
  { value: "regolazione", label: "Regolazione" },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titoloId: string | null;
  numeroTitolo?: string | null;
  initialTipo?: string;
  onCreated?: () => void;
}

const fmt = (n: number | null | undefined) =>
  n == null ? "-" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("it-IT") : "-");

const isoToDate = (iso: string): Date | null => {
  if (!iso) return null;
  try {
    return parseISO(iso.slice(0, 10));
  } catch {
    return null;
  }
};

const dateToIso = (d: Date | null): string => (d ? format(d, "yyyy-MM-dd") : "");

function PremiRiepilogo({
  aggregated,
  percProvv,
}: {
  aggregated: NonNullable<ReturnType<typeof aggregateGaranziePremi>>;
  percProvv: number | null;
}) {
  const provv = calcProvvigioniAppendice(aggregated.premio_netto, percProvv);
  const items = [
    { label: "Netto", value: aggregated.premio_netto },
    { label: "Rata", value: aggregated.addizionali },
    { label: "Tasse", value: aggregated.tasse },
    { label: "SSN", value: aggregated.ssn_firma },
    { label: "Lordo", value: aggregated.premio_lordo, highlight: true },
    { label: "Provvigioni", value: provv },
  ];
  return (
    <div className="rounded-md border bg-muted/40 p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
      {items.map((it) => (
        <div key={it.label}>
          <div className="text-xs text-muted-foreground">{it.label}</div>
          <div className={cn("font-semibold tabular-nums", it.highlight && "text-primary")}>{fmt(it.value)}</div>
        </div>
      ))}
    </div>
  );
}

const TIPO_INFO: Record<AppendiceTipo, { title: string; hint: string; suffix: string }> = {
  modifica: {
    title: "Appendice di modifica",
    hint: "Genera un titolo AM cassabile (anche a €0). La scadenza non è richiesta: compila la composizione premi prima di salvare.",
    suffix: "AM",
  },
  proroga: {
    title: "Appendice di proroga",
    hint: "Genera un titolo PR cassabile. All'incasso estende automaticamente la scadenza della polizza madre.",
    suffix: "PR",
  },
  regolazione: {
    title: "Regolazione premio",
    hint: "Genera un titolo RG collegato alla quietanza di riferimento. Cassabile anche a premio zero.",
    suffix: "RG",
  },
};

export function AppendiceDialog({ open, onOpenChange, titoloId, numeroTitolo, initialTipo, onCreated }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const editorRef = useRef<PolizzaEditorHandle>(null);

  const [madreId, setMadreId] = useState<string | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [editorState, setEditorState] = useState<PolizzaEditorState | null>(null);

  const [numeroAppendice, setNumeroAppendice] = useState("");
  const [dataAppendice, setDataAppendice] = useState(new Date().toISOString().slice(0, 10));
  const [dataEffetto, setDataEffetto] = useState("");
  const [oggetto, setOggetto] = useState("");
  const [tipo, setTipo] = useState<AppendiceTipo>("modifica");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [quietanzaId, setQuietanzaId] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  // Inizializzazione una-tantum alla transizione open false→true: evita che i
  // refetch di `existing`/`titoloInfo` azzerino il form mentre l'utente compila.
  const initializedRef = useRef(false);
  // Evita di ripetere la pre-selezione automatica della quietanza dopo che
  // l'utente ha eventualmente scelto un'altra rata.
  const autoQuietanzaDoneRef = useRef(false);

  const handleEditorStateChange = useCallback((state: PolizzaEditorState) => {
    setEditorState(state);
    setEditorReady(true);
  }, []);

  const { data: existing } = useQuery({
    queryKey: ["appendici-count", madreId ?? titoloId],
    enabled: !!(madreId ?? titoloId) && open,
    queryFn: async () => {
      const anchor = madreId ?? titoloId!;
      const data = await fetchAppendiciPolizzaForTitolo(supabase, anchor);
      return data.map((a) => ({ numero_appendice: a.numero_appendice }));
    },
  });

  const { data: titoloInfo } = useQuery({
    queryKey: ["titolo-scadenza", titoloId],
    enabled: !!titoloId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("titoli")
        .select("data_scadenza, garanzia_da, garanzia_a, numero_titolo, premio_netto, provvigioni_firma")
        .eq("id", titoloId!)
        .maybeSingle();
      if (!data) return null;
      // titoli non ha una colonna percentuale_provvigione: la deriviamo da
      // provvigioni_firma / premio_netto.
      const perc =
        data.premio_netto && Number(data.premio_netto) !== 0 && data.provvigioni_firma != null
          ? +((Number(data.provvigioni_firma) / Number(data.premio_netto)) * 100).toFixed(4)
          : null;
      return { ...data, percentuale_provvigione_calc: perc };
    },
  });

  const STATI_VALIDI = ["attivo", "incassato", "sospeso"];
  // La lista delle rate non dipende più solo dalla risoluzione di `titoloId`:
  // se `titoloInfo` non risolve (id derivato/stale) ricadiamo sul `numeroTitolo`
  // ricevuto dal chiamante, così le quietanze restano sempre disponibili.
  const numeroTitoloCatena = titoloInfo?.numero_titolo || numeroTitolo || null;
  const { data: catena } = useQuery({
    queryKey: ["catena-quietanze", numeroTitoloCatena],
    enabled: !!numeroTitoloCatena && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("titoli")
        .select("id, riga, garanzia_da, garanzia_a, data_scadenza, premio_lordo, premio_netto, tasse, sostituisce_polizza, is_regolazione, is_proroga, is_appendice_modifica, stato, numero_titolo")
        .eq("numero_titolo", numeroTitoloCatena!)
        .order("garanzia_da", { ascending: false });
      return (data || []).filter(
        (t: { sostituisce_polizza?: string | null; is_regolazione?: boolean; is_proroga?: boolean; is_appendice_modifica?: boolean; stato?: string }) =>
          // Solo quietanze (rate reali): la madre (sostituisce_polizza null) non è
          // una rata su cui agganciare una regolazione.
          t.sostituisce_polizza != null &&
          !t.is_regolazione && !t.is_proroga && !t.is_appendice_modifica && STATI_VALIDI.includes((t.stato || "").toLowerCase()),
      );
    },
  });

  const quietanzaOptions: SearchableSelectOption[] = useMemo(() => {
    const list = catena || [];
    return list.map((t: { id: string; riga?: number; garanzia_da?: string; garanzia_a?: string; premio_lordo?: number; stato?: string; numero_titolo?: string }, i: number) => {
      const stato = (t.stato || "").toLowerCase();
      const statoBadge = stato ? ` · ${stato}` : "";
      const numeroRata = t.riga != null ? t.riga : list.length - i;
      const label = `Rata ${numeroRata} · ${fmtDate(t.garanzia_da)} → ${fmtDate(t.garanzia_a)} · ${fmt(t.premio_lordo)}${statoBadge}`;
      const searchText = [
        "rata",
        numeroRata,
        t.numero_titolo || numeroTitolo || "",
        fmtDate(t.garanzia_da),
        fmtDate(t.garanzia_a),
        stato,
        t.premio_lordo != null ? String(t.premio_lordo) : "",
      ]
        .filter(Boolean)
        .join(" ");
      return { value: t.id, label, searchText };
    });
  }, [catena, numeroTitolo]);

  useEffect(() => {
    if (!open || !titoloId) {
      setMadreId(null);
      setEditorReady(false);
      return;
    }
    (async () => {
      const resolved = await resolveTitoloMadreId(supabase, titoloId);
      setMadreId(resolved);
    })();
  }, [open, titoloId]);

  // Reset dei ref di apertura alla chiusura del dialog.
  useEffect(() => {
    if (!open) {
      setEditorReady(false);
      setEditorState(null);
      setNoteOpen(false);
      initializedRef.current = false;
      autoQuietanzaDoneRef.current = false;
    }
  }, [open]);

  // Numero appendice: sempre derivato (campo readonly), non lo tocca l'utente.
  useEffect(() => {
    if (!open) return;
    const max = (existing || []).reduce((acc, a: { numero_appendice?: string }) => Math.max(acc, parseInt(a.numero_appendice || "0") || 0), 0);
    setNumeroAppendice(String(max + 1));
  }, [open, existing]);

  // Inizializza il form una sola volta per apertura, quando i dati del titolo
  // sono risolti. I refetch di `existing`/`titoloInfo` non ripristinano più i
  // campi già compilati dall'utente.
  useEffect(() => {
    if (!open || initializedRef.current) return;
    if (titoloId && titoloInfo === undefined) return; // attende la query
    initializedRef.current = true;

    const t = (initialTipo as AppendiceTipo) || "modifica";
    setTipo(TIPI_APPENDICE.some((x) => x.value === t) ? t : "modifica");
    setOggetto("");
    setNote("");
    setQuietanzaId("");
    setFile(null);
    setDisplayName("");
    setFiles([]);

    const garDa = titoloInfo?.garanzia_da;
    const garA = titoloInfo?.garanzia_a || titoloInfo?.data_scadenza;
    setDataAppendice(garA || new Date().toISOString().slice(0, 10));
    setDataEffetto(garDa || titoloInfo?.data_scadenza || "");
  }, [open, titoloId, titoloInfo, initialTipo]);

  useEffect(() => {
    if (!open || tipo !== "proroga" || !titoloInfo?.garanzia_a) return;
    const d = new Date(titoloInfo.garanzia_a);
    d.setDate(d.getDate() + 1);
    setDataEffetto(d.toISOString().slice(0, 10));
    setDataAppendice("");
  }, [open, tipo, titoloInfo?.garanzia_a]);

  // Pre-selezione automatica della quietanza di riferimento: se apri la
  // regolazione da una rata specifica (o ne esiste una sola), la seleziona da
  // sola invece di richiederla.
  useEffect(() => {
    if (!open || tipo !== "regolazione") return;
    if (autoQuietanzaDoneRef.current || quietanzaId) return;
    const list = (catena || []) as Array<{ id: string; stato?: string }>;
    if (list.length === 0) return;
    // 1) se apri da una rata specifica presente in lista, usa quella;
    // 2) altrimenti (apertura dalla madre / titolo derivato) scegli un default
    //    sensato: la rata attiva, altrimenti la più recente (lista ordinata per
    //    garanzia_da desc).
    const current = titoloId && list.some((t) => t.id === titoloId) ? titoloId : null;
    const attiva = list.find((t) => (t.stato || "").toLowerCase() === "attivo");
    const pick = current || attiva?.id || list[0]?.id || null;
    if (pick) {
      autoQuietanzaDoneRef.current = true;
      setQuietanzaId(pick);
    }
  }, [open, tipo, catena, titoloId, quietanzaId]);

  // Date derivate dalla quietanza selezionata (idempotente sui refetch di catena).
  useEffect(() => {
    if (tipo !== "regolazione" || !quietanzaId || !catena) return;
    const q = (catena as Array<{ id: string; garanzia_da?: string; garanzia_a?: string; data_scadenza?: string }>).find((t) => t.id === quietanzaId);
    if (!q) return;
    setDataEffetto(q.garanzia_da || "");
    setDataAppendice(q.garanzia_a || q.data_scadenza || "");
  }, [quietanzaId, catena, tipo]);

  // Reset dell'editor SOLO quando cambia davvero la rata di riferimento: evita
  // che un refetch di `catena` lasci `editorReady=false` senza rimontare
  // l'editor (che ha key = editorTitoloId), bloccando il pulsante di salvataggio.
  useEffect(() => {
    if (tipo !== "regolazione") return;
    setEditorReady(false);
    setEditorState(null);
  }, [quietanzaId, tipo]);

  const percProvv = titoloInfo?.percentuale_provvigione_calc ?? null;
  const aggregated = useMemo(
    () => (editorState ? aggregateGaranziePremi(editorState.garanzie) : null),
    [editorState],
  );

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!dataEffetto) e.dataEffetto = "Data effetto obbligatoria";
    // La scadenza è opzionale per tutte le tipologie (le appendici sono
    // titoli-incasso autonomi, non richiedono la scadenza della polizza).
    if (dataEffetto && dataAppendice && dataEffetto > dataAppendice) {
      e.dataEffetto = "La data effetto deve precedere la scadenza";
    }
    if (tipo === "regolazione" && !quietanzaId) e.quietanzaId = "Seleziona la quietanza di riferimento";
    if (tipo === "regolazione" && !quietanzaId) e.editor = "Seleziona la quietanza di riferimento";
    else if (!editorReady) e.editor = "Caricamento composizione premi…";
    return e;
  }, [dataEffetto, dataAppendice, tipo, quietanzaId, editorReady]);

  const hasErrors = Object.keys(errors).length > 0;

  const mut = useMutation({
    mutationFn: async () => {
      if (!titoloId || !madreId) throw new Error("Titolo non specificato");
      if (!numeroAppendice.trim()) throw new Error("Numero appendice obbligatorio");
      if (!dataEffetto) throw new Error("Inserisci la data effetto");
      if (dataAppendice && dataEffetto > dataAppendice) throw new Error("La data effetto non può essere successiva alla scadenza");
      if (tipo === "regolazione" && !quietanzaId) throw new Error("Seleziona la quietanza di riferimento");

      const state = editorRef.current?.getState() ?? editorState;
      if (!state) throw new Error("Editor polizza non pronto");

      const agg = aggregateGaranziePremi(state.garanzie);
      const provvigioni = calcProvvigioniAppendice(agg.premio_netto, percProvv);

      let filePath: string | null = null;
      let nomeFile: string | null = null;
      const allegati: Array<{ path: string; nome: string; size: number; type: string }> = [];

      const toUpload: File[] = [...files, ...(file ? [file] : [])];
      for (let i = 0; i < toUpload.length; i++) {
        const f = toUpload[i];
        const path = `appendici/${titoloId}/${Date.now()}_${i}_${f.name}`;
        const { error: upErr } = await supabase.storage.from("documenti_titoli").upload(path, f);
        if (upErr) throw upErr;
        allegati.push({ path, nome: displayName || f.name, size: f.size, type: f.type });
        if (i === 0) {
          filePath = path;
          nomeFile = displayName || f.name;
        }
      }

      const res = await creaAppendiceIncasso(supabase, {
        tipo,
        madreId,
        numeroAppendice: numeroAppendice.trim(),
        dataEffetto,
        dataScadenza: dataAppendice || null,
        oggetto: oggetto.trim() || null,
        note: note.trim() || null,
        quietanzaId: tipo === "regolazione" ? quietanzaId : null,
        aggregated: agg,
        provvigioni,
        percProvv,
        garanzie: state.garanzie,
        filePath,
        nomeFile,
        allegati,
        createdBy: user?.id || null,
      });

      const azione =
        tipo === "modifica" ? "appendice_modifica_creata" : tipo === "proroga" ? "proroga_creata" : "regolazione_creata";
      // Il log attività non deve mai far fallire (o sembrare fallito) il salvataggio
      // dell'appendice, che a questo punto è già stato committato dalla RPC.
      try {
        await logAttivita({
          azione,
          entita_tipo: "titolo",
          entita_id: titoloId,
          dettagli_json: {
            numero_appendice: numeroAppendice.trim(),
            tipo,
            oggetto: oggetto.trim() || null,
            quietanza_id: tipo === "regolazione" ? quietanzaId : undefined,
            titolo_derivato_id: res.titolo_id,
          },
        });
      } catch (logErr) {
        console.warn("[AppendiceDialog] logAttivita non riuscito (ignorato):", logErr);
      }

      return { appendiceId: res.appendice_id, titoloDerivatoId: res.titolo_id };
    },
    onSuccess: (res) => {
      const info = TIPO_INFO[tipo];
      toast.success(`${info.title} creata`, {
        description: `Titolo ${info.suffix} generato. Ora è in Incassi e pronto per la messa a cassa (anche a €0).`,
        action: res.titoloDerivatoId
          ? { label: "Apri titolo", onClick: () => navigate(`/titoli/${res.titoloDerivatoId}`) }
          : undefined,
      });
      qc.invalidateQueries({ queryKey: ["appendici-polizza"] });
      qc.invalidateQueries({ queryKey: ["gestione-polizze"] });
      qc.invalidateQueries({ queryKey: ["titolo", titoloId] });
      onCreated?.();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message || "Errore nel salvataggio"),
  });

  const errClass = "border-destructive focus-visible:ring-destructive";
  const ErrMsg = ({ id }: { id: string }) =>
    errors[id] ? (
      <p className="text-xs text-destructive flex items-center gap-1 mt-1">
        <AlertCircle className="h-3 w-3" /> {errors[id]}
      </p>
    ) : null;

  const tipoInfo = TIPO_INFO[tipo];

  const editorTitoloId = tipo === "regolazione" ? quietanzaId || null : madreId;

  const editorBlock =
    tipo === "regolazione" && !quietanzaId ? (
      <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground text-center">
        Seleziona la quietanza di riferimento qui sopra per compilare i premi.
      </div>
    ) : editorTitoloId ? (
      <PolizzaSection
        title="Garanzie e importi"
        icon={Receipt}
        static
        headerExtra={
          aggregated ? (
            <Badge variant="secondary" className="font-mono tabular-nums">
              Lordo {fmt(aggregated.premio_lordo)}
            </Badge>
          ) : null
        }
      >
        <div className="-mx-1 px-1">
          <PolizzaEditorInline
            key={editorTitoloId}
            ref={editorRef}
            titoloId={editorTitoloId}
            compact
            onStateChange={handleEditorStateChange}
          />
        </div>
        <ErrMsg id="editor" />
      </PolizzaSection>
    ) : (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Caricamento polizza…
      </div>
    );

  const datiTab = (
    <div className="space-y-4">
      <div
        className={cn(
          "rounded-md border p-3 text-sm",
          tipo === "proroga"
            ? "border-blue-300 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200"
            : tipo === "regolazione"
              ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200"
              : "border-primary/30 bg-primary/5 text-foreground",
        )}
      >
        <strong>{tipoInfo.title}:</strong> {tipoInfo.hint}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">N° appendice *</Label>
          <Input value={numeroAppendice} readOnly disabled className="bg-muted h-9" />
        </div>
        <div>
          <Label className="text-xs">Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as AppendiceTipo)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPI_APPENDICE.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Data effetto *</Label>
          <DatePicker
            value={isoToDate(dataEffetto)}
            onChange={(d) => setDataEffetto(dateToIso(d))}
            placeholder="Scegli data"
          />
          <ErrMsg id="dataEffetto" />
        </div>
        <div>
          <Label className="text-xs">Data scadenza</Label>
          <DatePicker
            value={isoToDate(dataAppendice)}
            onChange={(d) => setDataAppendice(dateToIso(d))}
            placeholder="Opzionale"
          />
          <ErrMsg id="dataAppendice" />
        </div>
      </div>

      {tipo === "regolazione" && (
        <div>
          <Label className="text-xs">Quietanza di riferimento *</Label>
          <SearchableSelect
            options={quietanzaOptions}
            value={quietanzaId}
            onValueChange={setQuietanzaId}
            placeholder="Scegli la rata su cui agganciare la regolazione…"
            emptyText="Nessuna quietanza disponibile"
            className={cn(errors.quietanzaId && errClass)}
          />
          <ErrMsg id="quietanzaId" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Oggetto</Label>
          <Input
            value={oggetto}
            onChange={(e) => setOggetto(e.target.value)}
            className="h-9"
            placeholder={
              tipo === "proroga"
                ? "Es. Proroga al 31/12/2027"
                : tipo === "regolazione"
                  ? "Es. Conguaglio premio 2026"
                  : "Es. Variazione massimali"
            }
          />
        </div>
        <div>
          <OperazioneAllegatoField
            file={file}
            displayName={displayName}
            onFileChange={(f, name) => {
              setFile(f);
              setDisplayName(name);
            }}
            onDisplayNameChange={setDisplayName}
            label="Allegato (opzionale)"
            id="appendice-allegato"
          />
        </div>
      </div>

      <Collapsible open={noteOpen} onOpenChange={setNoteOpen}>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground">
            <ChevronDown className={cn("h-4 w-4 mr-1 transition-transform", noteOpen && "rotate-180")} />
            Note interne (opzionale)
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Annotazioni visibili solo in backoffice" />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );

  return (
    <OperazionePolizzaDialogShell
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={`Nuova appendice — Polizza ${numeroTitolo || ""}`}
      body={
        <div className="space-y-5">
          {datiTab}
          <div className="border-t pt-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Composizione premi</div>
            {editorBlock}
          </div>
          {aggregated && <PremiRiepilogo aggregated={aggregated} percProvv={percProvv} />}
          {aggregated && Number(aggregated.premio_lordo) < -0.009 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
              <strong>Appendice a credito.</strong> Alla messa a cassa verrà creato un acconto cliente
              di {fmt(Math.abs(Number(aggregated.premio_lordo)))} utilizzabile sulle quietanze successive
              o segnabile come rimborsato.
            </div>
          )}
        </div>
      }
      footerStart={
        aggregated ? (
          <span className="text-muted-foreground">
            Lordo:{" "}
            <strong className="text-foreground tabular-nums">{fmt(aggregated.premio_lordo)}</strong>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Compila i premi qui sotto</span>
        )
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Annulla
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !titoloId || hasErrors}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crea {tipoInfo.suffix} e appendice
          </Button>
        </>
      }
    />
  );
}
