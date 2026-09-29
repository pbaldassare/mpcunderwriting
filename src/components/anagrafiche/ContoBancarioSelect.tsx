import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useAuth } from "@/contexts/AuthContext";
import { filterContiBancariPerSede } from "@/lib/filterContiBancariPerSede";

interface Props {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  /** Filtra per tipo. Se omesso, mostra tutti. */
  tipi?: Array<"incasso_clienti" | "agenzia" | "provvigioni" | "generico">;
  placeholder?: string;
  disabled?: boolean;
  /** Mostra anteprima testuale del conto selezionato */
  showPreview?: boolean;
  /** Se true e value è vuoto, seleziona il conto default (o il primo disponibile). */
  autoSelectDefault?: boolean;
  className?: string;
}

export interface ContoBancario {
  id: string;
  etichetta: string;
  iban: string;
  intestato_a: string;
  banca: string | null;
  bic: string | null;
  tipo: string;
  is_default: boolean;
  attivo: boolean;
}

const maskIban = (iban: string) => {
  if (!iban || iban.length < 8) return iban;
  return iban.slice(0, 4) + " **** **** **** " + iban.slice(-4);
};

export default function ContoBancarioSelect({
  value,
  onChange,
  tipi,
  placeholder = "Seleziona conto bancario…",
  disabled,
  showPreview = true,
  autoSelectDefault = false,
  className,
}: Props) {
  const { profile } = useAuth();

  const { data: contiRaw = [] } = useQuery({
    queryKey: ["conti_bancari", "select", tipi?.join(",") || "all"],
    queryFn: async () => {
      let q = supabase
        .from("conti_bancari" as any)
        .select("*, conti_bancari_uffici(ufficio_id)")
        .eq("attivo", true);
      if (tipi && tipi.length) q = q.in("tipo", tipi);
      const { data, error } = await q.order("is_default", { ascending: false }).order("etichetta");
      if (error) throw error;
      return (data || []) as unknown as ContoBancario[];
    },
    staleTime: 300000 * 60 * 5,
  });

  const conti = useMemo(
    () =>
      filterContiBancariPerSede(contiRaw, {
        ruolo: profile?.ruolo,
        ufficioId: profile?.ufficio_id,
      }),
    [contiRaw, profile?.ruolo, profile?.ufficio_id],
  );

  const defaultContoId = useMemo(() => {
    const def = conti.find((c) => c.is_default) || conti[0];
    return def?.id ?? null;
  }, [conti]);

  useEffect(() => {
    if (!autoSelectDefault || value || !defaultContoId) return;
    onChange(defaultContoId);
  }, [autoSelectDefault, value, defaultContoId, onChange]);

  const options = conti.map((c) => ({
    value: c.id,
    label: (c.etichetta || c.banca || "Conto") + (c.is_default ? " ⭐" : ""),
    description: `${maskIban(c.iban)} — ${c.intestato_a}`,
    searchText: `${c.iban} ${c.intestato_a} ${c.banca || ""}`,
  }));

  const selected = conti.find((c) => c.id === value);

  return (
    <div className={className}>
      <SearchableSelect
        options={options}
        value={value || ""}
        onValueChange={(v) => onChange(v || null)}
        placeholder={placeholder}
        disabled={disabled}
        emptyText="Nessun conto disponibile"
      />
      {showPreview && selected && (
        <div className="mt-2 text-xs text-muted-foreground space-y-0.5 rounded-md border border-border bg-muted/30 px-3 py-2">
          <div><span className="font-medium text-foreground">Intestato a:</span> {selected.intestato_a}</div>
          {selected.banca && <div><span className="font-medium text-foreground">Banca:</span> {selected.banca}</div>}
          <div className="font-mono"><span className="font-medium text-foreground font-sans">IBAN:</span> {selected.iban}</div>
        </div>
      )}
    </div>
  );
}
