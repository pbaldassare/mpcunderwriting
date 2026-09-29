import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { validatePIVA } from "@/lib/validatePIVA";
import { validateCF } from "@/lib/validateCF";

export type FiscalKind = "cf16" | "piva" | "cf-azienda";

interface FiscalCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  kind: FiscalKind;
  required?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  /** Notifica al parent se il valore corrente è valido (post normalizzazione). */
  onValidChange?: (valid: boolean) => void;
  /** Per kind="cf16": filtra in input i caratteri non conformi alla posizione (LLLLLL NN L NN L NNN L). */
  enforcePattern?: boolean;
}

// Pattern CF persona fisica: per ogni indice 0-15, true se serve LETTERA, false se CIFRA.
const CF16_IS_LETTER = [
  true, true, true, true, true, true, // 0-5: cognome+nome
  false, false,                       // 6-7: anno
  true,                               // 8: mese
  false, false,                       // 9-10: giorno
  true,                               // 11: provincia
  false, false, false,                // 12-14: comune
  true,                               // 15: controllo
];

// Lettere ammesse al posto delle cifre per OMOCODIA (Agenzia delle Entrate)
const OMOCODIA_LETTERS = /[LMNPQRSTUV]/;

function filterCF16(input: string): string {
  let out = "";
  for (const raw of input) {
    if (out.length >= 16) break;
    const ch = raw.toUpperCase();
    const wantsLetter = CF16_IS_LETTER[out.length];
    if (wantsLetter) {
      if (/[A-Z]/.test(ch)) out += ch;
    } else {
      // In posizione cifra accettiamo sia digit sia lettere omocodia
      if (/[0-9]/.test(ch) || OMOCODIA_LETTERS.test(ch)) out += ch;
    }
  }
  return out;
}

function runValidation(kind: FiscalKind, value: string) {
  const v = (value || "").trim();
  if (!v) return { valid: false as const, error: undefined as string | undefined };
  if (kind === "piva") return validatePIVA(v);
  if (kind === "cf16") return validateCF(v, { allowPIVAFormat: false });
  return validateCF(v, { allowPIVAFormat: true });
}

const HINTS: Record<FiscalKind, string> = {
  piva: "11 cifre numeriche con checksum",
  cf16: "16 caratteri (lettere + cifre) con carattere di controllo",
  "cf-azienda": "16 caratteri o 11 cifre (P.IVA)",
};

export function FiscalCodeInput({
  value,
  onChange,
  kind,
  required,
  placeholder,
  className,
  id,
  disabled,
  onValidChange,
  enforcePattern,
}: FiscalCodeInputProps) {
  const [touched, setTouched] = React.useState(false);
  const maxLength = kind === "piva" ? 11 : 16;

  const result = React.useMemo(() => runValidation(kind, value), [kind, value]);

  React.useEffect(() => {
    onValidChange?.(result.valid);
  }, [result.valid, onValidChange]);

  const showError = touched && !!value && !result.valid;
  const showRequiredEmpty = required && !value;

  return (
    <div className="space-y-1">
      <Input
        id={id}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        title={HINTS[kind]}
        maxLength={maxLength}
        onChange={(e) => {
          let v = e.target.value.toUpperCase().replace(/\s+/g, "");
          if (kind === "piva") v = v.replace(/\D/g, "");
          else if (kind === "cf16" && enforcePattern) v = filterCF16(v);
          onChange(v);
        }}
        onBlur={() => setTouched(true)}
        className={cn(
          showError && "border-destructive focus-visible:ring-destructive",
          !showError && showRequiredEmpty && "border-amber-400",
          className,
        )}
      />
      {showError && (
        <p className="text-xs text-destructive">{result.error}</p>
      )}
    </div>
  );
}
