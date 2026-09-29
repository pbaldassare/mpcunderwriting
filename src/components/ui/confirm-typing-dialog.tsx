import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmTypingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Titolo del dialog (es. "Cancellare polizza?"). */
  title: string;
  /** Descrizione/contesto dell'azione distruttiva. */
  description?: React.ReactNode;
  /**
   * Stringa che l'utente deve digitare esattamente per confermare
   * (es. numero polizza, ragione sociale cliente).
   */
  confirmationText: string;
  /** Etichetta del campo (default "Digita per confermare"). */
  inputLabel?: string;
  /** Etichetta bottone azione (default "Conferma"). */
  actionLabel?: string;
  /** Callback eseguita SOLO se la stringa digitata combacia. */
  onConfirm: () => void | Promise<void>;
  /** Disabilita il pulsante mentre l'azione è in corso. */
  loading?: boolean;
}

/**
 * Conferma per azioni distruttive (cancellazioni, storni, reset)
 * che richiede di digitare una stringa esatta per essere abilitata.
 *
 * Esempio:
 *   <ConfirmTypingDialog
 *     open={open} onOpenChange={setOpen}
 *     title="Cancellare polizza?" confirmationText={t.numero_titolo}
 *     description={<>L'operazione è irreversibile.</>}
 *     onConfirm={handleDelete}
 *   />
 */
export function ConfirmTypingDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmationText,
  inputLabel,
  actionLabel = "Conferma",
  onConfirm,
  loading,
}: ConfirmTypingDialogProps) {
  const [typed, setTyped] = React.useState("");
  React.useEffect(() => { if (!open) setTyped(""); }, [open]);

  const matches = typed.trim() === confirmationText.trim();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            {title}
          </AlertDialogTitle>
          {description && (
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground space-y-2">{description}</div>
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label className="text-xs">
            {inputLabel || (
              <>Per confermare digita <span className="font-mono font-semibold text-foreground">{confirmationText}</span></>
            )}
          </Label>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            autoComplete="off"
            placeholder={confirmationText}
            className={cn(matches && "border-emerald-500 focus-visible:ring-emerald-500")}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Annulla</AlertDialogCancel>
          <AlertDialogAction
            disabled={!matches || loading}
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Attendere..." : actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ConfirmTypingDialog;
