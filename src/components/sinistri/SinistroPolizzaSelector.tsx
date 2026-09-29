import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { fetchPolizzeForCliente, type TitoloRow } from "@/lib/polizzeSearch";
import { buildPolizzaSelectOption, formatPolizzaGaranzia, formatPolizzaProdotto } from "@/lib/titoliDisplay";
import { formatEdgeFunctionError } from "@/lib/edgeFunctionError";
import { TIPI_SINISTRO, suggestTipoSinistroFromTitolo } from "@/lib/tipiSinistro";
import { resolveTipoSinistroPayload, validateTipoSinistro } from "@/lib/sinistroPraticaSchema";

interface Props {
  sinistroId: string;
  clienteId: string | null | undefined;
  currentTitoloId?: string | null;
  onSaved: () => void;
  /** Se true, salva subito alla selezione; altrimenti espone solo onChange locale */
  autoSave?: boolean;
  value?: string;
  onValueChange?: (titoloId: string) => void;
  disabled?: boolean;
  showSaveButton?: boolean;
  /** Mostra selettore tipo copertura e salva insieme a titolo_id */
  showTipoCopertura?: boolean;
  currentTipoSinistro?: string | null;
  currentTipoPersonalizzato?: string | null;
}

export default function SinistroPolizzaSelector({
  sinistroId,
  clienteId,
  currentTitoloId,
  onSaved,
  autoSave = false,
  value,
  onValueChange,
  disabled = false,
  showSaveButton = false,
  showTipoCopertura = false,
  currentTipoSinistro,
  currentTipoPersonalizzato,
}: Props) {
  const [polizzeList, setPolizzeList] = useState<TitoloRow[]>([]);
  const [polizzeLoading, setPolizzeLoading] = useState(false);
  const [soloMadri, setSoloMadri] = useState(true);
  const [polizzaSearchText, setPolizzaSearchText] = useState("");
  const [selectedId, setSelectedId] = useState(currentTitoloId ?? "");
  const [saving, setSaving] = useState(false);
  const [tipoStd, setTipoStd] = useState(
    currentTipoSinistro || (currentTipoPersonalizzato ? "__custom__" : ""),
  );
  const [tipoCustom, setTipoCustom] = useState(currentTipoPersonalizzato ?? "");

  const effectiveValue = value ?? selectedId;
  const usaPersonalizzato = (tipoCustom || "").length > 0 || tipoStd === "__custom__";
  const selectedPolizza = polizzeList.find((p) => p.id === effectiveValue);

  const loadPolizze = useCallback(async (soloMadriFlag: boolean) => {
    if (!clienteId) {
      setPolizzeList([]);
      return;
    }
    setPolizzeLoading(true);
    try {
      const merged = await fetchPolizzeForCliente(clienteId, { soloMadri: soloMadriFlag });
      setPolizzeList(merged);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore caricamento polizze";
      toast.error(msg);
    } finally {
      setPolizzeLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    setSelectedId(currentTitoloId ?? "");
  }, [currentTitoloId]);

  useEffect(() => {
    setTipoStd(currentTipoSinistro || (currentTipoPersonalizzato ? "__custom__" : ""));
    setTipoCustom(currentTipoPersonalizzato ?? "");
  }, [currentTipoSinistro, currentTipoPersonalizzato]);

  useEffect(() => {
    loadPolizze(soloMadri);
  }, [loadPolizze, soloMadri]);

  const saveTitolo = async (titoloId: string) => {
    const titoloIdEff =
      titoloId && !titoloId.startsWith("cga:") ? titoloId : null;

    if (showTipoCopertura) {
      const tipoErr = validateTipoSinistro(tipoStd, tipoCustom);
      if (tipoErr) {
        toast.error(tipoErr);
        return;
      }
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const tipoPayload = showTipoCopertura
        ? resolveTipoSinistroPayload({
            tipo_sinistro: tipoStd,
            tipo_sinistro_personalizzato: tipoCustom,
          })
        : {};
      const { data, error } = await supabase.functions.invoke("gestione-sinistri", {
        body: {
          azione: "aggiorna",
          sinistro_id: sinistroId,
          user_id: user?.id,
          titolo_id: titoloIdEff,
          ...tipoPayload,
        },
      });
      if (error || !data?.success) {
        throw new Error(formatEdgeFunctionError(error, data));
      }
      toast.success(
        showTipoCopertura
          ? "Polizza e tipo di copertura aggiornati"
          : "Polizza collegata aggiornata",
      );
      onSaved();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore aggiornamento polizza";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const applySuggestedTipo = (titoloId: string) => {
    if (!showTipoCopertura || !titoloId) return;
    const selected = polizzeList.find((p) => p.id === titoloId);
    const suggested = suggestTipoSinistroFromTitolo(selected as unknown as Parameters<typeof suggestTipoSinistroFromTitolo>[0]);
    if (suggested) {
      setTipoStd(suggested);
      setTipoCustom("");
    }
  };

  const handleChange = async (val: string) => {
    setSelectedId(val);
    onValueChange?.(val);
    if (val && val !== (currentTitoloId ?? "")) {
      applySuggestedTipo(val);
    }
    const shouldAutoSave = autoSave && !showTipoCopertura;
    if (shouldAutoSave && val !== (currentTitoloId ?? "")) {
      await saveTitolo(val);
    }
  };

  const tipoDirty =
    (currentTipoSinistro || "") !== (usaPersonalizzato ? "" : tipoStd) ||
    (currentTipoPersonalizzato || "") !== (tipoCustom || "");
  const polizzaDirty = effectiveValue !== (currentTitoloId ?? "");
  const showExplicitSave = showSaveButton || showTipoCopertura;
  const canSave = showTipoCopertura ? polizzaDirty || tipoDirty : polizzaDirty;

  if (!clienteId) {
    return (
      <p className="text-xs text-muted-foreground">
        Nessun cliente collegato: impossibile selezionare una polizza.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Label className="text-xs">
            Polizza del cliente {polizzeLoading && <span className="text-muted-foreground">(caricamento…)</span>}
          </Label>
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <Checkbox
              checked={soloMadri}
              disabled={disabled || saving}
              onCheckedChange={(c) => setSoloMadri(!!c)}
            />
            <span>{soloMadri ? "Solo madri" : "Tutte le polizze"}</span>
          </label>
        </div>
        {polizzeList.length === 0 && !polizzeLoading ? (
          <p className="text-sm text-muted-foreground p-3 border rounded-lg bg-muted/30">
            Nessuna polizza trovata per questo cliente.
          </p>
        ) : (
          <SearchableSelect
            options={polizzeList.map((p) => buildPolizzaSelectOption(p))}
            value={effectiveValue}
            onValueChange={handleChange}
            placeholder="Seleziona una polizza…"
            searchValue={polizzaSearchText}
            onSearchChange={setPolizzaSearchText}
            clearable
            clearLabel="— Nessuna polizza —"
            className="w-full"
            disabled={disabled || saving}
            showSelectedDescription
          />
        )}
        {selectedPolizza && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <p>
              Prodotto:{" "}
              <span className="font-medium text-foreground">
                {formatPolizzaProdotto(selectedPolizza as unknown as Parameters<typeof formatPolizzaProdotto>[0])}
              </span>
            </p>
            <p>
              Garanzia:{" "}
              <span className="font-medium text-foreground">
                {formatPolizzaGaranzia(selectedPolizza as unknown as Parameters<typeof formatPolizzaGaranzia>[0])}
              </span>
            </p>
          </div>
        )}
      </div>

      {showTipoCopertura && (
        <div className="space-y-2">
          <Label htmlFor="tipo_copertura_collegata">Tipo di copertura</Label>
          {usaPersonalizzato ? (
            <Input
              id="tipo_copertura_collegata"
              placeholder="Descrivi il tipo di copertura (min 3 caratteri)"
              value={tipoCustom || ""}
              onChange={(e) => {
                setTipoCustom(e.target.value);
                setTipoStd("");
              }}
              maxLength={500}
              disabled={disabled || saving}
            />
          ) : (
            <SearchableSelect
              options={TIPI_SINISTRO.map((t) => ({ value: t.value, label: t.label }))}
              value={tipoStd || ""}
              onValueChange={setTipoStd}
              placeholder="Seleziona tipo di copertura…"
              searchPlaceholder="Cerca tipo…"
              disabled={disabled || saving}
            />
          )}
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="usa_tipo_copertura_personalizzato"
              checked={usaPersonalizzato}
              disabled={disabled || saving}
              onCheckedChange={(checked) => {
                if (checked) {
                  setTipoStd("__custom__");
                } else {
                  setTipoStd("");
                  setTipoCustom("");
                }
              }}
            />
            <Label htmlFor="usa_tipo_copertura_personalizzato" className="text-xs font-normal cursor-pointer">
              Tipo non in elenco (personalizzato)
            </Label>
          </div>
        </div>
      )}

      {showExplicitSave && canSave && (
        <Button
          type="button"
          size="sm"
          disabled={saving || disabled}
          onClick={() => saveTitolo(effectiveValue)}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          {showTipoCopertura ? "Salva polizza e copertura" : "Salva polizza"}
        </Button>
      )}
    </div>
  );
}
