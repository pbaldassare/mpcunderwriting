import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import AiDocumentScanner from "@/components/AiDocumentScanner";
import type { DocumentType } from "@/components/AiDocumentScanner";
import { SearchableSelect } from "@/components/SearchableSelect";
import { toast } from "sonner";
import { parseCF } from "@/lib/parseCF";
import { lookupComune } from "@/lib/comuniItaliani";
import { FiscalCodeInput } from "@/components/ui/FiscalCodeInput";
import { validatePIVA } from "@/lib/validatePIVA";
import { validateCF } from "@/lib/validateCF";
import { formatClienteDuplicatoError, verificaClienteDuplicato } from "@/lib/clientiDuplicate";
import { DatePicker } from "@/components/contabilita/DatePicker";
import { format } from "date-fns";

import { Checkbox } from "@/components/ui/checkbox";
import {
  useLookupZone, useLookupIndotti, useLookupAttivita, useLookupSettori,
  useLookupContratti, useLookupFasceFatturato, useLookupFasceDipendenti, useGruppiStatistici,
} from "@/hooks/useLookupTables";
import { useProduttoriLookup } from "@/hooks/useProduttoriLookup";
import { useAccountExecutivesLookup } from "@/hooks/useAccountExecutivesLookup";

interface CommercialRole {
  profilo_id: string;
  anagrafica_id: string;
}

const emptyRole = (): CommercialRole => ({
  profilo_id: "",
  anagrafica_id: "",
});

