import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { clearDraft } from "@/hooks/useDraftPersistence";
import {
  LEGACY_LOCAL_DRAFT_KEY,
  createWizardFormDefaults,
  hydrateWizardFromSinistroBozza,
  serializeBozzaWizardJson,
  shouldStartCleanWizard,
  type WizardDocumentEntry,
  type WizardStep,
} from "@/lib/sinistroAperturaDraft";import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SearchableSelect } from "@/components/SearchableSelect";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { FilePlus, Search, ArrowLeft, ArrowRight, Trash2, Upload, FileText, CheckCircle2, AlertTriangle, AlertCircle, Save } from "lucide-react";import { format } from "date-fns";
import { formatTipoSinistro } from "@/lib/tipiSinistro";
import { Checkbox } from "@/components/ui/checkbox";
import SinistroPraticaFormFields from "@/components/sinistri/SinistroPraticaFormFields";
import {
  sinistroPraticaSchema,
  praticaValuesToDbPayload,
  validateTipoSinistro,
} from "@/lib/sinistroPraticaSchema";
import { fetchPolizzeForCliente } from "@/lib/polizzeSearch";
import SinistroTerziPolizzaFields from "@/components/sinistri/SinistroTerziPolizzaFields";
import { terziPolizzaToDbPayload, validateSinistroTerziObbligatori } from "@/lib/sinistroTerziPolizza";
import type { SinistroPrescrizioneDraft, SinistroReminderDraft } from "@/lib/sinistroPrescrizioniReminder";
import {
  DESTINATARIO_LABEL,
  PRESCRIZIONE_ANNI_DEFAULT,
  PRESCRIZIONE_ANNI_OPTIONS,
  PRESCRIZIONE_DESTINATARIO_AGENZIA,
  calcScadenzaPrescrizione,
  labelTerminePrescrizione,
  normalizePrescrizioneAnni,
  type PrescrizioneAnni,
} from "@/lib/sinistroPrescrizioniReminder";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resolveClienteNome } from "@/lib/ecClienteAnagrafica";
import { fetchClientiSearch } from "@/hooks/useClienteSearch";
import {
  buildPolizzaSelectOption,
  formatPolizzaCompagnia,
  formatPolizzaGaranzia,
  formatPolizzaPeriodo,
  formatPolizzaProdotto,
} from "@/lib/titoliDisplay";
import { labelAgenziaRiferimento } from "@/lib/compagniaDisplay";
import { formatEdgeFunctionError } from "@/lib/edgeFunctionError";
import {
  documentUploadTooLargeMessage,
  isDocumentUploadTooLarge,
  MAX_DOCUMENT_UPLOAD_MB,
} from "@/lib/uploadLimits";

const wizardSchema = sinistroPraticaSchema.extend({
  titolo_id: z.string().optional(),
  sinistro_terzi: z.boolean().optional(),
  numero_polizza: z.string().optional(),
  compagnia_id: z.string().optional(),
  ramo_sinistro: z.string().optional(),
  prodotto_sinistro: z.string().optional(),
  ufficio_id: z.string().optional(),
  documenti: z.array(
    z.object({
      nome_file: z.string(),
      path_temp: z.string().optional(),
      categoria: z.string().optional(),
      descrizione: z.string().optional(),
      file_base64: z.string().optional(),
      saved: z.boolean().optional(),
      doc_id: z.string().optional(),
      path_storage: z.string().optional(),
    })
  ).optional(),
});
type WizardFormValues = z.infer<typeof wizardSchema>;

