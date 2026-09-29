import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, isValid, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SinistroPraticaReadOnly } from "@/components/sinistri/SinistroDatiPraticaPanel";
import { resolveClienteNome } from "@/lib/ecClienteAnagrafica";
import { labelAgenziaRiferimento } from "@/lib/compagniaDisplay";
import {
  calcScadenzaPrescrizione,
  resolveDataAccadimentoPrescrizione,
} from "@/lib/sinistroPrescrizioniReminder";
import { badgeClassStatoSinistro, labelStatoSinistro } from "@/lib/sinistriStati";

interface Props {
  sinistroId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function fmtDateSafe(value?: string | null) {
  if (!value) return "—";
  const d = parseISO(value);
  return isValid(d) ? format(d, "dd/MM/yyyy", { locale: it }) : "—";
}

export default function SinistroRiepilogoDialog({ sinistroId, open, onOpenChange }: Props) {
  const navigate = useNavigate();

  const { data: sinistro, isLoading, error } = useQuery({
    queryKey: ["sinistro-riepilogo", sinistroId],
    enabled: open && !!sinistroId,
    queryFn: async () => {
      const { data, error: qErr } = await supabase
        .from("sinistri")
        .select(`
          *,
          compagnie(nome),
          uffici(nome_ufficio),
          profiles!sinistri_responsabile_id_fkey(nome, cognome),
          liquidatore:anagrafiche_professionali!sinistri_liquidatore_id_fkey(nome, cognome, ragione_sociale),
          titoli(
            numero_titolo,
            compagnia_diretta:compagnie!titoli_compagnia_id_fkey(id, nome, gruppo_compagnia, gruppi_compagnia:gruppo_compagnia_id(descrizione)),
            compagnia_rapporto:compagnia_rapporti!titoli_compagnia_rapporto_id_fkey(gruppi_compagnia:gruppo_compagnia_id(descrizione)),
            ramo:rami!titoli_ramo_id_fkey(id, codice, descrizione, gruppo_ramo:gruppi_ramo!rami_gruppo_ramo_id_fkey(descrizione))
          ),
          clienti!sinistri_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale, tipo_cliente)
        `)
        .eq("id", sinistroId!)
        .single();
      if (qErr) throw qErr;
      return data;
    },
  });

  const scadenzaPrescrizione = sinistro
    ? calcScadenzaPrescrizione(
        resolveDataAccadimentoPrescrizione(sinistro.data_evento, sinistro.data_denuncia, sinistro.data_apertura),
      )
    : "";

  const apriScheda = () => {
    if (!sinistroId) return;
    onOpenChange(false);
    navigate(`/sinistri/${sinistroId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
            {isLoading ? "Caricamento sinistro…" : `Sinistro ${sinistro?.numero_sinistro || "—"}`}
            {sinistro?.stato && (
              <Badge className={badgeClassStatoSinistro(sinistro.stato as string)}>
                {labelStatoSinistro(sinistro.stato as string)}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Riepilogo rapido della pratica sinistro
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Caricamento dati…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive py-6">
            Impossibile caricare il sinistro: {(error as Error).message}
          </p>
        ) : sinistro ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm rounded-lg border bg-muted/20 p-3">
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Cliente</span>
                <p className="font-medium">{resolveClienteNome(sinistro.clienti)}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Compagnia</span>
                <p className="font-medium">{sinistro.compagnie?.nome || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Agenzia di riferimento</span>
                <p className="font-medium">{labelAgenziaRiferimento(sinistro.titoli as any) || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Polizza</span>
                <p className="font-medium">{sinistro.titoli?.numero_titolo || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Garanzia / Ramo</span>
                <p className="font-medium">{sinistro.titoli?.ramo?.descrizione || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Ufficio</span>
                <p className="font-medium">{sinistro.uffici?.nome_ufficio || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Denuncia</span>
                <p className="font-medium">{fmtDateSafe(sinistro.data_denuncia)}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Prescrizione (accadimento + 2 anni)</span>
                <p className="font-medium text-primary">{fmtDateSafe(scadenzaPrescrizione)}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Accadimento</span>
                <p className="font-medium">{fmtDateSafe(sinistro.data_evento)}</p>
              </div>
            </div>

            <SinistroPraticaReadOnly sinistro={sinistro as any} />
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Chiudi
          </Button>
          <Button onClick={apriScheda} disabled={!sinistroId}>
            <ExternalLink className="h-4 w-4 mr-1.5" />
            Apri scheda completa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
