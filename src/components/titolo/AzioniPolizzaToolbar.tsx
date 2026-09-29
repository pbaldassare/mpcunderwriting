import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Pause, Play, Replace, XCircle, Undo2, FilePlus2, ScrollText,
  FileText, Ban, Banknote, RotateCcw, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fmtEuro } from "@/lib/formatCurrency";
import { annullaPolizza } from "@/lib/annullaPolizza";
import { annullaMessaACassa } from "@/lib/annullaMessaACassa";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SospensionePolizzaDialog } from "@/components/polizze/SospensionePolizzaDialog";
import { RiattivazionePolizzaDialog } from "@/components/polizze/RiattivazionePolizzaDialog";
import { SostituzionePolizzaDialog } from "@/components/polizze/SostituzionePolizzaDialog";
import { EstinzionePolizzaDialog } from "@/components/polizze/EstinzionePolizzaDialog";
import { StornoTitoloDialog } from "@/components/polizze/StornoTitoloDialog";
import MessaCassaDialog from "@/components/portafoglio/MessaCassaDialog";

const fmtDate = (d: string | null | undefined) =>
  d ? format(new Date(d), "dd/MM/yyyy") : "—";

const STATO_Q: Record<string, string> = {
  da_incassare: "bg-amber-100 text-amber-800 border-amber-300",
  incassato: "bg-emerald-100 text-emerald-800 border-emerald-300",
  sospesa: "bg-yellow-100 text-yellow-800 border-yellow-300",
  annullata: "bg-red-100 text-red-800 border-red-300",
  stornata: "bg-orange-100 text-orange-800 border-orange-300",
};

export type ToolbarQuietanza = {
  id: string;
  numero_rata: number | null;
  numero_rate_totali: number | null;
  garanzia_da: string | null;
  garanzia_a: string | null;
  data_scadenza: string | null;
  premio_lordo: number | null;
  stato: string;
  data_messa_cassa: string | null;
  titolo_id: string | null;
};

type RataAction = "storno" | "messa_cassa" | "annulla_mc" | "annulla_incasso";

interface Props {
  polizzaId: string;
  numeroPolizza: string;
  statoPolizza: string;
  titoloMadreId: string | null;
  clienteId: string | null;
  uffizioId?: string | null;
  regolazione?: boolean;
  quietanze: ToolbarQuietanza[];
  /** Se valorizzato, le azioni rata-level agiscono direttamente su questa rata */
  currentQuietanza?: ToolbarQuietanza | null;
  onRefresh: () => void;
}

