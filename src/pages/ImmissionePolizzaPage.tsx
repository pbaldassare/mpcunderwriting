import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { verificaNumeroPolizzaDuplicato } from "@/lib/clientiDuplicate";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

import { Search, Receipt, User, Info, Users, FileText, Calendar, Shield, DollarSign, Percent, Tag, ShieldCheck, UserCheck, Truck, Trash2 } from "lucide-react";
import { PremiGaranziaCardShell, emptyGaranziaRow, type GaranziaRow } from "@/components/polizze/PremiGaranziaCardShell";
import {
  LibroMatricolaDialog,
  assignProgressivi,
  filterRigheValide,
  rigaToDbPayload,
  type LibroMatricolaRiga,
} from "@/components/polizze/LibroMatricolaDialog";
import { insertLibroMatricolaOperazioni } from "@/lib/libroMatricolaOps";
import {
  syncQuietanzaFromFirma,
  markQuietanzaEdits,
  mirrorAllFromFirma,
  resetQuietanzaRow,
  isQuietanzaSincronizzata,
} from "@/components/polizze/premiSync";
import {
  calcProvvigioniGaranzia,
  premioRigaDbImporto,
  isRigaEsclusaProvvigioni,
  resolveRowPctNetto,
  resolveRowPctAccessori,
  provvPctBreakdown,
  calcTasseEffettiveRiga,
  type MatriceProvvAccessori,
} from "@/lib/calcProvvigioniGaranzia";
import { provvigioniImportoFromPct, provvigioniPctFromImporto } from "@/lib/provvigioniManual";

import { SearchableSelect } from "@/components/SearchableSelect";
import { ClienteSearchSelect } from "@/components/clienti/ClienteSearchSelect";
import { RamoSottoramoSelect } from "@/components/polizze/RamoSottoramoSelect";


import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { PROVINCE_IT, TIPI_PATENTE, defaultPatenteForVeicolo } from "@/lib/rcaConstants";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { parseCF } from "@/lib/parseCF";
import { lookupComune } from "@/lib/comuniItaliani";

// resolvePercentualeProvvigione non più usato: matrice caricata inline per calcolo per-riga
import { useRcaUsi } from "@/hooks/useRcaLookups";
import { useAccountExecutivesLookup } from "@/hooks/useAccountExecutivesLookup";
import { NuovoClienteDialog, type NuovoClienteInitialData } from "@/components/clienti/NuovoClienteDialog";
import { UserPlus, Sparkles, X } from "lucide-react";
import { PolizzaSection } from "@/components/polizze/PolizzaSection";
import { PageContainer } from "@/components/shared/PageContainer";
import { ImportNuovaPolizzaAIDialog, type MatchResult } from "@/components/polizze/ImportNuovaPolizzaAIDialog";
import { isGeneratedCigTemporaneo, isValidCigWithFlag, normalizeCig } from "@/lib/validateCig";
import { FieldHint } from "@/components/ui/field-hint";
import { useDraftPersistence, loadDraft, clearDraft } from "@/hooks/useDraftPersistence";
import { computeQuietanzePlan } from "@/lib/quietanzePlan";
import {
  FRAZIONAMENTI,
  frazionamentoMesi,
  frazionamentoToRate,
  isPremioUnicoAnticipato,
  isRataUnica,
} from "@/lib/frazionamento";
import { resizeRegolazioneDatePresunte } from "@/lib/regolazioneDatePresunte";
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
import { syncPeriodoTemporanea } from "@/lib/syncPeriodoTemporanea";
import { syncPeriodoRateo } from "@/lib/syncPeriodoRateo";
import { CoassicurazioneContrattoPanel } from "@/components/polizze/CoassicurazioneContrattoPanel";
import { CoassicurazioneImportiBreakdown } from "@/components/polizze/CoassicurazioneImportiBreakdown";
import { RcaDatiVeicoloSection } from "@/components/polizze/RcaDatiVeicoloSection";
import {
  validateRipartoSum,
  isRipartoSumValidForPreview,
  buildDettaglioRipartoInsert,
  buildDettaglioRipartoSingolo,
  type RipartoCoassicurazioneRow,
} from "@/lib/coassicurazione";


const ImmissionePolizzaPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedClienteId = searchParams.get("clienteId");
  // --- Modalità REGOLAZIONE PREMIO ---
  // Apertura da AppendiceDialog (Gestione Polizze) o da TitoloDetail.
  // La pagina precompila i dati dalla polizza madre e crea un nuovo titolo RG
  // collegato a una quietanza di riferimento (selezionabile via banner).
  const regolazioneMode = searchParams.get("mode") === "regolazione";
  const titoloMadreId = searchParams.get("titoloMadreId");
  const initialQuietanzaRefId = searchParams.get("quietanzaRefId");
  const [selectedQuietanzaRefId, setSelectedQuietanzaRefId] = useState<string>(initialQuietanzaRefId || "");
  const regolazionePrefilledRef = useRef<string | null>(null);
  const { user, profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [aiImportOpen, setAiImportOpen] = useState(false);
  const [nuovoClienteOpen, setNuovoClienteOpen] = useState(false);
  const [aiClientePrefill, setAiClientePrefill] = useState<NuovoClienteInitialData | null>(null);
  // Nonce per forzare il remount del NuovoClienteDialog quando arriva un nuovo prefill,
  // evitando race condition tra chiusura/riapertura e useEffect interni.
  const [nuovoClienteNonce, setNuovoClienteNonce] = useState(0);
  // PDF originale caricato dal flusso "Scansione AI Polizza": viene archiviato
  // come documento del titolo subito dopo la creazione della polizza.
  const [aiSourcePdf, setAiSourcePdf] = useState<{ name: string; base64: string; mimeType: string } | null>(null);

  const handleAIImportApply = (m: MatchResult) => {
    const d = m.data;
    if (m.sourcePdf) setAiSourcePdf(m.sourcePdf);
    if (m.cliente?.id) {
      setSelectedClienteId(m.cliente.id);
    } else if (m.isNewCliente) {
      // Apre NuovoClienteDialog precompilato: l'utente DEVE selezionare Gruppo Finanziario
      // (e Codice CIG per gli Enti) prima di poter salvare.
      const piva = (d.contraente_partita_iva || "").trim();
      const cf = (d.contraente_codice_fiscale || "").trim().toUpperCase();
      const nome = (d.contraente_nome || "").trim();
      const isAzienda = !!piva || (!!cf && cf.length === 11);

      // Fallback: se l'AI non ha estratto né nome né CF/P.IVA, avvisa l'utente.
      // Apriamo comunque il dialog (vuoto) così può completare a mano i campi obbligatori.
      const hasMinimalIdentity = !!nome || !!cf || !!piva;
      if (!hasMinimalIdentity) {
        toast.warning(
          "Dati cliente incompleti dal PDF: compila manualmente nome/ragione sociale, CF/P.IVA e il Gruppo Finanziario.",
        );
      }

      // Split Nome/Cognome per i clienti privato (convenzione "NOME COGNOME")
      let nomePrefill: string | undefined;
      let cognomePrefill: string | undefined;
      if (!isAzienda && nome) {
        const tokens = nome.split(/\s+/).filter(Boolean);
        if (tokens.length >= 2) {
          nomePrefill = tokens[0];
          cognomePrefill = tokens.slice(1).join(" ");
        } else {
          nomePrefill = nome;
        }
      }

      const prefill: NuovoClienteInitialData = {
        tipoCliente: m.tipoCliente ?? (isAzienda ? "azienda" : "privato"),
        ragioneSociale: isAzienda ? nome || undefined : undefined,
        nome: nomePrefill,
        cognome: cognomePrefill,
        codiceFiscale: cf || undefined,
        partitaIva: piva || undefined,
        email: d.contraente_email,
        telefono: d.contraente_telefono,
        indirizzo: d.contraente_indirizzo,
        cap: d.contraente_cap,
        citta: d.contraente_comune,
        provincia: d.contraente_provincia,
        nazione: d.contraente_nazione,
        gruppoFinanziarioId: m.gruppoFinanziarioId,
        codiceCig: m.codiceCig,
      };
      // Bumpiamo il nonce: il NuovoClienteDialog viene rimontato (key={nonce}),
      // garantendo stato pulito e applicazione deterministica del nuovo prefill.
      setAiClientePrefill(prefill);
      setNuovoClienteNonce((n) => n + 1);
      setNuovoClienteOpen(true);
      if (cf) setAiCfLookup(cf);
    } else if (d.contraente_codice_fiscale) {
      setAiCfLookup(d.contraente_codice_fiscale);
    }
    if (m.compagnia?.id) setSelectedCompagnia(m.compagnia.id);
    if (m.ramo) {
      setSelectedGruppoRamoId(m.ramo.gruppoRamoId);
      if (m.ramo.ramoId) setSelectedRamo(m.ramo.ramoId);
    }
    if (d.prodotto) setProdottoNome(d.prodotto);
    if (d.numero_polizza) setNumeroPolizza(d.numero_polizza);
    if (d.decorrenza) { setDurataDa(d.decorrenza); }
    if (d.scadenza) { setDurataA(d.scadenza); setDurataATouched(true); }
    if (typeof d.tacito_rinnovo === "boolean") setTacitoRinnovo(d.tacito_rinnovo);
    if (d.frazionamento) {
      const fraz = d.frazionamento.toLowerCase();
      const map: Record<string, string> = {
        annuale: "Annuale", semestrale: "Semestrale", quadrimestrale: "Quadrimestrale",
        trimestrale: "Trimestrale", mensile: "Mensile", poliennale: "Poliennale",
        "rata unica": "Rata unica", unica: "Rata unica",
      };
      if (map[fraz]) setFrazionamento(map[fraz]);
    }

    // Premi alla firma: se l'AI ha estratto voci di garanzia dal PDF, crea N righe
    // (una per voce) come nel manuale; altrimenti fallback alla riga unica con i totali.
    const gruppoRamoIdForRows = m.ramo?.gruppoRamoId || null;
    const ramiPerGruppo = (ramiList || []).filter(
      (r: any) => !gruppoRamoIdForRows || r.gruppo_ramo_id === gruppoRamoIdForRows,
    );
    if (Array.isArray(d.garanzie) && d.garanzie.length > 0) {
      const rows: GaranziaRow[] = d.garanzie.map((g) => {
        const codice = (g.codice_sottoramo || "").trim();
        const match = codice ? ramiPerGruppo.find((r: any) => r.codice === codice) : null;
        const ssnAttivo = !!match?.ssn_attivo;
        const aliquotaSsn = ssnAttivo ? (Number(match?.aliquota_ssn) || 10.5) : 0;
        const dirittiAgenzia = !!match?.diritti_agenzia;
        const escludiProvvigioni = !!match?.escludi_provvigioni;
        const netto = dirittiAgenzia ? 0 : (g.premio_netto != null ? Number(g.premio_netto) : 0);
        const ssnFromAi = g.ssn != null ? Number(g.ssn) : null;
        const ssnAuto = ssnAttivo && netto > 0 ? +((netto * aliquotaSsn) / 100).toFixed(2) : 0;
        // Aliquota tasse: priorità al sottoramo DB (verità canonica), poi al valore AI, poi 0.
        const aliquotaDb = match && match.aliquota_tasse_ramo != null
          ? Number(match.aliquota_tasse_ramo) : null;
        const aliquotaTasse = aliquotaDb != null
          ? aliquotaDb
          : (typeof g.aliquota_tasse_pct === "number" ? g.aliquota_tasse_pct : 0);
        // Tasse: se l'AI non le ha estratte e abbiamo aliquota+netto, calcolale.
        let tasseStr = "";
        if (dirittiAgenzia) {
          tasseStr = g.premio_imposte != null ? String(g.premio_imposte) : ((g as any).premio_lordo != null ? String((g as any).premio_lordo) : "");
        } else if (g.premio_imposte != null) {
          tasseStr = String(g.premio_imposte);
        } else if (aliquotaTasse > 0 && netto > 0) {
          tasseStr = (+((netto * aliquotaTasse) / 100).toFixed(2)).toFixed(2);
        }
        return {
          ...emptyGaranziaRow(),
          codice: match?.codice ?? (codice || null),
          sottoramoId: match?.id ?? null,
          descrizione: g.descrizione || match?.descrizione || "",
          netto: dirittiAgenzia ? "" : (g.premio_netto != null ? String(g.premio_netto) : ""),
          tasse: tasseStr,
          aliquotaTasse: dirittiAgenzia ? 0 : aliquotaTasse,
          ssnAttivo: dirittiAgenzia ? false : ssnAttivo,
          aliquotaSsn: dirittiAgenzia ? 0 : aliquotaSsn,
          ssn: dirittiAgenzia ? "" : (ssnFromAi != null ? String(ssnFromAi) : (ssnAuto > 0 ? ssnAuto.toFixed(2) : "")),
          ssnManualOverride: dirittiAgenzia ? false : ssnFromAi != null,
          escludiProvvigioni,
          dirittiAgenzia,
        };
      });
      setPremiFirmaRows(rows);
    } else if (d.premio_firma_netto != null || d.premio_firma_imposte != null) {
      setPremiFirmaRows([{ ...emptyGaranziaRow(), netto: d.premio_firma_netto != null ? String(d.premio_firma_netto) : "", tasse: d.premio_firma_imposte != null ? String(d.premio_firma_imposte) : "" }]);
    }
    if (d.premio_firma_accessori != null) setAddizionali(String(d.premio_firma_accessori));
    if (d.premio_quietanza_netto != null || d.premio_quietanza_imposte != null) {
      setPremiQuietanzaRows([{ ...emptyGaranziaRow(), netto: d.premio_quietanza_netto != null ? String(d.premio_quietanza_netto) : "", tasse: d.premio_quietanza_imposte != null ? String(d.premio_quietanza_imposte) : "" }]);
    }
    if (d.premio_quietanza_accessori != null) setAddizionaliQuietanza(String(d.premio_quietanza_accessori));
    if (d.targa) setTargaTelaio(d.targa);

    // === RCA Auto: applica blocco veicolo + conducente ===
    const v = d.veicolo as undefined | {
      targa?: string; telaio?: string; marca?: string; modello?: string; versione?: string;
      descrizione?: string; tipo_veicolo?: string; uso_descrizione?: string;
      data_immatricolazione?: string; anno_acquisto?: string; provincia_circolazione?: string;
      classe_bm?: string; cv?: number; kw?: number; cc?: number; posti?: number;
      peso_motrice?: number; peso_rimorchio?: number; peso_totale?: number;
      alimentazione?: string; tipologia_guida?: string;
      franchigia?: number; massimale_1?: number; massimale_2?: number; massimale_3?: number;
      peius?: boolean; temporanea?: boolean; carico_scarico?: boolean; competizione?: boolean; rimorchio?: boolean;
    };
    const cond = d.conducente as undefined | {
      nome?: string; cognome?: string; codice_fiscale?: string; indirizzo?: string;
      cap?: string; citta?: string; provincia?: string; data_nascita?: string;
      tipo_patente?: string; data_rilascio_patente?: string;
    };
    const ramoIsAuto =
      !!m.polizzaAuto ||
      (m.ramo?.gruppoRamoId && /^ZQ$/i.test(String((m.ramo as any).codice || ""))) ||
      !!(v && (v.targa || v.telaio || v.marca));
    if (ramoIsAuto) {
      setPolizzaAuto(true);
    }
    const prefilledKeys: string[] = [];
    let vCount = 0, cCount = 0;
    if (v && (v.targa || v.telaio || v.marca)) {
      setPolizzaAuto(true);
      if (v.targa) { setVTarga(v.targa.toUpperCase()); if (!d.targa) setTargaTelaio(v.targa.toUpperCase()); prefilledKeys.push("vTarga"); vCount++; }
      if (v.telaio) { setVTelaio(v.telaio.toUpperCase()); prefilledKeys.push("vTelaio"); vCount++; }
      if (v.marca) { setVMarca(v.marca.toUpperCase()); prefilledKeys.push("vMarca"); vCount++; }
      if (v.modello) { setVModello(v.modello.toUpperCase()); prefilledKeys.push("vModello"); vCount++; }
      if (v.versione) { setVVersione(v.versione); prefilledKeys.push("vVersione"); vCount++; }
      if (v.descrizione) { setVDescrizione(v.descrizione); prefilledKeys.push("vDescrizione"); vCount++; }
      if (v.tipo_veicolo) {
        setVTipoVeicolo(v.tipo_veicolo.toUpperCase());
        setVSettore(v.tipo_veicolo);
        prefilledKeys.push("vTipoVeicolo"); vCount++;
      }
      if (v.data_immatricolazione) { setVDataImmatricolazione(v.data_immatricolazione); prefilledKeys.push("vDataImmatricolazione"); vCount++; }
      if (v.anno_acquisto) { setVAnnoAcquisto(String(v.anno_acquisto)); prefilledKeys.push("vAnnoAcquisto"); vCount++; }
      if (v.provincia_circolazione) { setVProvinciaCircolazione(v.provincia_circolazione.toUpperCase()); prefilledKeys.push("vProvinciaCircolazione"); vCount++; }
      if (v.classe_bm) { setVClasseBm(String(v.classe_bm)); prefilledKeys.push("vClasseBm"); vCount++; }
      if (v.cv != null) { setVCv(String(v.cv)); prefilledKeys.push("vCv"); vCount++; }
      if (v.kw != null) { setVKw(String(v.kw)); prefilledKeys.push("vKw"); vCount++; }
      if (v.cc != null) { setVCc(String(v.cc)); prefilledKeys.push("vCc"); vCount++; }
      if (v.posti != null) { setVPosti(String(v.posti)); prefilledKeys.push("vPosti"); vCount++; }
      if (v.peso_motrice != null) { setVPesoMotrice(String(v.peso_motrice)); prefilledKeys.push("vPesoMotrice"); vCount++; }
      if (v.peso_rimorchio != null) { setVPesoRimorchio(String(v.peso_rimorchio)); prefilledKeys.push("vPesoRimorchio"); vCount++; }
      if (v.peso_totale != null) { setVPesoTotale(String(v.peso_totale)); prefilledKeys.push("vPesoTotale"); vCount++; }
      if (v.alimentazione) { setVTipoAlimentazione(v.alimentazione); prefilledKeys.push("vTipoAlimentazione"); vCount++; }
      if (v.tipologia_guida) { setVTipologiaGuida(v.tipologia_guida); prefilledKeys.push("vTipologiaGuida"); vCount++; }
      if (v.franchigia != null) { setVFranchigia(String(v.franchigia)); prefilledKeys.push("vFranchigia"); vCount++; }
      if (v.massimale_1 != null) { setVMass1(String(v.massimale_1)); prefilledKeys.push("vMass1"); vCount++; }
      if (v.massimale_2 != null) { setVMass2(String(v.massimale_2)); prefilledKeys.push("vMass2"); vCount++; }
      if (v.massimale_3 != null) { setVMass3(String(v.massimale_3)); prefilledKeys.push("vMass3"); vCount++; }
      if (v.peius != null) { setVPeius(!!v.peius); if (v.peius) vCount++; }
      if (v.temporanea != null) { setVTemporanea(!!v.temporanea); if (v.temporanea) vCount++; }
      if (v.carico_scarico != null) { setVCaricoScarico(!!v.carico_scarico); if (v.carico_scarico) vCount++; }
      if (v.competizione != null) { setVCompetizione(!!v.competizione); if (v.competizione) vCount++; }
      if (v.rimorchio != null) { setVRimorchio(!!v.rimorchio); if (v.rimorchio) vCount++; }
    }
    if (cond) {
      if (cond.nome) { setCNome(cond.nome); prefilledKeys.push("cNome"); cCount++; }
      if (cond.cognome) { setCCognome(cond.cognome); prefilledKeys.push("cCognome"); cCount++; }
      if (cond.indirizzo) { setCIndirizzo(cond.indirizzo); prefilledKeys.push("cIndirizzo"); cCount++; }
      if (cond.cap) { setCCap(cond.cap); prefilledKeys.push("cCap"); cCount++; }
      if (cond.citta) { setCCitta(cond.citta); prefilledKeys.push("cCitta"); cCount++; }
      if (cond.provincia) { setCProvincia(cond.provincia.toUpperCase()); prefilledKeys.push("cProvincia"); cCount++; }
      if (cond.data_nascita) { setCDataNascita(cond.data_nascita); prefilledKeys.push("cDataNascita"); cCount++; }
      if (cond.tipo_patente) { setCTipoPatente(cond.tipo_patente); prefilledKeys.push("cTipoPatente"); cCount++; }
      if (cond.data_rilascio_patente) { setCDataRilascioPatente(cond.data_rilascio_patente); prefilledKeys.push("cDataRilascioPatente"); cCount++; }
    }
    // Fallback: se provincia_circolazione manca ma c'è quella del conducente, usala
    if (v && !v.provincia_circolazione && cond?.provincia) {
      setVProvinciaCircolazione(cond.provincia.toUpperCase());
      prefilledKeys.push("vProvinciaCircolazione");
    }
    if (prefilledKeys.length) markAiPrefilled(...prefilledKeys);

    toast.success(m.isNewCliente && !m.cliente?.id
      ? "Dati applicati. Completa la creazione del nuovo cliente (Gruppo Finanziario obbligatorio)."
      : ramoIsAuto && (vCount || cCount)
        ? `AI ha compilato ${vCount} campi veicolo + ${cCount} campi conducente`
        : "Dati applicati al form");
  };


  // Form state — Cliente
  const [aiCfLookup, setAiCfLookup] = useState(""); // CF/P.IVA arrivato da import AI per auto-selezione
  const [selectedAE, setSelectedAE] = useState("");
  const [selectedAccountExecutiveId, setSelectedAccountExecutiveId] = useState("");
  const [selectedClienteId, setSelectedClienteId] = useState(() => preselectedClienteId || "");
  const [selectedUfficioId, setSelectedUfficioId] = useState("");
  const [selectedBackofficeId, setSelectedBackofficeId] = useState("");
  const [produttoreEscludiProvvigioni, setProduttoreEscludiProvvigioni] = useState(false);

  // Form state — Polizza
  const [numeroPolizza, setNumeroPolizza] = useState("");
  const [notePolizza, setNotePolizza] = useState("");
  const [tipoOperazione, setTipoOperazione] = useState("polizza");
  const [emittenda, setEmittenda] = useState(false);
  const [emittendaLoading, setEmittendaLoading] = useState(false);
  const [polizzaAuto, setPolizzaAuto] = useState(false);
  const [righeMatricola, setRigheMatricola] = useState<LibroMatricolaRiga[]>([]);
  const [matricolaDialogOpen, setMatricolaDialogOpen] = useState(false);
  const isLibroMatricola = tipoOperazione === "libro_matricola";

  const generaNumeroEmittenda = useCallback(async () => {
    setEmittendaLoading(true);
    try {
      const { data, error } = await supabase.rpc("next_numero_emittenda");
      if (error) throw error;
      const num = String(data || "").trim();
      if (!num) throw new Error("Numero emittenda vuoto");
      setNumeroPolizza(num);
      return num;
    } catch (e: any) {
      toast.error(e?.message || "Impossibile generare il numero emittenda");
      return null;
    } finally {
      setEmittendaLoading(false);
    }
  }, []);

  const onEmittendaChange = useCallback(async (checked: boolean) => {
    setEmittenda(checked);
    if (!checked) return; // uncheck: lascia il numero editabile
    if (!numeroPolizza.trim()) {
      const num = await generaNumeroEmittenda();
      if (!num) setEmittenda(false);
    }
  }, [numeroPolizza, generaNumeroEmittenda]);
  
  

  // Contratto
  const [selectedCompagnia, setSelectedCompagnia] = useState("");
  const [selectedGruppoCompagniaId, setSelectedGruppoCompagniaId] = useState<string>("");
  const [selectedRapportoId, setSelectedRapportoId] = useState<string>("");
  const [coassicurazione, setCoassicurazione] = useState(false);
  const [ripartoRows, setRipartoRows] = useState<RipartoCoassicurazioneRow[]>([]);
  const [selectedRamo, setSelectedRamo] = useState("");
  const [selectedGruppoRamoId, setSelectedGruppoRamoId] = useState<string | null>(null);
  /** Sottoramo di default proposto nelle nuove righe garanzia (Firma + Quietanza). */
  const [defaultSottoramoId, setDefaultSottoramoId] = useState<string | null>(null);

  const [prodottoNome, setProdottoNome] = useState("");
  // 'specialist' hardcoded state rimosso: ora si usa solo selectedBackofficeId
  
  const [cigRif, setCigRif] = useState("");
  const [cigTemporaneo, setCigTemporaneo] = useState(false);
  const [cigTemporaneoLoading, setCigTemporaneoLoading] = useState(false);

  const generaCigTemporaneo = useCallback(async () => {
    setCigTemporaneoLoading(true);
    try {
      const { data, error } = await supabase.rpc("next_cig_temporaneo");
      if (error) throw error;
      const num = String(data || "").trim();
      if (!num) throw new Error("CIG temporaneo vuoto");
      setCigRif(num);
      return num;
    } catch (e: any) {
      toast.error(e?.message || "Impossibile generare il CIG temporaneo");
      return null;
    } finally {
      setCigTemporaneoLoading(false);
    }
  }, []);

  const onCigTemporaneoChange = useCallback(async (checked: boolean) => {
    setCigTemporaneo(checked);
    if (!checked) return;
    const cig = normalizeCig(cigRif);
    if (!cig || isGeneratedCigTemporaneo(cig)) {
      const num = await generaCigTemporaneo();
      if (!num) setCigTemporaneo(false);
    }
  }, [cigRif, generaCigTemporaneo]);
  const [vincolo, setVincolo] = useState("");
  const [targaTelaio, setTargaTelaio] = useState("");
  const [descrizionePolizza, setDescrizionePolizza] = useState("");

  // Periodo — Durata Da/A partono vuote; l'autocalcolo parte quando l'utente valorizza Durata Da
  const [durataDa, setDurataDa] = useState("");
  const [durataA, setDurataA] = useState("");
  const [durataATouched, setDurataATouched] = useState(false);
  const [anniDurata, setAnniDurata] = useState("1");
  const [tacitoRinnovo, setTacitoRinnovo] = useState(true);
  const [polizzaTemporanea, setPolizzaTemporanea] = useState(false);
  const [polizzaRateo, setPolizzaRateo] = useState(false);
  const [frazionamento, setFrazionamento] = useState<string>("Annuale");
  const [moraGiorni, setMoraGiorni] = useState("15");
  const [garanziaDa, setGaranziaDa] = useState("");
  const [garanziaDaTouched, setGaranziaDaTouched] = useState(false);
  const [garanziaA, setGaranziaA] = useState("");
  const [garanziaATouched, setGaranziaATouched] = useState(false);
  const [dataCompetenza, setDataCompetenza] = useState("");
  const [dataCompetenzaTouched, setDataCompetenzaTouched] = useState(false);
  const [limiteMora, setLimiteMora] = useState("");
  const [limiteMoraTouched, setLimiteMoraTouched] = useState(false);
  const [disdettaGiorni, setDisdettaGiorni] = useState("");


  // Regolazione (promemoria) — allineato a TitoloDetail
  const [regolazione, setRegolazione] = useState(false);
  const [regolazioneDatePresunte, setRegolazioneDatePresunte] = useState<string[]>([]);
  /** Compat draft/legacy: prima data dell'array */
  const regolazioneDataPresunta = regolazioneDatePresunte[0] ?? "";
  const regolazioneDateTouchedRef = useRef<boolean[]>([]);
  /** Righe esplicite fattori regolazione (solo quelle aggiunte con +) */
  const [regolazioneRighe, setRegolazioneRighe] = useState<RegolazioneFattoreRiga[]>([]);
  const [regolazioneNote, setRegolazioneNote] = useState("");

  // Importi — multi-row garanzie
  const [premiFirmaRows, setPremiFirmaRows] = useState<GaranziaRow[]>([emptyGaranziaRow()]);
  const [premiQuietanzaRows, setPremiQuietanzaRows] = useState<GaranziaRow[]>([emptyGaranziaRow()]);
  const [addizionali, setAddizionali] = useState("0");
  const [valuta, setValuta] = useState("EUR");
  const [addizionaliQuietanza, setAddizionaliQuietanza] = useState("0");
  // Flags
  const [rimborso, setRimborso] = useState(false);
  const [indicizzata, setIndicizzata] = useState(false);
  const [noCalcoloTasse, setNoCalcoloTasse] = useState(false);
  const [pagDirettoCompagnia, setPagDirettoCompagnia] = useState(false);
  const [emissioneFee, setEmissioneFee] = useState(false);
  const [formatoElettronico, setFormatoElettronico] = useState(false);
  const [cambio, setCambio] = useState("1");
  // Flag: percentuale commerciale auto-popolata da produttori_provvigioni_ramo
  const [percentualeCommercialeAuto, setPercentualeCommercialeAuto] = useState(false);

  // Provvigioni: auto-popolata da resolvePercentualeProvvigione (Rapporto + Ramo + Sottoramo)
  const [percentualeProvvigione, setPercentualeProvvigione] = useState("");
  const [percentualeProvvigioneAuto, setPercentualeProvvigioneAuto] = useState(true);
  const [manualProvvImportoFirma, setManualProvvImportoFirma] = useState<number | null>(null);
  const [manualProvvImportoQuietanza, setManualProvvImportoQuietanza] = useState<number | null>(null);
  const [manualProvvFromEuroFirma, setManualProvvFromEuroFirma] = useState(false);
  const [manualProvvFromEuroQuietanza, setManualProvvFromEuroQuietanza] = useState(false);
  const [provvigioneFonte, setProvvigioneFonte] = useState<string>("");
  const [provvigioneWarning, setProvvigioneWarning] = useState<string>("");

  // Brokeraggio (quota del Produttore — default da anagrafiche_professionali.percentuale_consulenza)
  const [percentualeBrokeraggio, setPercentualeBrokeraggio] = useState("");
  const [percentualeBrokeraggioAuto, setPercentualeBrokeraggioAuto] = useState(false);

  // Quota provvigione Account Executive (default 0 — AE = produttore aggiuntivo, residuo a Consul)
  const [percentualeAE, setPercentualeAE] = useState("0");

  // === RCA AUTO State ===
  // Veicolo
  const [vSettore, setVSettore] = useState("Autovetture");
  const [vTipoVeicolo, setVTipoVeicolo] = useState("AUTOVETTURA");
  const [vUso, setVUso] = useState("");
  const [vMarca, setVMarca] = useState("");
  const [vModello, setVModello] = useState("");
  const [vVersione, setVVersione] = useState("");
  const [vTarga, setVTarga] = useState("");
  const [vTelaio, setVTelaio] = useState("");
  const [vDescrizione, setVDescrizione] = useState("");
  const [vDataImmatricolazione, setVDataImmatricolazione] = useState("");
  const [vAnnoAcquisto, setVAnnoAcquisto] = useState("");
  const [vProvinciaCircolazione, setVProvinciaCircolazione] = useState("");
  const [vClasseBm, setVClasseBm] = useState("");

  // RCA lookup hooks
  const { data: rcaUsi } = useRcaUsi();
  const [vMass1, setVMass1] = useState("0");
  const [vMass2, setVMass2] = useState("0");
  const [vMass3, setVMass3] = useState("0");
  const [vPeius, setVPeius] = useState(false);
  const [vFranchigia, setVFranchigia] = useState("0");
  const [vTemporanea, setVTemporanea] = useState(false);
  const [vCaricoScarico, setVCaricoScarico] = useState(false);
  const [vCompetizione, setVCompetizione] = useState(false);
  const [vRimorchio, setVRimorchio] = useState(false);
  const [vCv, setVCv] = useState("0");
  const [vKw, setVKw] = useState("0");
  const [vCc, setVCc] = useState("0");
  const [vPosti, setVPosti] = useState("0");
  const [vPesoMotrice, setVPesoMotrice] = useState("0");
  const [vPesoRimorchio, setVPesoRimorchio] = useState("0");
  const [vPesoTotale, setVPesoTotale] = useState("0");
  const [vTipologiaGuida, setVTipologiaGuida] = useState("");
  const [vTipoAlimentazione, setVTipoAlimentazione] = useState("");
  // (Le righe garanzia/Firma/Quietanza sono in premiFirmaRows / premiQuietanzaRows.)
  // Conducente
  const [cNome, setCNome] = useState("");
  const [cCognome, setCCognome] = useState("");
  const [cIndirizzo, setCIndirizzo] = useState("");
  const [cCap, setCCap] = useState("");
  const [cCitta, setCCitta] = useState("");
  const [cProvincia, setCProvincia] = useState("");
  const [cDataNascita, setCDataNascita] = useState("");
  const [cTipoPatente, setCTipoPatente] = useState("");
  const [cDataRilascioPatente, setCDataRilascioPatente] = useState("");
  const [cNote, setCNote] = useState("");

  // Tracciamento campi compilati dall'AI (per indicatore visivo ✨)
  const [aiPrefilled, setAiPrefilled] = useState<Set<string>>(new Set());
  const markAiPrefilled = (...keys: string[]) => {
    setAiPrefilled((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.add(k));
      return next;
    });
  };
  const clearAiPrefilled = (key: string) => {
    setAiPrefilled((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };
  // Toggle "Conducente = Contraente"
  const [conducenteUgualeContraente, setConducenteUgualeContraente] = useState(false);
  // Lock sincronizzazione KW/CV (se l'utente edita manualmente uno dei due)
  const [kwCvLocked, setKwCvLocked] = useState<null | "cv" | "kw">(null);

  // Commerciale

  const [selectedCommerciale, setSelectedCommerciale] = useState("__sede__");
  const [percentualeCommerciale, setPercentualeCommerciale] = useState("100");
  type SplitRowForm = { anagrafica_commerciale_id: string | null; percentuale: number };
  const [splitsForm, setSplitsForm] = useState<SplitRowForm[]>([]);

  // === Autosave bozza locale (localStorage) ===
  const draftKey = `immissione:v1:${selectedClienteId || preselectedClienteId || "new"}`;
  const [draftRestoredAt, setDraftRestoredAt] = useState<number | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const draftHydratedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (draftHydratedKeyRef.current === draftKey) return;
    draftHydratedKeyRef.current = draftKey;
    const loaded = loadDraft<Record<string, any>>(draftKey);
    if (loaded?.data) {
      const d = loaded.data;
      const setters: Record<string, (v: any) => void> = {
        selectedAE: setSelectedAE,
        selectedAccountExecutiveId: setSelectedAccountExecutiveId,
        selectedClienteId: setSelectedClienteId,
        selectedUfficioId: setSelectedUfficioId,
        selectedBackofficeId: setSelectedBackofficeId,
        numeroPolizza: setNumeroPolizza,
        notePolizza: setNotePolizza,
        tipoOperazione: (v: any) => {
          // Legacy bozza: tipoOperazione "emittenda" → polizza + flag
          if (v === "emittenda") {
            setTipoOperazione("polizza");
            setEmittenda(true);
            return;
          }
          setTipoOperazione(v);
        },
        emittenda: setEmittenda,
        polizzaAuto: setPolizzaAuto,
        selectedCompagnia: setSelectedCompagnia,
        selectedGruppoCompagniaId: setSelectedGruppoCompagniaId,
        selectedRapportoId: setSelectedRapportoId,
        coassicurazione: setCoassicurazione,
        ripartoRows: (v: unknown) => setRipartoRows(Array.isArray(v) ? v : []),
        selectedRamo: setSelectedRamo,
        selectedGruppoRamoId: setSelectedGruppoRamoId,
        prodottoNome: setProdottoNome,
        cigRif: setCigRif,
        cigTemporaneo: setCigTemporaneo,
        vincolo: setVincolo,
        targaTelaio: setTargaTelaio,
        descrizionePolizza: setDescrizionePolizza,
        durataDa: setDurataDa,
        durataA: setDurataA,
        durataATouched: setDurataATouched,
        anniDurata: setAnniDurata,
        tacitoRinnovo: setTacitoRinnovo,
        polizzaTemporanea: setPolizzaTemporanea,
        polizzaRateo: setPolizzaRateo,
        frazionamento: setFrazionamento,
        moraGiorni: setMoraGiorni,
        garanziaDa: setGaranziaDa,
        garanziaDaTouched: setGaranziaDaTouched,
        garanziaA: setGaranziaA,
        garanziaATouched: setGaranziaATouched,
        dataCompetenza: setDataCompetenza,
        dataCompetenzaTouched: setDataCompetenzaTouched,
        limiteMora: setLimiteMora,
        limiteMoraTouched: setLimiteMoraTouched,
        disdettaGiorni: setDisdettaGiorni,
        regolazione: setRegolazione,
        regolazioneDatePresunte: (dates: string[]) => {
          const arr = Array.isArray(dates) ? dates : [];
          setRegolazioneDatePresunte(arr);
          regolazioneDateTouchedRef.current = arr.map(() => true);
        },
        regolazioneDataPresunta: (v: string) => {
          // Migrazione bozze vecchie: sola stringa → array (skip se già presente array)
          if (Array.isArray(d.regolazioneDatePresunte)) return;
          if (v) {
            setRegolazioneDatePresunte([v]);
            regolazioneDateTouchedRef.current = [true];
          }
        },
        regolazioneRighe: (v: RegolazioneFattoreRiga[]) => {
          if (Array.isArray(v)) setRegolazioneRighe(v);
        },
        // Bozze legacy: mappa importi → lista righe (skip se già presente formato nuovo)
        regolazioneImporti: (v: Record<string, number>) => {
          if (Array.isArray(d.regolazioneRighe)) return;
          if (!v || typeof v !== "object" || Array.isArray(v)) return;
          const existing = Object.entries(v).map(([key, importo]) => {
            const [fattore_id, annoStr] = key.split("|");
            return {
              fattore_id,
              anno: Number(annoStr),
              importo_esposto: Number(importo) || 0,
            };
          }).filter((e) => e.fattore_id && Number.isFinite(e.anno));
          setRegolazioneRighe(buildRegolazioneFattoriRows({ existing }));
        },
        // Bozze legacy: singolo fattore (senza importi) — ignorato
        regolazioneFattore: () => {},
        regolazioneNote: setRegolazioneNote,
        premiFirmaRows: (v: unknown) =>
          setPremiFirmaRows(Array.isArray(v) && v.length ? v.filter(Boolean) : [emptyGaranziaRow()]),
        premiQuietanzaRows: (v: unknown) =>
          setPremiQuietanzaRows(Array.isArray(v) && v.length ? v.filter(Boolean) : [emptyGaranziaRow()]),
        addizionali: setAddizionali,
        valuta: setValuta,
        addizionaliQuietanza: setAddizionaliQuietanza,
        rimborso: setRimborso,
        indicizzata: setIndicizzata,
        noCalcoloTasse: setNoCalcoloTasse,
        pagDirettoCompagnia: setPagDirettoCompagnia,
        emissioneFee: setEmissioneFee,
        formatoElettronico: setFormatoElettronico,
        cambio: setCambio,
        percentualeCommercialeAuto: setPercentualeCommercialeAuto,
        percentualeProvvigione: setPercentualeProvvigione,
        percentualeProvvigioneAuto: setPercentualeProvvigioneAuto,
        percentualeBrokeraggio: setPercentualeBrokeraggio,
        percentualeBrokeraggioAuto: setPercentualeBrokeraggioAuto,
        percentualeAE: setPercentualeAE,
        vSettore: setVSettore,
        vTipoVeicolo: setVTipoVeicolo,
        vUso: setVUso,
        vMarca: setVMarca,
        vModello: setVModello,
        vVersione: setVVersione,
        vTarga: setVTarga,
        vTelaio: setVTelaio,
        vDescrizione: setVDescrizione,
        vDataImmatricolazione: setVDataImmatricolazione,
        vAnnoAcquisto: setVAnnoAcquisto,
        vProvinciaCircolazione: setVProvinciaCircolazione,
        vClasseBm: setVClasseBm,
        vMass1: setVMass1,
        vMass2: setVMass2,
        vMass3: setVMass3,
        vPeius: setVPeius,
        vFranchigia: setVFranchigia,
        vTemporanea: setVTemporanea,
        vCaricoScarico: setVCaricoScarico,
        vCompetizione: setVCompetizione,
        vRimorchio: setVRimorchio,
        vCv: setVCv,
        vKw: setVKw,
        vCc: setVCc,
        vPosti: setVPosti,
        vPesoMotrice: setVPesoMotrice,
        vPesoRimorchio: setVPesoRimorchio,
        vPesoTotale: setVPesoTotale,
        vTipologiaGuida: setVTipologiaGuida,
        vTipoAlimentazione: setVTipoAlimentazione,
        cNome: setCNome,
        cCognome: setCCognome,
        cIndirizzo: setCIndirizzo,
        cCap: setCCap,
        cCitta: setCCitta,
        cProvincia: setCProvincia,
        cDataNascita: setCDataNascita,
        cTipoPatente: setCTipoPatente,
        cDataRilascioPatente: setCDataRilascioPatente,
        cNote: setCNote,
        selectedCommerciale: setSelectedCommerciale,
        percentualeCommerciale: setPercentualeCommerciale,
      };
      // Campi che hanno un default ereditato dall'anagrafica cliente:
      // se la bozza ha valore vuoto/null, NON sovrascrivere così che vinca
      // il default proveniente da `clienti.ufficio_id` / `codici_commerciali_cliente`.
      const skipIfEmptyKeys = new Set([
        "selectedUfficioId",
        "selectedAE",
        "selectedAccountExecutiveId",
        "selectedBackofficeId",
      ]);
      for (const k of Object.keys(d)) {
        const fn = setters[k];
        if (!fn || d[k] === undefined) continue;
        if (skipIfEmptyKeys.has(k) && (d[k] === null || d[k] === "")) continue;
        fn(d[k]);
      }
      setDraftRestoredAt(loaded.ts);
    }
    setDraftHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const draftSnapshot = {
    selectedAE, selectedAccountExecutiveId, selectedClienteId, selectedUfficioId, selectedBackofficeId,
    numeroPolizza, notePolizza, tipoOperazione, emittenda, polizzaAuto,
    selectedCompagnia, selectedGruppoCompagniaId, selectedRapportoId, coassicurazione, ripartoRows, selectedRamo, selectedGruppoRamoId, prodottoNome,
    cigRif, cigTemporaneo, vincolo, targaTelaio, descrizionePolizza,
    durataDa, durataA, durataATouched, anniDurata, tacitoRinnovo, polizzaTemporanea, polizzaRateo, frazionamento, moraGiorni,
    garanziaDa, garanziaDaTouched, garanziaA, garanziaATouched, dataCompetenza, dataCompetenzaTouched,
    limiteMora, limiteMoraTouched, disdettaGiorni,
    regolazione, regolazioneDatePresunte, regolazioneDataPresunta, regolazioneRighe, regolazioneNote,
    premiFirmaRows, premiQuietanzaRows, addizionali, valuta, addizionaliQuietanza,
    rimborso, indicizzata, noCalcoloTasse, pagDirettoCompagnia, emissioneFee, formatoElettronico, cambio,
    percentualeCommercialeAuto,
    percentualeProvvigione, percentualeProvvigioneAuto,
    percentualeBrokeraggio, percentualeBrokeraggioAuto,
    percentualeAE,
    vSettore, vTipoVeicolo, vUso, vMarca, vModello, vVersione, vTarga, vTelaio, vDescrizione,
    vDataImmatricolazione, vAnnoAcquisto, vProvinciaCircolazione, vClasseBm,
    vMass1, vMass2, vMass3, vPeius, vFranchigia, vTemporanea, vCaricoScarico, vCompetizione, vRimorchio,
    vCv, vKw, vCc, vPosti, vPesoMotrice, vPesoRimorchio, vPesoTotale, vTipologiaGuida, vTipoAlimentazione,
    cNome, cCognome, cIndirizzo, cCap, cCitta, cProvincia, cDataNascita, cTipoPatente, cDataRilascioPatente, cNote,
    selectedCommerciale, percentualeCommerciale,
  };

  useDraftPersistence(draftKey, draftSnapshot, { enabled: draftHydrated });

  // Segnala al version-guard che c'è un form aperto: evita reload del bundle
  // mentre l'utente sta compilando la polizza (la pagina resterebbe
  // letteralmente refreshata con perdita di dati non ancora persistiti).
  useEffect(() => {
    (window as any).__lovableFormDirty = true;
    return () => { (window as any).__lovableFormDirty = false; };
  }, []);




  // --- Queries ---

  const { data: clienteData } = useQuery({
    queryKey: ["cliente-lookup", aiCfLookup],
    queryFn: async () => {
      if (!aiCfLookup || aiCfLookup.length < 2) return null;
      const { data } = await supabase
        .from("clienti")
        .select("id, nome, cognome, ragione_sociale, codice_fiscale, tipo_cliente, gruppo_finanziario_id")
        .or(`codice_fiscale.ilike.%${aiCfLookup}%,partita_iva.ilike.%${aiCfLookup}%,codice_ricerca.ilike.%${aiCfLookup}%`)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: aiCfLookup.length >= 2,
  });

  // Ricerca cliente: token AND su più nomi + indirizzo (RPC search_clienti_ranked)

  // Dettaglio cliente selezionato (per eredità ufficio)
  const { data: clienteDettaglio } = useQuery({
    queryKey: ["cliente-dettaglio-immissione", selectedClienteId],
    queryFn: async () => {
      if (!selectedClienteId) return null;
      const { data } = await supabase
        .from("clienti")
        .select("id, nome, cognome, ragione_sociale, codice_fiscale, partita_iva, tipo_cliente, ufficio_id, gruppo_finanziario_id, indirizzo_residenza, cap_residenza, citta_residenza, provincia_residenza, indirizzo_sede, cap_sede, citta_sede, provincia_sede, data_nascita, gruppi_finanziari!clienti_gruppo_finanziario_id_fkey(id, codice, nome, tipo_soggetto)")
        .eq("id", selectedClienteId)
        .maybeSingle();
      return data as any;
    },
    enabled: !!selectedClienteId,
  });

  const { data: clienteAE } = useQuery({
    queryKey: ["cliente-ae-bo", selectedClienteId],
    queryFn: async () => {
      if (!selectedClienteId) return [];
      const { data } = await supabase
        .from("codici_commerciali_cliente")
        .select("profilo_id, anagrafica_id, ruolo, escludi_provvigioni, profiles:profilo_id(id, nome, cognome)")
        .eq("cliente_id", selectedClienteId)
        .in("ruolo", ["account_executive", "AE", "Backoffice", "Produttore Sede"]);
      return data || [];
    },
    enabled: !!selectedClienteId,
  });

  // Default multi-valore di intermediari (produttori + AE) del cliente
  const { data: intermediariDefaultCliente } = useQuery({
    queryKey: ["cliente-intermediari-default", selectedClienteId],
    queryFn: async () => {
      if (!selectedClienteId) return [];
      const { data } = await (supabase as any)
        .from("clienti_intermediari_default")
        .select("tipo, anagrafica_commerciale_id, percentuale, ordine, escludi_provvigioni")
        .eq("cliente_id", selectedClienteId)
        .order("ordine", { ascending: true });
      return data || [];
    },
    enabled: !!selectedClienteId,
  });

  useEffect(() => {
    if (clienteData?.id) setSelectedClienteId(clienteData.id);
  }, [clienteData?.id]);

  // Pre-selezione cliente da query string (es. da scheda cliente)
  useEffect(() => {
    if (preselectedClienteId && !selectedClienteId) {
      setSelectedClienteId(preselectedClienteId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedClienteId]);

  // ============= REGOLAZIONE PREMIO: load polizza madre + quietanze + prefill =============
  const { data: polizzaMadre } = useQuery({
    queryKey: ["regolazione-polizza-madre", titoloMadreId],
    enabled: regolazioneMode && !!titoloMadreId,
    queryFn: async () => {
      const { data } = await supabase
        .from("titoli")
        .select(`*,
          cliente:clienti!titoli_cliente_anagrafica_id_fkey(id, ragione_sociale, nome, cognome),
          compagnia:compagnie!titoli_compagnia_id_fkey(id, nome),
          rapporto:compagnia_rapporti!titoli_compagnia_rapporto_id_fkey(id, codice_rapporto, nome_rapporto, tipo_rapporto)
        `)
        .eq("id", titoloMadreId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: quietanzePolizza } = useQuery({
    queryKey: ["regolazione-quietanze", polizzaMadre?.numero_titolo],
    enabled: regolazioneMode && !!polizzaMadre?.numero_titolo,
    queryFn: async () => {
      const { data } = await supabase
        .from("titoli")
        .select("id, numero_titolo, riga, durata_da, durata_a, stato, data_messa_cassa, premio_lordo")
        .eq("numero_titolo", polizzaMadre!.numero_titolo)
        .order("riga", { ascending: true });
      return data || [];
    },
  });

  // Prefill form da polizza madre (una sola volta per polizza)
  useEffect(() => {
    if (!regolazioneMode || !polizzaMadre) return;
    if (regolazionePrefilledRef.current === polizzaMadre.id) return;
    regolazionePrefilledRef.current = polizzaMadre.id;

    if (polizzaMadre.cliente_anagrafica_id) setSelectedClienteId(polizzaMadre.cliente_anagrafica_id);
    if (polizzaMadre.numero_titolo) setNumeroPolizza(polizzaMadre.numero_titolo);
    if (polizzaMadre.prodotto_nome) setProdottoNome(polizzaMadre.prodotto_nome);
    if (polizzaMadre.compagnia_id) setSelectedCompagnia(polizzaMadre.compagnia_id);
    if ((polizzaMadre as any).compagnia_rapporto_id) setSelectedRapportoId((polizzaMadre as any).compagnia_rapporto_id);
    if (polizzaMadre.ramo_id) setSelectedRamo(polizzaMadre.ramo_id);
    if (polizzaMadre.durata_da) setDurataDa(polizzaMadre.durata_da);
    if (polizzaMadre.durata_a) { setDurataA(polizzaMadre.durata_a); setDurataATouched(true); }
    if (polizzaMadre.anni_durata) setAnniDurata(String(polizzaMadre.anni_durata));
    if (polizzaMadre.frazionamento) setFrazionamento(polizzaMadre.frazionamento);
    if (typeof polizzaMadre.tacito_rinnovo === "boolean") setTacitoRinnovo(polizzaMadre.tacito_rinnovo);
    if (polizzaMadre.descrizione_polizza) setDescrizionePolizza(polizzaMadre.descrizione_polizza);
    if ((polizzaMadre as any).anagrafica_commerciale_id) setSelectedAE((polizzaMadre as any).anagrafica_commerciale_id);
    if ((polizzaMadre as any).ae_anagrafica_id) setSelectedAccountExecutiveId((polizzaMadre as any).ae_anagrafica_id);
    if (polizzaMadre.ufficio_id) setSelectedUfficioId(polizzaMadre.ufficio_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regolazioneMode, polizzaMadre]);

  // Quietanza di riferimento di default: l'ultima incassata, altrimenti l'ultima riga
  useEffect(() => {
    if (!regolazioneMode) return;
    if (selectedQuietanzaRefId) return;
    if (!quietanzePolizza || quietanzePolizza.length === 0) return;
    const incassate = quietanzePolizza.filter((q: any) => q.stato === "incassato" || q.data_messa_cassa);
    const target = incassate.length > 0 ? incassate[incassate.length - 1] : quietanzePolizza[quietanzePolizza.length - 1];
    if (target) setSelectedQuietanzaRefId(target.id);
  }, [regolazioneMode, quietanzePolizza, selectedQuietanzaRefId]);


  // Eredita ufficio dal cliente (solo se non già impostato manualmente o da bozza)
  useEffect(() => {
    if (clienteDettaglio?.ufficio_id && !selectedUfficioId) {
      setSelectedUfficioId(clienteDettaglio.ufficio_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteDettaglio?.ufficio_id]);

  // Tipo soggetto derivato dal Gruppo Finanziario del cliente (governa i campi obbligatori).
  // Fallback: se il GF non è ancora assegnato ma il cliente è marcato `tipo_cliente='ente'`,
  // consideralo comunque Ente così il campo CIG appare ed è obbligatorio.
  const tipoSoggetto: "privato" | "azienda" | "ente" | null = useMemo(() => {
    const gfRaw: any = clienteDettaglio?.gruppi_finanziari;
    const gf: any = Array.isArray(gfRaw) ? gfRaw[0] : gfRaw;
    const fromGf = (gf?.tipo_soggetto as any) ?? null;
    if (fromGf) return fromGf;
    const tc = clienteDettaglio?.tipo_cliente;
    if (tc === "ente") return "ente";
    if (tc === "azienda") return "azienda";
    if (tc === "privato") return "privato";
    return null;
  }, [clienteDettaglio]);
  const gruppoFinanziarioMancante = !!selectedClienteId && !tipoSoggetto;
  const cigObbligatorio = tipoSoggetto === "ente";
  const cigValido = !cigRif.trim() || isValidCigWithFlag(cigRif, cigTemporaneo);
  const saveBlockReason = !selectedClienteId
    ? "Seleziona prima un cliente"
    : gruppoFinanziarioMancante
      ? "Il cliente selezionato non ha un Gruppo Finanziario: aprilo nella scheda cliente e assegnalo prima di salvare la polizza"
      : !numeroPolizza.trim()
        ? "Il N° Polizza è obbligatorio"
        : !durataDa
          ? "Durata Da è obbligatoria"
          : !durataA
            ? "Durata A è obbligatoria"
            : (cigObbligatorio && !cigRif.trim())
              ? "Per i clienti di tipo Ente il CIG è obbligatorio"
              : (cigRif.trim() && !cigValido)
                ? "Il CIG deve essere di 10 caratteri alfanumerici (o spunta 'CIG temporaneo')"
                : coassicurazione
                  ? (() => {
                      const ripartoCheck = validateRipartoSum(ripartoRows);
                      return ripartoCheck.valid ? null : (ripartoCheck.message || "Riparto coassicurazione non valido");
                    })()
                  : null;

  // (eredità AE/Specialist/Produttore spostata sotto le query)

  // Default ufficio = ufficio dell'utente loggato
  useEffect(() => {
    if (profile?.ufficio_id && !selectedUfficioId) {
      setSelectedUfficioId(profile.ufficio_id);
    }
  }, [profile?.ufficio_id]);

  const { data: aeList } = useQuery({
    queryKey: ["produttori-list-immissione"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anagrafiche_professionali")
        .select("id, codice, cognome, nome, sigla, ragione_sociale, tipo, percentuale_base")
        .in("tipo", ["account_executive", "corrispondente", "responsabile_sede"])
        .eq("attivo", true)
        .order("cognome");
      return data || [];
    },
  });

  const { data: backofficeList } = useQuery({
    queryKey: ["backoffice-list-immissione"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, cognome, ruolo")
        .eq("ruolo", "backoffice")
        .eq("attivo", true)
        .order("cognome");
      return data || [];
    },
  });

  const { data: ufficiList } = useQuery({
    queryKey: ["uffici-list-immissione"],
    queryFn: async () => {
      const { data } = await supabase
        .from("uffici")
        .select("id, nome_ufficio, codice_ufficio")
        .eq("attivo", true)
        .order("nome_ufficio");
      return data || [];
    },
  });

  const { data: commercialiList } = useQuery({
    queryKey: ["commerciali-list-immissione"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, cognome, ruolo")
        .in("ruolo", ["account_executive", "executive", "produttore_sede", "responsabile_sede"])
        .eq("attivo", true)
        .order("cognome");
      return data || [];
    },
  });

  // Account Executive: fonte canonica = anagrafiche_professionali (tipo='account_executive').
  // Indipendenti dalla Sede: lista globale di tutti gli AE attivi.
  const { data: aeLookupData } = useAccountExecutivesLookup();
  const aeAnagraficheList = aeLookupData?.options ?? [];

  // Eredita AE, Specialist e Produttore dal cliente
  useEffect(() => {
    if (!Array.isArray(clienteAE) || clienteAE.length === 0) return;
    const ae = clienteAE.find((c: any) => c.ruolo === "account_executive" || c.ruolo === "AE");
    const bo = clienteAE.find((c: any) => c.ruolo === "Backoffice");
    const prod = clienteAE.find((c: any) => c.ruolo === "Produttore Sede");

    // AE: prima prova anagrafica_id, poi fallback per nome verso aeAnagraficheList
    if (ae?.anagrafica_id) {
      setSelectedAccountExecutiveId(ae.anagrafica_id as string);
    } else if (ae && Array.isArray(aeAnagraficheList) && aeAnagraficheList.length > 0 && !selectedAccountExecutiveId) {
      const aeProfile: any = ae.profiles;
      if (aeProfile) {
        const target = `${aeProfile.cognome || ""} ${aeProfile.nome || ""}`.trim().toLowerCase();
        if (target) {
          const match = aeAnagraficheList.find((a) => a.label.trim().toLowerCase() === target);
          if (match?.value) setSelectedAccountExecutiveId(match.value);
        }
      }
    }

    if (bo?.profilo_id && !selectedBackofficeId) setSelectedBackofficeId(bo.profilo_id as string);

    // Produttore: prima anagrafica_id, poi fallback per nome verso aeList (anagrafiche corrispondenti)
    if (prod?.anagrafica_id) {
      setSelectedAE(prod.anagrafica_id as string);
      setProduttoreEscludiProvvigioni(prod.escludi_provvigioni === true);
    } else if (prod && Array.isArray(aeList) && aeList.length > 0 && !selectedAE) {
      const prodProfile: any = prod.profiles;
      if (prodProfile) {
        const target = `${prodProfile.cognome || ""} ${prodProfile.nome || ""}`.trim().toLowerCase();
        if (target) {
          const match = (aeList).find((a: any) => {
            const label = (a.ragione_sociale || `${a.cognome || ""} ${a.nome || ""}`).trim().toLowerCase();
            return label === target;
          });
          if (match?.id) setSelectedAE(match.id as string);
        }
      }
      setProduttoreEscludiProvvigioni(prod.escludi_provvigioni === true);
    } else if (!prod) {
      setProduttoreEscludiProvvigioni(false);
    }
  }, [clienteAE, aeList, aeAnagraficheList]);

  // Applica una sola volta per cliente i default multi-valore (produttori + AE) alle nuove polizze
  const intermediariAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedClienteId) return;
    if (regolazioneMode) return; // in regolazione si eredita dalla madre
    const arr = intermediariDefaultCliente as any[] | undefined;
    if (!Array.isArray(arr)) return;
    if (intermediariAppliedRef.current === selectedClienteId) return;

    const prod = arr.filter((r) => r.tipo === "produttore");
    const ae = arr.filter((r) => r.tipo === "ae");

    if (prod.length > 0) {
      setSplitsForm(
        prod.map((r) => {
          const pctBase = (aeList || []).find((a: any) => a.id === r.anagrafica_commerciale_id)?.percentuale_base;
          const pct = Number(r.percentuale) > 0 ? Number(r.percentuale) : Number(pctBase) || 0;
          return { anagrafica_commerciale_id: r.anagrafica_commerciale_id as string, percentuale: pct };
        }),
      );
      const first = prod[0];
      setSelectedAE((cur) => cur || (first.anagrafica_commerciale_id as string));
      setProduttoreEscludiProvvigioni(!!first.escludi_provvigioni);
    }

    if (ae.length > 0) {
      const firstAe = ae[0];
      setSelectedAccountExecutiveId((cur) => cur || (firstAe.anagrafica_commerciale_id as string));
      if (Number(firstAe.percentuale) > 0) {
        setPercentualeAE((cur) => (cur && cur !== "0" ? cur : String(firstAe.percentuale)));
      }
    }

    intermediariAppliedRef.current = selectedClienteId;
  }, [selectedClienteId, intermediariDefaultCliente, regolazioneMode, aeList]);

  const { data: compagnieList } = useQuery({
    queryKey: ["agenzie-list-immissione"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome, codice, gruppo_compagnia, gruppo_compagnia_id, tipo").eq("attiva", true).order("nome");
      return data || [];
    },
  });

  // Broker/Plurimandatarie che hanno un rapporto attivo con la compagnia (gruppo) scelta
  const { data: brokerPluriPerGruppo } = useQuery({
    queryKey: ["broker_pluri_per_gruppo", selectedGruppoCompagniaId],
    enabled: !!selectedGruppoCompagniaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("compagnia_rapporti")
        .select("compagnia_id")
        .eq("gruppo_compagnia_id", selectedGruppoCompagniaId)
        .eq("attivo", true);
      const ids = Array.from(new Set(((data) || []).map((r) => r.compagnia_id).filter(Boolean)));
      return ids as string[];
    },
  });

  // Mappa completa compagnia (broker/pluri) → gruppi_compagnia coperti (per ricerca inversa)
  const { data: rapportiMap } = useQuery({
    queryKey: ["compagnia_rapporti_map_all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("compagnia_rapporti")
        .select("compagnia_id, gruppo_compagnia_id")
        .eq("attivo", true);
      const map: Record<string, string[]> = {};
      for (const r of (data || []) as any[]) {
        if (!r.compagnia_id || !r.gruppo_compagnia_id) continue;
        const arr = map[r.compagnia_id] || [];
        if (!arr.includes(r.gruppo_compagnia_id)) arr.push(r.gruppo_compagnia_id);
        map[r.compagnia_id] = arr;
      }
      return map;
    },
  });


  const { data: gruppiCompagniaList } = useQuery({
    queryKey: ["gruppi-compagnia-immissione"],
    queryFn: async () => {
      const { data } = await supabase.from("gruppi_compagnia").select("id, codice, descrizione").eq("attivo", true).order("descrizione");
      return ((data) || []).map((g: any) => ({ id: g.id, codice: g.codice, nome: `${g.codice ? g.codice + " - " : ""}${g.descrizione || ""}` }));
    },
  });

  const { data: ramiList } = useQuery({
    queryKey: ["rami-list-immissione"],
    queryFn: async () => {
      const { data } = await supabase.from("rami").select("id, codice, descrizione, gruppo_ramo_id, ssn_attivo, aliquota_ssn, aliquota_tasse_ramo, escludi_provvigioni, diritti_agenzia").eq("attivo", true).order("codice");
      return data || [];
    },
  });

  const { data: gruppiRamo } = useQuery({
    queryKey: ["gruppi-ramo-immissione"],
    queryFn: async () => {
      const { data } = await supabase.from("gruppi_ramo").select("id, codice, descrizione").eq("attivo", true);
      return data || [];
    },
  });

  // Sync gruppo compagnia quando cambia agenzia
  useEffect(() => {
    if (!selectedCompagnia) return;
    const ag = (compagnieList || []).find((c: any) => c.id === selectedCompagnia);
    if (ag?.gruppo_compagnia_id && ag.gruppo_compagnia_id !== selectedGruppoCompagniaId) {
      setSelectedGruppoCompagniaId(ag.gruppo_compagnia_id);
    }
  }, [selectedCompagnia, compagnieList]);

  // Coassicurazione: il leader (prima riga) alimenta lookup provvigioni / matrice
  useEffect(() => {
    if (!coassicurazione) return;
    const leader = ripartoRows[0];
    if (!leader) return;
    if (leader.compagniaId) setSelectedCompagnia(leader.compagniaId);
    if (leader.gruppoCompagniaId) setSelectedGruppoCompagniaId(leader.gruppoCompagniaId);
    if (leader.rapportoId) setSelectedRapportoId(leader.rapportoId);
  }, [coassicurazione, ripartoRows]);

  // Tipo dell'agenzia selezionata
  const selectedAgenzia = (compagnieList || []).find((c: any) => c.id === selectedCompagnia) as any;
  const tipoAgenzia = (selectedAgenzia?.tipo || "").toLowerCase();
  const isBrokerLike = tipoAgenzia === "broker" || tipoAgenzia === "plurimandataria";

  // Rapporti per l'agenzia selezionata, filtrati per gruppo compagnia
  const { data: rapportiAgenzia } = useQuery({
    queryKey: ["compagnia_rapporti_attivi", selectedCompagnia, selectedGruppoCompagniaId],
    enabled: !!selectedCompagnia && isBrokerLike && !!selectedGruppoCompagniaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("compagnia_rapporti")
        .select("id, codice_rapporto, nome_rapporto, tipo_rapporto, gruppo_compagnia_id, attivo")
        .eq("compagnia_id", selectedCompagnia)
        .eq("gruppo_compagnia_id", selectedGruppoCompagniaId)
        .eq("attivo", true)
        .order("codice_rapporto");
      return (data) || [];
    },
  });

  // Auto-seleziona rapporto se broker/pluri con 1 solo rapporto coerente
  useEffect(() => {
    if (!isBrokerLike || !selectedCompagnia) {
      if (selectedRapportoId) setSelectedRapportoId("");
      return;
    }
    const list = rapportiAgenzia || [];
    if (list.length === 1) {
      if (selectedRapportoId !== list[0].id) setSelectedRapportoId(list[0].id);
    } else if (selectedRapportoId && !list.find((r: any) => r.id === selectedRapportoId)) {
      setSelectedRapportoId("");
    }
  }, [rapportiAgenzia, selectedCompagnia, isBrokerLike]);

  // Sync targa veicolo → campo legacy targa_telaio salvato in titoli (UI Targa è solo in sezione Veicolo)
  useEffect(() => {
    if (vTarga) setTargaTelaio(vTarga);
  }, [vTarga]);


  // Gruppo ramo selezionato (verità: selectedGruppoRamoId; selectedRamo derivato da righe garanzia in save)
  const selectedRamoData = ramiList?.find((r) => r.id === selectedRamo);
  const selectedGruppoRamo = gruppiRamo?.find((g) => g.id === selectedGruppoRamoId);

  /** Sottoramo effettivo per fattori regolazione (prima garanzia o selectedRamo) */
  const regolazioneRamoId = useMemo(() => {
    const firma = Array.isArray(premiFirmaRows) ? premiFirmaRows : [];
    const quietanza = Array.isArray(premiQuietanzaRows) ? premiQuietanzaRows : [];
    return (
      firma.find((r) => r?.sottoramoId)?.sottoramoId ||
      quietanza.find((r) => r?.sottoramoId)?.sottoramoId ||
      selectedRamo ||
      null
    );
  }, [premiFirmaRows, premiQuietanzaRows, selectedRamo]);

  const { data: fattoriRegolazioneStandard = [], isLoading: loadingFattoriStandard } = useQuery({
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
    enabled: !!regolazione,
  });

  const { data: regolazioneFattoriCustom = [], isLoading: loadingRegolazioneFattoriCustom } = useQuery({
    queryKey: ["sottoramo-fattori-attivi", regolazioneRamoId],
    queryFn: async () => {
      if (!regolazioneRamoId) return [];
      const { data, error } = await supabase
        .from("sottoramo_fattori_regolazione")
        .select("fattore_id, fattori_regolazione(id, codice, descrizione, attivo)")
        .eq("ramo_id", regolazioneRamoId)
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
    enabled: !!regolazione && !!regolazioneRamoId,
  });

  const regolazioneFattoriLinked = useMemo(
    () => mergeFattoriRegolazione(fattoriRegolazioneStandard, regolazioneFattoriCustom),
    [fattoriRegolazioneStandard, regolazioneFattoriCustom],
  );
  const loadingRegolazioneFattori = loadingFattoriStandard || loadingRegolazioneFattoriCustom;

  // Detect RCA: gruppo ramo contiene "RCA" o "Auto" oppure checkbox polizzaAuto
  const isRCA = polizzaAuto || (selectedGruppoRamo?.descrizione || "").toUpperCase().includes("RCA") || (selectedGruppoRamo?.descrizione || "").toUpperCase().includes("AUTO");

  // Quando il ramo NON è auto, azzeriamo i dati veicolo/conducente per evitare
  // salvataggi sporchi — ma SOLO se non risultano dati già inseriti dall'utente
  // (altrimenti il toggle di polizzaAuto o il flip di isRCA dovuto al caricamento
  // asincrono di gruppiRamo cancellerebbe il lavoro in corso).
  useEffect(() => {
    if (isRCA) return;
    const hasUserData =
      (Array.isArray(premiFirmaRows) ? premiFirmaRows : []).some((r) => r?.netto || r?.tasse || r?.sottoramoId) ||
      (Array.isArray(premiQuietanzaRows) ? premiQuietanzaRows : []).some((r) => r?.netto || r?.tasse || r?.sottoramoId) ||
      !!vTarga || !!vMarca || !!vModello || !!vTelaio || !!targaTelaio;
    if (hasUserData) return;
    setTargaTelaio("");
    setVMarca(""); setVModello(""); setVVersione(""); setVTarga(""); setVTelaio("");
    setVDescrizione(""); setVDataImmatricolazione(""); setVAnnoAcquisto("");
    setVProvinciaCircolazione(""); setVClasseBm("");
    setVMass1("0"); setVMass2("0"); setVMass3("0");
    setVPeius(false); setVFranchigia("0"); setVTemporanea(false);
    setVCaricoScarico(false); setVCompetizione(false); setVRimorchio(false);
    setVCv("0"); setVKw("0"); setVCc("0"); setVPosti("0");
    setVPesoMotrice("0"); setVPesoRimorchio("0"); setVPesoTotale("0");
    setVTipologiaGuida(""); setVTipoAlimentazione("");
    setPremiFirmaRows([emptyGaranziaRow()]); setPremiQuietanzaRows([emptyGaranziaRow()]);
    setCNome(""); setCCognome(""); setCIndirizzo(""); setCCap("");
    setCCitta(""); setCProvincia(""); setCDataNascita("");
    setCTipoPatente(""); setCDataRilascioPatente(""); setCNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRCA]);


  // Provvigione: rimossa lookup automatica per prodotto (prodotto è ora testo libero).
  // L'utente inserisce manualmente la percentuale.
  const provvigioneFromDb = false;
  const isProvvigioneModified = false;

  // --- Computed: derive scalars from row arrays ---
  const sumNum = (arr: GaranziaRow[] | null | undefined, k: "netto" | "tasse" | "ssn" | "accessori") =>
    (Array.isArray(arr) ? arr : []).reduce((s, r) => s + (parseFloat(r?.[k] || "0") || 0), 0);
  const premioNettoNum = sumNum(premiFirmaRows, "netto");
  const accessoriFirmaNum = sumNum(premiFirmaRows, "accessori");
  // Tasse effettive = auto (aliquota) + rettifica manuale, così il lordo quadra anche in modalità manuale.
  const tasseNum = (premiFirmaRows || []).reduce((s, r) => s + calcTasseEffettiveRiga(r), 0);
  const ssnFirmaNum = sumNum(premiFirmaRows, "ssn");
  const premioNetto = premioNettoNum ? String(premioNettoNum) : "";
  const tasse = tasseNum ? String(tasseNum) : "";
  const premioNettoQNum = sumNum(premiQuietanzaRows, "netto");
  const accessoriQuietanzaNum = sumNum(premiQuietanzaRows, "accessori");
  const tasseQNum = (premiQuietanzaRows || []).reduce((s, r) => s + calcTasseEffettiveRiga(r), 0);
  const ssnQuietanzaNum = sumNum(premiQuietanzaRows, "ssn");
  const premioNettoQuietanza = premioNettoQNum ? String(premioNettoQNum) : "";
  const tasseQuietanza = tasseQNum ? String(tasseQNum) : "";

  const totFirma = premioNettoNum + accessoriFirmaNum + tasseNum + ssnFirmaNum;
  const totQuietanza = premioNettoQNum + accessoriQuietanzaNum + tasseQNum + ssnQuietanzaNum;

  const quietanzePlanPreview = (() => {
    if (polizzaTemporanea || !(polizzaRateo || isPremioUnicoAnticipato(frazionamento) || isRataUnica(frazionamento))) {
      return [];
    }
    try {
      return computeQuietanzePlan({
        polizzaRateo: polizzaRateo || undefined,
        frazionamento,
        anniDurata: parseInt(anniDurata) || 1,
        garanziaDa,
        garanziaA,
        durataDa,
        durataA,
        dataCompetenza,
      });
    } catch {
      return [];
    }
  })();

  const [provvMatrice, setProvvMatrice] = useState<MatriceProvvAccessori | null>(null);
  // Rapporto effettivo per matrice provvigioni: per monomandatarie deriva dalla coppia (compagnia, gruppo madre)
  const [resolvedRapportoId, setResolvedRapportoId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedCompagnia || !selectedGruppoCompagniaId) {
        if (!cancelled) setResolvedRapportoId(null);
        return;
      }
      if (isBrokerLike) {
        if (!cancelled) setResolvedRapportoId(selectedRapportoId || null);
        return;
      }
      const { data } = await supabase
        .from("compagnia_rapporti")
        .select("id")
        .eq("compagnia_id", selectedCompagnia)
        .eq("gruppo_compagnia_id", selectedGruppoCompagniaId)
        .eq("attivo", true)
        .limit(1)
        .maybeSingle();
      if (!cancelled) setResolvedRapportoId(data?.id || null);
    })();
    return () => { cancelled = true; };
  }, [selectedCompagnia, selectedGruppoCompagniaId, selectedRapportoId, isBrokerLike]);

  const resolveRowPct = (row: GaranziaRow) => resolveRowPctNetto(row, provvMatrice);

  const calcProvvAuto = (rows: GaranziaRow[]) => calcProvvigioniGaranzia(rows, provvMatrice);

  const rowPctAccessoriFn = (row: GaranziaRow) => resolveRowPctAccessori(row, provvMatrice).pct;
  const rowPctNettoFn = (row: GaranziaRow) => resolveRowPctNetto(row, provvMatrice).pct;
  const provvBreakdownFirma = provvPctBreakdown(premiFirmaRows, provvMatrice);
  const provvBreakdownQuietanza = provvPctBreakdown(premiQuietanzaRows, provvMatrice);

  const baseFirmaProvv = premioNettoNum + accessoriFirmaNum;
  const baseQuietanzaProvv = premioNettoQNum + accessoriQuietanzaNum;

  const provvFirma = percentualeProvvigioneAuto
    ? calcProvvAuto(premiFirmaRows)
    : manualProvvFromEuroFirma && manualProvvImportoFirma != null
      ? manualProvvImportoFirma
      : percentualeProvvigione
        ? provvigioniImportoFromPct(baseFirmaProvv, percentualeProvvigione)
        : 0;
  const provvQuietanza = percentualeProvvigioneAuto
    ? calcProvvAuto(premiQuietanzaRows)
    : manualProvvFromEuroQuietanza && manualProvvImportoQuietanza != null
      ? manualProvvImportoQuietanza
      : percentualeProvvigione
        ? provvigioniImportoFromPct(baseQuietanzaProvv, percentualeProvvigione)
        : 0;

  const brokFirma = percentualeBrokeraggio ? (premioNettoNum * parseFloat(percentualeBrokeraggio) / 100) : 0;
  const brokQuietanza = percentualeBrokeraggio ? (premioNettoQNum * parseFloat(percentualeBrokeraggio) / 100) : 0;

  // --- Auto-lookup % Commerciale Produttore in base al Ramo ---
  // Sorgente: produttori_provvigioni_ramo (anagrafica_id + ramo_codice) → fallback anagrafiche_professionali.percentuale_base
  useEffect(() => {
    if (!selectedAE) return;
    if (produttoreEscludiProvvigioni) {
      setPercentualeCommerciale("0");
      setPercentualeCommercialeAuto(false);
      return;
    }
    const ramoCodice = selectedRamoData?.codice;
    let cancelled = false;
    (async () => {
      try {
        let pct: number | null = null;
        if (ramoCodice) {
          const { data: ppr } = await supabase
            .from("produttori_provvigioni_ramo")
            .select("percentuale_provvigione")
            .eq("anagrafica_id", selectedAE)
            .eq("ramo_codice", ramoCodice)
            .maybeSingle();
          if (ppr && ppr.percentuale_provvigione != null) {
            pct = Number(ppr.percentuale_provvigione);
          }
        }
        if (pct == null) {
          const { data: ap } = await supabase
            .from("anagrafiche_professionali")
            .select("percentuale_base, percentuale_consulenza")
            .eq("id", selectedAE)
            .maybeSingle();
          if (ap?.percentuale_base != null) pct = Number(ap.percentuale_base);
          if (!cancelled && ap?.percentuale_consulenza != null) {
            setPercentualeBrokeraggio(String(Number(ap.percentuale_consulenza)));
            setPercentualeBrokeraggioAuto(true);
          }
        } else {
          // % commerciale presa dal ramo: leggo comunque la consulenza base del produttore
          const { data: ap2 } = await supabase
            .from("anagrafiche_professionali")
            .select("percentuale_consulenza")
            .eq("id", selectedAE)
            .maybeSingle();
          if (!cancelled && ap2?.percentuale_consulenza != null) {
            setPercentualeBrokeraggio(String(Number(ap2.percentuale_consulenza)));
            setPercentualeBrokeraggioAuto(true);
          }
        }
        if (!cancelled && pct != null && !Number.isNaN(pct)) {
          setPercentualeCommerciale(String(pct));
          setPercentualeCommercialeAuto(true);
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [selectedAE, selectedRamoData?.codice, produttoreEscludiProvvigioni]);

  const aeOptionsForSplit = useMemo(
    () =>
      (aeList || []).map((ae: any) => ({
        value: ae.id as string,
        label: ae.ragione_sociale || `${ae.cognome || ""} ${ae.nome || ""}`.trim() || ae.codice || ae.id,
        percentuale_base: ae.percentuale_base != null ? Number(ae.percentuale_base) : undefined,
      })),
    [aeList],
  );

  useEffect(() => {
    if (produttoreEscludiProvvigioni) {
      setSplitsForm([]);
      return;
    }
    if (!selectedAE) return;
    const ae = (aeList || []).find((a: any) => a.id === selectedAE);
    const pct = parseFloat(percentualeCommerciale) || Number(ae?.percentuale_base) || 100;
    setSplitsForm((prev) => {
      if (prev.length === 0) return [{ anagrafica_commerciale_id: selectedAE, percentuale: pct }];
      return prev;
    });
  }, [selectedAE, produttoreEscludiProvvigioni, aeList]);

  // --- Matrice Provvigioni (Rapporto + Gruppo Ramo) caricata una sola volta ---
  useEffect(() => {
    setPercentualeProvvigioneAuto(true);
  }, [resolvedRapportoId, selectedGruppoRamoId]);

  useEffect(() => {
    if (!resolvedRapportoId || !selectedGruppoRamoId) {
      setProvvMatrice(null);
      setProvvigioneFonte("");
      setProvvigioneWarning("");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("provvigioni_compagnia_ramo")
        .select("ramo_id, percentuale_provvigione, percentuale_provvigione_accessori")
        .eq("compagnia_rapporto_id", resolvedRapportoId)
        .eq("gruppo_ramo_id", selectedGruppoRamoId)
        .eq("attiva", true);
      if (cancelled) return;
      const rows = (data || []) as Array<{
        ramo_id: string | null;
        percentuale_provvigione: number;
        percentuale_provvigione_accessori: number | null;
      }>;
      if (!rows.length) {
        setProvvMatrice(null);
        setProvvigioneFonte("");
        setProvvigioneWarning("Nessuna provvigione configurata per Compagnia/Agenzia + Ramo selezionati.");
        return;
      }
      const pctByRamoId = new Map<string, number>();
      const pctAccessoriByRamoId = new Map<string, number>();
      let pctDefault: number | null = null;
      let pctAccessoriDefault: number | null = null;
      const counts = new Map<number, number>();
      for (const r of rows) {
        const p = Number(r.percentuale_provvigione);
        if (r.ramo_id) {
          pctByRamoId.set(r.ramo_id, p);
          if (r.percentuale_provvigione_accessori != null) {
            pctAccessoriByRamoId.set(r.ramo_id, Number(r.percentuale_provvigione_accessori));
          }
        } else {
          pctDefault = p;
          if (r.percentuale_provvigione_accessori != null) {
            pctAccessoriDefault = Number(r.percentuale_provvigione_accessori);
          }
        }
        counts.set(p, (counts.get(p) || 0) + 1);
      }
      let bestP = 0, bestC = 0;
      for (const [p, c] of counts) if (c > bestC) { bestC = c; bestP = p; }
      const isUniform = counts.size === 1;
      setProvvMatrice({
        pctByRamoId,
        pctAccessoriByRamoId,
        pctDefault,
        pctAccessoriDefault,
        pctPrevalente: bestP,
        isUniform,
      });
      setProvvigioneFonte(
        isUniform
          ? `matrice ${rows.length} sottorami al ${bestP}% (uniforme)`
          : `matrice ${rows.length} sottorami — % calcolata per riga sul sottoramo`
      );
    })();
    return () => { cancelled = true; };
  }, [resolvedRapportoId, selectedGruppoRamoId]);

  // Sincronizza display % Agenzia (media ponderata) + warning quando in auto
  useEffect(() => {
    if (!percentualeProvvigioneAuto) return;
    const totBase = premioNettoNum + accessoriFirmaNum + premioNettoQNum + accessoriQuietanzaNum;
    if (provvMatrice && totBase > 0) {
      const avg = ((provvFirma + provvQuietanza) / totBase) * 100;
      const rounded = String(Math.round(avg * 1000) / 1000);
      setPercentualeProvvigione((prev) => (prev === rounded ? prev : rounded));
    } else if (!provvMatrice) {
      setPercentualeProvvigione((prev) => (prev === "" ? prev : ""));
    }
    if (provvMatrice && !provvMatrice.isUniform) {
      const allRows = [...premiFirmaRows, ...premiQuietanzaRows].filter(
        (r) => (parseFloat(r.netto || "0") || 0) > 0 || (parseFloat(r.accessori || "0") || 0) > 0
      );
      const unmatched = allRows.some((r) => !resolveRowPct(r).matched);
      const msg = unmatched
        ? "Alcune righe usano l'aliquota prevalente — seleziona il Sottoramo per la % esatta."
        : "";
      setProvvigioneWarning((prev) => (prev === msg ? prev : msg));
    }
  }, [percentualeProvvigioneAuto, provvMatrice, premioNettoNum, accessoriFirmaNum, premioNettoQNum, accessoriQuietanzaNum, provvFirma, provvQuietanza, premiFirmaRows, premiQuietanzaRows]);

  // --- Frazionamento helpers + auto-calcolo Periodo ---
  const FRAZIONAMENTO_OPTIONS = [...FRAZIONAMENTI];
  const addMonthsISO = (iso: string, months: number): string => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return "";
    const dt = new Date(Date.UTC(y, m - 1 + months, d));
    return dt.toISOString().slice(0, 10);
  };
  useEffect(() => {
    if (polizzaTemporanea) {
      const synced = syncPeriodoTemporanea({ durataDa, durataA });
      setGaranziaDa(synced.garanzia_da);
      setGaranziaA(synced.garanzia_a);
      setDataCompetenza(synced.data_competenza);
      if (!limiteMoraTouched && synced.data_competenza) {
        const gg = parseInt(moraGiorni || "0") || 0;
        const d = new Date(synced.data_competenza);
        d.setDate(d.getDate() + gg);
        setLimiteMora(d.toISOString().slice(0, 10));
      }
      return;
    }
    if (polizzaRateo) {
      const synced = syncPeriodoRateo({
        garanziaDa,
        durataDa,
        garanziaA,
        frazionamento,
        durataATouched,
        currentDurataA: durataA,
        anniDurata: Math.max(1, parseInt(anniDurata) || 1),
      });
      if (!garanziaDaTouched && synced.garanzia_da) setGaranziaDa(synced.garanzia_da);
      if (synced.applyDurataA && synced.durata_a) {
        setDurataA(synced.durata_a);
        if (durataATouched && garanziaA && durataA && durataA <= garanziaA) {
          setDurataATouched(false);
        }
      }
      if (!dataCompetenzaTouched) setDataCompetenza(synced.data_competenza);
      if (!limiteMoraTouched && synced.data_competenza) {
        const gg = parseInt(moraGiorni || "0") || 0;
        const d = new Date(synced.data_competenza);
        d.setDate(d.getDate() + gg);
        setLimiteMora(d.toISOString().slice(0, 10));
      }
      return;
    }
    if (!durataDa) return;
    const anni = Math.max(1, parseInt(anniDurata) || 1);

    // Premio unico anticipato / Rata unica: durata libera; garanzia = intero periodo contratto.
    if (isPremioUnicoAnticipato(frazionamento) || isRataUnica(frazionamento)) {
      const defaultDurataA = addMonthsISO(durataDa, anni * 12);
      if (!durataATouched) setDurataA(defaultDurataA);
      const fine = durataATouched && durataA ? durataA : defaultDurataA;
      if (!garanziaDaTouched) setGaranziaDa(durataDa);
      if (!garanziaATouched) setGaranziaA(fine);
      if (!dataCompetenzaTouched) setDataCompetenza(durataDa);
      if (!limiteMoraTouched) {
        const base = (!dataCompetenzaTouched ? durataDa : (dataCompetenza || durataDa));
        const gg = parseInt(moraGiorni || "0") || 0;
        if (base) {
          const d = new Date(base); d.setDate(d.getDate() + gg);
          setLimiteMora(d.toISOString().slice(0, 10));
        }
      }
      return;
    }

    const mesiGar = frazionamentoMesi(frazionamento, anni);
    if (!durataATouched) setDurataA(addMonthsISO(durataDa, anni * 12));
    if (!garanziaDaTouched) setGaranziaDa(durataDa);
    if (!garanziaATouched) setGaranziaA(addMonthsISO(durataDa, mesiGar));
    if (!dataCompetenzaTouched) setDataCompetenza(durataDa);
    if (!limiteMoraTouched) {
      const base = (!dataCompetenzaTouched ? durataDa : (dataCompetenza || durataDa));
      const gg = parseInt(moraGiorni || "0") || 0;
      if (base) {
        const d = new Date(base); d.setDate(d.getDate() + gg);
        setLimiteMora(d.toISOString().slice(0, 10));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durataDa, durataA, durataATouched, anniDurata, frazionamento, polizzaTemporanea, polizzaRateo, garanziaDa, garanziaDaTouched, garanziaA]);

  // Auto date presunte regolazione (anniversari fine garanzia/durata)
  useEffect(() => {
    if (!regolazione) return;
    const anni = Math.max(1, parseInt(anniDurata) || 1);
    const { dates, touched } = resizeRegolazioneDatePresunte({
      current: regolazioneDatePresunte,
      touched: regolazioneDateTouchedRef.current,
      durataDa,
      garanziaDa,
      anniDurata: anni,
    });
    regolazioneDateTouchedRef.current = touched;
    const same =
      dates.length === regolazioneDatePresunte.length &&
      dates.every((d, i) => d === regolazioneDatePresunte[i]);
    if (!same) setRegolazioneDatePresunte(dates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regolazione, durataDa, garanziaDa, anniDurata]);

  // --- Handlers ---

  const clientePolizzePath = useMemo(() => {
    const clienteId =
      selectedClienteId ||
      preselectedClienteId ||
      (regolazioneMode ? polizzaMadre?.cliente_anagrafica_id : null);
    return clienteId ? `/archivi/clienti/${clienteId}?tab=polizze` : null;
  }, [selectedClienteId, preselectedClienteId, regolazioneMode, polizzaMadre?.cliente_anagrafica_id]);

  const exitImmissione = useCallback(() => {
    if (clientePolizzePath) navigate(clientePolizzePath);
    else navigate("/portafoglio/attive");
  }, [clientePolizzePath, navigate]);

  const handleConferma = () => {
    finalizzaPolizza();
  };

  const finalizzaPolizza = async () => {
    if (saving) return;
    // Deriva ramo_id (sottoramo) dalla prima riga garanzia non vuota
    const firstSottoramoId =
      premiFirmaRows.find((r) => r.sottoramoId)?.sottoramoId ||
      premiQuietanzaRows.find((r) => r.sottoramoId)?.sottoramoId ||
      null;
    const ramoIdToSave = firstSottoramoId || selectedRamo || null;
    if (!durataDa) {
      toast.error("Durata Da è obbligatoria");
      return;
    }
    if (!durataA) {
      toast.error("Durata A è obbligatoria");
      return;
    }
    if (durataDa > durataA) {
      toast.error("Durata Da non può essere successiva a Durata A");
      return;
    }
    if (!selectedGruppoRamoId) {
      toast.error("Seleziona il Ramo");
      return;
    }
    if (!ramoIdToSave) {
      toast.error("Aggiungi almeno una garanzia/sottoramo nelle Composizioni Premio");
      return;
    }
    if (coassicurazione) {
      const ripartoCheck = validateRipartoSum(ripartoRows);
      if (!ripartoCheck.valid) {
        toast.error(ripartoCheck.message || "Riparto coassicurazione non valido");
        return;
      }
      const leader = ripartoRows[0];
      const leaderAg = (compagnieList || []).find((c: any) => c.id === leader.compagniaId) as any;
      const leaderBroker = (leaderAg?.tipo || "").toLowerCase() === "broker" || (leaderAg?.tipo || "").toLowerCase() === "plurimandataria";
      if (leaderBroker && !leader.rapportoId) {
        const { data: rapLeader } = await supabase
          .from("compagnia_rapporti")
          .select("id")
          .eq("compagnia_id", leader.compagniaId)
          .eq("gruppo_compagnia_id", leader.gruppoCompagniaId)
          .eq("attivo", true);
        if ((rapLeader || []).length !== 1) {
          toast.error("Seleziona il Rapporto Agenzia per il coassicuratore leader");
          return;
        }
      }
    } else {
      if (!selectedGruppoCompagniaId) {
        toast.error("Seleziona la Compagnia Assicurativa");
        return;
      }
      if (!selectedCompagnia) {
        toast.error("Seleziona l'Agenzia di Riferimento");
        return;
      }
      if (isBrokerLike && !selectedRapportoId) {
        toast.error("Seleziona il Rapporto Agenzia");
        return;
      }
    }
    if (isRCA) {
      if (!vTipoVeicolo) { toast.error("Tipo Veicolo obbligatorio per RCA Auto"); return; }
      if (!vTarga) { toast.error("Targa obbligatoria per RCA Auto"); return; }
      if (!vUso) { toast.error("Uso obbligatorio per RCA Auto"); return; }
      if (!vTipologiaGuida) { toast.error("Tipologia Guida obbligatoria per RCA Auto"); return; }
    }
    if (polizzaTemporanea) {
      if (!garanziaDa || !garanziaA) {
        toast.error("Per una polizza temporanea indica Garanzia Da e Garanzia A");
        return;
      }
      if (garanziaDa > garanziaA) {
        toast.error("Garanzia Da non può essere successiva a Garanzia A");
        return;
      }
    }
    if (polizzaRateo) {
      if (!garanziaDa || !garanziaA || !durataA) {
        toast.error("Per polizza rateo indica Garanzia Da/A (fine rateo) e Durata A del contratto");
        return;
      }
      if (garanziaDa > garanziaA) {
        toast.error("Garanzia Da non può essere successiva a Garanzia A (fine fase rateo)");
        return;
      }
      if (durataA <= garanziaA) {
        toast.error(
          "Durata A (fine contratto) deve essere successiva a Garanzia A (fine rateo) per generare le quietanze successive al frazionamento",
        );
        return;
      }
    }
    const rapportoSel = (rapportiAgenzia || []).find((r: any) => r.id === selectedRapportoId);
    const leaderRow = coassicurazione ? ripartoRows[0] : null;
    const compagniaIdSave = coassicurazione ? leaderRow!.compagniaId : selectedCompagnia;
    const gruppoCompagniaIdSave = coassicurazione ? leaderRow!.gruppoCompagniaId : selectedGruppoCompagniaId;
    const rapportoIdSave = coassicurazione ? leaderRow!.rapportoId : selectedRapportoId;
    const agenziaSave = (compagnieList || []).find((c: any) => c.id === compagniaIdSave) as any;
    const tipoAgenziaSave = (agenziaSave?.tipo || "").toLowerCase();
    const isBrokerLikeSave = tipoAgenziaSave === "broker" || tipoAgenziaSave === "plurimandataria";
    let rapportoSelSave = rapportoSel;
    if (coassicurazione && isBrokerLikeSave) {
      if (rapportoIdSave) {
        const { data: rapRow } = await supabase
          .from("compagnia_rapporti")
          .select("id, codice_rapporto, nome_rapporto, tipo_rapporto")
          .eq("id", rapportoIdSave)
          .maybeSingle();
        rapportoSelSave = rapRow as any;
      } else {
        const { data: rapRows } = await supabase
          .from("compagnia_rapporti")
          .select("id, codice_rapporto, nome_rapporto, tipo_rapporto")
          .eq("compagnia_id", compagniaIdSave)
          .eq("gruppo_compagnia_id", gruppoCompagniaIdSave)
          .eq("attivo", true);
        rapportoSelSave = (rapRows || [])[0] as any;
      }
    }
    if (!regolazioneMode && numeroPolizza.trim()) {
      const compagniaIdCheck = coassicurazione ? ripartoRows[0]?.compagniaId : selectedCompagnia;
      const dupPolizza = await verificaNumeroPolizzaDuplicato(supabase, {
        numeroTitolo: numeroPolizza,
        compagniaId: compagniaIdCheck || null,
      });
      if (dupPolizza.duplicato) {
        toast.error(`Numero polizza già presente per questa agenzia: ${numeroPolizza.trim()}`);
        return;
      }
    }
    setSaving(true);
    try {
      // In modalità regolazione la nuova riga deve essere riga+1 rispetto all'ultima del numero_titolo
      let regolazioneRiga = 0;
      let regolazioneNote: string | null = null;
      if (regolazioneMode && polizzaMadre?.numero_titolo) {
        const { data: siblings } = await supabase
          .from("titoli")
          .select("riga")
          .eq("numero_titolo", polizzaMadre.numero_titolo);
        const maxRiga = Math.max(
          0,
          ...((siblings || []).map((s: any) => Number(s.riga || 0))),
          Number(polizzaMadre.riga || 0),
        );
        regolazioneRiga = maxRiga + 1;
        const today = new Date().toISOString().slice(0, 10);
        regolazioneNote = `Regolazione premio del ${today.split("-").reverse().join("/")} — polizza madre rg.${polizzaMadre.riga ?? 0}`;
      }
      const payload: Record<string, any> = {
        numero_titolo: numeroPolizza || null,
        note: notePolizza.trim() || null,
        riga: regolazioneMode ? regolazioneRiga : 0,
        appendice: "000",
        coassicurazione,
        // gruppo_compagnia_id non è una colonna di titoli: si deriva via compagnia_rapporti
        compagnia_id: compagniaIdSave || null,
        compagnia_rapporto_id: isBrokerLikeSave ? (rapportoSelSave?.id || rapportoIdSave || null) : null,
        codice_rapporto: isBrokerLikeSave ? (rapportoSelSave?.codice_rapporto || null) : null,
        ramo_id: ramoIdToSave,
        prodotto_nome: prodottoNome || null,
        cliente_anagrafica_id: selectedClienteId || null,
        
        // CIG solo per Enti: per Privati/Aziende lo forziamo a null per non lasciare residui se l'utente cambia cliente
        cig_rif: tipoSoggetto === "ente" && cigRif ? normalizeCig(cigRif) : null,
        cig_temporaneo: tipoSoggetto === "ente" ? cigTemporaneo : false,
        vincolo: vincolo || null,
        targa_telaio: targaTelaio || null,
        descrizione_polizza: descrizionePolizza || null,
        durata_da: durataDa || null,
        durata_a: durataA || null,
        anni_durata: polizzaTemporanea ? null : (parseInt(anniDurata) || 1),
        tacito_rinnovo: polizzaTemporanea ? false : tacitoRinnovo,
        polizza_temporanea: polizzaTemporanea,
        polizza_rateo: polizzaRateo,
        rate: polizzaTemporanea ? 1 : frazionamentoToRate(frazionamento, parseInt(anniDurata) || 1),
        frazionamento: polizzaTemporanea ? null : frazionamento,
        mora_giorni: parseInt(moraGiorni) || 15,
        premio_netto: premioNetto ? parseFloat(premioNetto) : null,
        addizionali: accessoriFirmaNum,
        tasse: tasse ? parseFloat(tasse) : null,
        ssn_firma: ssnFirmaNum || 0,
        premio_lordo: totFirma || null,
        valuta,
        provvigioni_firma: provvFirma || null,
        
        commerciale_id: selectedCommerciale === "__sede__" ? null : selectedCommerciale,
        percentuale_commerciale: produttoreEscludiProvvigioni
          ? 0
          : (parseFloat(percentualeCommerciale) || 100),
        percentuale_ae: parseFloat(percentualeAE) || 0,
        garanzia_da: garanziaDa || null,
        garanzia_a: garanziaA || null,
        data_competenza: dataCompetenza || null,
        limite_mora: limiteMora || null,
        disdetta_giorni: disdettaGiorni ? parseInt(disdettaGiorni) : null,
        regolazione,
        regolazione_date_presunte: regolazione
          ? (regolazioneDatePresunte.filter(Boolean).length
              ? regolazioneDatePresunte.filter(Boolean)
              : null)
          : null,
        regolazione_data_presunta: regolazione
          ? (regolazioneDatePresunte.find(Boolean) || null)
          : null,
        regolazione_fattore: regolazione
          ? (regolazioneRighe[0]
              ? (regolazioneFattoriLinked.find((f) => f.id === regolazioneRighe[0].fattore_id)?.codice
                  ?? regolazioneRighe[0].fattore_codice
                  ?? null)
              : null)
          : null,
        regolazione_note: regolazione ? (regolazioneNote || null) : null,
        libro_matricola: isLibroMatricola ? "auto" : null,
        emittenda: !!emittenda,
        premio_netto_quietanza: polizzaTemporanea ? null : (premioNettoQuietanza ? parseFloat(premioNettoQuietanza) : null),
        addizionali_quietanza: polizzaTemporanea ? null : (accessoriQuietanzaNum || null),
        tasse_quietanza: polizzaTemporanea ? null : (tasseQuietanza ? parseFloat(tasseQuietanza) : null),
        ssn_quietanza: polizzaTemporanea ? 0 : (ssnQuietanzaNum || 0),
        provvigioni_quietanza: polizzaTemporanea ? null : (provvQuietanza || null),
        brokeraggio_firma: brokFirma || null,
        brokeraggio_quietanza: polizzaTemporanea ? null : (brokQuietanza || null),
        percentuale_brokeraggio: percentualeBrokeraggio ? parseFloat(percentualeBrokeraggio) : null,
        rimborso, indicizzata, no_calcolo_tasse: noCalcoloTasse,
        pag_diretto_compagnia: pagDirettoCompagnia, emissione_fee: emissioneFee,
        formato_elettronico: formatoElettronico,
        cambio: parseFloat(cambio) || 1,
        // Incasso/Copertura: NON valorizzati in immissione — verranno settati dal flusso "Messa a Cassa" su TitoloDetail.
        stato: "attivo",
        ufficio_id: selectedUfficioId || profile?.ufficio_id || null,
        // Produttore: salviamo l'anagrafica + nome leggibile (produttore_id legacy resta NULL).
        anagrafica_commerciale_id: selectedAE || null,
        produttore_nome: (() => {
          if (!selectedAE) return null;
          const ae = (aeList || []).find((a: any) => a.id === selectedAE);
          if (!ae) return null;
          return ae.ragione_sociale || `${ae.cognome || ""} ${ae.nome || ""}`.trim() || null;
        })(),
        // Account Executive: anagrafica + nome leggibile.
        ae_anagrafica_id: selectedAccountExecutiveId || null,
        ae_nome: (() => {
          if (!selectedAccountExecutiveId) return null;
          const a = (aeAnagraficheList || []).find((x) => x.value === selectedAccountExecutiveId);
          return a ? a.label : null;
        })(),
        // Backoffice (Specialist) salvato come "COGNOME NOME" leggibile in titoli.specialist
        ...(selectedBackofficeId ? {
          specialist: (() => {
            const b = (backofficeList || []).find((x: any) => x.id === selectedBackofficeId);
            return b ? `${b.cognome || ""} ${b.nome || ""}`.trim() : null;
          })(),
        } : {}),
      };

      // In modalità regolazione: agganciamo polizza madre e note
      if (regolazioneMode && polizzaMadre) {
        payload.sostituisce_polizza = polizzaMadre.numero_titolo;
        payload.sostituisce_riga = polizzaMadre.riga;
        const userNote = notePolizza.trim();
        payload.note = userNote
          ? [regolazioneNote, userNote].filter(Boolean).join("\n")
          : regolazioneNote;
      }

      const { data: newTitolo, error } = await supabase
        .from("titoli")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;

      // Solo le righe esplicite aggiunte in griglia. ramo_id obbligatorio in DB.
      if (regolazione && regolazioneRighe.length > 0) {
        if (!ramoIdToSave) {
          toast.error("Seleziona il sottoramo per salvare i fattori di regolazione");
        } else {
          const insertRows = rowsToInsertPayload(newTitolo.id, ramoIdToSave, regolazioneRighe);
          const { error: fatErr } = await supabase
            .from("titoli_regolazione_fattori")
            .insert(insertRows);
          if (fatErr) throw fatErr;
        }
      }

      // Split commerciali multi-produttore (solo polizza madre, non regolazione)
      if (!regolazioneMode) {
        const fromForm = splitsForm.filter((s) => s.anagrafica_commerciale_id && s.percentuale > 0);
        const effectiveSplits =
          fromForm.length > 0
            ? fromForm
            : selectedAE && !produttoreEscludiProvvigioni
              ? [{ anagrafica_commerciale_id: selectedAE, percentuale: parseFloat(percentualeCommerciale) || 100 }]
              : [];

        if (effectiveSplits.length > 0) {
          const sum = effectiveSplits.reduce((a, s) => a + s.percentuale, 0);
          const aePerc = selectedAccountExecutiveId ? parseFloat(percentualeAE) || 0 : 0;
          if (sum + aePerc > 100.001) throw new Error("Somma percentuali produttori + AE supera 100%");
          const ids = new Set(effectiveSplits.map((s) => s.anagrafica_commerciale_id));
          if (ids.size !== effectiveSplits.length) throw new Error("Produttori duplicati nello split");

          const { error: splitErr } = await supabase.from("titoli_split_commerciali").insert(
            effectiveSplits.map((s, i) => ({
              titolo_id: newTitolo.id,
              anagrafica_commerciale_id: s.anagrafica_commerciale_id!,
              commerciale_user_id: null,
              percentuale: s.percentuale,
              ordine: i,
            })),
          );
          if (splitErr) throw splitErr;

          const { error: syncErr } = await supabase.rpc("sync_split_commerciali_to_children", {
            p_madre_id: newTitolo.id,
          });
          if (syncErr) throw syncErr;
        }
      }

      // Create first movimento ("Polizza Base" oppure "Regolazione Premio")
      await supabase.from("movimenti_polizza").insert({
        titolo_id: newTitolo.id,
        riga: regolazioneMode ? regolazioneRiga : 0,
        appendice: "000",
        data_movimento: new Date().toISOString().split("T")[0],
        data_effetto: durataDa || null,
        data_scadenza: durataA || null,
        tacito_rinnovo: tacitoRinnovo,
        descrizione: regolazioneMode
          ? (regolazioneNote || "Regolazione premio")
          : (cigRif ? `CIG: ${cigRif}` : descrizionePolizza || null),
        valuta,
        premio: polizzaRateo && !regolazioneMode ? 0 : (totFirma || 0),
        provvigioni: polizzaRateo && !regolazioneMode ? 0 : (provvFirma || 0),
        tipo: regolazioneMode ? "Regolazione Premio" : "Polizza Base",
        incassato: false,
        stato: "attivo",
        ufficio_id: selectedUfficioId || profile?.ufficio_id || null,
      } as any);

      // Libro Matricola: salva righe mezzi (solo se Tipo Operazione = libro_matricola)
      if (isLibroMatricola) {
        const righeValide = assignProgressivi(filterRigheValide(righeMatricola));
        if (righeValide.length > 0) {
          const { data: insertedMezzi, error: lmErr } = await supabase
            .from("libro_matricola_mezzi")
            .insert(righeValide.map((r) => rigaToDbPayload(r, newTitolo.id)))
            .select("id, targa, data_inclusione, n_progressivo");
          if (lmErr) {
            console.error("Errore salvataggio mezzi libro matricola:", lmErr);
          } else if (insertedMezzi?.length) {
            try {
              await insertLibroMatricolaOperazioni(
                newTitolo.id,
                (insertedMezzi as any[]).flatMap((m) => {
                  const base = {
                    mezzo_id: m.id as string,
                    targa: (m.targa as string) || null,
                    note: m.n_progressivo != null ? `N° ${m.n_progressivo}` : null,
                  };
                  const ops: Array<{ tipo: any; mezzo_id: string; targa: string | null; note: string | null; data_evento: string }> = [
                    {
                      tipo: "creazione" as const,
                      ...base,
                      data_evento: (m.data_inclusione as string) || new Date().toISOString().slice(0, 10),
                    },
                  ];
                  if (m.data_inclusione) {
                    ops.push({
                      tipo: "inclusione" as const,
                      ...base,
                      data_evento: m.data_inclusione as string,
                    });
                  }
                  return ops;
                }),
                user?.id || null,
              );
            } catch (opErr) {
              console.error("Errore log operazioni libro matricola:", opErr);
            }
          }
        }
      }

      // Snapshot regolazione (collegamento con polizza madre + quietanza di riferimento)
      if (regolazioneMode && polizzaMadre) {
        await supabase.from("titoli_regolazioni").insert({
          titolo_madre_id: polizzaMadre.id,
          titolo_regolazione_id: newTitolo.id,
          quietanza_riferimento_id: selectedQuietanzaRefId || null,
          data_regolazione: new Date().toISOString().slice(0, 10),
          periodo_da: durataDa || null,
          periodo_a: durataA || null,
          conguaglio_premio: totFirma || 0,
          note: regolazioneNote,
          created_by: user?.id || null,
        } as any);

        // Movimento RG sulla polizza madre (per timeline)
        await supabase.from("movimenti_polizza").insert({
          titolo_id: polizzaMadre.id,
          tipo_documento: "RG",
          data_movimento: new Date().toISOString().slice(0, 10),
          descrizione: `Regolazione premio — nuovo titolo riga ${regolazioneRiga}, conguaglio ${(totFirma || 0).toFixed(2)} €`,
          stato: polizzaMadre.stato,
        } as any);
      }

      // Save RCA data if applicable
      if (isRCA) {
        await supabase.from("veicoli_polizza").insert({
          titolo_id: newTitolo.id,
          settore: vSettore || null, tipo_veicolo: vTipoVeicolo || null, uso: vUso || null,
          marca: vMarca || null, modello: vModello || null, versione: vVersione || null,
          targa: vTarga || null, telaio: vTelaio || null, veicolo_descrizione: vDescrizione || null,
          data_immatricolazione: vDataImmatricolazione || null,
          anno_acquisto: vAnnoAcquisto ? parseInt(vAnnoAcquisto) : null,
          provincia_circolazione: vProvinciaCircolazione || null,
          classe_bm: vClasseBm || null,
          massimale_1: parseFloat(vMass1) || 0, massimale_2: parseFloat(vMass2) || 0, massimale_3: parseFloat(vMass3) || 0,
          peius: vPeius, franchigia: parseFloat(vFranchigia) || 0,
          temporanea: vTemporanea, carico_scarico: vCaricoScarico, competizione: vCompetizione, rimorchio: vRimorchio,
          cv: parseInt(vCv) || 0, kw: parseInt(vKw) || 0, cc: parseInt(vCc) || 0, posti: parseInt(vPosti) || 0,
          peso_motrice: parseInt(vPesoMotrice) || 0, peso_rimorchio: parseInt(vPesoRimorchio) || 0, peso_totale: parseInt(vPesoTotale) || 0,
          tipologia_guida: vTipologiaGuida || null, tipo_alimentazione: vTipoAlimentazione || null,
        } as any);

        // Conducente
        if (cNome || cCognome) {
          await supabase.from("conducenti_polizza").insert({
            titolo_id: newTitolo.id,
            nome: cNome || null, cognome: cCognome || null,
            indirizzo: cIndirizzo || null, cap: cCap || null, citta: cCitta || null, provincia: cProvincia || null,
            data_nascita: cDataNascita || null, tipo_patente: cTipoPatente || null,
            data_rilascio_patente: cDataRilascioPatente || null, note: cNote || null,
          } as any);
        }
      }

      // Premi garanzia (Firma + Quietanza) — vale per qualunque ramo
      const buildPremiInsert = (rows: GaranziaRow[], tipo: "firma" | "quietanza") =>
        rows
          .filter((r) => !!(r.sottoramoId || r.codice || r.descrizione.trim()))
          .map((r, idx) => ({
            titolo_id: newTitolo.id,
            tipo_premio: tipo,
            garanzia: (r.descrizione && r.descrizione.trim()) || r.codice || "Premio",
            codice_garanzia: r.codice || null,
            capitale: 0,
            tasso: 0,
            firma: tipo === "firma" ? premioRigaDbImporto(r) : 0,
            rata: tipo === "quietanza" ? premioRigaDbImporto(r) : 0,
            accessori: parseFloat(r.accessori || "0") || 0,
            annuo: 0,
            ordine: idx,
            aliquota_tasse_pct: r.aliquotaTasse || null,
            ssn: parseFloat(r.ssn || "0") || 0,
            tasse_rettifica: parseFloat(r.tasseRettifica || "0") || 0,
            provvigione_netto_pct: resolveRowPctNetto(r, provvMatrice).pct,
            provvigione_accessori_pct: resolveRowPctAccessori(r, provvMatrice).pct,
            provvigione_netto_pct_override: !!r.provvNettoPctOverride,
            provvigione_accessori_pct_override: !!r.provvAccessoriPctOverride,
          }));
      const premiPayload = [
        ...buildPremiInsert(premiFirmaRows, "firma"),
        ...(polizzaTemporanea ? [] : buildPremiInsert(premiQuietanzaRows, "quietanza")),
      ];
      if (premiPayload.length > 0) {
        await supabase.from("premi_garanzia_polizza").insert(premiPayload);
      }

      // Dettaglio riparto (coassicurazione o singola quota 100%)
      {
        let provvNettoAmt = 0;
        let provvAddAmt = 0;
        let percProvvN = parseFloat(percentualeProvvigione) || 0;
        let percProvvA = percProvvN;
        if (percentualeProvvigioneAuto && provvMatrice) {
          for (const r of premiFirmaRows) {
            if (isRigaEsclusaProvvigioni(r)) continue;
            const netto = parseFloat(r.netto || "0") || 0;
            const acc = parseFloat(r.accessori || "0") || 0;
            provvNettoAmt += (netto * resolveRowPctNetto(r, provvMatrice).pct) / 100;
            provvAddAmt += (acc * resolveRowPctAccessori(r, provvMatrice).pct) / 100;
          }
          if (provvBreakdownFirma) {
            percProvvN = provvBreakdownFirma.pctNetto;
            percProvvA = provvBreakdownFirma.pctAccessori;
          }
        } else {
          provvNettoAmt = provvFirma;
        }
        const ripartoTotals = {
          netto: premioNettoNum,
          addizionali: accessoriFirmaNum,
          tasse: tasseNum,
          lordo: totFirma,
        };
        const provvInfo = {
          totale: provvFirma,
          provvNetto: provvNettoAmt,
          provvAddizionali: provvAddAmt,
          percProvvNetto: percProvvN,
          percProvvAddizionali: percProvvA,
        };
        const ripartoPayload = coassicurazione
          ? buildDettaglioRipartoInsert(newTitolo.id, ripartoRows, ripartoTotals, provvInfo)
          : buildDettaglioRipartoSingolo(newTitolo.id, compagniaIdSave, ripartoTotals, provvInfo, {
              gruppoCompagniaId: gruppoCompagniaIdSave,
              compagniaRapportoId: isBrokerLikeSave ? (rapportoSelSave?.id || rapportoIdSave || null) : null,
            });
        const { error: ripartoErr } = await supabase.from("dettaglio_riparto").insert(ripartoPayload);
        if (ripartoErr) {
          console.error("Errore salvataggio dettaglio_riparto:", ripartoErr);
          toast.warning("Polizza creata ma riparto compagnie non salvato: " + ripartoErr.message);
        }
      }

      // Rateo: premi su madre servono al trigger; copia su quietanze dopo insert righe garanzia
      if (polizzaRateo && !regolazioneMode) {
        const { error: cloneErr } = await supabase.rpc("clone_premi_rateo_su_quietanze", {
          p_madre_id: newTitolo.id,
        });
        if (cloneErr) {
          console.error("Clone premi rateo su quietanze:", cloneErr);
          toast.warning("Polizza creata ma copia premi sulle quietanze non riuscita");
        }
      }

      // Le quietanze sono generate automaticamente dal trigger DB
      // (tg_polizza_after_insert_genera_quietanze) in base a durata+frazionamento.




      // Archivia il PDF della scansione AI fra i documenti della polizza
      if (aiSourcePdf) {
        try {
          const bin = atob(aiSourcePdf.base64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const safeName =
            (aiSourcePdf.name || `polizza-${numeroPolizza || newTitolo.id}.pdf`)
              .replace(/\s+/g, "_")
              .replace(/[^\w.\-]/g, "");
          const path = `${newTitolo.id}/${Date.now()}_${safeName}`;
          const { error: upErr } = await supabase.storage
            .from("documenti_titoli")
            .upload(path, bytes, { contentType: aiSourcePdf.mimeType || "application/pdf", upsert: true });
          if (upErr) throw upErr;
          const { error: docErr } = await supabase.from("documenti").insert({
            entita_tipo: "titolo",
            entita_id: newTitolo.id,
            bucket_name: "documenti_titoli",
            path_storage: path,
            nome_file: safeName,
            categoria: "polizza_originale",
            visibile_al_cliente: false,
          } as any);
          if (docErr) throw docErr;
        } catch (e: any) {
          console.error("Archiviazione PDF AI fallita:", e);
          toast.warning("Polizza creata ma archiviazione PDF AI fallita: " + (e?.message || "errore"));
        }
      }

      toast.success(regolazioneMode ? "Regolazione registrata con successo" : "Polizza registrata con successo");
      clearDraft(draftKey);
      setAiSourcePdf(null);
      if (clientePolizzePath) navigate(clientePolizzePath);
      else navigate(`/titoli/${newTitolo.id}`);

    } catch (err: any) {
      console.error("Errore salvataggio polizza:", err);
      toast.error(err.message || "Errore nel salvataggio della polizza");
    } finally {
      setSaving(false);
    }
  };

  const rcaVeicoloSectionProps = {
    isRCA,
    aiPrefilled,
    clearAiPrefilled,
    cProvincia,
    kwCvLocked,
    setKwCvLocked,
    rcaUsi,
    vTipoVeicolo,
    setVTipoVeicolo,
    setVSettore,
    vUso,
    setVUso,
    vMarca,
    setVMarca,
    vModello,
    setVModello,
    vVersione,
    setVVersione,
    vTarga,
    setVTarga,
    vTelaio,
    setVTelaio,
    vDescrizione,
    setVDescrizione,
    vDataImmatricolazione,
    setVDataImmatricolazione,
    vAnnoAcquisto,
    setVAnnoAcquisto,
    vProvinciaCircolazione,
    setVProvinciaCircolazione,
    vClasseBm,
    setVClasseBm,
    vCv,
    setVCv,
    vKw,
    setVKw,
    vCc,
    setVCc,
    vPosti,
    setVPosti,
    vPesoMotrice,
    setVPesoMotrice,
    vPesoRimorchio,
    setVPesoRimorchio,
    vPesoTotale,
    setVPesoTotale,
    vTipologiaGuida,
    setVTipologiaGuida,
    vTipoAlimentazione,
    setVTipoAlimentazione,
    vMass1,
    setVMass1,
    vMass2,
    setVMass2,
    vMass3,
    setVMass3,
    vFranchigia,
    setVFranchigia,
    vPeius,
    setVPeius,
    vTemporanea,
    setVTemporanea,
    vCaricoScarico,
    setVCaricoScarico,
    vCompetizione,
    setVCompetizione,
    vRimorchio,
    setVRimorchio,
  };

  return (
    <PageContainer variant="form">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {regolazioneMode ? "Regolazione Premio" : "Immissione Polizza"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {regolazioneMode
              ? "Conguaglio premio collegato a una polizza esistente — verrà creato un nuovo titolo RG"
              : "Inserimento nuova polizza nel portafoglio"}
          </p>
          {!regolazioneMode && (
            <p className="text-[11px] text-teal-700 dark:text-teal-300 mt-1 italic">
              ℹ️ Modello Polizza/Quietanza attivo: al salvataggio viene creata 1 <b>Polizza-Contratto</b> + N <b>Quietanze</b> in base al frazionamento. La polizza rappresenta il contratto, le quietanze sono le rate che si mettono a cassa.
            </p>
          )}

        </div>
        <Button
          type="button"
          onClick={() => setAiImportOpen(true)}
          className="gap-2 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800"
        >
          <Sparkles className="h-4 w-4" />
          Importa da PDF (AI)
        </Button>
      </div>

      {draftRestoredAt && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
          <span>
            Bozza ripristinata del{" "}
            {new Date(draftRestoredAt).toLocaleString("it-IT", {
              day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
            })}
            . Le modifiche vengono salvate automaticamente nel browser.
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => {
              clearDraft(draftKey);
              setDraftRestoredAt(null);
              window.location.reload();
            }}
          >
            Scarta bozza
          </Button>
        </div>
      )}

      {regolazioneMode && (
        <div className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm">
              <span className="font-semibold text-amber-900 dark:text-amber-200">
                Regolazione della polizza N° {polizzaMadre?.numero_titolo || "—"}
              </span>
              {polizzaMadre?.riga != null && (
                <span className="text-xs text-amber-800/80 dark:text-amber-300/80 ml-2">
                  (riga madre {polizzaMadre.riga})
                </span>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                if (clientePolizzePath) navigate(clientePolizzePath);
                else if (titoloMadreId) navigate(`/titoli/${titoloMadreId}`);
                else navigate(-1);
              }}
            >
              Esci dalla regolazione
            </Button>
          </div>
          {(() => {
            const cli: any = (polizzaMadre as any)?.cliente;
            const clienteLabel = cli?.ragione_sociale || [cli?.cognome, cli?.nome].filter(Boolean).join(" ") || "—";
            const compagniaLabel = (polizzaMadre as any)?.compagnia?.nome || "—";
            const rap: any = (polizzaMadre as any)?.rapporto;
            const rapportoLabel = rap ? [rap.codice_rapporto, rap.nome_rapporto || rap.tipo_rapporto].filter(Boolean).join(" · ") : "—";
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs bg-white/60 dark:bg-amber-900/20 rounded px-3 py-2 border border-amber-300/60">
                <div><span className="text-amber-800/70 dark:text-amber-300/70">Polizza N°</span><div className="font-medium">{polizzaMadre?.numero_titolo || "—"}</div></div>
                <div><span className="text-amber-800/70 dark:text-amber-300/70">Cliente</span><div className="font-medium truncate" title={clienteLabel}>{clienteLabel}</div></div>
                <div><span className="text-amber-800/70 dark:text-amber-300/70">Compagnia</span><div className="font-medium truncate" title={compagniaLabel}>{compagniaLabel}</div></div>
                <div><span className="text-amber-800/70 dark:text-amber-300/70">Rapporto</span><div className="font-medium truncate" title={rapportoLabel}>{rapportoLabel}</div></div>
              </div>
            );
          })()}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 md:gap-5 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Quietanza di riferimento *</Label>
              <SearchableSelect
                className="h-8 text-xs"
                value={selectedQuietanzaRefId}
                onValueChange={(v) => setSelectedQuietanzaRefId(v)}
                placeholder="— Seleziona la quietanza —"
                options={(quietanzePolizza || []).map((q: any) => {
                  const da = q.durata_da ? new Date(q.durata_da).toLocaleDateString("it-IT") : "—";
                  const a = q.durata_a ? new Date(q.durata_a).toLocaleDateString("it-IT") : "—";
                  const incassata = q.stato === "incassato" || q.data_messa_cassa ? " · INCASSATA" : "";
                  return {
                    value: q.id,
                    label: `Riga ${q.riga ?? 0} · ${da} → ${a} · ${q.stato || "—"}${incassata}`,
                  };
                })}
              />
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                La regolazione verrà collegata a questa quietanza nella tabella titoli_regolazioni.
              </p>
            </div>
          </div>
        </div>
      )}





      <ImportNuovaPolizzaAIDialog
        open={aiImportOpen}
        onOpenChange={setAiImportOpen}
        onApply={handleAIImportApply}
        lockedClienteId={preselectedClienteId || undefined}
        lockedClienteLabel={
          clienteDettaglio
            ? (clienteDettaglio.ragione_sociale ||
                `${clienteDettaglio.cognome || ""} ${clienteDettaglio.nome || ""}`.trim() ||
                undefined)
            : undefined
        }
      />

      {/* CLIENTE */}
      <PolizzaSection title="Cliente & Sede" icon={Users}>

        {/* Selezione cliente esistente */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 md:gap-5 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Cliente esistente</Label>
            <ClienteSearchSelect
              className="h-8 text-xs"
              value={selectedClienteId}
              onValueChange={(v) => setSelectedClienteId(v)}
              placeholder="— Cerca cliente per nome, più nomi, indirizzo, CF o P.IVA —"
              searchPlaceholder="Nome, più nomi, indirizzo, CF…"
            />
          </div>
          <NuovoClienteDialog
            key={nuovoClienteNonce}
            trigger={
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <UserPlus className="w-3.5 h-3.5" />
                Nuovo Cliente
              </Button>
            }
            controlledOpen={nuovoClienteOpen || undefined}
            onOpenChange={(o) => {
              setNuovoClienteOpen(o);
              if (!o) setAiClientePrefill(null);
            }}
            initialData={aiClientePrefill ?? undefined}
            onCreated={(id) => {
              setSelectedClienteId(id);
              setAiClientePrefill(null);
              setNuovoClienteOpen(false);
            }}
          />
        </div>

        {/* Badge Gruppo Finanziario del cliente selezionato */}
        {clienteDettaglio && (() => {
          const gf: any = clienteDettaglio.gruppi_finanziari;
          if (!gf) {
            return (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs flex items-center gap-2">
                <span className="text-destructive font-medium">⚠ Gruppo finanziario mancante</span>
                <span className="text-muted-foreground">— Apri la scheda cliente per assegnarlo (determina i campi obbligatori).</span>
              </div>
            );
          }
          const tipo = gf.tipo_soggetto as string;
          const cls =
            tipo === "privato" ? "border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-950/30" :
            tipo === "azienda" ? "border-emerald-600 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30" :
            "border-amber-600 text-amber-700 bg-amber-50 dark:bg-amber-950/30";
          const label = tipo === "privato" ? "Privato" : tipo === "azienda" ? "Azienda" : "Ente";
          return (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Gruppo Finanziario:</span>
              <span className={`inline-flex items-center rounded-md border px-2 py-0.5 font-medium ${cls}`}>
                {label} · {gf.codice} {gf.nome}
              </span>
            </div>
          );
        })()}

        {/* Conferma cliente selezionato */}
        {clienteDettaglio && (
          <p className="text-sm text-foreground font-medium">
            ✓ {clienteDettaglio.ragione_sociale || `${clienteDettaglio.cognome || ""} ${clienteDettaglio.nome || ""}`.trim()}
          </p>
        )}

        {/* Ufficio (Sede) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs">Sede (Ufficio) *</Label>
            <SearchableSelect
              className="h-8 text-xs w-full"
              value={selectedUfficioId}
              onValueChange={setSelectedUfficioId}
              placeholder="— Seleziona sede —"
              clearable
              options={(ufficiList || []).map((u: any) => ({
                value: u.id,
                label: `${u.codice_ufficio ? u.codice_ufficio + " - " : ""}${u.nome_ufficio}`,
              }))}
            />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs">Account Executive</Label>
            <SearchableSelect
              className="h-8 text-xs w-full"
              value={selectedAccountExecutiveId}
              onValueChange={setSelectedAccountExecutiveId}
              placeholder="— Seleziona Account Executive —"
              clearable
              options={aeAnagraficheList}
            />
          </div>
          <div className="space-y-1.5 min-w-0">

            <Label className="text-xs">Produttore</Label>
            <SearchableSelect
              className="h-8 text-xs w-full"
              value={selectedAE}
              onValueChange={setSelectedAE}
              placeholder="— Seleziona produttore —"
              clearable
              options={(aeList || []).map((ae: any) => ({
                value: ae.id,
                label: ae.ragione_sociale || `${ae.sigla || ae.codice || ""} - ${ae.cognome || ""} ${ae.nome || ""}`.trim(),
              }))}
            />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs">Specialist</Label>
            <SearchableSelect
              className="h-8 text-xs w-full"
              value={selectedBackofficeId}
              onValueChange={setSelectedBackofficeId}
              placeholder="— Seleziona Specialist —"
              clearable
              options={(backofficeList || []).map((b: any) => ({
                value: b.id,
                label: `${b.cognome || ""} ${b.nome || ""}`.trim(),
              }))}
            />
          </div>
        </div>
      </PolizzaSection>


      {/* TIPO — in cima perché determina i campi successivi */}
      <PolizzaSection title="Tipo Polizza" icon={Tag}>
        <div className="space-y-3">
          <Label className="text-xs">Tipo Operazione</Label>
          <RadioGroup value={tipoOperazione} onValueChange={setTipoOperazione} className="flex flex-wrap gap-4">
            {[
              { value: "polizza", label: "Polizza" },
              { value: "libro_matricola", label: "Polizza Libro Matricola" },
            ].map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <RadioGroupItem value={opt.value} id={`tipo-${opt.value}`} />
                <Label htmlFor={`tipo-${opt.value}`} className="font-normal cursor-pointer text-xs">{opt.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Checkbox id="polizza-auto" checked={polizzaAuto} onCheckedChange={(v) => setPolizzaAuto(v === true)} />
          <Label htmlFor="polizza-auto" className="font-normal cursor-pointer text-xs">Polizza Auto</Label>
        </div>
        {isLibroMatricola && (
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMatricolaDialogOpen(true)}
              className="text-xs border-primary/40 text-primary hover:bg-primary/5"
            >
              <Truck className="h-3.5 w-3.5 mr-1.5" />
              Gestisci Libro Matricola ({filterRigheValide(righeMatricola).length} mezzi)
            </Button>
          </div>
        )}
      </PolizzaSection>

      {isRCA && <RcaDatiVeicoloSection showBanner {...rcaVeicoloSectionProps} />}

      {/* CONTRATTO */}
      <PolizzaSection
        title="Contratto"
        icon={FileText}
        headerExtra={
          (selectedGruppoCompagniaId || selectedCompagnia || selectedRapportoId) ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-teal-700 hover:text-teal-900 hover:bg-teal-100"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedGruppoCompagniaId("");
                setSelectedCompagnia("");
                setSelectedRapportoId("");
              }}
            >
              <X className="w-3.5 h-3.5 mr-1" /> Azzera
            </Button>
          ) : null
        }
      >


        <CoassicurazioneContrattoPanel
          enabled={coassicurazione}
          onEnabledChange={setCoassicurazione}
          rows={ripartoRows}
          onRowsChange={setRipartoRows}
          compagnieList={(compagnieList || []) as any[]}
          gruppiCompagniaList={(gruppiCompagniaList || []) as any[]}
          brokerPluriPerGruppo={brokerPluriPerGruppo || []}
          rapportiMap={rapportiMap || {}}
          leaderPrefill={{
            gruppoCompagniaId: selectedGruppoCompagniaId,
            compagniaId: selectedCompagnia,
            rapportoId: selectedRapportoId,
          }}
        />

        {!coassicurazione && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Compagnia Assicurativa <span className="text-destructive">*</span></Label>
            <SearchableSelect
              className="h-8 text-xs"
              value={selectedGruppoCompagniaId}
              onValueChange={(v) => {
                setSelectedGruppoCompagniaId(v);
                // resetta agenzia/rapporto se non più coerenti
                const ag = (compagnieList || []).find((c: any) => c.id === selectedCompagnia) as any;
                if (ag && v) {
                  const tipo = (ag.tipo || "").toLowerCase();
                  if ((tipo === "agenzia" || tipo === "direzione") && ag.gruppo_compagnia_id !== v) {
                    setSelectedCompagnia("");
                    setSelectedRapportoId("");
                  } else if (tipo === "broker" || tipo === "plurimandataria") {
                    // l'agenzia broker/pluri resta valida solo se ha rapporti col nuovo gruppo: la verifica sarà fatta al cambio rapporto
                    setSelectedRapportoId("");
                  }
                }
              }}
              placeholder={
                (gruppiCompagniaList || []).length === 0
                  ? "Caricamento compagnie…"
                  : "— Seleziona compagnia —"
              }
              options={(() => {
                // Se è già selezionata un'agenzia broker/pluri con più gruppi, restringi alle sole compagnie compatibili
                const ag = (compagnieList || []).find((c: any) => c.id === selectedCompagnia) as any;
                const tipoSel = (ag?.tipo || "").toLowerCase();
                let allowed: string[] | null = null;
                if (ag && (tipoSel === "broker" || tipoSel === "plurimandataria")) {
                  allowed = rapportiMap?.[selectedCompagnia] || [];
                }
                return (gruppiCompagniaList || [])
                  .filter((g: any) => !allowed || allowed.includes(g.id))
                  .map((g: any) => ({
                    value: g.id,
                    label: g.nome || g.codice || "—",
                  }));
              })()}

            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Agenzia di Riferimento <span className="text-destructive">*</span></Label>
            <SearchableSelect
              className="h-8 text-xs"
              value={selectedCompagnia}
              onValueChange={(v) => {
                setSelectedCompagnia(v);
                setSelectedRapportoId("");
                const ag = (compagnieList || []).find((c: any) => c.id === v) as any;
                const tipo = (ag?.tipo || "").toLowerCase();
                if ((tipo === "agenzia" || tipo === "direzione") && ag?.gruppo_compagnia_id) {
                  // agenzia/direzione → auto-set compagnia madre
                  setSelectedGruppoCompagniaId(ag.gruppo_compagnia_id);
                } else if (tipo === "broker" || tipo === "plurimandataria") {
                  // broker/pluri → se ha 1 solo gruppo, auto-set; altrimenti l'utente sceglie la compagnia
                  const gruppi = rapportiMap?.[v] || [];
                  if (gruppi.length === 1) {
                    setSelectedGruppoCompagniaId(gruppi[0]);
                  } else if (gruppi.length > 1 && selectedGruppoCompagniaId && !gruppi.includes(selectedGruppoCompagniaId)) {
                    setSelectedGruppoCompagniaId("");
                  }
                }
              }}
              placeholder="— Cerca agenzia / broker —"
              options={(compagnieList || [])
                .filter((c: any) => {
                  const tipo = (c.tipo || "").toLowerCase();
                  // Se è già scelta una compagnia, applica il filtro classico
                  if (selectedGruppoCompagniaId) {
                    if (tipo === "agenzia" || tipo === "direzione") {
                      return c.gruppo_compagnia_id === selectedGruppoCompagniaId;
                    }
                    if (tipo === "broker" || tipo === "plurimandataria") {
                      return (brokerPluriPerGruppo || []).includes(c.id);
                    }
                    return false;
                  }
                  // Nessuna compagnia scelta → mostra tutte le entità utilizzabili
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
        )}

        {/* Rapporto Agenzia: visibile solo per broker / plurimandataria */}
        {!coassicurazione && isBrokerLike && selectedCompagnia && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            <div className="space-y-1.5">
              <Label className="text-xs">
                Rapporto Agenzia <span className="text-destructive">*</span>
              </Label>
              {(rapportiAgenzia || []).length === 0 ? (
                <div className="h-8 px-2 flex items-center text-xs rounded-md border border-destructive/50 bg-destructive/5 text-destructive">
                  Nessun rapporto attivo con questa compagnia
                </div>
              ) : (rapportiAgenzia || []).length === 1 ? (
                <div className="h-8 px-2 flex items-center text-xs rounded-md border bg-muted/30">
                  {(rapportiAgenzia)[0].nome_rapporto || (rapportiAgenzia)[0].codice_rapporto || "—"}
                  {(rapportiAgenzia)[0].tipo_rapporto ? ` · ${(rapportiAgenzia)[0].tipo_rapporto}` : ""}
                </div>
              ) : (
                <SearchableSelect
                  className={`h-8 text-xs ${!selectedRapportoId ? "ring-1 ring-amber-500" : ""}`}
                  value={selectedRapportoId}
                  onValueChange={(v) => setSelectedRapportoId(v)}
                  placeholder="— Seleziona rapporto —"
                  options={(rapportiAgenzia).map((r) => ({
                    value: r.id,
                    label: r.nome_rapporto || r.codice_rapporto || "—",
                    description: [r.tipo_rapporto, r.codice_rapporto].filter(Boolean).join(" · ") || undefined,
                  }))}
                />
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          <div className="space-y-1.5 md:col-span-2">
            <RamoSottoramoSelect
              layout="stacked"
              gruppoRamoId={selectedGruppoRamoId}
              ramoId={defaultSottoramoId}
              onChange={({ gruppoRamoId, ramoId }) => {
                const gruppoChanged = gruppoRamoId !== selectedGruppoRamoId;
                if (gruppoChanged) {
                  // Cambio Ramo → reset righe garanzia (con conferma se ci sono dati)
                  const hasRows =
                    (Array.isArray(premiFirmaRows) ? premiFirmaRows : []).some((r) => r?.netto || r?.tasse || r?.sottoramoId) ||
                    (Array.isArray(premiQuietanzaRows) ? premiQuietanzaRows : []).some((r) => r?.netto || r?.tasse || r?.sottoramoId);
                  if (hasRows) {
                    const ok = window.confirm(
                      "Cambiando Ramo le righe di Composizione Premio già inserite verranno cancellate. Continuare?"
                    );
                    if (!ok) return;
                  }
                  setSelectedGruppoRamoId(gruppoRamoId);
                  setDefaultSottoramoId(null);
                  setPremiFirmaRows([emptyGaranziaRow()]);
                  setPremiQuietanzaRows([emptyGaranziaRow()]);
                  setSelectedRamo("");
                  return;
                }
                // Stesso Ramo: cambia solo il Sottoramo di default.
                // Propaghiamo a: righe vuote (no importi) + righe che avevano il vecchio default.
                const prevDefault = defaultSottoramoId;
                setDefaultSottoramoId(ramoId);
                if (ramoId) setSelectedRamo(ramoId);
                const sel: any = (ramiList || []).find((r: any) => r.id === ramoId);
                if (!sel) return;
                const escludi = !!sel.escludi_provvigioni;
                const diritti = !!sel.diritti_agenzia;
                const aliquota = escludi || diritti ? 0 : (Number(sel.aliquota_tasse_ramo) || 0);
                const ssnAttivo = !escludi && !diritti && !!sel.ssn_attivo;
                const aliquotaSsn = ssnAttivo ? (Number(sel.aliquota_ssn) || 10.5) : 0;
                const preset = (base: GaranziaRow): GaranziaRow => ({
                  ...base,
                  sottoramoId: sel.id,
                  codice: sel.codice,
                  descrizione: sel.descrizione,
                  aliquotaTasse: aliquota,
                  aliquotaSsn,
                  ssnAttivo,
                  escludiProvvigioni: escludi,
                  dirittiAgenzia: diritti,
                  netto: diritti ? "" : base.netto,
                  accessori: diritti ? "" : base.accessori,
                  tasse: escludi ? "0" : diritti ? base.tasse : base.tasse,
                  ssn: diritti ? "" : base.ssn,
                });
                const propagate = (rows: GaranziaRow[]) =>
                  rows.map((r) => {
                    const isEmpty = !r.netto && !r.tasse && !r.sottoramoId;
                    const matchedPrevDefault = !!prevDefault && r.sottoramoId === prevDefault && !r.netto && !r.tasse;
                    return isEmpty || matchedPrevDefault ? preset(r) : r;
                  });
                setPremiFirmaRows((prev) => propagate(prev));
                setPremiQuietanzaRows((prev) => propagate(prev));
              }}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              La Garanzia selezionata qui è il <b>default</b> proposta nelle nuove righe di Composizione Premio. Puoi cambiarla riga per riga.
            </p>
            {isRCA && (
              <p className="text-[11px] text-primary flex items-center gap-1 mt-1">
                <Info className="h-3 w-3" />
                Ramo RCA rilevato: i Dati Veicolo sono sopra il Contratto; in fondo pagina troverai Dati Conducente.
              </p>
            )}

          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Prodotto</Label>
            <Input
              type="text"
              className="h-8 text-xs"
              placeholder="Nome prodotto (testo libero)"
              value={prodottoNome}
              onChange={(e) => setProdottoNome(e.target.value)}
            />
          </div>
          {/* Campo Specialist hardcoded rimosso: lo Specialist è ora unico (sezione Sede), salvato come nome leggibile in titoli.specialist */}

        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">N° Polizza <span className="text-destructive">*</span></Label>
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="emittenda-flag"
                  checked={emittenda}
                  disabled={emittendaLoading}
                  onCheckedChange={(v) => void onEmittendaChange(v === true)}
                />
                <Label htmlFor="emittenda-flag" className="font-normal cursor-pointer text-xs text-muted-foreground">
                  Emittenda{emittendaLoading ? "…" : ""}
                </Label>
              </div>
            </div>
            <div className="relative">
              <Input
                value={numeroPolizza}
                onChange={(e) => setNumeroPolizza(e.target.value)}
                placeholder={emittenda ? "IA0001" : "N° polizza"}
                className={`h-8 text-xs font-mono ${!numeroPolizza.trim() ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
              <Search className="absolute right-2 top-2 w-3.5 h-3.5 text-muted-foreground" />
            </div>
            {!numeroPolizza.trim() && (
              <p className="text-[10px] text-destructive mt-0.5">Obbligatorio</p>
            )}
            {emittenda && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Numero temporaneo IA…; modificabile anche dopo messa a cassa.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Note</Label>
            <Input
              value={notePolizza}
              onChange={(e) => setNotePolizza(e.target.value)}
              placeholder="Note opzionali"
              className="h-8 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          {tipoSoggetto === "ente" && (
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                CIG/Rif. <span className="text-destructive" title="Obbligatorio per Enti">*</span>
              </Label>
              <Input
                value={cigRif}
                onChange={(e) => setCigRif(e.target.value.toUpperCase())}
                maxLength={cigTemporaneo ? 40 : 10}
                placeholder={cigTemporaneo ? "CIG temporaneo" : "10 caratteri alfanumerici"}
                className={`h-8 text-xs font-mono ${((!cigRif.trim()) || (cigRif.trim() && !cigValido)) ? "border-destructive focus-visible:ring-destructive" : ""}`}
                title="Obbligatorio per clienti di tipo Ente"
              />
              <div className="flex items-center gap-2 mt-1">
                <Checkbox
                  id="cig-temp"
                  checked={cigTemporaneo}
                  disabled={cigTemporaneoLoading}
                  onCheckedChange={(v) => void onCigTemporaneoChange(v === true)}
                />
                <Label htmlFor="cig-temp" className="text-[10px] cursor-pointer">
                  CIG temporaneo (formato libero){cigTemporaneoLoading ? "…" : ""}
                </Label>
              </div>
              {!cigRif.trim() ? (
                <p className="text-[10px] text-destructive mt-0.5">Obbligatorio per Enti</p>
              ) : cigRif.trim() && !cigValido ? (
                <p className="text-[10px] text-destructive mt-0.5">CIG: 10 caratteri alfanumerici</p>
              ) : null}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Vincolo</Label>
            <SearchableSelect
              className="h-8 text-xs"
              value={vincolo}
              onValueChange={setVincolo}
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
      </PolizzaSection>

      {/* PERIODO */}
      <PolizzaSection title="Periodo" icon={Calendar}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs flex items-center gap-1">
              Polizza temporanea
              <FieldHint>Copertura a periodo libero: genera una sola quietanza, senza frazionamento né rinnovi automatici. La quietanza si incassa normalmente.</FieldHint>
            </Label>
            <div className="flex items-center gap-2 h-8">
              <Switch
                checked={polizzaTemporanea}
                onCheckedChange={(v) => {
                  setPolizzaTemporanea(v);
                  if (v) {
                    setPolizzaRateo(false);
                    setTacitoRinnovo(false);
                  }
                }}
                disabled={polizzaRateo}
              />
              <span className="text-xs text-muted-foreground">{polizzaTemporanea ? "Sì" : "No"}</span>
            </div>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs flex items-center gap-1">
              Polizza rateo
              <FieldHint>Primo periodo garanzia libero (rateo); le quietanze successive seguono il frazionamento fino a Durata A. Premio manuale, senza pro-rata automatico.</FieldHint>
            </Label>
            <div className="flex items-center gap-2 h-8">
              <Switch
                checked={polizzaRateo}
                onCheckedChange={(v) => {
                  setPolizzaRateo(v);
                  if (v) {
                    setPolizzaTemporanea(false);
                    setDurataATouched(false);
                  }
                }}
                disabled={polizzaTemporanea}
              />
              <span className="text-xs text-muted-foreground">{polizzaRateo ? "Sì" : "No"}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Durata Da <span className="text-destructive">*</span></Label>
            <Input
              type="date"
              value={durataDa}
              onChange={(e) => setDurataDa(e.target.value)}
              className={`h-8 text-xs ${!durataDa ? "border-destructive focus-visible:ring-destructive" : ""}`}
            />
            {!durataDa && (
              <p className="text-[10px] text-destructive mt-0.5">Obbligatorio</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Durata A <span className="text-destructive">*</span></Label>
            <Input
              type="date"
              value={durataA}
              onChange={(e) => { setDurataA(e.target.value); setDurataATouched(true); }}
              className={`h-8 text-xs ${!durataA ? "border-destructive focus-visible:ring-destructive" : ""}`}
            />
            {!durataA && (
              <p className="text-[10px] text-destructive mt-0.5">Obbligatorio</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Anni Durata</Label>
            <Input type="number" min="1" value={anniDurata} onChange={(e) => setAnniDurata(e.target.value)} className="h-8 text-xs" disabled={polizzaTemporanea} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Frazionamento</Label>
            <SearchableSelect
              className="h-8 text-xs"
              value={frazionamento}
              onValueChange={(v) => setFrazionamento(v || "Annuale")}
              options={FRAZIONAMENTO_OPTIONS}
              placeholder="—"
              disabled={polizzaTemporanea}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Garanzia Da</Label>
            <Input type="date" value={garanziaDa} onChange={(e) => { setGaranziaDa(e.target.value); setGaranziaDaTouched(true); }} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Garanzia A</Label>
            <Input type="date" value={garanziaA} onChange={(e) => { setGaranziaA(e.target.value); setGaranziaATouched(true); }} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data Competenza</Label>
            <Input type="date" value={dataCompetenza} onChange={(e) => {
              const v = e.target.value;
              setDataCompetenza(v); setDataCompetenzaTouched(true);
              // Ricalcola Limite Mora se non è stato modificato manualmente
              const gg = parseInt(moraGiorni || "0") || 0;
              if (v && gg >= 0 && !limiteMoraTouched) {
                const d = new Date(v); d.setDate(d.getDate() + gg);
                setLimiteMora(d.toISOString().slice(0, 10));
              }
            }} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              Limite Mora
              <FieldHint>Ultima data utile per il pagamento prima della decadenza della copertura. Si ricalcola automaticamente da Data Competenza + GG Mora.</FieldHint>
            </Label>
            <Input type="date" value={limiteMora} onChange={(e) => {
              const v = e.target.value;
              setLimiteMora(v);
              setLimiteMoraTouched(true);
              // Ricalcola GG Mora dalla differenza con base = data_competenza || garanzia_da
              const base = dataCompetenza || garanziaDa;
              if (v && base) {
                const ms = new Date(v).getTime() - new Date(base).getTime();
                const gg = Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
                setMoraGiorni(String(gg));
              }
            }} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              Tacito Rinnovo
              <FieldHint>Se attivo, la polizza si rinnova automaticamente alla scadenza salvo disdetta nei termini contrattuali.</FieldHint>
            </Label>
            <div className="flex items-center gap-2 h-8">
              <Switch checked={tacitoRinnovo} onCheckedChange={setTacitoRinnovo} disabled={polizzaTemporanea} />
              <span className="text-xs text-muted-foreground">{tacitoRinnovo ? "Sì" : "No"}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              GG Mora
              <FieldHint>Giorni di tolleranza dopo la scadenza entro cui il pagamento è ancora valido. Default 15. Aggiornandolo ricalcola il Limite Mora.</FieldHint>
            </Label>
            <Input type="number" min="0" value={moraGiorni} onChange={(e) => {
              const v = e.target.value;
              setMoraGiorni(v);
              const base = dataCompetenza || garanziaDa;
              const gg = parseInt(v || "0") || 0;
              if (base) {
                const d = new Date(base); d.setDate(d.getDate() + gg);
                setLimiteMora(d.toISOString().slice(0, 10));
              }
            }} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              Disdetta (giorni)
              <FieldHint>Giorni di preavviso richiesti per la disdetta della polizza prima della scadenza.</FieldHint>
            </Label>
            <Input type="number" min="0" value={disdettaGiorni} onChange={(e) => setDisdettaGiorni(e.target.value)} placeholder="60" className="h-8 text-xs" />
          </div>
        </div>

        {polizzaRateo && quietanzePlanPreview.length > 0 && (
          <div className="mt-3 rounded-md border border-violet-200 bg-violet-50/50 dark:bg-violet-950/20 p-3 space-y-2">
            <p className="text-xs font-medium text-violet-900 dark:text-violet-100">
              Anteprima quietanze ({quietanzePlanPreview.length}): rateo + rate annuali
            </p>
            <div className="grid gap-1">
              {quietanzePlanPreview.map((row) => (
                <div key={row.idx} className="text-[11px] text-violet-800 dark:text-violet-200 font-mono">
                  Rata {row.idx}
                  {row.idx === 1 ? " (rateo — premio firma)" : " (rata annua — premio quietanza)"}
                  {": "}
                  {row.garanzia_da} → {row.garanzia_a}
                </div>
              ))}
            </div>
          </div>
        )}

        {!polizzaRateo && isRataUnica(frazionamento) && quietanzePlanPreview.length > 0 && (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 space-y-2">
            <p className="text-xs font-medium text-emerald-900 dark:text-emerald-100">
              Anteprima quietanze ({quietanzePlanPreview.length}): rata unica alla firma
            </p>
            <div className="grid gap-1">
              {quietanzePlanPreview.map((row) => (
                <div key={row.idx} className="text-[11px] text-emerald-800 dark:text-emerald-200 font-mono">
                  Quietanza {row.idx} (intero periodo): {row.garanzia_da} → {row.garanzia_a}
                </div>
              ))}
            </div>
          </div>
        )}

        {!polizzaRateo && isPremioUnicoAnticipato(frazionamento) && quietanzePlanPreview.length > 0 && (
          <div className="mt-3 rounded-md border border-sky-200 bg-sky-50/50 dark:bg-sky-950/20 p-3 space-y-2">
            <p className="text-xs font-medium text-sky-900 dark:text-sky-100">
              Anteprima quietanze ({quietanzePlanPreview.length}): premio unico anticipato
            </p>
            <div className="grid gap-1">
              {quietanzePlanPreview.map((row) => (
                <div key={row.idx} className="text-[11px] text-sky-800 dark:text-sky-200 font-mono">
                  Quietanza {row.idx}
                  {row.idx === 1
                    ? " (copertura — fino al giorno prima della fine)"
                    : " (tecnica — giorno di fine)"}
                  {": "}
                  {row.garanzia_da} → {row.garanzia_a}
                </div>
              ))}
            </div>
          </div>
        )}

      </PolizzaSection>

      {/* QUIETANZE: generate automaticamente dal trigger DB
          (durata + frazionamento). Niente UI in creazione: si editano dal
          dettaglio della singola quietanza. */}

      {/* REGOLAZIONE */}
      <PolizzaSection title="Regolazione" icon={Shield} defaultOpen={false}>
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-md border bg-muted/40 p-3">
            <Switch
              id="reg-check"
              checked={regolazione}
              onCheckedChange={(v) => setRegolazione(!!v)}
            />
            <Label htmlFor="reg-check" className="font-medium">
              Polizza in regolazione (promemoria)
            </Label>
          </div>

          {regolazione && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-md border border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 p-3">
              <div className="space-y-2 md:col-span-3">
                <Label className="text-xs">Date presunte regolazione</Label>
                <p className="text-[11px] text-muted-foreground">
                  Fine garanzia di ogni anno (modificabili). Base: durata da / garanzia da.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {(regolazioneDatePresunte.length
                    ? regolazioneDatePresunte
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
                          setRegolazioneDatePresunte((prev) => {
                            const base = prev.length ? [...prev] : [""];
                            while (base.length <= idx) base.push("");
                            base[idx] = v;
                            return base;
                          });
                          const t = [...regolazioneDateTouchedRef.current];
                          while (t.length <= idx) t.push(false);
                          t[idx] = true;
                          regolazioneDateTouchedRef.current = t;
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <RegolazioneFattoriImportiGrid
                ramoId={regolazioneRamoId}
                datePresunte={regolazioneDatePresunte}
                fattori={regolazioneFattoriLinked}
                righe={regolazioneRighe}
                onChange={setRegolazioneRighe}
                loading={loadingRegolazioneFattori}
                fallbackAnno={
                  durataA
                    ? Number(String(durataA).slice(0, 4))
                    : new Date().getFullYear() + 1
                }
              />
              <div className="space-y-1 md:col-span-3">
                <Label className="text-xs">Note</Label>
                <Input
                  value={regolazioneNote}
                  onChange={(e) => setRegolazioneNote(e.target.value)}
                  placeholder="Eventuali note sul promemoria"
                />
              </div>
            </div>
          )}
        </div>
      </PolizzaSection>

      {/* IMPORTI */}
      <PolizzaSection title="Importi" icon={DollarSign}>

        {/* Card stile TitoloDetail: Premi per Garanzia — Firma + Quietanza */}
        <div className="space-y-4">
          {(() => {
            // Sorgente preferita: il Produttore selezionato (selectedAE) — già usato per il lookup % Provvigione Ramo.
            // Fallback: selettore Commerciale (legacy). Solo se nessuno dei due è valorizzato → Sede 100%.
            const ae = (aeList || []).find((a: any) => a.id === selectedAE);
            const aeLabel = ae
              ? (ae.ragione_sociale?.trim() || `${ae.cognome || ""} ${ae.nome || ""}`.trim())
              : null;
            const commLegacy = (commercialiList || []).find((c: any) => c.id === selectedCommerciale);
            const commLabel = commLegacy ? `${commLegacy.cognome} ${commLegacy.nome}` : null;
            const produttoreLabel = aeLabel || commLabel;
            const isSede = !produttoreLabel;
            const commonProvvProps = {
              percentualeAgenziaAuto: percentualeProvvigioneAuto,
              produttoreLabel,
              percentualeCommerciale,
              percentualeCommercialeAuto,
              produttoreIsSede: isSede,
              ramoLabel: selectedRamoData?.descrizione || null,
              fonteAuto: provvigioneFonte || null,
              warningAuto: provvigioneWarning || null,
              onResetAuto: () => {
                setPercentualeProvvigioneAuto(true);
                setManualProvvImportoFirma(null);
                setManualProvvImportoQuietanza(null);
                setManualProvvFromEuroFirma(false);
                setManualProvvFromEuroQuietanza(false);
              },
            };
            const provvPropsFirma = {
              ...commonProvvProps,
              percentualeAgenzia: percentualeProvvigioneAuto
                ? percentualeProvvigione
                : manualProvvFromEuroFirma && manualProvvImportoFirma != null
                  ? provvigioniPctFromImporto(manualProvvImportoFirma, baseFirmaProvv)
                  : percentualeProvvigione,
              onPercentualeAgenziaChange: (v: string) => {
                setPercentualeProvvigione(v);
                setPercentualeProvvigioneAuto(false);
                setManualProvvFromEuroFirma(false);
                setManualProvvImportoFirma(null);
              },
              onProvvigioniImportoChange: (importo: number) => {
                setManualProvvImportoFirma(importo);
                setManualProvvFromEuroFirma(true);
                setPercentualeProvvigioneAuto(false);
                setPercentualeProvvigione("");
              },
            };
            const provvPropsQuietanza = {
              ...commonProvvProps,
              percentualeAgenzia: percentualeProvvigioneAuto
                ? percentualeProvvigione
                : manualProvvFromEuroQuietanza && manualProvvImportoQuietanza != null
                  ? provvigioniPctFromImporto(manualProvvImportoQuietanza, baseQuietanzaProvv)
                  : percentualeProvvigione,
              onPercentualeAgenziaChange: (v: string) => {
                setPercentualeProvvigione(v);
                setPercentualeProvvigioneAuto(false);
                setManualProvvFromEuroQuietanza(false);
                setManualProvvImportoQuietanza(null);
              },
              onProvvigioniImportoChange: (importo: number) => {
                setManualProvvImportoQuietanza(importo);
                setManualProvvFromEuroQuietanza(true);
                setPercentualeProvvigioneAuto(false);
                setPercentualeProvvigione("");
              },
            };
            // Auto-sync: la Quietanza rispecchia la Firma in tempo reale.
            // Le righe Quietanza modificate a mano (quietanzaPersonalizzata=true)
            // si scollegano e smettono di seguire la Firma; il pulsante
            // "Sincronizza da Firma" le riallinea tutte.
            const firmaSafe = Array.isArray(premiFirmaRows) ? premiFirmaRows : [];
            const quietanzaSafe = Array.isArray(premiQuietanzaRows) ? premiQuietanzaRows : [];
            const sincronizzata =
              isQuietanzaSincronizzata(quietanzaSafe) &&
              quietanzaSafe.length === firmaSafe.length &&
              accessoriQuietanzaNum === accessoriFirmaNum;
            const personalizzati = quietanzaSafe.map((r) => !!r?.quietanzaPersonalizzata);
            return (
              <>
                <PremiGaranziaCardShell
                  tipoPremio="firma"
                  titoloOverride={polizzaRateo ? "Premio rateo" : undefined}
                  gruppoRamoId={selectedGruppoRamoId}
                  defaultSottoramoId={defaultSottoramoId}

                  rows={premiFirmaRows}
                  onRowsChange={(next) => {
                    setPremiFirmaRows(next);
                    setPremiQuietanzaRows((prev) => syncQuietanzaFromFirma(next, prev));
                  }}
                  addizionali={String(accessoriFirmaNum)}
                  provvigioni={provvFirma}
                  provvPctBreakdown={provvBreakdownFirma}
                  rowPctAccessori={rowPctAccessoriFn}
                  rowPctNetto={rowPctNettoFn}
                  {...provvPropsFirma}
                  headerExtra={
                    polizzaTemporanea ? undefined : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setPremiQuietanzaRows(mirrorAllFromFirma(premiFirmaRows));
                          toast.success("Quietanza riallineata alla Firma");
                        }}
                        title="Riallinea l'intera Quietanza alla Firma, azzerando le personalizzazioni"
                      >
                        Copia in Quietanza
                      </Button>
                    )
                  }
                  coassicurazioneBreakdown={
                    coassicurazione ? (
                      <>
                        <CoassicurazioneImportiBreakdown
                          ripartoRows={ripartoRows}
                          compagnieList={(compagnieList || []) as any[]}
                          gruppiCompagniaList={(gruppiCompagniaList || []) as any[]}
                          totNetto={premioNettoNum}
                          totAccessori={accessoriFirmaNum}
                          totTasse={tasseNum}
                          totSsn={ssnFirmaNum}
                          lordo={totFirma}
                          provvFirma={provvFirma}
                        />
                        {!isRipartoSumValidForPreview(ripartoRows) && (
                          <p className="mx-3 mb-3 text-[11px] text-amber-700 dark:text-amber-300">
                            Completa compagnie e quote (somma 100%) per visualizzare il riparto importi.
                          </p>
                        )}
                      </>
                    ) : undefined
                  }
                />
                {!polizzaTemporanea && (
                  <PremiGaranziaCardShell
                    tipoPremio="quietanza"
                    titoloOverride={polizzaRateo ? "Premio rata annua" : undefined}
                    gruppoRamoId={selectedGruppoRamoId}
                    defaultSottoramoId={defaultSottoramoId}

                    rows={premiQuietanzaRows}
                    onRowsChange={(next) => {
                      setPremiQuietanzaRows((prev) => markQuietanzaEdits(prev, next));
                    }}
                    addizionali={String(accessoriQuietanzaNum)}
                    provvigioni={provvQuietanza}
                    provvPctBreakdown={provvBreakdownQuietanza}
                    rowPctAccessori={rowPctAccessoriFn}
                    rowPctNetto={rowPctNettoFn}
                    {...provvPropsQuietanza}
                    personalizzati={personalizzati}
                    onResetRow={(idx) =>
                      setPremiQuietanzaRows((prev) => resetQuietanzaRow(premiFirmaRows, prev, idx))
                    }
                    headerExtra={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={sincronizzata}
                        onClick={() => {
                          setPremiQuietanzaRows(mirrorAllFromFirma(premiFirmaRows));
                        }}
                        title="Riallinea tutte le voci alla Firma, azzerando le personalizzazioni"
                      >
                        Sincronizza da Firma
                      </Button>
                    }
                  />
                )}
              </>
            );

          })()}
        </div>

        {/* Flags row */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 pt-2">
          {[
            { id: "rimborso", label: "Rimborso", checked: rimborso, onChange: setRimborso },
            { id: "noCalcoloTasse", label: "No Calcolo Tasse", checked: noCalcoloTasse, onChange: setNoCalcoloTasse },
          ].map((flag) => (
            <div key={flag.id} className="flex items-center gap-1.5">
              <Checkbox id={flag.id} checked={flag.checked} onCheckedChange={(v) => flag.onChange(v === true)} />
              <Label htmlFor={flag.id} className="font-normal cursor-pointer text-xs">{flag.label}</Label>
            </div>
          ))}
        </div>
      </PolizzaSection>

      {/* PROVVIGIONI — solo selezione Commerciale (% Agenzia, totale e ripartizione sono nelle card Firma/Quietanza) */}
      <PolizzaSection title="Provvigioni — Commerciale" icon={Percent}>
        {produttoreEscludiProvvigioni && selectedAE && (
          <div className="mb-3 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-700/40">
            Il produttore assegnato a questo cliente è configurato <strong>senza provvigioni</strong>: la % Produttore sarà 0; l&apos;Account Executive mantiene la propria quota.
          </div>
        )}

        {!produttoreEscludiProvvigioni && (
          <div className="mb-4 space-y-2">
            <Label className="text-xs font-medium">Split provvigioni multi-produttore</Label>
            {splitsForm.length === 0 && (
              <div className="text-xs text-muted-foreground italic px-3 py-2 border rounded-md bg-muted/30">
                Nessun produttore aggiuntivo — usa il Produttore selezionato sopra oppure aggiungi righe.
              </div>
            )}
            {splitsForm.map((row, idx) => {
              const sel = aeOptionsForSplit.find((a) => a.value === row.anagrafica_commerciale_id);
              const def = sel?.percentuale_base;
              const dupCount = splitsForm.filter((s) => s.anagrafica_commerciale_id === row.anagrafica_commerciale_id).length;
              const isDup = !!row.anagrafica_commerciale_id && dupCount > 1;
              return (
                <div
                  key={idx}
                  className={`grid grid-cols-12 gap-2 items-end p-2 border rounded-md ${isDup ? "border-red-400 bg-red-50 dark:bg-red-950/20" : ""}`}
                >
                  <div className="col-span-12 md:col-span-7">
                    <Label className="text-[11px]">Produttore</Label>
                    <SearchableSelect
                      className="h-8 text-xs"
                      options={aeOptionsForSplit}
                      value={row.anagrafica_commerciale_id || ""}
                      onValueChange={(v) => {
                        const a = aeOptionsForSplit.find((x) => x.value === v);
                        setSplitsForm((prev) =>
                          prev.map((r, i) =>
                            i === idx
                              ? {
                                  ...r,
                                  anagrafica_commerciale_id: v,
                                  percentuale: r.percentuale > 0 ? r.percentuale : a?.percentuale_base || 0,
                                }
                              : r,
                          ),
                        );
                      }}
                      placeholder="Seleziona produttore..."
                    />
                    {isDup && <p className="text-[10px] text-red-600 mt-0.5">Produttore duplicato</p>}
                  </div>
                  <div className="col-span-8 md:col-span-3">
                    <Label className="text-[11px]">% Provvigione</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      className="h-8 text-xs font-mono"
                      value={row.percentuale}
                      onChange={(e) =>
                        setSplitsForm((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, percentuale: Number(e.target.value) } : r)),
                        )
                      }
                    />
                    {def != null && Number(def) !== Number(row.percentuale) && (
                      <button
                        type="button"
                        className="text-[10px] text-teal-700 underline hover:no-underline mt-0.5"
                        onClick={() =>
                          setSplitsForm((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, percentuale: Number(def) } : r)),
                          )
                        }
                      >
                        Usa default ({def}%)
                      </button>
                    )}
                  </div>
                  <div className="col-span-4 md:col-span-2 flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      onClick={() => setSplitsForm((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              );
            })}
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() =>
                setSplitsForm((prev) => [...prev, { anagrafica_commerciale_id: null, percentuale: 0 }])
              }
            >
              + Aggiungi produttore
            </Button>
            {(() => {
              const sumPerc = splitsForm.reduce((acc, s) => acc + (Number(s.percentuale) || 0), 0);
              const aePerc = selectedAccountExecutiveId ? Math.max(0, parseFloat(percentualeAE) || 0) : 0;
              const sumTot = sumPerc + aePerc;
              const consulPerc = Math.max(0, Math.round((100 - sumTot) * 100) / 100);
              const overflow = sumTot > 100.001;
              return (
                <div
                  className={`p-2 rounded-md border text-xs ${overflow ? "border-red-400 bg-red-50 dark:bg-red-950/20 text-red-800" : "bg-muted/40"}`}
                >
                  <div className="flex justify-between">
                    <span>Totale produttori:</span>
                    <strong className="font-mono tabular-nums">{sumPerc.toFixed(2)}%</strong>
                  </div>
                  {aePerc > 0 && (
                    <div className="flex justify-between">
                      <span>Account Executive:</span>
                      <strong className="font-mono tabular-nums">{aePerc.toFixed(2)}%</strong>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Consulbrokers SPA (residuo):</span>
                    <strong className="font-mono tabular-nums">{consulPerc.toFixed(2)}%</strong>
                  </div>
                  {overflow && (
                    <div className="text-[10px] mt-1">⚠ La somma (Produttori + AE) supera 100%</div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 items-end">
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Commerciale</Label>
            <SearchableSelect
              className="h-8 text-xs"
              value={selectedCommerciale}
              onValueChange={(v) => {
                setSelectedCommerciale(v);
                if (v === "__sede__") setPercentualeCommerciale("100");
              }}
              placeholder="— Seleziona —"
              options={[
                { value: "__sede__", label: "🏢 Sede (100%)" },
                ...(commercialiList || []).map((c) => ({
                  value: c.id,
                  label: `${c.cognome} ${c.nome} (${c.ruolo})`,
                })),
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              % Produttore
              <FieldHint>Quota provvigionale del Produttore selezionato. Default popolato dalla matrice "Provvigioni per Ramo".</FieldHint>
              {percentualeCommercialeAuto && (
                <span className="inline-flex items-center rounded-sm bg-primary/15 text-primary px-1.5 py-0.5 text-[9px] font-bold uppercase">auto</span>
              )}
            </Label>
            <Input
              type="number" step="1" min="0" max="100"
              value={percentualeCommerciale}
              onChange={(e) => { setPercentualeCommerciale(e.target.value); setPercentualeCommercialeAuto(false); }}
              disabled={selectedCommerciale === "__sede__" || produttoreEscludiProvvigioni}
              className="h-8 text-xs font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              % AE
              <FieldHint>Quota provvigione spettante all'Account Executive. Sommata alla % Produttore, il residuo va a Consulbrokers SPA. Somma totale ≤ 100%.</FieldHint>
              {!selectedAccountExecutiveId && (
                <span className="text-[9px] text-muted-foreground">(seleziona AE)</span>
              )}
            </Label>
            <Input
              type="number" step="0.01" min="0" max="100"
              value={percentualeAE}
              onChange={(e) => setPercentualeAE(e.target.value)}
              disabled={!selectedAccountExecutiveId}
              placeholder="0,00"
              className="h-8 text-xs font-mono"
            />
            {(() => {
              const sum = (parseFloat(percentualeCommerciale) || 0) + (parseFloat(percentualeAE) || 0);
              if (sum > 100.001) {
                return <p className="text-[10px] text-red-600 mt-0.5">Somma {sum.toFixed(2)}% &gt; 100%</p>;
              }
              if (selectedAccountExecutiveId && (parseFloat(percentualeAE) || 0) > 0) {
                return <p className="text-[10px] text-muted-foreground mt-0.5">Consul residuo: {(100 - sum).toFixed(2)}%</p>;
              }
              return null;
            })()}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              % Brokeraggio
              <FieldHint>Quota di brokeraggio del Produttore. Default popolato da "% Provv. Consulenza" dell'anagrafica professionale.</FieldHint>
              {percentualeBrokeraggioAuto && (
                <span className="inline-flex items-center rounded-sm bg-primary/15 text-primary px-1.5 py-0.5 text-[9px] font-bold uppercase">auto</span>
              )}
            </Label>
            <Input
              type="number" step="0.01" min="0" max="100"
              value={percentualeBrokeraggio}
              onChange={(e) => { setPercentualeBrokeraggio(e.target.value); setPercentualeBrokeraggioAuto(false); }}
              placeholder="0,00"
              className="h-8 text-xs font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Brokeraggio Firma €</Label>
            <Input
              type="text" readOnly tabIndex={-1}
              value={brokFirma ? brokFirma.toFixed(2) : "—"}
              className="h-8 text-xs font-mono bg-muted/40"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Brokeraggio Quietanza €</Label>
            <Input
              type="text" readOnly tabIndex={-1}
              value={brokQuietanza ? brokQuietanza.toFixed(2) : "—"}
              className="h-8 text-xs font-mono bg-muted/40"
            />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground italic mt-2">
          ℹ️ % e importo provvigione sono modificabili direttamente nelle card <b>Firma</b> e <b>Quietanza</b>.
          {percentualeCommercialeAuto && <> La % Commerciale è auto-popolata da <b>Provvigioni per Ramo</b> del produttore.</>}
        </p>
      </PolizzaSection>


      {/* === DATI CONDUCENTE (RCA) === */}
      {isRCA && (() => {
        const aiCls = (key: string) =>
          aiPrefilled.has(key) ? "border-l-2 border-l-primary bg-primary/[0.03]" : "";
        const aiBadge = (key: string) =>
          aiPrefilled.has(key) ? (
            <Sparkles className="inline-block h-3 w-3 text-primary ml-1" />
          ) : null;
        const applyConducenteFromContraente = (checked: boolean) => {
          setConducenteUgualeContraente(checked);
          if (!checked || !clienteDettaglio) return;
          const c: any = clienteDettaglio;
          setCNome(c.nome || ""); clearAiPrefilled("cNome");
          setCCognome(c.cognome || ""); clearAiPrefilled("cCognome");
          const isPrivato = (c.tipo_cliente || "") === "privato";
          const ind = isPrivato ? c.indirizzo_residenza : (c.indirizzo_sede || c.indirizzo_residenza);
          const cap = isPrivato ? c.cap_residenza : (c.cap_sede || c.cap_residenza);
          const citta = isPrivato ? c.citta_residenza : (c.citta_sede || c.citta_residenza);
          const prov = isPrivato ? c.provincia_residenza : (c.provincia_sede || c.provincia_residenza);
          if (ind) { setCIndirizzo(ind); clearAiPrefilled("cIndirizzo"); }
          if (cap) { setCCap(cap); clearAiPrefilled("cCap"); }
          if (citta) { setCCitta(citta); clearAiPrefilled("cCitta"); }
          if (prov) { setCProvincia(String(prov).toUpperCase()); clearAiPrefilled("cProvincia"); }
          if (c.data_nascita) { setCDataNascita(c.data_nascita); clearAiPrefilled("cDataNascita"); }
          // Se data nascita assente, prova a derivarla dal CF
          if (!c.data_nascita && c.codice_fiscale) {
            const parsed = parseCF(c.codice_fiscale);
            if (parsed) {
              setCDataNascita(parsed.dataNascita);
              const comune = lookupComune(parsed.codiceCatastale);
              if (comune && !prov) setCProvincia(comune.provincia);
            }
          }
          // Default patente per tipo veicolo
          if (!cTipoPatente) setCTipoPatente(defaultPatenteForVeicolo(vTipoVeicolo));
        };
        // Indirizzo conducente da Google Maps
        const handleAddressSelect = (parts: { indirizzo: string; cap: string; citta: string; provincia: string }) => {
          if (parts.cap) { setCCap(parts.cap); clearAiPrefilled("cCap"); }
          if (parts.citta) { setCCitta(parts.citta); clearAiPrefilled("cCitta"); }
          if (parts.provincia) {
            setCProvincia(parts.provincia.toUpperCase());
            clearAiPrefilled("cProvincia");
            // Pre-popola provincia di circolazione se vuota
            if (!vProvinciaCircolazione) {
              setVProvinciaCircolazione(parts.provincia.toUpperCase());
              clearAiPrefilled("vProvinciaCircolazione");
            }
          }
        };
        return (
        <>
          {/* DATI CONDUCENTE */}
          <PolizzaSection title="Dati Conducente" icon={UserCheck}>
            {/* Toggle Conducente = Contraente */}
            {clienteDettaglio && (
              <div className="rounded-md border border-border/60 bg-muted/30 p-3 flex items-center gap-2">
                <Checkbox id="cond-uguale-contraente" checked={conducenteUgualeContraente}
                  onCheckedChange={(v) => applyConducenteFromContraente(v === true)} />
                <Label htmlFor="cond-uguale-contraente" className="text-sm font-medium cursor-pointer">
                  Conducente = Contraente
                </Label>
                <span className="text-xs text-muted-foreground">— copia automaticamente nome, indirizzo, CAP, città, provincia e data di nascita (anche da CF)</span>
              </div>
            )}

            {/* Sub: Anagrafica */}
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Anagrafica</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Nome{aiBadge("cNome")}</Label>
                  <Input value={cNome} onChange={(e) => { setCNome(e.target.value); clearAiPrefilled("cNome"); }}
                    className={`h-9 text-sm ${aiCls("cNome")}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Cognome{aiBadge("cCognome")}</Label>
                  <Input value={cCognome} onChange={(e) => { setCCognome(e.target.value); clearAiPrefilled("cCognome"); }}
                    className={`h-9 text-sm ${aiCls("cCognome")}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Data Nascita{aiBadge("cDataNascita")}</Label>
                  <Input type="date" value={cDataNascita}
                    onChange={(e) => { setCDataNascita(e.target.value); clearAiPrefilled("cDataNascita"); }}
                    className={`h-9 text-sm ${aiCls("cDataNascita")}`} />
                </div>
              </div>
            </div>

            {/* Sub: Residenza (Google Maps) */}
            <div className="pt-3 border-t border-border/40">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Residenza</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[11px] font-medium text-foreground/80">Indirizzo{aiBadge("cIndirizzo")}</Label>
                  <AddressAutocomplete
                    value={cIndirizzo}
                    onChange={(v) => { setCIndirizzo(v); clearAiPrefilled("cIndirizzo"); }}
                    onSelect={handleAddressSelect}
                    placeholder="Digita per cercare l'indirizzo…"
                    className={`h-9 text-sm pr-8 ${aiCls("cIndirizzo")}`}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">CAP{aiBadge("cCap")}</Label>
                  <Input value={cCap} onChange={(e) => { setCCap(e.target.value); clearAiPrefilled("cCap"); }}
                    className={`h-9 text-sm font-mono ${aiCls("cCap")}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Città{aiBadge("cCitta")}</Label>
                  <Input value={cCitta} onChange={(e) => { setCCitta(e.target.value); clearAiPrefilled("cCitta"); }}
                    className={`h-9 text-sm ${aiCls("cCitta")}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Provincia{aiBadge("cProvincia")}</Label>
                  <SearchableSelect className={`h-9 text-sm ${aiCls("cProvincia")}`} value={cProvincia}
                    onValueChange={(v) => { setCProvincia(v); clearAiPrefilled("cProvincia"); }}
                    placeholder="—" options={PROVINCE_IT} />
                </div>
              </div>
            </div>

            {/* Sub: Patente */}
            <div className="pt-3 border-t border-border/40">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Patente</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Tipo Patente{aiBadge("cTipoPatente")}</Label>
                  <SearchableSelect className={`h-9 text-sm ${aiCls("cTipoPatente")}`} value={cTipoPatente}
                    onValueChange={(v) => { setCTipoPatente(v); clearAiPrefilled("cTipoPatente"); }}
                    placeholder={`— (default ${defaultPatenteForVeicolo(vTipoVeicolo)})`} options={TIPI_PATENTE} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Data Rilascio{aiBadge("cDataRilascioPatente")}</Label>
                  <Input type="date" value={cDataRilascioPatente}
                    onChange={(e) => { setCDataRilascioPatente(e.target.value); clearAiPrefilled("cDataRilascioPatente"); }}
                    className={`h-9 text-sm ${aiCls("cDataRilascioPatente")}`} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[11px] font-medium text-foreground/80">Note</Label>
                  <Input value={cNote} onChange={(e) => setCNote(e.target.value)} className="h-9 text-sm" />
                </div>
              </div>
            </div>
          </PolizzaSection>
        </>
        );
      })()}


      {/* ACTIONS */}
      <div className="flex flex-col gap-2 pt-2">
        {saveBlockReason && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            ⚠ {saveBlockReason}
          </div>
        )}
        <div className="flex justify-between">
          <Button variant="secondary" onClick={exitImmissione}>Chiudi</Button>
          <Button
            onClick={handleConferma}
            disabled={saving || !!saveBlockReason}
            title={saveBlockReason || undefined}
          >
            {saving ? "Salvataggio..." : "Conferma"}
          </Button>
        </div>
      </div>

      <LibroMatricolaDialog
        open={matricolaDialogOpen}
        onOpenChange={setMatricolaDialogOpen}
        righe={righeMatricola}
        onChange={setRigheMatricola}
      />
    </PageContainer>
  );
};

export default ImmissionePolizzaPage;
