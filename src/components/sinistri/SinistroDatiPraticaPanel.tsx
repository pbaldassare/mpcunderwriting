import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { Pencil, X, Save } from "lucide-react";
import SinistroPraticaFormFields from "@/components/sinistri/SinistroPraticaFormFields";
import SinistroAssegnazioniReminderSection from "@/components/sinistri/SinistroAssegnazioniReminderSection";
import SinistroPolizzaSelector from "@/components/sinistri/SinistroPolizzaSelector";
import AgenziaContattoInline from "@/components/sinistri/AgenziaContattoInline";
import { formatTipoSinistro } from "@/lib/tipiSinistro";
import { telefonoIdentitaSinistro } from "@/lib/compagniaDisplay";
import { isSinistroTerminale } from "@/lib/sinistriStati";
import { formatEdgeFunctionError } from "@/lib/edgeFunctionError";
import {
  sinistroPraticaSchema,
  sinistroRowToPraticaValues,
  praticaValuesToDbPayload,
  validateTipoSinistro,
  type SinistroPraticaValues,
} from "@/lib/sinistroPraticaSchema";

interface SinistroRow {
  id: string;
  stato?: string;
  sinistro_terzi?: boolean;
  titolo_id?: string | null;
  cliente_anagrafica_id?: string | null;
  compagnia_id?: string | null;
  data_evento?: string | null;
  data_denuncia?: string | null;
  tipo_sinistro?: string | null;
  tipo_sinistro_personalizzato?: string | null;
  numero_sinistro_compagnia?: string | null;
  descrizione?: string | null;
  note_importanti?: string | null;
  dinamica?: string | null;
  luogo_sinistro?: string | null;
  indirizzo_sinistro?: string | null;
  citta_sinistro?: string | null;
  cap_sinistro?: string | null;
  provincia_sinistro?: string | null;
  controparte?: string | null;
  targa_veicolo?: string | null;
  importo_riserva?: number | null;
  costo_preventivato?: number | null;
  costo_effettivo?: number | null;
  franchigia?: number | null;
  importo_liquidato?: number | null;
  responsabile_id?: string | null;
  liquidatore_id?: string | null;
  note_interne?: string | null;
  profiles?: { nome?: string; cognome?: string } | null;
  liquidatore?: { nome?: string; cognome?: string; ragione_sociale?: string } | null;
  clienti?: { cognome?: string; nome?: string; ragione_sociale?: string; tipo_cliente?: string } | null;
  titoli?: {
    numero_titolo?: string | null;
    compagnia_diretta?: {
      id?: string | null;
      telefono?: string | null;
      cellulare?: string | null;
      mail?: string | null;
      mail_ec?: string | null;
      pec?: string | null;
      tipo?: string | null;
    } | null;
    compagnia_rapporto?: {
      gruppi_compagnia?: {
        compagnie?: Array<{
          id?: string | null;
          telefono?: string | null;
          cellulare?: string | null;
          mail?: string | null;
          mail_ec?: string | null;
          pec?: string | null;
          tipo?: string | null;
        }> | null;
      } | null;
    } | null;
  } | null;
  compagnie?: {
    id?: string | null;
    telefono?: string | null;
    cellulare?: string | null;
    mail?: string | null;
    mail_ec?: string | null;
    pec?: string | null;
    tipo?: string | null;
  } | null;
}

interface Props {
  sinistro: SinistroRow;
  canEdit: boolean;
  onSaved: () => void;
}

