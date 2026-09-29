import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Car, Plus, Trash2, ShieldCheck, AlertCircle, CheckCircle2, Lock, RefreshCw, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtEuro as fmtEur } from "@/lib/formatCurrency";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

interface Voce {
  id: string;
  titolo_id: string;
  garanzia: string;
  codice_garanzia: string | null;
  firma: number | null;
  aliquota_tasse_pct: number | null;
  lordo_calcolato: number | null;
  is_rca_principale: boolean;
  imposta_provinciale: number | null;
  ssn: number | null;
  ordine: number | null;
  tipo_premio?: "firma" | "quietanza";
  quietanza_personalizzata?: boolean;
  voce_origine_id?: string | null;
  capitale?: number | null;
  tasso?: number | null;
  rata?: number | null;
  annuo?: number | null;
}

type TipoPremio = "firma" | "quietanza";

const RCA_LABEL = "RCA Auto";
const RCA_CODE = "RCA";
const SSN_PCT = 10.5;
const ALIQUOTA_ACCESSORIE_DEFAULT = 13.5; // tasse accessorie auto (non-RCA)

function calcolaLordo(
  v: {
    firma: number | null;
    aliquota_tasse_pct: number | null;
    is_rca_principale: boolean;
    imposta_provinciale?: number | null;
    ssn?: number | null;
  },
  aliquotaProv: number,
) {
  const netto = round2(Number(v.firma || 0));
  if (v.is_rca_principale) {
    const impostaAuto = round2(netto * (aliquotaProv / 100));
    const ssnAuto = round2(netto * (SSN_PCT / 100));
    // Override manuale se i valori salvati differiscono dal calcolo automatico
    const impostaSaved = v.imposta_provinciale == null ? null : round2(Number(v.imposta_provinciale));
    const ssnSaved = v.ssn == null ? null : round2(Number(v.ssn));
    const overrideImposta = impostaSaved != null && Math.abs(impostaSaved - impostaAuto) > 0.01;
    const overrideSsn = ssnSaved != null && Math.abs(ssnSaved - ssnAuto) > 0.01;
    const imposta = overrideImposta ? (impostaSaved as number) : impostaAuto;
    const ssn = overrideSsn ? (ssnSaved as number) : ssnAuto;
    return {
      netto,
      lordo: round2(netto + imposta + ssn),
      imposta,
      ssn,
      overrideImposta,
      overrideSsn,
    };
  }
  const aliq = Number(v.aliquota_tasse_pct ?? ALIQUOTA_ACCESSORIE_DEFAULT);
  const tasse = round2(netto * (aliq / 100));
  return { netto, lordo: round2(netto + tasse), imposta: 0, ssn: 0, overrideImposta: false, overrideSsn: false };
}

