import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/SearchableSelect";
import { supabase } from "@/integrations/supabase/client";
import { formatPolizzaRamo } from "@/lib/titoliDisplay";

type Props = {
  numeroPolizza: string;
  compagniaId: string;
  ramoSinistro: string;
  prodottoSinistro: string;
  ufficioId: string;
  onChange: (patch: {
    numero_polizza?: string;
    compagnia_id?: string;
    ramo_sinistro?: string;
    prodotto_sinistro?: string;
    ufficio_id?: string;
  }) => void;
  disabled?: boolean;
};

export default function SinistroTerziPolizzaFields({
  numeroPolizza,
  compagniaId,
  ramoSinistro,
  prodottoSinistro,
  ufficioId,
  onChange,
  disabled,
}: Props) {
  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie-attive-sinistro-terzi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compagnie")
        .select("id, nome, codice")
        .eq("attiva", true)
        .order("nome")
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: rami = [] } = useQuery({
    queryKey: ["rami-sinistro-terzi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rami")
        .select("id, descrizione, gruppo_ramo:gruppi_ramo(descrizione)")
        .order("descrizione")
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici-sinistro-terzi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uffici")
        .select("id, nome_ufficio")
        .eq("attivo", true)
        .order("nome_ufficio")
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const ramoOptions = rami.map((r) => {
    const gruppo = Array.isArray(r.gruppo_ramo) ? r.gruppo_ramo[0] : r.gruppo_ramo;
    const label = formatPolizzaRamo({ ramo: { descrizione: r.descrizione, gruppo_ramo: gruppo } });
    return { value: label, label, searchText: label };
  }).filter((o) => o.value && o.value !== "—");

  const ramoCustom = ramoSinistro && !ramoOptions.some((o) => o.value === ramoSinistro)
    ? [{ value: ramoSinistro, label: ramoSinistro }]
    : [];

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-amber-50/40 border-amber-200">
      <div>
        <p className="text-sm font-medium">Polizza di riferimento (non CBnet)</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Il sinistro terzi non si collega a un titolo di portafoglio, ma numero polizza, compagnia e ramo/garanzia sono obbligatori e vengono salvati in anagrafica.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="numero_polizza_terzi">Numero polizza *</Label>
          <Input
            id="numero_polizza_terzi"
            value={numeroPolizza}
            onChange={(e) => onChange({ numero_polizza: e.target.value })}
            placeholder="Es. 1602/4177699"
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>Compagnia *</Label>
          <SearchableSelect
            options={compagnie.map((c) => ({
              value: c.id,
              label: c.nome,
              searchText: `${c.nome} ${c.codice || ""}`,
            }))}
            value={compagniaId}
            onValueChange={(val) => onChange({ compagnia_id: val })}
            placeholder="Seleziona compagnia…"
            searchPlaceholder="Cerca compagnia…"
            clearable
            clearLabel="— Nessuna compagnia —"
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>Ramo / garanzia *</Label>
          <SearchableSelect
            options={[...ramoCustom, ...ramoOptions]}
            value={ramoSinistro}
            onValueChange={(val) => onChange({ ramo_sinistro: val })}
            placeholder="Seleziona ramo o garanzia…"
            searchPlaceholder="Cerca ramo…"
            clearable
            clearLabel="— Nessun ramo —"
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="prodotto_sinistro_terzi">Prodotto</Label>
          <Input
            id="prodotto_sinistro_terzi"
            value={prodottoSinistro}
            onChange={(e) => onChange({ prodotto_sinistro: e.target.value })}
            placeholder="Tipo di prodotto (facoltativo)"
            disabled={disabled}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Ufficio</Label>
          <SearchableSelect
            options={uffici.map((u) => ({ value: u.id, label: u.nome_ufficio || u.id }))}
            value={ufficioId}
            onValueChange={(val) => onChange({ ufficio_id: val })}
            placeholder="Ufficio (facoltativo)"
            searchPlaceholder="Cerca ufficio…"
            clearable
            clearLabel="— Nessun ufficio —"
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
