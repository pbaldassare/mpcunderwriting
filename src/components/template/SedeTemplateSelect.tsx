import { SearchableSelect } from "@/components/SearchableSelect";
import { TEMPLATE_SEDE_GLOBALE, sedeFormValue, sedeToUfficioId } from "@/lib/emailBrandingSede";

export type UfficioOption = { id: string; nome_ufficio: string; codice_ufficio: string | null };

export function sedeOptions(uffici: UfficioOption[], allowGlobale = true) {
  return [
    ...(allowGlobale ? [{ value: TEMPLATE_SEDE_GLOBALE, label: "Globale (tutte le sedi)" }] : []),
    ...uffici.map((u) => ({
      value: u.id,
      label: `${u.codice_ufficio || "—"} — ${u.nome_ufficio}`,
    })),
  ];
}

export function SedeTemplateSelect({
  uffici,
  value,
  onChange,
  placeholder = "Seleziona sede...",
  className,
  allowGlobale = true,
  locked = false,
}: {
  uffici: UfficioOption[];
  value: string | null | undefined;
  onChange: (ufficioId: string | null) => void;
  placeholder?: string;
  className?: string;
  allowGlobale?: boolean;
  locked?: boolean;
}) {
  return (
    <SearchableSelect
      options={sedeOptions(uffici, allowGlobale)}
      value={sedeFormValue(value)}
      onValueChange={(v) => onChange(sedeToUfficioId(v))}
      placeholder={placeholder}
      searchPlaceholder="Cerca sede..."
      className={className}
      disabled={locked}
    />
  );
}