export function VociRcaCard({ titoloId, premioLordoTitolo, provinciaCliente, onTotaliChange, tipoPremio = "firma", titolo, provvigioniValue, onProvvigioniChange, mainLabel, useAutoTaxFormula = true, aliquotaDefault, mostraCampiCapitaleRata = false, addizionaliValue, onAddizionaliChange }: {
  titoloId: string;
  premioLordoTitolo?: number | null;
  provinciaCliente?: string | null;
  onTotaliChange?: (t: { netto: number; tasse: number; lordo: number }) => void;
  tipoPremio?: TipoPremio;
  titolo?: string;
  provvigioniValue?: number | null;
  onProvvigioniChange?: (v: number) => void;
  mainLabel?: string;
  /** Quando false (rami non-auto), NON viene auto-creata la riga principale RCA con formula IPT+SSN.
   *  Tutte le voci usano la formula semplice: lordo = netto × (1 + aliquota/100). */
  useAutoTaxFormula?: boolean;
  /** Aliquota tasse default per nuove voci (es. aliquota_tasse_ramo). Sovrascrive il fallback 13.5. */
  aliquotaDefault?: number;
  /** Mostra colonne Capitale / Tasso ‰ / Rata / Annuo (rami non-auto). */
  mostraCampiCapitaleRata?: boolean;
  /** Importo Addizionali (rami non-auto). Se passato, viene mostrato un input nei totali e sommato al Lordo. */
  addizionaliValue?: number | null;
  onAddizionaliChange?: (v: number) => void;
}) {
  const ALIQ_DEFAULT = aliquotaDefault ?? ALIQUOTA_ACCESSORIE_DEFAULT;
  const RCA_LABEL_EFFECTIVE = mainLabel || "RCA Auto";
  const qc = useQueryClient();
  const isQuietanza = tipoPremio === "quietanza";
  const [aliquotaProv, setAliquotaProv] = useState<number>(16);
  const [toDelete, setToDelete] = useState<Voce | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const mostraAddizionali = !!onAddizionaliChange;
  const [addizionaliDraft, setAddizionaliDraft] = useState<string | null>(null);
  // Draft state per editing live (controlled inputs); chiavi: voce.id → campi sovrascritti
  const [draftVoci, setDraftVoci] = useState<Record<string, Partial<Voce>>>({});
  const setDraft = (id: string, patch: Partial<Voce>) =>
    setDraftVoci((d) => ({ ...d, [id]: { ...(d[id] || {}), ...patch } }));
  const clearDraft = (id: string, keys: (keyof Voce)[]) =>
    setDraftVoci((d) => {
      const cur = { ...(d[id] || {}) };
      keys.forEach((k) => delete (cur as any)[k]);
      const next = { ...d };
      if (Object.keys(cur).length === 0) delete next[id];
      else next[id] = cur;
      return next;
    });
  const getDraftNum = (id: string, key: keyof Voce, fallback: number) => {
    const v = draftVoci[id]?.[key];
    return v === undefined || v === null || v === "" ? fallback : Number(v);
  };

  useEffect(() => {
    if (!provinciaCliente) return;
    supabase.from("aliquote_provinciali_rca" as any)
      .select("aliquota_pct")
      .eq("provincia", provinciaCliente.toUpperCase())
      .maybeSingle()
      .then(({ data }: any) => { if (data?.aliquota_pct) setAliquotaProv(Number(data.aliquota_pct)); });
  }, [provinciaCliente]);

  const { data: voci = [], isLoading } = useQuery({
    queryKey: ["voci-rca", titoloId, tipoPremio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("premi_garanzia_polizza" as any)
        .select("*")
        .eq("titolo_id", titoloId)
        .eq("tipo_premio", tipoPremio)
        .order("is_rca_principale", { ascending: false })
        .order("ordine", { ascending: true });
      if (error) throw error;
      return (data as any as Voce[]) || [];
    },
  });

  // Recupera il gruppo_ramo_id del titolo per filtrare il catalogo garanzie
  const { data: gruppoRamoTitolo } = useQuery({
    queryKey: ["titolo-gruppo-ramo", titoloId],
    queryFn: async () => {
      const { data } = await supabase
        .from("titoli" as any)
        .select("ramo_id, rami!inner(gruppo_ramo_id)")
        .eq("id", titoloId)
        .maybeSingle();
      return (data as any)?.rami?.gruppo_ramo_id as string | undefined;
    },
  });

  const { data: catalogo = [] } = useQuery({
    queryKey: ["rca-garanzie-catalogo", gruppoRamoTitolo || "all"],
    enabled: !!gruppoRamoTitolo,
    queryFn: async () => {
      const { data } = await supabase
        .from("rca_garanzie" as any)
        .select("codice, descrizione, aliquota_tasse")
        .eq("attivo", true)
        .eq("gruppo_ramo_id", gruppoRamoTitolo!)
        .order("codice");
      return (data as any[]) || [];
    },
  });

  // Carico anche l'altro lato (Firma↔Quietanza) per evidenziare disallineamenti di voci
  const { data: vociAltroLato = [] } = useQuery({
    queryKey: ["voci-rca", titoloId, isQuietanza ? "firma" : "quietanza"],
    queryFn: async () => {
      const { data } = await supabase
        .from("premi_garanzia_polizza" as any)
        .select("codice_garanzia, firma, is_rca_principale")
        .eq("titolo_id", titoloId)
        .eq("tipo_premio", isQuietanza ? "firma" : "quietanza");
      return (data as any[]) || [];
    },
  });
  const invalidateBoth = () => {
    qc.invalidateQueries({ queryKey: ["voci-rca", titoloId, "firma"] });
    qc.invalidateQueries({ queryKey: ["voci-rca", titoloId, "quietanza"] });
  };

  // Realtime: ascolta cambi sulle voci di questo titolo (anche da trigger DB)
  useEffect(() => {
    const channel = supabase
      .channel(`voci-rca-${titoloId}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "premi_garanzia_polizza", filter: `titolo_id=eq.${titoloId}` },
        () => invalidateBoth(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titoloId]);

  // Nota: la riga "RCA Auto / principale" non viene più auto-creata.
  // Il sottoramo (es. QA, PI, RV*) si seleziona direttamente come voce di garanzia.
  // Le polizze esistenti con riga `is_rca_principale=true` continuano a funzionare
  // (formula IPT+SSN applicata in calcolaLordo), ma per le nuove polizze la voce
  // principale è semplicemente la riga del sottoramo RCA scelta dall'utente.



  const upsertMut = useMutation({
    mutationFn: async (v: Partial<Voce> & { id: string }) => {
      const { id, ...rest } = v;
      // Se sto modificando una riga Quietanza, marcala come personalizzata
      if (isQuietanza && (rest as any).quietanza_personalizzata === undefined) {
        (rest as any).quietanza_personalizzata = true;
      }
      const { error } = await supabase.from("premi_garanzia_polizza" as any).update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateBoth(),
    onError: (e: any) => toast.error("Salvataggio fallito: " + e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("premi_garanzia_polizza" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateBoth();
      toast.success("Voce rimossa");
      setToDelete(null);
    },
    onError: (e: any) => toast.error("Rimozione fallita: " + e.message),
  });

  const addMut = useMutation({
    mutationFn: async (g: { codice: string; descrizione: string; aliquota_tasse: number | null }) => {
      const { error } = await supabase.from("premi_garanzia_polizza" as any).insert({
        titolo_id: titoloId,
        garanzia: g.descrizione,
        codice_garanzia: g.codice,
        aliquota_tasse_pct: g.aliquota_tasse ?? ALIQ_DEFAULT,
        is_rca_principale: false,
        firma: 0,
        ordine: (voci.length || 0) + 1,
        tipo_premio: tipoPremio,
        quietanza_personalizzata: isQuietanza ? true : false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateBoth();
      toast.success("Voce aggiunta");
    },
  });

  const resetQuietanzaMut = useMutation({
    mutationFn: async () => {
      // Reset all quietanza rows for this titolo to non-personalizzato, then run sync RPC
      const { error: e1 } = await supabase
        .from("premi_garanzia_polizza" as any)
        .update({ quietanza_personalizzata: false })
        .eq("titolo_id", titoloId)
        .eq("tipo_premio", "quietanza");
      if (e1) throw e1;
      const { error: e2 } = await supabase.rpc("sync_quietanza_da_firma" as any, { p_titolo_id: titoloId });
      if (e2) {
        // Fallback client-side: cancella le righe quietanza non personalizzate e re-inserisci da firma
        const { error: eDel } = await supabase
          .from("premi_garanzia_polizza" as any)
          .delete()
          .eq("titolo_id", titoloId)
          .eq("tipo_premio", "quietanza")
          .eq("quietanza_personalizzata", false);
        if (eDel) throw eDel;
        const { data: firmaRows, error: eSel } = await supabase
          .from("premi_garanzia_polizza" as any)
          .select("*")
          .eq("titolo_id", titoloId)
          .eq("tipo_premio", "firma");
        if (eSel) throw eSel;
        if (firmaRows && firmaRows.length) {
          const inserts = (firmaRows as any[]).map((f) => ({
            titolo_id: f.titolo_id,
            garanzia: f.garanzia,
            codice_garanzia: f.codice_garanzia,
            firma: f.firma,
            aliquota_tasse_pct: f.aliquota_tasse_pct,
            is_rca_principale: f.is_rca_principale,
            imposta_provinciale: f.imposta_provinciale,
            ssn: f.ssn,
            lordo_calcolato: f.lordo_calcolato,
            ordine: f.ordine,
            capitale: f.capitale,
            tasso: f.tasso,
            rata: f.rata,
            annuo: f.annuo,
            tipo_premio: "quietanza",
            voce_origine_id: f.id,
            quietanza_personalizzata: false,
          }));
          const { error: eIns } = await supabase.from("premi_garanzia_polizza" as any).insert(inserts);
          if (eIns) throw eIns;
        }
      }
    },
    onSuccess: () => {
      invalidateBoth();
      toast.success("Quietanza riallineata alla Firma");
      setConfirmReset(false);
    },
    onError: (e: any) => toast.error("Reset fallito: " + (e?.message || e)),
  });

  const handleNettoBlur = (v: Voce, value: number) => {
    if (isNaN(value) || value < 0) {
      toast.error("Il premio netto deve essere ≥ 0");
      return;
    }
    if (value > 1_000_000) {
      toast.error("Premio netto fuori scala (max 1.000.000 €)");
      return;
    }
    const netto = round2(value);
    // Mantengo eventuali override IPT/SSN già impostati dall'utente
    const calc = calcolaLordo({ ...v, firma: netto }, aliquotaProv);
    if (v.is_rca_principale && (calc.overrideImposta || calc.overrideSsn)) {
      toast.info("Sovrascrittura IPT/SSN mantenuta");
    }
    upsertMut.mutate({
      id: v.id,
      firma: netto,
      lordo_calcolato: calc.lordo,
      imposta_provinciale: v.is_rca_principale ? calc.imposta : null,
      ssn: v.is_rca_principale ? calc.ssn : null,
    });
  };

  const handleLordoBlur = (v: Voce, value: number) => {
    if (isNaN(value) || value < 0) {
      toast.error("Il premio lordo deve essere ≥ 0");
      return;
    }
    if (value > 1_000_000) {
      toast.error("Premio lordo fuori scala (max 1.000.000 €)");
      return;
    }
    const lordo = round2(value);
    let netto: number;
    if (v.is_rca_principale) {
      // Edit del lordo ⇒ azzera eventuali override e usa formula standard:
      // lordo = netto × (1 + aliqProv/100 + SSN%/100)
      const factor = 1 + aliquotaProv / 100 + SSN_PCT / 100;
      netto = round2(lordo / factor);
      const cleanV = { ...v, firma: netto, imposta_provinciale: null, ssn: null };
      const calc = calcolaLordo(cleanV, aliquotaProv);
      const eraOverride =
        (v.imposta_provinciale != null && Math.abs(Number(v.imposta_provinciale) - round2(netto * (aliquotaProv / 100))) > 0.01) ||
        (v.ssn != null && Math.abs(Number(v.ssn) - round2(netto * (SSN_PCT / 100))) > 0.01);
      if (eraOverride) toast.info("Override IPT/SSN azzerati (calcolo automatico ripristinato)");
      upsertMut.mutate({
        id: v.id,
        firma: netto,
        lordo_calcolato: calc.lordo,
        imposta_provinciale: calc.imposta,
        ssn: calc.ssn,
      });
      return;
    }
    const aliq = Number(v.aliquota_tasse_pct ?? ALIQUOTA_ACCESSORIE_DEFAULT);
    netto = round2(lordo / (1 + aliq / 100));
    const calc = calcolaLordo({ ...v, firma: netto }, aliquotaProv);
    upsertMut.mutate({
      id: v.id,
      firma: netto,
      lordo_calcolato: calc.lordo,
      imposta_provinciale: null,
      ssn: null,
    });
  };

  const handleAliquotaBlur = (v: Voce, value: number) => {
    if (isNaN(value) || value < 0 || value > 100) {
      toast.error("Aliquota tasse deve essere tra 0 e 100%");
      return;
    }
    const calc = calcolaLordo({ ...v, aliquota_tasse_pct: value }, aliquotaProv);
    upsertMut.mutate({
      id: v.id,
      aliquota_tasse_pct: value,
      lordo_calcolato: calc.lordo,
    });
  };

  const handleImpostaOverrideBlur = (v: Voce, value: number) => {
    if (isNaN(value) || value < 0) {
      toast.error("Imposta provinciale deve essere ≥ 0");
      return;
    }
    const newImposta = round2(value);
    const calc = calcolaLordo({ ...v, imposta_provinciale: newImposta }, aliquotaProv);
    upsertMut.mutate({
      id: v.id,
      imposta_provinciale: newImposta,
      ssn: calc.ssn,
      lordo_calcolato: calc.lordo,
    });
  };

  const handleSsnOverrideBlur = (v: Voce, value: number) => {
    if (isNaN(value) || value < 0) {
      toast.error("Contributo SSN deve essere ≥ 0");
      return;
    }
    const newSsn = round2(value);
    const calc = calcolaLordo({ ...v, ssn: newSsn }, aliquotaProv);
    upsertMut.mutate({
      id: v.id,
      ssn: newSsn,
      imposta_provinciale: calc.imposta,
      lordo_calcolato: calc.lordo,
    });
  };

  const handleResetOverride = (v: Voce, campo: "imposta" | "ssn" | "both") => {
    const netto = round2(Number(v.firma || 0));
    const impostaAuto = round2(netto * (aliquotaProv / 100));
    const ssnAuto = round2(netto * (SSN_PCT / 100));
    const newImposta = campo === "ssn" ? Number(v.imposta_provinciale ?? impostaAuto) : impostaAuto;
    const newSsn = campo === "imposta" ? Number(v.ssn ?? ssnAuto) : ssnAuto;
    const calc = calcolaLordo(
      { ...v, imposta_provinciale: newImposta, ssn: newSsn },
      aliquotaProv,
    );
    upsertMut.mutate({
      id: v.id,
      imposta_provinciale: calc.imposta,
      ssn: calc.ssn,
      lordo_calcolato: calc.lordo,
    });
    toast.success("Calcolo automatico ripristinato");
  };

  const handleAliquotaProvChange = (val: number) => {
    if (isNaN(val) || val < 0 || val > 50) {
      toast.error("Imposta provinciale deve essere tra 0 e 50%");
      return;
    }
    setAliquotaProv(val);
    const rca = voci.find((v) => v.is_rca_principale);
    if (rca) {
      const calc = calcolaLordo(rca, val);
      upsertMut.mutate({
        id: rca.id,
        lordo_calcolato: calc.lordo,
        imposta_provinciale: calc.imposta,
        ssn: calc.ssn,
      });
    }
  };

  // Handler totali editabili (riquadro Totali)
  const handleTotaleIptBlur = (val: number) => {
    const rca = voci.find((v) => v.is_rca_principale);
    if (!rca) return;
    handleImpostaOverrideBlur(rca, val);
  };
  const handleTotaleSsnBlur = (val: number) => {
    const rca = voci.find((v) => v.is_rca_principale);
    if (!rca) return;
    handleSsnOverrideBlur(rca, val);
  };
  const handleTotaleAccBlur = (val: number) => {
    if (isNaN(val) || val < 0) {
      toast.error("Tasse accessorie devono essere ≥ 0");
      return;
    }
    const accVoci = voci.filter((v) => !v.is_rca_principale);
    const sommaNetto = accVoci.reduce((s, v) => s + Number(v.firma || 0), 0);
    if (sommaNetto < 0.01) {
      toast.error("Nessuna voce accessoria con netto > 0 su cui applicare le tasse");
      return;
    }
    const nuovaAliq = round2((val / sommaNetto) * 100);
    accVoci.forEach((v) => {
      const calc = calcolaLordo({ ...v, aliquota_tasse_pct: nuovaAliq }, aliquotaProv);
      upsertMut.mutate({ id: v.id, aliquota_tasse_pct: nuovaAliq, lordo_calcolato: calc.lordo });
    });
    toast.success(`Aliquota accessorie aggiornata a ${nuovaAliq}%`);
  };

  // Merge draft (editing live) sui dati salvati per ricalcolare totali in tempo reale
  const vociMerged = useMemo(
    () => voci.map((v) => ({ ...v, ...(draftVoci[v.id] || {}) })),
    [voci, draftVoci],
  );

  const totali = useMemo(() => {
    let netto = 0, lordo = 0, imposta = 0, ssn = 0, tasseAcc = 0;
    vociMerged.forEach((v) => {
      const c = calcolaLordo(v, aliquotaProv);
      netto = round2(netto + c.netto);
      lordo = round2(lordo + c.lordo);
      imposta = round2(imposta + c.imposta);
      ssn = round2(ssn + c.ssn);
      if (!v.is_rca_principale) tasseAcc = round2(tasseAcc + (c.lordo - c.netto));
    });
    return { netto, lordo, tasse: round2(lordo - netto), imposta, ssn, tasseAcc };
  }, [vociMerged, aliquotaProv]);

  useEffect(() => {
    if (isLoading) return;
    onTotaliChange?.({ netto: totali.netto, tasse: totali.tasse, lordo: totali.lordo });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totali.netto, totali.tasse, totali.lordo, isLoading]);

  const codiciPresenti = new Set(voci.map((v) => (v.codice_garanzia || "").toUpperCase()));
  const catalogoDisponibile = (catalogo as any[]).filter(
    (g) => !codiciPresenti.has(String(g.codice).toUpperCase()) && String(g.codice).toUpperCase() !== RCA_CODE,
  );

  const delta = premioLordoTitolo == null ? 0 : round2(totali.lordo - Number(premioLordoTitolo));
  const quadra = premioLordoTitolo == null || Math.abs(delta) < 0.01;

  // Verifica quadratura interna (netto + tasse = lordo)
  const quadraInterno = Math.abs(round2(totali.netto + totali.tasse) - totali.lordo) < 0.01;

  // Differenze di composizione tra Firma e Quietanza
  const codiciSet = new Set(voci.map((v) => (v.codice_garanzia || "").toUpperCase()));
  const codiciAltro = new Set((vociAltroLato as any[]).map((v) => (v.codice_garanzia || "").toUpperCase()));
  const mancanti = [...codiciAltro].filter((c) => !codiciSet.has(c));
  const inEccesso = [...codiciSet].filter((c) => !codiciAltro.has(c));
  const disallineamentoVoci = mancanti.length + inEccesso.length;

  return (
    <>
      <Card className={cn("border-l-4 shadow-sm", isQuietanza ? "border-l-amber-500" : "border-l-teal-600")}>
        <CardHeader className={cn("border-b py-3", isQuietanza ? "bg-amber-50/60 dark:bg-amber-950/20" : "bg-teal-50/60 dark:bg-teal-950/20")}>
          <div className="flex items-start sm:items-center justify-between flex-wrap gap-2">
            <CardTitle className={cn("flex items-center gap-2 text-base sm:text-lg", isQuietanza ? "text-amber-900 dark:text-amber-100" : "text-teal-900 dark:text-teal-100")}>
              {useAutoTaxFormula ? <Car className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
              {titolo ?? (isQuietanza ? "Composizione Premio RCA — Quietanza" : "Composizione Premio RCA — Firma")}
              {isQuietanza && voci.some((v) => v.quietanza_personalizzata) && (
                <Badge variant="outline" className="ml-1 text-[10px] gap-1 border-amber-400 text-amber-800">
                  <PencilLine className="h-3 w-3" /> Personalizzata
                </Badge>
              )}
              {isQuietanza && !voci.some((v) => v.quietanza_personalizzata) && (
                <Badge variant="outline" className="ml-1 text-[10px] border-emerald-400 text-emerald-800">
                  Sincronizzata
                </Badge>
              )}
              {/* Badge Personalizzato anche su Firma RCA quando IPT/SSN sono override manuali */}
              {!isQuietanza && useAutoTaxFormula && (() => {
                const rca = voci.find((v) => v.is_rca_principale);
                if (!rca) return null;
                const c = calcolaLordo(rca, aliquotaProv);
                if (!c.overrideImposta && !c.overrideSsn) return null;
                return (
                  <Badge variant="outline" className="ml-1 text-[10px] gap-1 border-amber-400 text-amber-800" title="IPT o SSN sovrascritti manualmente">
                    <PencilLine className="h-3 w-3" /> Personalizzato
                  </Badge>
                );
              })()}
              {disallineamentoVoci > 0 && (
                <Badge
                  variant="outline"
                  className="ml-1 text-[10px] gap-1 border-orange-400 text-orange-800 bg-orange-50"
                  title={`Voci diverse rispetto a ${isQuietanza ? "Firma" : "Quietanza"}: ${[...mancanti, ...inEccesso].join(", ")}`}
                >
                  <AlertCircle className="h-3 w-3" /> {disallineamentoVoci} voce{disallineamentoVoci > 1 ? "i" : ""} disallineata
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              {isQuietanza && (
                <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setConfirmReset(true)}
                  disabled={!voci.some((v) => v.quietanza_personalizzata)}>
                  <RefreshCw className="h-3.5 w-3.5" /> Risincronizza
                </Button>
              )}
              {voci.some((v) => v.is_rca_principale) && (() => {
                const rca = voci.find((v) => v.is_rca_principale)!;
                const c = calcolaLordo(rca, aliquotaProv);
                if (!c.overrideImposta && !c.overrideSsn) return null;
                return (
                  <Button variant="outline" size="sm" className="h-8 gap-1"
                    title="Ripristina IPT e SSN al calcolo automatico (netto × aliquote)"
                    onClick={() => handleResetOverride(rca, "both")}>
                    <RefreshCw className="h-3.5 w-3.5" /> Ricalcola IPT/SSN
                  </Button>
                );
              })()}
              {useAutoTaxFormula && (
                <>
                  <span className="text-muted-foreground hidden sm:inline">Imposta provinciale:</span>
                  <span className="text-muted-foreground sm:hidden">IPT:</span>
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    className="h-8 w-16 sm:w-20 text-right"
                    defaultValue={aliquotaProv}
                    onBlur={(e) => handleAliquotaProvChange(Number(e.target.value || 0))}
                  />
                  <span className="text-muted-foreground">%</span>
                  {provinciaCliente && <Badge variant="outline" className="text-[10px]">{provinciaCliente}</Badge>}
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop / tablet table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className={mostraCampiCapitaleRata ? "w-[24%] min-w-[200px]" : "w-[40%] min-w-[240px]"}>Voce</TableHead>
                  <TableHead className="text-right">Premio Netto</TableHead>
                  <TableHead className="text-right w-[110px]">Aliquota %</TableHead>
                  <TableHead className="text-right">Premio Lordo</TableHead>
                  {mostraCampiCapitaleRata && <TableHead className="text-right">Capitale</TableHead>}
                  {mostraCampiCapitaleRata && <TableHead className="text-right w-[90px]">Tasso ‰</TableHead>}
                  {mostraCampiCapitaleRata && <TableHead className="text-right">Rata</TableHead>}
                  {mostraCampiCapitaleRata && <TableHead className="text-right">Annuo</TableHead>}
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vociMerged.map((v, idx) => {
                  const calc = calcolaLordo(v, aliquotaProv);
                  const nettoVal = getDraftNum(v.id, "firma", Number(v.firma ?? 0));
                  const aliqVal = getDraftNum(v.id, "aliquota_tasse_pct", Number(v.aliquota_tasse_pct ?? ALIQUOTA_ACCESSORIE_DEFAULT));
                  const lordoVal = draftVoci[v.id]?.lordo_calcolato !== undefined
                    ? Number(draftVoci[v.id]!.lordo_calcolato)
                    : calc.lordo;
                  const iptVal = draftVoci[v.id]?.imposta_provinciale !== undefined
                    ? Number(draftVoci[v.id]!.imposta_provinciale)
                    : calc.imposta;
                  const ssnVal = draftVoci[v.id]?.ssn !== undefined
                    ? Number(draftVoci[v.id]!.ssn)
                    : calc.ssn;
                  return (
                    <>
                      <TableRow
                        key={v.id}
                        className={cn(
                          idx % 2 === 1 && "bg-muted/20",
                          v.is_rca_principale && "bg-teal-50/80 dark:bg-teal-950/30 hover:bg-teal-50 font-medium",
                        )}
                      >
                        <TableCell className="flex items-center gap-2">
                          {v.is_rca_principale && <ShieldCheck className="h-4 w-4 text-teal-700" />}
                          {!useAutoTaxFormula && !v.is_rca_principale ? (
                            <Input
                              value={(draftVoci[v.id]?.garanzia as string | undefined) ?? v.garanzia ?? ""}
                              onChange={(e) => setDraft(v.id, { garanzia: e.target.value } as any)}
                              onBlur={(e) => {
                                const val = e.target.value.trim();
                                clearDraft(v.id, ["garanzia"] as any);
                                if (!val || val === v.garanzia) return;
                                upsertMut.mutate({ id: v.id, garanzia: val } as any);
                              }}
                              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                              className="h-8 w-full min-w-[200px]"
                              placeholder="Nome garanzia"
                            />
                          ) : (
                            <span>{v.garanzia}</span>
                          )}
                          {v.is_rca_principale && <Badge variant="outline" className="ml-1 text-[10px]">principale</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number" step="0.01" inputMode="decimal"
                            value={nettoVal}
                            onChange={(e) => setDraft(v.id, { firma: e.target.value === "" ? 0 : Number(e.target.value) } as any)}
                            onBlur={(e) => { clearDraft(v.id, ["firma"]); handleNettoBlur(v, Number(e.target.value || 0)); }}
                            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                            className="h-8 text-right ml-auto w-32"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {v.is_rca_principale ? (
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                type="number" step="0.01" inputMode="decimal"
                                value={aliquotaProv}
                                onChange={(e) => setAliquotaProv(Number(e.target.value || 0))}
                                onBlur={(e) => handleAliquotaProvChange(Number(e.target.value || 0))}
                                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                className="h-8 text-right w-16"
                                title="Imposta provinciale (modifica live)"
                              />
                              <span className="text-[10px] text-muted-foreground">% +SSN</span>
                            </div>
                          ) : (
                            <Input
                              type="number" step="0.01" inputMode="decimal"
                              value={aliqVal}
                              onChange={(e) => setDraft(v.id, { aliquota_tasse_pct: e.target.value === "" ? 0 : Number(e.target.value) } as any)}
                              onBlur={(e) => { clearDraft(v.id, ["aliquota_tasse_pct"]); handleAliquotaBlur(v, Number(e.target.value || 0)); }}
                              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                              className="h-8 text-right ml-auto w-20"
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number" step="0.01" inputMode="decimal"
                            value={lordoVal}
                            onChange={(e) => setDraft(v.id, { lordo_calcolato: e.target.value === "" ? 0 : Number(e.target.value) } as any)}
                            onBlur={(e) => {
                              const val = Number(e.target.value || 0);
                              clearDraft(v.id, ["lordo_calcolato"]);
                              if (Math.abs(val - calc.lordo) < 0.01) return;
                              handleLordoBlur(v, val);
                            }}
                            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                            className="h-8 text-right ml-auto w-32 font-mono tabular-nums"
                          />
                        </TableCell>
                        {mostraCampiCapitaleRata && (
                          <>
                            <TableCell className="text-right">
                              <Input
                                type="number" step="0.01" inputMode="decimal"
                                defaultValue={v.capitale ?? ""}
                                key={`cap-${v.id}-${v.capitale ?? ""}`}
                                onBlur={(e) => {
                                  const val = e.target.value === "" ? null : Number(e.target.value);
                                  if ((v.capitale ?? null) === val) return;
                                  upsertMut.mutate({ id: v.id, capitale: val } as any);
                                }}
                                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                className="h-8 text-right ml-auto w-28 font-mono tabular-nums"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number" step="0.001" inputMode="decimal"
                                defaultValue={v.tasso ?? ""}
                                key={`tas-${v.id}-${v.tasso ?? ""}`}
                                onBlur={(e) => {
                                  const val = e.target.value === "" ? null : Number(e.target.value);
                                  if ((v.tasso ?? null) === val) return;
                                  upsertMut.mutate({ id: v.id, tasso: val } as any);
                                }}
                                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                className="h-8 text-right ml-auto w-20 font-mono tabular-nums"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number" step="0.01" inputMode="decimal"
                                defaultValue={v.rata ?? ""}
                                key={`rat-${v.id}-${v.rata ?? ""}`}
                                onBlur={(e) => {
                                  const val = e.target.value === "" ? null : Number(e.target.value);
                                  if ((v.rata ?? null) === val) return;
                                  upsertMut.mutate({ id: v.id, rata: val } as any);
                                }}
                                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                className="h-8 text-right ml-auto w-24 font-mono tabular-nums"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number" step="0.01" inputMode="decimal"
                                defaultValue={v.annuo ?? ""}
                                key={`ann-${v.id}-${v.annuo ?? ""}`}
                                onBlur={(e) => {
                                  const val = e.target.value === "" ? null : Number(e.target.value);
                                  if ((v.annuo ?? null) === val) return;
                                  upsertMut.mutate({ id: v.id, annuo: val } as any);
                                }}
                                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                className="h-8 text-right ml-auto w-24 font-mono tabular-nums"
                              />
                            </TableCell>
                          </>
                        )}
                        <TableCell>
                          {v.is_rca_principale ? (
                            <span title={`${RCA_LABEL_EFFECTIVE} non rimovibile`} className="inline-flex">
                              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                            </span>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                              onClick={() => setToDelete(v)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {useAutoTaxFormula && v.is_rca_principale && (
                        <>
                          <TableRow className="bg-muted/30 text-xs text-muted-foreground">
                            <TableCell className="pl-10">
                              <span className="inline-flex items-center gap-1.5">
                                ↳ Imposta provinciale ({aliquotaProv}%)
                                {calc.overrideImposta && (
                                  <Badge variant="outline" className="h-4 px-1 text-[9px] gap-0.5 border-amber-400 text-amber-800">
                                    <PencilLine className="h-2.5 w-2.5" /> manuale
                                  </Badge>
                                )}
                              </span>
                            </TableCell>
                            <TableCell colSpan={2}></TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Input
                                  type="number" step="0.01" inputMode="decimal"
                                  value={iptVal}
                                  onChange={(e) => setDraft(v.id, { imposta_provinciale: e.target.value === "" ? 0 : Number(e.target.value) } as any)}
                                  onBlur={(e) => {
                                    const val = Number(e.target.value || 0);
                                    clearDraft(v.id, ["imposta_provinciale"]);
                                    if (Math.abs(val - calc.imposta) < 0.01) return;
                                    handleImpostaOverrideBlur(v, val);
                                  }}
                                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                  className="h-7 text-right w-24 font-mono tabular-nums"
                                />
                                {calc.overrideImposta && (
                                  <Button
                                    variant="ghost" size="icon" className="h-6 w-6"
                                    title="Ripristina calcolo automatico"
                                    onClick={() => handleResetOverride(v, "imposta")}
                                  >
                                    <RefreshCw className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                          <TableRow className="bg-muted/30 text-xs text-muted-foreground">
                            <TableCell className="pl-10">
                              <span className="inline-flex items-center gap-1.5">
                                ↳ Contributo SSN 10,5%
                                {calc.overrideSsn && (
                                  <Badge variant="outline" className="h-4 px-1 text-[9px] gap-0.5 border-amber-400 text-amber-800">
                                    <PencilLine className="h-2.5 w-2.5" /> manuale
                                  </Badge>
                                )}
                              </span>
                            </TableCell>
                            <TableCell colSpan={2}></TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Input
                                  type="number" step="0.01" inputMode="decimal"
                                  value={ssnVal}
                                  onChange={(e) => setDraft(v.id, { ssn: e.target.value === "" ? 0 : Number(e.target.value) } as any)}
                                  onBlur={(e) => {
                                    const val = Number(e.target.value || 0);
                                    clearDraft(v.id, ["ssn"]);
                                    if (Math.abs(val - calc.ssn) < 0.01) return;
                                    handleSsnOverrideBlur(v, val);
                                  }}
                                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                  className="h-7 text-right w-24 font-mono tabular-nums"
                                />
                                {calc.overrideSsn && (
                                  <Button
                                    variant="ghost" size="icon" className="h-6 w-6"
                                    title="Ripristina calcolo automatico"
                                    onClick={() => handleResetOverride(v, "ssn")}
                                  >
                                    <RefreshCw className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        </>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y">
            {vociMerged.map((v) => {
              const calc = calcolaLordo(v, aliquotaProv);
              const nettoVal = getDraftNum(v.id, "firma", Number(v.firma ?? 0));
              const aliqVal = getDraftNum(v.id, "aliquota_tasse_pct", Number(v.aliquota_tasse_pct ?? ALIQUOTA_ACCESSORIE_DEFAULT));
              const lordoVal = draftVoci[v.id]?.lordo_calcolato !== undefined ? Number(draftVoci[v.id]!.lordo_calcolato) : calc.lordo;
              const iptVal = draftVoci[v.id]?.imposta_provinciale !== undefined ? Number(draftVoci[v.id]!.imposta_provinciale) : calc.imposta;
              const ssnVal = draftVoci[v.id]?.ssn !== undefined ? Number(draftVoci[v.id]!.ssn) : calc.ssn;
              return (
                <div
                  key={v.id}
                  className={cn(
                    "p-3 space-y-2",
                    v.is_rca_principale && "bg-teal-50/80 dark:bg-teal-950/30 border-l-4 border-l-teal-600",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-1.5 font-medium text-sm flex-1 min-w-0">
                      {v.is_rca_principale && <ShieldCheck className="h-4 w-4 text-teal-700 shrink-0 mt-0.5" />}
                      <span className="break-words flex-1">{v.garanzia || v.codice_garanzia || "Voce senza nome"}</span>
                    </div>
                    {v.is_rca_principale ? (
                      <Lock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    ) : (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0"
                        onClick={() => setToDelete(v)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] text-muted-foreground">
                      Premio Netto
                      <Input
                        type="number" step="0.01" inputMode="decimal"
                        value={nettoVal}
                        onChange={(e) => setDraft(v.id, { firma: e.target.value === "" ? 0 : Number(e.target.value) } as any)}
                        onBlur={(e) => { clearDraft(v.id, ["firma"]); handleNettoBlur(v, Number(e.target.value || 0)); }}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        className="h-8 text-right mt-0.5"
                      />
                    </label>
                    <label className="text-[11px] text-muted-foreground">
                      Aliquota %
                      {v.is_rca_principale ? (
                        <Input
                          type="number" step="0.01" inputMode="decimal"
                          value={aliquotaProv}
                          onChange={(e) => setAliquotaProv(Number(e.target.value || 0))}
                          onBlur={(e) => handleAliquotaProvChange(Number(e.target.value || 0))}
                          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                          className="h-8 text-right mt-0.5"
                          title="Imposta provinciale"
                        />
                      ) : (
                        <Input
                          type="number" step="0.01" inputMode="decimal"
                          value={aliqVal}
                          onChange={(e) => setDraft(v.id, { aliquota_tasse_pct: e.target.value === "" ? 0 : Number(e.target.value) } as any)}
                          onBlur={(e) => { clearDraft(v.id, ["aliquota_tasse_pct"]); handleAliquotaBlur(v, Number(e.target.value || 0)); }}
                          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                          className="h-8 text-right mt-0.5"
                        />
                      )}
                    </label>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t gap-2">
                    <span className="text-[11px] text-muted-foreground uppercase">Lordo</span>
                    <Input
                      type="number" step="0.01" inputMode="decimal"
                      value={lordoVal}
                      onChange={(e) => setDraft(v.id, { lordo_calcolato: e.target.value === "" ? 0 : Number(e.target.value) } as any)}
                      onBlur={(e) => {
                        const val = Number(e.target.value || 0);
                        clearDraft(v.id, ["lordo_calcolato"]);
                        if (Math.abs(val - calc.lordo) < 0.01) return;
                        handleLordoBlur(v, val);
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      className="h-8 w-32 text-right font-mono tabular-nums"
                    />
                  </div>
                  {v.is_rca_principale && (
                    <div className="text-[11px] text-muted-foreground space-y-1 pt-1 border-t">
                      <div className="flex justify-between items-center gap-2">
                        <span className="inline-flex items-center gap-1">
                          ↳ Imposta {aliquotaProv}%
                          {calc.overrideImposta && (
                            <Badge variant="outline" className="h-4 px-1 text-[9px] border-amber-400 text-amber-800">M</Badge>
                          )}
                        </span>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number" step="0.01" inputMode="decimal"
                            value={iptVal}
                            onChange={(e) => setDraft(v.id, { imposta_provinciale: e.target.value === "" ? 0 : Number(e.target.value) } as any)}
                            onBlur={(e) => {
                              const val = Number(e.target.value || 0);
                              clearDraft(v.id, ["imposta_provinciale"]);
                              if (Math.abs(val - calc.imposta) < 0.01) return;
                              handleImpostaOverrideBlur(v, val);
                            }}
                            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                            className="h-7 w-24 text-right font-mono tabular-nums"
                          />
                          {calc.overrideImposta && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleResetOverride(v, "imposta")}>
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="inline-flex items-center gap-1">
                          ↳ SSN 10,5%
                          {calc.overrideSsn && (
                            <Badge variant="outline" className="h-4 px-1 text-[9px] border-amber-400 text-amber-800">M</Badge>
                          )}
                        </span>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number" step="0.01" inputMode="decimal"
                            value={ssnVal}
                            onChange={(e) => setDraft(v.id, { ssn: e.target.value === "" ? 0 : Number(e.target.value) } as any)}
                            onBlur={(e) => {
                              const val = Number(e.target.value || 0);
                              clearDraft(v.id, ["ssn"]);
                              if (Math.abs(val - calc.ssn) < 0.01) return;
                              handleSsnOverrideBlur(v, val);
                            }}
                            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                            className="h-7 w-24 text-right font-mono tabular-nums"
                          />
                          {calc.overrideSsn && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleResetOverride(v, "ssn")}>
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t flex flex-wrap gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <Plus className="h-4 w-4" /> Aggiungi voce
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-80" align="start">
                <Command>
                  <CommandInput placeholder="Cerca garanzia…" />
                  <CommandList>
                    <CommandEmpty>Nessuna voce disponibile</CommandEmpty>
                    <CommandGroup>
                      {catalogoDisponibile.map((g: any) => (
                        <CommandItem key={g.codice} value={`${g.codice} ${g.descrizione}`} onSelect={() => addMut.mutate(g)}>
                          <span className="font-mono text-xs text-muted-foreground mr-2">{g.codice}</span>
                          {g.descrizione}
                          {g.aliquota_tasse && <span className="ml-auto text-xs text-muted-foreground">{g.aliquota_tasse}%</span>}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {/* "Voce libera" rimossa: le voci si aggiungono solo dal catalogo sottorami,
                in continuità con la pagina di immissione polizza. */}
          </div>

          {/* Totali */}
          {(() => {
            const parseSafe = (s: string | number | null | undefined) => {
              const n = Number(s ?? 0);
              return Number.isFinite(n) ? n : 0;
            };
            const addLive = addizionaliDraft !== null
              ? parseSafe(addizionaliDraft)
              : parseSafe(addizionaliValue);
            const lordoConAdd = round2(totali.lordo + (mostraAddizionali ? addLive : 0));
            const deltaConAdd = premioLordoTitolo == null ? 0 : round2(lordoConAdd - Number(premioLordoTitolo));
            const quadraConAdd = premioLordoTitolo == null || Math.abs(deltaConAdd) < 0.01;
            return (
          <div className={cn("grid gap-2 sm:gap-3 p-3 sm:p-4 bg-gradient-to-br from-teal-50/40 to-transparent border-t",
            mostraAddizionali ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3")}>
            <div className="rounded-lg border bg-card p-2 sm:p-3">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">Totale Netto</p>
              <p className="text-base sm:text-xl font-bold font-mono tabular-nums">{fmtEur(totali.netto)}</p>
            </div>
            <div className="rounded-lg border bg-card p-2 sm:p-3 col-span-2 md:col-span-1">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide flex items-center justify-between">
                <span>Totale Tasse</span>
                <span className="font-mono tabular-nums text-foreground">{fmtEur(totali.tasse)}</span>
              </p>
              {useAutoTaxFormula && (() => {
                const rcaRow = voci.find((v) => v.is_rca_principale);
                const rcaMerged = rcaRow ? { ...rcaRow, ...(draftVoci[rcaRow.id] || {}) } : null;
                const rcaCalc = rcaMerged ? calcolaLordo(rcaMerged, aliquotaProv) : null;
                const iptLive = rcaRow
                  ? (draftVoci[rcaRow.id]?.imposta_provinciale !== undefined
                      ? Number(draftVoci[rcaRow.id]!.imposta_provinciale)
                      : (rcaCalc?.imposta ?? totali.imposta))
                  : totali.imposta;
                const ssnLive = rcaRow
                  ? (draftVoci[rcaRow.id]?.ssn !== undefined
                      ? Number(draftVoci[rcaRow.id]!.ssn)
                      : (rcaCalc?.ssn ?? totali.ssn))
                  : totali.ssn;
                return (
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                <label className="text-[9px] uppercase text-muted-foreground">
                  IPT
                  <Input
                    type="number" step="0.01" inputMode="decimal"
                    value={iptLive}
                    onChange={(e) => rcaRow && setDraft(rcaRow.id, { imposta_provinciale: e.target.value === "" ? 0 : Number(e.target.value) } as any)}
                    onBlur={(e) => {
                      const val = Number(e.target.value || 0);
                      if (rcaRow) clearDraft(rcaRow.id, ["imposta_provinciale"]);
                      if (Math.abs(val - (rcaCalc?.imposta ?? totali.imposta)) < 0.01) return;
                      handleTotaleIptBlur(val);
                    }}
                    className="h-7 text-right font-mono tabular-nums text-xs mt-0.5 px-1.5"
                    disabled={!rcaRow}
                  />
                </label>
                <label className="text-[9px] uppercase text-muted-foreground">
                  SSN
                  <Input
                    type="number" step="0.01" inputMode="decimal"
                    value={ssnLive}
                    onChange={(e) => rcaRow && setDraft(rcaRow.id, { ssn: e.target.value === "" ? 0 : Number(e.target.value) } as any)}
                    onBlur={(e) => {
                      const val = Number(e.target.value || 0);
                      if (rcaRow) clearDraft(rcaRow.id, ["ssn"]);
                      if (Math.abs(val - (rcaCalc?.ssn ?? totali.ssn)) < 0.01) return;
                      handleTotaleSsnBlur(val);
                    }}
                    className="h-7 text-right font-mono tabular-nums text-xs mt-0.5 px-1.5"
                    disabled={!rcaRow}
                  />
                </label>
                <label className="text-[9px] uppercase text-muted-foreground">
                  Acc.
                  <Input
                    type="number" step="0.01" inputMode="decimal"
                    key={`tot-acc-${totali.tasseAcc}`}
                    defaultValue={totali.tasseAcc}
                    onBlur={(e) => {
                      const val = Number(e.target.value || 0);
                      if (Math.abs(val - totali.tasseAcc) < 0.01) return;
                      handleTotaleAccBlur(val);
                    }}
                    className="h-7 text-right font-mono tabular-nums text-xs mt-0.5 px-1.5"
                    disabled={!voci.some((v) => !v.is_rca_principale)}
                  />
                </label>
              </div>
                );
              })()}
            </div>
            {mostraAddizionali && (
              <div className="rounded-lg border bg-card p-2 sm:p-3">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">Addizionali</p>
                <Input
                  type="number" step="0.01" inputMode="decimal"
                  value={addLive}
                  onChange={(e) => setAddizionaliDraft(e.target.value)}
                  onBlur={(e) => {
                    const text = e.target.value.trim();
                    setAddizionaliDraft(null);
                    if (text === "") {
                      if (Number(addizionaliValue ?? 0) !== 0) onAddizionaliChange?.(0);
                      return;
                    }
                    const raw = Number(text.replace(",", "."));
                    if (!Number.isFinite(raw) || raw < 0) {
                      toast.error("Addizionali non valido: ripristinato a 0");
                      onAddizionaliChange?.(0);
                      return;
                    }
                    const val = round2(raw);
                    if (Math.abs(val - Number(addizionaliValue ?? 0)) < 0.01) return;
                    onAddizionaliChange?.(val);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  className="h-9 text-right font-mono tabular-nums text-base font-bold mt-1"
                />
              </div>
            )}
            <div className={cn(
              "col-span-2 md:col-span-1 rounded-lg border-2 p-2 sm:p-3",
              quadraConAdd ? "border-emerald-400 bg-emerald-50/50" : "border-amber-400 bg-amber-50/50",
            )}>
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                Premio Lordo
                {quadraConAdd
                  ? <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  : <AlertCircle className="h-3 w-3 text-amber-600" />}
              </p>
              <p className="text-base sm:text-xl font-bold font-mono tabular-nums text-teal-900">{fmtEur(lordoConAdd)}</p>
              {premioLordoTitolo != null && !quadraConAdd && (
                <p className="text-[11px] text-amber-700 mt-1">Δ vs polizza: {fmtEur(deltaConAdd)}</p>
              )}
              {!quadraInterno && (
                <p className="text-[11px] text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Netto + Tasse ≠ Lordo (errore di arrotondamento)
                </p>
              )}
            </div>
          </div>
            );
          })()}

          {/* Provvigioni */}
          <div className={cn(
            "flex items-center justify-between gap-3 px-3 sm:px-4 py-3 border-t",
            isQuietanza ? "bg-amber-50/40 dark:bg-amber-950/10" : "bg-teal-50/40 dark:bg-teal-950/10",
          )}>
            <div className="flex flex-col">
              <span className={cn("text-xs uppercase tracking-wide font-semibold", isQuietanza ? "text-amber-900 dark:text-amber-200" : "text-teal-900 dark:text-teal-200")}>
                Provvigioni {isQuietanza ? "Quietanza" : "Firma"}
              </span>
              <span className="text-[10px] text-muted-foreground">Importo dovuto al commerciale (€)</span>
            </div>
            <Input
              type="number"
              step="0.01"
              className="w-32 sm:w-40 text-right font-mono tabular-nums"
              defaultValue={provvigioniValue ?? ""}
              key={`prov-${tipoPremio}-${provvigioniValue ?? ""}`}
              onBlur={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) onProvvigioniChange?.(v);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rimuovere la voce «{toDelete?.garanzia}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa operazione elimina la voce dal calcolo del premio. La riga {RCA_LABEL_EFFECTIVE} non è mai eliminabile.
              {toDelete && Number(toDelete.firma || 0) > 0 && (
                <span className="block mt-2 p-2 rounded bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                  ⚠ La voce ha un premio netto di <b>{fmtEur(toDelete.firma)}</b>: rimuovendola il totale lordo si ridurrà di circa{" "}
                  <b>{fmtEur(calcolaLordo(toDelete, aliquotaProv).lordo)}</b>.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => toDelete && deleteMut.mutate(toDelete.id)}>
              Rimuovi voce
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Risincronizzare la Quietanza dalla Firma?</AlertDialogTitle>
            <AlertDialogDescription>
              Tutte le voci della Quietanza personalizzate verranno sovrascritte con i valori correnti della Firma. L'operazione non è reversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => resetQuietanzaMut.mutate()}>Risincronizza</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
