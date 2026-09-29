import * as React from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Parse yyyy-MM-dd (o ISO con time) in Date locale, senza shift timezone. */
export function parseIsoDateOnly(raw: string | null | undefined): Date | undefined {
  const s = String(raw ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}

export function formatIsoDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse dd/MM/yyyy (anche con - o . come separatore). */
export function parseItalianDateOnly(raw: string | null | undefined): Date | undefined {
  const s = String(raw ?? "").trim();
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!m) return undefined;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return undefined;
  }
  return dt;
}

export function formatItalianDateOnly(d: Date): string {
  return format(d, "dd/MM/yyyy", { locale: it });
}

/** Applica maschera gg/mm/aaaa: estrae cifre (max 8) e inserisce le barre. */
export function maskItalianDateInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

  const digits = trimmed.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Maschera + posizione cursore dopo inserimento automatico delle barre. */
export function maskItalianDateInputWithCursor(
  raw: string,
  cursor: number,
): { value: string; cursor: number } {
  const digitsBefore = raw.slice(0, cursor).replace(/\D/g, "").length;
  const value = maskItalianDateInput(raw);

  if (digitsBefore <= 0) return { value, cursor: 0 };

  let seen = 0;
  for (let i = 0; i < value.length; i++) {
    if (/\d/.test(value[i])) {
      seen++;
      if (seen === digitsBefore) {
        let next = i + 1;
        if (value[next] === "/") next++;
        return { value, cursor: next };
      }
    }
  }

  return { value, cursor: value.length };
}

type DateInputProps = Omit<React.ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange"> & {
  value?: string | number | readonly string[];
  defaultValue?: string | number | readonly string[];
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
};

function patchEventValue<E extends { target: EventTarget; currentTarget: EventTarget }>(
  event: E,
  value: string,
  fieldName: string,
): E {
  const target = event.target as HTMLInputElement;
  const currentTarget = event.currentTarget as HTMLInputElement;
  // Non impostare type:"date" — RHF ignorerebbe value e leggerebbe ref (testo gg/mm/aaaa).
  return {
    ...event,
    target: { ...target, value, name: fieldName },
    currentTarget: { ...currentTarget, value, name: fieldName },
  } as E;
}

/**
 * Sostituto italiano di &lt;input type="date"&gt;.
 * - Digitazione libera gg/mm/aaaa + selezione calendario
 * - Value/onChange restano in yyyy-MM-dd (compatibile con i form esistenti)
 */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  (
    {
      className,
      value,
      defaultValue,
      onChange,
      onBlur,
      disabled,
      id,
      name,
      min,
      max,
      required,
      placeholder = "gg/mm/aaaa",
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const [uncontrolled, setUncontrolled] = React.useState(() =>
      String(defaultValue ?? ""),
    );
    const controlled = value !== undefined;
    const iso = controlled ? String(value ?? "") : uncontrolled;
    const selected = parseIsoDateOnly(iso);
    const minDate = parseIsoDateOnly(typeof min === "string" ? min : undefined);
    const maxDate = parseIsoDateOnly(typeof max === "string" ? max : undefined);

    const [text, setText] = React.useState(() =>
      selected ? formatItalianDateOnly(selected) : "",
    );
    const [focused, setFocused] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const hiddenRef = React.useRef<HTMLInputElement>(null);
    const committedIsoRef = React.useRef(iso);
    const pendingCursorRef = React.useRef<number | null>(null);

    React.useEffect(() => {
      committedIsoRef.current = iso;
    }, [iso]);

    // RHF register legge/scrive ref.value: hidden ISO, non il testo gg/mm/aaaa visibile.
    React.useImperativeHandle(ref, () => hiddenRef.current as HTMLInputElement);

    React.useEffect(() => {
      if (focused) return;
      const d = parseIsoDateOnly(iso);
      setText(d ? formatItalianDateOnly(d) : "");
    }, [iso, focused]);

    React.useLayoutEffect(() => {
      if (pendingCursorRef.current === null || !inputRef.current) return;
      const pos = pendingCursorRef.current;
      pendingCursorRef.current = null;
      inputRef.current.setSelectionRange(pos, pos);
    }, [text]);

    const isWithinBounds = (d: Date) => {
      if (minDate && d < minDate) return false;
      if (maxDate && d > maxDate) return false;
      return true;
    };

    const emit = (nextIso: string) => {
      committedIsoRef.current = nextIso;
      if (!controlled) setUncontrolled(nextIso);
      if (!onChange || !inputRef.current) return;
      onChange(
        patchEventValue(
          {
            target: inputRef.current,
            currentTarget: inputRef.current,
            type: "change",
          } as React.ChangeEvent<HTMLInputElement>,
          nextIso,
          name ?? "",
        ),
      );
    };

    const commitIso = (nextIso: string) => {
      const d = parseIsoDateOnly(nextIso);
      if (nextIso && (!d || !isWithinBounds(d))) {
        setText(selected ? formatItalianDateOnly(selected) : "");
        return;
      }
      emit(nextIso);
      setText(d ? formatItalianDateOnly(d) : "");
    };

    const commitText = (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        commitIso("");
        return;
      }
      const d = parseItalianDateOnly(trimmed);
      if (!d || !isWithinBounds(d)) {
        setText(selected ? formatItalianDateOnly(selected) : "");
        return;
      }
      commitIso(formatIsoDateOnly(d));
    };

    const tryCommitText = (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      const d = parseItalianDateOnly(trimmed);
      if (d && isWithinBounds(d)) {
        commitIso(formatIsoDateOnly(d));
      }
    };

    return (
      <div className="relative w-full">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          id={id}
          disabled={disabled}
          aria-required={required}
          placeholder={placeholder}
          autoComplete="off"
          value={text}
          onChange={(e) => {
            const raw = e.target.value;
            const sel = e.target.selectionStart ?? raw.length;
            const { value: masked, cursor } = maskItalianDateInputWithCursor(raw, sel);
            pendingCursorRef.current = cursor;
            setText(masked);
            tryCommitText(masked);
          }}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            setFocused(false);
            commitText(e.target.value);
            onBlur?.(patchEventValue(e, committedIsoRef.current, name ?? ""));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background py-2 pl-3 pr-10 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className,
          )}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              tabIndex={-1}
              aria-label="Apri calendario"
              className="absolute right-0 top-0 h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <CalendarIcon className="h-4 w-4 opacity-70" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              locale={it}
              selected={selected}
              defaultMonth={selected}
              onSelect={(d) => {
                if (!d) {
                  commitIso("");
                  return;
                }
                commitIso(formatIsoDateOnly(d));
                setOpen(false);
              }}
              disabled={(date) => {
                if (minDate && date < minDate) return true;
                if (maxDate && date > maxDate) return true;
                return false;
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {name ? (
          <input
            ref={hiddenRef}
            type="hidden"
            name={name}
            value={iso.slice(0, 10)}
            required={required}
            aria-hidden
            tabIndex={-1}
            readOnly
          />
        ) : null}
      </div>
    );
  },
);
DateInput.displayName = "DateInput";
