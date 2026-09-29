import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Loader2, Trash2, PowerOff } from "lucide-react";
import type { ImpactCheck, ImpactResult } from "@/hooks/useEntityImpact";
import { useEntityImpact } from "@/hooks/useEntityImpact";

export interface DeleteWithImpactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string | null | undefined;
  /** Es: "produttore", "sede", "compagnia" */
  entityType: string;
  /** Nome leggibile dell'entità da eliminare */
  entityName: string;
  /** FK da controllare (lista) */
  checks: ImpactCheck[];
  /** Conferma eliminazione hard */
  onConfirmDelete: () => void;
  /** Opzionale: callback per disattivare invece. Se non fornito, niente CTA "disattiva". */
  onDeactivateInstead?: () => void;
  isDeleting?: boolean;
  /** Note custom opzionali (es: "Cosa NON viene toccato:") */
  extraNotes?: React.ReactNode;
}

const ImpactRow = ({ item }: { item: ImpactResult }) => {
  const isBlocking = item.blocking && item.count > 0;
  const isOk = item.count === 0;
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded text-sm">
      <span className="flex items-center gap-2">
        {isOk ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        ) : isBlocking ? (
          <AlertTriangle className="w-4 h-4 text-destructive" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        )}
        <span className={isBlocking ? "font-medium" : ""}>{item.label}</span>
      </span>
      <span className="flex items-center gap-2">
        <span className="font-mono tabular-nums text-sm">{item.count}</span>
        {isBlocking && (
          <Badge variant="destructive" className="text-[10px] uppercase">Bloccante</Badge>
        )}
        {!isBlocking && item.count > 0 && (
          <Badge variant="secondary" className="text-[10px] uppercase">Info</Badge>
        )}
      </span>
    </div>
  );
};

export const DeleteWithImpactDialog = ({
  open,
  onOpenChange,
  entityId,
  entityType,
  entityName,
  checks,
  onConfirmDelete,
  onDeactivateInstead,
  isDeleting,
  extraNotes,
}: DeleteWithImpactDialogProps) => {
  const { data, isLoading } = useEntityImpact(entityId, checks, open);
  const totalBlocking = data?.totalBlocking ?? 0;
  const blocked = totalBlocking > 0;

  const [typed, setTyped] = useState("");
  useEffect(() => { if (!open) setTyped(""); }, [open]);
  const matches = typed.trim().toLowerCase() === entityName.trim().toLowerCase();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-destructive" />
            Eliminare {entityType}?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div>
                Stai per eliminare definitivamente:{" "}
                <span className="font-semibold text-foreground">{entityName}</span>
              </div>

              <div className="rounded-md border bg-muted/30 p-3 space-y-1">
                <div className="text-xs uppercase font-semibold text-muted-foreground mb-1">
                  Verifica collegamenti
                </div>
                {isLoading ? (
                  <div className="flex items-center gap-2 text-sm py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Conteggio in corso...
                  </div>
                ) : (
                  data?.items.map((it) => <ImpactRow key={it.label} item={it} />)
                )}
              </div>

              {!isLoading && blocked && (
                <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">Eliminazione bloccata</div>
                      <div className="text-xs mt-1">
                        Ci sono {totalBlocking} collegamenti attivi. Eliminare romperebbe lo storico di
                        polizze, clienti o altre entità collegate. Disattiva invece, così non sarà più
                        selezionabile per nuove operazioni ma lo storico resta intatto.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!isLoading && !blocked && (
                <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                  Nessun collegamento trovato — eliminazione sicura.
                </div>
              )}

              <div className="text-xs text-muted-foreground space-y-1">
                <div>
                  <span className="font-semibold">Cosa succede:</span> i dati anagrafici di "{entityName}"
                  vengono cancellati. Log attività, audit trail e messaggi chat restano (con riferimento
                  all'ID).
                </div>
                <div>
                  <span className="font-semibold">Cosa NON viene toccato:</span> polizze, clienti,
                  sinistri e movimenti contabili collegati restano esattamente come sono.
                </div>
                {extraNotes}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!isLoading && !blocked && (
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-xs">
              Per confermare digita il nome:{" "}
              <span className="font-mono font-semibold text-foreground">{entityName}</span>
            </Label>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              placeholder={entityName}
              className={cn(matches && "border-emerald-500 focus-visible:ring-emerald-500")}
            />
          </div>
        )}

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Annulla
          </Button>
          {onDeactivateInstead && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                onDeactivateInstead();
                onOpenChange(false);
              }}
              disabled={isDeleting}
            >
              <PowerOff className="w-4 h-4 mr-2" />
              Disattiva invece
            </Button>
          )}
          <Button
            type="button"
            variant="destructive"
            onClick={(e) => {
              e.preventDefault();
              onConfirmDelete();
            }}
            disabled={isDeleting || blocked || isLoading || !matches}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {isDeleting ? "Eliminazione..." : "Elimina"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteWithImpactDialog;