function DatiStatisticiCreate(props: any) {
  const { data: zoneOpts = [] } = useLookupZone();
  const { data: indottiOpts = [] } = useLookupIndotti();
  const { data: attivitaOpts = [] } = useLookupAttivita();
  const { data: settoriOpts = [] } = useLookupSettori();
  const { data: contrattiOpts = [] } = useLookupContratti();
  const { data: fasceFatturatoOpts = [] } = useLookupFasceFatturato();
  const { data: fasceDipendentiOpts = [] } = useLookupFasceDipendenti();
  const { data: gruppiStatOpts = [] } = useGruppiStatistici();
  const p = props;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Gruppo Finanziario</Label>
          <Input
            readOnly
            value={
              p.gruppiFinanziari.find((g: any) => g.id === p.gruppoFinanziarioId)
                ? `${p.gruppiFinanziari.find((g: any) => g.id === p.gruppoFinanziarioId)?.codice} - ${p.gruppiFinanziari.find((g: any) => g.id === p.gruppoFinanziarioId)?.nome}`
                : ""
            }
            placeholder="Seleziona in alto nella sezione Tipo Cliente"
            className="bg-muted/50"
          />
        </div>
        <div>
          <Label className="text-xs">Gruppo Statistico</Label>
          <SearchableSelect value={p.gruppoStatistico} onValueChange={p.setGruppoStatistico} placeholder="— Seleziona —" options={gruppiStatOpts} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label className="text-xs">Zona</Label><SearchableSelect value={p.zona} onValueChange={p.setZona} placeholder="— Seleziona —" options={zoneOpts} /></div>
        <div><Label className="text-xs">Indotto</Label><SearchableSelect value={p.indotto} onValueChange={p.setIndotto} placeholder="— Seleziona —" options={indottiOpts} /></div>
        <div><Label className="text-xs">Attività</Label><SearchableSelect value={p.attivita} onValueChange={p.setAttivita} placeholder="— Seleziona —" options={attivitaOpts} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label className="text-xs">Settore</Label><SearchableSelect value={p.settore} onValueChange={p.setSettore} placeholder="— Seleziona —" options={settoriOpts} /></div>
        <div><Label className="text-xs">Azienda Stat.</Label><Input value={p.aziendaStat} onChange={(e) => p.setAziendaStat(e.target.value)} /></div>
        <div><Label className="text-xs">Contratto</Label><SearchableSelect value={p.contratto} onValueChange={p.setContratto} placeholder="— Seleziona —" options={contrattiOpts} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label className="text-xs">Matricola</Label><Input value={p.matricola} onChange={(e) => p.setMatricola(e.target.value)} /></div>
        <div><Label className="text-xs">Riferimento</Label><Input value={p.riferimento} onChange={(e) => p.setRiferimento(e.target.value)} /></div>
        <div><Label className="text-xs">Codice ATECO</Label><Input value={p.codiceAteco} onChange={(e) => p.setCodiceAteco(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Fascia Fatturato</Label><SearchableSelect value={p.fasciaFatturato} onValueChange={p.setFasciaFatturato} placeholder="— Seleziona —" options={fasceFatturatoOpts} /></div>
        <div><Label className="text-xs">Fascia Dipendenti</Label><SearchableSelect value={p.fasciaDipendenti} onValueChange={p.setFasciaDipendenti} placeholder="— Seleziona —" options={fasceDipendentiOpts} /></div>
      </div>
      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-2"><Switch checked={p.clienteAssociato} onCheckedChange={p.setClienteAssociato} /><Label className="text-xs">Cliente Associato</Label></div>
        <div className="flex items-center gap-2"><Switch checked={p.clienteCaptive} onCheckedChange={p.setClienteCaptive} /><Label className="text-xs">Cliente Captive</Label></div>
        <div className="flex items-center gap-2"><Switch checked={p.internazionale} onCheckedChange={p.setInternazionale} /><Label className="text-xs">Internazionale</Label></div>
      </div>
    </div>
  );
}

export interface NuovoClienteInitialData {
  tipoCliente?: "privato" | "azienda" | "ente";
  nome?: string;
  cognome?: string;
  ragioneSociale?: string;
  codiceFiscale?: string;
  partitaIva?: string;
  email?: string;
  telefono?: string;
  cellulare?: string;
  indirizzo?: string;
  cap?: string;
  citta?: string;
  provincia?: string;
  nazione?: string;
  gruppoFinanziarioId?: string;
  codiceCig?: string;
}

export interface NuovoClienteDialogProps {
  trigger?: React.ReactNode;
  onCreated?: (clienteId: string, label: string) => void;
  /** Controlled open state (optional). When provided, dialog is controlled by parent. */
  controlledOpen?: boolean;
  onOpenChange?: (o: boolean) => void;
  /** Pre-fill the form when the dialog opens. */
  initialData?: NuovoClienteInitialData;
}

export function NuovoClienteDialog({ trigger, onCreated, controlledOpen, onOpenChange, initialData }: NuovoClienteDialogProps) {
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? !!controlledOpen : internalOpen;
  const setOpen = (o: boolean) => {
    if (!isControlled) setInternalOpen(o);
    onOpenChange?.(o);
  };

  const [tipoCliente, setTipoCliente] = useState<"privato" | "azienda" | "ente">("privato");
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [codiceFiscale, setCodiceFiscale] = useState("");
  const [dataNascita, setDataNascita] = useState("");
  const [luogoNascita, setLuogoNascita] = useState("");
  const [indirizzoResidenza, setIndirizzoResidenza] = useState("");
  const [capResidenza, setCapResidenza] = useState("");
  const [cittaResidenza, setCittaResidenza] = useState("");
  const [provinciaResidenza, setProvinciaResidenza] = useState("");
  const [ragioneSociale, setRagioneSociale] = useState("");
  const [partitaIva, setPartitaIva] = useState("");
  const [codiceFiscaleAzienda, setCodiceFiscaleAzienda] = useState("");
  const [codiceSdi, setCodiceSdi] = useState("");
  const [formaGiuridica, setFormaGiuridica] = useState("");
  const [indirizzoSede, setIndirizzoSede] = useState("");
  const [capSede, setCapSede] = useState("");
  const [cittaSede, setCittaSede] = useState("");
  const [provinciaSede, setProvinciaSede] = useState("");
  const [referenteNome, setReferenteNome] = useState("");
  const [referenteCognome, setReferenteCognome] = useState("");
  const [referenteTelefono, setReferenteTelefono] = useState("");
  const [referenteEmail, setReferenteEmail] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [pec, setPec] = useState("");
  const [gruppoFinanziarioId, setGruppoFinanziarioId] = useState("");
  const scannedFilesRef = useRef<{ file: File; documentType: string }[]>([]);

  const [codiceRicerca, setCodiceRicerca] = useState("");
  const [titolo, setTitolo] = useState("");
  const [statoCliente, setStatoCliente] = useState("");
  const [prospect, setProspect] = useState("");
  const [tipoPersona, setTipoPersona] = useState("");
  const [sesso, setSesso] = useState("");
  const [comuneNascita, setComuneNascita] = useState("");
  const [provinciaNascita, setProvinciaNascita] = useState("");
  const [tipoSommario, setTipoSommario] = useState("");
  const [clienteNonCeduto, setClienteNonCeduto] = useState(false);
  const [aziendaSsnSx, setAziendaSsnSx] = useState(false);
  const [statisticaPremiSinistri, setStatisticaPremiSinistri] = useState(false);
  const [specSxDanni, setSpecSxDanni] = useState("");
  const [specSxSanita, setSpecSxSanita] = useState("");
  const [cellulare, setCellulare] = useState("");
  const [fax, setFax] = useState("");
  const [nazione, setNazione] = useState("");
  const [attenzioneDi, setAttenzioneDi] = useState("");
  const [note, setNote] = useState("");
  const [haIncarico, setHaIncarico] = useState(false);
  const [incaricoDa, setIncaricoDa] = useState<Date | null>(null);
  const [incaricoA, setIncaricoA] = useState<Date | null>(null);

  const [indirizzoAlternativo, setIndirizzoAlternativo] = useState("");
  const [capAlternativo, setCapAlternativo] = useState("");
  const [cittaAlternativa, setCittaAlternativa] = useState("");
  const [provinciaAlternativa, setProvinciaAlternativa] = useState("");
  const [indirizzoFiscale, setIndirizzoFiscale] = useState("");
  const [capFiscale, setCapFiscale] = useState("");
  const [cittaFiscale, setCittaFiscale] = useState("");
  const [provinciaFiscale, setProvinciaFiscale] = useState("");

  const [zona, setZona] = useState("");
  const [indotto, setIndotto] = useState("");
  const [attivita, setAttivita] = useState("");
  const [settore, setSettore] = useState("");
  const [aziendaStat, setAziendaStat] = useState("");
  const [contratto, setContratto] = useState("");
  const [matricola, setMatricola] = useState("");
  const [riferimento, setRiferimento] = useState("");
  const [fatturato, setFatturato] = useState("");
  const [numDipendenti, setNumDipendenti] = useState("");
  const [fascia_fatturato, setFasciaFatturato] = useState("");
  const [fascia_dipendenti, setFasciaDipendenti] = useState("");
  const [codiceAteco, setCodiceAteco] = useState("");
  const [clienteAssociato, setClienteAssociato] = useState(false);
  const [clienteCaptive, setClienteCaptive] = useState(false);
  const [internazionale, setInternazionale] = useState(false);
  const [gruppoStatistico, setGruppoStatistico] = useState("");

  const [fidoCredito, setFidoCredito] = useState("");
  const [fidoCauzioni, setFidoCauzioni] = useState("");

  const [ae, setAe] = useState<CommercialRole>(emptyRole());
  const [backofficeRole, setBackofficeRole] = useState<CommercialRole>(emptyRole());
  const [produttoreSede, setProduttoreSede] = useState<CommercialRole>(emptyRole());
  const [maturaProvvigioni, setMaturaProvvigioni] = useState(true);

  const [ufficioClienteId, setUfficioClienteId] = useState<string>("");

  const handleFileReady = useCallback((file: File, documentType: DocumentType) => {
    scannedFilesRef.current.push({ file, documentType });
  }, []);

  const uploadScannedFiles = useCallback(async (clienteId: string) => {
    const files = scannedFilesRef.current;
    if (files.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;
    for (const { file, documentType } of files) {
      const ts = Date.now();
      const path = `cliente/${clienteId}/${ts}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("documenti_clienti").upload(path, file);
      if (uploadErr) { console.error("Upload error:", uploadErr); continue; }
      await supabase.from("documenti").insert({
        nome_file: file.name, path_storage: path, bucket_name: "documenti_clienti",
        entita_tipo: "cliente", entita_id: clienteId, caricato_da: userId, categoria: documentType,
      });
    }
    scannedFilesRef.current = [];
  }, []);

  const { data: gruppiFinanziari = [] } = useQuery({
    queryKey: ["gruppi_finanziari_lookup"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gruppi_finanziari" as any)
        .select("id, codice, nome, tipo_soggetto")
        .eq("attivo", true)
        .order("codice");
      return (data || []) as any[];
    },
  });

  const { data: profiliCommercialiRaw = [] } = useQuery({
    queryKey: ["profili_commerciali_lookup_backoffice"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, cognome, ruolo")
        .eq("ruolo", "backoffice")
        .order("cognome");
      return data || [];
    },
  });

  const { data: produttoriOpts = [] } = useProduttoriLookup();
  const { data: aeLookupData } = useAccountExecutivesLookup();
  const aeOpts = aeLookupData?.options ?? [];

  const { data: ufficiList = [] } = useQuery({
    queryKey: ["uffici_lookup_nuovo_cliente"],
    queryFn: async () => {
      const { data } = await supabase
        .from("uffici")
        .select("id, codice_ufficio, nome_ufficio")
        .order("nome_ufficio");
      return data || [];
    },
  });

  const profiliCommerciali = profiliCommercialiRaw.map((p: any) => ({
    value: p.id,
    label: `${p.cognome || ""} ${p.nome || ""} (${p.ruolo})`.trim(),
  }));

  useEffect(() => {
    if (open && initialData) {
      const cf = (initialData.codiceFiscale || "").toUpperCase();
      const piva = (initialData.partitaIva || "").trim();
      const inferredTipo: "privato" | "azienda" | "ente" =
        initialData.tipoCliente ||
        (piva || (cf && cf.length === 11) ? "azienda" : "privato");
      setTipoCliente(inferredTipo);
      if (inferredTipo === "privato") {
        if (initialData.nome && initialData.cognome) {
          setNome(initialData.nome);
          setCognome(initialData.cognome);
        } else if (initialData.nome && !initialData.cognome) {
          // Safeguard: nome ricevuto come stringa unica "NOME COGNOME"
          const parts = initialData.nome.trim().split(/\s+/);
          if (parts.length >= 2) {
            setNome(parts[0]);
            setCognome(parts.slice(1).join(" "));
          } else {
            setNome(initialData.nome);
          }
        } else if (initialData.ragioneSociale && !initialData.nome) {
          // try splitting "NOME COGNOME"
          const parts = initialData.ragioneSociale.trim().split(/\s+/);
          if (parts.length >= 2) {
            setNome(parts[0]);
            setCognome(parts.slice(1).join(" "));
          } else {
            setNome(initialData.ragioneSociale);
          }
        }
        if (cf) setCodiceFiscale(cf);
        if (initialData.indirizzo) setIndirizzoResidenza(initialData.indirizzo);
        if (initialData.cap) setCapResidenza(initialData.cap);
        if (initialData.citta) setCittaResidenza(initialData.citta);
        if (initialData.provincia) setProvinciaResidenza(initialData.provincia.toUpperCase());
      } else {
        if (initialData.ragioneSociale) setRagioneSociale(initialData.ragioneSociale);
        if (piva) setPartitaIva(piva);
        if (cf) setCodiceFiscaleAzienda(cf);
        if (initialData.indirizzo) setIndirizzoSede(initialData.indirizzo);
        if (initialData.cap) setCapSede(initialData.cap);
        if (initialData.citta) setCittaSede(initialData.citta);
        if (initialData.provincia) setProvinciaSede(initialData.provincia.toUpperCase());
      }
      if (initialData.email) setEmail(initialData.email);
      if (initialData.telefono) setTelefono(initialData.telefono);
      if (initialData.cellulare) setCellulare(initialData.cellulare);
      if (initialData.nazione) setNazione(initialData.nazione);
      if (initialData.gruppoFinanziarioId) setGruppoFinanziarioId(initialData.gruppoFinanziarioId);
      
    }
  }, [open, initialData]);

  // Stable id derived from query data: prevents re-runs when array reference changes but content doesn't
  const backofficeProfileId = useMemo<string | null>(
    () => profiliCommercialiRaw.find((p: any) => p.ruolo === "backoffice")?.id ?? null,
    [profiliCommercialiRaw]
  );

  // `open` lives in a ref so the effect depends only on `backofficeProfileId`:
  // re-runs only when the resolved id actually changes, not on every dialog toggle.
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Auto-assign backoffice profile.
  // - Effect deps: only `backofficeProfileId` (stable via useMemo) → no spurious re-runs.
  // - setState is idempotent: if `profilo_id` is already set OR equal to the incoming id,
  //   we return the SAME reference so React bails out (no re-render, no overwrite of initialData).
  useEffect(() => {
    if (!openRef.current || !backofficeProfileId) return;
    setBackofficeRole(prev => {
      if (prev.profilo_id) return prev; // already assigned (manual or initialData) → no-op
      if (prev.profilo_id === backofficeProfileId) return prev; // same id → keep reference
      return { ...prev, profilo_id: backofficeProfileId };
    });
  }, [backofficeProfileId]);

  // Auto-fill Sede dal profilo dello Specialist selezionato (solo se Sede è vuota)
  useEffect(() => {
    const profId = backofficeRole.profilo_id;
    if (!profId || ufficioClienteId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("ufficio_id")
        .eq("id", profId)
        .maybeSingle();
      if (!cancelled && data?.ufficio_id) setUfficioClienteId(data.ufficio_id);
    })();
    return () => { cancelled = true; };
  }, [backofficeRole.profilo_id, ufficioClienteId]);

  const insertCommercialRoles = async (clienteId: string) => {
    // 1) Default singoli storici (Specialist + primo AE/Produttore) → codici_commerciali_cliente
    const codiciRows: Record<string, unknown>[] = [];

    if (ae.anagrafica_id) {
      codiciRows.push({
        cliente_id: clienteId,
        anagrafica_id: ae.anagrafica_id,
        ruolo: "AE",
        // Sempre esplicito: insert multi-riga PostgREST altrimenti manda null e viola NOT NULL
        escludi_provvigioni: false,
      });
    }

    if (backofficeRole.profilo_id) {
      codiciRows.push({
        cliente_id: clienteId,
        profilo_id: backofficeRole.profilo_id,
        ruolo: "Backoffice",
        escludi_provvigioni: false,
      });
    }

    if (produttoreSede.anagrafica_id) {
      codiciRows.push({
        cliente_id: clienteId,
        anagrafica_id: produttoreSede.anagrafica_id,
        ruolo: "Produttore Sede",
        escludi_provvigioni: !maturaProvvigioni,
      });
    }

    if (codiciRows.length > 0) {
      const { error } = await supabase.from("codici_commerciali_cliente").insert(codiciRows as any);
      if (error) throw new Error(`Assegnazioni commerciali: ${error.message}`);
    }

    // 2) Default multi-valore usati dalla scheda cliente / nuove polizze → clienti_intermediari_default
    const intermediariRows: Record<string, unknown>[] = [];
    if (produttoreSede.anagrafica_id) {
      intermediariRows.push({
        cliente_id: clienteId,
        tipo: "produttore",
        anagrafica_commerciale_id: produttoreSede.anagrafica_id,
        percentuale: 0,
        ordine: 0,
        escludi_provvigioni: !maturaProvvigioni,
      });
    }
    if (ae.anagrafica_id) {
      intermediariRows.push({
        cliente_id: clienteId,
        tipo: "ae",
        anagrafica_commerciale_id: ae.anagrafica_id,
        percentuale: 0,
        ordine: 0,
        escludi_provvigioni: false,
      });
    }
    if (intermediariRows.length > 0) {
      const { error } = await supabase
        .from("clienti_intermediari_default")
        .insert(intermediariRows as any);
      if (error) throw new Error(`Intermediari di default: ${error.message}`);
    }
  };

  const getMissingFields = (): string[] => {
    const missing: string[] = [];
    if (!gruppoFinanziarioId) missing.push("Gruppo Finanziario");
    if (!ufficioClienteId) missing.push("Sede");
    if (!backofficeRole.profilo_id) missing.push("Specialist");
    if (tipoCliente === "privato") {
      if (!nome.trim()) missing.push("Nome");
      if (!cognome.trim()) missing.push("Cognome");
      if (!codiceFiscale.trim()) missing.push("Codice Fiscale");
      if (!indirizzoResidenza.trim()) missing.push("Indirizzo Residenza");
      if (!email.trim()) missing.push("Email");
    } else {
      if (!ragioneSociale.trim()) missing.push(tipoCliente === "ente" ? "Denominazione Ente" : "Ragione Sociale");
      if (!partitaIva.trim()) missing.push("Partita IVA");
      if (tipoCliente === "ente" && !codiceFiscaleAzienda.trim()) missing.push("Codice Fiscale Ente");
      
      if (!indirizzoSede.trim()) missing.push("Indirizzo Sede");
      if (!capSede.trim()) missing.push("CAP");
      if (!cittaSede.trim()) missing.push("Città");
      if (!provinciaSede.trim()) missing.push("Provincia");
      if (!email.trim()) missing.push("Email");
    }
    return missing;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const missing = getMissingFields();
      if (missing.length > 0) throw new Error(`Campi obbligatori mancanti: ${missing.join(", ")}`);
      // Validazione formato/checksum CF e P.IVA
      const fiscalErrors: string[] = [];
      if (tipoCliente === "privato" && codiceFiscale) {
        const r = validateCF(codiceFiscale, { allowPIVAFormat: false });
        if (!r.valid) fiscalErrors.push(`Codice Fiscale: ${r.error}`);
      }
      if (tipoCliente !== "privato") {
        if (partitaIva) {
          const r = validatePIVA(partitaIva);
          if (!r.valid) fiscalErrors.push(`Partita IVA: ${r.error}`);
        }
        if (codiceFiscaleAzienda) {
          const r = validateCF(codiceFiscaleAzienda, { allowPIVAFormat: true });
          if (!r.valid) fiscalErrors.push(`Codice Fiscale ${tipoCliente === "ente" ? "Ente" : "Azienda"}: ${r.error}`);
        }
      }
      if (fiscalErrors.length > 0) throw new Error(fiscalErrors.join(" • "));
      if (haIncarico && incaricoDa && incaricoA && incaricoA < incaricoDa) {
        throw new Error("La data fine incarico non può essere precedente alla data inizio");
      }

      const duplicati = await verificaClienteDuplicato(supabase, {
        partitaIva: tipoCliente !== "privato" ? partitaIva : null,
        codiceFiscale: tipoCliente === "privato" ? codiceFiscale : null,
        codiceFiscaleAzienda: tipoCliente !== "privato" ? codiceFiscaleAzienda : null,
        nome: tipoCliente === "privato" ? nome : null,
        cognome: tipoCliente === "privato" ? cognome : null,
        ragioneSociale: tipoCliente !== "privato" ? ragioneSociale : null,
        tipoCliente,
      });
      if (duplicati.length > 0) {
        throw new Error(formatClienteDuplicatoError(duplicati));
      }

      const payload: Record<string, unknown> = {
        tipo_cliente: tipoCliente,
        email: email || null,
        telefono: telefono || null,
        pec: pec || null,
        gruppo_finanziario_id: gruppoFinanziarioId || null,
        ufficio_id: ufficioClienteId || null,
        codice_ricerca: codiceRicerca || null,
        titolo: titolo || null,
        stato_cliente: statoCliente || null,
        prospect: prospect || null,
        tipo_persona: tipoPersona || null,
        sesso: sesso || null,
        comune_nascita: comuneNascita || null,
        provincia_nascita: provinciaNascita || null,
        tipo_sommario: tipoSommario || null,
        cliente_non_ceduto: clienteNonCeduto,
        azienda_ssn_sx: aziendaSsnSx,
        statistica_premi_sinistri: statisticaPremiSinistri,
        spec_sx_danni: specSxDanni || null,
        spec_sx_sanita: specSxSanita || null,
        cellulare: cellulare || null,
        fax: fax || null,
        nazione: nazione || null,
        attenzione_di: attenzioneDi || null,
        note: note || null,
        indirizzo_alternativo: indirizzoAlternativo || null,
        cap_alternativo: capAlternativo || null,
        citta_alternativa: cittaAlternativa || null,
        provincia_alternativa: provinciaAlternativa || null,
        indirizzo_fiscale: indirizzoFiscale || null,
        cap_fiscale: capFiscale || null,
        citta_fiscale: cittaFiscale || null,
        provincia_fiscale: provinciaFiscale || null,
        zona: zona || null,
        indotto: indotto || null,
        attivita: attivita || null,
        settore: settore || null,
        azienda_stat: aziendaStat || null,
        contratto: contratto || null,
        matricola: matricola || null,
        riferimento: riferimento || null,
        fatturato: fatturato ? parseFloat(fatturato) : null,
        num_dipendenti: numDipendenti ? parseInt(numDipendenti) : null,
        fascia_fatturato: fascia_fatturato || null,
        fascia_dipendenti: fascia_dipendenti || null,
        codice_ateco: codiceAteco || null,
        cliente_associato: clienteAssociato,
        cliente_captive: clienteCaptive,
        internazionale: internazionale,
        gruppo_statistico: gruppoStatistico || null,
        fido_credito: fidoCredito ? parseFloat(fidoCredito) : null,
        fido_cauzioni: fidoCauzioni ? parseFloat(fidoCauzioni) : null,
        ha_incarico: haIncarico,
        incarico_da: haIncarico && incaricoDa ? format(incaricoDa, "yyyy-MM-dd") : null,
        incarico_a: haIncarico && incaricoA ? format(incaricoA, "yyyy-MM-dd") : null,
      };
      if (tipoCliente === "privato") {
        payload.nome = nome || null;
        payload.cognome = cognome || null;
        payload.codice_fiscale = codiceFiscale || null;
        payload.data_nascita = dataNascita || null;
        payload.luogo_nascita = luogoNascita || null;
        payload.indirizzo_residenza = indirizzoResidenza || null;
        payload.cap_residenza = capResidenza || null;
        payload.citta_residenza = cittaResidenza || null;
        payload.provincia_residenza = provinciaResidenza || null;
      } else {
        payload.ragione_sociale = ragioneSociale || null;
        payload.partita_iva = partitaIva || null;
        payload.codice_fiscale_azienda = codiceFiscaleAzienda || null;
        payload.codice_sdi = codiceSdi || null;
        payload.forma_giuridica = formaGiuridica || null;
        payload.indirizzo_sede = indirizzoSede || null;
        payload.cap_sede = capSede || null;
        payload.citta_sede = cittaSede || null;
        payload.provincia_sede = provinciaSede || null;
        payload.referente_nome = referenteNome || null;
        payload.referente_cognome = referenteCognome || null;
        payload.referente_telefono = referenteTelefono || null;
        payload.referente_email = referenteEmail || null;
      }
      const { data, error } = await supabase.from("clienti").insert(payload as any).select("id, nome, cognome, ragione_sociale").single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data: any) => {
      if (data?.id) {
        await uploadScannedFiles(data.id).catch(() => undefined);
        try {
          await insertCommercialRoles(data.id);
          toast.success("Cliente creato con successo");
        } catch (err: any) {
          // Cliente già creato: avvisa sulle assegnazioni (non bloccare navigazione)
          toast.warning(
            err?.message
              ? `Cliente creato, ma non tutte le assegnazioni sono state salvate: ${err.message}`
              : "Cliente creato, ma le assegnazioni (Specialist / Produttore / AE) non sono state salvate. Completale nella scheda.",
          );
        }
        queryClient.invalidateQueries({ queryKey: ["clienti"] });
        const label = data.ragione_sociale || `${data.cognome || ""} ${data.nome || ""}`.trim();
        onCreated?.(data.id, label);
      }
      resetForm();
      setOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Errore");
    },
  });

  const resetForm = () => {
    setNome(""); setCognome(""); setCodiceFiscale(""); setDataNascita("");
    setLuogoNascita(""); setIndirizzoResidenza(""); setCapResidenza("");
    setCittaResidenza(""); setProvinciaResidenza(""); setRagioneSociale("");
    setPartitaIva(""); setCodiceFiscaleAzienda(""); setCodiceSdi("");
    setFormaGiuridica(""); setIndirizzoSede(""); setCapSede("");
    setCittaSede(""); setProvinciaSede(""); setReferenteNome("");
    setReferenteCognome(""); setReferenteTelefono(""); setReferenteEmail("");
    setEmail(""); setTelefono(""); setPec(""); setTipoCliente("privato");
    setGruppoFinanziarioId("");
    setAe(emptyRole()); setBackofficeRole(emptyRole()); setProduttoreSede(emptyRole());
    setMaturaProvvigioni(true);
    setUfficioClienteId("");
    setCodiceRicerca(""); setTitolo(""); setStatoCliente(""); setProspect("");
    setTipoPersona(""); setSesso(""); setComuneNascita(""); setProvinciaNascita("");
    setTipoSommario(""); setClienteNonCeduto(false); setAziendaSsnSx(false);
    setStatisticaPremiSinistri(false); setSpecSxDanni(""); setSpecSxSanita("");
    setCellulare(""); setFax(""); setNazione(""); setAttenzioneDi(""); setNote("");
    setHaIncarico(false); setIncaricoDa(null); setIncaricoA(null);
    setIndirizzoAlternativo(""); setCapAlternativo(""); setCittaAlternativa(""); setProvinciaAlternativa("");
    setIndirizzoFiscale(""); setCapFiscale(""); setCittaFiscale(""); setProvinciaFiscale("");
    setZona(""); setIndotto(""); setAttivita(""); setSettore("");
    setAziendaStat(""); setContratto(""); setMatricola(""); setRiferimento("");
    setFatturato(""); setNumDipendenti(""); setCodiceAteco(""); setGruppoStatistico("");
    setClienteAssociato(false); setClienteCaptive(false); setInternazionale(false);
    setFidoCredito(""); setFidoCauzioni("");
    scannedFilesRef.current = [];
  };

  const updateRole = (setter: React.Dispatch<React.SetStateAction<CommercialRole>>, field: keyof CommercialRole, value: any) => {
    setter((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        {trigger || <Button><Plus className="w-4 h-4 mr-2" />Nuovo Cliente</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuovo Cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className={`rounded-lg border p-3 space-y-3 ${!gruppoFinanziarioId ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/20" : "bg-muted/30"}`}>
            <div>
              <Label>Gruppo Finanziario *</Label>
              <SearchableSelect
                value={gruppoFinanziarioId}
                onValueChange={(v) => {
                  setGruppoFinanziarioId(v);
                  const gf = gruppiFinanziari.find((g: any) => g.id === v);
                  if (gf?.tipo_soggetto) {
                    const newTipo = gf.tipo_soggetto as "privato" | "azienda" | "ente";
                    setTipoCliente(newTipo);
                  }
                }}
                placeholder="— Cerca e seleziona gruppo finanziario —"
                options={gruppiFinanziari.map((g: any) => ({ value: g.id, label: `${g.codice} - ${g.nome}` }))}
              />
              {!gruppoFinanziarioId && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  Obbligatorio: determina automaticamente il tipo cliente.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Label className="mb-0">Tipo Cliente:</Label>
              {gruppoFinanziarioId ? (
                <Badge variant="outline" className={
                  tipoCliente === "privato" ? "border-blue-500 text-blue-700 bg-blue-50" :
                  tipoCliente === "azienda" ? "border-emerald-600 text-emerald-700 bg-emerald-50" :
                  "border-amber-600 text-amber-700 bg-amber-50"
                }>
                  {tipoCliente === "privato" ? "Privato" : tipoCliente === "azienda" ? "Azienda" : "Ente"} (auto)
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Seleziona un gruppo finanziario
                </Badge>
              )}
            </div>
          </div>

          {!gruppoFinanziarioId ? (
            <div className="rounded-lg border border-dashed p-8 text-center bg-muted/20">
              <p className="text-sm font-medium text-muted-foreground">
                👆 Seleziona prima un <strong>Gruppo Finanziario</strong> qui sopra
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Determina il tipo cliente (Privato / Azienda / Ente) e quali campi sono obbligatori.
              </p>
            </div>
          ) : (
          <>
          {tipoCliente === "privato" ? (
            <div className="flex flex-wrap gap-2">
              <AiDocumentScanner
                documentType="carta_identita"
                entityContext={(codiceFiscale || nome || cognome) ? {
                  entityType: "cliente",
                  scopeHint: `Nuovo cliente ${(cognome || "").trim()} ${(nome || "").trim()}`.trim() || "Nuovo cliente",
                  expectedCF: codiceFiscale || null,
                } : undefined}
                onFileReady={handleFileReady}
                onExtracted={(data) => {
                  if (data.nome) setNome(data.nome as string);
                  if (data.cognome) setCognome(data.cognome as string);
                  if (data.codice_fiscale) setCodiceFiscale((data.codice_fiscale as string).toUpperCase());
                  if (data.data_nascita) setDataNascita(data.data_nascita as string);
                  if (data.luogo_nascita) setLuogoNascita(data.luogo_nascita as string);
                  if (data.indirizzo) setIndirizzoResidenza(data.indirizzo as string);
                  if (data.cap) setCapResidenza(data.cap as string);
                  if (data.citta) setCittaResidenza(data.citta as string);
                  if (data.provincia) setProvinciaResidenza((data.provincia as string).toUpperCase());
                }}
              />
              <AiDocumentScanner
                documentType="tessera_sanitaria"
                entityContext={(codiceFiscale || nome || cognome) ? {
                  entityType: "cliente",
                  scopeHint: `Nuovo cliente ${(cognome || "").trim()} ${(nome || "").trim()}`.trim() || "Nuovo cliente",
                  expectedCF: codiceFiscale || null,
                } : undefined}
                onFileReady={handleFileReady}
                onExtracted={(data) => {
                  if (data.codice_fiscale) setCodiceFiscale((data.codice_fiscale as string).toUpperCase());
                  if (data.nome) setNome(data.nome as string);
                  if (data.cognome) setCognome(data.cognome as string);
                  if (data.data_nascita) setDataNascita(data.data_nascita as string);
                }}
              />
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <AiDocumentScanner
                documentType="visura_camerale"
                entityContext={(partitaIva || ragioneSociale) ? {
                  entityType: "cliente",
                  scopeHint: ragioneSociale || "Nuova azienda",
                  expectedPIVA: partitaIva || null,
                } : undefined}
                onFileReady={handleFileReady}
                onExtracted={(data) => {
                  if (data.ragione_sociale) setRagioneSociale(data.ragione_sociale as string);
                  if (data.partita_iva) setPartitaIva(data.partita_iva as string);
                  if (data.codice_fiscale) setCodiceFiscaleAzienda((data.codice_fiscale as string).toUpperCase());
                  if (data.codice_sdi) setCodiceSdi(data.codice_sdi as string);
                  if (data.forma_giuridica) {
                    const fg = (data.forma_giuridica as string).toLowerCase().replace(/\s/g, "_");
                    setFormaGiuridica(fg);
                  }
                  if (data.indirizzo_sede) setIndirizzoSede(data.indirizzo_sede as string);
                  if (data.cap) setCapSede(data.cap as string);
                  if (data.citta) setCittaSede(data.citta as string);
                  if (data.provincia) setProvinciaSede((data.provincia as string).toUpperCase());
                  if (data.pec) setPec(data.pec as string);
                }}
              />
            </div>
          )}

          {tipoCliente === "privato" ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} className={!nome.trim() ? "border-amber-400" : undefined} /></div>
                <div><Label>Cognome *</Label><Input value={cognome} onChange={(e) => setCognome(e.target.value)} className={!cognome.trim() ? "border-amber-400" : undefined} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Codice Fiscale *</Label><FiscalCodeInput kind="cf16" enforcePattern required value={codiceFiscale} onChange={(val) => {
                  setCodiceFiscale(val);
                  if (val.length === 16) {
                    const parsed = parseCF(val);
                    if (parsed) {
                      setSesso(parsed.sesso);
                      setDataNascita(parsed.dataNascita);
                      const info = lookupComune(parsed.codiceCatastale);
                      if (info) {
                        setComuneNascita(info.comune);
                        setProvinciaNascita(info.provincia);
                        setLuogoNascita(`${info.comune} (${info.provincia})`);
                      }
                      toast.info("Dati estratti automaticamente dal Codice Fiscale");
                    }
                  }
                }} /></div>
                <div><Label>Data di Nascita</Label><Input type="date" value={dataNascita} onChange={(e) => setDataNascita(e.target.value)} /></div>
              </div>
              <div><Label>Luogo di Nascita</Label><Input value={luogoNascita} onChange={(e) => setLuogoNascita(e.target.value)} /></div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Email *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={!email.trim() ? "border-amber-400" : undefined} /></div>
                <div><Label>Telefono</Label><Input value={telefono} onChange={(e) => setTelefono(e.target.value)} /></div>
                <div><Label>PEC</Label><Input type="email" value={pec} onChange={(e) => setPec(e.target.value)} /></div>
              </div>
              <div><Label>Indirizzo Residenza *</Label><AddressAutocomplete value={indirizzoResidenza} onChange={setIndirizzoResidenza} onSelect={(c) => { setCapResidenza(c.cap); setCittaResidenza(c.citta); setProvinciaResidenza(c.provincia); }} /></div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>CAP</Label><Input value={capResidenza} onChange={(e) => setCapResidenza(e.target.value)} maxLength={5} /></div>
                <div><Label>Città</Label><Input value={cittaResidenza} onChange={(e) => setCittaResidenza(e.target.value)} /></div>
                <div><Label>Provincia</Label><Input value={provinciaResidenza} onChange={(e) => setProvinciaResidenza(e.target.value)} maxLength={2} /></div>
              </div>
            </>
          ) : (
            <>
              <div><Label>{tipoCliente === "ente" ? "Denominazione Ente *" : "Ragione Sociale *"}</Label><Input value={ragioneSociale} onChange={(e) => setRagioneSociale(e.target.value)} className={!ragioneSociale.trim() ? "border-amber-400" : undefined} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Partita IVA *</Label><FiscalCodeInput kind="piva" required value={partitaIva} onChange={(val) => {
                  setPartitaIva(val);
                  if (val.length === 11 && /^\d{11}$/.test(val) && !codiceFiscaleAzienda) {
                    setCodiceFiscaleAzienda(val);
                    toast.info("Codice Fiscale copiato dalla Partita IVA");
                  }
                }} /></div>
                <div><Label>Codice Fiscale {tipoCliente === "ente" ? "Ente *" : "Azienda"}</Label><FiscalCodeInput kind="cf-azienda" required={tipoCliente === "ente"} value={codiceFiscaleAzienda} onChange={(val) => {
                  setCodiceFiscaleAzienda(val);
                  if (val.length === 11 && /^\d{11}$/.test(val) && !partitaIva) {
                    setPartitaIva(val);
                    toast.info("Partita IVA copiata dal Codice Fiscale");
                  }
                }} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Codice SDI</Label><Input value={codiceSdi} onChange={(e) => setCodiceSdi(e.target.value)} maxLength={7} /></div>
                <div>
                  <Label>Forma Giuridica</Label>
                  <SearchableSelect
                    value={formaGiuridica}
                    onValueChange={setFormaGiuridica}
                    placeholder="Seleziona..."
                    options={[
                      { value: "srl", label: "SRL" },
                      { value: "srls", label: "SRLS" },
                      { value: "spa", label: "SPA" },
                      { value: "snc", label: "SNC" },
                      { value: "sas", label: "SAS" },
                      { value: "ditta_individuale", label: "Ditta Individuale" },
                      { value: "cooperativa", label: "Cooperativa" },
                      { value: "altro", label: "Altro" },
                    ]}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Email *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={!email.trim() ? "border-amber-400" : undefined} /></div>
                <div><Label>Telefono</Label><Input value={telefono} onChange={(e) => setTelefono(e.target.value)} /></div>
                <div><Label>PEC</Label><Input type="email" value={pec} onChange={(e) => setPec(e.target.value)} /></div>
              </div>
              <div>
                <Label>Note sul cliente</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note opzionali sul cliente..." />
              </div>
              <div><Label>Indirizzo Sede *</Label><AddressAutocomplete value={indirizzoSede} onChange={setIndirizzoSede} onSelect={(c) => { setCapSede(c.cap); setCittaSede(c.citta); setProvinciaSede(c.provincia); }} /></div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>CAP *</Label><Input value={capSede} onChange={(e) => setCapSede(e.target.value)} maxLength={5} className={!capSede.trim() ? "border-amber-400" : undefined} /></div>
                <div><Label>Città *</Label><Input value={cittaSede} onChange={(e) => setCittaSede(e.target.value)} className={!cittaSede.trim() ? "border-amber-400" : undefined} /></div>
                <div><Label>Provincia *</Label><Input value={provinciaSede} onChange={(e) => setProvinciaSede(e.target.value)} maxLength={2} className={!provinciaSede.trim() ? "border-amber-400" : undefined} /></div>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Referente {tipoCliente === "ente" ? "Ente" : "Aziendale"}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Nome Referente</Label><Input value={referenteNome} onChange={(e) => setReferenteNome(e.target.value)} /></div>
                  <div><Label>Cognome Referente</Label><Input value={referenteCognome} onChange={(e) => setReferenteCognome(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div><Label>Telefono Referente</Label><Input value={referenteTelefono} onChange={(e) => setReferenteTelefono(e.target.value)} /></div>
                  <div><Label>Email Referente</Label><Input type="email" value={referenteEmail} onChange={(e) => setReferenteEmail(e.target.value)} /></div>
                </div>
              </div>
            </>
          )}

          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Incarico</p>
            <div className="flex items-center gap-2">
              <Switch
                checked={haIncarico}
                onCheckedChange={(v) => {
                  setHaIncarico(v);
                  if (!v) {
                    setIncaricoDa(null);
                    setIncaricoA(null);
                  }
                }}
              />
              <Label>Ha incarico</Label>
            </div>
            {haIncarico && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data inizio incarico</Label>
                  <DatePicker value={incaricoDa} onChange={setIncaricoDa} placeholder="Seleziona data..." />
                </div>
                <div>
                  <Label>Data fine incarico</Label>
                  <DatePicker value={incaricoA} onChange={setIncaricoA} placeholder="Seleziona data..." />
                </div>
              </div>
            )}
            {haIncarico && incaricoDa && incaricoA && incaricoA < incaricoDa && (
              <p className="text-xs text-amber-600">La data fine incarico è precedente alla data inizio.</p>
            )}
          </div>

          <Accordion type="multiple" className="w-full border-t pt-4">
            <AccordionItem value="gestionali">
              <AccordionTrigger className="text-sm font-medium">Dati Gestionali</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Codice Ricerca</Label>
                      <Input value={codiceRicerca} onChange={(e) => setCodiceRicerca(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Titolo</Label>
                      <Select value={titolo} onValueChange={setTitolo}>
                        <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sig">Sig.</SelectItem>
                          <SelectItem value="sig_ra">Sig.ra</SelectItem>
                          <SelectItem value="dott">Dott.</SelectItem>
                          <SelectItem value="dott_ssa">Dott.ssa</SelectItem>
                          <SelectItem value="ing">Ing.</SelectItem>
                          <SelectItem value="avv">Avv.</SelectItem>
                          <SelectItem value="prof">Prof.</SelectItem>
                          <SelectItem value="rag">Rag.</SelectItem>
                          <SelectItem value="geom">Geom.</SelectItem>
                          <SelectItem value="spett">Spett.le</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Stato Cliente</Label>
                      <Select value={statoCliente} onValueChange={setStatoCliente}>
                        <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="attivo">Attivo</SelectItem>
                          <SelectItem value="sospeso">Sospeso</SelectItem>
                          <SelectItem value="cessato">Cessato</SelectItem>
                          <SelectItem value="prospect">Prospect</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div><Label className="text-xs">Cellulare</Label><Input value={cellulare} onChange={(e) => setCellulare(e.target.value)} /></div>
                    <div><Label className="text-xs">Fax</Label><Input value={fax} onChange={(e) => setFax(e.target.value)} /></div>
                    <div><Label className="text-xs">Nazione</Label><Input value={nazione} onChange={(e) => setNazione(e.target.value)} /></div>
                    <div><Label className="text-xs">Attenzione di</Label><Input value={attenzioneDi} onChange={(e) => setAttenzioneDi(e.target.value)} /></div>
                  </div>
                  {tipoCliente === "privato" && (
                    <div>
                      <Label className="text-xs">Note</Label>
                      <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="indirizzi_extra">
              <AccordionTrigger className="text-sm font-medium">Indirizzi Aggiuntivi</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-muted-foreground">Indirizzo Alternativo</p>
                  <div className="grid grid-cols-4 gap-3">
                    <div><Label className="text-xs">Indirizzo</Label><Input value={indirizzoAlternativo} onChange={(e) => setIndirizzoAlternativo(e.target.value)} /></div>
                    <div><Label className="text-xs">CAP</Label><Input value={capAlternativo} onChange={(e) => setCapAlternativo(e.target.value)} maxLength={5} /></div>
                    <div><Label className="text-xs">Città</Label><Input value={cittaAlternativa} onChange={(e) => setCittaAlternativa(e.target.value)} /></div>
                    <div><Label className="text-xs">Provincia</Label><Input value={provinciaAlternativa} onChange={(e) => setProvinciaAlternativa(e.target.value)} maxLength={2} /></div>
                  </div>
                  <p className="text-xs font-semibold text-muted-foreground">Indirizzo Fiscale</p>
                  <div className="grid grid-cols-4 gap-3">
                    <div><Label className="text-xs">Indirizzo</Label><Input value={indirizzoFiscale} onChange={(e) => setIndirizzoFiscale(e.target.value)} /></div>
                    <div><Label className="text-xs">CAP</Label><Input value={capFiscale} onChange={(e) => setCapFiscale(e.target.value)} maxLength={5} /></div>
                    <div><Label className="text-xs">Città</Label><Input value={cittaFiscale} onChange={(e) => setCittaFiscale(e.target.value)} /></div>
                    <div><Label className="text-xs">Provincia</Label><Input value={provinciaFiscale} onChange={(e) => setProvinciaFiscale(e.target.value)} maxLength={2} /></div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="statistici">
              <AccordionTrigger className="text-sm font-medium">Dati Statistici</AccordionTrigger>
              <AccordionContent>
                <DatiStatisticiCreate
                  zona={zona} setZona={setZona}
                  indotto={indotto} setIndotto={setIndotto}
                  attivita={attivita} setAttivita={setAttivita}
                  settore={settore} setSettore={setSettore}
                  contratto={contratto} setContratto={setContratto}
                  gruppoFinanziarioId={gruppoFinanziarioId} setGruppoFinanziarioId={setGruppoFinanziarioId}
                  gruppoStatistico={gruppoStatistico} setGruppoStatistico={setGruppoStatistico}
                  fasciaFatturato={fascia_fatturato} setFasciaFatturato={setFasciaFatturato}
                  fasciaDipendenti={fascia_dipendenti} setFasciaDipendenti={setFasciaDipendenti}
                  aziendaStat={aziendaStat} setAziendaStat={setAziendaStat}
                  matricola={matricola} setMatricola={setMatricola}
                  riferimento={riferimento} setRiferimento={setRiferimento}
                  codiceAteco={codiceAteco} setCodiceAteco={setCodiceAteco}
                  clienteAssociato={clienteAssociato} setClienteAssociato={setClienteAssociato}
                  clienteCaptive={clienteCaptive} setClienteCaptive={setClienteCaptive}
                  internazionale={internazionale} setInternazionale={setInternazionale}
                  gruppiFinanziari={gruppiFinanziari}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="contabili">
              <AccordionTrigger className="text-sm font-medium">Dati Contabili</AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Fido Credito €</Label>
                    <Input type="number" value={fidoCredito} onChange={(e) => setFidoCredito(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Fido Cauzioni €</Label>
                    <Input type="number" value={fidoCauzioni} onChange={(e) => setFidoCauzioni(e.target.value)} />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-foreground mb-3">Rete Commerciale</p>
            <div className="rounded-md border p-4 mb-3 bg-muted/30">
              <p className="text-sm font-medium mb-3">Account Executive</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Profilo</Label>
                  <SearchableSelect
                    value={ae.anagrafica_id}
                    onValueChange={(v) => updateRole(setAe, "anagrafica_id", v)}
                    placeholder="Seleziona AE..."
                    options={aeOpts}
                  />
                </div>
              </div>
            </div>
            {/* Specialist (DB ruolo "Backoffice") */}
            <div className={`rounded-md border p-4 mb-3 ${!backofficeRole.profilo_id ? "border-amber-400" : ""}`}>
              <p className="text-sm font-medium mb-3">Specialist *</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Profilo *</Label>
                  <SearchableSelect
                    value={backofficeRole.profilo_id}
                    onValueChange={(v) => updateRole(setBackofficeRole, "profilo_id", v)}
                    placeholder="Seleziona Specialist..."
                    options={profiliCommerciali}
                  />
                </div>
              </div>
            </div>

            {/* Sede (collegata allo Specialist) */}
            <div className={`rounded-md border p-4 mb-3 ${!ufficioClienteId ? "border-amber-400" : ""}`}>
              <p className="text-sm font-medium mb-1">Sede *</p>
              <p className="text-xs text-muted-foreground mb-3">
                Auto-compilata dallo Specialist selezionato, modificabile.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Sede / Ufficio *</Label>
                  <SearchableSelect
                    value={ufficioClienteId}
                    onValueChange={setUfficioClienteId}
                    placeholder="— Seleziona sede —"
                    options={(ufficiList || []).map((u: any) => ({
                      value: u.id,
                      label: `${u.codice_ufficio ? u.codice_ufficio + " - " : ""}${u.nome_ufficio}`,
                    }))}
                  />
                </div>
              </div>
            </div>

            {/* Produttore (anagrafiche_professionali tipo='corrispondente') */}
            <div className="rounded-md border p-4 mb-3">
              <p className="text-sm font-medium mb-3">Produttore</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Produttore</Label>
                  <SearchableSelect
                    value={produttoreSede.anagrafica_id}
                    onValueChange={(v) => {
                      updateRole(setProduttoreSede, "anagrafica_id", v);
                      if (!v) setMaturaProvvigioni(true);
                    }}
                    placeholder="Seleziona Produttore..."
                    options={produttoriOpts}
                  />
                </div>
              </div>
              {produttoreSede.anagrafica_id && (
                <div className="flex items-center gap-2 mt-3">
                  <Switch checked={maturaProvvigioni} onCheckedChange={setMaturaProvvigioni} />
                  <Label className="text-xs">Matura provvigioni su questo cliente</Label>
                </div>
              )}
            </div>
          </div>
          </>
          )}
        </div>

        <DialogFooter className="flex-col items-stretch sm:flex-row sm:items-center gap-2">
          {(() => {
            const missing = getMissingFields();
            const blocked = missing.length > 0;
            const preview = missing.slice(0, 4).join(", ") + (missing.length > 4 ? "…" : "");
            return (
              <>
                {blocked && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mr-auto">
                    Mancano: {preview}
                  </p>
                )}
                <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || blocked}
                  title={blocked ? "Compila i campi obbligatori prima di salvare" : undefined}
                >
                  {createMutation.isPending ? "Salvataggio..." : "Salva"}
                </Button>
              </>
            );
          })()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