export function AzioniPolizzaToolbar({
  polizzaId,
  numeroPolizza,
  statoPolizza,
  titoloMadreId,
  clienteId,
  uffizioId,
  regolazione,
  quietanze,
  currentQuietanza,
  onRefresh,
}: Props) {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const locked = ["annullata", "annullato", "estinta", "sostituita"].includes(statoPolizza);

  // polizza-level dialogs
  const [sospensioneOpen, setSospensioneOpen] = useState(false);
  const [riattivazioneOpen, setRiattivazioneOpen] = useState(false);
  const [sostituzioneOpen, setSostituzioneOpen] = useState(false);
  const [estinzioneOpen, setEstinzioneOpen] = useState(false);
  const [annullaLoading, setAnnullaLoading] = useState(false);

  // rata-level
  const [stornoOpen, setStornoOpen] = useState(false);
  const [stornoTitoloId, setStornoTitoloId] = useState<string | null>(null);
  const [cassaOpen, setCassaOpen] = useState(false);
  const [cassaTitoli, setCassaTitoli] = useState<any[]>([]);
  const [annullaMcLoading, setAnnullaMcLoading] = useState(false);

  // Conferma annullo incasso/messa a cassa con verifica password admin (unico flusso)
  const [annullaState, setAnnullaState] = useState<{ open: boolean; titoloId: string | null; mode: "mc" | "incasso" }>({
    open: false,
    titoloId: null,
    mode: "mc",
  });
  const [annullaPassword, setAnnullaPassword] = useState("");

  // selector dialog
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<RataAction | null>(null);

  async function handleAnnullaPolizza() {
    if (!titoloMadreId) {
      toast.error("Polizza senza titolo collegato: impossibile annullare.");
      return;
    }
    setAnnullaLoading(true);
    const res = await annullaPolizza(titoloMadreId);
    setAnnullaLoading(false);
    if (!res.ok) {
      toast.error(res.error || "Errore durante l'annullamento");
      return;
    }
    toast.success(`Polizza annullata · ${res.quietanzeEliminate ?? 0} quietanze rimosse`);
    onRefresh();
  }

  function openAnnullaConfirm(titoloId: string, mode: "mc" | "incasso") {
    setAnnullaPassword("");
    setAnnullaState({ open: true, titoloId, mode });
  }

  async function confirmAnnulla() {
    if (!annullaState.titoloId) return;
    setAnnullaMcLoading(true);
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: annullaPassword,
      });
      if (authErr) {
        toast.error("Password non corretta");
        return;
      }
      const res = await annullaMessaACassa(annullaState.titoloId);
      if (!res.ok) {
        toast.error(res.error || "Errore annullamento");
        return;
      }
      const bonificiExtra = (res.bonificiRiaperti ?? 0) > 0 ? ` · ${res.bonificiRiaperti} bonifici riaperti` : "";
      const extra = `${bonificiExtra}${res.rataSuccessivaEliminata ? " · rata successiva rimossa" : ""}`;
      toast.success(
        annullaState.mode === "incasso"
          ? `Incasso annullato · ${res.provvigioniEliminate ?? 0} provv., ${res.movimentiEliminati ?? 0} mov.${extra}`
          : `Messa a cassa annullata · ${res.provvigioniEliminate ?? 0} provvigioni rimosse${extra}`,
      );
      setAnnullaState({ open: false, titoloId: null, mode: "mc" });
      onRefresh();
    } catch {
      toast.error("Errore di verifica");
    } finally {
      setAnnullaMcLoading(false);
    }
  }

  function startRataAction(action: RataAction) {
    if (currentQuietanza) {
      executeRataAction(action, currentQuietanza);
    } else {
      setPendingAction(action);
      setSelectorOpen(true);
    }
  }

  function executeRataAction(action: RataAction, q: ToolbarQuietanza) {
    if (!q.titolo_id) {
      toast.error("Quietanza senza titolo collegato");
      return;
    }
    if (action === "storno") {
      setStornoTitoloId(q.titolo_id);
      setStornoOpen(true);
    } else if (action === "messa_cassa") {
      setCassaTitoli([{
        id: q.titolo_id,
        numero_titolo: numeroPolizza,
        premio_lordo: q.premio_lordo,
        cliente_anagrafica_id: clienteId,
        ufficio_id: uffizioId ?? null,
      }]);
      setCassaOpen(true);
    } else if (action === "annulla_mc") {
      openAnnullaConfirm(q.titolo_id, "mc");
    } else if (action === "annulla_incasso") {
      openAnnullaConfirm(q.titolo_id, "incasso");
    }
  }

  function pickQuietanza(q: ToolbarQuietanza) {
    setSelectorOpen(false);
    if (pendingAction) executeRataAction(pendingAction, q);
    setPendingAction(null);
  }

  // Available rata-level actions filter (when selecting from polizza)
  const eligibleForAction = (q: ToolbarQuietanza, action: RataAction | null): boolean => {
    if (!action) return true;
    const locked = ["annullata", "stornata"].includes(q.stato);
    if (action === "storno") return !locked;
    if (action === "messa_cassa") return !q.data_messa_cassa && !locked;
    if (action === "annulla_mc") return !!q.data_messa_cassa && q.stato !== "incassato";
    if (action === "annulla_incasso") return q.stato === "incassato";
    return true;
  };

  const onQuietanza = !!currentQuietanza;
  const qLocked = currentQuietanza ? ["annullata", "stornata"].includes(currentQuietanza.stato) : false;
  const qIsMC = !!currentQuietanza?.data_messa_cassa;
  const qIncassata = currentQuietanza?.stato === "incassato";

  return (
    <>
      <Card>
        <CardContent className="py-2.5 px-3 flex flex-wrap gap-1.5">
          {/* Rata-level */}
          <Button
            size="sm"
            onClick={() => startRataAction("messa_cassa")}
            disabled={!titoloMadreId || (onQuietanza && (qIsMC || qLocked))}
            title={onQuietanza && qIsMC ? "Già messa a cassa" : undefined}
          >
            <Banknote className="h-4 w-4 mr-1" /> Messa a cassa
          </Button>
          {isAdmin && onQuietanza && (qIncassata || qIsMC) ? (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive border-destructive/50 hover:bg-destructive/10"
              disabled={!titoloMadreId || qLocked || annullaMcLoading}
              onClick={() => currentQuietanza?.titolo_id && openAnnullaConfirm(currentQuietanza.titolo_id, qIncassata ? "incasso" : "mc")}
            >
              <RotateCcw className="h-4 w-4 mr-1" /> {qIncassata ? "Annulla incasso" : "Annulla messa a cassa"}
            </Button>
          ) : onQuietanza ? (
            <Button size="sm" variant="outline" disabled title={!qIsMC ? "Non messa a cassa" : undefined}>
              <RotateCcw className="h-4 w-4 mr-1" /> Annulla messa a cassa
            </Button>
          ) : isAdmin ? (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={() => startRataAction("annulla_mc")}
              disabled={!titoloMadreId || locked}
            >
              <RotateCcw className="h-4 w-4 mr-1" /> Annulla messa a cassa
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={() => startRataAction("storno")}
            disabled={!titoloMadreId || (onQuietanza ? qLocked : locked)}
          >
            <Undo2 className="h-4 w-4 mr-1" /> Storno
          </Button>

          {/* Azioni di ciclo vita contratto: solo sulla scheda polizza, non sulla quietanza */}
          {!onQuietanza && (
            <>
              {!locked && (statoPolizza === "sospesa" ? (
                <Button size="sm" onClick={() => setRiattivazioneOpen(true)} disabled={!titoloMadreId}>
                  <Play className="h-4 w-4 mr-1" /> Riattiva
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setSospensioneOpen(true)} disabled={!titoloMadreId}>
                  <Pause className="h-4 w-4 mr-1" /> Sospendi
                </Button>
              ))}
              <Button size="sm" variant="outline" onClick={() => setSostituzioneOpen(true)} disabled={locked || !titoloMadreId}>
                <Replace className="h-4 w-4 mr-1" /> Sostituisci
              </Button>
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setEstinzioneOpen(true)} disabled={locked || !titoloMadreId}>
                <XCircle className="h-4 w-4 mr-1" /> Estingui
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/portafoglio/appendici?polizza=${encodeURIComponent(numeroPolizza)}&clienteId=${encodeURIComponent(clienteId || "")}&titoloId=${encodeURIComponent(titoloMadreId || "")}`)}
                disabled={!titoloMadreId}
              >
                <FilePlus2 className="h-4 w-4 mr-1" /> Appendici
              </Button>
              {regolazione && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/portafoglio/immissione?mode=regolazione&titoloMadreId=${titoloMadreId}&quietanzaRefId=${titoloMadreId}`)}
                  disabled={!titoloMadreId}
                >
                  <ScrollText className="h-4 w-4 mr-1" /> Regolazione
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/portafoglio/doc-precontrattuale?titoloId=${encodeURIComponent(titoloMadreId || "")}&clienteId=${encodeURIComponent(clienteId || "")}`)}
                disabled={!titoloMadreId}
              >
                <FileText className="h-4 w-4 mr-1" /> Precontrattuale
              </Button>
              {!locked && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" disabled={!titoloMadreId || annullaLoading}>
                    <Ban className="h-4 w-4 mr-1" /> Annulla polizza (irreversibile)
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Conferma annullamento</AlertDialogTitle>
                    <AlertDialogDescription>
                      Verranno rimosse tutte le quietanze, provvigioni, rimesse e movimenti collegati a questa polizza.
                      L'operazione è irreversibile.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={handleAnnullaPolizza}>
                      {annullaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Conferma"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              )}
            </>
          )}
          {onQuietanza && polizzaId && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/polizze/${polizzaId}`)}>
              <FileText className="h-4 w-4 mr-1" /> Apri polizza contratto
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Quietanza selector */}
      <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Seleziona la quietanza</DialogTitle>
            <DialogDescription>
              Su quale rata vuoi eseguire l'operazione?
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto divide-y border rounded-md">
            {quietanze.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Nessuna quietanza disponibile</div>
            ) : quietanze.map((q) => {
              const ok = eligibleForAction(q, pendingAction);
              return (
                <button
                  key={q.id}
                  disabled={!ok}
                  onClick={() => pickQuietanza(q)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/60 disabled:opacity-40 disabled:cursor-not-allowed text-left"
                >
                  <span className="font-mono font-semibold w-12">
                    {q.numero_rata}{q.numero_rate_totali ? `/${q.numero_rate_totali}` : ""}
                  </span>
                  <span className="text-muted-foreground w-24 text-xs">{fmtDate(q.garanzia_da)}</span>
                  <span className="text-muted-foreground w-24 text-xs">{fmtDate(q.garanzia_a || q.data_scadenza)}</span>
                  <span className="flex-1 text-right tabular-nums">{fmtEuro(q.premio_lordo)}</span>
                  <Badge variant="outline" className={STATO_Q[q.stato] || ""}>
                    {q.stato.replace("_", " ")}
                  </Badge>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Polizza-level dialogs */}
      {titoloMadreId && (
        <>
          <SospensionePolizzaDialog open={sospensioneOpen} onOpenChange={setSospensioneOpen} titoloId={titoloMadreId} numeroPolizza={numeroPolizza} onDone={onRefresh} />
          <RiattivazionePolizzaDialog open={riattivazioneOpen} onOpenChange={setRiattivazioneOpen} titoloId={titoloMadreId} numeroPolizza={numeroPolizza} onDone={onRefresh} />
          <SostituzionePolizzaDialog open={sostituzioneOpen} onOpenChange={setSostituzioneOpen} titoloId={titoloMadreId} numeroPolizza={numeroPolizza} onDone={onRefresh} />
          <EstinzionePolizzaDialog open={estinzioneOpen} onOpenChange={setEstinzioneOpen} titoloId={titoloMadreId} numeroPolizza={numeroPolizza} onDone={onRefresh} />
        </>
      )}

      {/* Rata-level dialogs */}
      {stornoTitoloId && (
        <StornoTitoloDialog
          open={stornoOpen}
          onOpenChange={(o) => { setStornoOpen(o); if (!o) setStornoTitoloId(null); }}
          titoloId={stornoTitoloId}
          numeroPolizza={numeroPolizza}
          onDone={onRefresh}
        />
      )}
      {cassaTitoli.length > 0 && (
        <MessaCassaDialog
          open={cassaOpen}
          onOpenChange={(o) => { setCassaOpen(o); if (!o) setCassaTitoli([]); }}
          titoli={cassaTitoli}
          onSuccess={onRefresh}
        />
      )}

      {/* Conferma annullo incasso/messa a cassa con verifica password admin */}
      <Dialog
        open={annullaState.open}
        onOpenChange={(o) => { if (!o) setAnnullaState({ open: false, titoloId: null, mode: "mc" }); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {annullaState.mode === "incasso" ? "Conferma annullamento incasso" : "Conferma annullamento messa a cassa"}
            </DialogTitle>
            <DialogDescription>Verifica la tua identità per procedere. La polizza madre non verrà modificata.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 space-y-2">
              <p className="text-sm font-medium text-destructive">
                ⚠️ Operazione riservata agli amministratori. Verranno rimossi/riportati indietro in transazione:
              </p>
              <ul className="text-xs text-destructive/90 list-disc pl-4 space-y-0.5">
                <li>Provvigioni generate e righe di pagamento (blocco se già liquidate)</li>
                <li>Movimenti contabili collegati (compensazioni, utilizzi acconto)</li>
                <li>Righe rimessa in bozza (blocco se rimessa in pagamento/pagata)</li>
                <li>Acconti cliente utilizzati (residuo ripristinato)</li>
                <li>Eventuale rata successiva auto-generata non incassata</li>
                <li>La quietanza torna a <strong>«da incassare»</strong> e sparisce dagli estratti conto incassati</li>
              </ul>
            </div>
            <div>
              <Label className="text-xs">Password</Label>
              <Input
                type="password"
                value={annullaPassword}
                onChange={(e) => setAnnullaPassword(e.target.value)}
                placeholder="Inserisci la tua password"
                className="mt-1"
                onKeyDown={(e) => { if (e.key === "Enter" && annullaPassword && !annullaMcLoading) confirmAnnulla(); }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnnullaState({ open: false, titoloId: null, mode: "mc" })} disabled={annullaMcLoading}>
              Annulla
            </Button>
            <Button variant="destructive" disabled={!annullaPassword || annullaMcLoading} onClick={confirmAnnulla}>
              {annullaMcLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Conferma Annullamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
