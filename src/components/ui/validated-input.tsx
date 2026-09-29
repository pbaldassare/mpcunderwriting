import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { validateCF } from "@/lib/validateCF";
import { validatePIVA } from "@/lib/validatePIVA";
import { validateIban } from "@/lib/validateIban";

type Kind = "cf" | "piva" | "iban" | "email" | "custom";

export interface ValidatedInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  kind: Kind;
  value: string;
  onChange: (value: string) => void;
  /** Quando true non mostra messaggi finché non si tocca il campo. Default true. */
  validateOnTouch?: boolean;
  /** Validator custom per kind="custom". */
  validator?: (v: string) => { valid: boolean; error?: string };
  /** Callback opzionale con esito validazione live. */
  onValidationChange?: (result: { valid: boolean; error?: string }) => void;
  /** Forza maiuscolo (default true per CF/PIVA/IBAN). */
  uppercase?: boolean;
  className?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function runValidator(kind: Kind, v: string, custom?: ValidatedInputProps["validator"]) {
  const s = (v ?? "").trim();
  if (!s) return { valid: true as const };
  switch (kind) {
    case "cf": return validateCF(s);
    case "piva": return validatePIVA(s);
    case "iban": return validateIban(s);
    case "email":
      return EMAIL_RE.test(s)
        ? { valid: true as const }
        : { valid: false as const, error: "Email non valida" };
    case "custom":
      return custom ? custom(s) : { valid: true as const };
  }
}

/**
 * Input con validazione real-time (CF, P.IVA, IBAN, email, custom).
 *
 * - Mostra icona ✓ / ✗ a destra
 * - Bordo colorato (success/destructive) in base allo stato
 * - Messaggio errore inline sotto il campo
 * - Per CF/PIVA/IBAN normalizza automaticamente a maiuscolo
 */
export const ValidatedInput = React.forwardRef<HTMLInputElement, ValidatedInputProps>(
  (
    { kind, value, onChange, validateOnTouch = true, validator, onValidationChange,
      uppercase, className, onBlur, ...rest },
    ref,
  ) => {
    const [touched, setTouched] = React.useState(false);
    const forceUpper = uppercase ?? (kind === "cf" || kind === "piva" || kind === "iban");

    const result = React.useMemo(
      () => runValidator(kind, value || "", validator),
      [kind, value, validator],
    );

    React.useEffect(() => {
      onValidationChange?.(result);
    }, [result.valid, result.error]); // eslint-disable-line react-hooks/exhaustive-deps

    const show = !validateOnTouch || touched;
    const hasValue = !!(value && value.trim());
    const isError = show && hasValue && !result.valid;
    const isOk = show && hasValue && result.valid;

    return (
      <div className="space-y-1">
        <div className="relative">
          <Input
            ref={ref}
            value={value ?? ""}
            onChange={(e) => {
              const next = forceUpper ? e.target.value.toUpperCase() : e.target.value;
              onChange(next);
            }}
            onBlur={(e) => { setTouched(true); onBlur?.(e); }}
            className={cn(
              isError && "border-destructive focus-visible:ring-destructive pr-9",
              isOk && "border-emerald-500 focus-visible:ring-emerald-500 pr-9",
              className,
            )}
            aria-invalid={isError || undefined}
            {...rest}
          />
          {isOk && (
            <CheckCircle2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600 pointer-events-none" />
          )}
          {isError && (
            <AlertCircle className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-destructive pointer-events-none" />
          )}
        </div>
        {isError && result.error && (
          <p className="text-xs text-destructive">{result.error}</p>
        )}
      </div>
    );
  },
);
ValidatedInput.displayName = "ValidatedInput";

export const PendingIcon = () => <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
