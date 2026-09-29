import { Checkbox } from "@/components/ui/checkbox";
import { RcaSegmented } from "@/components/rca/RcaPageChrome";
import { GARANZIE_ASSICURAPP, type CodiceGaranziaAssicurapp } from "@/lib/rca/garanzie";
import {
  CVT_PACCHETTI,
  GARANZIE_ACCESSORIE,
  QUOTE_KINDS,
  type CvtPacchettoValue,
  type RcaQuoteKind,
} from "@/lib/rca/cvt";
import { cn } from "@/lib/utils";

export function RcaGaranziePicker({
  quoteKind,
  onQuoteKind,
  garanzie,
  onToggleAccessorio,
  cvtPacchetto,
  onCvtPacchetto,
}: {
  quoteKind: RcaQuoteKind;
  onQuoteKind: (kind: RcaQuoteKind) => void;
  garanzie: CodiceGaranziaAssicurapp[];
  onToggleAccessorio: (code: CodiceGaranziaAssicurapp, on: boolean) => void;
  cvtPacchetto: CvtPacchettoValue;
  onCvtPacchetto: (value: CvtPacchettoValue) => void;
}) {
  const accessori = GARANZIE_ASSICURAPP.filter((g) => GARANZIE_ACCESSORIE.includes(g.code));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        {QUOTE_KINDS.map((kind) => {
          const active = quoteKind === kind.value;
          return (
            <button
              key={kind.value}
              type="button"
              onClick={() => onQuoteKind(kind.value)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                active ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40",
              )}
            >
              <p className="font-semibold">{kind.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{kind.hint}</p>
            </button>
          );
        })}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {quoteKind === "cvt" ? "Pacchetto CVT" : "Copertura danni (CVT)"}
        </p>
        <div className="grid gap-2">
          {CVT_PACCHETTI.filter((p) => quoteKind === "rca" || p.value).map((pack) => {
            const active = cvtPacchetto === pack.value;
            return (
              <label
                key={pack.value || "none"}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                  active ? "border-primary bg-primary/5" : "hover:bg-muted/40",
                )}
              >
                <input
                  type="radio"
                  className="h-4 w-4 accent-primary"
                  name="cvt-pacchetto"
                  checked={active}
                  onChange={() => onCvtPacchetto(pack.value)}
                />
                <span className="flex-1">{pack.label}</span>
                {pack.cvt.length > 0 && (
                  <span className="text-xs text-muted-foreground">{pack.cvt.join(" · ")}</span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {quoteKind === "rca" && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Garanzie accessorie
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {accessori.map((g) => (
              <label
                key={g.code}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm",
                  garanzie.includes(g.code) ? "border-primary/40 bg-primary/5" : "hover:bg-muted/40",
                )}
              >
                <Checkbox
                  checked={garanzie.includes(g.code)}
                  onCheckedChange={(v) => onToggleAccessorio(g.code, !!v)}
                />
                {g.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {quoteKind === "cvt" && (
        <RcaSegmented
          label="Infortuni conducente (IF)"
          value={garanzie.includes("infortuni_conducente") ? "si" : "no"}
          options={[
            { value: "no", label: "No" },
            { value: "si", label: "Sì" },
          ]}
          onChange={(v) => onToggleAccessorio("infortuni_conducente", v === "si")}
        />
      )}
    </div>
  );
}