export default function SinistroAperturaWizardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const bozzaIdParam = searchParams.get("bozza_id");
  const preselectedClienteId = searchParams.get("cliente_id");

  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [wizardReady, setWizardReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingBozza, setSavingBozza] = useState(false);
  const [dbBozzaId, setDbBozzaId] = useState<string | null>(bozzaIdParam);
  const [dbBozzaNumero, setDbBozzaNumero] = useState<string | null>(null);  
  // Polizza selezionata (visualizzazione)
  const [selectedPolizzaData, setSelectedPolizzaData] = useState<any>(null);
  const [preselectedCliente, setPreselectedCliente] = useState<any>(null);

  // Stato ricerca polizze (Step 1)
  const [polizzaSearchText, setPolizzaSearchText] = useState("");
  const [polizzeList, setPolizzeList] = useState<any[]>([]);
  const [polizzeLoading, setPolizzeLoading] = useState(false);
  const [soloMadri, setSoloMadri] = useState(true);

  // Stato ricerca cliente (Step 1)
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [selectedClienteData, setSelectedClienteData] = useState<any>(null);
  const [clientiSearchText, setClientiSearchText] = useState("");
  const [clientiList, setClientiList] = useState<any[]>([]);
  const [clientiLoading, setClientiLoading] = useState(false);

  // Bozze prescrizioni/reminder opzionali (Step 4)
  const [prescrizioniDrafts, setPrescrizioniDrafts] = useState<SinistroPrescrizioneDraft[]>([]);
  const [anniPrescrizione, setAnniPrescrizione] = useState<PrescrizioneAnni>(PRESCRIZIONE_ANNI_DEFAULT);
  const [reminderDrafts, setReminderDrafts] = useState<SinistroReminderDraft[]>([]);
  const [prescDraftForm, setPrescDraftForm] = useState<SinistroPrescrizioneDraft>({
    destinatario_tipo: PRESCRIZIONE_DESTINATARIO_AGENZIA,
    oggetto: "",
    data_scadenza_risposta: "",
  });
  const [reminderDraftForm, setReminderDraftForm] = useState<SinistroReminderDraft>({ testo: "", data_scadenza: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** File originali in memoria (submit affidabile anche se la bozza omette base64). */
  const pendingFilesRef = useRef<Map<string, File>>(new Map());
  /** Evita reload DB subito dopo salvataggio bozza (setSearchParams → useEffect). */
  const skipBozzaHydrateRef = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const { register, control, handleSubmit, setValue, getValues, watch, trigger, reset, formState: { errors } } = useForm<WizardFormValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: createWizardFormDefaults(),
  });

  const resetWizardState = useCallback(() => {
    reset(createWizardFormDefaults());
    setCurrentStep(1);
    setSelectedPolizzaData(null);
    setPreselectedCliente(null);
    setSelectedClienteId(null);
    setSelectedClienteData(null);
    setPolizzaSearchText("");
    setPolizzeList([]);
    setPolizzeLoading(false);
    setSoloMadri(true);
    setClientiSearchText("");
    setClientiList([]);
    setClientiLoading(false);
    setPrescrizioniDrafts([]);
    setAnniPrescrizione(PRESCRIZIONE_ANNI_DEFAULT);
    setReminderDrafts([]);
    setPrescDraftForm({
      destinatario_tipo: PRESCRIZIONE_DESTINATARIO_AGENZIA,
      oggetto: "",
      data_scadenza_risposta: "",
    });
    setReminderDraftForm({ testo: "", data_scadenza: "" });
    pendingFilesRef.current.forEach((_, pathTemp) => URL.revokeObjectURL(pathTemp));
    pendingFilesRef.current.clear();
    setDbBozzaId(null);
    setDbBozzaNumero(null);
  }, [reset]);
  // Carica polizze (titoli + CGA) per un cliente
  const loadPolizzeForCliente = async (clienteId: string, opts?: { soloMadri?: boolean }) => {
    const onlyMothers = opts?.soloMadri ?? soloMadri;
    setPolizzeLoading(true);
    try {
      const merged = await fetchPolizzeForCliente(clienteId, { soloMadri: onlyMothers });
      setPolizzeList(merged);
    } finally {
      setPolizzeLoading(false);
    }
  };

  useEffect(() => {
    if (!preselectedClienteId || bozzaIdParam) return;
    supabase.from('clienti')
        .select('id, cognome, nome, ragione_sociale, tipo_cliente, codice_fiscale, partita_iva')
        .eq('id', preselectedClienteId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setPreselectedCliente(data);
            setSelectedClienteId(data.id);
            setSelectedClienteData(data);
          }
        });
      loadPolizzeForCliente(preselectedClienteId);
  }, [preselectedClienteId, bozzaIdParam]);

  // Ricerca clienti (debounced) — Step 1
  useEffect(() => {
    const raw = clientiSearchText.trim();
    if (!raw) { setClientiList([]); setClientiLoading(false); return; }
    // sanifica: rimuovi caratteri che romperebbero la sintassi .or() di PostgREST
    const q = raw.replace(/[,()]/g, ' ').trim();
    if (!q) { setClientiList([]); setClientiLoading(false); return; }
    setClientiLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await fetchClientiSearch(q, { onlyAttivi: false, limit: 25 });
        setClientiList(data || []);
      } catch (error) {
        console.error('Ricerca clienti error:', error);
        setClientiList([]);
      }
      setClientiLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [clientiSearchText]);



  const selezionaCliente = (c: any) => {
    setSelectedClienteId(c.id);
    setSelectedClienteData(c);
    setSelectedPolizzaData(null);
    setValue('titolo_id', '');
    setPolizzaSearchText('');
    loadPolizzeForCliente(c.id);
  };

  const resetCliente = () => {
    setSelectedClienteId(null);
    setSelectedClienteData(null);
    setSelectedPolizzaData(null);
    setValue('titolo_id', '');
    setPolizzeList([]);
    setPolizzaSearchText('');
    setClientiSearchText('');
  };


  const { fields: docFields, append: appendDoc, remove: removeDoc } = useFieldArray({
    control,
    name: "documenti"
  });

  const watchTitoloId = watch("titolo_id");
  const watchSinistroTerzi = watch("sinistro_terzi");
  const watchDocumenti = watch("documenti");

  const loadDbBozza = useCallback(async (id: string) => {
    const { data: row, error } = await supabase
      .from("sinistri")
      .select("*")
      .eq("id", id)
      .eq("stato", "bozza")
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Bozza non trovata o già finalizzata");

    const { data: docs } = await supabase
      .from("documenti")
      .select("id, nome_file, path_storage, categoria")
      .eq("entita_tipo", "sinistro")
      .eq("entita_id", id);

    const hydrated = hydrateWizardFromSinistroBozza(
      row,
      ((docs || []) as Array<{ id: string; nome_file: string; path_storage: string; categoria: string | null }>).map((d) => ({
        ...d,
        descrizione: null,
      })),
    );
    reset(hydrated.formValues);
    setCurrentStep(hydrated.ui.currentStep);
    setSoloMadri(hydrated.ui.soloMadri);
    setPrescrizioniDrafts(hydrated.ui.prescrizioniDrafts);
    setAnniPrescrizione(hydrated.ui.anniPrescrizione);
    setReminderDrafts(hydrated.ui.reminderDrafts);
    setDbBozzaId(row.id);
    setDbBozzaNumero(row.numero_sinistro);

    if (hydrated.ui.selectedClienteId) {
      const { data: cliente } = await supabase
        .from("clienti")
        .select("id, cognome, nome, ragione_sociale, tipo_cliente, codice_fiscale, partita_iva")
        .eq("id", hydrated.ui.selectedClienteId)
        .maybeSingle();
      if (cliente) {
        setSelectedClienteId(cliente.id);
        setSelectedClienteData(cliente);
        await loadPolizzeForCliente(cliente.id, { soloMadri: hydrated.ui.soloMadri });
      }
    }

    if (!row.sinistro_terzi && row.titolo_id) {
      const { data: polizza } = await supabase.from("titoli").select(`
          id, numero_titolo, premio_lordo, stato, created_at, cliente_anagrafica_id, ufficio_id, compagnia_id, prodotto_nome, data_competenza, data_scadenza, garanzia_da, garanzia_a,
          compagnia_diretta:compagnie!titoli_compagnia_id_fkey(id, nome),
          prodotti(nome_prodotto, compagnie(id, nome)),
          ramo:rami!titoli_ramo_id_fkey(id, codice, descrizione, gruppo_ramo:gruppi_ramo!rami_gruppo_ramo_id_fkey(id, codice, descrizione)),
          clienti!titoli_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale, tipo_cliente)
        `).eq("id", row.titolo_id).maybeSingle();
      if (polizza) setSelectedPolizzaData(polizza);
    }
  }, [reset, soloMadri]);

  // Inizializzazione wizard: bozza DB esplicita, cliente preselezionato, oppure reset pulito
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      clearDraft(LEGACY_LOCAL_DRAFT_KEY);

      if (bozzaIdParam) {
        if (skipBozzaHydrateRef.current === bozzaIdParam) {
          skipBozzaHydrateRef.current = null;
          if (!cancelled) setWizardReady(true);
          return;
        }
        try {
          await loadDbBozza(bozzaIdParam);
          if (!cancelled) toast.success("Bozza caricata — Riprendi bozza");
        } catch (err: unknown) {
          if (!cancelled) {
            toast.error(err instanceof Error ? err.message : "Impossibile caricare la bozza");
            resetWizardState();
          }
        } finally {
          if (!cancelled) setWizardReady(true);
        }
        return;
      }

      if (shouldStartCleanWizard({ bozzaId: null, clienteId: preselectedClienteId })) {
        resetWizardState();
      }

      setWizardReady(true);
    };

    init();
    return () => { cancelled = true; };
  }, [bozzaIdParam, preselectedClienteId, loadDbBozza, resetWizardState]);

  const setSinistroTerzi = (attivo: boolean) => {
    setValue("sinistro_terzi", attivo);
    if (attivo) {
      setSelectedPolizzaData(null);
      setValue("titolo_id", "");
      setPolizzaSearchText("");
    }
  };

  // Query per lookup responsabili interni: Specialist Sinistri se configurati, altrimenti tutti i profili attivi
  const { data: responsabiliList = [] } = useQuery({
    queryKey: ["profiles-responsabili-wizard"],
    queryFn: async () => {
      const { data: ss } = await supabase
        .from("specialist_sinistri_sedi" as any)
        .select("profilo_id");
      const ids = [...new Set(((ss || []) as unknown as { profilo_id: string }[]).map((r) => r.profilo_id))];
      let q = supabase.from("profiles").select("id, nome, cognome, ruolo").eq("attivo", true).order("cognome");
      if (ids.length > 0) q = q.in("id", ids);
      const { data } = await q;
      return data || [];
    }
  });

  // Query per liquidatori da anagrafiche_professionali (Step 4)
  const { data: liquidatoriList = [] } = useQuery({
    queryKey: ["anagrafiche-liquidatori-wizard"],
    queryFn: async () => {
      const { data } = await supabase.from("anagrafiche_professionali").select("id, nome, cognome, ragione_sociale").eq("tipo", "liquidatore").eq("attivo", true).order("cognome");
      return data || [];
    }
  });

  // (ricerca polizze globale rimossa: ora le polizze derivano dal cliente selezionato)



  // Gestione caricamento file (Step 3)
  const processUploadedFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    let queued = 0;
    let completed = 0;

    list.forEach((file) => {
      if (isDocumentUploadTooLarge(file.size)) {
        toast.error(`${file.name}: ${documentUploadTooLargeMessage()}`);
        return;
      }

      queued += 1;
      const pathTemp = URL.createObjectURL(file);
      pendingFilesRef.current.set(pathTemp, file);

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Content = event.target?.result as string;
        appendDoc({
          nome_file: file.name,
          path_temp: pathTemp,
          categoria: "",
          descrizione: "",
          file_base64: base64Content,
        });
        completed += 1;
        if (completed === queued) {
          toast.success(queued === 1 ? `File "${file.name}" aggiunto` : `${queued} file aggiunti`);
        }
      };
      reader.onerror = () => {
        URL.revokeObjectURL(pathTemp);
        pendingFilesRef.current.delete(pathTemp);
        toast.error(`Impossibile leggere il file "${file.name}"`);
        completed += 1;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      processUploadedFiles(e.target.files);
    }
    e.target.value = "";
  };

  const handleRemoveDocumento = async (idx: number) => {
    const doc = getValues(`documenti.${idx}`) as WizardDocumentEntry | undefined;
    if (doc?.saved && doc.doc_id) {
      if (doc.path_storage) {
        await supabase.storage.from("documenti_sinistri").remove([doc.path_storage]);
      }
      await supabase.from("documenti").delete().eq("id", doc.doc_id);
    }
    const pathTemp = doc?.path_temp;
    if (pathTemp) {
      URL.revokeObjectURL(pathTemp);
      pendingFilesRef.current.delete(pathTemp);
    }
    removeDoc(idx);
  };

  const base64ToBlob = (base64Content: string, fallbackName: string) => {
    const mimeMatch = base64Content.match(/^data:([^;]+);/);
    const mimeType = mimeMatch?.[1] || "application/octet-stream";
    const base64Data = base64Content.split(",")[1];
    if (!base64Data) throw new Error(`Contenuto non valido per ${fallbackName}`);
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
  };

  // Commit eventuale digitazione DateInput ancora in focus prima della validazione step
  const commitFocusedField = async () => {
    const el = document.activeElement;
    if (el instanceof HTMLElement && el !== document.body) {
      el.blur();
      // Attendi handler blur (DateInput → RHF) prima di trigger
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    }
  };

  // Funzione per validare ed avanzare negli step
  const handleNextStep = async () => {
    await commitFocusedField();

    let fieldsToValidate: any[] = [];
    if (currentStep === 1) {
      if (!selectedClienteId) {
        toast.error("Seleziona un cliente per proseguire");
        return;
      }
      fieldsToValidate = ["data_evento"];
      if (getValues("sinistro_terzi")) {
        const terziErr = validateSinistroTerziObbligatori(getValues());
        if (terziErr) {
          toast.error(terziErr);
          return;
        }
      }
    } else if (currentStep === 2) {
      fieldsToValidate = ["data_denuncia", "descrizione", "importo_riserva"];
      const tipoErr = validateTipoSinistro(getValues("tipo_sinistro"), getValues("tipo_sinistro_personalizzato"));
      if (tipoErr) {
        toast.error(tipoErr);
        return;
      }
    } else if (currentStep === 3) {
      // Step facoltativo: nessun blocco sui documenti in bozza
      fieldsToValidate = [];
    }


    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      setCurrentStep((prev) => (prev + 1) as any);
    } else {
      toast.error("Controlla i campi obbligatori o con errori");
    }
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => (prev - 1) as any);
  };

  const buildSinistroContext = (values: WizardFormValues) => {
    const isTerzi = !!values.sinistro_terzi;
    const terziPayload = isTerzi ? terziPolizzaToDbPayload(values) : null;
    const compagniaId = isTerzi
      ? terziPayload?.compagnia_id ?? null
      : (selectedPolizzaData?.compagnia_id ||
        selectedPolizzaData?.prodotti?.compagnie?.id ||
        null);
    const clienteAnagraficaId = selectedClienteId || selectedPolizzaData?.cliente_anagrafica_id || null;
    const ufficioId = isTerzi
      ? terziPayload?.ufficio_id ?? null
      : (selectedPolizzaData?.ufficio_id || null);
    const titoloId =
      !isTerzi && values.titolo_id && !values.titolo_id.startsWith("cga:")
        ? values.titolo_id
        : null;
    return { isTerzi, compagniaId, clienteAnagraficaId, ufficioId, titoloId, terziPayload };
  };

  /** Reminder già in lista + quello compilato ma non ancora aggiunto. */
  const reminderDaSalvare = (): SinistroReminderDraft[] => {
    const testo = reminderDraftForm.testo.trim();
    const data = reminderDraftForm.data_scadenza?.trim();
    if (testo && data) {
      return [...reminderDrafts, { ...reminderDraftForm, testo, data_scadenza: data }];
    }
    return reminderDrafts;
  };

  const buildBozzaWizardJsonPayload = (values: WizardFormValues) =>
    serializeBozzaWizardJson({
      currentStep,
      sinistro_terzi: !!values.sinistro_terzi,
      soloMadri,
      prescrizioniDrafts,
      reminderDrafts: reminderDaSalvare(),
      anniPrescrizione,
    });

  const uploadPendingDocuments = async (
    sinistroId: string,
    documenti: WizardDocumentEntry[] | undefined,
    userId: string,
  ) => {
    for (const doc of documenti ?? []) {
      if (doc.saved) continue;

      const pendingFile = doc.path_temp ? pendingFilesRef.current.get(doc.path_temp) : undefined;
      const blob = pendingFile ?? (doc.file_base64 ? base64ToBlob(doc.file_base64, doc.nome_file) : null);
      if (!blob) {
        throw new Error(`File "${doc.nome_file}" non disponibile: ricaricalo nello step Documenti`);
      }

      const storagePath = `sinistro/${sinistroId}/${Date.now()}_${doc.nome_file}`;
      const { error: uploadErr } = await supabase.storage
        .from("documenti_sinistri")
        .upload(storagePath, blob, {
          contentType: pendingFile?.type || blob.type || "application/octet-stream",
        });
      if (uploadErr) throw uploadErr;

      const { error: docDbErr } = await supabase.from("documenti").insert({
        nome_file: doc.nome_file,
        path_storage: storagePath,
        bucket_name: "documenti_sinistri",
        entita_tipo: "sinistro",
        entita_id: sinistroId,
        caricato_da: userId,
        categoria: doc.categoria?.trim() || null,
      });
      if (docDbErr) throw docDbErr;

      if (doc.path_temp) {
        URL.revokeObjectURL(doc.path_temp);
        pendingFilesRef.current.delete(doc.path_temp);
      }
    }
  };

  const handleSalvaBozza = async () => {
    await commitFocusedField();
    const values = getValues();
    const { isTerzi, compagniaId, clienteAnagraficaId, ufficioId, titoloId, terziPayload } = buildSinistroContext(values);

    if (!clienteAnagraficaId) {
      toast.error("Seleziona un cliente prima di salvare la bozza");
      setCurrentStep(1);
      return;
    }

    setSavingBozza(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non autenticato");

      const praticaPayload = praticaValuesToDbPayload(values, { persistNoteImportanti: false });
      const bozzaWizardJson = buildBozzaWizardJsonPayload(values);
      let sinistroId = dbBozzaId;
      const isUpdate = !!sinistroId;

      if (sinistroId) {
        const { data: invokeRes, error: invokeErr } = await supabase.functions.invoke("gestione-sinistri", {
          body: {
            azione: "aggiorna",
            sinistro_id: sinistroId,
            user_id: user.id,
            sinistro_terzi: isTerzi,
            titolo_id: titoloId,
            ...(isTerzi && terziPayload ? terziPayload : {
              ...(compagniaId ? { compagnia_id: compagniaId } : {}),
              ...(ufficioId ? { ufficio_id: ufficioId } : {}),
            }),
            ...praticaPayload,
            bozza_wizard_json: bozzaWizardJson,
          },
        });
        if (invokeErr || !invokeRes?.success) {
          throw new Error(formatEdgeFunctionError(invokeErr, invokeRes));
        }
      } else {
        const { data: invokeRes, error: invokeErr } = await supabase.functions.invoke("gestione-sinistri", {
          body: {
            azione: "crea",
            sinistro_terzi: isTerzi,
            titolo_id: titoloId,
            cliente_anagrafica_id: clienteAnagraficaId,
            ...(isTerzi && terziPayload ? terziPayload : {
              ...(compagniaId ? { compagnia_id: compagniaId } : {}),
              ...(ufficioId ? { ufficio_id: ufficioId } : {}),
            }),
            ...praticaPayload,
            user_id: user.id,
            stato_iniziale: "bozza",
            bozza_wizard_json: bozzaWizardJson,
          },
        });
        if (invokeErr || !invokeRes?.success) {
          throw new Error(formatEdgeFunctionError(invokeErr, invokeRes));
        }
        const created = invokeRes.sinistro as { id: string; numero_sinistro: string };
        sinistroId = created.id;
        setDbBozzaId(created.id);
        setDbBozzaNumero(created.numero_sinistro);
        skipBozzaHydrateRef.current = created.id;
        setSearchParams({ bozza_id: created.id }, { replace: true });
      }

      await uploadPendingDocuments(sinistroId!, values.documenti as WizardDocumentEntry[] | undefined, user.id);
      qc.invalidateQueries({ queryKey: ["sinistri"] });
      toast.success(isUpdate ? "Bozza aggiornata" : "Bozza salvata — puoi riprenderla dalla lista sinistri");
    } catch (err: unknown) {
      toast.error("Errore salvataggio bozza: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingBozza(false);
    }
  };

  const handleAnnulla = async () => {
    clearDraft(LEGACY_LOCAL_DRAFT_KEY);
    if (dbBozzaId) {
      await supabase.from("sinistri").delete().eq("id", dbBozzaId).eq("stato", "bozza");
      qc.invalidateQueries({ queryKey: ["sinistri"] });
    }
    resetWizardState();
    toast.info(dbBozzaId ? "Bozza eliminata" : "Apertura sinistro annullata");
    navigate("/sinistri");
  };

  // Salvataggio finale del sinistro (Step 5)
  const onSubmitForm = async (values: WizardFormValues) => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non autenticato");

      const { isTerzi, compagniaId, clienteAnagraficaId, ufficioId, titoloId, terziPayload } = buildSinistroContext(values);

      if (!clienteAnagraficaId) {
        throw new Error("Cliente non selezionato");
      }
      if (isTerzi) {
        const terziErr = validateSinistroTerziObbligatori(values);
        if (terziErr) {
          toast.error(terziErr);
          setCurrentStep(1);
          setSubmitting(false);
          return;
        }
      }

      const praticaPayload = praticaValuesToDbPayload(values);
      const reminderIniziali = reminderDaSalvare();
      let newSinistro: { id: string; numero_sinistro: string };

      if (dbBozzaId) {
        const { data: invokeRes, error: invokeErr } = await supabase.functions.invoke("gestione-sinistri", {
          body: {
            azione: "finalizza_bozza",
            sinistro_id: dbBozzaId,
            user_id: user.id,
            sinistro_terzi: isTerzi,
            titolo_id: titoloId,
            cliente_anagrafica_id: clienteAnagraficaId,
            ...(isTerzi && terziPayload ? terziPayload : {
              ...(compagniaId ? { compagnia_id: compagniaId } : {}),
              ...(ufficioId ? { ufficio_id: ufficioId } : {}),
            }),
            ...praticaPayload,
            anni_prescrizione: anniPrescrizione,
            ...(prescrizioniDrafts.length > 0 ? { prescrizioni_iniziali: prescrizioniDrafts } : {}),
            ...(reminderIniziali.length > 0 ? { reminder_iniziali: reminderIniziali } : {}),
          },
        });
        if (invokeErr || !invokeRes?.success) {
          throw new Error(formatEdgeFunctionError(invokeErr, invokeRes));
        }
        newSinistro = invokeRes.sinistro as { id: string; numero_sinistro: string };
      } else {
        const { data: invokeRes, error: invokeErr } = await supabase.functions.invoke("gestione-sinistri", {
          body: {
            azione: "crea",
            sinistro_terzi: isTerzi,
            titolo_id: titoloId,
            cliente_anagrafica_id: clienteAnagraficaId,
            ...(isTerzi && terziPayload ? terziPayload : {
              ...(compagniaId ? { compagnia_id: compagniaId } : {}),
              ...(ufficioId ? { ufficio_id: ufficioId } : {}),
            }),
            ...praticaPayload,
            user_id: user.id,
            stato_iniziale: "aperto",
            anni_prescrizione: anniPrescrizione,
            ...(prescrizioniDrafts.length > 0 ? { prescrizioni_iniziali: prescrizioniDrafts } : {}),
            ...(reminderIniziali.length > 0 ? { reminder_iniziali: reminderIniziali } : {}),
          },
        });
        if (invokeErr || !invokeRes?.success) {
          throw new Error(formatEdgeFunctionError(invokeErr, invokeRes));
        }
        newSinistro = invokeRes.sinistro as { id: string; numero_sinistro: string };
      }

      await uploadPendingDocuments(newSinistro.id, values.documenti as WizardDocumentEntry[] | undefined, user.id);

      clearDraft(LEGACY_LOCAL_DRAFT_KEY);
      qc.invalidateQueries({ queryKey: ["sinistri"] });
      toast.success(`Sinistro ${newSinistro.numero_sinistro} aperto con successo!`);
      navigate(`/sinistri/${newSinistro.id}`);
    } catch (err: unknown) {
      toast.error("Errore durante l'apertura del sinistro: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {!wizardReady ? (
        <div className="py-16 text-center text-muted-foreground">Caricamento wizard...</div>
      ) : (
      <>
      {/* Header coerente con design system (icona arancio rotonda) */}
      <div className="flex items-center justify-between pb-4 border-b gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2 flex-wrap">
              {watchSinistroTerzi ? "Apertura Sinistro Terzi" : "Apertura Nuovo Sinistro"}
              {dbBozzaId && (
                <Badge variant="outline" className="border-slate-400 text-slate-700 bg-slate-50 font-normal">
                  Bozza{dbBozzaNumero ? ` · ${dbBozzaNumero}` : ""}
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              {watchSinistroTerzi
                ? "Procedura guidata per sinistro senza polizza CBnet"
                : "Procedura guidata per l'apertura di un sinistro su polizza attiva"}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCancelDialogOpen(true)} className="text-destructive border-destructive hover:bg-destructive/10">
          Annulla apertura
        </Button>
      </div>


      {/* Barra di Progresso — sticky sotto la topbar globale */}
      <div className="sticky top-14 z-10 -mx-3 sm:-mx-6 px-3 sm:px-6 py-3 bg-background border-b border-border/60">
        <div className="relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-muted -translate-y-1/2" />
          <div
            className="absolute top-1/2 left-0 h-0.5 bg-primary -translate-y-1/2 transition-all duration-300"
            style={{ width: `${((currentStep - 1) / 4) * 100}%` }}
          />
          <div className="relative flex justify-between">
            {[1, 2, 3, 4, 5].map((stepIndex) => {
              const reachable = stepIndex <= currentStep;
              return (
                <button
                  key={stepIndex}
                  type="button"
                  disabled={!reachable}
                  onClick={() => {
                    if (stepIndex < currentStep) setCurrentStep(stepIndex as WizardStep);
                  }}
                  className={`flex flex-col items-center bg-transparent ${
                    reachable && stepIndex < currentStep ? "cursor-pointer" : reachable ? "cursor-default" : "cursor-not-allowed"
                  }`}
                  aria-current={currentStep === stepIndex ? "step" : undefined}
                  aria-label={`Step ${stepIndex}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs border-2 z-10 transition-all ${
                      currentStep === stepIndex
                        ? "bg-primary border-primary text-primary-foreground shadow-md ring-4 ring-primary/20"
                        : currentStep > stepIndex
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-background border-muted text-muted-foreground"
                    }`}
                  >
                    {stepIndex}
                  </div>
                  <span className={`text-[10px] font-medium mt-2 hidden sm:block ${currentStep === stepIndex ? "text-primary font-bold" : "text-muted-foreground"}`}>
                    {stepIndex === 1 && (watchSinistroTerzi ? "Cliente" : "Polizza")}
                    {stepIndex === 2 && "Dati Sinistro"}
                    {stepIndex === 3 && "Documenti"}
                    {stepIndex === 4 && "Assegnazione"}
                    {stepIndex === 5 && "Riepilogo"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Corpo del Form */}
      <form onSubmit={handleSubmit(onSubmitForm)}>
        <Card className="shadow-md border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {currentStep === 1 && (watchSinistroTerzi ? "Step 1: Cliente (Sinistro Terzi)" : "Step 1: Cliente e Polizza")}
              {currentStep === 2 && "Step 2: Dettagli dell'Accadimento"}
              {currentStep === 3 && "Step 3: Documenti Iniziali"}
              {currentStep === 4 && "Step 4: Assegnazione Pratica"}
              {currentStep === 5 && "Step 5: Riepilogo e Conferma"}
            </CardTitle>
            <CardDescription>
              {currentStep === 1 && (watchSinistroTerzi
                ? "Seleziona il cliente. Nessuna polizza CBnet verrà collegata a questa pratica."
                : "Seleziona prima il cliente, poi scegli una delle sue polizze attive. La polizza è facoltativa.")}
              {currentStep === 2 && "Fornisci tutte le informazioni relative a quando, dove e come si è verificato il sinistro."}
              {currentStep === 3 && "Carica referti, foto o denunce firmate. Questo step è facoltativo."}
              {currentStep === 4 && "Assegna la pratica a un addetto interno e ad un liquidatore di riferimento."}
              {currentStep === 5 && "Verifica la correttezza di tutti i dati prima dell'apertura formale della pratica."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* STEP 1: CLIENTE + POLIZZA */}
            {currentStep === 1 && (
              <div className="space-y-6">
                {/* 1) Ricerca cliente */}
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  {selectedClienteData ? (
                    <div className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-lg border">
                      <div className="text-sm">
                        <p className="font-semibold">{resolveClienteNome(selectedClienteData)}</p>
                        <p className="text-xs text-muted-foreground">
                          {selectedClienteData.codice_fiscale || selectedClienteData.partita_iva || "—"}
                          {selectedClienteData.tipo_cliente ? ` · ${selectedClienteData.tipo_cliente}` : ""}
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={resetCliente}>
                        Cambia cliente
                      </Button>
                    </div>
                  ) : (
                    <SearchableSelect
                      options={clientiList.map((c: any) => ({
                        value: c.id,
                        label: resolveClienteNome(c) || "(senza nome)",
                        description: [c.codice_fiscale || c.partita_iva, c.tipo_cliente].filter(Boolean).join(" · "),
                        searchText: `${resolveClienteNome(c)} ${c.codice_fiscale || ""} ${c.partita_iva || ""}`,
                      }))}
                      value=""
                      onValueChange={(val) => {
                        const c = clientiList.find((x: any) => x.id === val);
                        if (c) selezionaCliente(c);
                      }}
                      placeholder="Cerca cliente per nome, cognome, ragione sociale, CF o P.IVA..."
                      searchPlaceholder="Digita almeno 2 caratteri…"
                      searchValue={clientiSearchText}
                      onSearchChange={setClientiSearchText}
                      serverSideSearch
                      emptyText={clientiLoading ? "Ricerca in corso…" : "Nessun cliente trovato."}
                      className="w-full"
                    />

                  )}
                </div>

                {/* Flag Sinistro Terzi */}
                {selectedClienteId && (
                  <label className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30 cursor-pointer select-none">
                    <Checkbox
                      checked={!!watchSinistroTerzi}
                      onCheckedChange={(c) => setSinistroTerzi(!!c)}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <span className="text-sm font-medium">Sinistro Terzi</span>
                      <p className="text-xs text-muted-foreground">
                        Sinistro gestito senza collegamento a una polizza CBnet. La selezione polizza viene disabilitata.
                      </p>
                    </div>
                  </label>
                )}

                {/* Data accadimento (obbligatoria già in step 1) */}
                {selectedClienteId && (
                  <div className="space-y-2">
                    <Label htmlFor="data_evento">Data Accadimento *</Label>
                    <Input type="date" id="data_evento" {...register("data_evento")} />
                    {errors.data_evento && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.data_evento.message}
                      </p>
                    )}
                  </div>
                )}

                {/* 2) Selezione polizza del cliente — nascosta per Sinistro Terzi */}
                {selectedClienteId && !watchSinistroTerzi && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Label>Polizza del cliente {polizzeLoading && <span className="text-xs text-muted-foreground">(caricamento...)</span>}</Label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                        <Checkbox
                          checked={soloMadri}
                          onCheckedChange={(c) => {
                            const v = !!c;
                            setSoloMadri(v);
                            if (selectedClienteId) loadPolizzeForCliente(selectedClienteId, { soloMadri: v });
                          }}
                        />
                        <span>{soloMadri ? "Solo madri" : "Tutte le polizze (incluse quietanze)"}</span>
                      </label>
                    </div>
                    {polizzeList.length === 0 && !polizzeLoading ? (
                      <p className="text-sm text-muted-foreground p-3 border rounded-lg bg-muted/30">
                        Nessuna polizza trovata per questo cliente. Puoi proseguire senza collegare una polizza.
                      </p>
                    ) : (
                      <SearchableSelect
                        options={polizzeList.map((p: any) => buildPolizzaSelectOption(p))}
                        value={watchTitoloId ?? ""}
                        onValueChange={(val) => {
                          if (!val) {
                            setSelectedPolizzaData(null);
                            setValue("titolo_id", "");
                            return;
                          }
                          const selected = polizzeList.find((p: any) => p.id === val);
                          if (selected) {
                            setSelectedPolizzaData({ ...selected, clienti: selectedClienteData });
                            setValue("titolo_id", selected.id);
                          }
                        }}
                        placeholder="Seleziona una polizza del cliente..."
                        searchValue={polizzaSearchText}
                        onSearchChange={setPolizzaSearchText}
                        clearable={true}
                        clearLabel="— Nessuna Polizza —"
                        className="w-full"
                        showSelectedDescription
                      />
                    )}
                  </div>
                )}

                {watchSinistroTerzi && selectedClienteId && (
                  <SinistroTerziPolizzaFields
                    numeroPolizza={watch("numero_polizza") || ""}
                    compagniaId={watch("compagnia_id") || ""}
                    ramoSinistro={watch("ramo_sinistro") || ""}
                    prodottoSinistro={watch("prodotto_sinistro") || ""}
                    ufficioId={watch("ufficio_id") || ""}
                    onChange={(patch) => {
                      if (patch.numero_polizza !== undefined) setValue("numero_polizza", patch.numero_polizza);
                      if (patch.compagnia_id !== undefined) setValue("compagnia_id", patch.compagnia_id);
                      if (patch.ramo_sinistro !== undefined) setValue("ramo_sinistro", patch.ramo_sinistro);
                      if (patch.prodotto_sinistro !== undefined) setValue("prodotto_sinistro", patch.prodotto_sinistro);
                      if (patch.ufficio_id !== undefined) setValue("ufficio_id", patch.ufficio_id);
                    }}
                  />
                )}

                {/* Riepilogo polizza selezionata */}
                {!watchSinistroTerzi && selectedPolizzaData && (
                  <div className="p-4 bg-muted/50 rounded-lg border space-y-2">
                    <h4 className="font-semibold text-sm text-primary">Polizza Selezionata per il Sinistro</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">Numero Polizza</span>
                        <p className="font-semibold">{selectedPolizzaData.numero_titolo}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Contraente</span>
                        <p className="font-semibold">{resolveClienteNome(selectedPolizzaData.clienti || selectedClienteData)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Prodotto</span>
                        <p className="font-semibold">{formatPolizzaProdotto(selectedPolizzaData)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Garanzia</span>
                        <p className="font-semibold">{formatPolizzaGaranzia(selectedPolizzaData)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Compagnia</span>
                        <p className="font-semibold">{formatPolizzaCompagnia(selectedPolizzaData)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Periodo garanzia</span>
                        <p className="font-semibold">{formatPolizzaPeriodo(selectedPolizzaData)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Stato Polizza</span>
                        <p className="font-semibold capitalize"><Badge variant="outline">{selectedPolizzaData.stato}</Badge></p>
                      </div>
                    </div>
                  </div>
                )}

                {errors.titolo_id && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" /> {errors.titolo_id.message}
                  </p>
                )}
              </div>
            )}


            {/* STEP 2: DATI SINISTRO */}
            {currentStep === 2 && (
              <SinistroPraticaFormFields
                register={register}
                setValue={setValue}
                watch={watch}
                errors={errors}
                showDataEvento={false}
              />
            )}

            {/* STEP 3: DOCUMENTI INIZIALI */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                    dragOver
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/30 hover:bg-muted/10"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files?.length) {
                      processUploadedFiles(e.dataTransfer.files);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Trascina qui i tuoi documenti o clicca per sfogliare</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    PDF e immagini (JPG, PNG) — max {MAX_DOCUMENT_UPLOAD_MB} MB per file
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload-input"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    Seleziona File
                  </Button>
                </div>

                {watchDocumenti && watchDocumenti.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">File Caricati Temporaneamente:</h4>
                    <div className="space-y-3">
                      {docFields.map((field, idx) => (
                        <div key={field.id} className="p-3 border rounded-lg flex flex-col md:flex-row gap-3 items-start md:items-center bg-card shadow-sm">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <FileText className="h-5 w-5 text-primary shrink-0" />
                            <span className="text-xs font-semibold truncate" title={field.nome_file}>{field.nome_file}</span>
                            {watch(`documenti.${idx}.saved`) && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">Salvato</Badge>
                            )}
                          </div>
                          <div className="w-full md:flex-1">
                            <Input 
                              placeholder="Breve descrizione..." 
                              className="h-8 text-xs" 
                              {...register(`documenti.${idx}.descrizione`)}
                            />
                          </div>
                          <Button 
                            type="button" 
                            size="icon" 
                            variant="ghost" 
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() => handleRemoveDocumento(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: ASSEGNAZIONE */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <SinistroPraticaFormFields
                  register={register}
                  setValue={setValue}
                  watch={watch}
                  errors={errors}
                  responsabiliList={responsabiliList}
                  liquidatoriList={liquidatoriList}
                  showEvento={false}
                  showAssegnazione
                  showNoteInterne
                />

                {/* Prescrizione legale automatica + extra opzionali */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-primary">Prescrizioni perentorie (opzionale)</h4>
                  <p className="text-xs text-muted-foreground">
                    All&apos;apertura viene creata automaticamente la prescrizione verso l&apos;agenzia di riferimento
                    della polizza. La scadenza è la data di accadimento più gli anni scelti (default 2).
                    Qui puoi aggiungere altre comunicazioni con scadenza.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Termine di prescrizione</Label>
                      <Select
                        value={String(anniPrescrizione)}
                        onValueChange={(v) => setAnniPrescrizione(normalizePrescrizioneAnni(v))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Anni" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRESCRIZIONE_ANNI_OPTIONS.map((anni) => (
                            <SelectItem key={anni} value={String(anni)}>
                              {anni} {anni === 1 ? "anno" : "anni"}
                              {anni === PRESCRIZIONE_ANNI_DEFAULT ? " (default)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Data di prescrizione</Label>
                      <div className="h-9 px-3 flex items-center text-sm rounded-md border bg-muted/30">
                        {(() => {
                          const scadenza = calcScadenzaPrescrizione(watch("data_evento"), anniPrescrizione);
                          return scadenza
                            ? format(new Date(scadenza), "dd/MM/yyyy")
                            : "Inserisci prima la data di accadimento";
                        })()}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Termine {labelTerminePrescrizione(anniPrescrizione)} dalla data di accadimento.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="h-9 px-3 flex items-center text-sm rounded-md border bg-muted/30">
                      Destinatario: {DESTINATARIO_LABEL[PRESCRIZIONE_DESTINATARIO_AGENZIA]}
                    </div>
                    <Input
                      placeholder="Oggetto *"
                      className="h-9"
                      value={prescDraftForm.oggetto}
                      onChange={(e) => setPrescDraftForm({ ...prescDraftForm, oggetto: e.target.value })}
                    />
                    <Input
                      type="date"
                      className="h-9"
                      value={prescDraftForm.data_scadenza_risposta}
                      onChange={(e) => setPrescDraftForm({ ...prescDraftForm, data_scadenza_risposta: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={() => {
                        if (!prescDraftForm.oggetto.trim() || !prescDraftForm.data_scadenza_risposta) {
                          toast.error("Oggetto e scadenza sono obbligatori");
                          return;
                        }
                        setPrescrizioniDrafts([
                          ...prescrizioniDrafts,
                          {
                            ...prescDraftForm,
                            destinatario_tipo: PRESCRIZIONE_DESTINATARIO_AGENZIA,
                            destinatario_label:
                              labelAgenziaRiferimento(selectedPolizzaData) ||
                              selectedPolizzaData?.compagnie?.nome ||
                              selectedPolizzaData?.prodotti?.compagnie?.nome ||
                              prescDraftForm.destinatario_label,
                          },
                        ]);
                        setPrescDraftForm({
                          destinatario_tipo: PRESCRIZIONE_DESTINATARIO_AGENZIA,
                          oggetto: "",
                          data_scadenza_risposta: "",
                        });
                      }}
                    >
                      Aggiungi prescrizione
                    </Button>
                  </div>
                  {prescrizioniDrafts.length > 0 && (
                    <div className="space-y-1">
                      {prescrizioniDrafts.map((p, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs border rounded px-2 py-1.5">
                          <span>{DESTINATARIO_LABEL[p.destinatario_tipo]} — {p.oggetto}</span>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPrescrizioniDrafts(prescrizioniDrafts.filter((_, i) => i !== idx))}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reminder personali opzionali */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-primary">Reminder sinistro (opzionale)</h4>
                  <p className="text-xs text-muted-foreground">Promemoria assegnato al responsabile sinistro con scadenza.</p>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label htmlFor="reminder-testo">Testo *</Label>
                      <Textarea
                        id="reminder-testo"
                        rows={3}
                        placeholder="Cosa ricordare (es. richiedere perizia, richiamare il cliente…)"
                        value={reminderDraftForm.testo}
                        onChange={(e) => setReminderDraftForm({ ...reminderDraftForm, testo: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="space-y-1 w-44 shrink-0">
                        <Label htmlFor="reminder-scadenza">Scadenza *</Label>
                        <Input
                          id="reminder-scadenza"
                          type="date"
                          className="h-9"
                          value={reminderDraftForm.data_scadenza || ""}
                          onChange={(e) => setReminderDraftForm({ ...reminderDraftForm, data_scadenza: e.target.value })}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9"
                        onClick={() => {
                          if (!reminderDraftForm.testo.trim()) {
                            toast.error("Inserisci il testo del reminder");
                            return;
                          }
                          if (!reminderDraftForm.data_scadenza) {
                            toast.error("Inserisci la scadenza del reminder");
                            return;
                          }
                          setReminderDrafts([...reminderDrafts, { ...reminderDraftForm }]);
                          setReminderDraftForm({ testo: "", data_scadenza: "" });
                        }}
                      >
                        Aggiungi
                      </Button>
                    </div>
                  </div>
                  {reminderDrafts.length > 0 && (
                    <div className="space-y-1">
                      {reminderDrafts.map((r, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs border rounded px-2 py-1.5">
                          <span>{r.testo}{r.data_scadenza ? ` (${r.data_scadenza})` : ""}</span>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReminderDrafts(reminderDrafts.filter((_, i) => i !== idx))}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 5: RIEPILOGO E CONFERMA */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex gap-3 items-start">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <h4 className="font-semibold text-primary">Pronto per l'Apertura</h4>
                    <p className="text-muted-foreground mt-0.5">Rivedi i dati inseriti. Puoi cliccare su "Modifica" a destra di ogni sezione per correggere eventuali informazioni.</p>
                  </div>
                </div>

                {/* Sezione 1: Polizza / Terzi */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-2 flex justify-between items-center border-b">
                    <span className="text-sm font-semibold text-primary">
                      {watchSinistroTerzi ? "1. Cliente (Sinistro Terzi)" : "1. Polizza e Cliente"}
                    </span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setCurrentStep(1)} className="text-xs h-7">Modifica</Button>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 text-xs">
                    {watchSinistroTerzi ? (
                      <>
                        <div>
                          <span className="text-muted-foreground">Tipo pratica</span>
                          <p className="font-semibold mt-0.5"><Badge variant="outline">Sinistro Terzi</Badge></p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Cliente</span>
                          <p className="font-semibold mt-0.5">{resolveClienteNome(selectedClienteData)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Numero polizza</span>
                          <p className="font-semibold mt-0.5">{watch("numero_polizza") || "—"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Prodotto</span>
                          <p className="font-semibold mt-0.5">{watch("prodotto_sinistro") || "—"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Garanzia</span>
                          <p className="font-semibold mt-0.5">{watch("ramo_sinistro") || "—"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Data Accadimento</span>
                          <p className="font-semibold mt-0.5">{watch("data_evento") ? format(new Date(watch("data_evento")), "dd/MM/yyyy") : "—"}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <span className="text-muted-foreground">Numero Polizza</span>
                          <p className="font-semibold mt-0.5">{selectedPolizzaData?.numero_titolo || "—"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Cliente</span>
                          <p className="font-semibold mt-0.5">{resolveClienteNome(selectedPolizzaData?.clienti || selectedClienteData)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Prodotto</span>
                          <p className="font-semibold mt-0.5">{selectedPolizzaData ? formatPolizzaProdotto(selectedPolizzaData) : "—"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Garanzia</span>
                          <p className="font-semibold mt-0.5">{selectedPolizzaData ? formatPolizzaGaranzia(selectedPolizzaData) : "—"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Compagnia</span>
                          <p className="font-semibold mt-0.5">{selectedPolizzaData ? formatPolizzaCompagnia(selectedPolizzaData) : "—"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Periodo garanzia</span>
                          <p className="font-semibold mt-0.5">{selectedPolizzaData ? formatPolizzaPeriodo(selectedPolizzaData) : "—"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Data Accadimento</span>
                          <p className="font-semibold mt-0.5">{watch("data_evento") ? format(new Date(watch("data_evento")), "dd/MM/yyyy") : "—"}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Sezione 2: Dati Sinistro */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-2 flex justify-between items-center border-b">
                    <span className="text-sm font-semibold text-primary">2. Dati del Sinistro</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setCurrentStep(2)} className="text-xs h-7">Modifica</Button>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground">Data Denuncia</span>
                      <p className="font-semibold mt-0.5">{watch("data_denuncia") ? format(new Date(watch("data_denuncia")), "dd/MM/yyyy") : "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tipo Sinistro</span>
                      <p className="font-semibold mt-0.5">{formatTipoSinistro({ tipo_sinistro: watch("tipo_sinistro") === "__custom__" ? null : watch("tipo_sinistro"), tipo_sinistro_personalizzato: watch("tipo_sinistro_personalizzato") })}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Numero Compagnia</span>
                      <p className="font-semibold mt-0.5">{watch("numero_sinistro_compagnia") || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Controparte</span>
                      <p className="font-semibold mt-0.5">{watch("controparte") || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Targa</span>
                      <p className="font-semibold mt-0.5">{watch("targa_veicolo") || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Luogo</span>
                      <p className="font-semibold mt-0.5">{watch("luogo_sinistro") || watch("indirizzo_sinistro") || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Importo Riserva</span>
                      <p className="font-semibold mt-0.5 font-mono">
                        {watch("importo_riserva") ? `€ ${Number(watch("importo_riserva")).toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "—"}
                      </p>
                    </div>
                    <div className="col-span-1 md:col-span-3">
                      <span className="text-muted-foreground">Descrizione Accadimento</span>
                      <p className="mt-1 bg-muted/30 p-2.5 rounded border text-muted-foreground leading-relaxed">{watch("descrizione") || "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Sezione 3: Documenti */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-2 flex justify-between items-center border-b">
                    <span className="text-sm font-semibold text-primary">3. Documenti allegati ({watchDocumenti?.length || 0})</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setCurrentStep(3)} className="text-xs h-7">Modifica</Button>
                  </div>
                  <div className="p-4 text-xs">
                    {watchDocumenti && watchDocumenti.length > 0 ? (
                      <div className="space-y-1.5">
                        {watchDocumenti.map((doc, idx) => (
                          <div key={idx} className="flex justify-between py-1 border-b last:border-0">
                            <span className="font-medium">{doc.nome_file}</span>
                            <span className="text-muted-foreground">
                              {doc.descrizione?.trim() || "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center italic py-2">Nessun documento caricato per questo sinistro.</p>
                    )}
                  </div>
                </div>

                {/* Sezione 4: Assegnazione */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-2 flex justify-between items-center border-b">
                    <span className="text-sm font-semibold text-primary">4. Gestione e Assegnazione</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setCurrentStep(4)} className="text-xs h-7">Modifica</Button>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground">Responsabile Interno</span>
                      <p className="font-semibold mt-0.5">
                        {(() => {
                          const resp = responsabiliList.find((r: any) => r.id === watch("responsabile_id"));
                          return resp ? `${resp.cognome || ""} ${resp.nome || ""}`.trim() : "—";
                        })()}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Liquidatore Esterno</span>
                      <p className="font-semibold mt-0.5">
                        {(() => {
                          const liq = liquidatoriList.find((l: any) => l.id === watch("liquidatore_id"));
                          return liq ? liq.ragione_sociale || `${liq.cognome || ""} ${liq.nome || ""}`.trim() : "—";
                        })()}
                      </p>
                    </div>
                    {watch("note_interne") && (
                      <div className="col-span-1 md:col-span-2">
                        <span className="text-muted-foreground">Note Operatore</span>
                        <p className="mt-1 text-muted-foreground italic bg-muted/10 p-2 border rounded">{watch("note_interne")}</p>
                      </div>
                    )}
                    <div className="col-span-1 md:col-span-2 space-y-1 pt-2 border-t">
                      <span className="text-muted-foreground">Prescrizione legale</span>
                      <p className="font-semibold mt-0.5">
                        {anniPrescrizione} {anniPrescrizione === 1 ? "anno" : "anni"} dalla data di accadimento
                        {(() => {
                          const scadenza = calcScadenzaPrescrizione(watch("data_evento"), anniPrescrizione);
                          return scadenza ? ` · ${format(new Date(scadenza), "dd/MM/yyyy")}` : "";
                        })()}
                      </p>
                    </div>
                    {(prescrizioniDrafts.length > 0 || reminderDaSalvare().length > 0) && (
                      <div className="col-span-1 md:col-span-2 space-y-2 pt-2 border-t">
                        {prescrizioniDrafts.length > 0 && (
                          <div>
                            <span className="text-muted-foreground">Prescrizioni ({prescrizioniDrafts.length})</span>
                            <ul className="mt-1 list-disc list-inside text-muted-foreground">
                              {prescrizioniDrafts.map((p, i) => (
                                <li key={i}>{DESTINATARIO_LABEL[p.destinatario_tipo]} — {p.oggetto}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {reminderDaSalvare().length > 0 && (
                          <div>
                            <span className="text-muted-foreground">Reminder personali ({reminderDaSalvare().length})</span>
                            <ul className="mt-1 list-disc list-inside text-muted-foreground">
                              {reminderDaSalvare().map((r, i) => (
                                <li key={i}>{r.testo}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </CardContent>
          <CardFooter className="flex justify-between border-t py-4 bg-muted/10 gap-2 flex-wrap">
            <div className="flex gap-2">
            {currentStep > 1 ? (
              <Button type="button" variant="outline" onClick={handlePrevStep} disabled={submitting || savingBozza}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Indietro
              </Button>
            ) : (
              <div />
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={handleSalvaBozza}
              disabled={submitting || savingBozza || !selectedClienteId}
            >
              <Save className="h-4 w-4 mr-2" />
              {savingBozza ? "Salvataggio..." : "Salva bozza"}
            </Button>
            </div>

            {currentStep < 5 ? (
              <Button type="button" onClick={handleNextStep} disabled={submitting || savingBozza}>
                Avanti <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button type="submit" className="btn-primary-gradient" disabled={submitting || savingBozza}>
                {submitting ? "Creazione in corso..." : "Conferma e Apri Sinistro"}
              </Button>
            )}
          </CardFooter>
        </Card>
      </form>

      {/* Modale AlertDialog di conferma per l'annullamento */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro di voler annullare?</AlertDialogTitle>
            <AlertDialogDescription>
              {dbBozzaId
                ? "La bozza verrà eliminata definitivamente dal database."
                : "Tutti i dati non salvati andranno persi."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleAnnulla} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Conferma Annullamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
      )}
    </div>
  );
}
