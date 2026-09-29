import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchableSelect } from "@/components/SearchableSelect";
import { supabase } from "@/integrations/supabase/client";
import { formatEdgeFunctionError } from "@/lib/edgeFunctionError";
import { toast } from "sonner";

type CompagniaOption = {
  id: string;
  nome: string | null;
  codice?: string | null;
};

type Props = {
  sinistroId: string;
  compagniaId?: string | null;
  compagniaNome?: string | null;
  onSaved: () => void;
};

export default function SinistroCompagniaHeaderField({
  sinistroId,
  compagniaId,
  compagniaNome,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);
  const currentId = compagniaId || "";

  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie-attive-sinistro-header"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compagnie")
        .select("id, nome, codice")
        .eq("attiva", true)
        .order("nome")
        .limit(1000);
      if (error) throw error;
      return (data || []) as CompagniaOption[];
    },
  });

  const options = useMemo(() => {
    const list = [...compagnie];
    if (currentId && !list.some((c) => c.id === currentId)) {
      list.unshift({
        id: currentId,
        nome: compagniaNome || "Compagnia corrente",
        codice: null,
      });
    }
    return list.map((c) => ({
      value: c.id,
      label: c.nome || c.id,
      searchText: `${c.nome || ""} ${c.codice || ""}`,
    }));
  }, [compagnie, currentId, compagniaNome]);

  const saveCompagnia = async (nextId: string) => {
    if (!nextId || nextId === currentId) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("gestione-sinistri", {
        body: {
          azione: "aggiorna",
          sinistro_id: sinistroId,
          user_id: user?.id,
          compagnia_id: nextId,
        },
      });
      if (error || !data?.success) {
        throw new Error(formatEdgeFunctionError(error, data));
      }
      toast.success("Compagnia assicurativa aggiornata");
      onSaved();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore aggiornamento compagnia";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SearchableSelect
      options={options}
      value={currentId}
      onValueChange={saveCompagnia}
      placeholder="Seleziona compagnia…"
      searchPlaceholder="Cerca compagnia…"
      emptyText="Nessuna compagnia trovata."
      disabled={saving}
      className="h-7 min-w-[180px] w-[220px] max-w-[min(280px,50vw)] text-xs"
    />
  );
}
