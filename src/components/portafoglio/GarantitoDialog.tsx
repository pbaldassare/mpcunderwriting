import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield } from "lucide-react";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
import { handleNotificaMessaCassaOutcome, scheduleOrInvokeNotificaMessaCassa } from "@/lib/notificaMessaCassa";
import { MessaCassaSeraleCheckbox } from "@/components/portafoglio/MessaCassaSeraleCheckbox";
import { fmtEuro } from "@/lib/formatCurrency";
import { buildGarantitoPayload } from "@/lib/garantitoTitolo";
import { canHaveDataCopertura } from "@/lib/quietanze";

export interface TitoloMin {
  id: string;
  numero_titolo?: string | null;
  premio_lordo?: number | null;
  cliente_anagrafica_id?: string | null;
  ufficio_id?: string | null;
  sostituisce_polizza?: string | null;
  is_appendice_modifica?: boolean | null;
  is_proroga?: boolean | null;
  is_regolazione?: boolean | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titoli: TitoloMin[];
  onSuccess?: () => void;
}

async function syncQuietanzaCopertura(titoloId: string, dataCopertura: string) {
  await (supabase.from("quietanze") as any)
    .update({ data_copertura: dataCopertura, updated_at: new Date().toISOString() })
    .eq("titolo_id", titoloId);
}

/**
 * Dialog "Garantito" — messa a cassa + copertura senza fondi ricevuti.
 */
export function GarantitoDialog({ open, onOpenChange, titoli, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [accettato, setAccettato] = useState(false);
  const [dataCopertura, setDataCopertura] = useState(today);
  const [dataDecorrenza, setDataDecorrenza] = useState(today);
  const [loading, setLoading] = useState(false);
  const [messaCassaSerale, setMessaCassaSerale] = useState(false);

  useEffect(() => {
    if (open) {
      setAccettato(false);
      setDataCopertura(today);
      setDataDecorrenza(today);
      setMessaCassaSerale(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isMulti = titoli.length > 1;
  const totale = titoli.reduce((s, t) => s + (Number(t.premio_lordo) || 0), 0);

  const conferma = async () => {
    if (!accettato) { toast.error("Accetta la dichiarazione di responsabilità"); return; }
    if (titoli.length === 0) { toast.error("Nessun titolo selezionato"); return; }
    setLoading(true);
    let ok = 0, ko = 0;
    const notificaTitoloIds: string[] = [];

    for (const t of titoli) {
      // La polizza madre non può andare in copertura: solo quietanze/appendici.
      let row = t;
      if (t.sostituisce_polizza === undefined) {
        const { data } = await (supabase.from("titoli") as any)
          .select("id, sostituisce_polizza, is_appendice_modifica, is_proroga, is_regolazione")
          .eq("id", t.id)
          .maybeSingle();
        if (data) row = { ...t, ...data };
      }
      if (!canHaveDataCopertura(row)) {
        toast.error(
          `La polizza madre ${t.numero_titolo || ""} non può avere copertura — usa la quietanza`,
        );
        ko++;
        continue;
      }

      const payload = buildGarantitoPayload({ dataCopertura, dataDecorrenza });
      const { error } = await (supabase.from("titoli") as any).update(payload).eq("id", t.id);
      if (error) { ko++; continue; }
      await syncQuietanzaCopertura(t.id, dataCopertura);
      ok++;
      await logAttivita({
        azione: "conferimento_gestito",
        entita_tipo: "titolo",
        entita_id: t.id,
        dettagli_json: {
          data_copertura: dataCopertura,
          data_decorrenza_rinnovo: dataDecorrenza,
          conferimento_gestito: true,
          bulk: isMulti,
        },
      });
      notificaTitoloIds.push(t.id);
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

    setLoading(false);
    if (ok > 0) {
      toast.success(isMulti ? `${ok} polizze in copertura${ko > 0 ? `, ${ko} errori` : ""}` : "Copertura garantita");
      queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-carico-totale"] });
      queryClient.invalidateQueries({ queryKey: ["titolo"] });
      queryClient.invalidateQueries({ queryKey: ["mov-bancari"] });
      queryClient.invalidateQueries({ queryKey: ["ec-agenzia-contab"] });
      queryClient.invalidateQueries({ queryKey: ["polizze_cliente"] });
      onSuccess?.();
      onOpenChange(false);
    } else {
      toast.error("Operazione fallita");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <MessaCassaSeraleCheckbox
          checked={messaCassaSerale}
          onCheckedChange={setMessaCassaSerale}
          id="messa-cassa-serale-garantito"
        />
        <DialogHeader className="pr-52">
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-500" /> Garantito
          </DialogTitle>
          <DialogDescription>
            {isMulti
              ? `Copertura garantita di ${titoli.length} polizze · Totale ${fmtEuro(totale)}`
              : `Polizza ${titoli[0]?.numero_titolo || titoli[0]?.id?.slice(0, 8) || ""} — Messa a cassa garantita (senza fondi)`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-orange-400 bg-orange-50 p-3 text-sm text-orange-800 space-y-2">
            <p className="font-semibold">⚠️ Dichiarazione di Responsabilità — Circolare 02 Consulbrokers</p>
            <p className="font-medium">Procedura operativa 03, punto 3:</p>
            <p>
              Le polizze, una volta inserite <strong>NON DEVONO ESSERE GARANTITE</strong>, ma dovranno essere effettivamente incassate;
              casi particolari devono essere concordati <strong>PER ISCRITTO</strong> con la Direzione seguendo i criteri di seguito esposti:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Coperture fino ad euro <strong>1.000,00</strong>: occorre l'autorizzazione dell'Amministratore Delegato</li>
              <li>Coperture fino ad euro <strong>10.000,00</strong>: occorre l'autorizzazione di due Amministratori Delegati</li>
              <li>Coperture oltre euro <strong>10.000,00</strong>: occorre l'autorizzazione del CDA</li>
            </ul>
            <p>Tutto quanto non regolarizzato alla data di chiusura del mese non verrà rimesso alle agenzie entro il giorno 10 del mese successivo.</p>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox id="garantito-accettato" checked={accettato} onCheckedChange={(v) => setAccettato(!!v)} />
            <Label htmlFor="garantito-accettato" className="text-sm font-medium leading-snug">
              Dichiaro di aver ottenuto l'autorizzazione necessaria e di assumermi la responsabilità dell'incasso
            </Label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data Copertura</Label>
              <Input type="date" value={dataCopertura} onChange={(e) => setDataCopertura(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Data Decorrenza Rinnovo</Label>
              <Input type="date" value={dataDecorrenza} onChange={(e) => setDataDecorrenza(e.target.value)} className="mt-1" />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Vengono impostate data copertura e data messa a cassa. I fondi restano in attesa
            (<em>fondi_ricevuti = false</em>); tipo/data pagamento e importo incassato si compilano
            all&apos;incasso effettivo.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annulla</Button>
          <Button
            className="bg-orange-500 hover:bg-orange-600 text-white"
            disabled={!accettato || loading}
            onClick={conferma}
          >
            <Shield className="w-4 h-4 mr-1" />
            {loading ? "Salvataggio…" : "Conferma Garantito"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default GarantitoDialog;
