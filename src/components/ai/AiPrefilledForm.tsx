import { useMemo, useState } from "react";
import { Sparkles, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  /** Titolo mostrato in alto al box (es. "Dati estratti dal documento"). */
  title: string;
  /** Sottotitolo opzionale (es. nome documento o tipo). */
  subtitle?: string;
  /**
   * Numero di campi precompilati dall'AI. Mostrato nel badge in alto.
   * Se non valorizzato, viene mostrato solo il badge "AI".
   */
  prefilledCount?: number;
  /** Callback "Salva". Disabilitato se in pending o se `canSave===false`. */
  onSave: () => void | Promise<void>;
  /** Callback "Scarta" — ripristina lo stato precedente o chiude il box. */
  onDiscard?: () => void;
  isSaving?: boolean;
  /**
   * Quando false, "Salva" resta disabilitato (es. validazione fallita
   * o nessuna modifica rispetto al precompilato e si vuole forzare la
   * conferma esplicita).
   */
  canSave?: boolean;
  /** Etichetta personalizzata per il bottone primario. */
  saveLabel?: string;
  /** Etichetta personalizzata per il bottone secondario. */
  discardLabel?: string;
  className?: string;
  /** I form fields renderizzati dal chiamante. */
  children: React.ReactNode;
}

/**
 * Wrapper standard per form i cui valori iniziali sono stati generati
 * dall'AI. Mostra un banner "Precompilato da AI", lascia tutti i campi
 * editabili e impone una conferma esplicita (Salva) prima della
 * persistenza. Non scrive nulla autonomamente.
 *
 * Comportamento di "Salva":
 *  - di default richiede che l'utente abbia interagito almeno una volta
 *    OPPURE che `canSave` sia esplicitamente `true` (es. validazione
 *    completata). Questo riduce salvataggi accidentali "all'AI cieca".
 */
export function AiPrefilledForm({
  title,
  subtitle,
  prefilledCount,
  onSave,
  onDiscard,
  isSaving = false,
  canSave,
  saveLabel = "Salva",
  discardLabel = "Scarta",
  className,
  children,
}: Props) {
  const [userInteracted, setUserInteracted] = useState(false);

  const computedCanSave = useMemo(() => {
    if (typeof canSave === "boolean") return canSave;
    return userInteracted;
  }, [canSave, userInteracted]);

  return (
    <div
      className={cn(
        "rounded-lg border border-primary/30 bg-primary/[0.03] p-4 shadow-sm",
        className,
      )}
      onPointerDownCapture={() => setUserInteracted(true)}
      onKeyDownCapture={() => setUserInteracted(true)}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 rounded-full bg-primary/10 p-1.5 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {typeof prefilledCount === "number" && prefilledCount > 0 && (
            <Badge
              variant="outline"
              className="gap-1 border-primary/40 bg-primary/5 text-[10px] text-primary"
            >
              <Sparkles className="h-3 w-3" />
              {prefilledCount} campi
            </Badge>
          )}
        </div>
      </header>

      <p className="mb-3 text-[11px] text-muted-foreground">
        Tutti i campi sono modificabili. Niente viene salvato finché non
        confermi.
      </p>

      <div className="space-y-3">{children}</div>

      <footer className="mt-4 flex items-center justify-end gap-2 border-t border-primary/15 pt-3">
        {onDiscard && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDiscard}
            disabled={isSaving}
          >
            <X className="mr-1 h-4 w-4" />
            {discardLabel}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setUserInteracted(true);
            void onSave();
          }}
          disabled={isSaving || !computedCanSave}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              Salvataggio…
            </>
          ) : (
            saveLabel
          )}
        </Button>
      </footer>
    </div>
  );
}