const fmtDate = (d?: string | null) => (d ? format(new Date(d), "dd/MM/yyyy") : "—");
const fmtEuro = (n?: number | null) =>
  n != null ? `€ ${Number(n).toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "—";


export function SinistroPraticaReadOnly({ sinistro }: { sinistro: SinistroRow }) {
  const descrizione = sinistro.descrizione || sinistro.dinamica;
  const noteImportanti = sinistro.note_importanti;
  const luogo = sinistro.indirizzo_sinistro || sinistro.luogo_sinistro;
  const luogoExtra = [sinistro.cap_sinistro, sinistro.citta_sinistro, sinistro.provincia_sinistro ? `(${sinistro.provincia_sinistro})` : null]
    .filter(Boolean)
    .join(" ");

  const { data: ultimaNota } = useQuery({
    queryKey: ["sinistro-note-interne", sinistro.id, "ultima"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sinistro_note_interne" as any)
        .select("id, testo, created_at, created_by, profiles:created_by(nome, cognome)")
        .eq("sinistro_id", sinistro.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as {
        id: string;
        testo: string;
        created_at: string;
        profiles?: { nome?: string | null; cognome?: string | null } | null;
      } | null;
    },
  });

  const ultimaNotaMeta = ultimaNota
    ? (() => {
        const autore = `${ultimaNota.profiles?.nome || ""} ${ultimaNota.profiles?.cognome || ""}`.trim();
        const when = ultimaNota.created_at
          ? format(new Date(ultimaNota.created_at), "dd/MM/yyyy HH:mm")
          : null;
        return [autore || null, when].filter(Boolean).join(" · ");
      })()
    : null;

  return (
    <div className="space-y-5 text-sm">
      <section className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Identità</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <span className="text-muted-foreground">Data accadimento</span>
            <p className="font-semibold">{fmtDate(sinistro.data_evento)}</p>
            {!sinistro.sinistro_terzi && (
              <div className="pt-1 md:col-span-2">
                <AgenziaContattoInline sinistro={sinistro} className="mt-0.5" />
              </div>
            )}
          </div>
          <div><span className="text-muted-foreground">Data denuncia</span><p className="font-semibold">{fmtDate(sinistro.data_denuncia)}</p></div>
          <div><span className="text-muted-foreground">Tipo sinistro</span><p className="font-semibold">{formatTipoSinistro(sinistro)}</p></div>
          <div>
            <span className="text-muted-foreground">Telefono</span>
            <p className="font-semibold">{telefonoIdentitaSinistro(sinistro) || "—"}</p>
          </div>
          <div><span className="text-muted-foreground">N. sinistro compagnia</span><p className="font-semibold">{sinistro.numero_sinistro_compagnia || "—"}</p></div>
          <div><span className="text-muted-foreground">Controparte</span><p className="font-semibold">{sinistro.controparte || "—"}</p></div>
          <div><span className="text-muted-foreground">Targa veicolo</span><p className="font-semibold">{sinistro.targa_veicolo || "—"}</p></div>
        </div>
      </section>
      {(luogo || luogoExtra || descrizione || noteImportanti) && (
        <section className="space-y-3 border-t border-border/60 pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Descrizione e luogo</p>
          {(luogo || luogoExtra) && (
            <div>
              <span className="text-muted-foreground">Luogo</span>
              <p className="font-semibold">{luogo || "—"}</p>
              {luogoExtra && <p className="text-muted-foreground">{luogoExtra}</p>}
            </div>
          )}
          {(descrizione || noteImportanti) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {descrizione && (
                <div>
                  <span className="text-muted-foreground">Descrizione</span>
                  <p className="mt-1 whitespace-pre-wrap bg-muted/30 p-2.5 rounded border">{descrizione}</p>
                </div>
              )}
              {noteImportanti && (
                <div>
                  <span className="text-muted-foreground">Note importanti</span>
                  <p className="mt-1 whitespace-pre-wrap bg-amber-50/80 dark:bg-amber-950/20 p-2.5 rounded border border-amber-200/60 dark:border-amber-900/40">
                    {noteImportanti}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      )}
      {(ultimaNota?.testo || sinistro.note_interne) && (
        <section className="border-t border-border/60 pt-4 space-y-1">
          <span className="text-muted-foreground">Ultima nota interna</span>
          {ultimaNotaMeta && (
            <p className="text-[11px] text-muted-foreground">{ultimaNotaMeta}</p>
          )}
          <p className="mt-1 italic text-muted-foreground bg-muted/20 p-2 rounded border whitespace-pre-wrap">
            {ultimaNota?.testo || sinistro.note_interne}
          </p>
        </section>
      )}
      <section className="space-y-3 border-t border-border/60 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Importi</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><span className="text-muted-foreground">Riserva</span><p className="font-semibold font-mono">{fmtEuro(sinistro.importo_riserva)}</p></div>
          <div><span className="text-muted-foreground">Costo preventivato</span><p className="font-semibold font-mono">{fmtEuro(sinistro.costo_preventivato)}</p></div>
          <div><span className="text-muted-foreground">Franchigia</span><p className="font-semibold font-mono">{fmtEuro(sinistro.franchigia)}</p></div>
          <div><span className="text-muted-foreground">Liquidato</span><p className="font-semibold font-mono text-emerald-700">{fmtEuro(sinistro.importo_liquidato)}</p></div>
        </div>
      </section>
      <section className="space-y-3 border-t border-border/60 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Assegnazioni</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-muted-foreground">Responsabile interno</span>
            <p className="font-semibold">
              {sinistro.profiles ? `${sinistro.profiles.nome || ""} ${sinistro.profiles.cognome || ""}`.trim() : "—"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Liquidatore esterno</span>
            <p className="font-semibold">
              {sinistro.liquidatore
                ? sinistro.liquidatore.ragione_sociale || `${sinistro.liquidatore.cognome || ""} ${sinistro.liquidatore.nome || ""}`.trim()
                : "—"}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function SinistroDatiPraticaPanel({ sinistro, canEdit, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const isChiuso = isSinistroTerminale(sinistro.stato);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<SinistroPraticaValues>({
    resolver: zodResolver(sinistroPraticaSchema),
    defaultValues: sinistroRowToPraticaValues(sinistro as unknown as Record<string, unknown>),
  });

  useEffect(() => {
    reset(sinistroRowToPraticaValues(sinistro as unknown as Record<string, unknown>));
    setEditing(false);
  }, [sinistro, reset]);

  const { data: responsabiliList = [] } = useQuery({
    queryKey: ["profiles-responsabili-sinistro", sinistro.responsabile_id],
    queryFn: async () => {
      // Preferisci Specialist Sinistri se configurati; altrimenti tutti i profili attivi.
      // Mantieni sempre il responsabile già assegnato (anche se non più in elenco).
      const { data: ss } = await supabase
        .from("specialist_sinistri_sedi" as any)
        .select("profilo_id");
      const ids = [...new Set(((ss || []) as unknown as { profilo_id: string }[]).map((r) => r.profilo_id))];
      if (sinistro.responsabile_id && !ids.includes(sinistro.responsabile_id)) {
        ids.push(sinistro.responsabile_id);
      }
      let q = supabase.from("profiles").select("id, nome, cognome").eq("attivo", true).order("cognome");
      if (ids.length > 0) q = q.in("id", ids);
      const { data } = await q;
      return data || [];
    },
    enabled: editing,
  });

  const { data: liquidatoriList = [] } = useQuery({
    queryKey: ["anagrafiche-liquidatori-sinistro"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anagrafiche_professionali")
        .select("id, nome, cognome, ragione_sociale")
        .eq("tipo", "liquidatore")
        .eq("attivo", true)
        .order("cognome");
      return data || [];
    },
    enabled: editing,
  });

  const onSave = async (values: SinistroPraticaValues) => {
    const tipoErr = validateTipoSinistro(values.tipo_sinistro, values.tipo_sinistro_personalizzato);
    if (tipoErr) {
      toast.error(tipoErr);
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("gestione-sinistri", {
        body: {
          azione: "aggiorna",
          sinistro_id: sinistro.id,
          user_id: user?.id,
          ...praticaValuesToDbPayload(values, { persistNoteImportanti: true }),
        },
      });
      if (error || !data?.success) {
        throw new Error(formatEdgeFunctionError(error, data));
      }
      toast.success("Dati pratica aggiornati");
      setEditing(false);
      onSaved();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore sconosciuto";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const allowEdit = canEdit && !isChiuso;

  return (
    <div className="rounded-md border border-border/70 bg-background">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/60">
        <h2 className="text-sm font-semibold tracking-tight">Dati Pratica</h2>
        {allowEdit && !editing && (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4 mr-1" /> Modifica
          </Button>
        )}
        {editing && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                reset(sinistroRowToPraticaValues(sinistro as unknown as Record<string, unknown>));
                setEditing(false);
              }}
            >
              <X className="h-4 w-4 mr-1" /> Annulla
            </Button>
            <Button type="button" size="sm" disabled={saving} onClick={handleSubmit(onSave)}>
              <Save className="h-4 w-4 mr-1" /> Salva
            </Button>
          </div>
        )}
      </div>
      <div className="p-4">
        {isChiuso && !editing && (
          <p className="text-xs text-muted-foreground mb-4">
            Pratica {sinistro.stato}: i dati sono in sola lettura.
          </p>
        )}
        {editing ? (
          <div className="space-y-4">
            {!sinistro.sinistro_terzi && sinistro.cliente_anagrafica_id && (
              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Polizza collegata
                </p>
                <SinistroPolizzaSelector
                  sinistroId={sinistro.id}
                  clienteId={sinistro.cliente_anagrafica_id}
                  currentTitoloId={sinistro.titolo_id}
                  autoSave
                  onSaved={onSaved}
                />
              </div>
            )}
            <SinistroPraticaFormFields
              register={register}
              setValue={setValue}
              watch={watch}
              errors={errors}
              responsabiliList={responsabiliList}
              liquidatoriList={liquidatoriList}
              showEconomici
              showAssegnazione
              showNoteImportanti
            />
          </div>
        ) : (
          <SinistroPraticaReadOnly sinistro={sinistro} />
        )}
        <SinistroAssegnazioniReminderSection
          sinistro={sinistro}
          disabled={isChiuso && !canEdit}
        />
      </div>
    </div>
  );
}
